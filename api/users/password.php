<?php
// api/users/password.php — تغییر رمز عبور
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b       = json_decode(file_get_contents('php://input'), true) ?? [];
$current = trim($b['current'] ?? '');
$newPass = trim($b['new']     ?? '');
if (!$current || !$newPass) jsonOut(['ok' => false, 'err' => 'missing'], 400);
if (strlen($newPass) < 6) jsonOut(['ok' => false, 'err' => 'too_short'], 400);

$pdo  = getDB();
$stmt = $pdo->prepare("SELECT password_hash FROM users WHERE username=?");
$stmt->execute([$user['username']]);
$row = $stmt->fetch();
if (!$row || !verifyPass($current, $row['password_hash'], $user['username']))
    jsonOut(['ok' => false, 'err' => 'wrong_current'], 401);

$pdo->prepare("UPDATE users SET password_hash=? WHERE username=?")->execute([hashPass($newPass), $user['username']]);

// FIX: session فعلی را نگه دار — فقط session های دیگر را حذف کن
$currentToken = str_replace('Bearer ', '', trim(
    $_SERVER['HTTP_X_CRM_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? ''
));
if ($currentToken) {
    $pdo->prepare("DELETE FROM sessions WHERE username=? AND token != ?")->execute([$user['username'], $currentToken]);
} else {
    $pdo->prepare("DELETE FROM sessions WHERE username=?")->execute([$user['username']]);
}

jsonOut(['ok' => true]);
