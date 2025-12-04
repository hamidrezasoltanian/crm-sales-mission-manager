import { getDB } from '../config/database.js';

const serializeMaybeJSON = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return null;
  }
};

const toJSON = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return value;
};

export class ActivityLog {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      details: toJSON(row.details)
    };
  }

  static async create(data) {
    const db = getDB();
    const { userId, action, resourceType, resourceId, details, ipAddress, userAgent } = data;

    if (!userId || !action) {
      throw new Error('userId و action الزامی هستند');
    }

    const result = await db.run(
      `INSERT INTO user_activity_logs (userId, action, resourceType, resourceId, details, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        action,
        resourceType || null,
        resourceId || null,
        serializeMaybeJSON(details),
        ipAddress || null,
        userAgent || null
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM user_activity_logs WHERE id = ?', [id]);
    if (!row) return null;
    return this.format(row);
  }

  static async getByUserId(userId, limit = 50) {
    const db = getDB();
    const rows = await db.all(
      `SELECT * FROM user_activity_logs 
       WHERE userId = ? 
       ORDER BY createdAt DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows.map(row => this.format(row));
  }

  static async getByAction(action, limit = 50) {
    const db = getDB();
    const rows = await db.all(
      `SELECT * FROM user_activity_logs 
       WHERE action = ? 
       ORDER BY createdAt DESC 
       LIMIT ?`,
      [action, limit]
    );
    return rows.map(row => this.format(row));
  }

  static async getAll(filters = {}, limit = 100) {
    const db = getDB();
    let query = 'SELECT * FROM user_activity_logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND userId = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.resourceType) {
      query += ' AND resourceType = ?';
      params.push(filters.resourceType);
    }

    if (filters.startDate) {
      query += ' AND createdAt >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND createdAt <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY createdAt DESC LIMIT ?';
    params.push(limit);

    const rows = await db.all(query, params);
    return rows.map(row => this.format(row));
  }
}

