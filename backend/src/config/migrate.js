/**
 * اسکریپت migration برای به‌روزرسانی دیتابیس قدیمی
 * این فایل جداول قدیمی را حذف و جداول جدید را ایجاد می‌کند
 */

import { getDB } from './database.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const migrateDatabase = () => {
  try {
    const db = getDB();
    
    // بررسی وجود جدول قدیمی missions
    const checkOld = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='missions'");
    
    if (checkOld.length > 0 && checkOld[0].values.length > 0) {
      console.log('🔄 دیتابیس قدیمی شناسایی شد، در حال migration...');
      
      // حذف جدول قدیمی
      db.run('DROP TABLE IF EXISTS missions');
      console.log('✅ جدول قدیمی حذف شد');
    }
    
    // ایجاد جداول جدید (اگر وجود ندارند)
    const checkNew = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='personnel'");
    
    if (checkNew.length === 0 || checkNew[0].values.length === 0) {
      console.log('🔄 در حال ایجاد جداول جدید...');
      initializeNewTables(db);
    }
    
    console.log('✅ Migration انجام شد');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
};

const initializeNewTables = (db) => {
  // جدول پرسنل
  db.run(`
    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      telegramId TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff')),
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // جدول مراکز
  db.run(`
    CREATE TABLE IF NOT EXISTS centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      snapLocationId TEXT,
      city TEXT,
      district TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // جدول ماموریت‌ها
  db.run(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnelId INTEGER NOT NULL,
      centerId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled')),
      managerId INTEGER,
      approvedAt TEXT,
      completedAt TEXT,
      snapLocationLatitude REAL,
      snapLocationLongitude REAL,
      snapLocationAddress TEXT,
      snapCost REAL,
      discountCode TEXT,
      discountAmount REAL DEFAULT 0,
      totalCost REAL,
      personalPayment REAL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (personnelId) REFERENCES personnel(id),
      FOREIGN KEY (centerId) REFERENCES centers(id),
      FOREIGN KEY (managerId) REFERENCES personnel(id)
    )
  `);

  // جدول کدهای تخفیف
  db.run(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discountType TEXT NOT NULL CHECK(discountType IN ('percentage', 'fixed')),
      discountValue REAL NOT NULL,
      maxUses INTEGER,
      currentUses INTEGER DEFAULT 0,
      validFrom TEXT,
      validUntil TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // جدول گزارش‌ها
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId INTEGER,
      details TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES personnel(id)
    )
  `);

  // ایندکس‌ها
  db.run('CREATE INDEX IF NOT EXISTS idx_assignments_personnel ON assignments(personnelId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assignments_center ON assignments(centerId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_personnel_phone ON personnel(phone)');
  db.run('CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code)');
  
  console.log('✅ جداول جدید ایجاد شدند');
};
