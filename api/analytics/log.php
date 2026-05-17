<?php
// api/analytics/log.php — لاگ کامل تغییرات + فیلتر
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$isManager = (bool)$user['is_manager'];
$pdo       = getDB();

$where  = ['1=1'];
$params = [];

$from = intval($_GET['from'] ?? 0);
$to   = intval($_GET['to']   ?? (time() * 1000 + 86400000));
$where[]  = 'a.changed_at BETWEEN ? AND ?';
$params[] = $from;
$params[] = $to;

if (!$isManager) {
    $where[]  = 'a.changed_by = ?';
    $params[] = $user['username'];
} elseif (!empty($_GET['user'])) {
    $where[]  = 'a.changed_by = ?';
    $params[] = $_GET['user'];
}

if (!empty($_GET['field'])) {
    $where[]  = 'a.field_name = ?';
    $params[] = $_GET['field'];
}
if (!empty($_GET['record_type'])) {
    $where[]  = 'a.record_type = ?';
    $params[] = $_GET['record_type'];
}
if (!empty($_GET['record_id'])) {
    $where[]  = 'a.record_id = ?';
    $params[] = $_GET['record_id'];
}

// FIX: LIMIT/OFFSET با bindValue به جای string interpolation
$limit  = min(intval($_GET['limit'] ?? 200), 1000);
$page   = max(intval($_GET['page']  ?? 1), 1);
$offset = ($page - 1) * $limit;

$whereStr = implode(' AND ', $where);

$cntStmt = $pdo->prepare("SELECT COUNT(*) FROM audit_trail a WHERE $whereStr");
$cntStmt->execute($params);
$total = intval($cntStmt->fetchColumn());

// FIX: LIMIT/OFFSET با bindValue — safe حتی بدون intval
$logStmt = $pdo->prepare("
    SELECT
        a.id, a.record_type, a.record_id, a.field_name,
        a.old_value, a.new_value, a.changed_by, a.changed_at,
        u.display_name AS changed_by_name,
        CASE a.record_type
            WHEN 'center'   THEN c.name
            WHEN 'province' THEN p.name
            WHEN 'pc'       THEN pc.name
            ELSE a.record_id
        END AS record_name
    FROM audit_trail a
    LEFT JOIN users           u  ON u.username  = a.changed_by
    LEFT JOIN centers         c  ON a.record_type='center'   AND c.id  = a.record_id
    LEFT JOIN provinces       p  ON a.record_type='province' AND p.id  = a.record_id
    LEFT JOIN province_centers pc ON a.record_type='pc'      AND pc.id = a.record_id
    WHERE $whereStr
    ORDER BY a.changed_at DESC
    LIMIT ? OFFSET ?
");
foreach ($params as $i => $val) {
    $logStmt->bindValue($i + 1, $val);
}
$logStmt->bindValue(count($params) + 1, $limit,  PDO::PARAM_INT);
$logStmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
$logStmt->execute();
$rows = $logStmt->fetchAll();

$summaryStmt = $pdo->prepare("
    SELECT
        a.changed_by, u.display_name, a.field_name,
        COUNT(*) AS change_count,
        MIN(a.changed_at) AS first_change,
        MAX(a.changed_at) AS last_change
    FROM audit_trail a
    LEFT JOIN users u ON u.username = a.changed_by
    WHERE $whereStr
    GROUP BY a.changed_by, u.display_name, a.field_name
    ORDER BY change_count DESC
    LIMIT 50
");
$summaryStmt->execute($params);
$summary = $summaryStmt->fetchAll();

$trendStmt = $pdo->prepare("
    SELECT
        FROM_UNIXTIME(changed_at/1000, '%Y-%m-%d') AS day,
        new_value AS status,
        COUNT(*) AS cnt
    FROM audit_trail a
    WHERE $whereStr AND a.field_name = 'status'
    GROUP BY day, status
    ORDER BY day
");
$trendStmt->execute($params);
$statusTrend = $trendStmt->fetchAll();

$ckSql = "SELECT check_date, username, score FROM checklist WHERE 1=1";
$ckPrm = [];
if (!$isManager) { $ckSql .= " AND username=?"; $ckPrm[] = $user['username']; }
elseif (!empty($_GET['user'])) { $ckSql .= " AND username=?"; $ckPrm[] = $_GET['user']; }
$ckSql .= " ORDER BY check_date DESC LIMIT 60";
$ckStmt = $pdo->prepare($ckSql);
$ckStmt->execute($ckPrm);
$checklistScores = $ckStmt->fetchAll();

jsonOut([
    'ok'              => true,
    'total'           => $total,
    'page'            => $page,
    'limit'           => $limit,
    'logs'            => $rows,
    'summary'         => $summary,
    'status_trend'    => $statusTrend,
    'checklist_scores'=> $checklistScores,
    'filters'         => [
        'from'  => $from,
        'to'    => $to,
        'user'  => $_GET['user']  ?? null,
        'field' => $_GET['field'] ?? null,
    ],
]);
