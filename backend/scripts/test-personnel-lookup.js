/**
 * تست جستجوی پرسنل با Telegram ID
 */

import dotenv from 'dotenv';
import { connectDB, getDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

dotenv.config();

console.log('\n🔍 تست جستجوی پرسنل با Telegram ID...\n');

try {
  // اتصال به دیتابیس
  await connectDB();
  console.log('✅ Database connected\n');

  // دریافت Telegram ID از command line یا استفاده از یک ID تست
  const telegramId = process.argv[2] || '123456789'; // مثال
  
  console.log(`🔍 جستجوی پرسنل با Telegram ID: ${telegramId}\n`);

  // تست جستجو
  const personnel = Personnel.getByTelegramId(telegramId);
  
  if (personnel) {
    console.log('✅ پرسنل پیدا شد:');
    console.log('   نام:', personnel.name);
    console.log('   شماره تماس:', personnel.phone);
    console.log('   Telegram ID:', personnel.telegramId);
    console.log('   نقش:', personnel.role);
    console.log('   ID:', personnel.id);
  } else {
    console.log('❌ پرسنل پیدا نشد');
    console.log('\n💡 برای اضافه کردن پرسنل:');
    console.log('   1. به Frontend بروید: http://localhost:3000/personnel');
    console.log('   2. پرسنل را اضافه کنید');
    console.log('   3. Telegram ID را وارد کنید');
  }

  // نمایش تمام پرسنل برای بررسی
  console.log('\n📋 تمام پرسنل موجود در سیستم:');
  const allPersonnel = Personnel.getAll();
  if (allPersonnel.length === 0) {
    console.log('   هیچ پرسنلی در سیستم ثبت نشده است');
  } else {
    allPersonnel.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.name} - Telegram ID: ${p.telegramId || '(ندارد)'}`);
    });
  }

  console.log('\n✅ تست انجام شد\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ خطا:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}


