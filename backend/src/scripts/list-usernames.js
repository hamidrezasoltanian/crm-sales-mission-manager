/**
 * Script to list all usernames
 * Run: node src/scripts/list-usernames.js
 */

import { connectDB, getDB } from '../config/database.js';

async function listUsernames() {
  try {
    await connectDB();
    const db = getDB();

    console.log('\n📋 لیست کاربران و Username ها:\n');
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
        isActive
      FROM personnel
      ORDER BY id ASC
    `);

    if (users.length === 0) {
      console.log('هیچ کاربری یافت نشد.\n');
      return;
    }

    console.log(`\nتعداد کل کاربران: ${users.length}\n`);
    console.log('─'.repeat(80));
    console.log('ID | نام | Username | Email | Phone | Role | وضعیت');
    console.log('─'.repeat(80));

    users.forEach(user => {
      const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'نامشخص';
      const username = user.username || '-';
      const email = user.email || '-';
      const phone = user.phone || '-';
      const role = user.role === 'super_admin' ? 'سوپر ادمین' :
                   user.role === 'admin' ? 'مدیر کل' :
                   user.role === 'manager' ? 'مدیر' : 'کارمند';
      const status = user.isActive === 1 ? 'فعال' : 'غیرفعال';
      
      console.log(`${String(user.id).padEnd(3)} | ${name.padEnd(20)} | ${username.padEnd(15)} | ${email.padEnd(20)} | ${phone.padEnd(12)} | ${role.padEnd(10)} | ${status}`);
    });

    console.log('─'.repeat(80));
    console.log('\n✅ لیست کامل شد.\n');

    // لیست فقط username ها
    console.log('\n📝 لیست Username ها:\n');
    const usernames = users
      .filter(u => u.username)
      .map(u => u.username);
    
    if (usernames.length > 0) {
      usernames.forEach((username, index) => {
        console.log(`${index + 1}. ${username}`);
      });
      console.log(`\nتعداد username های موجود: ${usernames.length}`);
    } else {
      console.log('هیچ username ای ثبت نشده است.');
    }

    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ خطا در دریافت لیست کاربران:', error);
    process.exit(1);
  }
}

listUsernames();

