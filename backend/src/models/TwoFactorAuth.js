import { getDB } from '../config/database.js';
import crypto from 'crypto';

export class TwoFactorAuth {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      enabled: row.enabled === 1 || row.enabled === true,
      backupCodes: row.backupCodes ? JSON.parse(row.backupCodes) : []
    };
  }

  static generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  static async getByUserId(userId) {
    const db = getDB();
    const row = await db.get(
      'SELECT * FROM two_factor_auth WHERE userId = ?',
      [userId]
    );
    
    if (!row) return null;
    return this.format(row);
  }

  static async enable(userId, method = 'email') {
    const db = getDB();
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    
    const now = new Date().toISOString();
    
    // Check if exists
    const existing = await this.getByUserId(userId);
    
    if (existing) {
      // Update
      await db.run(
        `UPDATE two_factor_auth 
         SET enabled = 1, method = ?, backupCodes = ?, updatedAt = ?
         WHERE userId = ?`,
        [method, JSON.stringify(backupCodes), now, userId]
      );
    } else {
      // Create
      await db.run(
        `INSERT INTO two_factor_auth (userId, enabled, method, backupCodes, createdAt, updatedAt)
         VALUES (?, 1, ?, ?, ?, ?)`,
        [userId, method, JSON.stringify(backupCodes), now, now]
      );
    }
    
    return {
      enabled: true,
      method,
      backupCodes
    };
  }

  static async disable(userId) {
    const db = getDB();
    const now = new Date().toISOString();
    
    await db.run(
      `UPDATE two_factor_auth 
       SET enabled = 0, updatedAt = ?
       WHERE userId = ?`,
      [now, userId]
    );
    
    return { enabled: false };
  }

  static async verifyBackupCode(userId, code) {
    const db = getDB();
    const twoFA = await this.getByUserId(userId);
    
    if (!twoFA || !twoFA.enabled) {
      return { valid: false, error: '2FA فعال نیست' };
    }
    
    const backupCodes = twoFA.backupCodes || [];
    const codeIndex = backupCodes.indexOf(code.toUpperCase());
    
    if (codeIndex === -1) {
      return { valid: false, error: 'کد پشتیبان نامعتبر است' };
    }
    
    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    
    await db.run(
      `UPDATE two_factor_auth 
       SET backupCodes = ?, updatedAt = ?
       WHERE userId = ?`,
      [JSON.stringify(backupCodes), new Date().toISOString(), userId]
    );
    
    return { valid: true, remainingCodes: backupCodes.length };
  }

  static async regenerateBackupCodes(userId) {
    const db = getDB();
    const backupCodes = this.generateBackupCodes();
    const now = new Date().toISOString();
    
    await db.run(
      `UPDATE two_factor_auth 
       SET backupCodes = ?, updatedAt = ?
       WHERE userId = ?`,
      [JSON.stringify(backupCodes), now, userId]
    );
    
    return { backupCodes };
  }
}

