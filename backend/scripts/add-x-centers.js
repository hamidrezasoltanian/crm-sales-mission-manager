import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Center } from '../src/models/Center.js';

// لیست مراکز X (بدون مسئول مشخص)
const newCenters = [
  // مشتریان (Customer)
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان سینا)', type: 'customer' },
  { name: 'امام رضا (ع) ارتش (۵۰۱) آجا)', type: 'customer' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان شریعتی)', type: 'customer' },
  { name: 'خاتم الانبیاء (ص)', type: 'customer' },
  { name: 'ساسان', type: 'customer' },
  { name: 'آقای دکتر سیفی', type: 'customer' },
  { name: 'سرطان پستان معتمد جهاد دانشگاهی', type: 'customer' },
  { name: 'مهر', type: 'customer' },
  { name: 'بیمارستان بهمن', type: 'customer' },
  { name: 'رادیولوژی نیاوران', type: 'customer' },
  { name: 'لاله', type: 'customer' },
  { name: 'تهرانپارس', type: 'customer' },
  { name: 'خیریه الغدیر', type: 'customer' },
  { name: 'مرکز تصویر برداری مهر ایرانیان', type: 'customer' },
  { name: 'مرکز تصویر برداری و سونوگرافی خورشید', type: 'customer' },
  
  // سرنخ‌ها (Lead)
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان جامع بانوان آرش)', type: 'lead' },
  { name: 'آتیه', type: 'lead' },
  { name: 'مرکزی وزارت نفت', type: 'lead' },
  { name: 'جامع تصویر برداری پردیس نور', type: 'lead' },
  { name: 'مرکز تصویر برداری جردن', type: 'lead' },
  { name: 'انصاری', type: 'lead' },
  { name: 'نورافشار', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی گلبرگ', type: 'lead' },
  { name: 'سونوگرافی و رادیولوژی شقایق (آقای دکتر غلامرضا سیف)', type: 'lead' },
  { name: 'شهید دکتر باهنر', type: 'lead' },
  { name: 'شهرام (سجاد)', type: 'lead' },
  { name: 'دکتر حمیدرضا آرزه گر', type: 'lead' },
  { name: 'کلینیک یادمان طب', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی دکتر مریم جعفری', type: 'lead' },
  { name: 'یاس سپید', type: 'lead' },
  { name: 'فرجام', type: 'lead' },
  { name: 'رویان جهاد', type: 'lead' },
  { name: 'دکتر راشد احمدی', type: 'lead' },
  { name: 'مرکز تصویر برداری دکتر وهاب آقایی', type: 'lead' },
  { name: 'دکتر برنا فرازمند', type: 'lead' }
];

async function addXCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    console.log('📋 افزودن مراکز X (بدون مسئول مشخص)...');
    console.log('   این مراکز برای همه کارمندان قابل رویت خواهند بود.\n');

    // بررسی مراکز موجود
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
        // اضافه کردن مرکز بدون مسئول (responsiblePersonnelId = null)
        const newCenter = Center.create({
          name: centerData.name,
          address: null,
          city: null,
          district: null,
          type: centerData.type,
          responsiblePersonnelId: null  // بدون مسئول - برای همه قابل دسترسی
        });
        console.log(`✅ اضافه شد: ${newCenter.name} [${centerData.type === 'customer' ? '🟢 مشتری' : '⚪ سرنخ'}] (بدون مسئول)`);
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

    if (skipped.length > 0 && skipped.length <= 10) {
      console.log('📋 مراکزی که قبلاً وجود داشتند:');
      skipped.forEach(name => console.log(`   - ${name}`));
    }

    // آمار نهایی
    console.log('\n📊 آمار نهایی:');
    const finalCenters = Center.getAll({});
    console.log(`   کل مراکز: ${finalCenters.length}`);
    
    // تعداد مراکز بدون مسئول
    const centersWithoutResponsible = finalCenters.filter(c => !c.responsiblePersonnelId);
    console.log(`   مراکز بدون مسئول (برای همه قابل دسترسی): ${centersWithoutResponsible.length}`);
    
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

    console.log('\n✅ تمام مراکز X برای همه کارمندان قابل رویت هستند!');
    console.log('   وقتی مسئول مشخص شد، می‌توانید مرکز را به او اختصاص دهید.');

    console.log('\n✅ تمام شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addXCenters();

