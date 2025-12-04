import path from 'path';
import { getDB } from '../config/database.js';

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

const normalizeTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // ignore
  }
  return String(value)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
};

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

export class WorkflowBoard {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      meta: toJSON(row.meta)
    };
  }

  static async getAll(options = {}) {
    const db = getDB();
    const boards = await db.all(
      'SELECT * FROM workflow_boards WHERE isActive = 1 ORDER BY id ASC'
    );
    const formattedBoards = boards.map(board => this.format(board));

    if (!options.includeLists && !options.includeCards) {
      return formattedBoards;
    }

    const boardIds = formattedBoards.map(board => board.id);
    const listsMap = options.includeLists
      ? await WorkflowList.getListsGroupedByBoard(boardIds)
      : {};

    let cardsMap = {};
    if (options.includeCards) {
      cardsMap = await WorkflowCard.getCardsGroupedByBoard(boardIds);
    }

    return formattedBoards.map(board => ({
      ...board,
      lists: options.includeLists ? (listsMap[board.id] || []) : undefined,
      cards: options.includeCards ? (cardsMap[board.id] || []) : undefined
    }));
  }

  static async getBySlug(slug, options = {}) {
    const db = getDB();
    const row = await db.get(
      'SELECT * FROM workflow_boards WHERE slug = ? AND isActive = 1',
      [slug]
    );
    if (!row) {
      return null;
    }
    const board = this.format(row);

    if (options.includeLists) {
      board.lists = await WorkflowList.getByBoardId(board.id);
    }

    if (options.includeCards) {
      board.cards = await WorkflowCard.getByBoardId(board.id, {
        includeRelations: true
      });
    }

    return board;
  }
}

export class WorkflowList {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      meta: toJSON(row.meta)
    };
  }

  static async getByBoardId(boardId) {
    const db = getDB();
    const rows = await db.all(
      'SELECT * FROM workflow_lists WHERE boardId = ? ORDER BY position ASC',
      [boardId]
    );
    return rows.map(row => this.format(row));
  }

  static async getListsGroupedByBoard(boardIds = []) {
    if (!boardIds || boardIds.length === 0) {
      return {};
    }
    const db = getDB();
    const placeholders = boardIds.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT * FROM workflow_lists WHERE boardId IN (${placeholders}) ORDER BY boardId, position`,
      boardIds
    );
    return rows.reduce((acc, row) => {
      const formatted = this.format(row);
      if (!acc[row.boardId]) {
        acc[row.boardId] = [];
      }
      acc[row.boardId].push(formatted);
      return acc;
    }, {});
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workflow_lists WHERE id = ?', [id]);
    return this.format(row);
  }

  static async delete(id) {
    if (!id) {
      return false;
    }
    const db = getDB();
    await db.run('DELETE FROM workflow_cards WHERE id = ?', [id]);
    return true;
  }
}

export class WorkflowCard {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      tags: normalizeTags(row.tags),
      meta: toJSON(row.meta)
    };
  }

  static async getByBoardId(boardId, options = {}) {
    const db = getDB();
    const rows = await db.all(
      `
        SELECT c.*, l.title as listTitle, l.key as listKey
        FROM workflow_cards c
        LEFT JOIN workflow_lists l ON c.listId = l.id
        WHERE c.boardId = ?
        ORDER BY c.updatedAt DESC
      `,
      [boardId]
    );
    const cards = rows.map(row => this.format(row));

    if (!options.includeRelations || cards.length === 0) {
      return cards;
    }

    const centerIds = [...new Set(cards.map(card => card.centerId).filter(Boolean))];
    const personnelIds = [...new Set(cards.map(card => card.assigneeId).filter(Boolean))];
    const relations = await this.fetchRelations(centerIds, personnelIds);

    return cards.map(card => ({
      ...card,
      center: relations.centers[card.centerId] || null,
      assignee: relations.personnel[card.assigneeId] || null
    }));
  }

  static async getByEntity(entityType, entityId) {
    if (!entityType || !entityId) {
      return null;
    }
    const db = getDB();
    const row = await db.get(
      `
        SELECT id
        FROM workflow_cards
        WHERE entityType = ? AND entityId = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [entityType, entityId]
    );
    if (!row) {
      return null;
    }
    return this.getById(row.id);
  }

  static async getCardsGroupedByBoard(boardIds = []) {
    if (!boardIds || boardIds.length === 0) {
      return {};
    }
    const db = getDB();
    const placeholders = boardIds.map(() => '?').join(',');
    const rows = await db.all(
      `
        SELECT c.*, l.title as listTitle, l.key as listKey
        FROM workflow_cards c
        LEFT JOIN workflow_lists l ON c.listId = l.id
        WHERE c.boardId IN (${placeholders})
        ORDER BY c.boardId, c.updatedAt DESC
      `,
      boardIds
    );

    const cards = rows.map(row => this.format(row));
    const grouped = {};
    for (const card of cards) {
      if (!grouped[card.boardId]) {
        grouped[card.boardId] = [];
      }
      grouped[card.boardId].push(card);
    }

    return grouped;
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get(
      `
        SELECT c.*, l.title as listTitle, l.key as listKey
        FROM workflow_cards c
        LEFT JOIN workflow_lists l ON c.listId = l.id
        WHERE c.id = ?
      `,
      [id]
    );
    if (!row) {
      return null;
    }

    const card = this.format(row);
    const relations = await this.fetchRelations(
      card.centerId ? [card.centerId] : [],
      card.assigneeId ? [card.assigneeId] : []
    );

    return {
      ...card,
      center: relations.centers[card.centerId] || null,
      assignee: relations.personnel[card.assigneeId] || null
    };
  }

  static async create(data) {
    const requiredFields = ['boardId', 'listId'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`فیلد ${field} الزامی است`);
      }
    }

    const db = getDB();
    const list = await db.get(
      'SELECT id, boardId FROM workflow_lists WHERE id = ?',
      [data.listId]
    );
    if (!list) {
      throw new Error('لیست انتخاب‌شده وجود ندارد');
    }
    if (list.boardId !== data.boardId) {
      throw new Error('لیست انتخاب‌شده متعلق به برد دیگری است');
    }

    const entityPayload = (data.entityId && data.entityType)
      ? await this.buildPayloadFromEntity(data.entityType, data.entityId)
      : {};

    const title = data.title || entityPayload.title;
    if (!title) {
      throw new Error('عنوان کارت الزامی است');
    }

    const centerId = data.centerId || entityPayload.centerId || null;
    const description = data.description || entityPayload.description || null;

    // برای ماموریت‌های جدید، نیاز به تایید مدیر است
    const approvalStatus = (data.entityType === 'mission' && !data.entityId) ? 'pending' : (data.approvalStatus || null);
    
    const result = await db.run(
      `
        INSERT INTO workflow_cards (
          boardId, listId, entityType, entityId, centerId,
          title, description, notes, status, priority, assigneeId,
          dueDate, reminderAt, tags, meta, approvalStatus, approverId
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.boardId,
        data.listId,
        data.entityType || null,
        data.entityId || null,
        centerId,
        title,
        description,
        data.notes || null,
        data.status || 'open',
        data.priority || 'normal',
        data.assigneeId || null,
        data.dueDate || null,
        data.reminderAt || null,
        serializeMaybeJSON(data.tags || entityPayload.tags || []),
        serializeMaybeJSON({
          ...(entityPayload.meta || {}),
          ...(data.meta || {})
        }),
        approvalStatus,
        data.approverId || null
      ]
    );

    const cardId = result.lastID;

    await this.recordActivity(cardId, data.actorId || null, 'create', {
      title,
      entityType: data.entityType,
      entityId: data.entityId || null
    });

    return this.getById(cardId);
  }

  static async update(id, data) {
    const db = getDB();
    const allowedFields = [
      'listId',
      'status',
      'priority',
      'assigneeId',
      'dueDate',
      'reminderAt',
      'title',
      'description',
      'notes',
      'tags',
      'meta',
      'centerId',
      'approvalStatus',
      'approverId'
    ];

    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (data[field] === undefined) {
        continue;
      }
      if (field === 'tags') {
        setClauses.push('tags = ?');
        params.push(serializeMaybeJSON(data.tags));
      } else if (field === 'meta') {
        setClauses.push('meta = ?');
        params.push(serializeMaybeJSON(data.meta));
      } else {
        setClauses.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    if (setClauses.length === 0) {
      return this.getById(id);
    }

    setClauses.push("updatedAt = datetime('now')");

    await db.run(
      `
        UPDATE workflow_cards
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `,
      [...params, id]
    );

    if (data.listId) {
      await this.recordActivity(id, data.actorId || null, 'move', {
        listId: data.listId
      });
    } else {
      await this.recordActivity(id, data.actorId || null, 'update', {
        fields: allowedFields.filter(field => data[field] !== undefined)
      });
    }

    return this.getById(id);
  }

  static async recordActivity(cardId, actorId, action, details = null) {
    const db = getDB();
    await db.run(
      `
        INSERT INTO workflow_card_activity (cardId, actorId, action, details)
        VALUES (?, ?, ?, ?)
      `,
      [cardId, actorId || null, action, serializeMaybeJSON(details)]
    );
  }

  static async getActivity(cardId, limit = 50) {
    const db = getDB();
    const rows = await db.all(
      `
        SELECT a.*, (p.first_name || ' ' || p.last_name) as actorName
        FROM workflow_card_activity a
        LEFT JOIN personnel p ON a.actorId = p.id
        WHERE a.cardId = ?
        ORDER BY a.createdAt DESC
        LIMIT ?
      `,
      [cardId, limit]
    );

    return rows.map(row => ({
      ...row,
      details: toJSON(row.details)
    }));
  }

  static async buildPayloadFromEntity(entityType, entityId) {
    const db = getDB();
    if (!entityId) {
      return {};
    }

    if (entityType === 'mission') {
      const mission = await db.get(
        `
          SELECT ma.id, ma.centerId, ma.status, ma.notes, ma.createdAt,
                 c.name as centerName, c.city, c.province
          FROM mission_assignments ma
          LEFT JOIN centers c ON ma.centerId = c.id
          WHERE ma.id = ?
        `,
        [entityId]
      );
      if (!mission) {
        throw new Error('ماموریت مورد نظر یافت نشد');
      }

      return {
        title: `ماموریت: ${mission.centerName || 'مرکز ناشناخته'}`,
        description: `وضعیت جاری: ${mission.status || 'نامشخص'}\n${mission.notes || ''}`.trim(),
        centerId: mission.centerId,
        tags: ['mission'],
        meta: {
          centerName: mission.centerName,
          city: mission.city,
          province: mission.province,
          entityCreatedAt: mission.createdAt
        }
      };
    }

    if (entityType === 'contact') {
      const contact = await db.get(
        `
          SELECT mc.id, mc.centerId, mc.contactType, mc.notes, mc.createdAt,
                 c.name as centerName, c.city, c.province
          FROM mission_contacts mc
          LEFT JOIN centers c ON mc.centerId = c.id
          WHERE mc.id = ?
        `,
        [entityId]
      );
      if (!contact) {
        throw new Error('تماس مورد نظر یافت نشد');
      }

      return {
        title: `تماس ${contact.contactType === 'tehran' ? 'تهران' : 'استانی'} - ${contact.centerName || 'مرکز'}`,
        description: contact.notes || null,
        centerId: contact.centerId,
        tags: ['contact', contact.contactType].filter(Boolean),
        meta: {
          centerName: contact.centerName,
          city: contact.city,
          province: contact.province,
          entityCreatedAt: contact.createdAt
        }
      };
    }

    return {
      title: null,
      description: null,
      centerId: null,
      tags: [entityType],
      meta: {
        entityType
      }
    };
  }

  static async fetchRelations(centerIds = [], personnelIds = []) {
    const db = getDB();
    const centers = {};
    const personnel = {};

    if (centerIds.length) {
      const placeholders = centerIds.map(() => '?').join(',');
      const rows = await db.all(
        `SELECT id, name, city, province FROM centers WHERE id IN (${placeholders})`,
        centerIds
      );
      rows.forEach(row => {
        centers[row.id] = row;
      });
    }

    if (personnelIds.length) {
      const placeholders = personnelIds.map(() => '?').join(',');
      const rows = await db.all(
        `SELECT id, (first_name || ' ' || last_name) as name, role FROM personnel WHERE id IN (${placeholders})`,
        personnelIds
      );
      rows.forEach(row => {
        personnel[row.id] = row;
      });
    }

    return { centers, personnel };
  }
}

const normalizeAttachmentUrl = (row) => {
  if (!row) return null;
  if (row.url) {
    return row.url;
  }
  if (row.fileName) {
    return `/api/uploads/workflow-reports/${row.fileName}`;
  }
  if (row.path) {
    const normalizedPath = row.path.replace(/\\/g, '/');
    const idx = normalizedPath.lastIndexOf('workflow-reports/');
    if (idx >= 0) {
      return `/api/uploads/${normalizedPath.slice(idx)}`;
    }
  }
  return null;
};

export class WorkflowCardReport {
  static format(row) {
    if (!row) return null;
    return {
      ...row,
      taggedPersonnelIds: normalizeTags(row.taggedPersonnelIds),
      attachments: row.attachments || []
    };
  }

  static async getByCardId(cardId) {
    const db = getDB();
    const rows = await db.all(
      'SELECT * FROM workflow_card_reports WHERE cardId = ? ORDER BY createdAt ASC',
      [cardId]
    );
    const reports = rows.map(row => this.format(row));
    const reportIds = reports.map(r => r.id);
    let attachmentsMap = {};
    if (reportIds.length > 0) {
      attachmentsMap = await WorkflowCardReportFile.getGroupedByReportIds(reportIds);
    }
    
    // Fetch authors and tagged personnel
    const authorIds = [...new Set(reports.map(r => r.authorId).filter(Boolean))];
    const allTaggedIds = reports.flatMap(r => r.taggedPersonnelIds || []).filter(Boolean);
    const personnelIds = [...new Set([...authorIds, ...allTaggedIds])];
    
    if (personnelIds.length === 0) {
      return reports.map(r => ({
        ...r,
        author: null,
        taggedPersonnel: [],
        attachments: attachmentsMap[r.id] || []
      }));
    }
    
    const placeholders = personnelIds.map(() => '?').join(',');
    const personnelRows = await db.all(
      `SELECT id, (first_name || ' ' || last_name) as name, role FROM personnel WHERE id IN (${placeholders})`,
      personnelIds
    );
    const personnelMap = {};
    personnelRows.forEach(p => {
      personnelMap[p.id] = { id: p.id, name: p.name, role: p.role };
    });
    
    return reports.map(r => ({
      ...r,
      author: personnelMap[r.authorId] || null,
      taggedPersonnel: (r.taggedPersonnelIds || []).map(id => personnelMap[id]).filter(Boolean),
      attachments: attachmentsMap[r.id] || []
    }));
  }

  static async create(data) {
    const db = getDB();
    const { cardId, authorId, message, taggedPersonnelIds = [] } = data;
    
    if (!cardId || !authorId || !message) {
      throw new Error('cardId, authorId و message الزامی هستند');
    }
    
    const result = await db.run(
      `INSERT INTO workflow_card_reports (cardId, authorId, message, taggedPersonnelIds)
       VALUES (?, ?, ?, ?)`,
      [cardId, authorId, message, serializeMaybeJSON(taggedPersonnelIds)]
    );
    
    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = getDB();
    const row = await db.get('SELECT * FROM workflow_card_reports WHERE id = ?', [id]);
    if (!row) return null;
    
    const report = this.format(row);
    const author = await db.get('SELECT id, (first_name || \' \' || last_name) as name, role FROM personnel WHERE id = ?', [report.authorId]);
    report.author = author ? { id: author.id, name: author.name, role: author.role } : null;
    
    if (report.taggedPersonnelIds && report.taggedPersonnelIds.length > 0) {
      const placeholders = report.taggedPersonnelIds.map(() => '?').join(',');
      const taggedRows = await db.all(
        `SELECT id, (first_name || ' ' || last_name) as name, role FROM personnel WHERE id IN (${placeholders})`,
        report.taggedPersonnelIds
      );
      report.taggedPersonnel = taggedRows.map(p => ({ id: p.id, name: p.name, role: p.role }));
    } else {
      report.taggedPersonnel = [];
    }
    const attachments = await WorkflowCardReportFile.getByReportId(report.id);
    report.attachments = attachments;
    
    return report;
  }

  static async delete(id) {
    const db = getDB();
    await db.run('DELETE FROM workflow_card_reports WHERE id = ?', [id]);
    return true;
  }
}

class WorkflowCardReportFile {
  static mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      reportId: row.reportId,
      cardId: row.cardId,
      fileName: row.fileName,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      path: row.path,
      url: normalizeAttachmentUrl(row),
      createdAt: row.createdAt
    };
  }

  static async createMany(reportId, cardId, files = []) {
    if (!files?.length) {
      return [];
    }
    const db = getDB();
    for (const file of files) {
      const relativePath = path
        .relative(process.cwd(), file.path)
        .replace(/\\/g, '/');
      await db.run(
        `INSERT INTO workflow_card_report_files 
          (reportId, cardId, fileName, originalName, mimeType, size, path, url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          cardId,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size || 0,
          relativePath,
          `/api/uploads/workflow-reports/${file.filename}`
        ]
      );
    }
    return this.getByReportId(reportId);
  }

  static async getByReportId(reportId) {
    const db = getDB();
    const rows = await db.all(
      'SELECT * FROM workflow_card_report_files WHERE reportId = ? ORDER BY createdAt ASC',
      [reportId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  static async getGroupedByReportIds(reportIds = []) {
    if (!reportIds.length) {
      return {};
    }
    const db = getDB();
    const placeholders = reportIds.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT * FROM workflow_card_report_files 
       WHERE reportId IN (${placeholders})
       ORDER BY createdAt ASC`,
      reportIds
    );
    return rows.reduce((acc, row) => {
      const mapped = this.mapRow(row);
      if (!acc[row.reportId]) {
        acc[row.reportId] = [];
      }
      acc[row.reportId].push(mapped);
      return acc;
    }, {});
  }
}

export { WorkflowCardReportFile };


