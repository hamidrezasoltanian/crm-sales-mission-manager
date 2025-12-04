import express from 'express';
import { WorkflowBoard, WorkflowCard, WorkflowList, WorkflowCardReport, WorkflowCardReportFile } from '../models/Workflow.js';
import { parseTaggedPersonnelIds, parseId } from '../utils/parsers.js';
import { reportAttachmentUpload } from '../middleware/upload.js';

const router = express.Router();

router.get('/boards', async (req, res) => {
  try {
    const includeCards = req.query.includeCards === 'true';
    const boards = await WorkflowBoard.getAll({
      includeLists: true,
      includeCards
    });
    res.json({ boards });
  } catch (error) {
    console.error('❌ Workflow boards error:', error);
    res.status(500).json({ error: 'خطا در دریافت بردها' });
  }
});

router.get('/boards/:slug', async (req, res) => {
  try {
    const includeCards = req.query.includeCards === 'true';
    let board = await WorkflowBoard.getBySlug(req.params.slug, {
      includeLists: true,
      includeCards
    });
    
    // If board not found and it's a personal board (user-{id}), create it
    if (!board && req.params.slug.startsWith('user-')) {
      try {
        const personnelId = parseInt(req.params.slug.replace('user-', ''), 10);
        console.log(`[Workflow] Creating personal board for user ${personnelId}`);
        
        if (personnelId && !isNaN(personnelId)) {
          const { getDB } = await import('../config/database.js');
          const db = getDB();
          
          // Get user info
          const user = await db.get('SELECT first_name, last_name FROM personnel WHERE id = ?', [personnelId]);
          if (user) {
            const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || `کاربر ${personnelId}`;
            const personalSlug = `user-${personnelId}`;
            
            const meta = {
              entityTypes: ['mission', 'contact'],
              description: `برد عملیات شخصی ${userName}`,
              personnelId: personnelId
            };

            console.log(`[Workflow] Creating board with slug: ${personalSlug}`);
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
            console.log(`[Workflow] Board created with ID: ${boardId}`);
            
            // Create default lists
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

            console.log(`[Workflow] Lists created for board ${boardId}`);

            // Load the newly created board
            board = await WorkflowBoard.getBySlug(personalSlug, {
              includeLists: true,
              includeCards
            });
            
            console.log(`[Workflow] Board loaded successfully: ${board ? 'yes' : 'no'}`);
          } else {
            console.log(`[Workflow] User ${personnelId} not found`);
          }
        }
      } catch (createError) {
        console.error('[Workflow] Error creating personal board:', createError);
        // Don't throw, just log - we'll return 404 if board still doesn't exist
      }
    }
    
    if (!board) {
      return res.status(404).json({ error: 'برد یافت نشد' });
    }
    res.json({ board });
  } catch (error) {
    console.error('❌ Workflow board detail error:', error);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات برد' });
  }
});

router.get('/boards/:slug/lists', async (req, res) => {
  try {
    const board = await WorkflowBoard.getBySlug(req.params.slug, {
      includeLists: true
    });
    if (!board) {
      return res.status(404).json({ error: 'برد یافت نشد' });
    }
    res.json({ lists: board.lists || [] });
  } catch (error) {
    console.error('❌ Workflow lists error:', error);
    res.status(500).json({ error: 'خطا در دریافت لیست‌ها' });
  }
});

router.get('/boards/:slug/cards', async (req, res) => {
  try {
    const board = await WorkflowBoard.getBySlug(req.params.slug);
    if (!board) {
      return res.status(404).json({ error: 'برد یافت نشد' });
    }
    const cards = await WorkflowCard.getByBoardId(board.id, {
      includeRelations: true
    });
    res.json({ cards });
  } catch (error) {
    console.error('❌ Workflow cards error:', error);
    res.status(500).json({ error: 'خطا در دریافت کارت‌ها' });
  }
});

router.get('/cards/:id', async (req, res) => {
  try {
    const card = await WorkflowCard.getById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'کارت یافت نشد' });
    }
    res.json({ card });
  } catch (error) {
    console.error('❌ Workflow card detail error:', error);
    res.status(500).json({ error: 'خطا در دریافت کارت' });
  }
});

router.get('/cards/:id/activity', async (req, res) => {
  try {
    const activity = await WorkflowCard.getActivity(
      req.params.id,
      parseInt(req.query.limit, 10) || 50
    );
    res.json({ activity });
  } catch (error) {
    console.error('❌ Workflow activity error:', error);
    res.status(500).json({ error: 'خطا در دریافت تاریخچه کارت' });
  }
});

router.post('/cards', async (req, res) => {
  try {
    const card = await WorkflowCard.create(req.body);
    res.status(201).json({ card });
  } catch (error) {
    console.error('❌ Workflow create card error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد کارت' });
  }
});

router.patch('/cards/:id', async (req, res) => {
  try {
    const card = await WorkflowCard.update(req.params.id, req.body);
    if (!card) {
      return res.status(404).json({ error: 'کارت یافت نشد' });
    }
    res.json({ card });
  } catch (error) {
    console.error('❌ Workflow update card error:', error);
    res.status(400).json({ error: error.message || 'خطا در به‌روزرسانی کارت' });
  }
});

router.post('/cards/:id/move', async (req, res) => {
  try {
    if (!req.body.listId) {
      return res.status(400).json({ error: 'listId الزامی است' });
    }

    const targetList = await WorkflowList.getById(req.body.listId);
    if (!targetList) {
      return res.status(404).json({ error: 'لیست هدف یافت نشد' });
    }

    const card = await WorkflowCard.update(req.params.id, {
      listId: req.body.listId,
      actorId: req.body.actorId || null
    });

    res.json({ card });
  } catch (error) {
    console.error('❌ Workflow move card error:', error);
    res.status(400).json({ error: error.message || 'خطا در انتقال کارت' });
  }
});

// Card Reports (Chat/Messages)
router.get('/cards/:id/reports', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    if (!cardId || isNaN(cardId)) {
      return res.status(400).json({ error: 'شناسه کارت نامعتبر است' });
    }
    const reports = await WorkflowCardReport.getByCardId(cardId);
    res.json({ reports });
  } catch (error) {
    console.error('❌ Workflow card reports error:', error);
    res.status(500).json({ error: 'خطا در دریافت گزارشات' });
  }
});

router.post('/cards/:id/reports', reportAttachmentUpload.array('files'), async (req, res) => {
  try {
    const { authorId, message } = req.body;
    
    // Parse and validate card ID
    let cardId;
    try {
      cardId = parseId(req.params.id, 'کارت');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!authorId || !message) {
      return res.status(400).json({ error: 'authorId و message الزامی هستند' });
    }
    
    // Parse tagged personnel IDs using utility function
    const taggedPersonnelIds = parseTaggedPersonnelIds(req.body.taggedPersonnelIds);

    console.log('Creating report:', {
      cardId,
      authorId,
      message,
      taggedPersonnelIds,
      hasFiles: Array.isArray(req.files) && req.files.length > 0
    });
    
    const report = await WorkflowCardReport.create({
      cardId: cardId,
      authorId: parseInt(authorId, 10),
      message,
      taggedPersonnelIds
    });

    if (Array.isArray(req.files) && req.files.length > 0) {
      await WorkflowCardReportFile.createMany(report.id, cardId, req.files);
    }

    const hydratedReport = await WorkflowCardReport.getById(report.id);
    console.log('Report created successfully:', hydratedReport?.id);
    res.status(201).json({ report: hydratedReport });
  } catch (error) {
    console.error('❌ Workflow create report error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد گزارش' });
  }
});

router.delete('/cards/:cardId/reports/:reportId', async (req, res) => {
  try {
    await WorkflowCardReport.delete(req.params.reportId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Workflow delete report error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف گزارش' });
  }
});

// Card Approval
router.post('/cards/:id/approve', async (req, res) => {
  try {
    const { approverId } = req.body;
    if (!approverId) {
      return res.status(400).json({ error: 'approverId الزامی است' });
    }
    const card = await WorkflowCard.update(req.params.id, {
      approvalStatus: 'approved',
      approverId
    });
    if (!card) {
      return res.status(404).json({ error: 'کارت یافت نشد' });
    }
    await WorkflowCard.recordActivity(req.params.id, approverId, 'approve', {
      approverId
    });
    res.json({ card });
  } catch (error) {
    console.error('❌ Workflow approve card error:', error);
    res.status(400).json({ error: error.message || 'خطا در تایید کارت' });
  }
});

router.post('/cards/:id/reject', async (req, res) => {
  try {
    const { approverId, reason } = req.body;
    if (!approverId) {
      return res.status(400).json({ error: 'approverId الزامی است' });
    }
    const card = await WorkflowCard.update(req.params.id, {
      approvalStatus: 'rejected',
      approverId
    });
    if (!card) {
      return res.status(404).json({ error: 'کارت یافت نشد' });
    }
    await WorkflowCard.recordActivity(req.params.id, approverId, 'reject', {
      approverId,
      reason
    });
    res.json({ card });
  } catch (error) {
    console.error('❌ Workflow reject card error:', error);
    res.status(400).json({ error: error.message || 'خطا در رد کارت' });
  }
});

export default router;


