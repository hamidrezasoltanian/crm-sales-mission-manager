<?php
// api/users/preferences.php
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
$pdo  = getDB();
$me   = $user['username'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT pref_key, pref_value FROM user_preferences WHERE username=?");
    $stmt->execute([$me]);
    $prefs = [];
    foreach ($stmt->fetchAll() as $r) {
        $prefs[$r['pref_key']] = $r['pref_value'];
    }
    jsonOut(['ok' => true, 'preferences' => $prefs]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b   = json_decode(file_get_contents('php://input'), true) ?? [];
$key = trim($b['key'] ?? '');
$val = isset($b['value']) ? (string)$b['value'] : '';

if (!$key || mb_strlen($key) > 50) jsonOut(['ok' => false, 'err' => 'invalid_key'], 400);
if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $key)) jsonOut(['ok' => false, 'err' => 'invalid_key_format'], 400);
if (mb_strlen($val) > 5000) jsonOut(['ok' => false, 'err' => 'value_too_long'], 400);

if ($val === '') {
    $pdo->prepare("DELETE FROM user_preferences WHERE username=? AND pref_key=?")->execute([$me, $key]);
} else {
    $pdo->prepare("
        INSERT INTO user_preferences(username, pref_key, pref_value)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE pref_value=VALUES(pref_value)
    ")->execute([$me, $key, $val]);
}

jsonOut(['ok' => true]);
