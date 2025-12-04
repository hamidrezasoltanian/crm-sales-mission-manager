import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

async function testLookup() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const telegramId = '68211068470';

    console.log(`🔍 Testing lookup for Telegram ID: ${telegramId}\n`);

    const personnel = Personnel.getByTelegramId(telegramId);

    if (personnel) {
      console.log('✅ پیدا شد!');
      console.log(`   نام: ${personnel.name}`);
      console.log(`   ID: ${personnel.id}`);
      console.log(`   Telegram ID در DB: ${personnel.telegramId}`);
      console.log(`   Phone: ${personnel.phone}`);
      console.log(`   Role: ${personnel.role}`);
    } else {
      console.log('❌ پیدا نشد!');
      console.log('\n📋 لیست همه پرسنل:');
      const all = Personnel.getAll();
      all.forEach(p => {
        console.log(`   - ${p.name}: telegramId="${p.telegramId || 'ندارد'}"`);
      });
    }

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

testLookup();

