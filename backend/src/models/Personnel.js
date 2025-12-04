import { getDB } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class Personnel {
  static async getAll() {
    const db = getDB();
    const result = await db.all(`
      SELECT * FROM personnel 
      ORDER BY createdAt DESC
    `);
    
    return result.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const result = await db.get('SELECT * FROM personnel WHERE id = ?', [id]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async getByUsername(username) {
    const db = getDB();
    // We need password here for login verification, so we don't formatRow immediately
    const result = await db.get('SELECT * FROM personnel WHERE username = ?', [username]);
    return result; 
  }

  static async getByPhone(phone) {
    const db = getDB();
    const result = await db.get('SELECT * FROM personnel WHERE phone = ?', [phone]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async getByEmail(email) {
    const db = getDB();
    const result = await db.get('SELECT * FROM personnel WHERE email = ?', [email]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async getByTelegramId(telegramId) {
    try {
      const db = getDB();
      console.log(`🔍 [Personnel] Looking up Telegram ID: ${telegramId} (type: ${typeof telegramId})`);
      
      const telegramIdStr = String(telegramId).trim();
      
      // جستجو با پارامترهای امن
      let result = await db.get('SELECT * FROM personnel WHERE telegramId = ?', [telegramIdStr]);
      
      // اگر پیدا نشد، با @username هم جستجو کنیم (فقط اگر numeric ID است)
      if (!result && !telegramIdStr.startsWith('@')) {
        const username = `@${telegramIdStr}`;
        result = await db.get('SELECT * FROM personnel WHERE telegramId = ?', [username]);
      }
      
      // اگر هنوز پیدا نشد، بدون @ جستجو کنیم (فقط اگر با @ شروع شده)
      if (!result && telegramIdStr.startsWith('@')) {
        const withoutAt = telegramIdStr.replace(/^@/, '');
        result = await db.get(
          'SELECT * FROM personnel WHERE telegramId = ? OR telegramId LIKE ?',
          [withoutAt, `%${withoutAt}%`]
        );
      }
      
      console.log(`📊 [Personnel] Query result:`, result ? 'Found 1 record' : 'No records found');
      
      if (!result) {
        return null;
      }
      
      const personnel = this.formatRow(result);
      console.log(`✅ [Personnel] Found personnel: ${personnel.name} (ID: ${personnel.id}, Telegram ID in DB: ${personnel.telegramId})`);
      return personnel;
    } catch (error) {
      console.error(`❌ [Personnel] Error in getByTelegramId:`, error.message);
      return null;
    }
  }

  static async create(data) {
    const db = getDB();
    const { name, phone, telegramId, role = 'staff', username, password, isActive = true } = data;
    
    // اعتبارسنجی شماره تماس - فقط فرمت را چک کن، تکراری بودن را چک نکن
    if (phone) {
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        throw new Error('شماره تماس باید با 09 شروع شود و 11 رقم باشد (مثال: 09123456789)');
      }
    }
    
    // اعتبارسنجی Telegram ID
    if (telegramId) {
      const telegramIdStr = String(telegramId).trim();
      if (!telegramIdStr.match(/^(\d+|[a-zA-Z0-9_@]+)$/)) {
         // Simple check to allow @username
      }
    }

    // Password Hashing - اگر پسورد داده نشده، از پسورد پیش‌فرض استفاده کن
    const DEFAULT_PASSWORD = '123456';
    const finalPassword = password || DEFAULT_PASSWORD;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);
    
    const now = new Date().toISOString();
    
    // Split name into first_name and last_name if needed
    let firstName = '';
    let lastName = '';
    if (name) {
      const nameParts = name.trim().split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    // Generate username from phone if not provided
    const finalUsername = username || `user_${phone.replace(/\D/g, '')}`;
    
    try {
      const result = await db.run(`
        INSERT INTO personnel (first_name, last_name, phone, telegramId, role, username, password, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [firstName, lastName, phone, telegramId || null, role, finalUsername, passwordHash, isActive ? 1 : 0, now, now]);
      
      return await this.getById(result.lastID);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        // اگر username تکراری است، یک username جدید بساز
        if (error.message.includes('username')) {
          const newUsername = `user_${phone.replace(/\D/g, '')}_${Date.now()}`;
          try {
            const result = await db.run(`
              INSERT INTO personnel (first_name, last_name, phone, telegramId, role, username, password, isActive, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [firstName, lastName, phone, telegramId || null, role, newUsername, passwordHash, isActive ? 1 : 0, now, now]);
            return await this.getById(result.lastID);
          } catch (retryError) {
            throw new Error('خطا در ایجاد کاربر. لطفاً با مدیر تماس بگیرید.');
          }
        }
        throw new Error('این اطلاعات قبلاً ثبت شده است');
      }
      throw error;
    }
  }

  static async update(id, data) {
    const db = getDB();
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const { name, first_name, last_name, phone, telegramId, role, isActive, username, password, email } = data;
    
    const now = new Date().toISOString();
    
    const updates = [];
    const values = [];
    
    // Handle name update - if name is provided, split it into first_name and last_name
    // If first_name or last_name are provided directly, use those instead
    if (name !== undefined && first_name === undefined && last_name === undefined) {
      // Split name into first_name and last_name
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      updates.push('first_name = ?');
      values.push(firstName);
      updates.push('last_name = ?');
      values.push(lastName);
    } else {
      if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
      if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
    }
    
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (telegramId !== undefined) { updates.push('telegramId = ?'); values.push(telegramId || null); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (isActive !== undefined) { updates.push('isActive = ?'); values.push(isActive ? 1 : 0); }
    if (username !== undefined) { updates.push('username = ?'); values.push(username); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      updates.push('password = ?');
      values.push(passwordHash);
    }
    
    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    try {
      await db.run(`
        UPDATE personnel 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getById(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('نام کاربری، شماره تماس یا تلگرام ID تکراری است');
      }
      throw error;
    }
  }

  static async delete(id) {
    const db = getDB();
    const personnel = await this.getById(id);
    
    if (!personnel) return false;
    
    // بررسی اینکه آیا در ماموریت‌ها استفاده شده یا نه
    const assignmentsResult = await db.get(
      'SELECT COUNT(*) as count FROM mission_assignments WHERE personnelId = ?',
      [id]
    );
    if (assignmentsResult && assignmentsResult.count > 0) {
      throw new Error('نمی‌توان پرسنل را حذف کرد زیرا در ماموریت‌ها استفاده شده است');
    }
    
    await db.run('DELETE FROM personnel WHERE id = ?', [id]);
    
    return true;
  }

  static async verifyPassword(storedHash, password) {
    return await bcrypt.compare(password, storedHash);
  }

  static async findByNameOrUsername(keyword) {
    if (!keyword) {
      return null;
    }
    const db = getDB();
    const normalized = keyword.trim();

    const result = await db.get(
      `
      SELECT *
      FROM personnel
      WHERE (first_name || ' ' || last_name) LIKE ?
         OR username LIKE ?
         OR telegramId = ?
      LIMIT 1
    `,
      [`%${normalized}%`, `%${normalized}%`, normalized]
    );

    return result ? this.formatRow(result) : null;
  }

  static formatRow(row) {
    if (!row) return null;
    
    const obj = { ...row };
    
    // Always construct name from first_name and last_name (name is a generated column)
    // This ensures name is always available even if the generated column isn't selected
    const firstName = obj.first_name || '';
    const lastName = obj.last_name || '';
    obj.name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    
    if (obj.isActive !== undefined) {
      obj.isActive = obj.isActive === 1;
    }
    
    // Security: Remove password from output
    delete obj.password;
    delete obj.password_hash; // Also remove password_hash if it exists
    
    const formatted = {
      ...obj,
      _id: obj.id ? obj.id.toString() : null
    };
    
    // Ensure name is always set (double check)
    if (!formatted.name && (formatted.first_name || formatted.last_name)) {
      formatted.name = [formatted.first_name || '', formatted.last_name || ''].filter(Boolean).join(' ').trim() || null;
    }
    
    return formatted;
  }
}
