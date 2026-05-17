<?php
// api/sync/pull.php — دریافت تغییرات از DB با فیلتر دسترسی
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$isManager = (bool)$user['is_manager'];
$username  = $user['username'];
$pdo       = getDB();

$out = ['ok' => true, 'data' => ['provinces' => [], 'centers' => [], 'pc' => [], 'checklist' => []]];

function buildEdit(array $row, ?string $defaultStatus = 'بدون تماس'): array {
    // FIX: اگر prods رشته خالی یا JSON نامعتبر باشد، [] برگردان
    $prods = [];
    if (!empty($row['prods'])) {
        $decoded = json_decode($row['prods'], true);
        if (is_array($decoded)) $prods = $decoded;
    }
    return [
        'status'       => $row['status'] ?? $defaultStatus,
        'lead'         => $row['lead'] ?? 'ندارد',
        'potential'    => (int)($row['potential'] ?? 3),
        'type'         => $row['centerType'] ?? '',
        'followupDate' => $row['followupDate'] ?? '',
        'prods'        => $prods,
        'owner'        => $row['owner'] ?? '',
        'lastActivity' => (int)($row['lastActivity'] ?? 0),
        'notesList'    => [],
    ];
}

// ── provinces — همه کاربران می‌توانند ببینند (provinces در سطح مدیر تعریف می‌شوند)
$stmt = $pdo->query("
    SELECT re.record_id AS id, re.status, re.lead_type AS lead,
           re.potential, re.center_type AS centerType,
           re.followup_date AS followupDate,
           re.products AS prods, re.last_activity AS lastActivity,
           COALESCE(ro.owner,'') AS owner
    FROM record_edits re
    LEFT JOIN record_owners ro ON ro.record_type='province' AND ro.record_id=re.record_id
    WHERE re.record_type='province'
");
foreach ($stmt->fetchAll() as $r) $out['data']['provinces'][$r['id']] = buildEdit($r, null);

$stmt2 = $pdo->query("SELECT record_id, owner FROM record_owners WHERE record_type='province'");
foreach ($stmt2->fetchAll() as $r) {
    if (!isset($out['data']['provinces'][$r['record_id']]))
        $out['data']['provinces'][$r['record_id']] = buildEdit(['owner' => $r['owner']], null);
    else
        $out['data']['provinces'][$r['record_id']]['owner'] = $r['owner'];
}

// ── centers — FIX: فیلتر بر اساس owner برای کارشناس
if ($isManager) {
    $stmt = $pdo->query("
        SELECT re.record_id AS id, re.status, re.lead_type AS lead,
               re.potential, re.center_type AS centerType,
               re.followup_date AS followupDate,
               re.products AS prods, re.last_activity AS lastActivity,
               COALESCE(ro.owner,'') AS owner,
               c.name AS centerName
        FROM record_edits re
        LEFT JOIN record_owners ro ON ro.record_type='center' AND ro.record_id=re.record_id
        LEFT JOIN centers c ON c.id = re.record_id
        WHERE re.record_type='center'
    ");
} else {
    $stmt = $pdo->prepare("
        SELECT re.record_id AS id, re.status, re.lead_type AS lead,
               re.potential, re.center_type AS centerType,
               re.followup_date AS followupDate,
               re.products AS prods, re.last_activity AS lastActivity,
               COALESCE(ro.owner, c.owner, '') AS owner,
               c.name AS centerName
        FROM record_edits re
        LEFT JOIN record_owners ro ON ro.record_type='center' AND ro.record_id=re.record_id
        LEFT JOIN centers c ON c.id = re.record_id
        WHERE re.record_type='center'
          AND COALESCE(ro.owner, c.owner) = ?
    ");
    $stmt->execute([$username]);
}
foreach ($stmt->fetchAll() as $r) {
    $edit = buildEdit($r);
    if (strpos($r['id'], 'new_') === 0 && !empty($r['centerName'])) {
        $edit['_name'] = $r['centerName'];
    }
    $out['data']['centers'][$r['id']] = $edit;
}

// owner بدون edit — فقط مدیر نیاز دارد همه را ببیند
if ($isManager) {
    $stmt2 = $pdo->query("SELECT record_id, owner FROM record_owners WHERE record_type='center'");
    foreach ($stmt2->fetchAll() as $r) {
        if (!isset($out['data']['centers'][$r['record_id']]))
            $out['data']['centers'][$r['record_id']] = buildEdit(['owner' => $r['owner']]);
        else
            $out['data']['centers'][$r['record_id']]['owner'] = $r['owner'];
    }
}

// ── pc (province centers) — FIX: فیلتر بر اساس owner
if ($isManager) {
    $stmt = $pdo->query("
        SELECT re.record_id AS id, re.status, re.lead_type AS lead,
               re.potential, re.center_type AS centerType,
               re.followup_date AS followupDate,
               re.products AS prods, re.last_activity AS lastActivity,
               COALESCE(ro.owner,'') AS owner,
               pc.name AS pcName
        FROM record_edits re
        LEFT JOIN record_owners ro ON ro.record_type='pc' AND ro.record_id=re.record_id
        LEFT JOIN province_centers pc ON pc.id = re.record_id
        WHERE re.record_type='pc'
    ");
} else {
    $stmt = $pdo->prepare("
        SELECT re.record_id AS id, re.status, re.lead_type AS lead,
               re.potential, re.center_type AS centerType,
               re.followup_date AS followupDate,
               re.products AS prods, re.last_activity AS lastActivity,
               COALESCE(ro.owner, pc.owner, '') AS owner,
               pc.name AS pcName
        FROM record_edits re
        LEFT JOIN record_owners ro ON ro.record_type='pc' AND ro.record_id=re.record_id
        LEFT JOIN province_centers pc ON pc.id = re.record_id
        WHERE re.record_type='pc'
          AND COALESCE(ro.owner, pc.owner) = ?
    ");
    $stmt->execute([$username]);
}
foreach ($stmt->fetchAll() as $r) {
    $edit = buildEdit($r);
    if (strpos($r['id'], '||new||') !== false && !empty($r['pcName'])) {
        $edit['name'] = $r['pcName'];
        $edit['pot']  = $edit['potential'];
    }
    $out['data']['pc'][$r['id']] = $edit;
}

if ($isManager) {
    $stmt2 = $pdo->query("SELECT record_id, owner FROM record_owners WHERE record_type='pc'");
    foreach ($stmt2->fetchAll() as $r) {
        if (!isset($out['data']['pc'][$r['record_id']]))
            $out['data']['pc'][$r['record_id']] = buildEdit(['owner' => $r['owner']]);
        else
            $out['data']['pc'][$r['record_id']]['owner'] = $r['owner'];
    }
}

// ── notes — FIX: فیلتر بر اساس مالک رکورد
if ($isManager) {
    $noteStmt = $pdo->query("
        SELECT record_type, record_id, note_text AS text,
               jalali_datetime AS ts, raw_ts AS rawTs, created_by AS user
        FROM notes ORDER BY raw_ts
    ");
} else {
    $noteStmt = $pdo->prepare("
        SELECT n.record_type, n.record_id, n.note_text AS text,
               n.jalali_datetime AS ts, n.raw_ts AS rawTs, n.created_by AS user
        FROM notes n
        LEFT JOIN record_owners ro ON ro.record_type=n.record_type AND ro.record_id=n.record_id
        LEFT JOIN centers c ON n.record_type='center' AND c.id=n.record_id
        LEFT JOIN province_centers pc ON n.record_type='pc' AND pc.id=n.record_id
        WHERE n.record_type='province'
           OR COALESCE(ro.owner, c.owner, pc.owner) = ?
        ORDER BY n.raw_ts
    ");
    $noteStmt->execute([$username]);
}
foreach ($noteStmt->fetchAll() as $n) {
    $type = $n['record_type'];
    $id   = $n['record_id'];
    $key  = ($type === 'pc') ? 'pc' : ($type === 'province' ? 'provinces' : 'centers');
    if (!isset($out['data'][$key][$id]))
        $out['data'][$key][$id] = buildEdit([], ($type === 'province' ? null : 'بدون تماس'));
    $out['data'][$key][$id]['notesList'][] = [
        'text'  => $n['text'],
        'ts'    => $n['ts'],
        'rawTs' => (int)$n['rawTs'],
        'user'  => $n['user'],
    ];
}

// ── checklist
$ckSql = "SELECT check_date, items, daily_note FROM checklist";
$ckPrm = [];
if (!$isManager) { $ckSql .= " WHERE username=?"; $ckPrm[] = $username; }
$ckSql .= " ORDER BY check_date DESC LIMIT 60";
$ckStmt = $pdo->prepare($ckSql);
$ckStmt->execute($ckPrm);
foreach ($ckStmt->fetchAll() as $ck) {
    $out['data']['checklist'][$ck['check_date']] = [
        'items' => $ck['items'] ? (json_decode($ck['items'], true) ?? []) : [],
        'note'  => $ck['daily_note'] ?? '',
    ];
}

$pdo->prepare("UPDATE sync_log SET last_pull=NOW(), pull_count=pull_count+1 WHERE username=?")->execute([$username]);
jsonOut($out);
