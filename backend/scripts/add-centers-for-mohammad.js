import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import after dotenv
import { connectDB } from '../src/config/database.js';
import { Personnel } from '../src/models/Personnel.js';
import { Center } from '../src/models/Center.js';

const centers = [
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

async function addCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    // Find Mohammad Seyed Salehi
    console.log('\n🔍 Looking for "محمد سید صالحی"...');
    const allPersonnel = Personnel.getAll();
    const mohammad = allPersonnel.find(p => 
      p.name.includes('محمد') && 
      (p.name.includes('سید') || p.name.includes('صالحی')) ||
      p.name === 'محمد سید صالحی'
    );

    if (!mohammad) {
      console.log('\n❌ "محمد سید صالحی" در دیتابیس یافت نشد.');
      console.log('\n📋 لیست پرسنل موجود:');
      allPersonnel.forEach(p => console.log(`   - ${p.name} (ID: ${p.id})`));
      console.log('\n💡 لطفاً ابتدا "محمد سید صالحی" را به دیتابیس اضافه کنید.');
      process.exit(1);
    }

    console.log(`✅ پیدا شد: ${mohammad.name} (ID: ${mohammad.id})`);

    // Check existing centers
    const existingCenters = Center.getAll();
    const existingNames = new Set(existingCenters.map(c => c.name));

    console.log(`\n📊 تعداد مراکز موجود: ${existingCenters.length}`);
    console.log(`📝 تعداد مراکز جدید: ${centers.length}`);

    let added = 0;
    let skipped = 0;

    console.log('\n🔄 افزودن مراکز...\n');

    for (const centerData of centers) {
      if (existingNames.has(centerData.name)) {
        console.log(`⏭️  رد شد (موجود است): ${centerData.name}`);
        skipped++;
        continue;
      }

      try {
        const center = Center.create({
          name: centerData.name,
          address: null,
          city: null,
          district: null,
          latitude: null,
          longitude: null,
          snapLocationId: null,
          isActive: true
        });

        console.log(`✅ اضافه شد: ${center.name} (ID: ${center.id}) [${centerData.type}]`);
        added++;
      } catch (error) {
        console.error(`❌ خطا در افزودن "${centerData.name}":`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ تکمیل شد!`);
    console.log(`   • اضافه شده: ${added}`);
    console.log(`   • رد شده (موجود بود): ${skipped}`);
    console.log(`   • کل مراکز در دیتابیس: ${Center.getAll().length}`);
    console.log('='.repeat(60));

    console.log('\n💡 نکته: برای تکمیل اطلاعات مراکز (آدرس، شهر، منطقه) از دستور `/complete_center` در ربات تلگرام استفاده کنید.');

  } catch (error) {
    console.error('\n❌ خطا:', error);
    process.exit(1);
  }
}

addCenters();

