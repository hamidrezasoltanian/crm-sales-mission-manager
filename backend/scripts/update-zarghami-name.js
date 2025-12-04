import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

async function updateZarghamiName() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const zarghamiTelegramId = '7500109352';
    const newName = 'محمد زرقامی';

    const allPersonnel = Personnel.getAll();
    let zarghami = allPersonnel.find(p => p.telegramId === zarghamiTelegramId);

    if (zarghami) {
      console.log(`✅ آقای زرقامی پیدا شد:`);
      console.log(`   نام فعلی: ${zarghami.name}`);
      console.log(`   ID: ${zarghami.id}`);
      
      Personnel.update(zarghami.id, { name: newName });
      console.log(`\n✅ نام به "${newName}" به‌روزرسانی شد.`);
    } else {
      console.log(`❌ آقای زرقامی با Telegram ID ${zarghamiTelegramId} پیدا نشد.`);
    }

    console.log('\n✅ تکمیل شد!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

updateZarghamiName();

