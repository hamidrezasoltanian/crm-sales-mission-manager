-- ============================================================
--  Atena WMS — MySQL Schema  (shared hosting / cPanel)
--  Engine : InnoDB | Charset : utf8mb4_unicode_ci
--  Compatible : MySQL 5.7+ / MariaDB 10.3+
--
--  اجرا:
--    mysql -u DB_USER -p DB_NAME < schema.sql
--  یا از phpMyAdmin → Import → این فایل
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+03:30';   -- وقت ایران (IRST)

-- ============================================================
-- 1. SEQUENCES  (جایگزین uid()/nextSeq() جاوااسکریپت)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sequences` (
  `name`  VARCHAR(30)       NOT NULL,
  `val`   INT UNSIGNED      NOT NULL DEFAULT 1000,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `sequences` VALUES
  ('entry',      1000),
  ('exit',       2000),
  ('count',      3000),
  ('price_item', 100),
  ('po',         1000),
  ('recall',     100);

-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`         VARCHAR(32)  NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `role`       ENUM('admin','sales_manager','sales','commercial',
                    'warehouse','finance','support','it')
               NOT NULL DEFAULT 'sales',
  `phone`      VARCHAR(20),
  `email`      VARCHAR(150),
  `note`       TEXT,
  `active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_role`   (`role`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. PRODUCTS  (کالاها)
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
  `id`            VARCHAR(32)  NOT NULL,
  `name`          VARCHAR(200) NOT NULL,
  `full_name`     VARCHAR(400),
  `brand`         VARCHAR(100),
  `size`          VARCHAR(50),
  `catalog_code`  VARCHAR(50),
  `irc_code`      VARCHAR(50),
  `unit`          VARCHAR(20)  NOT NULL DEFAULT 'عدد',
  `category`      VARCHAR(100),
  `reorder_point` INT UNSIGNED NOT NULL DEFAULT 0,
  `note`          TEXT,
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active`       (`active`),
  KEY `idx_catalog_code` (`catalog_code`),
  KEY `idx_irc_code`     (`irc_code`),
  FULLTEXT KEY `ft_search` (`name`, `full_name`, `brand`, `catalog_code`, `irc_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. WAREHOUSES  (انبارها)
-- ============================================================
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id`          VARCHAR(32)  NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `location`    VARCHAR(250),
  `manager_id`  VARCHAR(32),
  `note`        TEXT,
  `active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active`     (`active`),
  KEY `fk_wh_manager`  (`manager_id`),
  CONSTRAINT `fk_wh_manager`
    FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. COUNTERPARTIES  (تأمین‌کنندگان + مشتریان)
-- ============================================================
CREATE TABLE IF NOT EXISTS `counterparties` (
  `id`         VARCHAR(32)  NOT NULL,
  `name`       VARCHAR(200) NOT NULL,
  `type`       ENUM('supplier','customer','both') NOT NULL DEFAULT 'customer',
  `phone`      VARCHAR(30),
  `address`    TEXT,
  `tax_code`   VARCHAR(20),
  `email`      VARCHAR(150),
  `active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type`   (`type`),
  KEY `idx_active` (`active`),
  FULLTEXT KEY `ft_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. LOTS  (لات‌های موجودی — هسته انبار)
-- ============================================================
CREATE TABLE IF NOT EXISTS `lots` (
  `id`             VARCHAR(32)    NOT NULL,
  `product_id`     VARCHAR(32)    NOT NULL,
  `warehouse_id`   VARCHAR(32)    NOT NULL,
  `lot_no`         VARCHAR(100)   NOT NULL,
  `qty`            INT            NOT NULL DEFAULT 0,
  `expiry`         DATE,
  `purchase_price` DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
  `counterparty_id` VARCHAR(32),
  `txn_id`         VARCHAR(32),           -- ← FK بعد از transactions
  `lot_date`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `entered_by`     VARCHAR(32),
  `approved_by`    VARCHAR(32),
  `ttac_no`        VARCHAR(100),
  `created_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product`   (`product_id`),
  KEY `idx_warehouse` (`warehouse_id`),
  KEY `idx_expiry`    (`expiry`),
  KEY `idx_qty`       (`qty`),
  KEY `idx_lot_no`    (`lot_no`),
  CONSTRAINT `fk_lot_product`
    FOREIGN KEY (`product_id`)   REFERENCES `products`(`id`)      ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_warehouse`
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)    ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_cp`
    FOREIGN KEY (`counterparty_id`) REFERENCES `counterparties`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_entered_by`
    FOREIGN KEY (`entered_by`)   REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_approved_by`
    FOREIGN KEY (`approved_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. TRANSACTIONS  (رسیدهای ورود و خروج)
-- ============================================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id`               VARCHAR(32)   NOT NULL,
  `txn_no`           VARCHAR(20)   NOT NULL,
  -- نوع اصلی
  `type`             ENUM('entry','exit') NOT NULL,
  -- زیرنوع: purchase, sale, transfer_in, transfer_out, consignment_out,
  --          consignment_in, consignment_return, supplier_return,
  --          sales_return, internal, sample, initial
  `txn_type`         VARCHAR(40)   NOT NULL,
  -- ارتباط‌ها
  `product_id`       VARCHAR(32)   NOT NULL,
  `lot_id`           VARCHAR(32),
  `warehouse_id`     VARCHAR(32)   NOT NULL,
  `counterparty_id`  VARCHAR(32),
  `from_warehouse_id` VARCHAR(32),
  `to_warehouse_id`   VARCHAR(32),
  `created_by`       VARCHAR(32)   NOT NULL,
  -- اعداد
  `qty`              INT           NOT NULL,
  `unit_price`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `sale_price`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  -- وضعیت
  `status`           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `txn_date`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- اطلاعات تکمیلی
  `note`             TEXT,
  `ref_no`           VARCHAR(100),
  `ttac_no`          VARCHAR(100),
  -- IMED (انبار مجازی)
  `imed_status`      ENUM('not_registered','registered','pending')
                     NOT NULL DEFAULT 'not_registered',
  `imed_ref_no`      VARCHAR(100),
  `imed_date`        DATETIME,
  -- اطلاعات ارسال (برای خروج)
  `courier`          VARCHAR(50),
  `tracking_no`      VARCHAR(100),
  `deliv_phone`      VARCHAR(30),
  `deliv_status`     ENUM('pending','shipped','delivered','failed','returned'),
  `deliv_date`       DATE,
  `sms_status`       VARCHAR(20),
  `sms_sent_at`      DATETIME,
  -- timestamps
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_txn_no`        (`txn_no`),
  KEY `idx_type`          (`type`),
  KEY `idx_status`        (`status`),
  KEY `idx_product`       (`product_id`),
  KEY `idx_lot`           (`lot_id`),
  KEY `idx_warehouse`     (`warehouse_id`),
  KEY `idx_counterparty`  (`counterparty_id`),
  KEY `idx_txn_date`      (`txn_date`),
  KEY `idx_imed_status`   (`imed_status`),
  KEY `idx_deliv_status`  (`deliv_status`),
  CONSTRAINT `fk_txn_product`
    FOREIGN KEY (`product_id`)    REFERENCES `products`(`id`)       ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_lot`
    FOREIGN KEY (`lot_id`)        REFERENCES `lots`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_warehouse`
    FOREIGN KEY (`warehouse_id`)  REFERENCES `warehouses`(`id`)     ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_cp`
    FOREIGN KEY (`counterparty_id`) REFERENCES `counterparties`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_from_wh`
    FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_to_wh`
    FOREIGN KEY (`to_warehouse_id`)   REFERENCES `warehouses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_txn_created_by`
    FOREIGN KEY (`created_by`)    REFERENCES `users`(`id`)          ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- حالا FK تکمیلی lots → transactions
ALTER TABLE `lots`
  ADD CONSTRAINT `fk_lot_txn`
    FOREIGN KEY (`txn_id`) REFERENCES `transactions`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 8. PRICE LISTS  (لیست‌های قیمت)
-- ============================================================
CREATE TABLE IF NOT EXISTS `price_lists` (
  `id`               VARCHAR(32)  NOT NULL,
  `name`             VARCHAR(150) NOT NULL,
  `code`             VARCHAR(20)  NOT NULL,
  `type`             ENUM('sale','usd_based') NOT NULL DEFAULT 'sale',
  `description`      TEXT,
  `max_discount_pct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `currency`         ENUM('IRR','USD') NOT NULL DEFAULT 'IRR',
  `usd_rate`         DECIMAL(15,2),
  `default_margin`   DECIMAL(5,2),
  `active`           TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`       VARCHAR(32),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_active`   (`active`),
  CONSTRAINT `fk_pl_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. PRICE ITEMS  (قیمت هر کالا در هر لیست — تاریخچه‌دار)
-- ============================================================
CREATE TABLE IF NOT EXISTS `price_items` (
  `id`             VARCHAR(32)   NOT NULL,
  `price_list_id`  VARCHAR(32)   NOT NULL,
  `product_id`     VARCHAR(32)   NOT NULL,
  `price`          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `usd_price`      DECIMAL(10,4),
  `usd_rate`       DECIMAL(15,2),
  `effective_from` DATE          NOT NULL,
  `effective_to`   DATE,                   -- NULL = فعال
  `note`           TEXT,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by`     VARCHAR(32),
  PRIMARY KEY (`id`),
  KEY `idx_price_list`     (`price_list_id`),
  KEY `idx_product`        (`product_id`),
  KEY `idx_effective_from` (`effective_from`),
  KEY `idx_effective_to`   (`effective_to`),
  CONSTRAINT `fk_pi_price_list`
    FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pi_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pi_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. PRICE HISTORY  (تاریخچه قیمت‌های خرید)
-- ============================================================
CREATE TABLE IF NOT EXISTS `price_history` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT NOT NULL,
  `product_id`  VARCHAR(32)   NOT NULL,
  `lot_no`      VARCHAR(100),
  `price`       DECIMAL(15,2) NOT NULL,
  `qty`         INT           NOT NULL DEFAULT 0,
  `recorded_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `method`      VARCHAR(50),          -- 'ریالی' | 'دلاری' | ...
  PRIMARY KEY (`id`),
  KEY `idx_product`     (`product_id`),
  KEY `idx_recorded_at` (`recorded_at`),
  CONSTRAINT `fk_ph_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. PURCHASE ORDERS  (سفارش‌های خرید)
-- ============================================================
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id`                VARCHAR(32)  NOT NULL,
  `po_no`             VARCHAR(20)  NOT NULL,
  `supplier_id`       VARCHAR(32)  NOT NULL,
  `warehouse_id`      VARCHAR(32)  NOT NULL,
  `requested_by`      VARCHAR(32),
  `approved_by`       VARCHAR(32),
  `approved_at`       DATETIME,
  `status`            ENUM('draft','pending','approved','partial','received','cancelled')
                      NOT NULL DEFAULT 'draft',
  `po_date`           DATE         NOT NULL,
  `expected_delivery` DATE,
  `note`              TEXT,
  `imed_status`       ENUM('not_registered','registered') NOT NULL DEFAULT 'not_registered',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_po_no`    (`po_no`),
  KEY `idx_status`     (`status`),
  KEY `idx_supplier`   (`supplier_id`),
  KEY `idx_po_date`    (`po_date`),
  CONSTRAINT `fk_po_supplier`
    FOREIGN KEY (`supplier_id`)   REFERENCES `counterparties`(`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_po_warehouse`
    FOREIGN KEY (`warehouse_id`)  REFERENCES `warehouses`(`id`)     ON UPDATE CASCADE,
  CONSTRAINT `fk_po_requested_by`
    FOREIGN KEY (`requested_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_po_approved_by`
    FOREIGN KEY (`approved_by`)   REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. PURCHASE ORDER ITEMS  (ردیف‌های PO)
-- ============================================================
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT NOT NULL,
  `po_id`        VARCHAR(32)   NOT NULL,
  `product_id`   VARCHAR(32)   NOT NULL,
  `qty`          INT UNSIGNED  NOT NULL DEFAULT 1,
  `unit_price`   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `received_qty` INT UNSIGNED  NOT NULL DEFAULT 0,
  `lot_no`       VARCHAR(100),
  `expiry`       DATE,
  `ttac_no`      VARCHAR(100),
  PRIMARY KEY (`id`),
  KEY `idx_po`      (`po_id`),
  KEY `idx_product` (`product_id`),
  CONSTRAINT `fk_poi_po`
    FOREIGN KEY (`po_id`)      REFERENCES `purchase_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_poi_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. RECALLS  (فراخوان‌های کالا)
-- ============================================================
CREATE TABLE IF NOT EXISTS `recalls` (
  `id`          VARCHAR(32)  NOT NULL,
  `recall_no`   VARCHAR(20)  NOT NULL,
  `product_id`  VARCHAR(32)  NOT NULL,
  `reason`      TEXT         NOT NULL,
  `severity`    ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `issued_by`   VARCHAR(32),
  `issued_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`      ENUM('active','resolved') NOT NULL DEFAULT 'active',
  `resolved_at` DATETIME,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recall_no` (`recall_no`),
  KEY `idx_status`   (`status`),
  KEY `idx_product`  (`product_id`),
  CONSTRAINT `fk_recall_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_recall_issued_by`
    FOREIGN KEY (`issued_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. RECALL LOTS  (لات‌های آسیب‌دیده — N:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS `recall_lots` (
  `recall_id` VARCHAR(32) NOT NULL,
  `lot_id`    VARCHAR(32) NOT NULL,
  PRIMARY KEY (`recall_id`, `lot_id`),
  CONSTRAINT `fk_rl_recall`
    FOREIGN KEY (`recall_id`) REFERENCES `recalls`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rl_lot`
    FOREIGN KEY (`lot_id`)    REFERENCES `lots`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. STOCK COUNTS  (انبارگردانی)
-- ============================================================
CREATE TABLE IF NOT EXISTS `stock_counts` (
  `id`                VARCHAR(32)  NOT NULL,
  `count_no`          VARCHAR(20)  NOT NULL,
  `warehouse_id`      VARCHAR(32),
  `conducted_by`      VARCHAR(32),
  `count_date`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`            ENUM('in_progress','completed','cancelled')
                      NOT NULL DEFAULT 'in_progress',
  `discrepancy_count` INT          NOT NULL DEFAULT 0,
  `note`              TEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_count_no`  (`count_no`),
  KEY `idx_status`     (`status`),
  KEY `idx_count_date` (`count_date`),
  CONSTRAINT `fk_sc_warehouse`
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sc_conducted_by`
    FOREIGN KEY (`conducted_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. STOCK COUNT ITEMS  (ردیف‌های انبارگردانی)
-- ============================================================
CREATE TABLE IF NOT EXISTS `stock_count_items` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT NOT NULL,
  `count_id`    VARCHAR(32) NOT NULL,
  `lot_id`      VARCHAR(32) NOT NULL,
  `product_id`  VARCHAR(32) NOT NULL,
  `system_qty`  INT         NOT NULL DEFAULT 0,
  `counted_qty` INT,
  `note`        VARCHAR(250),
  PRIMARY KEY (`id`),
  KEY `idx_count`   (`count_id`),
  CONSTRAINT `fk_sci_count`
    FOREIGN KEY (`count_id`)   REFERENCES `stock_counts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sci_lot`
    FOREIGN KEY (`lot_id`)     REFERENCES `lots`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sci_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. RECONCILIATIONS  (تطبیق سه‌گانه WMS/فرادیس/IMED)
-- ============================================================
CREATE TABLE IF NOT EXISTS `reconciliations` (
  `id`            VARCHAR(32) NOT NULL,
  `warehouse_id`  VARCHAR(32),
  `rec_date`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `conducted_by`  VARCHAR(32),
  `faradis_diff`  INT         NOT NULL DEFAULT 0,
  `imed_diff`     INT         NOT NULL DEFAULT 0,
  `status`        ENUM('pending','approved') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `idx_status`   (`status`),
  KEY `idx_rec_date` (`rec_date`),
  CONSTRAINT `fk_rec_warehouse`
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rec_conducted_by`
    FOREIGN KEY (`conducted_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. RECONCILIATION ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS `reconciliation_items` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT NOT NULL,
  `reconciliation_id` VARCHAR(32)  NOT NULL,
  `product_id`        VARCHAR(32)  NOT NULL,
  `sys_qty`           INT          NOT NULL DEFAULT 0,
  `faradis_qty`       INT          NOT NULL DEFAULT 0,
  `imed_qty`          INT          NOT NULL DEFAULT 0,
  `faradis_diff`      INT          NOT NULL DEFAULT 0,  -- faradis - sys
  `imed_diff`         INT          NOT NULL DEFAULT 0,  -- imed - sys
  PRIMARY KEY (`id`),
  KEY `idx_reconciliation` (`reconciliation_id`),
  CONSTRAINT `fk_ri_reconciliation`
    FOREIGN KEY (`reconciliation_id`) REFERENCES `reconciliations`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ri_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. AUDIT LOG  (لاگ فعالیت کاربران)
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`        BIGINT UNSIGNED AUTO_INCREMENT NOT NULL,
  `ts`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id`   VARCHAR(32),
  `user_name` VARCHAR(100),
  `action`    VARCHAR(60)  NOT NULL,
  `entity`    VARCHAR(50),
  `entity_id` VARCHAR(50),
  `detail`    TEXT,
  `ip`        VARCHAR(45),
  PRIMARY KEY (`id`),
  KEY `idx_ts`     (`ts`),
  KEY `idx_user`   (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_entity` (`entity`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. PRINT CONFIG  (تنظیمات چاپ — یک ردیف)
-- ============================================================
CREATE TABLE IF NOT EXISTS `print_config` (
  `id`                     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `company_name`           VARCHAR(200) DEFAULT 'آتنا زیست درمان',
  `company_sub`            VARCHAR(300) DEFAULT 'سیستم مدیریت انبار تجهیزات پزشکی',
  `entry_title`            VARCHAR(200) DEFAULT 'رسید ورود کالا',
  `exit_title`             VARCHAR(200) DEFAULT 'حواله خروج کالا',
  `show_qr`                TINYINT(1) DEFAULT 1,
  `show_company_logo`      TINYINT(1) DEFAULT 1,
  `show_brand`             TINYINT(1) DEFAULT 1,
  `show_size`              TINYINT(1) DEFAULT 1,
  `show_catalog_code`      TINYINT(1) DEFAULT 1,
  `show_irc`               TINYINT(1) DEFAULT 1,
  `show_lot`               TINYINT(1) DEFAULT 1,
  `show_expiry`            TINYINT(1) DEFAULT 1,
  `show_unit_price`        TINYINT(1) DEFAULT 1,
  `show_total`             TINYINT(1) DEFAULT 1,
  `show_note`              TINYINT(1) DEFAULT 1,
  `show_meta_ref`          TINYINT(1) DEFAULT 1,
  `show_meta_wh`           TINYINT(1) DEFAULT 1,
  `show_meta_registrar`    TINYINT(1) DEFAULT 1,
  `show_meta_phone`        TINYINT(1) DEFAULT 0,
  `show_sig`               TINYINT(1) DEFAULT 1,
  `sig1_name`              VARCHAR(100) DEFAULT 'مسئول انبار',
  `sig1_role`              VARCHAR(100) DEFAULT 'مسئول انبار',
  `sig2_name`              VARCHAR(100) DEFAULT 'مدیر فروش',
  `sig2_role`              VARCHAR(100) DEFAULT 'مدیر فروش',
  `sig3_name`              VARCHAR(100) DEFAULT 'مدیرعامل',
  `sig3_role`              VARCHAR(100) DEFAULT 'مدیرعامل',
  `footer`                 TEXT,
  `font_size`              TINYINT UNSIGNED DEFAULT 12,
  `updated_at`             DATETIME DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `ck_print_config_single` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `print_config` (`id`) VALUES (1);

-- ============================================================
-- VIEWS  (کوئری‌های پرکاربرد)
-- ============================================================

-- موجودی فعال به تفکیک کالا × انبار
CREATE OR REPLACE VIEW `v_inventory` AS
SELECT
  p.id            AS product_id,
  p.name,
  p.full_name,
  p.brand,
  p.size,
  p.catalog_code,
  p.irc_code,
  p.unit,
  p.reorder_point,
  w.id            AS warehouse_id,
  w.name          AS warehouse_name,
  SUM(l.qty)                        AS total_qty,
  SUM(l.qty * l.purchase_price)     AS total_value,
  MIN(l.expiry)                     AS nearest_expiry,
  DATEDIFF(MIN(l.expiry), CURDATE()) AS days_to_nearest_expiry,
  COUNT(l.id)                       AS lot_count,
  SUM(l.qty < 1)                    AS zero_qty_lots
FROM lots l
JOIN products   p ON l.product_id   = p.id
JOIN warehouses w ON l.warehouse_id = w.id
WHERE p.active = 1 AND w.active = 1
GROUP BY p.id, w.id;

-- تراکنش‌ها با نام‌های انسانی
CREATE OR REPLACE VIEW `v_transactions` AS
SELECT
  t.*,
  p.name        AS product_name,
  p.full_name   AS product_full_name,
  p.unit,
  l.lot_no,
  w.name        AS warehouse_name,
  cp.name       AS counterparty_name,
  u.name        AS user_name,
  fw.name       AS from_warehouse_name,
  tw.name       AS to_warehouse_name
FROM transactions t
LEFT JOIN products      p  ON t.product_id       = p.id
LEFT JOIN lots          l  ON t.lot_id            = l.id
LEFT JOIN warehouses    w  ON t.warehouse_id      = w.id
LEFT JOIN counterparties cp ON t.counterparty_id  = cp.id
LEFT JOIN users         u  ON t.created_by        = u.id
LEFT JOIN warehouses    fw ON t.from_warehouse_id  = fw.id
LEFT JOIN warehouses    tw ON t.to_warehouse_id    = tw.id;

-- هشدار انقضا (تمام لات‌های فعال)
CREATE OR REPLACE VIEW `v_expiry_alerts` AS
SELECT
  l.id, l.lot_no, l.qty, l.expiry, l.purchase_price,
  p.id   AS product_id,
  p.name AS product_name, p.full_name, p.unit,
  w.id   AS warehouse_id,
  w.name AS warehouse_name,
  DATEDIFF(l.expiry, CURDATE()) AS days_left,
  CASE
    WHEN l.expiry < CURDATE()         THEN 'expired'
    WHEN DATEDIFF(l.expiry, CURDATE()) < 90  THEN 'critical'
    WHEN DATEDIFF(l.expiry, CURDATE()) < 180 THEN 'warning'
    ELSE 'ok'
  END AS expiry_level
FROM lots l
JOIN products   p ON l.product_id   = p.id
JOIN warehouses w ON l.warehouse_id = w.id
WHERE l.qty > 0 AND l.expiry IS NOT NULL
ORDER BY l.expiry;

-- کالاهای زیر نقطه سفارش
CREATE OR REPLACE VIEW `v_reorder_alerts` AS
SELECT
  p.id, p.name, p.full_name, p.unit, p.reorder_point,
  COALESCE(SUM(l.qty), 0) AS total_stock,
  p.reorder_point - COALESCE(SUM(l.qty), 0) AS shortage
FROM products p
LEFT JOIN lots l ON l.product_id = p.id AND l.qty > 0
WHERE p.active = 1
GROUP BY p.id
HAVING total_stock < p.reorder_point AND p.reorder_point > 0;

-- ثبت‌نشده‌های IMED
CREATE OR REPLACE VIEW `v_imed_pending` AS
SELECT
  t.id, t.txn_no, t.type, t.txn_type, t.txn_date,
  t.qty, t.ref_no,
  p.name AS product_name, p.full_name,
  l.lot_no,
  w.name AS warehouse_name,
  cp.name AS counterparty_name,
  DATEDIFF(CURDATE(), DATE(t.txn_date)) AS days_pending
FROM transactions t
JOIN products    p  ON t.product_id    = p.id
LEFT JOIN lots   l  ON t.lot_id        = l.id
JOIN warehouses  w  ON t.warehouse_id  = w.id
LEFT JOIN counterparties cp ON t.counterparty_id = cp.id
WHERE t.imed_status = 'not_registered'
  AND t.status      = 'approved'
ORDER BY t.txn_date;

-- ارسال‌های معلق
CREATE OR REPLACE VIEW `v_delivery_pending` AS
SELECT
  t.id, t.txn_no, t.txn_date, t.qty,
  t.courier, t.tracking_no, t.deliv_status,
  p.name AS product_name,
  w.name AS warehouse_name,
  cp.name AS customer_name, cp.phone AS customer_phone
FROM transactions t
JOIN products      p  ON t.product_id    = p.id
JOIN warehouses    w  ON t.warehouse_id  = w.id
LEFT JOIN counterparties cp ON t.counterparty_id = cp.id
WHERE t.type   = 'exit'
  AND t.status = 'approved'
  AND (t.deliv_status IS NULL OR t.deliv_status = 'pending')
ORDER BY t.txn_date;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- تأیید تراکنش (کسر FEFO برای خروج، تأیید لات برای ورود)
DROP PROCEDURE IF EXISTS `sp_approve_transaction` $$
CREATE PROCEDURE `sp_approve_transaction`(
  IN  p_txn_id  VARCHAR(32),
  IN  p_user_id VARCHAR(32)
)
BEGIN
  DECLARE v_type        VARCHAR(10);
  DECLARE v_product_id  VARCHAR(32);
  DECLARE v_wh_id       VARCHAR(32);
  DECLARE v_qty         INT;
  DECLARE v_to_wh       VARCHAR(32);
  DECLARE v_lot_id      VARCHAR(32);
  DECLARE v_txn_no      VARCHAR(20);

  DECLARE v_cur_lot_id  VARCHAR(32);
  DECLARE v_cur_qty     INT;
  DECLARE v_take        INT;
  DECLARE v_rem         INT;
  DECLARE done          INT DEFAULT FALSE;

  DECLARE cur CURSOR FOR
    SELECT id, qty FROM lots
    WHERE product_id   = v_product_id
      AND warehouse_id = v_wh_id
      AND qty > 0
    ORDER BY expiry ASC, id ASC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SELECT type, product_id, warehouse_id, qty, to_warehouse_id, lot_id, txn_no
  INTO   v_type, v_product_id, v_wh_id, v_qty, v_to_wh, v_lot_id, v_txn_no
  FROM   transactions WHERE id = p_txn_id;

  UPDATE transactions
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_txn_id;

  IF v_type = 'exit' THEN
    -- FEFO: کسر از لات‌ها به ترتیب قدیمی‌ترین انقضا
    SET v_rem = v_qty;
    OPEN cur;
    fefo_loop: LOOP
      FETCH cur INTO v_cur_lot_id, v_cur_qty;
      IF done OR v_rem <= 0 THEN LEAVE fefo_loop; END IF;
      SET v_take = LEAST(v_rem, v_cur_qty);
      UPDATE lots SET qty = qty - v_take, updated_at = NOW()
      WHERE id = v_cur_lot_id;
      SET v_rem = v_rem - v_take;
    END LOOP;
    CLOSE cur;

    -- انتقال بین انبار: افزودن به انبار مقصد
    IF v_to_wh IS NOT NULL AND v_to_wh != '' THEN
      INSERT INTO lots (id, product_id, warehouse_id, lot_no, qty,
                        expiry, purchase_price, counterparty_id,
                        txn_id, entered_by, approved_by, lot_date)
      SELECT CONCAT('tr', UNIX_TIMESTAMP(), FLOOR(RAND()*10000)),
             product_id, v_to_wh, lot_no, v_qty,
             expiry, purchase_price, counterparty_id,
             p_txn_id, p_user_id, p_user_id, NOW()
      FROM lots
      WHERE id = v_lot_id
      LIMIT 1;
    END IF;

  ELSEIF v_type = 'entry' THEN
    UPDATE lots
    SET approved_by = p_user_id, updated_at = NOW()
    WHERE id = v_lot_id AND approved_by IS NULL;
  END IF;

  INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
  VALUES (p_user_id, 'txn_approved', 'transaction', p_txn_id,
          CONCAT('تأیید ', v_txn_no));
END $$

-- رد تراکنش
DROP PROCEDURE IF EXISTS `sp_reject_transaction` $$
CREATE PROCEDURE `sp_reject_transaction`(
  IN p_txn_id  VARCHAR(32),
  IN p_user_id VARCHAR(32)
)
BEGIN
  DECLARE v_txn_no VARCHAR(20);
  SELECT txn_no INTO v_txn_no FROM transactions WHERE id = p_txn_id;
  UPDATE transactions SET status = 'rejected', updated_at = NOW()
  WHERE id = p_txn_id AND status = 'pending';
  INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
  VALUES (p_user_id, 'txn_rejected', 'transaction', p_txn_id,
          CONCAT('رد ', v_txn_no));
END $$

-- گرفتن شماره سری بعدی
DROP FUNCTION IF EXISTS `fn_next_seq` $$
CREATE FUNCTION `fn_next_seq`(p_name VARCHAR(30)) RETURNS VARCHAR(20)
  NOT DETERMINISTIC
  MODIFIES SQL DATA
BEGIN
  DECLARE v_val    INT;
  DECLARE v_prefix VARCHAR(6);

  UPDATE sequences SET val = val + 1 WHERE name = p_name;
  SELECT val INTO v_val FROM sequences WHERE name = p_name;

  SET v_prefix = CASE p_name
    WHEN 'entry'      THEN 'RV-'
    WHEN 'exit'       THEN 'HV-'
    WHEN 'po'         THEN 'PO-'
    WHEN 'recall'     THEN 'RCL-'
    WHEN 'count'      THEN 'CNT-'
    WHEN 'price_item' THEN 'PI-'
    ELSE 'SQ-'
  END;
  RETURN CONCAT(v_prefix, v_val);
END $$

-- موجودی یک کالا در یک انبار (با قفل برای تراکنش همزمان)
DROP PROCEDURE IF EXISTS `sp_get_stock` $$
CREATE PROCEDURE `sp_get_stock`(
  IN p_product_id  VARCHAR(32),
  IN p_warehouse_id VARCHAR(32)
)
BEGIN
  SELECT
    l.id, l.lot_no, l.qty, l.expiry, l.purchase_price, l.ttac_no,
    DATEDIFF(l.expiry, CURDATE()) AS days_left
  FROM lots l
  WHERE l.product_id   = p_product_id
    AND l.warehouse_id = p_warehouse_id
    AND l.qty > 0
  ORDER BY l.expiry ASC;
END $$

DELIMITER ;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER $$

-- جلوگیری از منفی شدن موجودی لات
DROP TRIGGER IF EXISTS `trg_lot_qty_check` $$
CREATE TRIGGER `trg_lot_qty_check`
BEFORE UPDATE ON `lots`
FOR EACH ROW
BEGIN
  IF NEW.qty < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'lot quantity cannot go below zero';
  END IF;
END $$

-- لاگ خودکار تغییر وضعیت تراکنش
DROP TRIGGER IF EXISTS `trg_txn_status_log` $$
CREATE TRIGGER `trg_txn_status_log`
AFTER UPDATE ON `transactions`
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO audit_log (action, entity, entity_id, detail)
    VALUES (
      CONCAT('status_', NEW.status),
      'transaction',
      NEW.id,
      CONCAT(NEW.txn_no, ': ', OLD.status, ' → ', NEW.status)
    );
  END IF;
END $$

-- کوتاه‌کردن خودکار audit_log (بیش از ۵۰۰۰ ردیف)
DROP TRIGGER IF EXISTS `trg_audit_log_trim` $$
CREATE TRIGGER `trg_audit_log_trim`
AFTER INSERT ON `audit_log`
FOR EACH ROW
BEGIN
  DECLARE v_count INT;
  SELECT COUNT(*) INTO v_count FROM audit_log;
  IF v_count > 5000 THEN
    DELETE FROM audit_log
    ORDER BY id ASC
    LIMIT 500;
  END IF;
END $$

DELIMITER ;

-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================
-- پایان schema.sql — Atena WMS v14.2
-- ============================================================
