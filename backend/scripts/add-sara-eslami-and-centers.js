import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

// لیست مراکز سارا اسلامی
const newCenters = [
  // سرنخ‌ها (Lead)
  { name: 'صارم', type: 'lead' },
  { name: 'سلامت فردا', type: 'lead' },
  { name: 'تصویربرداری جام جم', type: 'lead' },
  { name: 'سیمرغ (آقای محمد معمارنژادیان)', type: 'lead' },
  { name: 'کودکان تهران', type: 'lead' },
  { name: 'شهید لبافی نژاد', type: 'lead' },
  { name: 'مرکز تصویربرداری مدیکو', type: 'lead' },
  { name: 'رادیولوژی سونوگرافی پارس', type: 'lead' },
  { name: 'مرکز رادیولوژی و سونوگرافی اکباتان', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی پارسیان', type: 'lead' },
  { name: 'گاندی', type: 'lead' },
  { name: 'آبان', type: 'lead' },
  { name: 'دی', type: 'lead' },
  { name: 'بازرگانان (شهید اندرزگو)', type: 'lead' },
  { name: 'کلینیک شیمی درمانی آرام (دکتر امامی)', type: 'lead' },
  { name: 'جراحی آذر', type: 'lead' },
  { name: 'خانم دکتر ساغری', type: 'lead' },
  { name: 'تصویربرداری درمانگاه تخصصی اعصاب سهروردی', type: 'lead' },
  { name: 'دکتر کیوان آقا محمدپور', type: 'lead' },
  { name: 'دکتر حسن نیرومند', type: 'lead' },
  { name: 'داروخانه قانون', type: 'lead' },
  { name: 'مادران', type: 'lead' },
  { name: 'شفاء', type: 'lead' },
  { name: 'دکتر ولی پور', type: 'lead' },
  { name: 'جراحی محدود خیریه حضرت زینب کبری (س)', type: 'lead' },
  { name: 'پانزده خرداد', type: 'lead' },
  { name: 'حضرت فاطمه الزهراء (س) دماوند', type: 'lead' },
  { name: 'شهید بهشتی (یداجا)', type: 'lead' },
  { name: 'سوم شعبان دماوند', type: 'lead' },
  { name: 'شهید مهدوی (ندسا)', type: 'lead' },
  { name: 'کلینیک دکتر مریم میرزایی مقدم', type: 'lead' },
  { name: 'تصویربرداری گلستان', type: 'lead' },
  { name: 'دکتر امیر کامیاب', type: 'lead' },
  
  // مشتریان (Customer)
  { name: 'تهران', type: 'customer' },
  { name: 'خانم دکتر ناهید نفیسی', type: 'customer' },
  { name: 'خیریه سوم شعبان', type: 'customer' },
  { name: 'آرام اکسیر هیراد', type: 'customer' }
];

async function addSaraEslamiAndCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // 1. بررسی و به‌روزرسانی سارا اسلامی
    console.log('🔍 بررسی سارا اسلامی...');
    const allPersonnel = Personnel.getAll();
    let saraEslami = allPersonnel.find(p => 
      p.name && (
        p.name === 'سارا اسلامی' ||
        (p.name.includes('سارا') && p.name.includes('اسلامی'))
      )
    );

    if (!saraEslami) {
      // اگر پیدا نشد، با آیدی تلگرام جستجو کنیم
      saraEslami = Personnel.getByTelegramId('113875529');
    }

    if (saraEslami) {
      console.log(`✅ پیدا شد: ${saraEslami.name} (ID: ${saraEslami.id})`);
      console.log(`   Telegram ID فعلی: ${saraEslami.telegramId || 'ندارد'}`);
      
      const newTelegramId = '113875529';
      if (saraEslami.telegramId !== newTelegramId) {
        console.log(`🔄 به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);
        Personnel.update(saraEslami.id, { telegramId: newTelegramId });
        console.log('✅ آیدی تلگرام به‌روزرسانی شد');
      } else {
        console.log('✅ آیدی تلگرام از قبل درست است');
      }
    } else {
      console.log('⚠️ سارا اسلامی یافت نشد. در حال ایجاد...');
      saraEslami = Personnel.create({
        name: 'سارا اسلامی',
        phone: '09102664230', // شماره تماس قبلی
        telegramId: '113875529',
        role: 'staff'
      });
      console.log(`✅ سارا اسلامی ایجاد شد (ID: ${saraEslami.id})`);
    }

    // 2. بررسی و به‌روزرسانی سارا حسینی
    console.log('\n🔍 بررسی سارا حسینی...');
    let saraHosseini = allPersonnel.find(p => 
      p.name && (
        p.name === 'سارا حسینی' ||
        (p.name.includes('سارا') && p.name.includes('حسینی'))
      )
    );

    if (!saraHosseini) {
      // اگر پیدا نشد، با آیدی تلگرام جستجو کنیم
      saraHosseini = Personnel.getByTelegramId('71303335');
    }

    if (saraHosseini) {
      console.log(`✅ پیدا شد: ${saraHosseini.name} (ID: ${saraHosseini.id})`);
      console.log(`   Telegram ID فعلی: ${saraHosseini.telegramId || 'ندارد'}`);
      
      const newTelegramId = '71303335';
      if (saraHosseini.telegramId !== newTelegramId) {
        console.log(`🔄 به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);
        Personnel.update(saraHosseini.id, { telegramId: newTelegramId, role: 'admin' });
        console.log('✅ آیدی تلگرام و نقش admin به‌روزرسانی شد');
      } else {
        // فقط نقش را به admin تغییر می‌دهیم
        if (saraHosseini.role !== 'admin') {
          Personnel.update(saraHosseini.id, { role: 'admin' });
          console.log('✅ نقش به admin به‌روزرسانی شد');
        } else {
          console.log('✅ آیدی تلگرام و نقش از قبل درست است');
        }
      }
    } else {
      console.log('⚠️ سارا حسینی یافت نشد. در حال ایجاد...');
      saraHosseini = Personnel.create({
        name: 'سارا حسینی',
        phone: '09123456788',
        telegramId: '71303335',
        role: 'admin'
      });
      console.log(`✅ سارا حسینی ایجاد شد (ID: ${saraHosseini.id})`);
    }

    // 3. اضافه کردن مراکز جدید
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

    // 4. اختصاص همه مراکز جدید به سارا اسلامی
    if (saraEslami && addedCount > 0) {
      console.log(`\n🔄 اختصاص ${addedCount} مرکز جدید به سارا اسلامی...`);
      const allCenters = Center.getAll({});
      const newCentersList = allCenters.filter(c => 
        newCenters.some(nc => nc.name === c.name && !c.responsiblePersonnelId)
      );
      
      let assignedCount = 0;
      for (const center of newCentersList) {
        Center.update(center.id, { responsiblePersonnelId: parseInt(saraEslami.id) });
        assignedCount++;
      }
      console.log(`✅ ${assignedCount} مرکز به سارا اسلامی اختصاص داده شد.`);
    }

    // 5. آمار نهایی
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

    // تعداد مراکز سارا اسلامی
    if (saraEslami) {
      const saraCenters = finalCenters.filter(c => 
        c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(saraEslami.id)
      );
      console.log(`\n👤 مراکز سارا اسلامی: ${saraCenters.length}`);
      console.log(`   ⚪ سرنخ: ${saraCenters.filter(c => c.type === 'lead').length}`);
      console.log(`   🟢 مشتری: ${saraCenters.filter(c => c.type === 'customer').length}`);
    }

    console.log('\n✅ تمام شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addSaraEslamiAndCenters();

