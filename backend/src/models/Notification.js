import { getDB } from '../config/database.js'

export class Notification {
  static async create(data) {
    const db = getDB()
    const { personnelId, title, message, type = 'info', entityType = null, entityId = null, actionUrl = null } = data

    if (!personnelId || !title || !message) {
      throw new Error('personnelId, title, and message are required')
    }

    const result = await db.run(
      `INSERT INTO notifications (personnelId, title, message, type, entityType, entityId, actionUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [personnelId, title, message, type, entityType, entityId, actionUrl]
    )

    return await this.getById(result.lastID)
  }

  static async getById(id) {
    const db = getDB()
    const row = await db.get('SELECT * FROM notifications WHERE id = ?', [id])
    return row ? this.formatRow(row) : null
  }

  static async getAll(filters = {}) {
    const db = getDB()
    let query = 'SELECT * FROM notifications WHERE 1=1'
    const params = []

    if (filters.personnelId) {
      query += ' AND personnelId = ?'
      params.push(filters.personnelId)
    }

    if (filters.isRead !== undefined) {
      query += ' AND isRead = ?'
      params.push(filters.isRead ? 1 : 0)
    }

    if (filters.type) {
      query += ' AND type = ?'
      params.push(filters.type)
    }

    if (filters.entityType && filters.entityId) {
      query += ' AND entityType = ? AND entityId = ?'
      params.push(filters.entityType, filters.entityId)
    }

    query += ' ORDER BY createdAt DESC'

    if (filters.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    const rows = await db.all(query, params)
    return rows.map(row => this.formatRow(row))
  }

  static async markAsRead(id, personnelId) {
    const db = getDB()
    await db.run(
      'UPDATE notifications SET isRead = 1, readAt = datetime("now") WHERE id = ? AND personnelId = ?',
      [id, personnelId]
    )
    return await this.getById(id)
  }

  static async markAllAsRead(personnelId) {
    const db = getDB()
    await db.run(
      'UPDATE notifications SET isRead = 1, readAt = datetime("now") WHERE personnelId = ? AND isRead = 0',
      [personnelId]
    )
    return await db.get('SELECT COUNT(*) as count FROM notifications WHERE personnelId = ? AND isRead = 1', [personnelId])
  }

  static async delete(id, personnelId) {
    const db = getDB()
    await db.run('DELETE FROM notifications WHERE id = ? AND personnelId = ?', [id, personnelId])
    return { success: true }
  }

  static async getUnreadCount(personnelId) {
    const db = getDB()
    const result = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE personnelId = ? AND isRead = 0',
      [personnelId]
    )
    return result?.count || 0
  }

  static formatRow(row) {
    return {
      id: row.id,
      personnelId: row.personnelId,
      title: row.title,
      message: row.message,
      type: row.type,
      entityType: row.entityType,
      entityId: row.entityId,
      isRead: Boolean(row.isRead),
      actionUrl: row.actionUrl,
      createdAt: row.createdAt,
      readAt: row.readAt
    }
  }
}

