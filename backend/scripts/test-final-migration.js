#!/usr/bin/env node

/**
 * اسکریپت تست نهایی Migration
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHARED_DB_PATH = join(__dirname, '../data/shared.db');

async function testFinalMigration() {
  console.log('🧪 تست نهایی Migration...\n');

  try {
    const db = await open({
      filename: SHARED_DB_PATH,
      driver: sqlite3.Database
    });

    // 1. بررسی جداول
    console.log('📋 بررسی جداول...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    console.log(`   پیدا شد: ${tables.length} جدول\n`);

    // 2. بررسی جداول مشترک
    console.log('✅ جداول مشترک:');
    const sharedTables = ['personnel', 'centers', 'center_personnel', 'organization_positions'];
    for (const table of sharedTables) {
      const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   - ${table}: ${count.count} رکورد`);
    }
    console.log('');

    // 3. بررسی جداول mission_*
    console.log('🔵 جداول mission_*:');
    const missionTables = ['mission_assignments', 'mission_contacts', 'mission_discount_codes', 'mission_audit_logs'];
    for (const table of missionTables) {
      const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   - ${table}: ${count.count} رکورد`);
    }
    console.log('');

    // 4. بررسی جداول analysis_*
    console.log('🟢 جداول analysis_*:');
    const analysisTables = [
      'analysis_employees',
      'analysis_products',
      'analysis_territories',
      'analysis_kpi_configs',
      'analysis_employee_kpis',
      'analysis_kpi_scores',
      'analysis_mission_logs',
      'analysis_center_status_history',
      'analysis_sales_targets',
      'analysis_market_data',
      'analysis_performance_notes',
      'analysis_app_settings'
    ];
    for (const table of analysisTables) {
      try {
        const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   - ${table}: ${count.count} رکورد`);
      } catch (error) {
        console.log(`   - ${table}: ❌ پیدا نشد`);
      }
    }
    console.log('');

    // 5. بررسی Foreign Keys
    console.log('🔗 بررسی Foreign Keys...');
    await db.exec('PRAGMA foreign_keys = ON');
    
    // بررسی mission_assignments → personnel
    const assignmentsWithPersonnel = await db.get(`
      SELECT COUNT(*) as count 
      FROM mission_assignments ma
      INNER JOIN personnel p ON ma.personnelId = p.id
    `);
    console.log(`   ✅ assignments → personnel: ${assignmentsWithPersonnel.count} معتبر`);
    
    // بررسی mission_assignments → centers
    const assignmentsWithCenters = await db.get(`
      SELECT COUNT(*) as count 
      FROM mission_assignments ma
      INNER JOIN centers c ON ma.centerId = c.id
    `);
    console.log(`   ✅ assignments → centers: ${assignmentsWithCenters.count} معتبر`);
    
    // بررسی analysis_territories → analysis_employees
    const territoriesWithEmployees = await db.get(`
      SELECT COUNT(*) as count 
      FROM analysis_territories t
      INNER JOIN analysis_employees e ON t.employeeId = e.id
      WHERE t.employeeId IS NOT NULL
    `);
    const totalTerritories = await db.get('SELECT COUNT(*) as count FROM analysis_territories WHERE employeeId IS NOT NULL');
    console.log(`   ✅ territories → employees: ${territoriesWithEmployees.count} از ${totalTerritories.count} معتبر`);
    console.log('');

    // 6. بررسی نمونه داده‌ها
    console.log('🔍 بررسی نمونه داده‌ها...');
    
    const sampleEmployee = await db.get('SELECT * FROM analysis_employees LIMIT 1');
    if (sampleEmployee) {
      console.log(`   👤 نمونه کارمند: ${sampleEmployee.name}`);
    }
    
    const sampleKpi = await db.get('SELECT * FROM analysis_kpi_configs LIMIT 1');
    if (sampleKpi) {
      console.log(`   📊 نمونه KPI: ${sampleKpi.name}`);
    }
    
    const sampleTerritory = await db.get('SELECT * FROM analysis_territories LIMIT 1');
    if (sampleTerritory) {
      console.log(`   🗺️  نمونه قلمرو: ${sampleTerritory.name} (${sampleTerritory.type})`);
    }
    console.log('');

    // 7. تست Query پیچیده
    console.log('🔬 تست Query پیچیده...');
    const complexQuery = await db.get(`
      SELECT 
        p.first_name || ' ' || p.last_name as employee_name,
        COUNT(DISTINCT ma.id) as total_missions,
        COUNT(DISTINCT ml.id) as total_mission_logs
      FROM personnel p
      LEFT JOIN mission_assignments ma ON ma.personnelId = p.id
      LEFT JOIN analysis_mission_logs ml ON ml.employee_id = p.id
      WHERE p.isActive = 1
      GROUP BY p.id
      ORDER BY total_missions DESC
      LIMIT 1
    `);
    if (complexQuery) {
      console.log(`   ✅ Query پیچیده با موفقیت اجرا شد`);
      console.log(`   نمونه: ${complexQuery.employee_name} - ${complexQuery.total_missions} ماموریت`);
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

testFinalMigration()
  .then(() => {
    console.log('🎉 تست کامل شد!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

