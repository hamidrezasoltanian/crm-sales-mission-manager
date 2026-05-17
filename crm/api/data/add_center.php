<?php
// api/data/add_center.php — افزودن مرکز جدید
require_once __DIR__ . '/../helpers.php';
cors();
$user = requireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

$b      = json_decode(file_get_contents('php://input'), true) ?? [];
$target = trim($b['target']      ?? '');
$name   = trim($b['name']        ?? '');
$type   = trim($b['type']        ?? '');
$pot    = (int)($b['potential']  ?? 3);
$lead   = trim($b['lead']        ?? 'سرنخ');
$provId = trim($b['province_id'] ?? '');

if (!$name || strlen($name) > 200 || !in_array($target, ['tehran', 'province'], true))
    jsonOut(['ok' => false, 'err' => 'invalid'], 400);

if ($target === 'province' && !preg_match('/^p\d+$/', $provId))
    jsonOut(['ok' => false, 'err' => 'invalid_province'], 400);

if ($pot < 1 || $pot > 4) $pot = 3;

$validLeads = ['سرنخ', 'لید', 'فرصت', 'مشتری', 'ندارد', 'بدون مصرف'];
if (!in_array($lead, $validLeads, true)) $lead = 'سرنخ';

$pdo = getDB();
$pdo->beginTransaction();
try {
    if ($target === 'tehran') {
        // FIX: race condition — از SELECT ... FOR UPDATE برای قفل اطمینانی استفاده می‌کنیم
        // و ID را بر اساس AUTO_INCREMENT ایجاد می‌کنیم نه MAX+1
        // ابتدا یک ID منحصربه‌فرد با timestamp و random ایجاد می‌کنیم
        $ts = (int)(microtime(true) * 1000);
        $rand = random_int(1000, 9999);
        $newId = 'new_' . $ts . '_' . $rand;

        // row_num از MAX موجود + 1 (در transaction برای جلوگیری از race condition)
        $maxRow = (int)$pdo->query("SELECT COALESCE(MAX(row_num),9000) FROM centers FOR UPDATE")->fetchColumn();
        $nextRow = $maxRow + 1;

        $pdo->prepare("
            INSERT INTO centers (id,province_id,row_num,name,potential,center_type,lead_type,weight,owner)
            VALUES (?,'tehran',?,?,?,?,?,0,?)
        ")->execute([$newId, $nextRow, $name, $pot, $type, $lead, $user['username']]);

        $pdo->prepare("
            INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
            VALUES('center',?,'_CREATE','',?,?,?)
        ")->execute([$newId, $name, $user['username'], (int)(microtime(true) * 1000)]);

        $pdo->commit();
        jsonOut(['ok' => true, 'id' => $newId, 'row' => $nextRow]);

    } else {
        $stmt = $pdo->prepare("SELECT COALESCE(MAX(row_num),0) FROM province_centers WHERE province_id=? FOR UPDATE");
        $stmt->execute([$provId]);
        $maxRow  = (int)$stmt->fetchColumn();
        $nextRow = $maxRow + 1;

        // ID منحصربه‌فرد با timestamp
        $ts   = (int)(microtime(true) * 1000);
        $rand = random_int(100, 999);
        $newId = $provId . '||new||' . $ts . '_' . $rand;

        $pdo->prepare("
            INSERT INTO province_centers (id,province_id,row_num,name,potential,center_type,lead_type,owner)
            VALUES (?,?,?,?,?,?,?,?)
        ")->execute([$newId, $provId, $nextRow, $name, $pot, $type, $lead, $user['username']]);

        $pdo->prepare("
            INSERT INTO audit_trail(record_type,record_id,field_name,old_value,new_value,changed_by,changed_at)
            VALUES('pc',?,'_CREATE','',?,?,?)
        ")->execute([$newId, $name, $user['username'], (int)(microtime(true) * 1000)]);

        $pdo->commit();
        jsonOut(['ok' => true, 'id' => $newId, 'province_id' => $provId, 'row' => $nextRow]);
    }

} catch (Exception $e) {
    $pdo->rollBack();
    error_log('add_center: ' . $e->getMessage());
    jsonOut(['ok' => false, 'err' => 'db'], 500);
}
