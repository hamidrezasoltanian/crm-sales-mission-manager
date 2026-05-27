<?php
/**
 * Atena WMS — Database Configuration
 * تنظیمات اتصال به پایگاه داده (هاست اشتراکی)
 *
 * فایل را خارج از public_html قرار دهید یا دسترسی مستقیم را محدود کنید.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'YOUR_DB_NAME');    // نام پایگاه داده (از cPanel)
define('DB_USER', 'YOUR_DB_USER');    // نام کاربری
define('DB_PASS', 'YOUR_DB_PASS');    // رمز عبور
define('DB_CHARSET', 'utf8mb4');

define('APP_SECRET', 'CHANGE_ME_TO_RANDOM_64CHARS'); // برای JWT / session
define('APP_TIMEZONE', 'Asia/Tehran');

date_default_timezone_set(APP_TIMEZONE);

/**
 * اتصال PDO — singleton
 */
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST, DB_NAME, DB_CHARSET
        );
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci,
                                             time_zone='+03:30'",
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // در production هرگز جزئیات خطا را نمایش ندهید
            http_response_code(500);
            die(json_encode(['error' => 'Database connection failed']));
        }
    }
    return $pdo;
}

/**
 * پاسخ JSON استاندارد
 */
function json_out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * کاربر جاری از session (پیاده‌سازی ساده برای هاست اشتراکی)
 * در production با JWT یا session امن جایگزین کنید.
 */
function current_user(): ?array {
    if (session_status() === PHP_SESSION_NONE) session_start();
    return $_SESSION['wms_user'] ?? null;
}

function require_auth(): array {
    $u = current_user();
    if (!$u) {
        json_out(['error' => 'Unauthorized'], 401);
    }
    return $u;
}

function require_role(string ...$roles): array {
    $u = require_auth();
    if (!in_array($u['role'], $roles, true)) {
        json_out(['error' => 'Forbidden'], 403);
    }
    return $u;
}
