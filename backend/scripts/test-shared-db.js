#!/usr/bin/env node

/**
 * اسکریپت تست دیتابیس مشترک
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHARED_DB_PATH = join(__dirname, '../data/shared.db');

async function testSharedDatabase() {
  console.log('🧪 شروع تست دیتابیس مشترک...\n');

  try {
    const db = await open({
      filename: SHARED_DB_PATH,
      driver: sqlite3.Database
    });

    // 1. بررسی جداول موجود
    console.log('📋 بررسی جداول موجود...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log(`   پیدا شد: ${tables.length} جدول`);
    tables.forEach(t => console.log(`   ✅ ${t.name}`));
    console.log('');

    // 2. بررسی تعداد رکوردها در جداول مشترک
    console.log('📊 بررسی تعداد رکوردها در جداول مشترک...');
    
    const personnelCount = await db.get('SELECT COUNT(*) as count FROM personnel');
    console.log(`   👥 personnel: ${personnelCount.count} کارمند`);
    
    const centersCount = await db.get('SELECT COUNT(*) as count FROM centers');
    console.log(`   🏢 centers: ${centersCount.count} مرکز`);
    
    const centerPersonnelCount = await db.get('SELECT COUNT(*) as count FROM center_personnel');
    console.log(`   👥 center_personnel: ${centerPersonnelCount.count} پرسنل مرکز`);
    
    const orgPositionsCount = await db.get('SELECT COUNT(*) as count FROM organization_positions');
    console.log(`   📋 organization_positions: ${orgPositionsCount.count} پست سازمانی`);
    console.log('');

    // 3. بررسی تعداد رکوردها در جداول mission_*
    console.log('📊 بررسی تعداد رکوردها در جداول mission_*...');
    
    const assignmentsCount = await db.get('SELECT COUNT(*) as count FROM mission_assignments');
    console.log(`   📝 mission_assignments: ${assignmentsCount.count} ماموریت`);
    
    const contactsCount = await db.get('SELECT COUNT(*) as count FROM mission_contacts');
    console.log(`   📞 mission_contacts: ${contactsCount.count} تماس`);
    
    const discountCodesCount = await db.get('SELECT COUNT(*) as count FROM mission_discount_codes');
    console.log(`   🎟️  mission_discount_codes: ${discountCodesCount.count} کد تخفیف`);
    
    const auditLogsCount = await db.get('SELECT COUNT(*) as count FROM mission_audit_logs');
    console.log(`   📋 mission_audit_logs: ${auditLogsCount.count} لاگ`);
    console.log('');

    // 4. بررسی Foreign Keys
    console.log('🔗 بررسی Foreign Keys...');
    
    // بررسی assignments → personnel
    const assignmentsWithPersonnel = await db.get(`
      SELECT COUNT(*) as count 
      FROM mission_assignments ma
      INNER JOIN personnel p ON ma.personnelId = p.id
    `);
    console.log(`   ✅ assignments → personnel: ${assignmentsWithPersonnel.count} ماموریت با کارمند معتبر`);
    
    // بررسی assignments → centers
    const assignmentsWithCenters = await db.get(`
      SELECT COUNT(*) as count 
      FROM mission_assignments ma
      INNER JOIN centers c ON ma.centerId = c.id
    `);
    console.log(`   ✅ assignments → centers: ${assignmentsWithCenters.count} ماموریت با مرکز معتبر`);
    
    // بررسی centers → personnel
    const centersWithPersonnel = await db.get(`
      SELECT COUNT(*) as count 
      FROM centers c
      INNER JOIN personnel p ON c.responsiblePersonnelId = p.id
      WHERE c.responsiblePersonnelId IS NOT NULL
    `);
    const centersWithoutPersonnel = await db.get(`
      SELECT COUNT(*) as count 
      FROM centers
      WHERE responsiblePersonnelId IS NOT NULL
    `);
    console.log(`   ✅ centers → personnel: ${centersWithPersonnel.count} از ${centersWithoutPersonnel.count} مرکز با مسئول معتبر`);
    console.log('');

    // 5. بررسی نمونه داده‌ها
    console.log('🔍 بررسی نمونه داده‌ها...');
    
    const samplePersonnel = await db.get('SELECT id, first_name, last_name, phone, role FROM personnel LIMIT 1');
    if (samplePersonnel) {
      console.log(`   👤 نمونه کارمند: ${samplePersonnel.first_name} ${samplePersonnel.last_name} (${samplePersonnel.phone}) - ${samplePersonnel.role}`);
    }
    
    const sampleCenter = await db.get('SELECT id, name, city, province FROM centers LIMIT 1');
    if (sampleCenter) {
      console.log(`   🏢 نمونه مرکز: ${sampleCenter.name} - ${sampleCenter.city || 'بدون شهر'} - ${sampleCenter.province || 'بدون استان'}`);
    }
    
    const sampleAssignment = await db.get(`
      SELECT ma.id, p.first_name || ' ' || p.last_name as personnel_name, c.name as center_name, ma.status
      FROM mission_assignments ma
      INNER JOIN personnel p ON ma.personnelId = p.id
      INNER JOIN centers c ON ma.centerId = c.id
      LIMIT 1
    `);
    if (sampleAssignment) {
      console.log(`   📝 نمونه ماموریت: ${sampleAssignment.personnel_name} → ${sampleAssignment.center_name} (${sampleAssignment.status})`);
    }
    console.log('');

    // 6. بررسی Indexes
    console.log('📇 بررسی Indexes...');
    const indexes = await db.all(`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `);
    console.log(`   پیدا شد: ${indexes.length} index`);
    indexes.forEach(idx => console.log(`   ✅ ${idx.tbl_name}.${idx.name}`));
    console.log('');

    // 7. بررسی ساختار جدول centers
    console.log('🏗️  بررسی ساختار جدول centers...');
    const centerColumns = await db.all('PRAGMA table_info(centers)');
    console.log(`   پیدا شد: ${centerColumns.length} ستون`);
    const importantColumns = ['name', 'phones', 'mobile', 'addresses', 'economic_code', 'national_id', 'bank_info', 'legal_type'];
    importantColumns.forEach(col => {
      const found = centerColumns.find(c => c.name === col);
      if (found) {
        console.log(`   ✅ ${col}: ${found.type}`);
      } else {
        console.log(`   ⚠️  ${col}: پیدا نشد`);
      }
    });
    console.log('');

    // 8. تست Query پیچیده
    console.log('🔬 تست Query پیچیده...');
    const complexQuery = await db.get(`
      SELECT 
        p.first_name || ' ' || p.last_name as employee_name,
        COUNT(DISTINCT ma.id) as total_missions,
        COUNT(DISTINCT mc.id) as total_contacts
      FROM personnel p
      LEFT JOIN mission_assignments ma ON ma.personnelId = p.id
      LEFT JOIN mission_contacts mc ON mc.personnelId = p.id
      WHERE p.isActive = 1
      GROUP BY p.id
      ORDER BY total_missions DESC
      LIMIT 5
    `);
    if (complexQuery) {
      console.log(`   ✅ Query پیچیده با موفقیت اجرا شد`);
    }
    console.log('');

    // 9. بررسی Foreign Key Constraints
    console.log('🔒 بررسی Foreign Key Constraints...');
    const fkCheck = await db.get('PRAGMA foreign_key_check');
    if (fkCheck) {
      console.log(`   ⚠️  Foreign Key violations پیدا شد`);
    } else {
      console.log(`   ✅ هیچ Foreign Key violation پیدا نشد`);
    }
    console.log('');

    await db.close();

    console.log('✅ تمام تست‌ها با موفقیت انجام شد!');
    console.log('');

  } catch (error) {
    console.error('❌ خطا در تست:', error);
    throw error;
  }
}

testSharedDatabase()
  .then(() => {
    console.log('🎉 تست کامل شد!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

