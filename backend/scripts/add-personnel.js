/**
 * اسکریپت اضافه کردن پرسنل
 * استفاده: node scripts/add-personnel.js "نام" "شماره تماس" "Telegram ID" "نقش"
 */

import dotenv from 'dotenv';
import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

dotenv.config();

const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\n❌ استفاده نادرست!\n');
  console.log('📝 استفاده:');
  console.log('   node scripts/add-personnel.js "نام" "شماره تماس" "Telegram ID" [نقش]\n');
  console.log('💡 مثال:');
  console.log('   node scripts/add-personnel.js "حمیدرضا سلطانیان" "09123456789" "123456789"\n');
  console.log('   یا با username:');
  console.log('   node scripts/add-personnel.js "حمیدرضا سلطانیان" "09123456789" "@hamidreza"\n');
  process.exit(1);
}

const name = args[0];
const phone = args[1];
const telegramId = args[2];
const role = args[3] || 'staff';

console.log('\n🔧 اضافه کردن پرسنل...\n');
console.log(`نام: ${name}`);
console.log(`شماره تماس: ${phone}`);
console.log(`Telegram ID: ${telegramId}`);
console.log(`نقش: ${role}\n`);

try {
  await connectDB();
  console.log('✅ Database connected\n');

  // بررسی اینکه آیا پرسنل با این شماره یا Telegram ID وجود دارد
  const existingByPhone = Personnel.getByPhone(phone);
  if (existingByPhone) {
    console.log('⚠️ پرسنل با این شماره تماس قبلاً وجود دارد:');
    console.log(`   ${existingByPhone.name} (ID: ${existingByPhone.id})`);
    console.log('\n💡 می‌خواهید آن را به‌روزرسانی کنید؟');
    console.log('   برای به‌روزرسانی، از Frontend استفاده کنید یا این اسکریپت را ویرایش کنید.\n');
    process.exit(1);
  }

  if (telegramId) {
    const existingByTelegram = Personnel.getByTelegramId(telegramId);
    if (existingByTelegram) {
      console.log('⚠️ پرسنل با این Telegram ID قبلاً وجود دارد:');
      console.log(`   ${existingByTelegram.name} (ID: ${existingByTelegram.id})`);
      console.log('\n💡 می‌خواهید آن را به‌روزرسانی کنید؟');
      console.log('   برای به‌روزرسانی، از Frontend استفاده کنید.\n');
      process.exit(1);
    }
  }

  // ایجاد پرسنل جدید
  const personnel = Personnel.create({
    name,
    phone,
    telegramId: telegramId || null,
    role
  });

  console.log('✅ پرسنل با موفقیت اضافه شد!\n');
  console.log(`ID: ${personnel.id}`);
  console.log(`نام: ${personnel.name}`);
  console.log(`شماره تماس: ${personnel.phone}`);
  console.log(`Telegram ID: ${personnel.telegramId || '(ندارد)'}`);
  console.log(`نقش: ${personnel.role}\n`);
  console.log('🎉 حالا می‌توانید در تلگرام با ربات چت کنید!\n');

  process.exit(0);
} catch (error) {
  console.error('\n❌ خطا:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}


