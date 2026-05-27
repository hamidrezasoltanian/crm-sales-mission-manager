<?php
/**
 * Atena WMS — JSON → MySQL Migration
 * ======================================
 * از backup گرفته‌شده با دکمه «دانلود بک‌آپ» WMS (فرمت JSON)
 * تمام داده‌ها را به MySQL منتقل می‌کند.
 *
 * اجرا (CLI):
 *   php migrate_from_json.php atena_wms_backup_2025-XX-XX.json
 *
 * اجرا از مرورگر (تنها یک‌بار، سپس حذف کنید):
 *   https://yourdomain.com/database/migrate_from_json.php?file=backup.json
 *
 * ⚠ قبل از اجرا: schema.sql را روی دیتابیس اعمال کنید.
 */

declare(strict_types=1);
error_reporting(E_ALL);

// ── تنظیمات ──────────────────────────────────────────────
require_once __DIR__ . '/api/config.php';
set_time_limit(300);
ini_set('memory_limit', '256M');

// ── ورودی ────────────────────────────────────────────────
$jsonFile = $argv[1] ?? $_GET['file'] ?? null;
if (!$jsonFile || !file_exists($jsonFile)) {
    die("❌ فایل JSON یافت نشد.\nاستفاده: php migrate_from_json.php <backup.json>\n");
}

$raw = file_get_contents($jsonFile);
$S   = json_decode($raw, true);
if (!$S || !isset($S['lots'], $S['transactions'])) {
    die("❌ فایل JSON معتبر نیست یا ساختار WMS را ندارد.\n");
}

$pdo = db();

// ── کمکی‌ها ──────────────────────────────────────────────
$ok   = 0;
$skip = 0;
$errors = [];

function log_msg(string $msg): void {
    $ts = date('H:i:s');
    if (PHP_SAPI === 'cli') {
        echo "[$ts] $msg\n";
    } else {
        echo "<p>[$ts] " . htmlspecialchars($msg) . "</p>\n";
        flush();
        ob_flush();
    }
}

function iso_to_dt(?string $v): ?string {
    if (!$v) return null;
    // برخی مقادیر فقط تاریخ هستند (YYYY-MM-DD)
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return $v . ' 00:00:00';
    try {
        return (new DateTime($v))->format('Y-m-d H:i:s');
    } catch (Exception) {
        return null;
    }
}

function uid_gen(): string {
    return 'x' . base_convert((string)time(), 10, 36)
               . substr(str_replace(['+','/','='], '', base64_encode(random_bytes(6))), 0, 5);
}

// ── ۱. SEQUENCES ─────────────────────────────────────────
log_msg('🔢 بروزرسانی sequences...');
$seq = $S['seq'] ?? [];
$seqMap = [
    'entry'      => $seq['entry']     ?? 1000,
    'exit'       => $seq['exit']      ?? 2000,
    'count'      => $seq['count']     ?? 3000,
    'price_item' => $seq['priceItem'] ?? 100,
    'po'         => $seq['po']        ?? 1000,
    'recall'     => $seq['recall']    ?? 100,
];
$stmtSeq = $pdo->prepare(
    "INSERT INTO sequences (name, val) VALUES (:n, :v)
     ON DUPLICATE KEY UPDATE val = GREATEST(val, VALUES(val))"
);
foreach ($seqMap as $n => $v) {
    $stmtSeq->execute([':n' => $n, ':v' => (int)$v]);
}
log_msg('  ✅ sequences');

// ── ۲. USERS ─────────────────────────────────────────────
log_msg('👤 وارد کردن کاربران...');
$stmtU = $pdo->prepare("
    INSERT IGNORE INTO users (id, name, role, phone, email, note, active)
    VALUES (:id,:name,:role,:phone,:email,:note,:active)
");
foreach (($S['users'] ?? []) as $u) {
    $stmtU->execute([
        ':id'     => $u['id'],
        ':name'   => $u['name'],
        ':role'   => $u['role'] ?? 'sales',
        ':phone'  => $u['phone'] ?? null,
        ':email'  => $u['email'] ?? null,
        ':note'   => $u['note']  ?? null,
        ':active' => (int)($u['active'] ?? 1),
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} کاربر");

// ── ۳. PRODUCTS ──────────────────────────────────────────
log_msg('📦 وارد کردن کالاها...');
$ok = 0;
$stmtP = $pdo->prepare("
    INSERT IGNORE INTO products
      (id, name, full_name, brand, size, catalog_code, irc_code,
       unit, category, reorder_point, note, active)
    VALUES
      (:id,:name,:full_name,:brand,:size,:catalog_code,:irc_code,
       :unit,:category,:reorder_point,:note,:active)
");
foreach (($S['products'] ?? []) as $p) {
    $stmtP->execute([
        ':id'            => $p['id'],
        ':name'          => $p['name'],
        ':full_name'     => $p['fullName']     ?? $p['name'],
        ':brand'         => $p['brand']        ?? null,
        ':size'          => $p['size']         ?? null,
        ':catalog_code'  => $p['catalogCode']  ?? null,
        ':irc_code'      => $p['ircCode']      ?? null,
        ':unit'          => $p['unit']         ?? 'عدد',
        ':category'      => $p['category']     ?? null,
        ':reorder_point' => (int)($p['reorderPoint'] ?? 0),
        ':note'          => $p['note']         ?? null,
        ':active'        => (int)($p['active'] ?? 1),
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} کالا");

// ── ۴. WAREHOUSES ────────────────────────────────────────
log_msg('🏭 وارد کردن انبارها...');
$ok = 0;
// manager_id شاید هنوز INSERT نشده — بدون FK فعلاً
$stmtW = $pdo->prepare("
    INSERT IGNORE INTO warehouses (id, name, location, manager_id, note, active)
    VALUES (:id,:name,:location,:manager_id,:note,:active)
");
foreach (($S['warehouses'] ?? []) as $w) {
    $stmtW->execute([
        ':id'         => $w['id'],
        ':name'       => $w['name'],
        ':location'   => $w['location']  ?? null,
        ':manager_id' => $w['managerId'] ?? null,
        ':note'       => $w['note']      ?? null,
        ':active'     => (int)($w['active'] ?? 1),
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} انبار");

// ── ۵. COUNTERPARTIES ────────────────────────────────────
log_msg('🤝 وارد کردن طرف‌حساب‌ها...');
$ok = 0;
$stmtC = $pdo->prepare("
    INSERT IGNORE INTO counterparties
      (id, name, type, phone, address, tax_code, email, active)
    VALUES
      (:id,:name,:type,:phone,:address,:tax_code,:email,:active)
");
foreach (($S['counterparties'] ?? []) as $c) {
    $type = $c['type'] ?? 'customer';
    if (!in_array($type, ['supplier','customer','both'])) $type = 'customer';
    $stmtC->execute([
        ':id'       => $c['id'],
        ':name'     => $c['name'],
        ':type'     => $type,
        ':phone'    => $c['phone']   ?? null,
        ':address'  => $c['address'] ?? null,
        ':tax_code' => $c['taxCode'] ?? null,
        ':email'    => $c['email']   ?? null,
        ':active'   => (int)($c['active'] ?? 1),
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} طرف‌حساب");

// ── ۶. LOTS (بدون FK txn_id — بعداً update می‌شه) ──────
log_msg('📋 وارد کردن لات‌ها...');
$ok = 0;
$stmtL = $pdo->prepare("
    INSERT IGNORE INTO lots
      (id, product_id, warehouse_id, lot_no, qty, expiry,
       purchase_price, counterparty_id, txn_id,
       lot_date, entered_by, approved_by, ttac_no)
    VALUES
      (:id,:product_id,:warehouse_id,:lot_no,:qty,:expiry,
       :purchase_price,:counterparty_id,:txn_id,
       :lot_date,:entered_by,:approved_by,:ttac_no)
");
foreach (($S['lots'] ?? []) as $l) {
    $stmtL->execute([
        ':id'              => $l['id'],
        ':product_id'      => $l['productId'],
        ':warehouse_id'    => $l['warehouseId'],
        ':lot_no'          => $l['lotNo'],
        ':qty'             => (int)($l['qty'] ?? 0),
        ':expiry'          => $l['expiry'] ?? null,
        ':purchase_price'  => (float)($l['purchasePrice'] ?? 0),
        ':counterparty_id' => $l['counterpartyId'] ?? null,
        ':txn_id'          => $l['txnId']          ?? null,
        ':lot_date'        => iso_to_dt($l['date'] ?? null),
        ':entered_by'      => $l['enteredBy']       ?? null,
        ':approved_by'     => $l['approvedBy']      ?? null,
        ':ttac_no'         => $l['ttacNo']          ?? null,
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} لات");

// ── ۷. TRANSACTIONS ──────────────────────────────────────
log_msg('💳 وارد کردن تراکنش‌ها...');
$ok = 0;
$validStatus   = ['pending','approved','rejected'];
$validImed     = ['not_registered','registered','pending'];
$validDelivSt  = ['pending','shipped','delivered','failed','returned'];

$stmtT = $pdo->prepare("
    INSERT IGNORE INTO transactions
      (id, txn_no, type, txn_type, product_id, lot_id, warehouse_id,
       counterparty_id, from_warehouse_id, to_warehouse_id, created_by,
       qty, unit_price, sale_price, status, txn_date,
       note, ref_no, ttac_no,
       imed_status, imed_ref_no, imed_date,
       courier, tracking_no, deliv_phone, deliv_status, deliv_date,
       sms_status, sms_sent_at)
    VALUES
      (:id,:txn_no,:type,:txn_type,:product_id,:lot_id,:warehouse_id,
       :counterparty_id,:from_warehouse_id,:to_warehouse_id,:created_by,
       :qty,:unit_price,:sale_price,:status,:txn_date,
       :note,:ref_no,:ttac_no,
       :imed_status,:imed_ref_no,:imed_date,
       :courier,:tracking_no,:deliv_phone,:deliv_status,:deliv_date,
       :sms_status,:sms_sent_at)
");
foreach (($S['transactions'] ?? []) as $t) {
    $status    = in_array($t['status'] ?? '',   $validStatus)  ? $t['status']   : 'pending';
    $imedSt    = in_array($t['imedStatus'] ?? '',$validImed)   ? $t['imedStatus']: 'not_registered';
    $delivSt   = in_array($t['delivStatus'] ?? '',$validDelivSt)? $t['delivStatus']:null;

    $stmtT->execute([
        ':id'                => $t['id'],
        ':txn_no'            => $t['txnNo'],
        ':type'              => $t['type'],
        ':txn_type'          => $t['txnType'] ?? $t['type'],
        ':product_id'        => $t['productId'],
        ':lot_id'            => $t['lotId']            ?? null,
        ':warehouse_id'      => $t['warehouseId'],
        ':counterparty_id'   => $t['counterpartyId']   ?? null,
        ':from_warehouse_id' => $t['fromWarehouseId']  ?? null,
        ':to_warehouse_id'   => $t['toWarehouseId']    ?? null,
        ':created_by'        => $t['by'],
        ':qty'               => (int)($t['qty'] ?? 0),
        ':unit_price'        => (float)($t['unitPrice']  ?? 0),
        ':sale_price'        => (float)($t['salePrice']  ?? 0),
        ':status'            => $status,
        ':txn_date'          => iso_to_dt($t['date'] ?? null),
        ':note'              => $t['note']              ?? null,
        ':ref_no'            => $t['refNo']             ?? null,
        ':ttac_no'           => $t['ttacNo']            ?? null,
        ':imed_status'       => $imedSt,
        ':imed_ref_no'       => $t['imedRefNo']         ?? null,
        ':imed_date'         => iso_to_dt($t['imedDate'] ?? null),
        ':courier'           => $t['courier']           ?? null,
        ':tracking_no'       => $t['trackingNo']        ?? null,
        ':deliv_phone'       => $t['delivPhone']        ?? null,
        ':deliv_status'      => $delivSt,
        ':deliv_date'        => $t['delivDate']         ?? null,
        ':sms_status'        => $t['smsStatus']         ?? null,
        ':sms_sent_at'       => iso_to_dt($t['smsSentAt'] ?? null),
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} تراکنش");

// ── ۸. PRICE LISTS ───────────────────────────────────────
log_msg('💰 وارد کردن لیست‌های قیمت...');
$ok = 0;
$stmtPL = $pdo->prepare("
    INSERT IGNORE INTO price_lists
      (id, name, code, type, description, max_discount_pct,
       currency, usd_rate, default_margin, active, created_by)
    VALUES
      (:id,:name,:code,:type,:description,:max_discount_pct,
       :currency,:usd_rate,:default_margin,:active,:created_by)
");
foreach (($S['priceLists'] ?? []) as $pl) {
    $stmtPL->execute([
        ':id'               => $pl['id'],
        ':name'             => $pl['name'],
        ':code'             => $pl['code'] ?? 'BASE',
        ':type'             => $pl['type'] ?? 'sale',
        ':description'      => $pl['description']    ?? null,
        ':max_discount_pct' => (float)($pl['maxDiscountPct'] ?? 0),
        ':currency'         => $pl['currency']       ?? 'IRR',
        ':usd_rate'         => $pl['usdRate']        ?? null,
        ':default_margin'   => $pl['defaultMargin']  ?? null,
        ':active'           => (int)($pl['active']   ?? 1),
        ':created_by'       => $pl['createdBy']      ?? null,
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} لیست قیمت");

// ── ۹. PRICE ITEMS ───────────────────────────────────────
log_msg('🏷️ وارد کردن آیتم‌های قیمت...');
$ok = 0;
$stmtPI = $pdo->prepare("
    INSERT IGNORE INTO price_items
      (id, price_list_id, product_id, price, usd_price, usd_rate,
       effective_from, effective_to, note, created_by)
    VALUES
      (:id,:price_list_id,:product_id,:price,:usd_price,:usd_rate,
       :effective_from,:effective_to,:note,:created_by)
");
foreach (($S['priceItems'] ?? []) as $pi) {
    $stmtPI->execute([
        ':id'             => $pi['id'],
        ':price_list_id'  => $pi['priceListId'],
        ':product_id'     => $pi['productId'],
        ':price'          => (float)($pi['price']    ?? 0),
        ':usd_price'      => $pi['usdPrice']          ?? null,
        ':usd_rate'       => $pi['usdRate']           ?? null,
        ':effective_from' => $pi['effectiveFrom']     ?? date('Y-m-d'),
        ':effective_to'   => $pi['effectiveTo']       ?? null,
        ':note'           => $pi['note']              ?? null,
        ':created_by'     => $pi['createdBy']         ?? null,
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} آیتم قیمت");

// ── ۱۰. PURCHASE ORDERS + ITEMS ─────────────────────────
log_msg('🛒 وارد کردن سفارش‌های خرید...');
$ok = 0;
$stmtPO = $pdo->prepare("
    INSERT IGNORE INTO purchase_orders
      (id, po_no, supplier_id, warehouse_id, requested_by, approved_by,
       approved_at, status, po_date, expected_delivery, note, imed_status)
    VALUES
      (:id,:po_no,:supplier_id,:warehouse_id,:requested_by,:approved_by,
       :approved_at,:status,:po_date,:expected_delivery,:note,:imed_status)
");
$stmtPOI = $pdo->prepare("
    INSERT IGNORE INTO purchase_order_items
      (po_id, product_id, qty, unit_price, received_qty, lot_no, expiry, ttac_no)
    VALUES
      (:po_id,:product_id,:qty,:unit_price,:received_qty,:lot_no,:expiry,:ttac_no)
");
$validPOSt = ['draft','pending','approved','partial','received','cancelled'];
foreach (($S['purchaseOrders'] ?? []) as $po) {
    $poStatus = in_array($po['status'] ?? '', $validPOSt) ? $po['status'] : 'draft';
    $stmtPO->execute([
        ':id'                => $po['id'],
        ':po_no'             => $po['poNo'],
        ':supplier_id'       => $po['supplierId'],
        ':warehouse_id'      => $po['warehouseId'],
        ':requested_by'      => $po['requestedBy']  ?? null,
        ':approved_by'       => $po['approvedBy']   ?? null,
        ':approved_at'       => iso_to_dt($po['approvedAt'] ?? null),
        ':status'            => $poStatus,
        ':po_date'           => $po['date']                ?? date('Y-m-d'),
        ':expected_delivery' => $po['expectedDelivery']    ?? null,
        ':note'              => $po['note']                ?? null,
        ':imed_status'       => $po['imedStatus']          ?? 'not_registered',
    ]);
    foreach (($po['items'] ?? []) as $item) {
        $stmtPOI->execute([
            ':po_id'        => $po['id'],
            ':product_id'   => $item['productId'],
            ':qty'          => (int)($item['qty']         ?? 0),
            ':unit_price'   => (float)($item['unitPrice'] ?? 0),
            ':received_qty' => (int)($item['receivedQty'] ?? 0),
            ':lot_no'       => $item['lot']    ?? null,
            ':expiry'       => $item['expiry'] ?? null,
            ':ttac_no'      => $item['ttacNo'] ?? null,
        ]);
    }
    $ok++;
}
log_msg("  ✅ {$ok} سفارش خرید");

// ── ۱۱. RECALLS ─────────────────────────────────────────
log_msg('⚠️ وارد کردن Recall ها...');
$ok = 0;
$stmtR = $pdo->prepare("
    INSERT IGNORE INTO recalls
      (id, recall_no, product_id, reason, severity, issued_by, issued_at, status)
    VALUES
      (:id,:recall_no,:product_id,:reason,:severity,:issued_by,:issued_at,:status)
");
$stmtRL = $pdo->prepare("
    INSERT IGNORE INTO recall_lots (recall_id, lot_id) VALUES (:rid,:lid)
");
foreach (($S['recalls'] ?? []) as $r) {
    $stmtR->execute([
        ':id'         => $r['id'],
        ':recall_no'  => $r['recallNo'],
        ':product_id' => $r['productId'],
        ':reason'     => $r['reason'],
        ':severity'   => $r['severity']  ?? 'medium',
        ':issued_by'  => $r['issuedBy']  ?? null,
        ':issued_at'  => iso_to_dt($r['issuedAt'] ?? null),
        ':status'     => $r['status']    ?? 'active',
    ]);
    foreach (($r['affectedLots'] ?? []) as $lid) {
        try { $stmtRL->execute([':rid' => $r['id'], ':lid' => $lid]); }
        catch (PDOException) { /* لات حذف شده */ }
    }
    $ok++;
}
log_msg("  ✅ {$ok} Recall");

// ── ۱۲. RECONCILIATIONS ─────────────────────────────────
log_msg('📊 وارد کردن تطبیق‌ها...');
$ok = 0;
$stmtRec = $pdo->prepare("
    INSERT IGNORE INTO reconciliations
      (id, warehouse_id, rec_date, conducted_by, faradis_diff, imed_diff, status)
    VALUES
      (:id,:warehouse_id,:rec_date,:conducted_by,:faradis_diff,:imed_diff,:status)
");
$stmtRI = $pdo->prepare("
    INSERT INTO reconciliation_items
      (reconciliation_id, product_id, sys_qty, faradis_qty, imed_qty, faradis_diff, imed_diff)
    VALUES
      (:rid,:pid,:sys,:far,:imed,:fdiff,:idiff)
");
foreach (($S['reconciliations'] ?? []) as $rec) {
    $stmtRec->execute([
        ':id'           => $rec['id'],
        ':warehouse_id' => $rec['warehouseId']  ?? null,
        ':rec_date'     => iso_to_dt($rec['date'] ?? null),
        ':conducted_by' => $rec['conductedBy']  ?? null,
        ':faradis_diff' => (int)($rec['faradisDiff'] ?? 0),
        ':imed_diff'    => (int)($rec['imedDiff']    ?? 0),
        ':status'       => $rec['status']        ?? 'pending',
    ]);
    foreach (($rec['items'] ?? []) as $ri) {
        $stmtRI->execute([
            ':rid'   => $rec['id'],
            ':pid'   => $ri['productId'],
            ':sys'   => (int)($ri['sysQty']       ?? 0),
            ':far'   => (int)($ri['faradisQty']   ?? 0),
            ':imed'  => (int)($ri['imedQty']      ?? 0),
            ':fdiff' => (int)($ri['faradisDiff']  ?? 0),
            ':idiff' => (int)($ri['imedDiff']     ?? 0),
        ]);
    }
    $ok++;
}
log_msg("  ✅ {$ok} تطبیق");

// ── ۱۳. AUDIT LOG ────────────────────────────────────────
log_msg('📝 وارد کردن لاگ فعالیت...');
$ok = 0;
$stmtAL = $pdo->prepare("
    INSERT INTO audit_log (ts, user_id, user_name, action, entity, entity_id, detail)
    VALUES (:ts,:uid,:uname,:action,:entity,:eid,:detail)
");
foreach (($S['auditLog'] ?? []) as $log) {
    $stmtAL->execute([
        ':ts'     => iso_to_dt($log['ts']       ?? null) ?? date('Y-m-d H:i:s'),
        ':uid'    => $log['userId']              ?? null,
        ':uname'  => $log['userName']            ?? null,
        ':action' => $log['action'],
        ':entity' => $log['entity']              ?? null,
        ':eid'    => $log['entityId']            ?? null,
        ':detail' => $log['detail']              ?? null,
    ]);
    $ok++;
}
log_msg("  ✅ {$ok} لاگ");

// ── ۱۴. PRINT CONFIG ─────────────────────────────────────
if (!empty($S['printConfig'])) {
    log_msg('🖨️ بروزرسانی تنظیمات چاپ...');
    $pc = $S['printConfig'];
    $pdo->prepare("
        UPDATE print_config SET
          company_name        = :company_name,
          company_sub         = :company_sub,
          entry_title         = :entry_title,
          exit_title          = :exit_title,
          show_qr             = :show_qr,
          show_brand          = :show_brand,
          show_size           = :show_size,
          show_catalog_code   = :show_catalog_code,
          show_irc            = :show_irc,
          show_lot            = :show_lot,
          show_expiry         = :show_expiry,
          show_unit_price     = :show_unit_price,
          show_total          = :show_total,
          show_note           = :show_note,
          show_meta_ref       = :show_meta_ref,
          show_meta_wh        = :show_meta_wh,
          show_meta_registrar = :show_meta_registrar,
          show_sig            = :show_sig,
          sig1_name           = :sig1_name,
          sig1_role           = :sig1_role,
          sig2_name           = :sig2_name,
          sig2_role           = :sig2_role,
          sig3_name           = :sig3_name,
          sig3_role           = :sig3_role,
          footer              = :footer,
          font_size           = :font_size
        WHERE id = 1
    ")->execute([
        ':company_name'        => $pc['companyName']        ?? 'آتنا زیست درمان',
        ':company_sub'         => $pc['companySub']         ?? null,
        ':entry_title'         => $pc['entryTitle']         ?? 'رسید ورود',
        ':exit_title'          => $pc['exitTitle']          ?? 'حواله خروج',
        ':show_qr'             => (int)($pc['showQR']               ?? 1),
        ':show_brand'          => (int)($pc['showBrand']            ?? 1),
        ':show_size'           => (int)($pc['showSize']             ?? 1),
        ':show_catalog_code'   => (int)($pc['showCatalogCode']      ?? 1),
        ':show_irc'            => (int)($pc['showIRC']              ?? 1),
        ':show_lot'            => (int)($pc['showLot']              ?? 1),
        ':show_expiry'         => (int)($pc['showExpiry']           ?? 1),
        ':show_unit_price'     => (int)($pc['showUnitPrice']        ?? 1),
        ':show_total'          => (int)($pc['showTotal']            ?? 1),
        ':show_note'           => (int)($pc['showNote']             ?? 1),
        ':show_meta_ref'       => (int)($pc['showMetaRef']          ?? 1),
        ':show_meta_wh'        => (int)($pc['showMetaWh']           ?? 1),
        ':show_meta_registrar' => (int)($pc['showMetaRegistrar']    ?? 1),
        ':show_sig'            => (int)($pc['showSig']              ?? 1),
        ':sig1_name'           => $pc['sig1Name']           ?? 'مسئول انبار',
        ':sig1_role'           => $pc['sig1Role']           ?? 'مسئول انبار',
        ':sig2_name'           => $pc['sig2Name']           ?? 'مدیر فروش',
        ':sig2_role'           => $pc['sig2Role']           ?? 'مدیر فروش',
        ':sig3_name'           => $pc['sig3Name']           ?? 'مدیرعامل',
        ':sig3_role'           => $pc['sig3Role']           ?? 'مدیرعامل',
        ':footer'              => $pc['footer']             ?? null,
        ':font_size'           => (int)($pc['fontSize']            ?? 12),
    ]);
    log_msg('  ✅ print_config');
}

log_msg('');
log_msg('🎉 Migration completed successfully!');
log_msg('⚠️  این فایل را از سرور حذف کنید: migrate_from_json.php');
