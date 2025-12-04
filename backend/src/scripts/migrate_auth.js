import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/shared.db');

async function migrate() {
  console.log('🔄 Starting Auth Migration...');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // 1. Add columns if they don't exist
    const columns = await db.all("PRAGMA table_info(personnel)");
    const hasUsername = columns.some(c => c.name === 'username');
    const hasPassword = columns.some(c => c.name === 'password');

    if (!hasUsername) {
      console.log('➕ Adding username column...');
      await db.exec("ALTER TABLE personnel ADD COLUMN username TEXT UNIQUE");
    }

    if (!hasPassword) {
      console.log('➕ Adding password column...');
      await db.exec("ALTER TABLE personnel ADD COLUMN password TEXT");
    }

    // 2. Set default Super Admins
    const superAdmins = [
      { name: 'حمیدرضا سلطانیان', username: 'admin', role: 'admin' },
      { name: 'سارا حسینی', username: 'sara', role: 'admin' }
    ];

    // Default password: 'admin' (You should change this later)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);

    for (const admin of superAdmins) {
      // Find by name (since ID might vary) or update if exists
      const existing = await db.get("SELECT * FROM personnel WHERE name LIKE ?", [`%${admin.name}%`]);
      
      if (existing) {
        console.log(`👤 Updating existing admin: ${admin.name}`);
        await db.run(
          "UPDATE personnel SET username = ?, password = ?, role = ? WHERE id = ?",
          [admin.username, hashedPassword, admin.role, existing.id]
        );
      } else {
        console.log(`👤 Creating new admin: ${admin.name}`);
        // Note: telegramId is nullable, phone is nullable
        await db.run(
          "INSERT INTO personnel (name, username, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
          [admin.name, admin.username, hashedPassword, admin.role]
        );
      }
    }

    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.close();
  }
}

migrate();


