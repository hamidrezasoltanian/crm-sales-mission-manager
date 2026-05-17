<?php
// api/record/note.php — افزودن یادداشت
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST')
    jsonOut(['ok' => false, 'err' => 'method'], 405);

$b     = json_decode(file_get_contents('php://input'), true) ?? [];
$type  = normalizeRecordType(trim($b['type']  ?? ''));
$id    = trim($b['id']    ?? '');
$text  = trim($b['text']  ?? '');
$rawTs = intval($b['rawTs'] ?? (time() * 1000));

if (!$type || !$id || !$text)
    jsonOut(['ok' => false, 'err' => 'missing fields'], 400);

if (strlen($text) > 5000)
    jsonOut(['ok' => false, 'err' => 'text_too_long'], 400);

$pdo = getDB();

if (!$user['is_manager']) {
    $ownerStmt = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
    $ownerStmt->execute([$type, $id]);
    $owner = $ownerStmt->fetchColumn();
    if (!$owner) {
        $table = ['province' => 'provinces', 'center' => 'centers', 'pc' => 'province_centers'][$type] ?? null;
        if ($table) {
            $s = $pdo->prepare("SELECT owner FROM `$table` WHERE id=?");
            $s->execute([$id]); $owner = $s->fetchColumn();
        }
    }
    $isNew = strpos($id, 'new_') === 0 || strpos($id, '||new||') !== false;
    if ($owner && $owner !== $user['username'] && !$isNew)
        jsonOut(['ok' => false, 'err' => 'forbidden_not_owner'], 403);
}

$jalali = unixMsToJalali($rawTs);

$pdo->prepare("
    INSERT IGNORE INTO notes
        (record_type, record_id, note_text, jalali_datetime, raw_ts, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
")->execute([$type, $id, $text, $jalali, $rawTs, $user['username']]);

jsonOut(['ok' => true, 'rawTs' => $rawTs]);
