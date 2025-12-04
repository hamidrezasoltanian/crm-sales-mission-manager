/**
 * اضافه کردن حمیدرضا سلطانیان به پرسنل
 */

import dotenv from 'dotenv';
import { connectDB, getDB, autoSave } from '../src/config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔧 اضافه کردن حمیدرضا سلطانیان...\n');

try {
  await connectDB();
  const db = getDB();
  
  // بررسی اینکه آیا قبلاً وجود دارد
  const checkResult = db.exec('SELECT * FROM personnel WHERE telegramId = "67195448" OR phone = "09123456789"');
  
  if (checkResult.length > 0 && checkResult[0].values.length > 0) {
    console.log('⚠️ پرسنل با این Telegram ID یا شماره تماس قبلاً وجود دارد');
    const existing = checkResult[0];
    const columns = existing.columns;
    const row = existing.values[0];
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    console.log(`   نام: ${obj.name}`);
    console.log(`   ID: ${obj.id}`);
    console.log(`   Telegram ID: ${obj.telegramId || '(ندارد)'}`);
    
    // اگر Telegram ID ندارد، به‌روزرسانی می‌کنیم
    if (!obj.telegramId || obj.telegramId !== '67195448') {
      console.log('\n🔄 به‌روزرسانی Telegram ID...');
      db.run('UPDATE personnel SET telegramId = ?, updatedAt = datetime(\'now\') WHERE id = ?', ['67195448', obj.id]);
      autoSave();
      console.log('✅ Telegram ID به‌روزرسانی شد');
    }
  } else {
    // اضافه کردن جدید
    console.log('➕ اضافه کردن پرسنل جدید...');
    db.run(`
      INSERT INTO personnel (name, phone, telegramId, role, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `, ['حمیدرضا سلطانیان', '09123456789', '67195448', 'admin']);
    
    autoSave();
    console.log('✅ پرسنل با موفقیت اضافه شد!');
  }
  
  // بررسی نهایی
  const verifyResult = db.exec('SELECT * FROM personnel WHERE telegramId = "67195448"');
  if (verifyResult.length > 0 && verifyResult[0].values.length > 0) {
    const result = verifyResult[0];
    const columns = result.columns;
    const row = result.values[0];
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    
    console.log('\n✅ اطلاعات پرسنل:');
    console.log(`   ID: ${obj.id}`);
    console.log(`   نام: ${obj.name}`);
    console.log(`   شماره تماس: ${obj.phone}`);
    console.log(`   Telegram ID: ${obj.telegramId}`);
    console.log(`   نقش: ${obj.role}`);
    console.log('\n🎉 حالا می‌توانید در تلگرام با ربات چت کنید!');
    console.log('   دستور: /start\n');
  }
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ خطا:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}


