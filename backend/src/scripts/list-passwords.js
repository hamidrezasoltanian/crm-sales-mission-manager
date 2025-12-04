/**
 * Script to list usernames and their password hints
 * Note: We cannot show actual passwords (they're hashed), but we can show default passwords
 * Run: node src/scripts/list-passwords.js
 */

import { connectDB, getDB } from '../config/database.js';

async function listPasswords() {
  try {
    await connectDB();
    const db = getDB();

    console.log('\n🔐 اطلاعات ورود کاربران:\n');
    console.log('='.repeat(80));

    const users = await db.all(`
      SELECT 
        id,
        first_name,
        last_name,
        (first_name || ' ' || last_name) as name,
        username,
        email,
        phone,
        role,
        isActive,
        CASE WHEN password IS NOT NULL AND password != '' THEN 'دارد' ELSE 'ندارد' END as hasPassword
      FROM personnel
      ORDER BY id ASC
    `);

    if (users.length === 0) {
      console.log('هیچ کاربری یافت نشد.\n');
      return;
    }

    console.log(`\nتعداد کل کاربران: ${users.length}\n`);
    console.log('─'.repeat(80));
    console.log('ID | نام | Username | Password | Role | وضعیت');
    console.log('─'.repeat(80));

    users.forEach(user => {
      const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'نامشخص';
      const username = user.username || '-';
      const role = user.role === 'super_admin' ? 'سوپر ادمین' :
                   user.role === 'admin' ? 'مدیر کل' :
                   user.role === 'manager' ? 'مدیر' : 'کارمند';
      const status = user.isActive === 1 ? 'فعال' : 'غیرفعال';
      
      // برای کاربرانی که username دارند، پسورد پیش‌فرض را نشان بده
      let passwordHint = '-';
      if (username && username !== '-') {
        if (user.role === 'super_admin') {
          passwordHint = 'admin123 (پیش‌فرض - باید تغییر داده شود)';
        } else if (user.hasPassword === 'دارد') {
          passwordHint = '*** (ثبت شده)';
        } else {
          passwordHint = 'ندارد';
        }
      } else {
        passwordHint = 'ندارد (username ندارد)';
      }
      
      console.log(`${String(user.id).padEnd(3)} | ${name.padEnd(20)} | ${username.padEnd(15)} | ${passwordHint.padEnd(35)} | ${role.padEnd(12)} | ${status}`);
    });

    console.log('─'.repeat(80));
    console.log('\n📝 خلاصه:\n');
    
    const usersWithUsername = users.filter(u => u.username && u.username !== '-');
    console.log(`✅ کاربران با Username: ${usersWithUsername.length}`);
    usersWithUsername.forEach(u => {
      const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
      console.log(`   - ${u.username} (${name})`);
    });
    
    console.log(`\n❌ کاربران بدون Username: ${users.length - usersWithUsername.length}`);
    
    console.log('\n⚠️  نکات مهم:\n');
    console.log('1. پسوردها به صورت hash ذخیره می‌شوند و قابل نمایش نیستند');
    console.log('2. سوپر ادمین‌ها (hamidreza و sara) پسورد پیش‌فرض: admin123');
    console.log('3. سایر کاربران باید توسط admin پسورد تنظیم شود');
    console.log('4. برای تنظیم پسورد جدید، از صفحه پرسنل استفاده کنید\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ خطا در دریافت لیست:', error);
    process.exit(1);
  }
}

listPasswords();

