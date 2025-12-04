import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

async function setupAdminAccess() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // لیست کاربران برای دسترسی admin
    const adminUsers = [
      { name: 'Hamidreza Soltanian', telegramId: '67195448', phone: '09123456789' },
      { name: 'سارا حسینی', telegramId: '71303335', phone: '09123456788' }
    ];

    console.log('🔍 در حال بررسی و به‌روزرسانی کاربران...\n');

    for (const user of adminUsers) {
      console.log(`📋 بررسی: ${user.name} (Telegram: ${user.telegramId})`);
      
      // جستجو با آیدی تلگرام
      let personnel = Personnel.getByTelegramId(user.telegramId);
      
      if (!personnel) {
        // جستجو با نام
        const allPersonnel = Personnel.getAll();
        personnel = allPersonnel.find(p => 
          p.name.includes(user.name.split(' ')[0]) || 
          p.name === user.name
        );
        
        if (personnel) {
          console.log(`   ✅ پیدا شد با نام، در حال به‌روزرسانی...`);
          Personnel.update(personnel.id, {
            telegramId: user.telegramId,
            role: 'admin'
          });
          personnel = Personnel.getById(personnel.id);
        } else {
          console.log(`   ➕ ایجاد کاربر جدید...`);
          personnel = Personnel.create({
            name: user.name,
            phone: user.phone,
            telegramId: user.telegramId,
            role: 'admin'
          });
        }
      } else {
        console.log(`   ✅ پیدا شد، در حال به‌روزرسانی نقش به admin...`);
        Personnel.update(personnel.id, {
          role: 'admin'
        });
        personnel = Personnel.getById(personnel.id);
      }

      console.log(`   ✅ نقش: ${personnel.role}`);
      console.log(`   ✅ Telegram ID: ${personnel.telegramId}`);
      console.log(`   ✅ Phone: ${personnel.phone}\n`);
    }

    // بررسی محمد سید صالحی
    console.log('🔍 بررسی محمد سید صالحی...\n');
    const mohammad = Personnel.getByTelegramId('68211068470');
    
    if (mohammad) {
      console.log(`✅ محمد سید صالحی پیدا شد:`);
      console.log(`   نام: ${mohammad.name}`);
      console.log(`   ID: ${mohammad.id}`);
      console.log(`   Telegram ID: ${mohammad.telegramId}`);
      console.log(`   Phone: ${mohammad.phone}`);
      console.log(`   Role: ${mohammad.role}\n`);
    } else {
      console.log('❌ محمد سید صالحی پیدا نشد!\n');
      console.log('📋 لیست همه پرسنل:');
      const all = Personnel.getAll();
      all.forEach(p => {
        console.log(`   - ${p.name} (ID: ${p.id}, Telegram: ${p.telegramId || 'ندارد'})`);
      });
    }

    console.log('✅ تکمیل شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

setupAdminAccess();

