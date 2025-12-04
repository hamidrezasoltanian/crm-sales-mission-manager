import { connectDB, getDB, autoSave } from '../src/config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateAddAssignmentFields() {
  try {
    await connectDB();
    const db = getDB();

    console.log('🔄 شروع migration برای اضافه کردن فیلدهای جدید به assignments...');

    // بررسی وجود فیلدها
    const tableInfo = db.exec("PRAGMA table_info(assignments)");
    const columns = tableInfo[0]?.values.map(row => row[1]) || [];
    
    // اضافه کردن centerNotes
    if (!columns.includes('centerNotes')) {
      console.log('➕ اضافه کردن فیلد centerNotes...');
      db.run('ALTER TABLE assignments ADD COLUMN centerNotes TEXT');
    }

    // اضافه کردن managerComment
    if (!columns.includes('managerComment')) {
      console.log('➕ اضافه کردن فیلد managerComment...');
      db.run('ALTER TABLE assignments ADD COLUMN managerComment TEXT');
    }

    // اضافه کردن discountCodeId
    if (!columns.includes('discountCodeId')) {
      console.log('➕ اضافه کردن فیلد discountCodeId...');
      db.run('ALTER TABLE assignments ADD COLUMN discountCodeId INTEGER');
      db.run('CREATE INDEX IF NOT EXISTS idx_assignments_discount_code ON assignments(discountCodeId)');
    }

    // ذخیره دیتابیس
    const dbDir = process.env.DB_PATH || join(__dirname, '../data');
    const dbPath = join(dbDir, 'missions.db');
    
    const { writeFileSync } = await import('fs');
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));

    console.log('✅ Migration با موفقیت انجام شد');
    process.exit(0);
  } catch (error) {
    console.error('❌ خطا در migration:', error);
    process.exit(1);
  }
}

migrateAddAssignmentFields();

