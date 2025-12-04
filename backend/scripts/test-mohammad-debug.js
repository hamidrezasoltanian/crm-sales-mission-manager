import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';

async function testMohammad() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const telegramId = '68211068470';
    console.log(`🔍 Testing lookup for Telegram ID: ${telegramId}\n`);

    // Test 1: Direct lookup
    console.log('Test 1: Direct lookup');
    let personnel = Personnel.getByTelegramId(telegramId);
    console.log(`   Result: ${personnel ? `Found - ${personnel.name}` : 'Not found'}\n`);

    // Test 2: Check all personnel
    console.log('Test 2: All personnel in database');
    const all = Personnel.getAll();
    all.forEach(p => {
      console.log(`   - ${p.name} (ID: ${p.id}, Telegram: "${p.telegramId || 'ندارد'}", Role: ${p.role})`);
    });

    // Test 3: Check specific personnel
    console.log('\nTest 3: Mohammad Seyed Salehi by ID');
    const mohammadById = Personnel.getById(3);
    if (mohammadById) {
      console.log(`   Found: ${mohammadById.name}`);
      console.log(`   Telegram ID in DB: "${mohammadById.telegramId}"`);
      console.log(`   Type: ${typeof mohammadById.telegramId}`);
      console.log(`   Match: ${mohammadById.telegramId === telegramId}`);
      console.log(`   Match (String): ${String(mohammadById.telegramId) === String(telegramId)}`);
    }

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

testMohammad();

