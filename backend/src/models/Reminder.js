import { getDB } from '../config/database.js'

export class Reminder {
  static async create(data) {
    const db = getDB()
    const { personnelId, title, description = null, entityType = null, entityId = null, reminderAt } = data

    if (!personnelId || !title || !reminderAt) {
      throw new Error('personnelId, title, and reminderAt are required')
    }

    const result = await db.run(
      `INSERT INTO reminders (personnelId, title, description, entityType, entityId, reminderAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [personnelId, title, description, entityType, entityId, reminderAt]
    )

    return await this.getById(result.lastID)
  }

  static async getById(id) {
    const db = getDB()
    const row = await db.get('SELECT * FROM reminders WHERE id = ?', [id])
    return row ? this.formatRow(row) : null
  }

  static async getAll(filters = {}) {
    const db = getDB()
    let query = 'SELECT * FROM reminders WHERE 1=1'
    const params = []

    if (filters.personnelId) {
      query += ' AND personnelId = ?'
      params.push(filters.personnelId)
    }

    if (filters.isCompleted !== undefined) {
      query += ' AND isCompleted = ?'
      params.push(filters.isCompleted ? 1 : 0)
    }

    if (filters.entityType && filters.entityId) {
      query += ' AND entityType = ? AND entityId = ?'
      params.push(filters.entityType, filters.entityId)
    }

    if (filters.upcoming) {
      query += ' AND reminderAt >= datetime("now") AND isCompleted = 0'
    }

    if (filters.past) {
      query += ' AND reminderAt < datetime("now") AND isCompleted = 0'
    }

    query += ' ORDER BY reminderAt ASC'

    if (filters.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    const rows = await db.all(query, params)
    return rows.map(row => this.formatRow(row))
  }

  static async markAsCompleted(id, personnelId) {
    const db = getDB()
    await db.run(
      'UPDATE reminders SET isCompleted = 1, completedAt = datetime("now") WHERE id = ? AND personnelId = ?',
      [id, personnelId]
    )
    return await this.getById(id)
  }

  static async update(id, personnelId, data) {
    const db = getDB()
    const updates = []
    const params = []

    if (data.title !== undefined) {
      updates.push('title = ?')
      params.push(data.title)
    }
    if (data.description !== undefined) {
      updates.push('description = ?')
      params.push(data.description)
    }
    if (data.reminderAt !== undefined) {
      updates.push('reminderAt = ?')
      params.push(data.reminderAt)
    }

    if (updates.length === 0) {
      return await this.getById(id)
    }

    params.push(id, personnelId)
    await db.run(
      `UPDATE reminders SET ${updates.join(', ')} WHERE id = ? AND personnelId = ?`,
      params
    )

    return await this.getById(id)
  }

  static async delete(id, personnelId) {
    const db = getDB()
    await db.run('DELETE FROM reminders WHERE id = ? AND personnelId = ?', [id, personnelId])
    return { success: true }
  }

  static async getUpcoming(personnelId, limit = 10) {
    return await this.getAll({
      personnelId,
      upcoming: true,
      limit
    })
  }

  static formatRow(row) {
    return {
      id: row.id,
      personnelId: row.personnelId,
      title: row.title,
      description: row.description,
      entityType: row.entityType,
      entityId: row.entityId,
      reminderAt: row.reminderAt,
      isCompleted: Boolean(row.isCompleted),
      completedAt: row.completedAt,
      createdAt: row.createdAt
    }
  }
}

