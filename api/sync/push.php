<?php
// api/sync/push.php — ذخیره کامل userEdits در DB
require_once __DIR__ . '/../helpers.php';
cors();

// FIX: body یک بار خوانده می‌شود — token برای sendBeacon از body خوانده می‌شود
$rawBody = file_get_contents('php://input');
$body    = json_decode($rawBody, true);
if (!is_array($body)) jsonOut(['ok' => false, 'err' => 'invalid json'], 400);

// FIX: sendBeacon token از body (نه از URL)
$beaconToken = is_string($body['_token'] ?? null) ? $body['_token'] : null;
$user = requireAuth($beaconToken);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$pdo      = getDB();
$username = $user['username'];
$saved    = 0;
$audited  = 0;
$deleted  = 0;

function deleteRecord(PDO $pdo, string $type, string $id, string $username, int &$auditCount): void {
    $pdo->prepare("DELETE FROM record_edits WHERE record_type=? AND record_id=?")->execute([$type, $id]);
    $pdo->prepare("DELETE FROM record_owners WHERE record_type=? AND record_id=?")->execute([$type, $id]);
    $pdo->prepare("DELETE FROM notes WHERE record_type=? AND record_id=?")->execute([$type, $id]);
    if ($type === 'center' && strpos($id, 'new_') === 0) {
        $pdo->prepare("DELETE FROM centers WHERE id=?")->execute([$id]);
    }
    if ($type === 'pc' && strpos($id, '||new||') !== false) {
        $pdo->prepare("DELETE FROM province_centers WHERE id=?")->execute([$id]);
    }
    $pdo->prepare("
        INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
        VALUES(?,?,'_DELETE','active','deleted',?,?)
    ")->execute([$type, $id, $username, (int)(microtime(true) * 1000)]);
    $auditCount++;
}

function saveRecord(PDO $pdo, string $type, string $id, array $e, string $username, int &$auditCount): void {
    $lastAct = isset($e['lastActivity']) ? (int)$e['lastActivity'] : (int)(microtime(true) * 1000);

    $prev = ['status' => null, 'lead_type' => null, 'potential' => null, 'center_type' => null,
             'followup_date' => null, 'products' => null, 'owner' => null];
    $stmt = $pdo->prepare("SELECT status,lead_type,potential,center_type,followup_date,products FROM record_edits WHERE record_type=? AND record_id=?");
    $stmt->execute([$type, $id]);
    $row = $stmt->fetch();
    if ($row) $prev = array_merge($prev, $row);

    $ownerStmt = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
    $ownerStmt->execute([$type, $id]);
    $ownerRow = $ownerStmt->fetch();
    if ($ownerRow) $prev['owner'] = $ownerRow['owner'];

    $status     = $e['status']     ?? null;
    $lead       = $e['lead']       ?? null;
    // FIX: null واقعی ارسال می‌شود اگر در payload نبود — از default 3 استفاده نمی‌کنیم
    $potential  = array_key_exists('potential', $e) ? (int)$e['potential']
                : (array_key_exists('pot', $e) ? (int)$e['pot'] : null);
    $centerType = $e['type'] ?? $e['centerType'] ?? null;
    $followup   = (isset($e['followupDate']) && $e['followupDate'] !== '') ? $e['followupDate'] : null;
    $prods      = (isset($e['prods']) && is_array($e['prods']) && count($e['prods'])) ? json_encode($e['prods']) : null;
    $owner      = $e['owner'] ?? '';
    $name       = $e['_name'] ?? $e['name'] ?? null;

    $audits = [];
    if ($status !== null   && ($prev['status']      ?? '') !== $status)     $audits[] = ['status',       (string)($prev['status']      ?? ''), (string)$status];
    if ($lead !== null     && ($prev['lead_type']   ?? '') !== $lead)       $audits[] = ['lead',         (string)($prev['lead_type']   ?? ''), (string)$lead];
    if ($potential !== null && (int)($prev['potential'] ?? 0) !== $potential) $audits[] = ['potential', (string)($prev['potential'] ?? ''), (string)$potential];
    if ($centerType !== null && ($prev['center_type'] ?? '') !== $centerType) $audits[] = ['center_type', (string)($prev['center_type'] ?? ''), (string)$centerType];
    if ($followup !== null && ($prev['followup_date'] ?? '') !== $followup)  $audits[] = ['followup_date', (string)($prev['followup_date'] ?? ''), $followup];
    if ($prods !== null && ($prev['products'] ?? '') !== $prods)             $audits[] = ['products',     (string)($prev['products'] ?? ''), substr($prods, 0, 500)];

    // FIX: potential را فقط اگر واقعاً ارسال شده update کن (null = دست نزن)
    $pdo->prepare("
        INSERT INTO record_edits
            (record_type,record_id,status,lead_type,potential,center_type,followup_date,products,last_activity)
        VALUES(?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
            status=COALESCE(VALUES(status),status),
            lead_type=COALESCE(VALUES(lead_type),lead_type),
            potential=COALESCE(VALUES(potential),potential),
            center_type=COALESCE(VALUES(center_type),center_type),
            followup_date=VALUES(followup_date),
            products=COALESCE(VALUES(products),products),
            last_activity=GREATEST(last_activity,VALUES(last_activity))
    ")->execute([$type, $id, $status, $lead, $potential, $centerType, $followup, $prods, $lastAct]);

    if ($owner) {
        $owner_clean = preg_replace('/[^a-zA-Z0-9_.]/', '', $owner);
        $pdo->prepare("
            INSERT INTO record_owners(record_type,record_id,owner) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE owner=VALUES(owner)
        ")->execute([$type, $id, $owner_clean]);
        if (($prev['owner'] ?? '') !== $owner_clean) $audits[] = ['owner', (string)($prev['owner'] ?? ''), $owner_clean];
    }

    if ($name) {
        if ($type === 'center' && strpos($id, 'new_') === 0) {
            $pdo->prepare("
                INSERT INTO centers(id,province_id,row_num,name,potential,center_type,lead_type,weight,owner)
                VALUES(?,'tehran',9999,?,?,?,?,'',?)
                ON DUPLICATE KEY UPDATE name=VALUES(name)
            ")->execute([$id, substr($name, 0, 200), $potential ?? 3, $centerType ?? '', $lead ?? 'سرنخ', $username]);
            $audits[] = ['_NEW', '', substr($name, 0, 200)];
        } elseif ($type === 'pc' && strpos($id, '||new||') !== false) {
            $provId = explode('||', $id)[0];
            $pdo->prepare("
                INSERT INTO province_centers(id,province_id,row_num,name,potential,center_type,lead_type,owner)
                VALUES(?,?,9999,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE name=VALUES(name)
            ")->execute([$id, substr($provId, 0, 20), substr($name, 0, 200), $potential ?? 3, $centerType ?? '', $lead ?? 'سرنخ', $username]);
            $audits[] = ['_NEW', '', substr($name, 0, 200)];
        }
    }

    if (count($audits)) {
        $auditStmt = $pdo->prepare("
            INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
            VALUES(?,?,?,?,?,?,?)
        ");
        foreach ($audits as $a) {
            $auditStmt->execute([$type, $id, $a[0], substr($a[1], 0, 500), substr($a[2], 0, 500), $username, $lastAct]);
            $auditCount++;
        }
    }

    foreach ($e['notesList'] ?? [] as $n) {
        if (empty($n['text']) || empty($n['rawTs'])) continue;
        $jalali = $n['ts'] ?? date('Y/m/d', (int)($n['rawTs'] / 1000));
        $pdo->prepare("
            INSERT IGNORE INTO notes(record_type,record_id,note_text,jalali_datetime,raw_ts,created_by)
            VALUES(?,?,?,?,?,?)
        ")->execute([$type, $id, $n['text'], $jalali, (int)$n['rawTs'], $n['user'] ?? $username]);
    }
}

function canEdit(PDO $pdo, string $type, string $id, string $username, bool $isManager): bool {
    if ($isManager) return true;
    if (strpos($id, 'new_') === 0 || strpos($id, '||new||') !== false) return true;

    $stmt = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
    $stmt->execute([$type, $id]);
    $owner = $stmt->fetchColumn();
    if (!$owner) {
        $table = ['province' => 'provinces', 'center' => 'centers', 'pc' => 'province_centers'][$type] ?? null;
        if ($table) {
            $s = $pdo->prepare("SELECT owner FROM `$table` WHERE id=?");
            $s->execute([$id]);
            $owner = $s->fetchColumn();
        }
    }
    return !$owner || $owner === $username;
}

$isManager = (bool)$user['is_manager'];
$skipped   = 0;

$pdo->beginTransaction();
try {
    foreach ($body['provinces'] ?? [] as $id => $e) {
        if (!preg_match('/^p\d+$/', $id)) continue;
        if (!canEdit($pdo, 'province', $id, $username, $isManager)) { $skipped++; continue; }
        if (!$isManager && isset($e['owner']) && $e['owner'] && $e['owner'] !== $username) unset($e['owner']);
        if (!empty($e['_del'])) { deleteRecord($pdo, 'province', $id, $username, $audited); $deleted++; }
        else { saveRecord($pdo, 'province', $id, $e, $username, $audited); $saved++; }
    }

    foreach ($body['centers'] ?? [] as $id => $e) {
        if (!preg_match('/^(c\d+|new_\d+)$/', $id)) continue;
        if (!canEdit($pdo, 'center', $id, $username, $isManager)) { $skipped++; continue; }
        if (!$isManager && isset($e['owner']) && $e['owner'] && $e['owner'] !== $username) unset($e['owner']);
        if (!empty($e['_del'])) { deleteRecord($pdo, 'center', $id, $username, $audited); $deleted++; }
        else { saveRecord($pdo, 'center', $id, $e, $username, $audited); $saved++; }
    }

    foreach ($body['pc'] ?? [] as $id => $e) {
        if (strlen($id) > 255 || strlen($id) < 3) continue;
        if (!canEdit($pdo, 'pc', $id, $username, $isManager)) { $skipped++; continue; }
        if (!$isManager && isset($e['owner']) && $e['owner'] && $e['owner'] !== $username) unset($e['owner']);
        if (!empty($e['_del'])) { deleteRecord($pdo, 'pc', $id, $username, $audited); $deleted++; }
        else { saveRecord($pdo, 'pc', $id, $e, $username, $audited); $saved++; }
    }

    foreach ($body['checklist'] ?? [] as $date => $ck) {
        if (!preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $date)) continue;
        $items = isset($ck['items']) && is_array($ck['items']) ? json_encode($ck['items']) : '[]';
        $note  = $ck['note'] ?? '';
        $score = is_array($ck['items']) ? count(array_filter($ck['items'])) : 0;
        $pdo->prepare("
            INSERT INTO checklist(check_date,username,items,daily_note,score) VALUES(?,?,?,?,?)
            ON DUPLICATE KEY UPDATE items=VALUES(items),daily_note=VALUES(daily_note),score=VALUES(score)
        ")->execute([$date, $username, $items, $note, $score]);
        $saved++;
    }

    $pdo->prepare("UPDATE sync_log SET last_push=NOW(),push_count=push_count+1,last_record_ts=? WHERE username=?")
        ->execute([(int)(microtime(true) * 1000), $username]);

    $pdo->commit();
    jsonOut(['ok' => true, 'saved' => $saved, 'deleted' => $deleted, 'audited' => $audited, 'skipped' => $skipped]);

} catch (Exception $ex) {
    $pdo->rollBack();
    error_log('push.php error: ' . $ex->getMessage());
    jsonOut(['ok' => false, 'err' => 'db_error'], 500);
}
