import { getDB } from '../config/database.js';

export class WorkspaceTag {
  static formatRow(row) {
    if (!row) return null;
    return { ...row };
  }

  static async getAllByWorkspaceId(workspaceId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT * FROM workspace_tags WHERE workspaceId = ? ORDER BY name ASC`,
      [workspaceId]
    );
    return rows.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workspace_tags WHERE id = ?', [id]);
    return row ? this.formatRow(row) : null;
  }

  static async create(data) {
    const db = getDB();
    const { workspaceId, name, color, category } = data;
    
    if (!workspaceId || !name) {
      throw new Error('workspaceId و name الزامی است');
    }

    const result = await db.run(
      `INSERT INTO workspace_tags (workspaceId, name, color, category)
       VALUES (?, ?, ?, ?)`,
      [workspaceId, name, color || '#3B82F6', category || null]
    );

    return await this.getById(result.lastID);
  }

  static async update(id, data) {
    const db = getDB();
    const { name, color, category } = data;
    
    const now = new Date().toISOString();
    await db.run(
      `UPDATE workspace_tags 
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           category = COALESCE(?, category)
       WHERE id = ?`,
      [name || null, color || null, category || null, id]
    );

    return await this.getById(id);
  }

  static async delete(id) {
    const db = getDB();
    await db.run('DELETE FROM workspace_tags WHERE id = ?', [id]);
    return true;
  }

  static async assignToAssignment(workspaceId, assignmentId, tagId) {
    const db = getDB();
    try {
      await db.run(
        `INSERT OR IGNORE INTO workspace_assignment_tags (workspaceId, assignmentId, tagId, createdAt)
         VALUES (?, ?, ?, ?)`,
        [workspaceId, assignmentId, tagId, new Date().toISOString()]
      );
      return true;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return true; // Already assigned
      }
      throw error;
    }
  }

  static async removeFromAssignment(workspaceId, assignmentId, tagId) {
    const db = getDB();
    await db.run(
      `DELETE FROM workspace_assignment_tags 
       WHERE workspaceId = ? AND assignmentId = ? AND tagId = ?`,
      [workspaceId, assignmentId, tagId]
    );
    return true;
  }

  static async getAssignmentTags(workspaceId, assignmentId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT t.* FROM workspace_tags t
       INNER JOIN workspace_assignment_tags at ON t.id = at.tagId
       WHERE at.workspaceId = ? AND at.assignmentId = ?`,
      [workspaceId, assignmentId]
    );
    return rows.map(row => this.formatRow(row));
  }

  static async assignToCenter(workspaceId, centerId, tagId) {
    const db = getDB();
    try {
      await db.run(
        `INSERT OR IGNORE INTO workspace_center_tags (workspaceId, centerId, tagId, createdAt)
         VALUES (?, ?, ?, ?)`,
        [workspaceId, centerId, tagId, new Date().toISOString()]
      );
      return true;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return true;
      }
      throw error;
    }
  }

  static async removeFromCenter(workspaceId, centerId, tagId) {
    const db = getDB();
    await db.run(
      `DELETE FROM workspace_center_tags 
       WHERE workspaceId = ? AND centerId = ? AND tagId = ?`,
      [workspaceId, centerId, tagId]
    );
    return true;
  }

  static async getCenterTags(workspaceId, centerId) {
    const db = getDB();
    const rows = await db.all(
      `SELECT t.* FROM workspace_tags t
       INNER JOIN workspace_center_tags ct ON t.id = ct.tagId
       WHERE ct.workspaceId = ? AND ct.centerId = ?`,
      [workspaceId, centerId]
    );
    return rows.map(row => this.formatRow(row));
  }
}

