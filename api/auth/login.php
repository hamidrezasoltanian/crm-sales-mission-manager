<?php
// api/auth/login.php
require_once __DIR__ . '/../helpers.php';

cors();
cleanupSessions();

if ($_SERVER['REQUEST_METHOD'] !== 'POST')
    jsonOut(['ok' => false, 'err' => 'method'], 405);

$body = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password = trim($body['password'] ?? '');

if (!$username || !$password)
    jsonOut(['ok' => false, 'err' => 'missing_fields'], 400);

$pdo = getDB();
$stmt = $pdo->prepare("
    SELECT username, display_name, role, password_hash, is_manager, is_super_admin
    FROM users
    WHERE username = ? AND is_inactive = 0
");
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !verifyPass($password, $user['password_hash'], $username))
    jsonOut(['ok' => false, 'err' => 'invalid_credentials'], 401);

$token = bin2hex(random_bytes(32));

$pdo->prepare("
    INSERT INTO sessions (token, username, expires_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
    ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
")->execute([$token, $username, SESSION_HOURS, SESSION_HOURS]);

$pdo->prepare("
    INSERT INTO sync_log (username) VALUES (?)
    ON DUPLICATE KEY UPDATE username = username
")->execute([$username]);

jsonOut([
    'ok'    => true,
    'token' => $token,
    'user'  => [
        'username'     => $user['username'],
        'name'         => $user['display_name'],
        'role'         => $user['role'],
        'isManager'    => (bool)$user['is_manager'],
        'isSuperAdmin' => (bool)$user['is_super_admin'],
    ],
]);
