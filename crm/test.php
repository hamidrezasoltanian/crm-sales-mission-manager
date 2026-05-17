<?php
// test.php — بعد از تست حذف کنید
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$r = [];

// PHP
$r['php'] = PHP_VERSION;
$r['pdo_mysql'] = extension_loaded('pdo_mysql') ? 'OK' : 'NOT FOUND';

// config.php
$cfg = __DIR__ . '/api/config.php';
if (!file_exists($cfg)) { $r['config'] = 'NOT FOUND: '.$cfg; echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT); exit; }

require_once $cfg;
$r['db_name'] = defined('DB_NAME') ? DB_NAME : '?';
$r['db_user'] = defined('DB_USER') ? DB_USER : '?';
$r['db_pass_set'] = defined('DB_PASS') && DB_PASS !== 'YOUR_DB_PASS' ? 'YES' : 'NO - هنوز تغییر نداده‌اید!';

// DB connection
try {
    $pdo = new PDO(
        'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $r['db'] = 'CONNECTED OK';

    // tables
    foreach(['users','provinces','centers','record_edits','sessions'] as $t){
        $n = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        $r['table_'.$t] = (int)$n . ' rows';
    }
} catch(PDOException $e){
    $r['db'] = 'ERROR: '.$e->getMessage();
}

// files
$files = ['api/auth/login.php','api/sync/status.php','api/sync/push.php','api/sync/pull.php','api/data/init.php'];
foreach($files as $f){
    $r['file_'.$f] = file_exists(__DIR__.'/'.$f) ? 'OK' : 'MISSING';
}

echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
