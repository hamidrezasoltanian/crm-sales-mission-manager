import { getDB } from '../config/database.js';

export class DiscountCode {
  static async getAll() {
    const db = getDB();
    const result = await db.all(`
      SELECT * FROM mission_discount_codes 
      ORDER BY createdAt DESC
    `);
    
    return result.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const result = await db.get('SELECT * FROM mission_discount_codes WHERE id = ?', [id]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async getByCode(code) {
    if (!code) return null;
    
    const db = getDB();
    const codeTrimmed = String(code).trim();
    const codeUpper = codeTrimmed.toUpperCase();
    
    // دریافت تمام کدهای فعال
    const allCodes = await db.all('SELECT * FROM mission_discount_codes WHERE isActive = 1');
    
    // فیلتر کردن در JavaScript برای case-insensitive matching
    const matchingCode = allCodes.find(discount => {
      const rowCode = String(discount.code || '').trim().toUpperCase();
      return rowCode === codeUpper;
    });
    
    if (!matchingCode) {
      return null;
    }
    
    const discount = this.formatRow(matchingCode);
    
    // بررسی اعتبار تاریخ
    const now = new Date();
    if (discount.validFrom) {
      const validFrom = new Date(discount.validFrom);
      if (now < validFrom) {
        return null; // هنوز اعتبار ندارد
      }
    }
    if (discount.validUntil) {
      const validUntil = new Date(discount.validUntil);
      if (now > validUntil) {
        return null; // منقضی شده
      }
    }
    
    // بررسی تعداد استفاده
    if (discount.maxUses && discount.currentUses >= discount.maxUses) {
      return null; // تعداد استفاده به پایان رسیده
    }
    
    return discount;
  }

  static async create(data) {
    const db = getDB();
    const { code, discountType, discountValue, maxUses, validFrom, validUntil } = data;
    
    const now = new Date().toISOString();
    
    try {
      const result = await db.run(`
        INSERT INTO mission_discount_codes (code, discountType, discountValue, maxUses, validFrom, validUntil, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        code, discountType, discountValue, maxUses || null,
        validFrom || null, validUntil || null, now, now
      ]);
      
      return await this.getById(result.lastID);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('کد تخفیف تکراری است');
      }
      throw error;
    }
  }

  static async update(id, data) {
    const db = getDB();
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const { code, discountType, discountValue, maxUses, validFrom, validUntil, isActive } = data;
    const now = new Date().toISOString();
    
    const updates = [];
    const values = [];
    
    if (code !== undefined) {
      // Trim کردن کد تخفیف و تبدیل به uppercase
      const codeTrimmed = String(code || '').trim().toUpperCase();
      updates.push('code = ?');
      values.push(codeTrimmed);
    }
    if (discountType !== undefined) {
      updates.push('discountType = ?');
      values.push(discountType);
    }
    if (discountValue !== undefined) {
      updates.push('discountValue = ?');
      values.push(discountValue);
    }
    if (maxUses !== undefined) {
      updates.push('maxUses = ?');
      values.push(maxUses);
    }
    if (validFrom !== undefined) {
      updates.push('validFrom = ?');
      values.push(validFrom);
    }
    if (validUntil !== undefined) {
      updates.push('validUntil = ?');
      values.push(validUntil);
    }
    if (isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(isActive ? 1 : 0);
    }
    
    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    try {
      await db.run(`
        UPDATE mission_discount_codes 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getById(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('کد تخفیف تکراری است');
      }
      throw error;
    }
  }

  static async delete(id) {
    const db = getDB();
    const discount = await this.getById(id);
    
    if (!discount) return false;
    
    await db.run('DELETE FROM mission_discount_codes WHERE id = ?', [id]);
    
    return true;
  }

  static formatRow(row) {
    if (!row) return null;
    
    const obj = { ...row };
    if (obj.isActive !== undefined) {
      obj.isActive = obj.isActive === 1;
    }
    
    return {
      ...obj,
      _id: obj.id.toString()
    };
  }
}
