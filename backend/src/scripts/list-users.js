import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function listUsers() {
  try {
    const dbPath = join(__dirname, '../../data/shared.db');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    const users = await db.all(`
      SELECT 
        id,
        first_name || ' ' || last_name as name,
        username,
        phone,
        role,
        isActive,
        password,
        createdAt
      FROM personnel
      ORDER BY id
    `);

    console.log('\n📋 لیست کاربران:\n');
    console.log('='.repeat(100));
    console.log(
      'ID'.padEnd(5) + 
      'نام'.padEnd(25) + 
      'Username'.padEnd(20) + 
      'Phone'.padEnd(15) + 
      'Role'.padEnd(10) + 
      'Password'.padEnd(15) + 
      'Status'
    );
    console.log('='.repeat(100));

    users.forEach(user => {
      const passwordDisplay = user.password ? '*** (hash)' : '123456 (default)';
      const status = user.isActive ? '✅ فعال' : '❌ غیرفعال';
      
      console.log(
        String(user.id).padEnd(5) +
        (user.name || 'بدون نام').padEnd(25) +
        (user.username || 'ندارد').padEnd(20) +
        (user.phone || '').padEnd(15) +
        (user.role || '').padEnd(10) +
        passwordDisplay.padEnd(15) +
        status
      );
    });

    console.log('='.repeat(100));
    console.log(`\n📊 تعداد کل کاربران: ${users.length}`);
    console.log('\n💡 نکته: Password پیش‌فرض برای کاربران جدید: 123456');
    console.log('💡 Password های hash شده با *** نشان داده شده‌اند.\n');

    await db.close();
  } catch (error) {
    console.error('❌ خطا در خواندن دیتابیس:', error);
    process.exit(1);
  }
}

listUsers();

