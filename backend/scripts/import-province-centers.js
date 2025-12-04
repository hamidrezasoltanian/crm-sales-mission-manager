import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { connectDB, getDB, autoSave } from '../src/config/database.js';
import { Center } from '../src/models/Center.js';
import { Personnel } from '../src/models/Personnel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function importProvinceCenters() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    // مسیر فایل اکسل
    const excelPath = join(__dirname, '../data/لیست مراکز استان ها.xlsx');
    const fs = await import('fs');
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ فایل اکسل یافت نشد: ${excelPath}`);
      process.exit(1);
    }

    console.log(`📂 خواندن فایل اکسل: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ ${data.length} ردیف در فایل اکسل یافت شد\n`);

    // دریافت تمام مراکز موجود برای چک کردن تکراری
    const existingCenters = Center.getAll({ isActive: true });
    const existingCenterNames = new Set(
      existingCenters.map(c => c.name.trim().toLowerCase())
    );

    // دریافت تمام پرسنل برای پیدا کردن مسئول
    const allPersonnel = Personnel.getAll();
    const personnelMap = new Map();
    allPersonnel.forEach(p => {
      personnelMap.set(p.name.trim().toLowerCase(), p);
    });

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];

    console.log('🔄 شروع import مراکز...\n');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // خواندن ستون‌ها (با نام‌های مختلف ممکن)
        const province = (row['استان'] || row['Province'] || row['استان/شهر'] || '').toString().trim();
        const responsible = (row['مسئول'] || row['Responsible'] || row['مسئول فروش'] || '').toString().trim();
        const centerName = (row['نام مرکز'] || row['Center Name'] || row['مرکز'] || row['نام'] || '').toString().trim();
        const tags = (row['برچسب'] || row['Tag'] || row['Tags'] || row['نوع'] || '').toString().trim();

        // بررسی اینکه آیا مرکز نام دارد
        if (!centerName) {
          console.log(`⚠️  ردیف ${i + 2}: نام مرکز خالی است، رد شد`);
          skipped++;
          continue;
        }

        // چک کردن تکراری بودن (بر اساس نام)
        const centerNameLower = centerName.toLowerCase();
        if (existingCenterNames.has(centerNameLower)) {
          console.log(`⏭️  ردیف ${i + 2}: مرکز "${centerName}" قبلاً وجود دارد، رد شد`);
          skipped++;
          continue;
        }

        // فیلتر کردن مراکز تهران
        const city = province || '';
        if (city.toLowerCase().includes('تهران') || city.toLowerCase() === 'tehran') {
          console.log(`⏭️  ردیف ${i + 2}: مرکز "${centerName}" در تهران است، رد شد`);
          skipped++;
          continue;
        }

        // پیدا کردن مسئول
        let responsiblePersonnelId = null;
        if (responsible) {
          const responsibleLower = responsible.toLowerCase();
          const personnel = personnelMap.get(responsibleLower);
          if (personnel) {
            responsiblePersonnelId = parseInt(personnel.id);
          } else {
            console.log(`⚠️  ردیف ${i + 2}: مسئول "${responsible}" یافت نشد`);
          }
        }

        // پردازش برچسب‌ها
        let tagsArray = [];
        if (tags) {
          // اگر برچسب‌ها با کاما جدا شده‌اند
          tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
          // تبدیل به فرمت استاندارد
          tagsArray = tagsArray.map(tag => {
            const tagLower = tag.toLowerCase();
            if (tagLower.includes('سرنخ') || tagLower === 'lead') return 'lead';
            if (tagLower.includes('فرصت') || tagLower === 'opportunity') return 'opportunity';
            if (tagLower.includes('مشتری') && tagLower.includes('قدیم')) return 'old_customer';
            if (tagLower.includes('مشتری') || tagLower === 'customer') return 'customer';
            return tagLower;
          });
        }

        // تعیین type بر اساس برچسب یا پیش‌فرض
        let centerType = 'lead';
        if (tagsArray.length > 0) {
          // اگر برچسب lead, opportunity, customer, old_customer دارد، از آن استفاده کن
          const typeTags = tagsArray.filter(t => ['lead', 'opportunity', 'customer', 'old_customer'].includes(t));
          if (typeTags.length > 0) {
            centerType = typeTags[0]; // اولین برچسب نوع را به عنوان type استفاده می‌کنیم
          }
        }

        // ایجاد مرکز
        const center = Center.create({
          name: centerName,
          address: null,
          city: province || city || null,
          district: null,
          type: centerType,
          responsiblePersonnelId: responsiblePersonnelId,
          tags: tagsArray.length > 0 ? tagsArray : null,
          isActive: true
        });

        // اضافه کردن به لیست مراکز موجود
        existingCenterNames.add(centerNameLower);

        imported++;
        console.log(`✅ ردیف ${i + 2}: مرکز "${centerName}" اضافه شد (${province || 'بدون استان'})`);

      } catch (error) {
        errors++;
        const errorMsg = `❌ ردیف ${i + 2}: خطا - ${error.message}`;
        errorsList.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 خلاصه import:');
    console.log(`✅ اضافه شده: ${imported}`);
    console.log(`⏭️  رد شده (تکراری یا تهران): ${skipped}`);
    console.log(`❌ خطا: ${errors}`);

    if (errorsList.length > 0) {
      console.log('\n❌ لیست خطاها:');
      errorsList.forEach(err => console.log(`   ${err}`));
    }

    console.log('\n✅ Import با موفقیت انجام شد!');

  } catch (error) {
    console.error('\n❌ خطا در import:', error);
    process.exit(1);
  }
}

importProvinceCenters();

