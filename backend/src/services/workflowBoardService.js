import { WorkflowBoard, WorkflowCard } from '../models/Workflow.js';
import { getDB } from '../config/database.js';

const DEFAULT_BOARD_SLUG = process.env.WORKFLOW_BOARD_SLUG || 'ops-master';
const WORKFLOW_CARD_BASE_URL =
  process.env.WORKFLOW_CARD_BASE_URL ||
  process.env.DASHBOARD_BASE_URL ||
  'http://127.0.0.1:2000';
const LIST_KEYS = {
  mission: {
    pending: 'new',
    approved: 'waiting',
    waiting: 'waiting',
    'in-progress': 'in_progress',
    in_progress: 'in_progress',
    'in-progress-review': 'waiting',
    completed: 'done',
    rejected: 'done',
    cancelled: 'done'
  },
  contact: {
    default: 'new'
  }
};

const boardCache = {
  board: null,
  loadedAt: 0
};

const cacheTTL = 60 * 1000; // 1 minute

const logError = (context, error) => {
  console.error(`[WorkflowBoardService] ${context}`, error);
};

const loadBoardWithLists = async () => {
  const now = Date.now();
  if (boardCache.board && now - boardCache.loadedAt < cacheTTL) {
    return boardCache.board;
  }

  const board = await WorkflowBoard.getBySlug(DEFAULT_BOARD_SLUG, {
    includeLists: true
  });

  if (!board) {
    throw new Error(`Workflow board "${DEFAULT_BOARD_SLUG}" not found`);
  }

  boardCache.board = board;
  boardCache.loadedAt = now;
  return board;
};

/**
 * Get or create personal workflow board for a user
 * @param {number} personnelId - The ID of the personnel/user
 * @returns {Promise<Object>} The personal workflow board
 */
/**
 * Get or create personal workflow board for a user
 * @param {number} personnelId - The ID of the personnel/user
 * @returns {Promise<Object>} The personal workflow board
 */
const getOrCreatePersonalBoard = async (personnelId) => {
  if (!personnelId) {
    // Fallback to default board if no personnelId
    return await loadBoardWithLists();
  }

  const db = getDB();
  
  // Check if personal board exists
  const personalSlug = `user-${personnelId}`;
  let board = await WorkflowBoard.getBySlug(personalSlug, {
    includeLists: true
  });

  if (!board) {
    // Create personal board
    console.log(`[WorkflowBoardService] Creating personal board for user ${personnelId}`);
    
    // Get user info for board name
    const user = await db.get('SELECT first_name, last_name FROM personnel WHERE id = ?', [personnelId]);
    const userName = user ? `${user.first_name} ${user.last_name}` : `کاربر ${personnelId}`;
    
    const meta = {
      entityTypes: ['mission', 'contact'],
      description: `برد عملیات شخصی ${userName}`,
      personnelId: personnelId
    };

    const result = await db.run(`
      INSERT INTO workflow_boards (slug, name, description, scope, meta, isActive)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [
      personalSlug,
      `برد عملیات ${userName}`,
      `برد عملیات شخصی برای ${userName}`,
      'personal',
      JSON.stringify(meta)
    ]);

    const boardId = result.lastID;
    
    // Create default lists for personal board
    const defaultLists = [
      { key: 'new', title: 'درخواست جدید', statusCategory: 'backlog', position: 10 },
      { key: 'in_progress', title: 'در حال انجام', statusCategory: 'in_progress', position: 20 },
      { key: 'waiting', title: 'منتظر تایید', statusCategory: 'waiting', position: 30 },
      { key: 'done', title: 'تکمیل شده', statusCategory: 'done', position: 40 }
    ];

    for (const list of defaultLists) {
      await db.run(`
        INSERT INTO workflow_lists (boardId, key, title, position, statusCategory, isDefault, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        boardId,
        list.key,
        list.title,
        list.position,
        list.statusCategory,
        list.key === 'new' ? 1 : 0,
        JSON.stringify({ autoStatus: list.key })
      ]);
    }

    // Load the newly created board
    board = await WorkflowBoard.getBySlug(personalSlug, {
      includeLists: true
    });
  }

  return board;
};

const pickListByKey = (board, key) => {
  if (!board?.lists?.length) {
    throw new Error('Workflow board lists are not initialized');
  }

  if (!key) {
    return board.lists[0];
  }

  return (
    board.lists.find((list) => list.key === key) ||
    board.lists.find((list) => list.isDefault === 1) ||
    board.lists[0]
  );
};

const getMissionListKey = (status = 'pending') => {
  const normalized = status?.toLowerCase() || 'pending';
  return LIST_KEYS.mission[normalized] || LIST_KEYS.mission.pending;
};

const buildMissionCardPayload = (assignment) => {
  const centerLabel = assignment.centerName || `مرکز #${assignment.centerId}`;
  const title = `ماموریت: ${centerLabel}`;
  const descriptionParts = [];

  if (assignment.status) {
    descriptionParts.push(`وضعیت جاری: ${assignment.status}`);
  }
  if (assignment.notes) {
    descriptionParts.push(`یادداشت: ${assignment.notes}`);
  }
  if (assignment.centerNotes) {
    descriptionParts.push(`یادداشت مرکز: ${assignment.centerNotes}`);
  }

  return {
    title,
    description: descriptionParts.join('\n'),
    tags: ['mission'].concat(assignment.status ? [assignment.status] : []),
    meta: {
      status: assignment.status,
      centerName: assignment.centerName || null,
      centerId: assignment.centerId,
      personnelName: assignment.personnelName || null,
      createdAt: assignment.createdAt || null
    }
  };
};

const buildShareUrl = (cardId) => {
  if (!cardId) {
    return null;
  }
  const base = WORKFLOW_CARD_BASE_URL.replace(/\/$/, '');
  return `${base}?view=workflow&cardId=${cardId}`;
};

const createMissionCard = async (assignment) => {
  if (!assignment?.id) return;

  // Get personal board for the user who created the assignment
  const personnelId = assignment.personnelId;
  const board = await getOrCreatePersonalBoard(personnelId);
  const list = pickListByKey(board, getMissionListKey(assignment.status));
  const payload = buildMissionCardPayload(assignment);

  const card = await WorkflowCard.create({
    boardId: board.id,
    listId: list.id,
    entityType: 'mission',
    entityId: assignment.id,
    centerId: assignment.centerId || null,
    title: payload.title,
    description: payload.description,
    tags: payload.tags,
    meta: payload.meta
  });
  return card;
};

const deleteMissionCard = async (assignmentId) => {
  if (!assignmentId) return;
  const card = await WorkflowCard.getByEntity('mission', assignmentId);
  if (card) {
    await WorkflowCard.delete(card.id);
  }
};

const updateMissionCard = async (assignment) => {
  if (!assignment?.id) return;

  const card = await WorkflowCard.getByEntity('mission', assignment.id);
  if (!card) {
    await createMissionCard(assignment);
    return;
  }

  // Get the board that contains this card (should be personal board)
  const db = getDB();
  const boardRow = await db.get('SELECT * FROM workflow_boards WHERE id = ?', [card.boardId]);
  if (!boardRow) {
    // If board doesn't exist, recreate card in personal board
    await createMissionCard(assignment);
    return;
  }

  const board = await WorkflowBoard.getBySlug(boardRow.slug, {
    includeLists: true
  });
  const targetList = pickListByKey(board, getMissionListKey(assignment.status));

  const updates = {
    status: assignment.status,
    title: buildMissionCardPayload(assignment).title,
    description: buildMissionCardPayload(assignment).description,
    meta: {
      ...(card.meta || {}),
      status: assignment.status,
      centerName: assignment.centerName || card.meta?.centerName,
      personnelName: assignment.personnelName || card.meta?.personnelName
    }
  };

  if (targetList && card.listId !== targetList.id) {
    updates.listId = targetList.id;
  }

  await WorkflowCard.update(card.id, updates);
  const updated = await WorkflowCard.getById(card.id);
  return updated;
};

const buildContactCardPayload = (contact) => {
  const centerLabel = contact.centerName || `مرکز #${contact.centerId}`;
  const title = `تماس ${contact.contactType === 'tehran' ? 'تهران' : 'استانی'} - ${centerLabel}`;
  const descriptionParts = [];
  if (contact.personnelName) {
    descriptionParts.push(`مسئول: ${contact.personnelName}`);
  }
  if (contact.notes) {
    descriptionParts.push(`توضیحات: ${contact.notes}`);
  }
  return {
    title,
    description: descriptionParts.join('\n'),
    tags: ['contact', contact.contactType || 'province'],
    meta: {
      centerName: contact.centerName || null,
      centerId: contact.centerId,
      personnelName: contact.personnelName || null,
      contactType: contact.contactType
    }
  };
};

const createContactCard = async (contact) => {
  if (!contact?.id) return;

  const board = await loadBoardWithLists();
  const list = pickListByKey(board, LIST_KEYS.contact.default);
  const payload = buildContactCardPayload(contact);

  const card = await WorkflowCard.create({
    boardId: board.id,
    listId: list.id,
    entityType: 'contact',
    entityId: contact.id,
    centerId: contact.centerId || null,
    title: payload.title,
    description: payload.description,
    tags: payload.tags,
    meta: payload.meta
  });
  return card;
};

const deleteContactCard = async (contactId) => {
  if (!contactId) return;
  const card = await WorkflowCard.getByEntity('contact', contactId);
  if (card) {
    await WorkflowCard.delete(card.id);
  }
};

const workflowBoardService = {
  async handleAssignmentCreated(assignment) {
    try {
      const card = await createMissionCard(assignment);
      return card;
    } catch (error) {
      logError('handleAssignmentCreated', error);
    }
  },

  async handleAssignmentStatusChange(assignment) {
    try {
      const card = await updateMissionCard(assignment);
      return card;
    } catch (error) {
      logError('handleAssignmentStatusChange', error);
    }
  },

  async handleAssignmentDeleted(assignmentId) {
    try {
      await deleteMissionCard(assignmentId);
    } catch (error) {
      logError('handleAssignmentDeleted', error);
    }
  },

  async handleContactCreated(contact) {
    try {
      const card = await createContactCard(contact);
      return card;
    } catch (error) {
      logError('handleContactCreated', error);
    }
  },

  async handleContactDeleted(contactId) {
    try {
      await deleteContactCard(contactId);
    } catch (error) {
      logError('handleContactDeleted', error);
    }
  },

  async getCardLinkForEntity(entityType, entityId) {
    try {
      const card = await WorkflowCard.getByEntity(entityType, entityId);
      if (!card) {
        return null;
      }
      return buildShareUrl(card.id);
    } catch (error) {
      logError('getCardLinkForEntity', error);
      return null;
    }
  }
};

export default workflowBoardService;
