import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// لیست مراکز جدید
const newCenters = [
  { name: 'علوم پزشکی بقیة الله (بیمارستان آموزشی پژوهشی درمانی بقیة الله الاعظم) عج', type: 'customer' },
  { name: 'شهید مدرس', type: 'customer' },
  { name: 'شهید فیاض بخش', type: 'customer' },
  { name: 'پارسیان', type: 'lead' },
  { name: 'صبا داروی میلاد (داروخانه بیمارستان محب مهر)', type: 'lead' },
  { name: 'آیت الله کاشانی', type: 'customer' },
  { name: 'عرفان', type: 'customer' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان بهارلو)', type: 'lead' },
  { name: 'مدائن', type: 'lead' },
  { name: 'عرفان نیایش', type: 'lead' },
  { name: 'لقمان حکیم', type: 'lead' },
  { name: 'عدل', type: 'lead' },
  { name: 'دکتر کشاورز', type: 'customer' },
  { name: 'بین المللی آرمان', type: 'customer' },
  { name: 'شهدای پانزده خرداد ورامین', type: 'lead' },
  { name: 'فرهیختگان', type: 'lead' },
  { name: 'امید', type: 'customer' },
  { name: 'دکتر محمد نظری', type: 'customer' },
  { name: 'رسالت', type: 'lead' },
  { name: 'پزشکی شهید شوریده', type: 'customer' },
  { name: 'پارسا', type: 'customer' },
  { name: 'قمر بنی هاشم', type: 'lead' },
  { name: 'رادیولوژی دکتر صانعی', type: 'lead' },
  { name: 'جراحی ابوریحان', type: 'lead' },
  { name: 'زعیم پاکدشت', type: 'lead' },
  { name: 'شهداء پاکدشت', type: 'lead' },
  { name: 'شهید دکتر مفتح ورامین', type: 'lead' },
  { name: 'دکتر سید ناصر سید اسماعیلی', type: 'lead' },
  { name: 'شهید مهدوی (ندسا)', type: 'lead' },
  { name: 'مروستی', type: 'lead' },
  { name: 'دکتر محمد سلیمانی', type: 'lead' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (داروخانه بیمارستان روزبه)', type: 'lead' },
  { name: 'تخصصی مدافعان آسمان (پداجا)', type: 'lead' },
  { name: 'هاجر ارتش (نزاجا)', type: 'customer' },
  { name: 'مرکز کودکان حکیم', type: 'lead' },
  { name: 'تصویر برداری پزشکی دکتر نوید توفیقی راد تهران', type: 'lead' },
  { name: 'مرکز تصویر بردار دریا (دکتر زارعی)', type: 'lead' },
  { name: 'دکتر فتانه ضیایی', type: 'customer' },
  { name: 'محب کوثر', type: 'lead' }
];

async function addMohammadNilizadeAndCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // 1. بررسی و به‌روزرسانی محمد نیلی زاده
    console.log('🔍 بررسی محمد نیلی زاده...');
    const allPersonnel = Personnel.getAll();
    let mohammad = allPersonnel.find(p => 
      p.name.includes('محمد') && 
      (p.name.includes('نیلی') || p.name.includes('نیلی زاده'))
    );

    if (!mohammad) {
      // اگر پیدا نشد، با آیدی تلگرام قبلی جستجو کنیم
      mohammad = Personnel.getByTelegramId('@mnilizade');
    }

    if (mohammad) {
      console.log(`✅ پیدا شد: ${mohammad.name} (ID: ${mohammad.id})`);
      console.log(`   Telegram ID فعلی: ${mohammad.telegramId || 'ندارد'}`);
      
      const newTelegramId = '7460088229';
      if (mohammad.telegramId !== newTelegramId) {
        console.log(`🔄 به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);
        Personnel.update(mohammad.id, { telegramId: newTelegramId });
        console.log('✅ آیدی تلگرام به‌روزرسانی شد');
      } else {
        console.log('✅ آیدی تلگرام از قبل درست است');
      }
    } else {
      console.log('⚠️ محمد نیلی زاده یافت نشد. لطفاً ابتدا او را در سیستم اضافه کنید.');
    }

    // 2. اضافه کردن مراکز جدید
    console.log('\n📋 بررسی و افزودن مراکز جدید...');
    const existingCenters = Center.getAll({});
    const existingCenterNames = new Set(existingCenters.map(c => c.name));
    
    let addedCount = 0;
    let skippedCount = 0;
    const skipped = [];

    for (const centerData of newCenters) {
      if (existingCenterNames.has(centerData.name)) {
        skipped.push(centerData.name);
        skippedCount++;
        continue;
      }

      try {
        const newCenter = Center.create({
          name: centerData.name,
          address: null,
          city: null,
          district: null,
          type: centerData.type,
          responsiblePersonnelId: null
        });
        console.log(`✅ اضافه شد: ${newCenter.name} [${centerData.type === 'customer' ? '🟢 مشتری' : '⚪ سرنخ'}]`);
        addedCount++;
      } catch (error) {
        console.error(`❌ خطا در افزودن "${centerData.name}": ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ تکمیل شد!`);
    console.log(`   • مراکز جدید اضافه شده: ${addedCount}`);
    console.log(`   • مراکز موجود (رد شده): ${skippedCount}`);
    console.log(`${'='.repeat(60)}\n`);

    if (skipped.length > 0 && skipped.length <= 5) {
      console.log('📋 مراکزی که قبلاً وجود داشتند:');
      skipped.forEach(name => console.log(`   - ${name}`));
    }

    // 3. اختصاص همه مراکز جدید به محمد نیلی زاده
    if (mohammad && addedCount > 0) {
      console.log(`\n🔄 اختصاص ${addedCount} مرکز جدید به محمد نیلی زاده...`);
      const allCenters = Center.getAll({});
      const newCentersList = allCenters.filter(c => 
        newCenters.some(nc => nc.name === c.name && !c.responsiblePersonnelId)
      );
      
      let assignedCount = 0;
      for (const center of newCentersList) {
        Center.update(center.id, { responsiblePersonnelId: parseInt(mohammad.id) });
        assignedCount++;
      }
      console.log(`✅ ${assignedCount} مرکز به محمد نیلی زاده اختصاص داده شد.`);
    }

    // 4. آمار نهایی
    console.log('\n📊 آمار نهایی:');
    const finalCenters = Center.getAll({});
    console.log(`   کل مراکز: ${finalCenters.length}`);
    
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

    // تعداد مراکز محمد نیلی زاده
    if (mohammad) {
      const mohammadCenters = finalCenters.filter(c => 
        c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(mohammad.id)
      );
      console.log(`\n👤 مراکز محمد نیلی زاده: ${mohammadCenters.length}`);
    }

    console.log('\n✅ تمام شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addMohammadNilizadeAndCenters();




