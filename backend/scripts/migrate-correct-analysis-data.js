#!/usr/bin/env node

/**
 * اسکریپت Migration داده‌های صحیح از اپلیکیشن آنالیز فروش و KPI
 * این اسکریپت جداول analysis_* اشتباه را حذف می‌کند و داده‌های صحیح را اضافه می‌کند
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CORRECT_ANALYSIS_DB_PATH = '/home/hamidreza/Downloads/Sales-Analysis-Dashboard-main/database/sales_dashboard.db';
const SHARED_DB_PATH = join(__dirname, '../data/shared.db');

async function migrateCorrectAnalysisData() {
  console.log('🚀 شروع Migration داده‌های صحیح از اپلیکیشن آنالیز فروش و KPI...\n');

  try {
    // 1. باز کردن دیتابیس صحیح آنالیز فروش
    console.log('📂 باز کردن دیتابیس صحیح آنالیز فروش...');
    const analysisDb = await open({
      filename: CORRECT_ANALYSIS_DB_PATH,
      driver: sqlite3.Database
    });
    console.log('✅ دیتابیس آنالیز فروش باز شد');
    console.log('');

    // 2. باز کردن دیتابیس مشترک
    console.log('📂 باز کردن دیتابیس مشترک...');
    const sharedDb = await open({
      filename: SHARED_DB_PATH,
      driver: sqlite3.Database
    });
    await sharedDb.exec('PRAGMA foreign_keys = OFF'); // موقتاً خاموش می‌کنیم برای migration
    console.log('✅ دیتابیس مشترک باز شد');
    console.log('');

    // 3. حذف جداول analysis_* اشتباه
    console.log('🗑️  حذف جداول analysis_* اشتباه...');
    const wrongTables = [
      'analysis_products',
      'analysis_orders',
      'analysis_order_items',
      'analysis_proformas',
      'analysis_proforma_items',
      'analysis_workflows',
      'analysis_workflow_steps',
      'analysis_workflow_fields',
      'analysis_activities',
      'analysis_settings',
      'analysis_file_attachments',
      'analysis_kpi_configs', // حذف برای ایجاد مجدد با فیلدهای صحیح
      'analysis_territories' // حذف برای ایجاد مجدد با ساختار صحیح
    ];
    
    for (const table of wrongTables) {
      try {
        await sharedDb.exec(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   ✅ ${table} حذف شد`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: ${error.message}`);
      }
    }
    console.log('');

    // 4. بررسی جداول موجود در دیتابیس صحیح
    console.log('📋 بررسی جداول موجود در دیتابیس صحیح...');
    const tables = await analysisDb.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    console.log(`   پیدا شد: ${tables.length} جدول`);
    tables.forEach(t => console.log(`   - ${t.name}`));
    console.log('');

    // 5. ایجاد جداول analysis_* صحیح
    console.log('📋 ایجاد جداول analysis_* صحیح...');
    
    // جدول analysis_employees
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        department TEXT,
        position TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // جدول analysis_products
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        description TEXT,
        category TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // جدول analysis_territories
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_territories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('province', 'city', 'center')),
        parentId TEXT,
        employeeId INTEGER,
        isActive INTEGER DEFAULT 1,
        tags TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES analysis_employees(id)
      )
    `);
    
    // جدول analysis_kpi_configs
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_kpi_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT,
        calculationMethod TEXT,
        formula TEXT,
        maxPoints INTEGER,
        tags TEXT DEFAULT '[]',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // جدول analysis_employee_kpis
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_employee_kpis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        kpiConfigId TEXT NOT NULL,
        targetValue REAL,
        weight REAL DEFAULT 1.0,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES analysis_employees(id),
        FOREIGN KEY (kpiConfigId) REFERENCES analysis_kpi_configs(id)
      )
    `);
    
    // جدول analysis_kpi_scores
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_kpi_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        kpiConfigId TEXT NOT NULL,
        period TEXT NOT NULL,
        score REAL NOT NULL,
        actualValue REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES analysis_employees(id),
        FOREIGN KEY (kpiConfigId) REFERENCES analysis_kpi_configs(id)
      )
    `);
    
    // جدول analysis_mission_logs
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_mission_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        center_id INTEGER NOT NULL,
        mission_date TEXT NOT NULL,
        mission_type TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES personnel(id),
        FOREIGN KEY (center_id) REFERENCES centers(id)
      )
    `);
    
    // جدول analysis_center_status_history
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_center_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        center_id INTEGER NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (center_id) REFERENCES centers(id),
        FOREIGN KEY (changed_by) REFERENCES personnel(id)
      )
    `);
    
    // جدول analysis_sales_targets
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_sales_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER,
        productId INTEGER,
        territoryId INTEGER,
        period TEXT NOT NULL,
        targetValue REAL NOT NULL,
        actualValue REAL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES analysis_employees(id),
        FOREIGN KEY (productId) REFERENCES analysis_products(id),
        FOREIGN KEY (territoryId) REFERENCES analysis_territories(id)
      )
    `);
    
    // جدول analysis_market_data
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_market_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        territoryId INTEGER,
        period TEXT NOT NULL,
        marketShare REAL,
        salesVolume REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES analysis_products(id),
        FOREIGN KEY (territoryId) REFERENCES analysis_territories(id)
      )
    `);
    
    // جدول analysis_performance_notes
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_performance_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        period TEXT NOT NULL,
        note TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employeeId) REFERENCES analysis_employees(id)
      )
    `);
    
    // جدول analysis_app_settings
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ جداول analysis_* صحیح ایجاد شدند');
    console.log('');

    // 6. Migration داده‌های employees
    console.log('👥 Migration جدول employees...');
    try {
      const employees = await analysisDb.all('SELECT * FROM employees');
      console.log(`   پیدا شد: ${employees.length} کارمند`);
      
      let inserted = 0;
      for (const employee of employees) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_employees (
              id, name, email, phone, department, position, isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            employee.id,
            employee.name || '',
            employee.email || null,
            employee.phone || null,
            employee.department || null,
            employee.position || null,
            employee.isActive !== undefined ? employee.isActive : 1,
            employee.createdAt || new Date().toISOString(),
            employee.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration کارمند ${employee.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} کارمند migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration employees:', error.message);
    }
    console.log('');

    // 7. Migration داده‌های products
    console.log('📦 Migration جدول products...');
    try {
      const products = await analysisDb.all('SELECT * FROM products');
      console.log(`   پیدا شد: ${products.length} محصول`);
      
      let inserted = 0;
      for (const product of products) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_products (
              id, name, code, description, category, isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            product.id,
            product.name || '',
            product.code || null,
            product.description || null,
            product.category || null,
            product.isActive !== undefined ? product.isActive : 1,
            product.createdAt || new Date().toISOString(),
            product.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration محصول ${product.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} محصول migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration products:', error.message);
    }
    console.log('');

    // 8. Migration داده‌های territories
    console.log('🗺️  Migration جدول territories...');
    try {
      const territories = await analysisDb.all('SELECT * FROM territories');
      console.log(`   پیدا شد: ${territories.length} قلمرو`);
      
      let inserted = 0;
      for (const territory of territories) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_territories (
              id, name, type, parentId, employeeId, isActive, tags, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            String(territory.id), // تبدیل به string
            territory.name || '',
            territory.type || null,
            territory.parentId ? String(territory.parentId) : null,
            territory.assigned_to_employee_id || null,
            territory.is_active !== undefined ? (territory.is_active ? 1 : 0) : 1,
            territory.tags || '[]',
            territory.created_at || new Date().toISOString(),
            territory.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration قلمرو ${territory.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} قلمرو migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration territories:', error.message);
    }
    console.log('');

    // 9. Migration داده‌های kpi_configs
    console.log('📊 Migration جدول kpi_configs...');
    try {
      const kpiConfigs = await analysisDb.all('SELECT * FROM kpi_configs');
      console.log(`   پیدا شد: ${kpiConfigs.length} تنظیمات KPI`);
      
      let inserted = 0;
      for (const config of kpiConfigs) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_kpi_configs (
              id, name, description, unit, calculationMethod, formula, maxPoints, tags, isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            String(config.id), // تبدیل به string
            config.name || '',
            config.description || null,
            config.unit || null,
            config.calculation_method || config.calculationMethod || null,
            config.formula || null,
            config.max_points || config.maxPoints || null,
            config.tags || '[]',
            config.is_active !== undefined ? (config.is_active ? 1 : 0) : 1,
            config.created_at || config.createdAt || new Date().toISOString(),
            config.updated_at || config.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration KPI ${config.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} تنظیمات KPI migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration kpi_configs:', error.message);
    }
    console.log('');

    // 10. Migration داده‌های employee_kpis
    console.log('👤 Migration جدول employee_kpis...');
    try {
      const employeeKpis = await analysisDb.all('SELECT * FROM employee_kpis');
      console.log(`   پیدا شد: ${employeeKpis.length} KPI کارمند`);
      
      let inserted = 0;
      for (const ekpi of employeeKpis) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_employee_kpis (
              id, employeeId, kpiConfigId, targetValue, weight, isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            ekpi.id,
            ekpi.employee_id || ekpi.employeeId,
            String(ekpi.kpi_config_id || ekpi.kpiConfigId), // تبدیل به string
            ekpi.target_value || ekpi.targetValue || null,
            ekpi.weight || 1.0,
            ekpi.is_active !== undefined ? (ekpi.is_active ? 1 : 0) : (ekpi.isActive !== undefined ? ekpi.isActive : 1),
            ekpi.created_at || ekpi.createdAt || new Date().toISOString(),
            ekpi.updated_at || ekpi.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration KPI کارمند ${ekpi.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} KPI کارمند migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration employee_kpis:', error.message);
    }
    console.log('');

    // 11. Migration داده‌های kpi_scores
    console.log('📈 Migration جدول kpi_scores...');
    try {
      const kpiScores = await analysisDb.all(`
        SELECT 
          ks.*,
          ek.employee_id,
          ek.kpi_config_id
        FROM kpi_scores ks
        LEFT JOIN employee_kpis ek ON ks.employee_kpi_id = ek.id
      `);
      console.log(`   پیدا شد: ${kpiScores.length} امتیاز KPI`);
      
      let inserted = 0;
      for (const score of kpiScores) {
        try {
          // محاسبه score از actual_value و target_value
          let calculatedScore = score.score || 0;
          if (!calculatedScore && score.actual_value && score.target_value) {
            // اگر score وجود ندارد، از actual_value و target_value محاسبه می‌کنیم
            calculatedScore = (score.actual_value / score.target_value) * 100;
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_kpi_scores (
              id, employeeId, kpiConfigId, period, score, actualValue, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            score.id,
            score.employee_id || score.employeeId,
            String(score.kpi_config_id || score.kpiConfigId), // تبدیل به string
            score.period || '',
            calculatedScore,
            score.actual_value || score.actualValue || null,
            score.created_at || score.createdAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration امتیاز ${score.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} امتیاز KPI migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration kpi_scores:', error.message);
    }
    console.log('');

    // 12. Migration داده‌های mission_logs
    console.log('📝 Migration جدول mission_logs...');
    try {
      const missionLogs = await analysisDb.all('SELECT * FROM mission_logs');
      console.log(`   پیدا شد: ${missionLogs.length} لاگ ماموریت`);
      
      let inserted = 0;
      for (const log of missionLogs) {
        try {
          // تبدیل employee_id به personnel.id اگر ممکن باشد
          let personnelId = null;
          if (log.employee_id) {
            const personnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE id = ? LIMIT 1',
              [log.employee_id]
            );
            if (personnel) {
              personnelId = personnel.id;
            } else {
              // تلاش برای پیدا کردن از طریق analysis_employees
              const employee = await sharedDb.get(
                'SELECT id FROM analysis_employees WHERE id = ? LIMIT 1',
                [log.employee_id]
              );
              if (employee) {
                // اگر employee در analysis_employees است، باید به personnel map کنیم
                // برای حالا null می‌گذاریم
                personnelId = null;
              }
            }
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_mission_logs (
              id, employee_id, center_id, mission_date, mission_type, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            log.id,
            personnelId,
            log.center_id || null,
            log.mission_date || new Date().toISOString(),
            log.mission_type || null,
            log.notes || null,
            log.createdAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration لاگ ${log.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} لاگ ماموریت migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration mission_logs:', error.message);
    }
    console.log('');

    // 13. Migration داده‌های center_status_history
    console.log('🔄 Migration جدول center_status_history...');
    try {
      const statusHistory = await analysisDb.all('SELECT * FROM center_status_history');
      console.log(`   پیدا شد: ${statusHistory.length} تاریخچه وضعیت`);
      
      let inserted = 0;
      for (const history of statusHistory) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_center_status_history (
              id, center_id, old_status, new_status, changed_by, changed_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            history.id,
            history.center_id,
            history.old_status || null,
            history.new_status || '',
            history.changed_by || null,
            history.changed_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration تاریخچه ${history.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} تاریخچه وضعیت migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration center_status_history:', error.message);
    }
    console.log('');

    // 14. Migration داده‌های sales_targets
    console.log('🎯 Migration جدول sales_targets...');
    try {
      const salesTargets = await analysisDb.all('SELECT * FROM sales_targets');
      console.log(`   پیدا شد: ${salesTargets.length} هدف فروش`);
      
      let inserted = 0;
      for (const target of salesTargets) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_sales_targets (
              id, employeeId, productId, territoryId, period, targetValue, actualValue, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            target.id,
            target.employeeId || null,
            target.productId || null,
            target.territoryId || null,
            target.period || '',
            target.targetValue || 0,
            target.actualValue || 0,
            target.createdAt || new Date().toISOString(),
            target.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration هدف ${target.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} هدف فروش migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration sales_targets:', error.message);
    }
    console.log('');

    // 15. Migration داده‌های market_data
    console.log('📊 Migration جدول market_data...');
    try {
      const marketData = await analysisDb.all('SELECT * FROM market_data');
      console.log(`   پیدا شد: ${marketData.length} داده بازار`);
      
      let inserted = 0;
      for (const data of marketData) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_market_data (
              id, productId, territoryId, period, marketShare, salesVolume, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            data.id,
            data.productId || null,
            data.territoryId || null,
            data.period || '',
            data.marketShare || null,
            data.salesVolume || null,
            data.createdAt || new Date().toISOString(),
            data.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration داده ${data.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} داده بازار migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration market_data:', error.message);
    }
    console.log('');

    // 16. Migration داده‌های performance_notes
    console.log('📝 Migration جدول performance_notes...');
    try {
      const notes = await analysisDb.all('SELECT * FROM performance_notes');
      console.log(`   پیدا شد: ${notes.length} یادداشت عملکرد`);
      
      let inserted = 0;
      for (const note of notes) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_performance_notes (
              id, employeeId, period, note, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            note.id,
            note.employeeId,
            note.period || '',
            note.note || '',
            note.createdAt || new Date().toISOString(),
            note.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration یادداشت ${note.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} یادداشت عملکرد migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration performance_notes:', error.message);
    }
    console.log('');

    // 17. Migration داده‌های app_settings
    console.log('⚙️  Migration جدول app_settings...');
    try {
      const settings = await analysisDb.all('SELECT * FROM app_settings');
      console.log(`   پیدا شد: ${settings.length} تنظیمات`);
      
      let inserted = 0;
      for (const setting of settings) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_app_settings (
              id, key, value, description, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            setting.id,
            setting.key || '',
            setting.value || '',
            setting.description || null,
            setting.createdAt || new Date().toISOString(),
            setting.updatedAt || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration تنظیمات ${setting.key}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} تنظیمات migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration app_settings:', error.message);
    }
    console.log('');

    // 18. فعال کردن Foreign Keys بعد از migration
    await sharedDb.exec('PRAGMA foreign_keys = ON');

    // 19. بستن دیتابیس‌ها
    await analysisDb.close();
    await sharedDb.close();

    console.log('✅ Migration داده‌های صحیح با موفقیت انجام شد!');
    console.log('');

  } catch (error) {
    console.error('❌ خطا در Migration:', error);
    throw error;
  }
}

migrateCorrectAnalysisData()
  .then(() => {
    console.log('🎉 تمام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

