import { getDB } from '../config/database.js';

export class Permission {
  /**
   * Get all system modules
   */
  static async getAllModules() {
    const db = getDB();
    const modules = await db.all(`
      SELECT * FROM system_modules 
      WHERE isActive = 1
      ORDER BY order_index ASC, name ASC
    `);
    return modules;
  }

  /**
   * Get module by key
   */
  static async getModuleByKey(key) {
    const db = getDB();
    return await db.get('SELECT * FROM system_modules WHERE key = ?', [key]);
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId) {
    const db = getDB();
    const permissions = await db.all(`
      SELECT up.*, sm.name as moduleName, sm.category, sm.icon
      FROM user_permissions up
      JOIN system_modules sm ON up.moduleKey = sm.key
      WHERE up.userId = ? AND up.granted = 1
      ORDER BY sm.order_index ASC, sm.name ASC
    `, [userId]);
    return permissions;
  }

  /**
   * Get all permissions for a user (including denied)
   */
  static async getAllUserPermissions(userId) {
    const db = getDB();
    const permissions = await db.all(`
      SELECT up.*, sm.name as moduleName, sm.category, sm.icon
      FROM user_permissions up
      JOIN system_modules sm ON up.moduleKey = sm.key
      WHERE up.userId = ?
      ORDER BY sm.order_index ASC, sm.name ASC
    `, [userId]);
    return permissions;
  }

  /**
   * Grant permission to user
   */
  static async grantPermission(userId, moduleKey, permission, grantedBy, notes = null) {
    const db = getDB();
    
    // Check if permission already exists
    const existing = await db.get(
      'SELECT * FROM user_permissions WHERE userId = ? AND moduleKey = ? AND permission = ?',
      [userId, moduleKey, permission]
    );

    if (existing) {
      // Update existing permission
      await db.run(
        `UPDATE user_permissions 
         SET granted = 1, grantedBy = ?, grantedAt = datetime('now'), revokedAt = NULL, notes = ?
         WHERE id = ?`,
        [grantedBy, notes, existing.id]
      );
      
      // Log the change
      await this.logPermissionChange(userId, moduleKey, permission, 'grant', grantedBy, existing.granted ? 'granted' : 'denied', 'granted', notes);
      
      return existing.id;
    } else {
      // Create new permission
      const result = await db.run(
        `INSERT INTO user_permissions 
         (userId, moduleKey, permission, granted, grantedBy, grantedAt, notes)
         VALUES (?, ?, ?, 1, ?, datetime('now'), ?)`,
        [userId, moduleKey, permission, grantedBy, notes]
      );
      
      // Log the change
      await this.logPermissionChange(userId, moduleKey, permission, 'grant', grantedBy, null, 'granted', notes);
      
      return result.lastID;
    }
  }

  /**
   * Revoke permission from user
   */
  static async revokePermission(userId, moduleKey, permission, revokedBy, reason = null) {
    const db = getDB();
    
    const existing = await db.get(
      'SELECT * FROM user_permissions WHERE userId = ? AND moduleKey = ? AND permission = ?',
      [userId, moduleKey, permission]
    );

    if (existing) {
      await db.run(
        `UPDATE user_permissions 
         SET granted = 0, revokedAt = datetime('now'), notes = ?
         WHERE id = ?`,
        [reason, existing.id]
      );
      
      // Log the change
      await this.logPermissionChange(userId, moduleKey, permission, 'revoke', revokedBy, 'granted', 'denied', reason);
      
      return existing.id;
    } else {
      // Create denied permission record
      const result = await db.run(
        `INSERT INTO user_permissions 
         (userId, moduleKey, permission, granted, grantedBy, grantedAt, revokedAt, notes)
         VALUES (?, ?, ?, 0, ?, datetime('now'), datetime('now'), ?)`,
        [userId, moduleKey, permission, revokedBy, reason]
      );
      
      // Log the change
      await this.logPermissionChange(userId, moduleKey, permission, 'revoke', revokedBy, null, 'denied', reason);
      
      return result.lastID;
    }
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(userId, moduleKey, permission) {
    const db = getDB();
    
    // First check if user is super_admin
    const user = await db.get('SELECT role FROM personnel WHERE id = ?', [userId]);
    if (user && user.role === 'super_admin') {
      return true; // Super admin has all permissions
    }

    // Check specific permission
    const perm = await db.get(
      `SELECT granted FROM user_permissions 
       WHERE userId = ? AND moduleKey = ? AND permission = ? AND granted = 1`,
      [userId, moduleKey, permission]
    );

    return !!perm;
  }

  /**
   * Get permission logs for a user
   */
  static async getPermissionLogs(userId, limit = 50) {
    const db = getDB();
    return await db.all(`
      SELECT pl.*, 
             p.first_name || ' ' || p.last_name as userName,
             c.first_name || ' ' || c.last_name as changedByName,
             sm.name as moduleName
      FROM permission_logs pl
      JOIN personnel p ON pl.userId = p.id
      JOIN personnel c ON pl.changedBy = c.id
      LEFT JOIN system_modules sm ON pl.moduleKey = sm.key
      WHERE pl.userId = ?
      ORDER BY pl.createdAt DESC
      LIMIT ?
    `, [userId, limit]);
  }

  /**
   * Log permission change
   */
  static async logPermissionChange(userId, moduleKey, permission, action, changedBy, oldValue, newValue, reason = null) {
    const db = getDB();
    await db.run(
      `INSERT INTO permission_logs 
       (userId, moduleKey, permission, action, changedBy, oldValue, newValue, reason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [userId, moduleKey, permission, action, changedBy, oldValue, newValue, reason]
    );
  }

  /**
   * Get all permissions for all users (for admin view)
   */
  static async getAllPermissions(filters = {}) {
    const db = getDB();
    let query = `
      SELECT up.*, 
             p.first_name || ' ' || p.last_name as userName,
             p.role as userRole,
             g.first_name || ' ' || g.last_name as grantedByName,
             sm.name as moduleName,
             sm.category,
             sm.icon
      FROM user_permissions up
      JOIN personnel p ON up.userId = p.id
      LEFT JOIN personnel g ON up.grantedBy = g.id
      JOIN system_modules sm ON up.moduleKey = sm.key
      WHERE 1=1
    `;
    const params = [];

    if (filters.userId) {
      query += ' AND up.userId = ?';
      params.push(filters.userId);
    }

    if (filters.moduleKey) {
      query += ' AND up.moduleKey = ?';
      params.push(filters.moduleKey);
    }

    if (filters.granted !== undefined) {
      query += ' AND up.granted = ?';
      params.push(filters.granted ? 1 : 0);
    }

    query += ' ORDER BY p.first_name ASC, sm.order_index ASC';

    return await db.all(query, params);
  }

  /**
   * Bulk update permissions for a user
   */
  static async bulkUpdatePermissions(userId, permissions, changedBy) {
    const db = getDB();
    
    // Start transaction
    await db.exec('BEGIN TRANSACTION');
    
    try {
      for (const perm of permissions) {
        const { moduleKey, permission, granted, notes } = perm;
        
        if (granted) {
          await this.grantPermission(userId, moduleKey, permission, changedBy, notes);
        } else {
          await this.revokePermission(userId, moduleKey, permission, changedBy, notes);
        }
      }
      
      await db.exec('COMMIT');
      return true;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }
}

