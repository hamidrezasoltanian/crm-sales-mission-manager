#!/usr/bin/env node

/**
 * اسکریپت Migration داده‌های اپلیکیشن آنالیز فروش به دیتابیس مشترک
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ANALYSIS_DB_PATH = '/home/hamidreza/App/ez-dashboard/database/ez_dashboard.db';
const SHARED_DB_PATH = join(__dirname, '../data/shared.db');

async function migrateAnalysisData() {
  console.log('🚀 شروع Migration داده‌های اپلیکیشن آنالیز فروش...\n');

  try {
    // 1. باز کردن دیتابیس آنالیز فروش
    console.log('📂 باز کردن دیتابیس آنالیز فروش...');
    const analysisDb = await open({
      filename: ANALYSIS_DB_PATH,
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

    // 3. ایجاد جداول analysis_*
    console.log('📋 ایجاد جداول analysis_* در دیتابیس مشترک...');
    
    // جدول analysis_products
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        irc TEXT, -- UNIQUE constraint حذف شد چون برخی محصولات irc یکسان دارند
        description TEXT,
        net_weight REAL,
        gross_weight REAL,
        currency_price REAL NOT NULL,
        currency_type TEXT NOT NULL DEFAULT 'USD',
        manufacturer TEXT,
        category TEXT,
        subcategory TEXT,
        sku TEXT,
        barcode TEXT,
        dimensions TEXT,
        specifications TEXT,
        images TEXT,
        tags TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // جدول analysis_orders
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        priority TEXT DEFAULT 'NORMAL',
        total_amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        notes TEXT,
        workflow_id TEXT,
        assigned_to TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        shipped_at TEXT,
        delivered_at TEXT,
        FOREIGN KEY (assigned_to) REFERENCES personnel(id),
        FOREIGN KEY (created_by) REFERENCES personnel(id)
      )
    `);
    
    // جدول analysis_order_items
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT,
        description TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES analysis_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES analysis_products(id)
      )
    `);
    
    // جدول analysis_proformas
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_proformas (
        id TEXT PRIMARY KEY,
        proforma_number TEXT UNIQUE NOT NULL,
        order_id TEXT,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        subtotal REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        valid_until TEXT,
        notes TEXT,
        terms_conditions TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        sent_at TEXT,
        approved_at TEXT,
        FOREIGN KEY (order_id) REFERENCES analysis_orders(id),
        FOREIGN KEY (created_by) REFERENCES personnel(id)
      )
    `);
    
    // جدول analysis_proforma_items
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_proforma_items (
        id TEXT PRIMARY KEY,
        proforma_id TEXT NOT NULL,
        product_id TEXT,
        description TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proforma_id) REFERENCES analysis_proformas(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES analysis_products(id)
      )
    `);
    
    // جدول analysis_workflows
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        is_active INTEGER DEFAULT 1,
        version INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES personnel(id)
      )
    `);
    
    // جدول analysis_workflow_steps
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        step_order INTEGER NOT NULL,
        is_required INTEGER DEFAULT 1,
        is_parallel INTEGER DEFAULT 0,
        estimated_duration INTEGER,
        assigned_role TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES analysis_workflows(id) ON DELETE CASCADE
      )
    `);
    
    // جدول analysis_workflow_fields
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_workflow_fields (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT NOT NULL,
        is_required INTEGER DEFAULT 0,
        width TEXT DEFAULT 'FULL',
        field_order INTEGER NOT NULL,
        options TEXT,
        validation_rules TEXT,
        placeholder TEXT,
        help_text TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (step_id) REFERENCES analysis_workflow_steps(id) ON DELETE CASCADE
      )
    `);
    
    // جدول analysis_activities
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_activities (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES personnel(id)
      )
    `);
    
    // جدول analysis_settings
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'GENERAL',
        is_public INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // جدول analysis_file_attachments
    await sharedDb.exec(`
      CREATE TABLE IF NOT EXISTS analysis_file_attachments (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        uploaded_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES personnel(id)
      )
    `);
    
    console.log('✅ جداول analysis_* ایجاد شدند');
    console.log('');

    // 4. Migration داده‌های products
    console.log('📦 Migration جدول products...');
    try {
      const products = await analysisDb.all('SELECT * FROM products');
      console.log(`   پیدا شد: ${products.length} محصول`);
      
      let inserted = 0;
      for (const product of products) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_products (
              id, name, code, irc, description, net_weight, gross_weight,
              currency_price, currency_type, manufacturer, category, subcategory,
              sku, barcode, dimensions, specifications, images, tags,
              is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            product.id,
            product.name,
            product.code,
            product.irc || null,
            product.description || null,
            product.net_weight || null,
            product.gross_weight || null,
            product.currency_price,
            product.currency_type || 'USD',
            product.manufacturer || null,
            product.category || null,
            product.subcategory || null,
            product.sku || null,
            product.barcode || null,
            product.dimensions || null,
            product.specifications || null,
            product.images || null,
            product.tags || null,
            product.is_active !== undefined ? product.is_active : 1,
            product.created_at || new Date().toISOString(),
            product.updated_at || new Date().toISOString()
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

    // 5. Migration داده‌های orders
    console.log('📝 Migration جدول orders...');
    try {
      const orders = await analysisDb.all('SELECT * FROM orders');
      console.log(`   پیدا شد: ${orders.length} سفارش`);
      
      let inserted = 0;
      for (const order of orders) {
        try {
          // تبدیل assigned_to و created_by به personnel.id اگر ممکن باشد
          let assignedToId = null;
          let createdById = null;
          
          if (order.assigned_to) {
            const assignedPersonnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE username = ? OR email = ? LIMIT 1',
              [order.assigned_to, order.assigned_to]
            );
            if (assignedPersonnel) {
              assignedToId = assignedPersonnel.id;
            }
          }
          
          if (order.created_by) {
            const createdPersonnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE username = ? OR email = ? LIMIT 1',
              [order.created_by, order.created_by]
            );
            if (createdPersonnel) {
              createdById = createdPersonnel.id;
            }
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_orders (
              id, order_number, customer_name, customer_email, customer_phone,
              customer_address, status, priority, total_amount, currency,
              notes, workflow_id, assigned_to, created_by,
              created_at, updated_at, shipped_at, delivered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            order.id,
            order.order_number,
            order.customer_name,
            order.customer_email || null,
            order.customer_phone || null,
            order.customer_address || null,
            order.status || 'PENDING',
            order.priority || 'NORMAL',
            order.total_amount || 0,
            order.currency || 'USD',
            order.notes || null,
            order.workflow_id || null,
            assignedToId,
            createdById,
            order.created_at || new Date().toISOString(),
            order.updated_at || new Date().toISOString(),
            order.shipped_at || null,
            order.delivered_at || null
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration سفارش ${order.order_number}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} سفارش migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration orders:', error.message);
    }
    console.log('');

    // 6. Migration داده‌های order_items
    console.log('📦 Migration جدول order_items...');
    try {
      const orderItems = await analysisDb.all('SELECT * FROM order_items');
      console.log(`   پیدا شد: ${orderItems.length} آیتم سفارش`);
      
      let inserted = 0;
      for (const item of orderItems) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_order_items (
              id, order_id, product_id, description, quantity,
              unit_price, total_price, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            item.id,
            item.order_id,
            item.product_id || null,
            item.description || null,
            item.quantity,
            item.unit_price,
            item.total_price,
            item.created_at || new Date().toISOString(),
            item.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration آیتم ${item.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} آیتم سفارش migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration order_items:', error.message);
    }
    console.log('');

    // 7. Migration داده‌های proformas
    console.log('📄 Migration جدول proformas...');
    try {
      const proformas = await analysisDb.all('SELECT * FROM proformas');
      console.log(`   پیدا شد: ${proformas.length} پیش‌فاکتور`);
      
      let inserted = 0;
      for (const proforma of proformas) {
        try {
          let createdById = null;
          if (proforma.created_by) {
            const createdPersonnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE username = ? OR email = ? LIMIT 1',
              [proforma.created_by, proforma.created_by]
            );
            if (createdPersonnel) {
              createdById = createdPersonnel.id;
            }
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_proformas (
              id, proforma_number, order_id, customer_name, customer_email,
              customer_phone, customer_address, status, subtotal, tax_amount,
              discount_amount, total_amount, currency, valid_until, notes,
              terms_conditions, created_by, created_at, updated_at,
              sent_at, approved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            proforma.id,
            proforma.proforma_number,
            proforma.order_id || null,
            proforma.customer_name,
            proforma.customer_email || null,
            proforma.customer_phone || null,
            proforma.customer_address || null,
            proforma.status || 'DRAFT',
            proforma.subtotal || 0,
            proforma.tax_amount || 0,
            proforma.discount_amount || 0,
            proforma.total_amount || 0,
            proforma.currency || 'USD',
            proforma.valid_until || null,
            proforma.notes || null,
            proforma.terms_conditions || null,
            createdById,
            proforma.created_at || new Date().toISOString(),
            proforma.updated_at || new Date().toISOString(),
            proforma.sent_at || null,
            proforma.approved_at || null
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration پیش‌فاکتور ${proforma.proforma_number}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} پیش‌فاکتور migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration proformas:', error.message);
    }
    console.log('');

    // 8. Migration داده‌های proforma_items
    console.log('📄 Migration جدول proforma_items...');
    try {
      const proformaItems = await analysisDb.all('SELECT * FROM proforma_items');
      console.log(`   پیدا شد: ${proformaItems.length} آیتم پیش‌فاکتور`);
      
      let inserted = 0;
      for (const item of proformaItems) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_proforma_items (
              id, proforma_id, product_id, description, quantity,
              unit_price, total_price, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            item.id,
            item.proforma_id,
            item.product_id || null,
            item.description || null,
            item.quantity,
            item.unit_price,
            item.total_price,
            item.created_at || new Date().toISOString(),
            item.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration آیتم ${item.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} آیتم پیش‌فاکتور migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration proforma_items:', error.message);
    }
    console.log('');

    // 9. Migration داده‌های workflows
    console.log('🔄 Migration جدول workflows...');
    try {
      const workflows = await analysisDb.all('SELECT * FROM workflows');
      console.log(`   پیدا شد: ${workflows.length} workflow`);
      
      let inserted = 0;
      for (const workflow of workflows) {
        try {
          let createdById = null;
          if (workflow.created_by) {
            const createdPersonnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE username = ? OR email = ? LIMIT 1',
              [workflow.created_by, workflow.created_by]
            );
            if (createdPersonnel) {
              createdById = createdPersonnel.id;
            }
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_workflows (
              id, name, description, category, is_active,
              version, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            workflow.id,
            workflow.name,
            workflow.description || null,
            workflow.category || null,
            workflow.is_active !== undefined ? workflow.is_active : 1,
            workflow.version || 1,
            createdById,
            workflow.created_at || new Date().toISOString(),
            workflow.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration workflow ${workflow.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} workflow migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration workflows:', error.message);
    }
    console.log('');

    // 10. Migration داده‌های workflow_steps
    console.log('📋 Migration جدول workflow_steps...');
    try {
      const workflowSteps = await analysisDb.all('SELECT * FROM workflow_steps');
      console.log(`   پیدا شد: ${workflowSteps.length} مرحله workflow`);
      
      let inserted = 0;
      for (const step of workflowSteps) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_workflow_steps (
              id, workflow_id, title, description, step_order,
              is_required, is_parallel, estimated_duration, assigned_role,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            step.id,
            step.workflow_id,
            step.title,
            step.description || null,
            step.step_order,
            step.is_required !== undefined ? step.is_required : 1,
            step.is_parallel !== undefined ? step.is_parallel : 0,
            step.estimated_duration || null,
            step.assigned_role || null,
            step.created_at || new Date().toISOString(),
            step.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration مرحله ${step.title}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} مرحله workflow migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration workflow_steps:', error.message);
    }
    console.log('');

    // 11. Migration داده‌های workflow_fields
    console.log('📝 Migration جدول workflow_fields...');
    try {
      const workflowFields = await analysisDb.all('SELECT * FROM workflow_fields');
      console.log(`   پیدا شد: ${workflowFields.length} فیلد workflow`);
      
      let inserted = 0;
      for (const field of workflowFields) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_workflow_fields (
              id, step_id, name, label, field_type, is_required,
              width, field_order, options, validation_rules,
              placeholder, help_text, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            field.id,
            field.step_id,
            field.name,
            field.label,
            field.field_type,
            field.is_required !== undefined ? field.is_required : 0,
            field.width || 'FULL',
            field.field_order,
            field.options || null,
            field.validation_rules || null,
            field.placeholder || null,
            field.help_text || null,
            field.created_at || new Date().toISOString(),
            field.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration فیلد ${field.name}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} فیلد workflow migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration workflow_fields:', error.message);
    }
    console.log('');

    // 12. Migration داده‌های activities
    console.log('📊 Migration جدول activities...');
    try {
      const activities = await analysisDb.all('SELECT * FROM activities');
      console.log(`   پیدا شد: ${activities.length} فعالیت`);
      
      let inserted = 0;
      for (const activity of activities) {
        try {
          let userId = null;
          if (activity.user_id) {
            const personnel = await sharedDb.get(
              'SELECT id FROM personnel WHERE username = ? OR email = ? LIMIT 1',
              [activity.user_id, activity.user_id]
            );
            if (personnel) {
              userId = personnel.id;
            }
          }
          
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_activities (
              id, user_id, username, action, entity_type,
              entity_id, details, metadata, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            activity.id,
            userId,
            activity.username,
            activity.action,
            activity.entity_type,
            activity.entity_id || null,
            activity.details || null,
            activity.metadata || null,
            activity.ip_address || null,
            activity.user_agent || null,
            activity.created_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration فعالیت ${activity.id}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} فعالیت migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration activities:', error.message);
    }
    console.log('');

    // 13. Migration داده‌های settings
    console.log('⚙️  Migration جدول settings...');
    try {
      const settings = await analysisDb.all('SELECT * FROM settings');
      console.log(`   پیدا شد: ${settings.length} تنظیمات`);
      
      let inserted = 0;
      for (const setting of settings) {
        try {
          await sharedDb.run(`
            INSERT OR IGNORE INTO analysis_settings (
              id, key, value, description, category,
              is_public, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            setting.id,
            setting.key,
            setting.value,
            setting.description || null,
            setting.category || 'GENERAL',
            setting.is_public !== undefined ? setting.is_public : 0,
            setting.created_at || new Date().toISOString(),
            setting.updated_at || new Date().toISOString()
          ]);
          inserted++;
        } catch (error) {
          console.error(`   ❌ خطا در migration تنظیمات ${setting.key}:`, error.message);
        }
      }
      console.log(`✅ ${inserted} تنظیمات migrate شد`);
    } catch (error) {
      console.error('   ❌ خطا در migration settings:', error.message);
    }
    console.log('');

    // 14. فعال کردن Foreign Keys بعد از migration
    await sharedDb.exec('PRAGMA foreign_keys = ON');

    // 15. بستن دیتابیس‌ها
    await analysisDb.close();
    await sharedDb.close();

    console.log('✅ Migration داده‌های اپلیکیشن آنالیز فروش با موفقیت انجام شد!');
    console.log('');

  } catch (error) {
    console.error('❌ خطا در Migration:', error);
    throw error;
  }
}

migrateAnalysisData()
  .then(() => {
    console.log('🎉 تمام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای بحرانی:', error);
    process.exit(1);
  });

