import { getDB } from '../config/database.js';

export class WorkspaceShare {
  static formatRow(row) {
    if (!row) return null;
    return { ...row };
  }

  static async getAllByWorkspaceId(workspaceId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT s.*, 
              (p.first_name || ' ' || p.last_name) as sharedWithPersonnelName,
              p.phone as sharedWithPersonnelPhone
       FROM workspace_shares s
       LEFT JOIN personnel p ON s.sharedWithPersonnelId = p.id
       WHERE s.workspaceId = ?`,
      [workspaceId]
    );
    return rows.map(row => this.formatRow(row));
  }

  static async getAllByPersonnelId(personnelId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT s.*, 
              w.name as workspaceName,
              w.color as workspaceColor,
              w.icon as workspaceIcon,
              (p.first_name || ' ' || p.last_name) as ownerName
       FROM workspace_shares s
       LEFT JOIN user_workspaces w ON s.workspaceId = w.id
       LEFT JOIN personnel p ON w.personnelId = p.id
       WHERE s.sharedWithPersonnelId = ?`,
      [personnelId]
    );
    return rows.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workspace_shares WHERE id = ?', [id]);
    return row ? this.formatRow(row) : null;
  }

  static async create(data) {
    const db = getDB();
    const { workspaceId, sharedWithPersonnelId, permission } = data;
    
    if (!workspaceId || !sharedWithPersonnelId) {
      throw new Error('workspaceId و sharedWithPersonnelId الزامی است');
    }

    // Check if already shared
    const existing = await db.get(
      `SELECT id FROM workspace_shares 
       WHERE workspaceId = ? AND sharedWithPersonnelId = ?`,
      [workspaceId, sharedWithPersonnelId]
    );

    if (existing) {
      // Update permission
      await db.run(
        `UPDATE workspace_shares SET permission = ? WHERE id = ?`,
        [permission || 'read', existing.id]
      );
      return await this.getById(existing.id);
    }

    const result = await db.run(
      `INSERT INTO workspace_shares (workspaceId, sharedWithPersonnelId, permission, createdAt)
       VALUES (?, ?, ?, ?)`,
      [
        workspaceId,
        sharedWithPersonnelId,
        permission || 'read',
        new Date().toISOString()
      ]
    );

    return await this.getById(result.lastID);
  }

  static async update(id, data) {
    const db = getDB();
    const { permission } = data;
    
    await db.run(
      `UPDATE workspace_shares SET permission = ? WHERE id = ?`,
      [permission, id]
    );

    return await this.getById(id);
  }

  static async delete(id) {
    const db = getDB();
    await db.run('DELETE FROM workspace_shares WHERE id = ?', [id]);
    return true;
  }

  static async hasAccess(workspaceId, personnelId, requiredPermission = 'read') {
    const db = getDB();
    
    // Check if owner
    const workspace = await db.get(
      'SELECT personnelId FROM user_workspaces WHERE id = ?',
      [workspaceId]
    );
    
    if (workspace && workspace.personnelId === personnelId) {
      return true; // Owner has full access
    }

    // Check share
    const share = await db.get(
      `SELECT permission FROM workspace_shares 
       WHERE workspaceId = ? AND sharedWithPersonnelId = ?`,
      [workspaceId, personnelId]
    );

    if (!share) {
      return false;
    }

    // Check permission level
    const permissions = { read: 1, write: 2, admin: 3 };
    const required = permissions[requiredPermission] || 1;
    const has = permissions[share.permission] || 1;

    return has >= required;
  }
}

