<?php
// api/record/note_delete.php — حذف یک یادداشت
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b     = json_decode(file_get_contents('php://input'), true) ?? [];
$type  = normalizeRecordType(trim($b['type']  ?? ''));
$id    = trim($b['id']    ?? '');
$rawTs = intval($b['rawTs'] ?? 0);

if (!$type || !$id || !$rawTs) jsonOut(['ok' => false, 'err' => 'missing fields'], 400);

$pdo  = getDB();
$stmt = $pdo->prepare("SELECT created_by FROM notes WHERE record_type=? AND record_id=? AND raw_ts=?");
$stmt->execute([$type, $id, $rawTs]);
$note = $stmt->fetch();
if (!$note) jsonOut(['ok' => false, 'err' => 'not_found'], 404);

if ($note['created_by'] !== $user['username'] && !$user['is_manager'])
    jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

$pdo->prepare("DELETE FROM notes WHERE record_type=? AND record_id=? AND raw_ts=?")
    ->execute([$type, $id, $rawTs]);

$pdo->prepare("
    INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
    VALUES(?,?,'_NOTE_DELETE',?,'deleted',?,?)
")->execute([$type, $id, (int)$rawTs, $user['username'], (int)(microtime(true) * 1000)]);

jsonOut(['ok' => true]);
