<?php
// api/events/manage.php — CRUD رویدادها
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$pdo       = getDB();
$isManager = (bool)$user['is_manager'];
$me        = $user['username'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where  = [];
    $params = [];

    // FIX: مدیر همه رویدادها را می‌بیند، کارشناس فقط خودش + shared
    if ($isManager) {
        // مدیر همه رویدادها را می‌بیند (هیچ فیلتر owner نداریم)
    } else {
        $where[]  = '(owner = ? OR shared_with_team = 1)';
        $params[] = $me;
    }

    if (!empty($_GET['from'])) { $where[] = 'start_at >= ?'; $params[] = (int)$_GET['from']; }
    if (!empty($_GET['to']))   { $where[] = 'start_at <= ?'; $params[] = (int)$_GET['to']; }

    if (!empty($_GET['related_type']) && !empty($_GET['related_id'])) {
        $rt = normalizeRecordType($_GET['related_type']);
        if ($rt) {
            $where[]  = 'related_record_type = ? AND related_record_id = ?';
            $params[] = $rt;
            $params[] = $_GET['related_id'];
        }
    }

    $sql = "SELECT * FROM events";
    if ($where) $sql .= " WHERE " . implode(' AND ', $where);
    $sql .= " ORDER BY start_at ASC LIMIT 500";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonOut(['ok' => true, 'events' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b      = json_decode(file_get_contents('php://input'), true) ?? [];
$action = trim($b['action'] ?? '');

function _ev_canEdit(PDO $pdo, int $id, string $me, bool $isManager): bool {
    $st = $pdo->prepare("SELECT owner, shared_with_team FROM events WHERE id=?");
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) return false;
    if ($row['owner'] === $me) return true;
    if ($isManager) return true;
    return false;
}

switch ($action) {

case 'create':
    $title    = trim($b['title'] ?? '');
    $desc     = trim($b['description'] ?? '');
    $start    = (int)($b['start_at'] ?? 0);
    $end      = isset($b['end_at']) ? (int)$b['end_at'] : null;
    $allDay   = !empty($b['all_day']) ? 1 : 0;
    $color    = trim($b['color'] ?? '#0ea5e9');
    $relType  = isset($b['related_record_type']) ? normalizeRecordType($b['related_record_type']) : null;
    $relId    = trim($b['related_record_id'] ?? '');
    $reminder = (int)($b['reminder_minutes'] ?? 0);
    $shared   = (!empty($b['shared_with_team']) && $isManager) ? 1 : 0;
    $recur    = trim($b['recurrence'] ?? '');

    if (!$title || mb_strlen($title) > 200) jsonOut(['ok' => false, 'err' => 'invalid_title'], 400);
    if ($start < 1) jsonOut(['ok' => false, 'err' => 'invalid_start'], 400);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#0ea5e9';
    if (!in_array($reminder, [0, 15, 60, 1440], true)) $reminder = 0;
    if ($recur && !in_array($recur, ['daily', 'weekly', 'monthly'], true)) $recur = '';

    $pdo->prepare("
        INSERT INTO events(title, description, start_at, end_at, all_day, color,
                           owner, related_record_type, related_record_id,
                           reminder_minutes, shared_with_team, recurrence)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $title, $desc ?: null, $start, $end ?: null, $allDay, $color,
        $me, $relType ?: null, $relId ?: null, $reminder, $shared, $recur ?: null
    ]);
    $id = (int)$pdo->lastInsertId();

    $pdo->prepare("
        INSERT INTO audit_trail(record_type, record_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES('event', ?, '_CREATE', '', ?, ?, ?)
    ")->execute([(string)$id, $title, $me, (int)(microtime(true) * 1000)]);

    jsonOut(['ok' => true, 'id' => $id]);
    break;

case 'update':
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonOut(['ok' => false, 'err' => 'invalid_id'], 400);
    if (!_ev_canEdit($pdo, $id, $me, $isManager)) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    $fields = []; $vals = [];
    if (isset($b['title']))       { $fields[] = 'title=?';       $vals[] = trim($b['title']); }
    if (isset($b['description'])) { $fields[] = 'description=?'; $vals[] = trim($b['description']) ?: null; }
    if (isset($b['start_at']))    { $fields[] = 'start_at=?';    $vals[] = (int)$b['start_at']; }
    if (isset($b['end_at']))      { $fields[] = 'end_at=?';      $vals[] = $b['end_at'] ? (int)$b['end_at'] : null; }
    if (isset($b['all_day']))     { $fields[] = 'all_day=?';     $vals[] = $b['all_day'] ? 1 : 0; }
    if (isset($b['color'])) {
        $c = trim($b['color']);
        if (preg_match('/^#[0-9a-fA-F]{6}$/', $c)) { $fields[] = 'color=?'; $vals[] = $c; }
    }
    if (isset($b['reminder_minutes'])) {
        $r = (int)$b['reminder_minutes'];
        if (in_array($r, [0, 15, 60, 1440], true)) { $fields[] = 'reminder_minutes=?'; $vals[] = $r; }
    }
    if (isset($b['shared_with_team']) && $isManager) {
        $fields[] = 'shared_with_team=?'; $vals[] = $b['shared_with_team'] ? 1 : 0;
    }
    if (isset($b['recurrence'])) {
        $r = trim($b['recurrence']);
        if ($r === '') { $fields[] = 'recurrence=NULL'; }
        elseif (in_array($r, ['daily', 'weekly', 'monthly'], true)) { $fields[] = 'recurrence=?'; $vals[] = $r; }
    }
    if (isset($b['status']) && in_array($b['status'], ['planned', 'done', 'cancelled'], true)) {
        $fields[] = 'status=?'; $vals[] = $b['status'];
    }

    if (!$fields) jsonOut(['ok' => false, 'err' => 'no_changes'], 400);
    $vals[] = $id;
    $pdo->prepare("UPDATE events SET " . implode(',', $fields) . " WHERE id=?")->execute($vals);

    $pdo->prepare("
        INSERT INTO audit_trail(record_type, record_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES('event', ?, '_UPDATE', '', ?, ?, ?)
    ")->execute([(string)$id, implode(',', array_map(function ($f) { return explode('=', $f)[0]; }, $fields)), $me, (int)(microtime(true) * 1000)]);

    jsonOut(['ok' => true]);
    break;

case 'delete':
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonOut(['ok' => false, 'err' => 'invalid_id'], 400);
    if (!_ev_canEdit($pdo, $id, $me, $isManager)) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    $pdo->prepare("DELETE FROM events WHERE id=?")->execute([$id]);
    $pdo->prepare("
        INSERT INTO audit_trail(record_type, record_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES('event', ?, '_DELETE', 'planned', 'deleted', ?, ?)
    ")->execute([(string)$id, $me, (int)(microtime(true) * 1000)]);
    jsonOut(['ok' => true]);
    break;

case 'complete':
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonOut(['ok' => false, 'err' => 'invalid_id'], 400);
    if (!_ev_canEdit($pdo, $id, $me, $isManager)) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    $pdo->prepare("UPDATE events SET status='done' WHERE id=?")->execute([$id]);
    jsonOut(['ok' => true]);
    break;

default:
    jsonOut(['ok' => false, 'err' => 'unknown_action'], 400);
}
