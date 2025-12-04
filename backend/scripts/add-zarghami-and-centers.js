import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

// لیست مراکز آقای زرقامی
const newCenters = [
  // مشتریان (Customer)
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان امام خمینی)', type: 'customer' },
  { name: 'شهید دکتر مصطفی چمران', type: 'customer' },
  { name: 'گلستان ارتش (نداجا)', type: 'customer' },
  { name: 'مجموعه بیمارستان های نیکان', type: 'customer' },
  { name: 'علوم پزشکی بقیة الله الاعظم (بیمارستان نجمیه)', type: 'customer' },
  { name: 'قلب شهید رجایی', type: 'customer' },
  { name: 'فرمانیه', type: 'customer' },
  { name: 'دکتر ایراندوست', type: 'customer' },
  
  // سرنخ‌ها (Lead)
  { name: 'امام حسین (ع)', type: 'lead' },
  { name: 'آیت الله طالقانی', type: 'lead' },
  { name: 'فجر', type: 'lead' },
  { name: 'تصویربرداری تهران', type: 'lead' },
  { name: 'تندیس جردن', type: 'lead' },
  { name: 'مرکز بیماریهای خاص شرق (بیمارستان هاشمی رفسنجانی)', type: 'lead' },
  { name: 'مسیح دانشوری', type: 'lead' },
  { name: 'محک', type: 'lead' },
  { name: 'پارس', type: 'lead' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (بیمارستان مرکز طبی کودکان)', type: 'lead' },
  { name: 'پاستورنو', type: 'lead' },
  { name: 'آسیا', type: 'lead' },
  { name: 'حضرت سیدالشهداء (ع)', type: 'lead' },
  { name: 'بوعلی', type: 'lead' },
  { name: 'مردم', type: 'lead' },
  { name: 'مرکز تصویربرداری توسکا تهران', type: 'lead' },
  { name: 'تصویربرداری بابک', type: 'lead' },
  { name: 'جراحی محدود سعادت آباد', type: 'lead' },
  { name: 'توانبخشی رفیده', type: 'lead' },
  { name: 'داروخانه ویولا', type: 'lead' },
  { name: 'شهید فلاحی ارتش (نزاجا)', type: 'lead' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (داروخانه بیمارستان رازی)', type: 'lead' },
  { name: 'تامین داروخانه های بیمارستانی دانشگاه علوم پزشکی تهران (داروخانه بیمارستان بهرامی)', type: 'lead' },
  { name: 'طرفه', type: 'lead' },
  { name: 'دکتر محمدرضا مهری', type: 'lead' },
  { name: 'دکتر آردا کیانی', type: 'lead' }
];

async function addZarghamiAndCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // 1. بررسی و به‌روزرسانی آقای زرقامی
    console.log('🔍 بررسی آقای زرقامی...');
    const allPersonnel = Personnel.getAll();
    let zarghami = allPersonnel.find(p => 
      p.name && (
        p.name.includes('زرقامی') ||
        p.name.includes('Zarghami')
      )
    );

    if (!zarghami) {
      // اگر پیدا نشد، با آیدی تلگرام جستجو کنیم
      zarghami = Personnel.getByTelegramId('7500109352');
    }

    if (zarghami) {
      console.log(`✅ پیدا شد: ${zarghami.name} (ID: ${zarghami.id})`);
      console.log(`   Telegram ID فعلی: ${zarghami.telegramId || 'ندارد'}`);
      
      const newTelegramId = '7500109352';
      if (zarghami.telegramId !== newTelegramId) {
        console.log(`🔄 به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);
        Personnel.update(zarghami.id, { telegramId: newTelegramId });
        console.log('✅ آیدی تلگرام به‌روزرسانی شد');
      } else {
        console.log('✅ آیدی تلگرام از قبل درست است');
      }
    } else {
      console.log('⚠️ آقای زرقامی یافت نشد. در حال ایجاد...');
      zarghami = Personnel.create({
        name: 'زرقامی',
        phone: '09123456790',
        telegramId: '7500109352',
        role: 'staff'
      });
      console.log(`✅ آقای زرقامی ایجاد شد (ID: ${zarghami.id})`);
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

    if (skipped.length > 0 && skipped.length <= 10) {
      console.log('📋 مراکزی که قبلاً وجود داشتند:');
      skipped.forEach(name => console.log(`   - ${name}`));
    }

    // 3. اختصاص همه مراکز جدید به آقای زرقامی
    if (zarghami && addedCount > 0) {
      console.log(`\n🔄 اختصاص ${addedCount} مرکز جدید به آقای زرقامی...`);
      const allCenters = Center.getAll({});
      const newCentersList = allCenters.filter(c => 
        newCenters.some(nc => nc.name === c.name && !c.responsiblePersonnelId)
      );
      
      let assignedCount = 0;
      for (const center of newCentersList) {
        Center.update(center.id, { responsiblePersonnelId: parseInt(zarghami.id) });
        assignedCount++;
      }
      console.log(`✅ ${assignedCount} مرکز به آقای زرقامی اختصاص داده شد.`);
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

    // تعداد مراکز آقای زرقامی
    if (zarghami) {
      const zarghamiCenters = finalCenters.filter(c => 
        c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(zarghami.id)
      );
      console.log(`\n👤 مراکز آقای زرقامی: ${zarghamiCenters.length}`);
      console.log(`   ⚪ سرنخ: ${zarghamiCenters.filter(c => c.type === 'lead').length}`);
      console.log(`   🟢 مشتری: ${zarghamiCenters.filter(c => c.type === 'customer').length}`);
    }

    console.log('\n✅ تمام شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addZarghamiAndCenters();

