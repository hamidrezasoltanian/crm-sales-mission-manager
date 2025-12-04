/**
 * Migration script to update role CHECK constraint to include 'super_admin'
 * This script recreates the personnel table with updated constraint
 */

import { connectDB, getDB } from '../config/database.js';
import sqlite3 from 'sqlite3';

async function migrateRoleConstraint() {
  try {
    await connectDB();
    const db = getDB();

    console.log('🔄 Migrating role constraint to include super_admin...\n');

    // Check if super_admin already exists in any role
    const hasSuperAdmin = await db.get(
      "SELECT COUNT(*) as count FROM personnel WHERE role = 'super_admin'"
    );

    if (hasSuperAdmin.count > 0) {
      console.log('✅ super_admin role already exists in database');
      return;
    }

    // Get table schema
    const tableInfo = await db.all('PRAGMA table_info(personnel)');
    const columns = tableInfo.map(col => ({
      name: col.name,
      type: col.type,
      notnull: col.notnull,
      dflt_value: col.dflt_value,
      pk: col.pk
    }));

    // Get all data
    const allData = await db.all('SELECT * FROM personnel');

    console.log(`📦 Found ${allData.length} records to migrate\n`);

    // Disable foreign keys temporarily
    await db.exec('PRAGMA foreign_keys = OFF');

    // Create backup table
    await db.exec('DROP TABLE IF EXISTS personnel_backup');
    await db.exec(`
      CREATE TABLE personnel_backup AS SELECT * FROM personnel
    `);

    // Drop old table
    await db.exec('DROP TABLE IF EXISTS personnel');

    // Recreate table with updated constraint
    await db.exec(`
      CREATE TABLE personnel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        mobile TEXT,
        email TEXT UNIQUE,
        telegramId TEXT UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff', 'USER', 'ADMIN', 'super_admin')),
        isActive INTEGER NOT NULL DEFAULT 1,
        avatar_url TEXT,
        last_login_at TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Recreate indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_phone ON personnel(phone)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_telegramId ON personnel(telegramId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_isActive ON personnel(isActive)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_username ON personnel(username)');

    // Restore data
    for (const row of allData) {
      await db.run(
        `INSERT INTO personnel 
         (id, first_name, last_name, phone, mobile, email, telegramId, username, password_hash, password, 
          role, isActive, avatar_url, last_login_at, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.first_name || '',
          row.last_name || '',
          row.phone,
          row.mobile || null,
          row.email || null,
          row.telegramId || null,
          row.username || null,
          row.password_hash || null,
          row.password || null,
          row.role,
          row.isActive !== undefined ? row.isActive : 1,
          row.avatar_url || null,
          row.last_login_at || null,
          row.createdAt || new Date().toISOString(),
          row.updatedAt || new Date().toISOString()
        ]
      );
    }

    // Drop backup table
    await db.exec('DROP TABLE IF EXISTS personnel_backup');

    // Re-enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    console.log('✅ Role constraint migration completed successfully!\n');
    console.log(`   Migrated ${allData.length} records\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Try to restore from backup
    try {
      const db = getDB();
      await db.exec('PRAGMA foreign_keys = OFF');
      await db.exec('DROP TABLE IF EXISTS personnel');
      await db.exec('ALTER TABLE personnel_backup RENAME TO personnel');
      await db.exec('PRAGMA foreign_keys = ON');
      console.log('⚠️  Restored from backup');
    } catch (restoreError) {
      console.error('❌ Failed to restore from backup:', restoreError);
    }
    throw error;
  }
}

migrateRoleConstraint()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

