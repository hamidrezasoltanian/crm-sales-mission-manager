<?php
// api/users/manage.php — مدیریت کاربران (فقط super_admin)
require_once __DIR__ . '/../helpers.php';
cors();
$user   = requireAuth();
$pdo    = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (!$user['is_manager'] && !$user['is_super_admin'])
        jsonOut(['ok' => false, 'err' => 'forbidden'], 403);
    $stmt = $pdo->query("
        SELECT username, display_name, role, is_manager, is_super_admin, is_inactive, created_at
        FROM users ORDER BY display_name
    ");
    jsonOut(['ok' => true, 'users' => $stmt->fetchAll()]);
}

if ($method !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

if (!$user['is_super_admin'])
    jsonOut(['ok' => false, 'err' => 'forbidden_super_admin_only'], 403);

$b      = json_decode(file_get_contents('php://input'), true) ?? [];
$action = trim($b['action'] ?? '');

switch ($action) {

case 'add':
    $un    = trim($b['username']     ?? '');
    $dn    = trim($b['display_name'] ?? '');
    $role  = trim($b['role']         ?? 'کارشناس');
    $pass  = trim($b['password']     ?? '');
    $isMgr = (int)($b['is_manager']  ?? 0);
    if (!$un || !$dn || !$pass) jsonOut(['ok' => false, 'err' => 'missing'], 400);
    if (!preg_match('/^[a-zA-Z0-9_.]+$/', $un)) jsonOut(['ok' => false, 'err' => 'invalid_username'], 400);
    if (strlen($pass) < 6) jsonOut(['ok' => false, 'err' => 'password_too_short'], 400);
    try {
        $pdo->prepare("
            INSERT INTO users(username,display_name,role,password_hash,is_manager)
            VALUES(?,?,?,?,?)
        ")->execute([$un, $dn, $role, hashPass($pass), $isMgr]);
        $pdo->prepare("INSERT IGNORE INTO sync_log(username) VALUES(?)")->execute([$un]);
        $pdo->prepare("
            INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
            VALUES('user',?,'_CREATE','',?,?,?)
        ")->execute([$un, $dn, $user['username'], (int)(microtime(true) * 1000)]);
        jsonOut(['ok' => true, 'username' => $un]);
    } catch (Exception $e) {
        jsonOut(['ok' => false, 'err' => 'duplicate'], 409);
    }
    break;

case 'deactivate':
    $un = trim($b['username'] ?? '');
    if (!$un || $un === $user['username']) jsonOut(['ok' => false, 'err' => 'invalid'], 400);
    $check = $pdo->prepare("SELECT is_super_admin FROM users WHERE username=?");
    $check->execute([$un]);
    if ($check->fetchColumn()) jsonOut(['ok' => false, 'err' => 'cannot_deactivate_super_admin'], 403);
    $pdo->prepare("UPDATE users SET is_inactive=1 WHERE username=?")->execute([$un]);
    $pdo->prepare("DELETE FROM sessions WHERE username=?")->execute([$un]);
    $pdo->prepare("
        INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
        VALUES('user',?,'_DEACTIVATE','active','inactive',?,?)
    ")->execute([$un, $user['username'], (int)(microtime(true) * 1000)]);
    jsonOut(['ok' => true]);
    break;

case 'activate':
    $un = trim($b['username'] ?? '');
    if (!$un) jsonOut(['ok' => false, 'err' => 'invalid'], 400);
    $pdo->prepare("UPDATE users SET is_inactive=0 WHERE username=?")->execute([$un]);
    $pdo->prepare("
        INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
        VALUES('user',?,'_ACTIVATE','inactive','active',?,?)
    ")->execute([$un, $user['username'], (int)(microtime(true) * 1000)]);
    jsonOut(['ok' => true]);
    break;

case 'reset_pass':
    $un = trim($b['username'] ?? '');
    $np = trim($b['new_pass'] ?? '');
    if (!$un || !$np) jsonOut(['ok' => false, 'err' => 'missing'], 400);
    if (strlen($np) < 6) jsonOut(['ok' => false, 'err' => 'password_too_short'], 400);
    $pdo->prepare("UPDATE users SET password_hash=? WHERE username=?")->execute([hashPass($np), $un]);
    $pdo->prepare("DELETE FROM sessions WHERE username=?")->execute([$un]);
    $pdo->prepare("
        INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
        VALUES('user',?,'_RESET_PASS','***','***',?,?)
    ")->execute([$un, $user['username'], (int)(microtime(true) * 1000)]);
    jsonOut(['ok' => true]);
    break;

case 'edit':
    $un    = trim($b['username']     ?? '');
    $dn    = trim($b['display_name'] ?? '');
    $role  = trim($b['role']         ?? '');
    $isMgr = isset($b['is_manager']) ? (int)$b['is_manager'] : null;
    if (!$un) jsonOut(['ok' => false, 'err' => 'missing'], 400);
    $fields = []; $vals = [];
    if ($dn)   { $fields[] = 'display_name=?'; $vals[] = $dn; }
    if ($role) { $fields[] = 'role=?';          $vals[] = $role; }
    if (!is_null($isMgr)) {
        if ($un === $user['username'] && $isMgr === 0)
            jsonOut(['ok' => false, 'err' => 'cannot_demote_self'], 403);
        $fields[] = 'is_manager=?'; $vals[] = $isMgr;
    }
    if (!count($fields)) jsonOut(['ok' => false, 'err' => 'no_changes'], 400);
    $vals[] = $un;
    $pdo->prepare("UPDATE users SET " . implode(',', $fields) . " WHERE username=?")->execute($vals);
    jsonOut(['ok' => true]);
    break;

default:
    jsonOut(['ok' => false, 'err' => 'unknown_action'], 400);
}
