<?php
// api/data/cleanup.php — پاکسازی داده‌های قدیمی (super_admin only)
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
if (!$user['is_super_admin']) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b    = json_decode(file_get_contents('php://input'), true) ?? [];
$type = trim($b['type'] ?? '');
$days = max(30, min(3650, (int)($b['days'] ?? 60)));

$pdo     = getDB();
$removed = 0;

if ($type === 'checklist') {
    $stmt = $pdo->prepare("DELETE FROM checklist WHERE updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)");
    $stmt->execute([$days]);
    $removed = $stmt->rowCount();
} elseif ($type === 'audit') {
    $stmt = $pdo->prepare("DELETE FROM audit_trail WHERE changed_at < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ? DAY)) * 1000");
    $stmt->execute([$days]);
    $removed = $stmt->rowCount();
} elseif ($type === 'sessions') {
    $stmt = $pdo->query("DELETE FROM sessions WHERE expires_at < NOW()");
    $removed = $stmt->rowCount();
} else {
    jsonOut(['ok' => false, 'err' => 'unknown_type'], 400);
}

jsonOut(['ok' => true, 'removed' => $removed, 'type' => $type]);
