import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../src/config/database.js';
import { Center } from '../src/models/Center.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function findCenter() {
  try {
    await connectDB();
    const centers = Center.getAll({});
    
    // جستجوی مراکزی که شامل "جواد" یا "امیر" هستند
    const matches = centers.filter(c => 
      c.name.includes('جواد') || 
      c.name.includes('امیر') ||
      c.name.includes('امیرالمؤمنين') ||
      c.name.includes('امیرالمؤمنین')
    );
    
    console.log('🔍 مراکز یافت شده:');
    matches.forEach(c => {
      console.log(`   - "${c.name}" (ID: ${c.id}, Type: ${c.type})`);
    });
    
    if (matches.length === 0) {
      console.log('\n📋 همه مراکز:');
      centers.forEach(c => {
        console.log(`   - "${c.name}"`);
      });
    }
  } catch (error) {
    console.error('❌ خطا:', error);
  }
}

findCenter();

