import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

async function updateMohammadTelegram() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    // Find Mohammad Seyed Salehi
    console.log('\n🔍 Looking for "محمد سید صالحی"...');
    const allPersonnel = Personnel.getAll();
    const mohammad = allPersonnel.find(p => 
      p.name.includes('محمد') && 
      (p.name.includes('سید') || p.name.includes('صالحی')) ||
      p.name === 'محمد سید صالحی'
    );

    if (!mohammad) {
      console.log('\n❌ "محمد سید صالحی" در دیتابیس یافت نشد.');
      console.log('\n📋 لیست پرسنل موجود:');
      allPersonnel.forEach(p => console.log(`   - ${p.name} (ID: ${p.id}, Telegram: ${p.telegramId || 'ندارد'})`));
      process.exit(1);
    }

    console.log(`✅ پیدا شد: ${mohammad.name} (ID: ${mohammad.id})`);
    console.log(`   Telegram ID فعلی: ${mohammad.telegramId || 'ندارد'}`);

    const newTelegramId = '68211068470';

    if (mohammad.telegramId === newTelegramId) {
      console.log(`\n✅ آیدی تلگرام از قبل درست است: ${newTelegramId}`);
      return;
    }

    console.log(`\n🔄 در حال به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);

    // Update Telegram ID
    Personnel.update(mohammad.id, {
      telegramId: newTelegramId
    });

    // Verify
    const updated = Personnel.getById(mohammad.id);
    console.log(`\n✅ به‌روزرسانی شد!`);
    console.log(`   نام: ${updated.name}`);
    console.log(`   Telegram ID: ${updated.telegramId}`);
    console.log(`   Phone: ${updated.phone}`);

    console.log('\n💡 حالا محمد سید صالحی می‌تواند با ربات تلگرام کار کند!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

updateMohammadTelegram();

