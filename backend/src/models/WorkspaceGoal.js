import { getDB } from '../config/database.js';

export class WorkspaceGoal {
  static formatRow(row) {
    if (!row) return null;
    return {
      ...row,
      isCompleted: row.isCompleted === 1,
      targetValue: row.targetValue || 0,
      currentValue: row.currentValue || 0,
      progress: row.targetValue > 0 
        ? Math.min(100, Math.round((row.currentValue / row.targetValue) * 100))
        : 0
    };
  }

  static async getAllByWorkspaceId(workspaceId, filters = {}) {
    const db = getDB();
    let query = `SELECT * FROM workspace_goals WHERE workspaceId = ?`;
    const params = [workspaceId];

    if (filters.isCompleted !== undefined) {
      query += ` AND isCompleted = ?`;
      params.push(filters.isCompleted ? 1 : 0);
    }

    if (filters.overdue) {
      query += ` AND deadline < ? AND isCompleted = 0`;
      params.push(new Date().toISOString());
    }

    query += ` ORDER BY isCompleted ASC, deadline ASC, createdAt DESC`;

    const rows = await db.all(query, params);
    return rows.map(row => this.formatRow(row));
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workspace_goals WHERE id = ?', [id]);
    return row ? this.formatRow(row) : null;
  }

  static async create(data) {
    const db = getDB();
    const { workspaceId, title, description, targetValue, unit, deadline } = data;
    
    if (!workspaceId || !title) {
      throw new Error('workspaceId و title الزامی است');
    }

    const now = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO workspace_goals (workspaceId, title, description, targetValue, unit, deadline, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workspaceId,
        title,
        description || null,
        targetValue || 0,
        unit || 'عدد',
        deadline || null,
        now,
        now
      ]
    );

    return await this.getById(result.lastID);
  }

  static async update(id, data) {
    const db = getDB();
    const { title, description, targetValue, currentValue, unit, deadline, isCompleted } = data;
    
    const now = new Date().toISOString();

    await db.run(
      `UPDATE workspace_goals 
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           targetValue = COALESCE(?, targetValue),
           currentValue = COALESCE(?, currentValue),
           unit = COALESCE(?, unit),
           deadline = COALESCE(?, deadline),
           isCompleted = COALESCE(?, isCompleted),
           updatedAt = ?
       WHERE id = ?`,
      [
        title || null,
        description !== undefined ? description : null,
        targetValue !== undefined ? targetValue : null,
        currentValue !== undefined ? currentValue : null,
        unit || null,
        deadline !== undefined ? deadline : null,
        isCompleted !== undefined ? (isCompleted ? 1 : 0) : null,
        now,
        id
      ]
    );

    return await this.getById(id);
  }

  static async updateProgress(id, currentValue) {
    const db = getDB();
    const goal = await this.getById(id);
    if (!goal) {
      throw new Error('هدف یافت نشد');
    }

    const now = new Date().toISOString();
    const isCompleted = goal.targetValue > 0 && currentValue >= goal.targetValue;

    await db.run(
      `UPDATE workspace_goals 
       SET currentValue = ?, isCompleted = ?, updatedAt = ?
       WHERE id = ?`,
      [currentValue, isCompleted ? 1 : 0, now, id]
    );

    return await this.getById(id);
  }

  static async delete(id) {
    const db = getDB();
    await db.run('DELETE FROM workspace_goals WHERE id = ?', [id]);
    return true;
  }

  static async toggleComplete(id) {
    const db = getDB();
    const goal = await this.getById(id);
    if (!goal) {
      throw new Error('هدف یافت نشد');
    }

    await db.run(
      `UPDATE workspace_goals 
       SET isCompleted = ?, updatedAt = ?
       WHERE id = ?`,
      [goal.isCompleted ? 0 : 1, new Date().toISOString(), id]
    );

    return await this.getById(id);
  }
}

