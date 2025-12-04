import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function fixMohammadTelegram() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // Find Mohammad Seyed Salehi
    console.log('🔍 Looking for "محمد سید صالحی"...');
    const allPersonnel = Personnel.getAll();
    const mohammad = allPersonnel.find(p => 
      p.name.includes('محمد') && 
      (p.name.includes('سید') || p.name.includes('صالحی'))
    );

    if (!mohammad) {
      console.log('\n❌ "محمد سید صالحی" در دیتابیس یافت نشد.');
      console.log('\n📋 لیست پرسنل موجود:');
      allPersonnel.forEach(p => console.log(`   - ${p.name} (ID: ${p.id}, Telegram: ${p.telegramId || 'ندارد'})`));
      process.exit(1);
    }

    console.log(`✅ پیدا شد: ${mohammad.name} (ID: ${mohammad.id})`);
    console.log(`   Telegram ID فعلی: ${mohammad.telegramId || 'ندارد'}`);

    // آیدی جدید که کاربر داده
    const newTelegramId = '6821068470';

    // تست با آیدی جدید
    console.log(`\n🔍 Testing lookup with new Telegram ID: ${newTelegramId}`);
    const testLookup = Personnel.getByTelegramId(newTelegramId);
    if (testLookup) {
      console.log(`   ✅ Found: ${testLookup.name}`);
    } else {
      console.log(`   ❌ Not found with new ID`);
    }

    // به‌روزرسانی آیدی تلگرام
    if (mohammad.telegramId !== newTelegramId) {
      console.log(`\n🔄 در حال به‌روزرسانی آیدی تلگرام به: ${newTelegramId}...`);
      Personnel.update(mohammad.id, {
        telegramId: newTelegramId
      });
      console.log('✅ Telegram ID updated');
    } else {
      console.log(`\n✅ آیدی تلگرام از قبل درست است: ${newTelegramId}`);
    }

    // بررسی مراکز
    console.log('\n📋 بررسی مراکز...');
    const allCenters = Center.getAll({});
    const centersWithoutResponsible = allCenters.filter(c => !c.responsiblePersonnelId);
    const centersWithMohammad = allCenters.filter(c => 
      c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(mohammad.id)
    );

    console.log(`   کل مراکز: ${allCenters.length}`);
    console.log(`   مراکز بدون مسئول: ${centersWithoutResponsible.length}`);
    console.log(`   مراکز مربوط به محمد سید صالحی: ${centersWithMohammad.length}`);

    // اختصاص همه مراکز بدون مسئول به محمد سید صالحی
    if (centersWithoutResponsible.length > 0) {
      console.log(`\n🔄 اختصاص ${centersWithoutResponsible.length} مرکز به محمد سید صالحی...`);
      let updatedCount = 0;
      for (const center of centersWithoutResponsible) {
        Center.update(center.id, { responsiblePersonnelId: parseInt(mohammad.id) });
        updatedCount++;
      }
      console.log(`✅ ${updatedCount} مرکز به محمد سید صالحی اختصاص داده شد.`);
    }

    // بررسی نهایی
    console.log('\n✅ بررسی نهایی:');
    const updatedMohammad = Personnel.getById(mohammad.id);
    console.log(`   نام: ${updatedMohammad.name}`);
    console.log(`   Telegram ID: ${updatedMohammad.telegramId}`);
    console.log(`   Phone: ${updatedMohammad.phone}`);
    console.log(`   Role: ${updatedMohammad.role}`);

    // تست lookup با آیدی جدید
    console.log('\n🔍 تست lookup با آیدی جدید...');
    const finalTest = Personnel.getByTelegramId(newTelegramId);
    if (finalTest) {
      console.log(`   ✅ موفق! پیدا شد: ${finalTest.name}`);
    } else {
      console.log(`   ❌ خطا! هنوز پیدا نمی‌شود.`);
    }

    // نمایش مراکز اختصاص داده شده
    const finalCenters = Center.getAll({});
    const mohammadCenters = finalCenters.filter(c => 
      c.responsiblePersonnelId && parseInt(c.responsiblePersonnelId) === parseInt(mohammad.id)
    );
    console.log(`\n📊 مراکز اختصاص داده شده به محمد سید صالحی: ${mohammadCenters.length}`);
    if (mohammadCenters.length > 0) {
      mohammadCenters.slice(0, 5).forEach(c => {
        console.log(`   - ${c.name} (Type: ${c.type || 'lead'})`);
      });
      if (mohammadCenters.length > 5) {
        console.log(`   ... و ${mohammadCenters.length - 5} مرکز دیگر`);
      }
    }

    console.log('\n✅ تمام شد! حالا محمد سید صالحی می‌تواند با ربات کار کند.');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

fixMohammadTelegram();

