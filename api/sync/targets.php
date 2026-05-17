<?php
// api/sync/targets.php — مدیریت تارگت‌های ماهانه
// FIX: actuals با تقویم جلالی محاسبه می‌شود تا با targets سازگار باشد
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$pdo       = getDB();
$isManager = (bool)$user['is_manager'];

// ── GET ──────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $username = trim($_GET['username'] ?? '');
    $ym       = trim($_GET['year_month'] ?? '');
    $history  = !empty($_GET['history']);

    if (!$isManager) $username = $user['username'];
    if (!$username && !$isManager) jsonOut(['ok' => false, 'err' => 'forbidden'], 403);

    if ($history) {
        if (!$username) jsonOut(['ok' => false, 'err' => 'missing username'], 400);

        $stmt = $pdo->prepare("
            SELECT `year_month`, target_type, entry_target, lead_opp_target,
                   contract_target, revenue_target
            FROM monthly_targets
            WHERE `username` = ?
            ORDER BY `year_month` DESC
        ");
        $stmt->execute([$username]);
        $targets = $stmt->fetchAll();

        // FIX: actuals را با تقویم جلالی محاسبه کن (نه میلادی)
        // ابتدا ردیف‌های audit_trail را می‌گیریم، سپس در PHP به جلالی تبدیل می‌کنیم
        $auditStmt = $pdo->prepare("
            SELECT changed_at, field_name, new_value
            FROM audit_trail
            WHERE changed_by = ?
            ORDER BY changed_at DESC
            LIMIT 5000
        ");
        $auditStmt->execute([$username]);
        $auditRows = $auditStmt->fetchAll();

        $actuals = [];
        foreach ($auditRows as $r) {
            $ym_jalali = tsToJalaliYM((int)$r['changed_at']);
            if (!isset($actuals[$ym_jalali])) {
                $actuals[$ym_jalali] = ['entries' => 0, 'lead_opp' => 0, 'contracts' => 0];
            }
            if ($r['field_name'] === 'status') {
                $actuals[$ym_jalali]['entries']++;
                if ($r['new_value'] === 'قرارداد بسته شد') $actuals[$ym_jalali]['contracts']++;
            }
            if ($r['field_name'] === 'lead' && $r['new_value'] === 'فرصت') {
                $actuals[$ym_jalali]['lead_opp']++;
            }
        }

        jsonOut(['ok' => true, 'username' => $username, 'targets' => $targets, 'actuals' => $actuals]);
    }

    if (!$username && $isManager) {
        $stmt = $pdo->query("
            SELECT username, `year_month`, entry_target, lead_opp_target, contract_target, revenue_target
            FROM monthly_targets ORDER BY `year_month` DESC
        ");
        $byUser = [];
        foreach ($stmt->fetchAll() as $r) {
            $byUser[$r['username']][$r['year_month']] = [
                'entry'     => (int)$r['entry_target'],
                'leadToOpp' => (int)$r['lead_opp_target'],
                'contract'  => (int)$r['contract_target'],
                'revenue'   => (int)$r['revenue_target'],
            ];
        }
        jsonOut(['ok' => true, 'targets' => $byUser]);
    }

    if ($ym) {
        $stmt = $pdo->prepare("SELECT * FROM monthly_targets WHERE username=? AND `year_month`=? LIMIT 1");
        $stmt->execute([$username, $ym]);
        $row = $stmt->fetch();
        jsonOut(['ok' => true, 'target' => $row ?: null]);
    }

    $stmt = $pdo->prepare("
        SELECT `year_month`, entry_target, lead_opp_target, contract_target, revenue_target
        FROM monthly_targets WHERE username=? ORDER BY `year_month` DESC
    ");
    $stmt->execute([$username]);
    jsonOut(['ok' => true, 'username' => $username, 'targets' => $stmt->fetchAll()]);
}

// ── POST ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonOut(['ok' => false, 'err' => 'method'], 405);

if (!$isManager) jsonOut(['ok' => false, 'err' => 'forbidden_manager_only'], 403);

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$stmt = $pdo->prepare("
    INSERT INTO monthly_targets
        (username, `year_month`, target_type, entry_target, lead_opp_target, contract_target, revenue_target)
    VALUES (?, ?, 'overall', ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        entry_target    = VALUES(entry_target),
        lead_opp_target = VALUES(lead_opp_target),
        contract_target = VALUES(contract_target),
        revenue_target  = VALUES(revenue_target)
");

$saved = 0;
foreach ($body['targets'] ?? [] as $uname => $months) {
    if (!preg_match('/^[a-zA-Z0-9_.]+$/', $uname)) continue;
    foreach ($months as $ym => $vals) {
        if (!preg_match('/^\d{6}$/', $ym)) continue;
        $stmt->execute([
            $uname, $ym,
            (int)($vals['entry']     ?? 0),
            (int)($vals['leadToOpp'] ?? 0),
            (int)($vals['contract']  ?? 0),
            (int)($vals['revenue']   ?? 0),
        ]);
        $saved++;
    }
}

jsonOut(['ok' => true, 'saved' => $saved]);
