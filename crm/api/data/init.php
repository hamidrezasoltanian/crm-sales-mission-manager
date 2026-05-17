<?php
// api/data/init.php — داده‌های ثابت: استان‌ها، مراکز، کاربران
require_once __DIR__ . '/../helpers.php';
cors();
$user      = requireAuth();
$pdo       = getDB();
$isManager = (bool)$user['is_manager'];
$username  = $user['username'];

// ── استان‌ها ──────────────────────────────────────────────────
$stmt = $pdo->query("
    SELECT p.id, p.row_num AS `row`, p.name,
           p.potential, p.biopsy_pct AS biopsyPct,
           COALESCE(ro.owner, p.owner) AS owner
    FROM provinces p
    LEFT JOIN record_owners ro ON ro.record_type='province' AND ro.record_id=p.id
    ORDER BY p.row_num
");
$provinces = $stmt->fetchAll();

// ── مراکز تهران ──────────────────────────────────────────────
if ($isManager) {
    $stmt = $pdo->query("
        SELECT c.id, c.row_num AS `row`, c.name,
               c.potential, c.center_type AS type,
               c.lead_type AS lead, c.weight,
               COALESCE(ro.owner, c.owner) AS owner
        FROM centers c
        LEFT JOIN record_owners ro ON ro.record_type='center' AND ro.record_id=c.id
        WHERE c.province_id='tehran' OR c.province_id IS NULL
        ORDER BY c.row_num
    ");
} else {
    $stmt = $pdo->prepare("
        SELECT c.id, c.row_num AS `row`, c.name,
               c.potential, c.center_type AS type,
               c.lead_type AS lead, c.weight,
               COALESCE(ro.owner, c.owner) AS owner
        FROM centers c
        LEFT JOIN record_owners ro ON ro.record_type='center' AND ro.record_id=c.id
        WHERE (c.province_id='tehran' OR c.province_id IS NULL)
          AND COALESCE(ro.owner, c.owner) = ?
        ORDER BY c.row_num
    ");
    $stmt->execute([$username]);
}
$centers = $stmt->fetchAll();

// ── مراکز استانی ──────────────────────────────────────────────
// FIX: حذف OR pc.owner IS NULL — مراکز بدون owner برای مدیر نمایش داده می‌شوند
if ($isManager) {
    $stmt = $pdo->query("
        SELECT pc.id, pc.province_id, pc.row_num AS `row`, pc.name,
               pc.potential, pc.center_type AS type,
               pc.lead_type AS lead,
               COALESCE(ro.owner, pc.owner) AS owner
        FROM province_centers pc
        LEFT JOIN record_owners ro ON ro.record_type='pc' AND ro.record_id=pc.id
        ORDER BY pc.province_id, pc.row_num
    ");
} else {
    $stmt = $pdo->prepare("
        SELECT pc.id, pc.province_id, pc.row_num AS `row`, pc.name,
               pc.potential, pc.center_type AS type,
               pc.lead_type AS lead,
               COALESCE(ro.owner, pc.owner) AS owner
        FROM province_centers pc
        LEFT JOIN record_owners ro ON ro.record_type='pc' AND ro.record_id=pc.id
        WHERE COALESCE(ro.owner, pc.owner) = ?
        ORDER BY pc.province_id, pc.row_num
    ");
    $stmt->execute([$username]);
}
$pc_rows = $stmt->fetchAll();

// ── تگ‌ها ──────────────────────────────────────────────────────
$tagsStmt = $pdo->query("SELECT id, name, color, icon, expires_at, description FROM tags ORDER BY name");
$tags     = $tagsStmt->fetchAll();

// اتصالات تگ — فیلتر بر اساس دسترسی
if ($isManager) {
    $rtStmt = $pdo->query("SELECT record_type, record_id, tag_id FROM record_tags");
} else {
    $rtStmt = $pdo->prepare("
        SELECT rt.record_type, rt.record_id, rt.tag_id
        FROM record_tags rt
        LEFT JOIN record_owners ro ON ro.record_type=rt.record_type AND ro.record_id=rt.record_id
        LEFT JOIN centers c ON rt.record_type='center' AND c.id=rt.record_id
        LEFT JOIN provinces p ON rt.record_type='province' AND p.id=rt.record_id
        LEFT JOIN province_centers pc ON rt.record_type='pc' AND pc.id=rt.record_id
        WHERE COALESCE(ro.owner, c.owner, p.owner, pc.owner) = ?
    ");
    $rtStmt->execute([$username]);
}
$recordTags = $rtStmt->fetchAll();

// ── ترجیحات کاربر ─────────────────────────────────────────────
$prefStmt = $pdo->prepare("SELECT pref_key, pref_value FROM user_preferences WHERE username=?");
$prefStmt->execute([$username]);
$preferences = [];
foreach ($prefStmt->fetchAll() as $r) {
    $preferences[$r['pref_key']] = $r['pref_value'];
}

// ── کاربران (فقط مدیر) ────────────────────────────────────────
$users = [];
if ($isManager) {
    $stmt = $pdo->query("
        SELECT username, display_name AS name, role,
               is_manager AS isManager, is_super_admin AS isSuperAdmin,
               is_inactive AS inactive
        FROM users
        WHERE is_inactive = 0
        ORDER BY display_name
    ");
    foreach ($stmt->fetchAll() as $u) {
        $users[$u['username']] = [
            'name'        => $u['name'],
            'role'        => $u['role'],
            'isManager'   => (bool)$u['isManager'],
            'isSuperAdmin'=> (bool)$u['isSuperAdmin'],
            'inactive'    => (bool)$u['inactive'],
        ];
    }
}

jsonOut([
    'ok'              => true,
    'provinces'       => $provinces,
    'centers'         => $centers,
    'provinceCenters' => $pc_rows,
    'tags'            => $tags,
    'recordTags'      => $recordTags,
    'preferences'     => $preferences,
    'users'           => $users,
]);
