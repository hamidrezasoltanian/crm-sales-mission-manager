/**
 * Script to create/update Super Admin users
 * Run: node src/scripts/create-super-admins.js
 */

import { connectDB, getDB } from '../config/database.js';
import bcrypt from 'bcryptjs';

const SUPER_ADMINS = [
  {
    first_name: 'حمیدرضا',
    last_name: 'سلطانیان',
    username: 'hamidreza',
    email: 'hamidreza@example.com',
    phone: '09123456789',
    role: 'super_admin',
    password: 'admin123' // باید بعداً تغییر داده شود
  },
  {
    first_name: 'سارا',
    last_name: 'حسینی',
    username: 'sara',
    email: 'sara@example.com',
    phone: '09123456790',
    role: 'super_admin',
    password: 'admin123' // باید بعداً تغییر داده شود
  }
];

async function createSuperAdmins() {
  try {
    await connectDB();
    const db = getDB();

    console.log('🔐 Creating/Updating Super Admin users...\n');

    for (const admin of SUPER_ADMINS) {
      // Check if user exists by username or email
      let existing = await db.get(
        'SELECT * FROM personnel WHERE username = ? OR email = ?',
        [admin.username, admin.email]
      );

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(admin.password, salt);

      if (existing) {
        // Update existing user - use raw SQL to bypass CHECK constraint
        console.log(`📝 Updating existing user: ${admin.first_name} ${admin.last_name}`);
        // First, temporarily disable foreign keys and constraints
        await db.exec('PRAGMA foreign_keys = OFF');
        await db.run(
          `UPDATE personnel 
           SET first_name = ?, last_name = ?, username = ?, email = ?, phone = ?, 
               role = ?, password = ?, isActive = 1, updatedAt = datetime('now')
           WHERE id = ?`,
          [
            admin.first_name,
            admin.last_name,
            admin.username,
            admin.email,
            admin.phone,
            admin.role,
            passwordHash,
            existing.id
          ]
        );
        await db.exec('PRAGMA foreign_keys = ON');
        console.log(`   ✅ Updated: ${admin.username} (ID: ${existing.id})\n`);
      } else {
        // Create new user - use raw SQL to bypass CHECK constraint
        console.log(`➕ Creating new user: ${admin.first_name} ${admin.last_name}`);
        await db.exec('PRAGMA foreign_keys = OFF');
        const result = await db.run(
          `INSERT INTO personnel 
           (first_name, last_name, username, email, phone, role, password, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
          [
            admin.first_name,
            admin.last_name,
            admin.username,
            admin.email,
            admin.phone,
            admin.role,
            passwordHash
          ]
        );
        await db.exec('PRAGMA foreign_keys = ON');
        console.log(`   ✅ Created: ${admin.username} (ID: ${result.lastID})\n`);
      }
    }

    console.log('✅ Super Admin users setup completed!\n');
    console.log('⚠️  IMPORTANT: Please change the default passwords after first login!\n');
    console.log('Default credentials:');
    SUPER_ADMINS.forEach(admin => {
      console.log(`   Username: ${admin.username}, Password: ${admin.password}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admins:', error);
    process.exit(1);
  }
}

createSuperAdmins();

