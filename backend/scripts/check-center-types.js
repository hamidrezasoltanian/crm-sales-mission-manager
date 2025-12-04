import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../src/config/database.js';
import { Center } from '../src/models/Center.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkCenterTypes() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const centers = Center.getAll({});
    
    console.log(`📊 تعداد کل مراکز: ${centers.length}\n`);
    
    // بررسی نوع مراکز
    const typeStats = {
      'lead': 0,
      'opportunity': 0,
      'customer': 0,
      'old_customer': 0,
      'null': 0,
      'undefined': 0,
      'other': 0
    };

    centers.forEach(center => {
      const type = center.type;
      if (!type || type === null) {
        typeStats['null']++;
      } else if (type === undefined) {
        typeStats['undefined']++;
      } else if (typeStats.hasOwnProperty(type)) {
        typeStats[type]++;
      } else {
        typeStats['other']++;
        console.log(`   ⚠️ نوع غیرمعمول: "${type}" در مرکز "${center.name}"`);
      }
    });

    console.log('📊 آمار نوع مراکز:');
    console.log(`   ⚪ سرنخ (lead): ${typeStats.lead}`);
    console.log(`   🟡 فرصت (opportunity): ${typeStats.opportunity}`);
    console.log(`   🟢 مشتری (customer): ${typeStats.customer}`);
    console.log(`   🔵 مشتری قدیمی (old_customer): ${typeStats.old_customer}`);
    console.log(`   ❌ بدون نوع (null): ${typeStats.null}`);
    console.log(`   ❌ undefined: ${typeStats.undefined}`);
    console.log(`   ⚠️ دیگر: ${typeStats.other}\n`);

    // نمایش چند نمونه
    console.log('📋 نمونه مراکز:');
    centers.slice(0, 10).forEach((c, index) => {
      console.log(`   ${index + 1}. ${c.name} - Type: ${c.type || '(null)'}`);
    });

    // بررسی مراکز بدون نوع
    const centersWithoutType = centers.filter(c => !c.type || c.type === null);
    if (centersWithoutType.length > 0) {
      console.log(`\n⚠️ ${centersWithoutType.length} مرکز بدون نوع وجود دارد:`);
      centersWithoutType.slice(0, 5).forEach(c => {
        console.log(`   - ${c.name}`);
      });
    }

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

checkCenterTypes();

