import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB, getDB, autoSave } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function migrateAddCenterType() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    const db = getDB();

    // بررسی اینکه آیا ستون type وجود دارد
    const tableInfo = db.exec("PRAGMA table_info(centers)");
    const typeColumn = tableInfo[0].values.find(row => row[1] === 'type');

    if (typeColumn) {
      console.log('✅ فیلد type قبلاً وجود دارد.');
      return;
    }

    console.log('\n🔄 در حال اضافه کردن فیلد type...');

    // اضافه کردن ستون type به جدول centers
    db.run(`
      ALTER TABLE centers 
      ADD COLUMN type TEXT DEFAULT 'lead' CHECK(type IN ('lead', 'opportunity', 'customer', 'old_customer'))
    `);

    // به‌روزرسانی مراکز موجود - اگر type ندارند، به 'lead' تنظیم می‌شود (پیش‌فرض)
    console.log('✅ فیلد type اضافه شد!');
    console.log('   مقدار پیش‌فرض برای مراکز موجود: lead');

    autoSave();

    console.log('\n✅ Migration با موفقیت انجام شد!');
    console.log('   فیلد type اکنون در جدول centers موجود است.');
    console.log('   مقادیر مجاز: lead, opportunity, customer, old_customer');

  } catch (error) {
    console.error('\n❌ خطا در migration:', error);
    process.exit(1);
  }
}

migrateAddCenterType();

