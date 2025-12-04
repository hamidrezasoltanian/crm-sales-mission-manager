#!/usr/bin/env node

/**
 * اسکریپت Migration داده‌های دیتابیس مدیریت ماموریت (sql.js) به دیتابیس مشترک (sqlite3)
 */

import initSqlJs from 'sql.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MISSION_DB_PATH = join(__dirname, '../data/missions.db');
const SHARED_DB_PATH = join(__dirname, '../data/shared.db');

async function migrateMissionData() {
  console.log('🚀 شروع Migration داده‌های مدیریت ماموریت...\n');

  try {
    // 1. بارگذاری دیتابیس sql.js
    if (!existsSync(MISSION_DB_PATH)) {
      console.error('❌ دیتابیس مدیریت ماموریت پیدا نشد:', MISSION_DB_PATH);
      process.exit(1);
    }

    console.log('📂 بارگذاری دیتابیس sql.js...');
    const SQL = await initSqlJs();
    const buffer = readFileSync(MISSION_DB_PATH);
    const missionDb = new SQL.Database(buffer);
    console.log('✅ دیتابیس sql.js بارگذاری شد');
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

    // 3. Migration جدول personnel
    console.log('👥 Migration جدول personnel...');
    try {
      const personnelResult = missionDb.exec('SELECT * FROM personnel');
      if (personnelResult.length > 0 && personnelResult[0].values.length > 0) {
        const columns = personnelResult[0].columns;
        const rows = personnelResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} کارمند`);
        
        let inserted = 0;
        let skipped = 0;
        
        for (const row of rows) {
          const personnel = {};
          columns.forEach((col, index) => {
            personnel[col] = row[index];
          });
          
          try {
            // تقسیم name به first_name و last_name
            let firstName = '';
            let lastName = '';
            if (personnel.name) {
              const nameParts = personnel.name.trim().split(/\s+/);
              if (nameParts.length > 0) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ') || '';
              }
            }
            
            await sharedDb.run(`
              INSERT OR IGNORE INTO personnel (
                id, first_name, last_name, phone, telegramId, role, isActive, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              personnel.id,
              firstName,
              lastName,
              personnel.phone || '',
              personnel.telegramId || null,
              personnel.role || 'staff',
              personnel.isActive !== undefined ? personnel.isActive : 1,
              personnel.createdAt || new Date().toISOString(),
              personnel.updatedAt || new Date().toISOString()
            ]);
            
            // بررسی اینکه آیا insert انجام شد یا نه
            const check = await sharedDb.get('SELECT id FROM personnel WHERE id = ?', [personnel.id]);
            if (check) {
              inserted++;
            } else {
              skipped++;
            }
          } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
              skipped++;
            } else {
              console.error(`   ❌ خطا در migration کارمند ${personnel.name}:`, error.message);
            }
          }
        }
        
        console.log(`✅ ${inserted} کارمند جدید اضافه شد`);
        if (skipped > 0) {
          console.log(`   ⚠️  ${skipped} کارمند قبلاً وجود داشت (skip شد)`);
        }
      } else {
        console.log('   ⚠️  هیچ کارمندی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration personnel:', error.message);
    }
    console.log('');

    // 4. Migration جدول centers
    console.log('🏢 Migration جدول centers...');
    try {
      const centersResult = missionDb.exec('SELECT * FROM centers');
      if (centersResult.length > 0 && centersResult[0].values.length > 0) {
        const columns = centersResult[0].columns;
        const rows = centersResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} مرکز`);
        
        let inserted = 0;
        let skipped = 0;
        
        for (const row of rows) {
          const center = {};
          columns.forEach((col, index) => {
            center[col] = row[index];
          });
          
          try {
            await sharedDb.run(`
              INSERT OR IGNORE INTO centers (
                id, name, address, latitude, longitude, snapLocationId,
                city, district, province, type, responsiblePersonnelId,
                isActive, createdAt, updatedAt, tags
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              center.id,
              center.name || '',
              center.address || null,
              center.latitude || null,
              center.longitude || null,
              center.snapLocationId || null,
              center.city || null,
              center.district || null,
              center.province || null,
              center.type || 'lead',
              center.responsiblePersonnelId || null,
              center.isActive !== undefined ? center.isActive : 1,
              center.createdAt || new Date().toISOString(),
              center.updatedAt || new Date().toISOString(),
              center.tags || null
            ]);
            
            const check = await sharedDb.get('SELECT id FROM centers WHERE id = ?', [center.id]);
            if (check) {
              inserted++;
            } else {
              skipped++;
            }
          } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
              skipped++;
            } else {
              console.error(`   ❌ خطا در migration مرکز ${center.name}:`, error.message);
            }
          }
        }
        
        console.log(`✅ ${inserted} مرکز جدید اضافه شد`);
        if (skipped > 0) {
          console.log(`   ⚠️  ${skipped} مرکز قبلاً وجود داشت (skip شد)`);
        }
      } else {
        console.log('   ⚠️  هیچ مرکزی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration centers:', error.message);
    }
    console.log('');

    // 5. ایجاد جداول mission_* در دیتابیس مشترک
    console.log('📋 ایجاد جداول mission_* در دیتابیس مشترک...');
    
    // جدول mission_assignments
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS mission_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnelId INTEGER NOT NULL,
        centerId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled')),
        managerId INTEGER,
        approvedAt TEXT,
        completedAt TEXT,
        snapLocationLatitude REAL,
        snapLocationLongitude REAL,
        snapLocationAddress TEXT,
        snapCost REAL,
        discountCode TEXT,
        discountCodeId INTEGER,
        discountAmount REAL DEFAULT 0,
        totalCost REAL,
        personalPayment REAL DEFAULT 0,
        notes TEXT,
        centerNotes TEXT,
        managerComment TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (personnelId) REFERENCES personnel(id),
        FOREIGN KEY (centerId) REFERENCES centers(id),
        FOREIGN KEY (managerId) REFERENCES personnel(id)
      )
    `);
    
    // جدول mission_contacts
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS mission_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnelId INTEGER NOT NULL,
        centerId INTEGER NOT NULL,
        contactType TEXT NOT NULL DEFAULT 'province' CHECK(contactType IN ('province', 'tehran')),
        notes TEXT,
        tags TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (personnelId) REFERENCES personnel(id),
        FOREIGN KEY (centerId) REFERENCES centers(id)
      )
    `);
    
    // جدول mission_discount_codes
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS mission_discount_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discountType TEXT NOT NULL CHECK(discountType IN ('percentage', 'fixed')),
        discountValue REAL NOT NULL,
        maxUses INTEGER,
        currentUses INTEGER DEFAULT 0,
        validFrom TEXT,
        validUntil TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // جدول mission_audit_logs
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS mission_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        action TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId INTEGER,
        details TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES personnel(id)
      )
    `);
    
    console.log('✅ جداول mission_* ایجاد شدند');
    console.log('');

    // 6. Migration داده‌های assignments
    console.log('📝 Migration جدول assignments...');
    try {
      const assignmentsResult = missionDb.exec('SELECT * FROM assignments');
      if (assignmentsResult.length > 0 && assignmentsResult[0].values.length > 0) {
        const columns = assignmentsResult[0].columns;
        const rows = assignmentsResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} ماموریت`);
        
        let inserted = 0;
        
        for (const row of rows) {
          const assignment = {};
          columns.forEach((col, index) => {
            assignment[col] = row[index];
          });
          
          try {
            await sharedDb.run(`
              INSERT INTO mission_assignments (
                id, personnelId, centerId, status, managerId,
                approvedAt, completedAt, snapLocationLatitude, snapLocationLongitude,
                snapLocationAddress, snapCost, discountCode, discountCodeId,
                discountAmount, totalCost, personalPayment, notes, centerNotes,
                managerComment, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              assignment.id,
              assignment.personnelId,
              assignment.centerId,
              assignment.status || 'pending',
              assignment.managerId || null,
              assignment.approvedAt || null,
              assignment.completedAt || null,
              assignment.snapLocationLatitude || null,
              assignment.snapLocationLongitude || null,
              assignment.snapLocationAddress || null,
              assignment.snapCost || null,
              assignment.discountCode || null,
              assignment.discountCodeId || null,
              assignment.discountAmount || 0,
              assignment.totalCost || null,
              assignment.personalPayment || 0,
              assignment.notes || null,
              assignment.centerNotes || null,
              assignment.managerComment || null,
              assignment.createdAt || new Date().toISOString(),
              assignment.updatedAt || new Date().toISOString()
            ]);
            inserted++;
          } catch (error) {
            console.error(`   ❌ خطا در migration ماموریت ${assignment.id}:`, error.message);
          }
        }
        
        console.log(`✅ ${inserted} ماموریت migrate شد`);
      } else {
        console.log('   ⚠️  هیچ ماموریتی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration assignments:', error.message);
    }
    console.log('');

    // 7. Migration داده‌های contacts
    console.log('📞 Migration جدول contacts...');
    try {
      const contactsResult = missionDb.exec('SELECT * FROM contacts');
      if (contactsResult.length > 0 && contactsResult[0].values.length > 0) {
        const columns = contactsResult[0].columns;
        const rows = contactsResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} تماس`);
        
        let inserted = 0;
        
        for (const row of rows) {
          const contact = {};
          columns.forEach((col, index) => {
            contact[col] = row[index];
          });
          
          try {
            await sharedDb.run(`
              INSERT INTO mission_contacts (
                id, personnelId, centerId, contactType, notes, tags, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              contact.id,
              contact.personnelId,
              contact.centerId,
              contact.contactType || 'province',
              contact.notes || null,
              contact.tags || null,
              contact.createdAt || new Date().toISOString(),
              contact.updatedAt || new Date().toISOString()
            ]);
            inserted++;
          } catch (error) {
            console.error(`   ❌ خطا در migration تماس ${contact.id}:`, error.message);
          }
        }
        
        console.log(`✅ ${inserted} تماس migrate شد`);
      } else {
        console.log('   ⚠️  هیچ تماسی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration contacts:', error.message);
    }
    console.log('');

    // 8. Migration داده‌های discount_codes
    console.log('🎟️  Migration جدول discount_codes...');
    try {
      const discountCodesResult = missionDb.exec('SELECT * FROM discount_codes');
      if (discountCodesResult.length > 0 && discountCodesResult[0].values.length > 0) {
        const columns = discountCodesResult[0].columns;
        const rows = discountCodesResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} کد تخفیف`);
        
        let inserted = 0;
        
        for (const row of rows) {
          const discountCode = {};
          columns.forEach((col, index) => {
            discountCode[col] = row[index];
          });
          
          try {
            await sharedDb.run(`
              INSERT INTO mission_discount_codes (
                id, code, discountType, discountValue, maxUses, currentUses,
                validFrom, validUntil, isActive, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              discountCode.id,
              discountCode.code,
              discountCode.discountType,
              discountCode.discountValue,
              discountCode.maxUses || null,
              discountCode.currentUses || 0,
              discountCode.validFrom || null,
              discountCode.validUntil || null,
              discountCode.isActive !== undefined ? discountCode.isActive : 1,
              discountCode.createdAt || new Date().toISOString(),
              discountCode.updatedAt || new Date().toISOString()
            ]);
            inserted++;
          } catch (error) {
            console.error(`   ❌ خطا در migration کد تخفیف ${discountCode.code}:`, error.message);
          }
        }
        
        console.log(`✅ ${inserted} کد تخفیف migrate شد`);
      } else {
        console.log('   ⚠️  هیچ کد تخفیفی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration discount_codes:', error.message);
    }
    console.log('');

    // 9. Migration داده‌های audit_logs
    console.log('📋 Migration جدول audit_logs...');
    try {
      const auditLogsResult = missionDb.exec('SELECT * FROM audit_logs');
      if (auditLogsResult.length > 0 && auditLogsResult[0].values.length > 0) {
        const columns = auditLogsResult[0].columns;
        const rows = auditLogsResult[0].values;
        
        console.log(`   پیدا شد: ${rows.length} لاگ`);
        
        let inserted = 0;
        
        for (const row of rows) {
          const auditLog = {};
          columns.forEach((col, index) => {
            auditLog[col] = row[index];
          });
          
          try {
            await sharedDb.run(`
              INSERT INTO mission_audit_logs (
                id, userId, action, entityType, entityId, details, createdAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              auditLog.id,
              auditLog.userId || null,
              auditLog.action,
              auditLog.entityType,
              auditLog.entityId || null,
              auditLog.details || null,
              auditLog.createdAt || new Date().toISOString()
            ]);
            inserted++;
          } catch (error) {
            console.error(`   ❌ خطا در migration لاگ ${auditLog.id}:`, error.message);
          }
        }
        
        console.log(`✅ ${inserted} لاگ migrate شد`);
      } else {
        console.log('   ⚠️  هیچ لاگی پیدا نشد');
      }
    } catch (error) {
      console.error('   ❌ خطا در migration audit_logs:', error.message);
    }
    console.log('');

    // 10. فعال کردن Foreign Keys بعد از migration
    await sharedDb.exec('PRAGMA foreign_keys = ON');
    
    // 11. بستن دیتابیس‌ها
    missionDb.close();
    await sharedDb.close();

    console.log('✅ Migration داده‌های مدیریت ماموریت با موفقیت انجام شد!');
    console.log('');

  } catch (error) {
    console.error('❌ خطا در Migration:', error);
    throw error;
  }
}

// اجرای Migration
migrateMissionData()
  .then(() => {
    console.log('🎉 تمام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

