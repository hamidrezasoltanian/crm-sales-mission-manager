import { getDB } from '../config/database.js';

export class WorkspaceNote {
  static formatRow(row) {
    if (!row) return null;
    return {
      ...row,
      isPinned: row.isPinned === 1,
      tags: row.tags ? JSON.parse(row.tags) : []
    };
  }

  static async getAllByWorkspaceId(workspaceId, filters = {}) {
    const db = getDB();
    let query = `SELECT * FROM workspace_notes WHERE workspaceId = ?`;
    const params = [workspaceId];

    if (filters.pinned !== undefined) {
      query += ` AND isPinned = ?`;
      params.push(filters.pinned ? 1 : 0);
    }

    if (filters.search) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY isPinned DESC, updatedAt DESC`;

    const rows = await db.all(query, params);
    return rows.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workspace_notes WHERE id = ?', [id]);
    return row ? this.formatRow(row) : null;
  }

  static async create(data) {
    const db = getDB();
    const { workspaceId, title, content, tags, isPinned } = data;
    
    if (!workspaceId || !title) {
      throw new Error('workspaceId و title الزامی است');
    }

    const now = new Date().toISOString();
    const tagsJson = tags ? JSON.stringify(tags) : null;

    const result = await db.run(
      `INSERT INTO workspace_notes (workspaceId, title, content, tags, isPinned, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        workspaceId,
        title,
        content || null,
        tagsJson,
        isPinned ? 1 : 0,
        now,
        now
      ]
    );

    return await this.getById(result.lastID);
  }

  static async update(id, data) {
    const db = getDB();
    const { title, content, tags, isPinned } = data;
    
    const now = new Date().toISOString();
    const tagsJson = tags ? JSON.stringify(tags) : null;

    await db.run(
      `UPDATE workspace_notes 
       SET title = COALESCE(?, title),
           content = COALESCE(?, content),
           tags = COALESCE(?, tags),
           isPinned = COALESCE(?, isPinned),
           updatedAt = ?
       WHERE id = ?`,
      [
        title || null,
        content !== undefined ? content : null,
        tagsJson,
        isPinned !== undefined ? (isPinned ? 1 : 0) : null,
        now,
        id
      ]
    );

    return await this.getById(id);
  }

  static async delete(id) {
    const db = getDB();
    await db.run('DELETE FROM workspace_notes WHERE id = ?', [id]);
    return true;
  }

  static async togglePin(id) {
    const db = getDB();
    const note = await this.getById(id);
    if (!note) {
      throw new Error('یادداشت یافت نشد');
    }

    await db.run(
      `UPDATE workspace_notes 
       SET isPinned = ?, updatedAt = ?
       WHERE id = ?`,
      [note.isPinned ? 0 : 1, new Date().toISOString(), id]
    );

    return await this.getById(id);
  }
}

