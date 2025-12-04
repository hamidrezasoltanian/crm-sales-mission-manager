import { getDB } from '../config/database.js';
import workflowBoardService from '../services/workflowBoardService.js';

export class Contact {
  static async getAll(filters = {}) {
    const db = getDB();
    let query = `
      SELECT 
        c.id,
        c.personnelId,
        c.centerId,
        c.contactType,
        c.notes,
        c.tags,
        c.createdAt,
        c.updatedAt,
        (p.first_name || ' ' || p.last_name) as personnelName,
        p.phone as personnelPhone,
        cen.name as centerName,
        cen.city as centerCity,
        cen.type as centerType,
        cen.responsiblePersonnelId as centerResponsiblePersonnelId
      FROM mission_contacts c
      LEFT JOIN personnel p ON c.personnelId = p.id
      LEFT JOIN centers cen ON c.centerId = cen.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.personnelId) {
      query += ' AND c.personnelId = ?';
      params.push(filters.personnelId);
    }
    
    if (filters.centerId) {
      query += ' AND c.centerId = ?';
      params.push(filters.centerId);
    }
    
    if (filters.contactType) {
      query += ' AND c.contactType = ?';
      params.push(filters.contactType);
    }
    
    if (filters.search) {
      query += ' AND (cen.name LIKE ? OR cen.city LIKE ? OR (p.first_name || \' \' || p.last_name) LIKE ? OR c.notes LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Pagination
    query += ' ORDER BY c.createdAt DESC';
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }
    
    const result = await db.all(query, params);
    
    return result.map(row => this.formatRow(row));
  }

  static async count(filters = {}) {
    const db = getDB();
    let query = `
      SELECT COUNT(*) as count
      FROM mission_contacts c
      LEFT JOIN personnel p ON c.personnelId = p.id
      LEFT JOIN centers cen ON c.centerId = cen.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.personnelId) {
      query += ' AND c.personnelId = ?';
      params.push(filters.personnelId);
    }
    
    if (filters.centerId) {
      query += ' AND c.centerId = ?';
      params.push(filters.centerId);
    }
    
    if (filters.contactType) {
      query += ' AND c.contactType = ?';
      params.push(filters.contactType);
    }
    
    if (filters.search) {
      query += ' AND (cen.name LIKE ? OR cen.city LIKE ? OR (p.first_name || \' \' || p.last_name) LIKE ? OR c.notes LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const result = await db.get(query, params);
    
    return result ? result.count : 0;
  }

  static async getById(id) {
    const db = getDB();
    const result = await db.get(`
      SELECT 
        c.id,
        c.personnelId,
        c.centerId,
        c.contactType,
        c.notes,
        c.tags,
        c.createdAt,
        c.updatedAt,
        (p.first_name || ' ' || p.last_name) as personnelName,
        p.phone as personnelPhone,
        cen.name as centerName,
        cen.city as centerCity,
        cen.type as centerType,
        cen.responsiblePersonnelId as centerResponsiblePersonnelId
      FROM mission_contacts c
      LEFT JOIN personnel p ON c.personnelId = p.id
      LEFT JOIN centers cen ON c.centerId = cen.id
      WHERE c.id = ?
    `, [id]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async create(data) {
    const db = getDB();
    
    const {
      personnelId,
      centerId,
      contactType = 'province',
      notes = null,
      tags = null
    } = data;
    
    if (!personnelId || !centerId) {
      throw new Error('personnelId و centerId الزامی است');
    }
    
    // تبدیل tags به JSON string اگر array است
    let tagsJson = null;
    if (tags) {
      if (Array.isArray(tags)) {
        tagsJson = JSON.stringify(tags);
      } else if (typeof tags === 'string') {
        tagsJson = tags;
      }
    }
    
    const now = new Date().toISOString();
    
    const result = await db.run(`
      INSERT INTO mission_contacts (
        personnelId, centerId, contactType, notes, tags, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      personnelId, centerId, contactType, notes, tagsJson, now, now
    ]);
    
    const createdContact = await this.getById(result.lastID);
    await workflowBoardService.handleContactCreated(createdContact);
    return createdContact;
  }

  static async update(id, data) {
    const db = getDB();
    
    const updates = [];
    const params = [];
    
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }
    
    if (data.tags !== undefined) {
      let tagsJson = null;
      if (data.tags) {
        if (Array.isArray(data.tags)) {
          tagsJson = JSON.stringify(data.tags);
        } else if (typeof data.tags === 'string') {
          tagsJson = data.tags;
        }
      }
      updates.push('tags = ?');
      params.push(tagsJson);
    }
    
    if (data.contactType !== undefined) {
      updates.push('contactType = ?');
      params.push(data.contactType);
    }
    
    if (updates.length === 0) {
      return await this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    await db.run(`
      UPDATE mission_contacts 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);
    
    return await this.getById(id);
  }

  static async delete(id) {
    const db = getDB();
    const contact = await this.getById(id);
    
    if (!contact) {
      return null;
    }
    
    await db.run('DELETE FROM mission_contacts WHERE id = ?', [id]);
    await workflowBoardService.handleContactDeleted(id);
    
    return contact;
  }

  static formatRow(row) {
    if (!row) return null;
    
    const obj = { ...row };
    
    // Parse tags JSON
    if (obj.tags && typeof obj.tags === 'string') {
      try {
        obj.tags = JSON.parse(obj.tags);
      } catch (e) {
        obj.tags = [];
      }
    } else if (!obj.tags) {
      obj.tags = [];
    }
    
    return obj;
  }
}
