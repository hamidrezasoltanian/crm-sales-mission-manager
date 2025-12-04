import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

// لیست مراکز خانم ریحانه کاشی ساز
const newCenters = [
  // مشتریان (Customer)
  { name: 'میلاد', type: 'customer' },
  { name: 'بیمارستان برکت', type: 'customer' },
  { name: 'حضرت ولیعصر (عج) ناجا', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان فیروزگر)', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان حضرت رسول اکرم)', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شهید هاشمی نژاد)', type: 'customer' },
  { name: 'نور شهریار', type: 'customer' },
  { name: 'مرکز تصویر برداری آرینا', type: 'customer' },
  { name: 'مهراد', type: 'customer' },
  { name: 'جم', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان فیروزآبادی) شهر ری', type: 'customer' },
  { name: 'پیامبران', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شفاء یحیائیان)', type: 'customer' },
  { name: 'آزاد', type: 'customer' },
  { name: 'ایرانشهر', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شهریار امام سجاد (ع) شهریار ۹)', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شهید مطهری)', type: 'customer' },
  { name: 'کلینیک روشنا', type: 'customer' },
  { name: 'مرکز تصویر برداری آرین (داروخانه دکتر فراهانی (دنیای مکمل))', type: 'customer' },
  { name: 'مرکز تصویر برداری میرداماد (دکتر عبدی)', type: 'customer' },
  { name: 'دکتر رحیمی (آقای دکتر مریم رحیمی)', type: 'customer' },
  { name: 'جراحی شمس تبریزی', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شهید اکبرآبادی)', type: 'customer' },
  { name: 'مجتمع پزشکی صدر تهران', type: 'customer' },
  { name: 'مرکز تصویر برداری پارسیان (شهر آرا)', type: 'customer' },
  { name: 'فوق تخصصی گوارش و کبد بهبود', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان شهید فهمیده)', type: 'customer' },
  { name: 'مرکز تصویر برداری دکتر اطهری', type: 'customer' },
  { name: 'مدد ایران (داروخانه بیمارستان حضرت علی اصغر (ع))', type: 'customer' },
  { name: 'آروین کلینیک', type: 'customer' },
  { name: 'مرکز رادیولوژی فاطر نورا (دکتر مریم یوسفی)', type: 'customer' },
  { name: 'مرکز جامع سلامت و آنکولوژی نگین آزادی', type: 'customer' },
  
  // سرنخ‌ها (Lead)
  { name: 'تربت', type: 'lead' },
  { name: 'کسری', type: 'lead' },
  { name: 'بانک ملی ایران', type: 'lead' },
  { name: '۵۰۴ بعثت ارتش (نداجا)', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان شهدای هفتم تیر شهرری)', type: 'lead' },
  { name: 'ابن سینا', type: 'lead' },
  { name: 'آبادانا', type: 'lead' },
  { name: '۵۰۴ خانواده ارتش (نداجا)', type: 'lead' },
  { name: '۵۰۲ ارتش (نداجا)', type: 'lead' },
  { name: 'پاسارگاد', type: 'lead' },
  { name: 'دکتر محسن انصاری', type: 'lead' },
  { name: 'تصویر برداری جام جم شهر قدس', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی دکتر مریم یوسفی', type: 'lead' },
  { name: 'دکتر مهدی کاردوست پاریزی', type: 'lead' },
  { name: 'دکتر علی رازی', type: 'lead' },
  { name: 'تصویر برداری تیراد', type: 'lead' },
  { name: 'ساسان البرز طب (کلینیک تخصصی داخلی مسعود)', type: 'lead' },
  { name: 'بیمارستان مفرح', type: 'lead' },
  { name: 'مهدیه', type: 'lead' },
  { name: 'دکتر لادن معینی', type: 'lead' },
  { name: 'درمانگاه شبانه روزی نیاوران', type: 'lead' },
  { name: 'مرکز رادیولوژی سونوگرافی تابناک', type: 'lead' },
  { name: 'مرکز رادیولوژی سونوگرافی الوند', type: 'lead' },
  { name: 'دکتر محمد رضا نوروزی', type: 'lead' },
  { name: 'دکتر محمد جباری', type: 'lead' },
  { name: 'دکتر رسول اسماعیلی', type: 'lead' },
  { name: 'دکتر اسماعیل توتونچی', type: 'lead' },
  { name: 'کریمه اهل بیت', type: 'lead' },
  { name: 'دکتر محبوبه امینی هرندی', type: 'lead' },
  { name: 'دکتر حسین امیر زرگر', type: 'lead' },
  { name: 'دکتر سعید صادق زاده', type: 'lead' },
  { name: 'مرکز تصویر برداری سایه تهران', type: 'lead' },
  { name: 'رادیوتراپی فوق تخصصی دکتر احسان کرباسی', type: 'lead' },
  { name: 'دکتر علیرضا رضایی', type: 'lead' },
  { name: 'سورنا (عیوضی زاده)', type: 'lead' },
  { name: 'مرکز تصویر برداری نما طب تهران', type: 'lead' },
  { name: 'دکتر برنا فرازمند', type: 'lead' },
  { name: 'دکتر هوشنگ قوامی', type: 'lead' },
  { name: 'دکتر فرشاد نامداری', type: 'lead' },
  { name: '۱۲ بهمن شهر قدس', type: 'lead' },
  { name: 'دکتر سید امین میرصادقی', type: 'lead' },
  { name: 'دکتر احمدرضا رفعتی', type: 'lead' },
  { name: 'دکتر مجتبی عاملی', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان اولاگر)', type: 'lead' },
  { name: 'پزشکی مهر نگار آزما', type: 'lead' },
  { name: 'امام سجاد (ع) ناجا', type: 'lead' },
  { name: 'امام خمینی (ره) فیروزکوه', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان شهدای یافت آباد)', type: 'lead' },
  { name: 'تأمین اجتماعی شهریار', type: 'lead' },
  { name: 'تخصصی داخلی و همودیالیز به آفرین', type: 'lead' },
  { name: 'دکتر اکبر عابدی', type: 'lead' },
  { name: 'دکتر حجت سلیمی', type: 'lead' },
  { name: 'باهر', type: 'lead' },
  { name: 'جواهری', type: 'lead' },
  { name: 'حسینیه ارشاد', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان حضرت فاطمه (س))', type: 'lead' },
  { name: 'دکتر سپیر', type: 'lead' },
  { name: 'مرکز تصویر برداری رازی (دکتر علیزاده شهرری)', type: 'lead' },
  { name: 'دکتر علیرضا سینا', type: 'lead' },
  { name: 'شهید عراقی', type: 'lead' },
  { name: 'شهید کلانتری', type: 'lead' },
  { name: 'صدر به آفرین', type: 'lead' },
  { name: 'چند تخصصی درد پردیس', type: 'lead' },
  { name: 'نسیم نسیم شهر (بهارستان)', type: 'lead' },
  { name: 'هدایت', type: 'lead' },
  { name: 'آموزشی سوم خرداد', type: 'lead' },
  { name: 'مرکز تصویر برداری دکتر صدری', type: 'lead' },
  { name: 'البرز', type: 'lead' },
  { name: 'امیراعلم', type: 'lead' },
  { name: 'دادگستری', type: 'lead' },
  { name: 'رادیولوژی سونوگرافی ماموگرافی گلستان', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان سردار سلیمانی)', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان امام حسین)', type: 'lead' },
  { name: 'مدد ایران (داروخانه بیمارستان حضرت فاطمه الزهراء (س) رباط کریم)', type: 'lead' },
  { name: 'خیریه حضرت صدیقه زهرا (س) شهر ری', type: 'lead' },
  { name: 'خیریه حضرت ولیعصر (عج)', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی راد', type: 'lead' },
  { name: 'شهید دکتر معیری', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی مروارید ری', type: 'lead' },
  { name: 'مرکز پزشکی توریسم شمس', type: 'lead' },
  { name: 'کوثر حضرت عبدالعظیم (ع) شهر ری', type: 'lead' },
  { name: 'مرکز تصویر برداری آرین', type: 'lead' },
  { name: 'مرکز تصویر برداری ۱۰۱ تهران', type: 'lead' },
  { name: 'رادیولوژی و سونوگرافی بیستون (دکتر صباح گل یان تهران)', type: 'lead' },
  { name: 'دکتر محمدرضا عابدینی', type: 'lead' },
  { name: 'مرکز تصویر برداری پردیس ونک', type: 'lead' },
  { name: 'تجهیزات پزشکی هاشمی', type: 'lead' },
  { name: 'دکتر فرهاد احمدی', type: 'lead' },
  { name: 'دکتر حمید لعلی نیا', type: 'lead' },
  { name: 'دکتر نیری', type: 'lead' },
  { name: 'دکتر صفاری', type: 'lead' },
  { name: 'مرکز تصویر برداری کوروش (دکتر عالیشاه)', type: 'lead' },
  { name: 'دکتر علیرضا نجفی', type: 'lead' },
  { name: 'دکتر مسعود ارباب زاده', type: 'lead' },
  { name: 'داروخانه دکتر راستکار', type: 'lead' },
  { name: 'دکتر رش احمدی', type: 'lead' },
  { name: 'سونوگرافی و رادیولوژی مینا (دکتر مریم ابراهیمی)', type: 'lead' },
  { name: 'سونوگرافی حکیم', type: 'lead' },
  { name: 'مرکز تصویر برداری دکتر شکری شهرری', type: 'lead' },
  { name: 'تجهیزات پزشکی امید نو', type: 'lead' }
];

async function addReyhanehKashisazAndCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // دریافت آیدی تلگرام از آرگومان خط فرمان یا استفاده از مقدار پیش‌فرض
    const telegramId = process.argv[2] || null;

    if (!telegramId) {
      console.log('⚠️ لطفاً آیدی تلگرام خانم ریحانه کاشی ساز را وارد کنید:');
      console.log('   استفاده: node scripts/add-reyhaneh-kashisaz-and-centers.js <TELEGRAM_ID>');
      console.log('\n📋 در حال ادامه با جستجو در دیتابیس...\n');
    }

    // 1. بررسی و به‌روزرسانی خانم ریحانه کاشی ساز
    console.log('🔍 بررسی خانم ریحانه کاشی ساز...');
    const allPersonnel = Personnel.getAll();
    let reyhaneh = null;

    if (telegramId) {
      reyhaneh = Personnel.getByTelegramId(telegramId);
    }

    if (!reyhaneh) {
      reyhaneh = allPersonnel.find(p => 
        p.name && (
          p.name.includes('ریحانه') || 
          p.name.includes('کاشی') ||
          p.name.includes('Reyhaneh') ||
          p.name.includes('Kashisaz')
        )
      );
    }

    if (reyhaneh) {
      console.log(`✅ پیدا شد: ${reyhaneh.name} (ID: ${reyhaneh.id})`);
      console.log(`   Telegram ID فعلی: ${reyhaneh.telegramId || 'ندارد'}`);
      
      if (telegramId && reyhaneh.telegramId !== telegramId) {
        console.log(`🔄 به‌روزرسانی آیدی تلگرام به: ${telegramId}...`);
        Personnel.update(reyhaneh.id, { telegramId: telegramId });
        console.log('✅ آیدی تلگرام به‌روزرسانی شد');
      } else if (!telegramId) {
        console.log('⚠️ آیدی تلگرام تنظیم نشده است. لطفاً بعداً آن را تنظیم کنید.');
      } else {
        console.log('✅ آیدی تلگرام از قبل درست است');
      }
    } else {
      if (!telegramId) {
        console.log('❌ خانم ریحانه کاشی ساز یافت نشد و آیدی تلگرام نیز ارائه نشده است.');
        console.log('⚠️ لطفاً آیدی تلگرام را به عنوان آرگومان وارد کنید:');
        console.log('   node scripts/add-reyhaneh-kashisaz-and-centers.js <TELEGRAM_ID>');
        process.exit(1);
      }
      
      console.log('⚠️ خانم ریحانه کاشی ساز یافت نشد. در حال ایجاد...');
      reyhaneh = Personnel.create({
        name: 'ریحانه کاشی ساز',
        phone: '09123456791',
        telegramId: telegramId,
        role: 'staff'
      });
      console.log(`✅ خانم ریحانه کاشی ساز ایجاد شد (ID: ${reyhaneh.id})`);
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

    // 3. اختصاص همه مراکز جدید به خانم ریحانه کاشی ساز
    if (reyhaneh && addedCount > 0) {
      console.log(`\n🔄 اختصاص ${addedCount} مرکز جدید به خانم ریحانه کاشی ساز...`);
      const allCenters = Center.getAll({});
      const newCentersList = allCenters.filter(c => 
        newCenters.some(nc => nc.name === c.name && !c.responsiblePersonnelId)
      );
      
      let assignedCount = 0;
      for (const center of newCentersList) {
        Center.update(center.id, { responsiblePersonnelId: parseInt(reyhaneh.id) });
        assignedCount++;
      }
      console.log(`✅ ${assignedCount} مرکز به خانم ریحانه کاشی ساز اختصاص داده شد.`);
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

    // تعداد مراکز خانم ریحانه کاشی ساز
    if (reyhaneh) {
      const reyhanehCenters = finalCenters.filter(c => 
        c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(reyhaneh.id)
      );
      console.log(`\n👤 مراکز خانم ریحانه کاشی ساز: ${reyhanehCenters.length}`);
      console.log(`   ⚪ سرنخ: ${reyhanehCenters.filter(c => c.type === 'lead').length}`);
      console.log(`   🟢 مشتری: ${reyhanehCenters.filter(c => c.type === 'customer').length}`);
    }

    console.log('\n✅ تمام شد!');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addReyhanehKashisazAndCenters();

