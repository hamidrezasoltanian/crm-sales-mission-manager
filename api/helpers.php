<?php
// api/helpers.php — توابع مشترک

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// ── CORS ─────────────────────────────────────────────────────
function cors(): void {
    $origin = CORS_ORIGIN;
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CRM-Token');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

// ── JSON output ───────────────────────────────────────────────
function jsonOut(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── Auth — بررسی token ────────────────────────────────────────
// FIX: token از GET حذف شد — برای sendBeacon از body استفاده کنید
// $tokenOverride: توکن از body درخواست (برای sendBeacon)
function requireAuth(?string $tokenOverride = null): array {
    $raw = $tokenOverride
        ?? $_SERVER['HTTP_X_CRM_TOKEN']
        ?? null;

    if (!$raw && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $raw = $_SERVER['HTTP_AUTHORIZATION'];
    }

    $token = str_replace('Bearer ', '', trim((string)$raw));
    if (!$token) jsonOut(['ok' => false, 'err' => 'no_token'], 401);

    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT s.username, u.display_name, u.role, u.is_manager, u.is_super_admin
        FROM sessions s
        JOIN users u ON u.username = s.username
        WHERE s.token = ? AND s.expires_at > NOW() AND u.is_inactive = 0
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) jsonOut(['ok' => false, 'err' => 'invalid_token'], 401);

    // تمدید session اگر کمتر از ۲ ساعت مانده
    $pdo->prepare("
        UPDATE sessions
        SET expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
        WHERE token = ? AND expires_at < DATE_ADD(NOW(), INTERVAL 2 HOUR)
    ")->execute([SESSION_HOURS, $token]);

    return $user;
}

// ── رمز bcrypt ────────────────────────────────────────────────
function hashPass(string $pass): string {
    return password_hash($pass, PASSWORD_BCRYPT);
}

// ── بررسی رمز با migration شفاف sha256→bcrypt ─────────────────
function verifyPass(string $pass, string $hash, ?string $username = null): bool {
    if (str_starts_with($hash, '$2y$') || str_starts_with($hash, '$2a$') || str_starts_with($hash, '$2b$')) {
        return password_verify($pass, $hash);
    }
    if (strlen($hash) === 64 && ctype_xdigit($hash)) {
        if (hash('sha256', $pass) === $hash) {
            if ($username) {
                try {
                    $pdo = getDB();
                    $pdo->prepare("UPDATE users SET password_hash=? WHERE username=?")
                        ->execute([password_hash($pass, PASSWORD_BCRYPT), $username]);
                } catch (Exception $e) {
                    error_log("password migration failed for $username: " . $e->getMessage());
                }
            }
            return true;
        }
    }
    return false;
}

// ── تبدیل unix-ms به تاریخ جلالی (PHP خالص) ─────────────────
function unixMsToJalali(int $ms): string {
    $ts = intval($ms / 1000);
    if (function_exists('jdate')) return jdate('Y/m/d', $ts);
    $d = new DateTime('@' . $ts);
    $d->setTimezone(new DateTimeZone('Asia/Tehran'));
    [$jy, $jm, $jd] = _g2j((int)$d->format('Y'), (int)$d->format('n'), (int)$d->format('j'));
    return sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
}

// ── تبدیل تاریخ میلادی به جلالی (برای targets و actuals) ─────
function _g2j(int $gy, int $gm, int $gd): array {
    $gdm = [31,28+(($gy%4==0&&($gy%100!=0||$gy%400==0))?1:0),31,30,31,30,31,31,30,31,30,31];
    $jdm = [31,31,31,31,31,31,30,30,30,30,30,29];
    $gy -= 1600; $gm -= 1;
    $g_d_no = 365*$gy + (int)(($gy+3)/4) - (int)(($gy+99)/100) + (int)(($gy+399)/400);
    for ($i = 0; $i < $gm; $i++) $g_d_no += $gdm[$i];
    $g_d_no += $gd - 1;
    $j_d_no = $g_d_no - 79;
    $j_np = (int)($j_d_no / 12053); $j_d_no %= 12053;
    $jy = 979 + 33*$j_np + 4*(int)($j_d_no/1461);
    $j_d_no %= 1461;
    if ($j_d_no >= 366) { $jy += (int)(($j_d_no-1)/365); $j_d_no = ($j_d_no-1)%365; }
    for ($j = 0; $j < 11 && $j_d_no >= $jdm[$j]; $j++) $j_d_no -= $jdm[$j];
    return [$jy, $j+1, $j_d_no+1];
}

// ── تبدیل timestamp ms به فرمت YYYYMM جلالی ─────────────────
function tsToJalaliYM(int $ms): string {
    $ts = intval($ms / 1000);
    $d = new DateTime('@' . $ts);
    $d->setTimezone(new DateTimeZone('Asia/Tehran'));
    [$jy, $jm] = _g2j((int)$d->format('Y'), (int)$d->format('n'), (int)$d->format('j'));
    return sprintf('%04d%02d', $jy, $jm);
}

// ── نرمال‌سازی type از JS (جمع) به DB (مفرد) ───────────────
function normalizeRecordType(string $type): string {
    $map = [
        'centers'   => 'center',
        'provinces' => 'province',
        'pc'        => 'pc',
        'center'    => 'center',
        'province'  => 'province',
    ];
    return $map[$type] ?? '';
}

// ── پاک‌کردن session های منقضی (هر ۱۰۰ request یک بار) ─────
function cleanupSessions(): void {
    if (rand(1, 100) !== 1) return;
    try {
        getDB()->exec("DELETE FROM sessions WHERE expires_at < NOW()");
    } catch (Exception $e) {}
}
