<?php
// api/db.php — اتصال PDO singleton
require_once __DIR__ . '/config.php';

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = defined('DB_SOCKET') && DB_SOCKET && file_exists(DB_SOCKET)
        ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=%s', DB_SOCKET, DB_NAME, DB_CHARSET)
        : sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, defined('DB_PORT') ? DB_PORT : 3306, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    ]);
    return $pdo;
}
