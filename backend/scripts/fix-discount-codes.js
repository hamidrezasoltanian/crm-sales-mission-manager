import { connectDB, getDB, autoSave } from '../src/config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixDiscountCodes() {
  try {
    await connectDB();
    const db = getDB();

    console.log('🔄 در حال بررسی و اصلاح کدهای تخفیف...');

    // دریافت همه کدهای تخفیف
    const result = db.exec('SELECT id, code FROM discount_codes');
    
    if (result.length > 0 && result[0].values.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values;
      const idIndex = columns.indexOf('id');
      const codeIndex = columns.indexOf('code');
      
      let fixedCount = 0;
      
      values.forEach(row => {
        const id = row[idIndex];
        const oldCode = String(row[codeIndex] || '');
        const newCode = oldCode.trim().toUpperCase();
        
        // مقایسه با trim برای تشخیص نیاز به اصلاح
        if (oldCode.trim().toUpperCase() !== newCode || oldCode !== newCode) {
          db.run('UPDATE discount_codes SET code = ? WHERE id = ?', [newCode, id]);
          console.log(`✅ کد تخفیف #${id} اصلاح شد: '${JSON.stringify(oldCode)}' -> '${newCode}'`);
          fixedCount++;
        }
      });
      
      if (fixedCount > 0) {
        // ذخیره مستقیم دیتابیس - استفاده از همان مسیری که در connectDB استفاده شده
        const dbDir = process.env.DB_PATH || join(__dirname, '../data');
        const dbPath = join(dbDir, 'missions.db');
        
        const { writeFileSync } = await import('fs');
        const data = db.export();
        writeFileSync(dbPath, Buffer.from(data));
        console.log(`✅ ${fixedCount} کد تخفیف اصلاح شد و در ${dbPath} ذخیره شد`);
      } else {
        console.log('✅ همه کدهای تخفیف درست هستند');
      }
    } else {
      console.log('ℹ️ هیچ کد تخفیفی یافت نشد');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ خطا:', error);
    process.exit(1);
  }
}

fixDiscountCodes();

