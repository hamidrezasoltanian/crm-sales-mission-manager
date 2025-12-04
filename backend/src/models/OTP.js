import { getDB } from '../config/database.js';

export class OTP {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      used: row.used === 1 || row.used === true
    };
  }

  static generateCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }

  static async create(data) {
    const db = getDB();
    const { email, userId = null, purpose = 'login', expiresInMinutes = 5, token = null } = data;
    
    if (!email && !token) {
      throw new Error('ایمیل یا token الزامی است');
    }

    // Generate 6-digit code (if not magic link)
    const code = purpose === 'magic_link' ? null : this.generateCode(6);
    
    // Generate token for magic link
    const magicToken = purpose === 'magic_link' ? this.generateToken() : token;
    
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Invalidate any existing unused OTPs for this email and purpose
    if (email) {
      await db.run(
        `UPDATE otp_codes SET used = 1 WHERE email = ? AND purpose = ? AND used = 0 AND expiresAt > datetime('now')`,
        [email, purpose]
      );
    }

    // Create new OTP
    const result = await db.run(
      `INSERT INTO otp_codes (email, code, token, userId, purpose, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [email || null, code, magicToken, userId, purpose, expiresAt.toISOString()]
    );

    return {
      id: result.lastID,
      email,
      code,
      token: magicToken,
      userId,
      purpose,
      expiresAt: expiresAt.toISOString()
    };
  }

  static generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  static async verify(email, code, purpose = 'login') {
    const db = getDB();
    
    if (!email || !code) {
      return { valid: false, error: 'ایمیل و کد الزامی هستند' };
    }

    // Find valid OTP
    const row = await db.get(
      `SELECT * FROM otp_codes 
       WHERE email = ? AND code = ? AND purpose = ? AND used = 0 AND expiresAt > datetime('now')
       ORDER BY createdAt DESC
       LIMIT 1`,
      [email, code, purpose]
    );

    if (!row) {
      return { valid: false, error: 'کد نامعتبر یا منقضی شده است' };
    }

    // Mark as used
    await db.run(
      `UPDATE otp_codes SET used = 1 WHERE id = ?`,
      [row.id]
    );

    return {
      valid: true,
      userId: row.userId,
      otpId: row.id
    };
  }

  static async verifyMagicLink(token) {
    const db = getDB();
    
    if (!token) {
      return { valid: false, error: 'Token الزامی است' };
    }

    // Find valid magic link
    const row = await db.get(
      `SELECT * FROM otp_codes 
       WHERE token = ? AND purpose = 'magic_link' AND used = 0 AND expiresAt > datetime('now')
       ORDER BY createdAt DESC
       LIMIT 1`,
      [token]
    );

    if (!row) {
      return { valid: false, error: 'لینک نامعتبر یا منقضی شده است' };
    }

    // Mark as used
    await db.run(
      `UPDATE otp_codes SET used = 1 WHERE id = ?`,
      [row.id]
    );

    return {
      valid: true,
      userId: row.userId,
      email: row.email,
      otpId: row.id
    };
  }

  static async getByEmail(email, purpose = 'login') {
    const db = getDB();
    const row = await db.get(
      `SELECT * FROM otp_codes 
       WHERE email = ? AND purpose = ? AND used = 0 AND expiresAt > datetime('now')
       ORDER BY createdAt DESC
       LIMIT 1`,
      [email, purpose]
    );
    
    if (!row) return null;
    return this.format(row);
  }

  static async cleanupExpired() {
    const db = getDB();
    const result = await db.run(
      `DELETE FROM otp_codes WHERE expiresAt < datetime('now') OR used = 1`
    );
    return result.changes;
  }

  static async getStats(email) {
    const db = getDB();
    const stats = await db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN used = 0 AND expiresAt > datetime('now') THEN 1 ELSE 0 END) as active
       FROM otp_codes 
       WHERE email = ? AND createdAt > datetime('now', '-1 hour')`,
      [email]
    );
    return stats;
  }
}

