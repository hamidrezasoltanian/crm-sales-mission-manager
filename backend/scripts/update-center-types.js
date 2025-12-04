import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../src/config/database.js';
import { Center } from '../src/models/Center.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// لیست مراکز با نوع‌های جدید
const centersData = [
  { name: 'شهدای تجریش', type: 'customer' },
  { name: 'مرکز قلب تهران', type: 'lead' },
  { name: 'کودکان مفید', type: 'lead' },
  { name: 'شهید مصطفی خمینی', type: 'lead' },
  { name: 'خیریه غیاثی', type: 'customer' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان ضیائیان)', type: 'lead' },
  { name: 'ایرانمهر', type: 'customer' },
  { name: 'شهید دکتر لواسانی', type: 'lead' },
  { name: 'رادیولوژی دکتر گلستانها (آقای دکتر سید علی گلستانها)', type: 'customer' },
  { name: 'اقبال', type: 'lead' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان یاس)', type: 'customer' },
  { name: 'حضرت امیرالمؤمنين (ع) جوادیه', type: 'lead' },
  { name: 'امام رضا (ع) اسلامشهر', type: 'lead' },
  { name: 'دکتر فریدون خیام فر', type: 'lead' },
  { name: 'سونوگرافی و ماموگرافی کیان سلامت', type: 'customer' },
  { name: 'خانم دکتر پریسا عظیمی نژادان', type: 'customer' },
  { name: 'آریا', type: 'customer' },
  { name: 'کیان', type: 'lead' },
  { name: 'مرکز تصویر برداری نصر نبوی اسلامشهر تهران', type: 'lead' },
  { name: 'بابک', type: 'lead' },
  { name: 'دکتر محمد سعید سعیدیان', type: 'lead' },
  { name: 'شفا پردیس', type: 'lead' },
  { name: 'مهرآئین لواسان', type: 'lead' },
  { name: 'آزادی', type: 'lead' },
  { name: 'توس', type: 'lead' },
  { name: 'شهریار', type: 'lead' },
  { name: 'پارسا اسلامشهر', type: 'lead' },
  { name: 'شهید مهدی شریعت رضوی', type: 'lead' },
  { name: 'درمانگاه شبانه روزی سلیم', type: 'lead' },
  { name: 'تحقیقات ضایعات مغزی و نخاعی (کلینیک ریحانه)', type: 'lead' },
  { name: 'شبانه روزی قلهک (آقای دکتر محمد باقر طولابی)', type: 'lead' },
  { name: 'کلنیک رادیولوژی دکتر سمیعی', type: 'lead' },
  { name: 'مرکز سونوگرافی و رادیولوژی تابش پرتو تهران', type: 'lead' },
  { name: 'اختر', type: 'lead' },
  { name: 'تهران کلینیک', type: 'customer' }
];

async function updateCenterTypes() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    const allCenters = Center.getAll({});
    console.log(`📊 تعداد کل مراکز در دیتابیس: ${allCenters.length}\n`);

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFound = [];

    // به‌روزرسانی نوع هر مرکز
    for (const centerData of centersData) {
      const center = allCenters.find(c => c.name === centerData.name);
      
      if (!center) {
        console.log(`⚠️ مرکز یافت نشد: "${centerData.name}"`);
        notFound.push(centerData.name);
        notFoundCount++;
        continue;
      }

      // بررسی اینکه آیا نوع تغییر کرده است
      if (center.type !== centerData.type) {
        console.log(`🔄 به‌روزرسانی: ${center.name}`);
        console.log(`   نوع قبلی: ${center.type || 'null'} → نوع جدید: ${centerData.type}`);
        
        Center.update(center.id, { type: centerData.type });
        updatedCount++;
      } else {
        console.log(`✅ درست است: ${center.name} (${centerData.type})`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ به‌روزرسانی تکمیل شد!`);
    console.log(`   • به‌روزرسانی شده: ${updatedCount}`);
    console.log(`   • بدون تغییر: ${centersData.length - updatedCount - notFoundCount}`);
    console.log(`   • یافت نشد: ${notFoundCount}`);
    console.log(`${'='.repeat(60)}\n`);

    if (notFound.length > 0) {
      console.log('⚠️ مراکزی که یافت نشدند:');
      notFound.forEach(name => console.log(`   - ${name}`));
      console.log('');
    }

    // بررسی نهایی
    console.log('📊 آمار نهایی انواع مراکز:');
    const finalCenters = Center.getAll({});
    const typeStats = {
      'lead': 0,
      'opportunity': 0,
      'customer': 0,
      'old_customer': 0
    };

    finalCenters.forEach(c => {
      if (c.type && typeStats.hasOwnProperty(c.type)) {
        typeStats[c.type]++;
      }
    });

    console.log(`   ⚪ سرنخ (lead): ${typeStats.lead}`);
    console.log(`   🟡 فرصت (opportunity): ${typeStats.opportunity}`);
    console.log(`   🟢 مشتری (customer): ${typeStats.customer}`);
    console.log(`   🔵 مشتری قدیمی (old_customer): ${typeStats.old_customer}`);

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

updateCenterTypes();

