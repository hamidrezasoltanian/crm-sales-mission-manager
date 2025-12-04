import { getDB, autoSave } from '../config/database.js';

export class Mission {
  static getAll() {
    const db = getDB();
    const result = db.exec(`
      SELECT * FROM missions 
      ORDER BY createdAt DESC
    `);
    
    if (!result.length || !result[0].values.length) {
      return [];
    }
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const mission = {};
      columns.forEach((col, index) => {
        mission[col] = row[index];
      });
      return {
        ...mission,
        _id: mission.id.toString()
      };
    });
  }

  static getById(id) {
    const db = getDB();
    const result = db.exec('SELECT * FROM missions WHERE id = ?', [id]);
    
    if (!result.length || !result[0].values.length) {
      return null;
    }
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const mission = {};
    columns.forEach((col, index) => {
      mission[col] = row[index];
    });
    
    return {
      ...mission,
      _id: mission.id.toString()
    };
  }

  static create(data) {
    const db = getDB();
    const { title, description, status = 'pending', priority = 'medium', assignedTo, dueDate } = data;
    
    const now = new Date().toISOString();
    
    db.run(`
      INSERT INTO missions (title, description, status, priority, assignedTo, dueDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, description || null, status, priority, assignedTo || null, dueDate || null, now, now]);
    
    // دریافت آخرین ID
    const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
    const lastId = lastIdResult[0].values[0][0];
    
    // ذخیره تغییرات
    autoSave();
    
    return this.getById(lastId);
  }

  static update(id, data) {
    const db = getDB();
    
    // بررسی وجود mission
    const existing = this.getById(id);
    if (!existing) return null;
    
    const { title, description, status, priority, assignedTo, dueDate } = data;
    const now = new Date().toISOString();
    
    // ساخت query به صورت پویا
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (assignedTo !== undefined) {
      updates.push('assignedTo = ?');
      values.push(assignedTo);
    }
    if (dueDate !== undefined) {
      updates.push('dueDate = ?');
      values.push(dueDate);
    }
    
    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    db.run(`
      UPDATE missions 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);
    
    // ذخیره تغییرات
    autoSave();
    
    return this.getById(id);
  }

  static delete(id) {
    const db = getDB();
    const mission = this.getById(id);
    
    if (!mission) return false;
    
    db.run('DELETE FROM missions WHERE id = ?', [id]);
    
    // ذخیره تغییرات
    autoSave();
    
    return true;
  }
}