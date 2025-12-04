import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { connectDB, getDB, autoSave } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function migrateAddCenterTags() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    const db = getDB();

    // بررسی اینکه آیا ستون tags وجود دارد
    const tableInfo = db.exec("PRAGMA table_info(centers)");
    const tagsColumn = tableInfo[0].values.find(row => row[1] === 'tags');

    if (tagsColumn) {
      console.log('✅ فیلد tags قبلاً وجود دارد.');
      return;
    }

    console.log('\n🔄 در حال اضافه کردن فیلد tags...');

    // اضافه کردن ستون tags به جدول centers
    db.run(`
      ALTER TABLE centers 
      ADD COLUMN tags TEXT
    `);

    console.log('✅ فیلد tags اضافه شد!');
    console.log('   مقدار پیش‌فرض: NULL (می‌تواند JSON string باشد)');

    autoSave();

    console.log('\n✅ Migration با موفقیت انجام شد!');
    console.log('   فیلد tags اکنون در جدول centers موجود است.');
    console.log('   فرمت: JSON string مانند ["lead", "opportunity"]');

  } catch (error) {
    console.error('\n❌ خطا در migration:', error);
    process.exit(1);
  }
}

migrateAddCenterTags();

