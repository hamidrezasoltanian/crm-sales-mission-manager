<?php
// api/record/edit.php — ذخیره یک record edit
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b = json_decode(file_get_contents('php://input'), true);
if (!$b) jsonOut(['ok' => false, 'err' => 'invalid json'], 400);

$type    = normalizeRecordType(trim($b['type'] ?? ''));
$id      = trim($b['id'] ?? '');
$lastAct = isset($b['lastActivity']) ? (int)$b['lastActivity'] : (int)(microtime(true) * 1000);

if (!$type || !$id) jsonOut(['ok' => false, 'err' => 'invalid_type'], 400);

$pdo       = getDB();
$isManager = (bool)$user['is_manager'];

// ── PERMISSION CHECK ──────────────────────────────────────────
if (!$isManager) {
    $ownerStmt = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
    $ownerStmt->execute([$type, $id]);
    $currentOwner = $ownerStmt->fetchColumn();

    if (!$currentOwner) {
        if ($type === 'province') {
            $s = $pdo->prepare("SELECT owner FROM provinces WHERE id=?");
            $s->execute([$id]); $currentOwner = $s->fetchColumn();
        } elseif ($type === 'center') {
            $s = $pdo->prepare("SELECT owner FROM centers WHERE id=?");
            $s->execute([$id]); $currentOwner = $s->fetchColumn();
        } elseif ($type === 'pc') {
            $s = $pdo->prepare("SELECT owner FROM province_centers WHERE id=?");
            $s->execute([$id]); $currentOwner = $s->fetchColumn();
        }
    }

    $isNewRecord = (strpos($id, 'new_') === 0 || strpos($id, '||new||') !== false);

    if ($currentOwner && $currentOwner !== $user['username'] && !$isNewRecord) {
        jsonOut(['ok' => false, 'err' => 'forbidden_not_owner'], 403);
    }

    // FIX: کارشناس نمی‌تواند owner را به دیگری تغییر دهد — بدون استثنا
    if (!is_null($b['owner'] ?? null) && $b['owner'] !== '' && $b['owner'] !== $user['username']) {
        jsonOut(['ok' => false, 'err' => 'forbidden_owner_change'], 403);
    }
}

// ── حذف (_del flag) ──────────────────────────────────────────
if (!empty($b['_del'])) {
    $pdo->beginTransaction();
    try {
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
        ")->execute([$type, $id, $user['username'], $lastAct]);
        $pdo->commit();
        jsonOut(['ok' => true, 'deleted' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('edit.php delete: ' . $e->getMessage());
        jsonOut(['ok' => false, 'err' => 'db'], 500);
    }
}

// ── خواندن مقادیر قبلی ───────────────────────────────────────
$prev = ['status' => null, 'lead_type' => null, 'potential' => null,
         'center_type' => null, 'followup_date' => null, 'products' => null, 'owner' => null];
$stmt = $pdo->prepare("SELECT status,lead_type,potential,center_type,followup_date,products FROM record_edits WHERE record_type=? AND record_id=?");
$stmt->execute([$type, $id]);
$row = $stmt->fetch();
if ($row) $prev = array_merge($prev, $row);

$stmt = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
$stmt->execute([$type, $id]);
$ownerRow = $stmt->fetch();
if ($ownerRow) $prev['owner'] = $ownerRow['owner'];

$pdo->beginTransaction();
try {
    $fields = []; $vals = []; $auditChanges = [];

    if (!is_null($b['status'] ?? null)) {
        $newVal = substr((string)$b['status'], 0, 50);
        $fields[] = 'status=?'; $vals[] = $newVal;
        if (($prev['status'] ?? '') !== $newVal) $auditChanges[] = ['status', $prev['status'] ?? '', $newVal];
    }
    if (!is_null($b['lead'] ?? null)) {
        $newVal = substr((string)$b['lead'], 0, 50);
        $fields[] = 'lead_type=?'; $vals[] = $newVal;
        if (($prev['lead_type'] ?? '') !== $newVal) $auditChanges[] = ['lead', $prev['lead_type'] ?? '', $newVal];
    }
    if (!is_null($b['potential'] ?? null)) {
        $newVal = (int)$b['potential'];
        $fields[] = 'potential=?'; $vals[] = $newVal;
        if ((int)($prev['potential'] ?? 0) !== $newVal) $auditChanges[] = ['potential', (string)($prev['potential'] ?? ''), (string)$newVal];
    }
    if (!is_null($b['centerType'] ?? null)) {
        $newVal = substr((string)$b['centerType'], 0, 100);
        $fields[] = 'center_type=?'; $vals[] = $newVal;
        if (($prev['center_type'] ?? '') !== $newVal) $auditChanges[] = ['center_type', $prev['center_type'] ?? '', $newVal];
    }
    if (!is_null($b['followupDate'] ?? null) && $b['followupDate'] !== '') {
        $fd = (string)$b['followupDate'];
        if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $fd)) {
            $fields[] = 'followup_date=?'; $vals[] = $fd;
            if (($prev['followup_date'] ?? '') !== $fd) $auditChanges[] = ['followup_date', $prev['followup_date'] ?? '', $fd];
        }
    } elseif (isset($b['followupDate']) && ($b['followupDate'] === '' || $b['followupDate'] === null)) {
        $fields[] = 'followup_date=NULL';
        if (!empty($prev['followup_date'])) $auditChanges[] = ['followup_date', (string)$prev['followup_date'], ''];
    }
    if (!is_null($b['prods'] ?? null) && is_array($b['prods']) && count($b['prods'])) {
        $newJson = json_encode($b['prods']);
        $fields[] = 'products=?'; $vals[] = $newJson;
        if (($prev['products'] ?? '') !== $newJson) $auditChanges[] = ['products', (string)($prev['products'] ?? ''), substr($newJson, 0, 500)];
    }

    $fields[] = 'last_activity=GREATEST(last_activity,?)';
    $vals[]   = $lastAct;

    if (count($fields)) {
        $setStr = implode(',', $fields);
        $stmt   = $pdo->prepare("
            INSERT INTO record_edits(record_type,record_id,last_activity) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE $setStr
        ");
        $stmt->execute(array_merge([$type, $id, $lastAct], $vals));
    }

    // مرکز جدید — اضافه به جدول
    $name        = $b['name'] ?? $b['_name'] ?? null;
    $potentialNew = isset($b['potential']) ? (int)$b['potential'] : 3;
    $typeNew     = isset($b['centerType']) ? substr((string)$b['centerType'], 0, 100) : '';
    $leadNew     = isset($b['lead']) ? substr((string)$b['lead'], 0, 50) : 'سرنخ';

    if ($name) {
        if ($type === 'center' && strpos($id, 'new_') === 0) {
            $pdo->prepare("
                INSERT INTO centers(id,province_id,row_num,name,potential,center_type,lead_type,weight,owner)
                VALUES(?,'tehran',9999,?,?,?,?,'',?)
                ON DUPLICATE KEY UPDATE name=VALUES(name),potential=VALUES(potential),center_type=VALUES(center_type),lead_type=VALUES(lead_type)
            ")->execute([$id, substr($name, 0, 200), $potentialNew, $typeNew, $leadNew, $user['username']]);
            $auditChanges[] = ['_NEW', '', $name];
        } elseif ($type === 'pc' && strpos($id, '||new||') !== false) {
            $provId = explode('||', $id)[0];
            $pdo->prepare("
                INSERT INTO province_centers(id,province_id,row_num,name,potential,center_type,lead_type,owner)
                VALUES(?,?,9999,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE name=VALUES(name),potential=VALUES(potential),center_type=VALUES(center_type),lead_type=VALUES(lead_type)
            ")->execute([$id, substr($provId, 0, 20), substr($name, 0, 200), $potentialNew, $typeNew, $leadNew, $user['username']]);
            $auditChanges[] = ['_NEW', '', $name];
        }
    }

    // owner — فقط مدیر می‌تواند به دیگری بدهد
    if (!is_null($b['owner'] ?? null) && $b['owner'] !== '') {
        $owner = preg_replace('/[^a-zA-Z0-9_.]/', '', $b['owner']);
        $pdo->prepare("
            INSERT INTO record_owners(record_type,record_id,owner) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE owner=VALUES(owner)
        ")->execute([$type, $id, $owner]);
        if (($prev['owner'] ?? '') !== $owner) $auditChanges[] = ['owner', $prev['owner'] ?? '', $owner];
    }

    if (count($auditChanges)) {
        $auditStmt = $pdo->prepare("
            INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
            VALUES(?,?,?,?,?,?,?)
        ");
        foreach ($auditChanges as $ch) {
            $auditStmt->execute([
                $type, $id, $ch[0],
                substr((string)$ch[1], 0, 500),
                substr((string)$ch[2], 0, 500),
                $user['username'], $lastAct
            ]);
        }
    }

    $pdo->commit();
    jsonOut(['ok' => true, 'audited' => count($auditChanges)]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log('edit.php: ' . $e->getMessage());
    jsonOut(['ok' => false, 'err' => 'db'], 500);
}
