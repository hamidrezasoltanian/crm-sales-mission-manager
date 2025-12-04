import { getDB } from '../config/database.js';

export class Workspace {
  static formatRow(row) {
    if (!row) return null;
    
    const formatted = {
      ...row,
      isDefault: row.isDefault === 1,
      isActive: row.isActive === 1,
      settings: row.settings ? JSON.parse(row.settings) : {},
      filters: row.filters ? JSON.parse(row.filters) : {},
      viewSettings: row.viewSettings ? JSON.parse(row.viewSettings) : {}
    };
    
    return formatted;
  }

  static async getAllByPersonnelId(personnelId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT * FROM user_workspaces 
       WHERE personnelId = ? AND isActive = 1 
       ORDER BY isDefault DESC, createdAt DESC`,
      [personnelId]
    );
    
    return rows.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM user_workspaces WHERE id = ?', [id]);
    
    if (!row) {
      return null;
    }
    
    return this.formatRow(row);
  }

  static async getDefaultByPersonnelId(personnelId) {
    const db = getDB();
    const row = await db.get(
      `SELECT * FROM user_workspaces 
       WHERE personnelId = ? AND isDefault = 1 AND isActive = 1`,
      [personnelId]
    );
    
    if (!row) {
      return null;
    }
    
    return this.formatRow(row);
  }

  static async create(data) {
    const db = getDB();
    const { personnelId, name, description, color, icon, settings, filters, viewSettings } = data;
    
    if (!personnelId || !name) {
      throw new Error('personnelId و name الزامی است');
    }

    // اگر اولین workspace است، آن را به عنوان default تنظیم کن
    const existingWorkspaces = await this.getAllByPersonnelId(personnelId);
    const isDefault = existingWorkspaces.length === 0 ? 1 : 0;

    // اگر این workspace به عنوان default تنظیم شده، بقیه را غیر default کن
    if (isDefault === 1) {
      await db.run(
        `UPDATE user_workspaces SET isDefault = 0 WHERE personnelId = ?`,
        [personnelId]
      );
    }

    const now = new Date().toISOString();
    const settingsJson = settings ? JSON.stringify(settings) : null;
    const filtersJson = filters ? JSON.stringify(filters) : null;
    const viewSettingsJson = viewSettings ? JSON.stringify(viewSettings) : null;

    const result = await db.run(
      `INSERT INTO user_workspaces 
       (personnelId, name, description, color, icon, isDefault, settings, filters, viewSettings, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        personnelId,
        name,
        description || null,
        color || '#3B82F6',
        icon || '📋',
        isDefault,
        settingsJson,
        filtersJson,
        viewSettingsJson,
        now,
        now
      ]
    );

    return await this.getById(result.lastID);
  }

  static async update(id, data) {
    const db = getDB();
    const { name, description, color, icon, isDefault, settings, filters, viewSettings } = data;
    
    const workspace = await this.getById(id);
    if (!workspace) {
      throw new Error('Workspace یافت نشد');
    }

    // اگر این workspace به عنوان default تنظیم شده، بقیه را غیر default کن
    if (isDefault === 1) {
      await db.run(
        `UPDATE user_workspaces SET isDefault = 0 WHERE personnelId = ? AND id != ?`,
        [workspace.personnelId, id]
      );
    }

    const now = new Date().toISOString();
    const settingsJson = settings !== undefined ? JSON.stringify(settings) : null;
    const filtersJson = filters !== undefined ? JSON.stringify(filters) : null;
    const viewSettingsJson = viewSettings !== undefined ? JSON.stringify(viewSettings) : null;

    await db.run(
      `UPDATE user_workspaces 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           color = COALESCE(?, color),
           icon = COALESCE(?, icon),
           isDefault = COALESCE(?, isDefault),
           settings = COALESCE(?, settings),
           filters = COALESCE(?, filters),
           viewSettings = COALESCE(?, viewSettings),
           updatedAt = ?
       WHERE id = ?`,
      [
        name || null,
        description !== undefined ? description : null,
        color || null,
        icon || null,
        isDefault !== undefined ? (isDefault ? 1 : 0) : null,
        settingsJson,
        filtersJson,
        viewSettingsJson,
        now,
        id
      ]
    );

    return await this.getById(id);
  }

  static async updateFilters(id, filters) {
    return await this.update(id, { filters });
  }

  static async updateViewSettings(id, viewSettings) {
    return await this.update(id, { viewSettings });
  }

  static async delete(id) {
    const db = getDB();
    const workspace = await this.getById(id);
    
    if (!workspace) {
      throw new Error('Workspace یافت نشد');
    }

    // اگر workspace حذف شده default بود، اولین workspace دیگر را default کن
    if (workspace.isDefault) {
      const otherWorkspaces = await db.all(
        `SELECT id FROM user_workspaces 
         WHERE personnelId = ? AND id != ? AND isActive = 1 
         ORDER BY createdAt ASC LIMIT 1`,
        [workspace.personnelId, id]
      );
      
      if (otherWorkspaces.length > 0) {
        await db.run(
          `UPDATE user_workspaces SET isDefault = 1 WHERE id = ?`,
          [otherWorkspaces[0].id]
        );
      }
    }

    // Soft delete
    await db.run(
      `UPDATE user_workspaces SET isActive = 0, updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    return true;
  }

  static async setDefault(id) {
    const db = getDB();
    const workspace = await this.getById(id);
    
    if (!workspace) {
      throw new Error('Workspace یافت نشد');
    }

    // همه workspace های این کارمند را غیر default کن
    await db.run(
      `UPDATE user_workspaces SET isDefault = 0 WHERE personnelId = ?`,
      [workspace.personnelId]
    );

    // این workspace را default کن
    await db.run(
      `UPDATE user_workspaces SET isDefault = 1, updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    return await this.getById(id);
  }
}

