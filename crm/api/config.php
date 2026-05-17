<?php
// api/config.php — تنظیمات مرکزی
// ⚠ این فایل را در .gitignore قرار دهید و DB_PASS را تغییر دهید

define('DB_HOST', 'localhost');
define('DB_NAME', 'atena_crm');
define('DB_USER', 'atena_user');
define('DB_PASS', 'YOUR_PASSWORD_HERE');
define('DB_CHARSET', 'utf8mb4');

define('SESSION_HOURS', 12);
define('AUDIT_RETAIN_DAYS', 730);
define('MAX_BATCH_SIZE', 50);
define('API_VERSION', '4.1');

// دامنه مجاز برای CORS — آدرس سایت خود را وارد کنید
// مثال: 'https://yoursite.ir'
// برای محیط توسعه از '*' استفاده کنید
define('CORS_ORIGIN', '*');
