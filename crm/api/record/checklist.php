<?php
// api/record/checklist.php
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST')
    jsonOut(['ok' => false, 'err' => 'method'], 405);

$b     = json_decode(file_get_contents('php://input'), true) ?? [];
$date  = trim($b['date']  ?? '');
$items = $b['items'] ?? [];
$note  = trim($b['note']  ?? '');

if (!preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $date))
    jsonOut(['ok' => false, 'err' => 'invalid date'], 400);

$score = is_array($items) ? count(array_filter($items)) : 0;

getDB()->prepare("
    INSERT INTO checklist (check_date, username, items, daily_note, score)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        items      = VALUES(items),
        daily_note = VALUES(daily_note),
        score      = VALUES(score)
")->execute([$date, $user['username'], json_encode($items), $note, $score]);

jsonOut(['ok' => true, 'score' => $score]);
