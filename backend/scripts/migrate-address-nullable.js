import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB, getDB } from '../src/config/database.js';

async function migrateAddressToNullable() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    const db = getDB();

    // بررسی اینکه آیا جدول centers وجود دارد
    const checkTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='centers'");
    
    if (!checkTable.length || !checkTable[0].values.length) {
      console.log('❌ جدول centers وجود ندارد. ابتدا باید جداول را ایجاد کنید.');
      process.exit(1);
    }

    // بررسی اینکه آیا address nullable است
    const tableInfo = db.exec("PRAGMA table_info(centers)");
    const addressColumn = tableInfo[0].values.find(row => row[1] === 'address');
    
    if (addressColumn && addressColumn[3] === 0) {
      // address nullable است، نیازی به migration نیست
      console.log('✅ فیلد address قبلاً nullable است.');
      return;
    }

    console.log('\n🔄 در حال تغییر schema...');
    
    // SQLite نمی‌تواند مستقیماً NOT NULL را به NULL تبدیل کند
    // باید جدول را دوباره ایجاد کنیم
    console.log('   1️⃣ ایجاد جدول موقت...');
    
    // ایجاد جدول جدید با address nullable
    db.run(`
      CREATE TABLE IF NOT EXISTS centers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
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

    // کپی داده‌ها
    console.log('   2️⃣ کپی داده‌ها...');
    db.run(`
      INSERT INTO centers_new (id, name, address, latitude, longitude, snapLocationId, city, district, isActive, createdAt, updatedAt)
      SELECT id, name, address, latitude, longitude, snapLocationId, city, district, isActive, createdAt, updatedAt
      FROM centers
    `);

    // حذف جدول قدیمی
    console.log('   3️⃣ حذف جدول قدیمی...');
    db.run('DROP TABLE centers');

    // تغییر نام جدول جدید
    console.log('   4️⃣ تغییر نام جدول...');
    db.run('ALTER TABLE centers_new RENAME TO centers');

    // ذخیره دیتابیس
    const dbDir = process.env.DB_PATH || join(__dirname, '../data');
    const dbPath = join(dbDir, 'missions.db');
    
    // ایجاد پوشه در صورت نیاز
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    // ذخیره دیتابیس
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);

    console.log('✅ Migration با موفقیت انجام شد!');
    console.log('   فیلد address اکنون nullable است.');

  } catch (error) {
    console.error('\n❌ خطا در migration:', error);
    process.exit(1);
  }
}

migrateAddressToNullable();

