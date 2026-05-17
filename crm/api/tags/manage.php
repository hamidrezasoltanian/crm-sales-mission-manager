<?php
// api/tags/manage.php — CRUD برای tags
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$pdo       = getDB();
$isManager = (bool)$user['is_manager'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("
        SELECT t.id, t.name, t.color, t.expires_at, t.description, t.created_by,
               t.created_at,
               COALESCE((SELECT COUNT(*) FROM record_tags rt WHERE rt.tag_id = t.id), 0) AS usage_count
        FROM tags t
        ORDER BY usage_count DESC, t.name ASC
    ");
    jsonOut(['ok' => true, 'tags' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b      = json_decode(file_get_contents('php://input'), true) ?? [];
$action = trim($b['action'] ?? '');

switch ($action) {

case 'create':
    $name    = trim($b['name'] ?? '');
    $color   = trim($b['color'] ?? '#3b82f6');
    $expires = trim($b['expires_at'] ?? '');
    $desc    = trim($b['description'] ?? '');

    if (!$name || mb_strlen($name) > 50) jsonOut(['ok' => false, 'err' => 'invalid_name'], 400);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#3b82f6';
    if ($expires && !preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $expires)) {
        jsonOut(['ok' => false, 'err' => 'invalid_date'], 400);
    }

    try {
        $pdo->prepare("
            INSERT INTO tags(name, color, expires_at, description, created_by)
            VALUES(?, ?, ?, ?, ?)
        ")->execute([$name, $color, $expires ?: null, $desc ?: null, $user['username']]);
        $id = (int)$pdo->lastInsertId();
        jsonOut(['ok' => true, 'id' => $id]);
    } catch (Exception $e) {
        jsonOut(['ok' => false, 'err' => 'duplicate_or_db'], 409);
    }
    break;

case 'update':
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonOut(['ok' => false, 'err' => 'invalid_id'], 400);

    $st = $pdo->prepare("SELECT created_by FROM tags WHERE id=?");
    $st->execute([$id]);
    $owner = $st->fetchColumn();
    if (!$owner) jsonOut(['ok' => false, 'err' => 'not_found'], 404);
    if ($owner !== $user['username'] && !$isManager) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    $fields = []; $vals = [];
    if (isset($b['name']))       { $fields[] = 'name=?';       $vals[] = trim($b['name']); }
    if (isset($b['color'])) {
        $c = trim($b['color']);
        if (preg_match('/^#[0-9a-fA-F]{6}$/', $c)) { $fields[] = 'color=?'; $vals[] = $c; }
    }
    if (isset($b['expires_at'])) {
        $exp = trim($b['expires_at']);
        if ($exp === '') { $fields[] = 'expires_at=NULL'; }
        elseif (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $exp)) { $fields[] = 'expires_at=?'; $vals[] = $exp; }
    }
    if (isset($b['description'])) { $fields[] = 'description=?'; $vals[] = trim($b['description']) ?: null; }

    if (!$fields) jsonOut(['ok' => false, 'err' => 'no_changes'], 400);
    $vals[] = $id;
    $pdo->prepare("UPDATE tags SET " . implode(',', $fields) . " WHERE id=?")->execute($vals);
    jsonOut(['ok' => true]);
    break;

case 'delete':
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonOut(['ok' => false, 'err' => 'invalid_id'], 400);

    $st = $pdo->prepare("SELECT created_by FROM tags WHERE id=?");
    $st->execute([$id]);
    $owner = $st->fetchColumn();
    if (!$owner) jsonOut(['ok' => false, 'err' => 'not_found'], 404);
    if ($owner !== $user['username'] && !$isManager) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM record_tags WHERE tag_id=?")->execute([$id]);
        $pdo->prepare("DELETE FROM tags WHERE id=?")->execute([$id]);
        $pdo->commit();
        jsonOut(['ok' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(['ok' => false, 'err' => 'db'], 500);
    }
    break;

case 'assign':
    $rt  = normalizeRecordType(trim($b['record_type'] ?? ''));
    $rid = trim($b['record_id'] ?? '');
    $tid = (int)($b['tag_id'] ?? 0);
    if (!$rt || !$rid || !$tid) jsonOut(['ok' => false, 'err' => 'missing'], 400);

    if (!$isManager) {
        $own = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
        $own->execute([$rt, $rid]);
        $current = $own->fetchColumn();
        if (!$current) {
            $table = ['province' => 'provinces', 'center' => 'centers', 'pc' => 'province_centers'][$rt] ?? null;
            if ($table) {
                $s = $pdo->prepare("SELECT owner FROM `$table` WHERE id=?");
                $s->execute([$rid]); $current = $s->fetchColumn();
            }
        }
        if ($current && $current !== $user['username']) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);
    }

    $pdo->prepare("
        INSERT IGNORE INTO record_tags(record_type, record_id, tag_id, assigned_by)
        VALUES(?, ?, ?, ?)
    ")->execute([$rt, $rid, $tid, $user['username']]);
    jsonOut(['ok' => true]);
    break;

case 'unassign':
    $rt  = normalizeRecordType(trim($b['record_type'] ?? ''));
    $rid = trim($b['record_id'] ?? '');
    $tid = (int)($b['tag_id'] ?? 0);
    if (!$rt || !$rid || !$tid) jsonOut(['ok' => false, 'err' => 'missing'], 400);

    if (!$isManager) {
        $own = $pdo->prepare("SELECT owner FROM record_owners WHERE record_type=? AND record_id=?");
        $own->execute([$rt, $rid]);
        $current = $own->fetchColumn();
        if (!$current) {
            $table = ['province' => 'provinces', 'center' => 'centers', 'pc' => 'province_centers'][$rt] ?? null;
            if ($table) {
                $s = $pdo->prepare("SELECT owner FROM `$table` WHERE id=?");
                $s->execute([$rid]); $current = $s->fetchColumn();
            }
        }
        if ($current && $current !== $user['username']) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);
    }

    $pdo->prepare("DELETE FROM record_tags WHERE record_type=? AND record_id=? AND tag_id=?")
        ->execute([$rt, $rid, $tid]);
    jsonOut(['ok' => true]);
    break;

default:
    jsonOut(['ok' => false, 'err' => 'unknown_action'], 400);
}
