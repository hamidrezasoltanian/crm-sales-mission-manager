#!/usr/bin/env node

/**
 * اسکریپت Migration به دیتابیس مشترک
 * 
 * این اسکریپت:
 * 1. از هر دو دیتابیس موجود backup می‌گیرد
 * 2. دیتابیس مشترک جدید ایجاد می‌کند
 * 3. داده‌های موجود را migrate می‌کند
 * 4. جدول personnel مشترک را با merge داده‌ها ایجاد می‌کند
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, copyFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// مسیرهای دیتابیس
const MISSION_DB_PATH = join(__dirname, '../data/missions.db');
const ANALYSIS_DB_PATH = '/home/hamidreza/App/ez-dashboard/database/ez_dashboard.db';
const SHARED_DB_PATH = join(__dirname, '../data/shared.db');
const BACKUP_DIR = join(__dirname, '../data/backups');

async function createBackup(sourcePath, backupName) {
  if (!existsSync(sourcePath)) {
    console.log(`⚠️  فایل ${sourcePath} پیدا نشد، backup ایجاد نمی‌شود`);
    return;
  }
  
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `${backupName}_${timestamp}.db`);
  copyFileSync(sourcePath, backupPath);
  console.log(`✅ Backup ایجاد شد: ${backupPath}`);
  return backupPath;
}

async function migrateToSharedDatabase() {
  console.log('🚀 شروع Migration به دیتابیس مشترک...\n');

  try {
    // 1. ایجاد Backup
    console.log('📦 ایجاد Backup از دیتابیس‌های موجود...');
    await createBackup(MISSION_DB_PATH, 'missions');
    await createBackup(ANALYSIS_DB_PATH, 'analysis');
    console.log('');

    // 2. باز کردن دیتابیس‌های موجود
    console.log('📂 باز کردن دیتابیس‌های موجود...');
    
    let missionDb = null;
    let analysisDb = null;
    
    if (existsSync(MISSION_DB_PATH)) {
      // برای sql.js باید از روش دیگری استفاده کنیم
      console.log('⚠️  دیتابیس مدیریت ماموریت از sql.js استفاده می‌کند');
      console.log('   نیاز به migration دستی دارد');
    } else {
      console.log('⚠️  دیتابیس مدیریت ماموریت پیدا نشد');
    }
    
    if (existsSync(ANALYSIS_DB_PATH)) {
      analysisDb = await open({
        filename: ANALYSIS_DB_PATH,
        driver: sqlite3.Database
      });
      console.log('✅ دیتابیس آنالیز فروش باز شد');
    } else {
      console.log('⚠️  دیتابیس آنالیز فروش پیدا نشد');
    }
    console.log('');

    // 3. ایجاد دیتابیس مشترک جدید
    console.log('🆕 ایجاد دیتابیس مشترک جدید...');
    const sharedDb = await open({
      filename: SHARED_DB_PATH,
      driver: sqlite3.Database
    });
    
    // فعال کردن Foreign Keys و WAL mode
    await sharedDb.exec('PRAGMA foreign_keys = ON');
    await sharedDb.exec('PRAGMA journal_mode = WAL');
    console.log('✅ دیتابیس مشترک ایجاد شد');
    console.log('');

    // 4. ایجاد جدول personnel مشترک
    console.log('👥 ایجاد جدول personnel مشترک...');
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS personnel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- اطلاعات هویتی
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL,
        
        -- اطلاعات تماس
        phone TEXT UNIQUE NOT NULL,
        mobile TEXT,
        email TEXT UNIQUE,
        telegramId TEXT UNIQUE,
        
        -- اطلاعات احراز هویت
        username TEXT UNIQUE,
        password_hash TEXT,
        
        -- نقش و دسترسی
        role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff', 'USER', 'ADMIN')),
        isActive INTEGER NOT NULL DEFAULT 1,
        
        -- اطلاعات اضافی
        avatar_url TEXT,
        last_login_at TEXT,
        
        -- Timestamps
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // ایجاد Indexes
    await sharedDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_personnel_phone ON personnel(phone);
      CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email);
      CREATE INDEX IF NOT EXISTS idx_personnel_telegramId ON personnel(telegramId);
      CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role);
      CREATE INDEX IF NOT EXISTS idx_personnel_isActive ON personnel(isActive);
    `);
    console.log('✅ جدول personnel ایجاد شد');
    console.log('');

    // 5. Migration داده‌های personnel از دیتابیس مدیریت ماموریت
    // این بخش نیاز به دسترسی به sql.js دارد که باید جداگانه انجام شود
    console.log('📥 Migration داده‌های personnel از دیتابیس مدیریت ماموریت...');
    console.log('   ⚠️  این بخش نیاز به migration دستی دارد (sql.js → sqlite3)');
    console.log('');

    // 6. Migration داده‌های users از دیتابیس آنالیز فروش
    if (analysisDb) {
      console.log('📥 Migration داده‌های users از دیتابیس آنالیز فروش...');
      
      const users = await analysisDb.all(`
        SELECT 
          id,
          username,
          email,
          password_hash,
          role,
          first_name,
          last_name,
          phone,
          avatar_url,
          is_active,
          last_login_at,
          created_at,
          updated_at
        FROM users
        WHERE is_active = 1
      `);
      
      console.log(`   پیدا شد: ${users.length} کاربر`);
      
      for (const user of users) {
        try {
          // تبدیل role
          let role = user.role;
          if (role === 'ADMIN') role = 'admin';
          else if (role === 'USER') role = 'staff';
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO personnel (
              first_name, last_name, phone, email, username, password_hash,
              role, isActive, avatar_url, last_login_at, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            user.first_name || '',
            user.last_name || '',
            user.phone || '',
            user.email || '',
            user.username || '',
            user.password_hash || null,
            role,
            user.is_active || 1,
            user.avatar_url || null,
            user.last_login_at || null,
            user.created_at || new Date().toISOString(),
            user.updated_at || new Date().toISOString()
          ]);
        } catch (error) {
          if (error.message.includes('UNIQUE constraint')) {
            console.log(`   ⚠️  کاربر ${user.username} قبلاً وجود دارد، skip می‌شود`);
          } else {
            console.error(`   ❌ خطا در migration کاربر ${user.username}:`, error.message);
          }
        }
      }
      
      const insertedCount = await sharedDb.get('SELECT COUNT(*) as count FROM personnel');
      console.log(`✅ ${insertedCount.count} کارمند در جدول personnel ثبت شد`);
      console.log('');
    }

    // 7. ایجاد جدول centers با فیلدهای جدید
    console.log('🏢 ایجاد جدول centers با فیلدهای جدید...');
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        
        -- اطلاعات پایه
        type TEXT DEFAULT 'lead' CHECK(type IN ('lead', 'opportunity', 'customer', 'old_customer')),
        legal_type TEXT, -- 'حقیقی' یا 'حقوقی'
        
        -- اطلاعات تماس (JSON برای چندتایی)
        phones TEXT, -- JSON: ["021-12345678", "021-87654321"]
        mobile TEXT,
        website TEXT,
        
        -- اطلاعات آدرس (JSON برای چندتایی)
        addresses TEXT, -- JSON: [{"address": "...", "postal_code": "...", "city": "...", "province": "..."}]
        postal_code TEXT,
        city TEXT,
        province TEXT,
        district TEXT,
        address TEXT, -- برای سازگاری با کد قدیم
        
        -- اطلاعات مالی
        economic_code TEXT,
        national_id TEXT,
        financial_credit REAL,
        
        -- اطلاعات بانکی (JSON)
        bank_info TEXT, -- JSON: {"account": "...", "sheba": "...", "card": "...", "bank_name": "..."}
        
        -- اطلاعات انبار
        warehouse_receiver TEXT,
        
        -- سایر
        description TEXT,
        latitude REAL,
        longitude REAL,
        snapLocationId TEXT,
        
        -- مسئولیت
        responsiblePersonnelId INTEGER,
        
        -- وضعیت
        isActive INTEGER DEFAULT 1,
        tags TEXT, -- JSON array
        
        -- Timestamps
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (responsiblePersonnelId) REFERENCES personnel(id)
      )
    `);
    
    await sharedDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_centers_name ON centers(name);
      CREATE INDEX IF NOT EXISTS idx_centers_city ON centers(city);
      CREATE INDEX IF NOT EXISTS idx_centers_province ON centers(province);
      CREATE INDEX IF NOT EXISTS idx_centers_responsiblePersonnelId ON centers(responsiblePersonnelId);
      CREATE INDEX IF NOT EXISTS idx_centers_isActive ON centers(isActive);
    `);
    console.log('✅ جدول centers ایجاد شد');
    console.log('');

    // 8. ایجاد جداول center_personnel و organization_positions
    console.log('👥 ایجاد جداول center_personnel و organization_positions...');
    
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS organization_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS center_personnel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        centerId INTEGER NOT NULL,
        
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        mobile TEXT,
        phone TEXT, -- تلفن ثابت
        extension TEXT, -- داخلی
        positionId INTEGER, -- FK به organization_positions
        
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (centerId) REFERENCES centers(id) ON DELETE CASCADE,
        FOREIGN KEY (positionId) REFERENCES organization_positions(id)
      )
    `);
    
    console.log('✅ جداول center_personnel و organization_positions ایجاد شدند');
    console.log('');

    // 9. بستن دیتابیس‌ها
    await sharedDb.close();
    if (analysisDb) {
      await analysisDb.close();
    }

    console.log('✅ Migration با موفقیت انجام شد!');
    console.log(`📊 دیتابیس مشترک در: ${SHARED_DB_PATH}`);
    console.log('');
    console.log('⚠️  نکته: Migration داده‌های personnel از دیتابیس مدیریت ماموریت');
    console.log('   نیاز به اسکریپت جداگانه دارد (به دلیل استفاده از sql.js)');
    console.log('');

  } catch (error) {
    console.error('❌ خطا در Migration:', error);
    throw error;
  }
}

// اجرای Migration
migrateToSharedDatabase()
  .then(() => {
    console.log('🎉 تمام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

