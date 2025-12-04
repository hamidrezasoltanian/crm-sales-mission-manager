import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB, getDB, autoSave } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function migrateAddCenterResponsible() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    const db = getDB();

    // بررسی اینکه آیا ستون responsiblePersonnelId وجود دارد
    const tableInfo = db.exec("PRAGMA table_info(centers)");
    const responsibleColumn = tableInfo[0].values.find(row => row[1] === 'responsiblePersonnelId');

    if (responsibleColumn) {
      console.log('✅ فیلد responsiblePersonnelId قبلاً وجود دارد.');
      return;
    }

    console.log('\n🔄 در حال اضافه کردن فیلد responsiblePersonnelId...');

    // اضافه کردن ستون responsiblePersonnelId به جدول centers
    db.run(`
      ALTER TABLE centers 
      ADD COLUMN responsiblePersonnelId INTEGER
    `);

    // اضافه کردن foreign key constraint (SQLite محدودیت دارد، اما می‌توانیم index اضافه کنیم)
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_centers_responsible ON centers(responsiblePersonnelId)
    `);

    console.log('✅ فیلد responsiblePersonnelId اضافه شد!');
    console.log('   این فیلد مسئول مرکز را مشخص می‌کند.');

    autoSave();

    console.log('\n✅ Migration با موفقیت انجام شد!');
    console.log('   فیلد responsiblePersonnelId اکنون در جدول centers موجود است.');

  } catch (error) {
    console.error('\n❌ خطا در migration:', error);
    process.exit(1);
  }
}

migrateAddCenterResponsible();

