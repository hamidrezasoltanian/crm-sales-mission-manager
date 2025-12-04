import express from 'express';
import { Workspace } from '../models/Workspace.js';
import { WorkspaceTag } from '../models/WorkspaceTag.js';
import { WorkspaceNote } from '../models/WorkspaceNote.js';
import { WorkspaceGoal } from '../models/WorkspaceGoal.js';
import { WorkspaceShare } from '../models/WorkspaceShare.js';
import { Assignment } from '../models/Assignment.js';
import { Contact } from '../models/Contact.js';
import { Center } from '../models/Center.js';
import { WorkflowBoard } from '../models/Workflow.js';
import { getDB } from '../config/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// همه workspace های یک کارمند
router.get('/', authenticateToken, async (req, res) => {
  try {
    const personnelId = req.user.id;
    const workspaces = await Workspace.getAllByPersonnelId(personnelId);
    res.json({ workspaces });
  } catch (error) {
    console.error('❌ Get workspaces error:', error);
    res.status(500).json({ error: 'خطا در دریافت workspace ها' });
  }
});

// دریافت workspace پیش‌فرض
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const personnelId = req.user.id;
    let workspace = await Workspace.getDefaultByPersonnelId(personnelId);
    
    // اگر workspace پیش‌فرض وجود نداشت، اولین workspace را برگردان
    if (!workspace) {
      const allWorkspaces = await Workspace.getAllByPersonnelId(personnelId);
      if (allWorkspaces.length > 0) {
        workspace = allWorkspaces[0];
        // آن را به عنوان default تنظیم کن
        await Workspace.setDefault(workspace.id);
      }
    }
    
    res.json({ workspace });
  } catch (error) {
    console.error('❌ Get default workspace error:', error);
    res.status(500).json({ error: 'خطا در دریافت workspace پیش‌فرض' });
  }
});

// دریافت یک workspace خاص
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    // بررسی دسترسی
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    res.json({ workspace });
  } catch (error) {
    console.error('❌ Get workspace error:', error);
    res.status(500).json({ error: 'خطا در دریافت workspace' });
  }
});

// ایجاد workspace جدید
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, color, icon, settings } = req.body;
    const personnelId = req.user.id;
    
    const workspace = await Workspace.create({
      personnelId,
      name,
      description,
      color,
      icon,
      settings
    });
    
    res.status(201).json({ workspace });
  } catch (error) {
    console.error('❌ Create workspace error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد workspace' });
  }
});

// ویرایش workspace
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    // بررسی دسترسی
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const updated = await Workspace.update(req.params.id, req.body);
    res.json({ workspace: updated });
  } catch (error) {
    console.error('❌ Update workspace error:', error);
    res.status(400).json({ error: error.message || 'خطا در ویرایش workspace' });
  }
});

// تنظیم workspace به عنوان پیش‌فرض
router.post('/:id/set-default', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    // بررسی دسترسی
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const updated = await Workspace.setDefault(req.params.id);
    res.json({ workspace: updated });
  } catch (error) {
    console.error('❌ Set default workspace error:', error);
    res.status(400).json({ error: error.message || 'خطا در تنظیم workspace پیش‌فرض' });
  }
});

// حذف workspace
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    // بررسی دسترسی
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await Workspace.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete workspace error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف workspace' });
  }
});

// ========== Filters & Settings ==========
router.put('/:id/filters', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const updated = await Workspace.updateFilters(req.params.id, req.body.filters);
    res.json({ workspace: updated });
  } catch (error) {
    console.error('❌ Update filters error:', error);
    res.status(400).json({ error: error.message || 'خطا در به‌روزرسانی فیلترها' });
  }
});

router.put('/:id/view-settings', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const updated = await Workspace.updateViewSettings(req.params.id, req.body.viewSettings);
    res.json({ workspace: updated });
  } catch (error) {
    console.error('❌ Update view settings error:', error);
    res.status(400).json({ error: error.message || 'خطا در به‌روزرسانی تنظیمات نمایش' });
  }
});

// ========== Dashboard ==========
router.get('/:id/dashboard', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    // Apply workspace filters
    const filters = workspace.filters || {};
    const assignmentFilters = {
      personnelId: filters.assignments?.personnelId || req.user.id,
      status: filters.assignments?.status,
      centerId: filters.assignments?.centerId,
      ...filters.assignments
    };
    
    const contactFilters = {
      personnelId: filters.contacts?.personnelId || req.user.id,
      contactType: filters.contacts?.contactType,
      ...filters.contacts
    };
    
    const centerFilters = {
      responsiblePersonnelId: filters.centers?.responsiblePersonnelId || req.user.id,
      type: filters.centers?.type,
      ...filters.centers
    };
    
    // Get statistics
    const [assignments, contacts, centers, assignmentStats, contactStats] = await Promise.all([
      Assignment.getAll({ ...assignmentFilters, limit: 10 }),
      Contact.getAll({ ...contactFilters, limit: 10 }),
      Center.getAll({ ...centerFilters, limit: 10 }),
      Promise.all([
        Assignment.count({ ...assignmentFilters, status: 'pending' }),
        Assignment.count({ ...assignmentFilters, status: 'approved' }),
        Assignment.count({ ...assignmentFilters, status: 'in-progress' }),
        Assignment.count({ ...assignmentFilters, status: 'completed' })
      ]),
      Promise.all([
        Contact.count({ ...contactFilters, contactType: 'call' }),
        Contact.count({ ...contactFilters, contactType: 'visit' }),
        Contact.count({ ...contactFilters, contactType: 'email' })
      ])
    ]);
    
    res.json({
      workspace,
      stats: {
        assignments: {
          pending: assignmentStats[0],
          approved: assignmentStats[1],
          inProgress: assignmentStats[2],
          completed: assignmentStats[3],
          total: assignmentStats.reduce((a, b) => a + b, 0)
        },
        contacts: {
          call: contactStats[0],
          visit: contactStats[1],
          email: contactStats[2],
          total: contactStats.reduce((a, b) => a + b, 0)
        },
        centers: {
          total: await Center.count(centerFilters)
        }
      },
      recent: {
        assignments,
        contacts,
        centers
      }
    });
  } catch (error) {
    console.error('❌ Get dashboard error:', error);
    res.status(500).json({ error: 'خطا در دریافت داشبورد' });
  }
});

// ========== Tags ==========
router.get('/:id/tags', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const tags = await WorkspaceTag.getAllByWorkspaceId(req.params.id);
    res.json({ tags });
  } catch (error) {
    console.error('❌ Get tags error:', error);
    res.status(500).json({ error: 'خطا در دریافت برچسب‌ها' });
  }
});

router.post('/:id/tags', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const tag = await WorkspaceTag.create({ ...req.body, workspaceId: req.params.id });
    res.status(201).json({ tag });
  } catch (error) {
    console.error('❌ Create tag error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد برچسب' });
  }
});

router.put('/:id/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const tag = await WorkspaceTag.update(req.params.tagId, req.body);
    res.json({ tag });
  } catch (error) {
    console.error('❌ Update tag error:', error);
    res.status(400).json({ error: error.message || 'خطا در ویرایش برچسب' });
  }
});

router.delete('/:id/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceTag.delete(req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete tag error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف برچسب' });
  }
});

router.post('/:id/tags/:tagId/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceTag.assignToAssignment(req.params.id, req.params.assignmentId, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Assign tag to assignment error:', error);
    res.status(400).json({ error: error.message || 'خطا در اختصاص برچسب' });
  }
});

router.delete('/:id/tags/:tagId/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceTag.removeFromAssignment(req.params.id, req.params.assignmentId, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Remove tag from assignment error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف برچسب' });
  }
});

router.post('/:id/tags/:tagId/centers/:centerId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceTag.assignToCenter(req.params.id, req.params.centerId, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Assign tag to center error:', error);
    res.status(400).json({ error: error.message || 'خطا در اختصاص برچسب' });
  }
});

router.delete('/:id/tags/:tagId/centers/:centerId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceTag.removeFromCenter(req.params.id, req.params.centerId, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Remove tag from center error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف برچسب' });
  }
});

// ========== Notes ==========
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const notes = await WorkspaceNote.getAllByWorkspaceId(req.params.id, req.query);
    res.json({ notes });
  } catch (error) {
    console.error('❌ Get notes error:', error);
    res.status(500).json({ error: 'خطا در دریافت یادداشت‌ها' });
  }
});

router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const note = await WorkspaceNote.create({ ...req.body, workspaceId: req.params.id });
    res.status(201).json({ note });
  } catch (error) {
    console.error('❌ Create note error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد یادداشت' });
  }
});

router.put('/:id/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const note = await WorkspaceNote.update(req.params.noteId, req.body);
    res.json({ note });
  } catch (error) {
    console.error('❌ Update note error:', error);
    res.status(400).json({ error: error.message || 'خطا در ویرایش یادداشت' });
  }
});

router.delete('/:id/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceNote.delete(req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete note error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف یادداشت' });
  }
});

router.post('/:id/notes/:noteId/toggle-pin', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const note = await WorkspaceNote.togglePin(req.params.noteId);
    res.json({ note });
  } catch (error) {
    console.error('❌ Toggle pin note error:', error);
    res.status(400).json({ error: error.message || 'خطا در تغییر وضعیت یادداشت' });
  }
});

// ========== Goals ==========
router.get('/:id/goals', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const goals = await WorkspaceGoal.getAllByWorkspaceId(req.params.id, req.query);
    res.json({ goals });
  } catch (error) {
    console.error('❌ Get goals error:', error);
    res.status(500).json({ error: 'خطا در دریافت اهداف' });
  }
});

router.post('/:id/goals', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const goal = await WorkspaceGoal.create({ ...req.body, workspaceId: req.params.id });
    res.status(201).json({ goal });
  } catch (error) {
    console.error('❌ Create goal error:', error);
    res.status(400).json({ error: error.message || 'خطا در ایجاد هدف' });
  }
});

router.put('/:id/goals/:goalId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const goal = await WorkspaceGoal.update(req.params.goalId, req.body);
    res.json({ goal });
  } catch (error) {
    console.error('❌ Update goal error:', error);
    res.status(400).json({ error: error.message || 'خطا در ویرایش هدف' });
  }
});

router.post('/:id/goals/:goalId/update-progress', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const goal = await WorkspaceGoal.updateProgress(req.params.goalId, req.body.currentValue);
    res.json({ goal });
  } catch (error) {
    console.error('❌ Update goal progress error:', error);
    res.status(400).json({ error: error.message || 'خطا در به‌روزرسانی پیشرفت' });
  }
});

router.post('/:id/goals/:goalId/toggle-complete', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const goal = await WorkspaceGoal.toggleComplete(req.params.goalId);
    res.json({ goal });
  } catch (error) {
    console.error('❌ Toggle goal complete error:', error);
    res.status(400).json({ error: error.message || 'خطا در تغییر وضعیت هدف' });
  }
});

router.delete('/:id/goals/:goalId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceGoal.delete(req.params.goalId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete goal error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف هدف' });
  }
});

// ========== Shares ==========
router.get('/:id/shares', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const shares = await WorkspaceShare.getAllByWorkspaceId(req.params.id);
    res.json({ shares });
  } catch (error) {
    console.error('❌ Get shares error:', error);
    res.status(500).json({ error: 'خطا در دریافت اشتراک‌گذاری‌ها' });
  }
});

router.post('/:id/shares', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const share = await WorkspaceShare.create({ ...req.body, workspaceId: req.params.id });
    res.status(201).json({ share });
  } catch (error) {
    console.error('❌ Create share error:', error);
    res.status(400).json({ error: error.message || 'خطا در اشتراک‌گذاری' });
  }
});

router.put('/:id/shares/:shareId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const share = await WorkspaceShare.update(req.params.shareId, req.body);
    res.json({ share });
  } catch (error) {
    console.error('❌ Update share error:', error);
    res.status(400).json({ error: error.message || 'خطا در ویرایش اشتراک‌گذاری' });
  }
});

router.delete('/:id/shares/:shareId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    if (workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    await WorkspaceShare.delete(req.params.shareId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete share error:', error);
    res.status(400).json({ error: error.message || 'خطا در حذف اشتراک‌گذاری' });
  }
});

// Get shared workspaces for current user
router.get('/shared/me', authenticateToken, async (req, res) => {
  try {
    const shares = await WorkspaceShare.getAllByPersonnelId(req.user.id);
    res.json({ shares });
  } catch (error) {
    console.error('❌ Get shared workspaces error:', error);
    res.status(500).json({ error: 'خطا در دریافت workspace های اشتراکی' });
  }
});

// ========== Workflow Board Integration ==========
router.get('/:id/workflow-boards', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const db = getDB();
    const connections = await db.all(
      `SELECT wwb.*, wb.slug, wb.name as boardName, wb.description as boardDescription
       FROM workspace_workflow_boards wwb
       LEFT JOIN workflow_boards wb ON wwb.workflowBoardId = wb.id
       WHERE wwb.workspaceId = ?`,
      [req.params.id]
    );
    
    res.json({ connections });
  } catch (error) {
    console.error('❌ Get workflow boards error:', error);
    res.status(500).json({ error: 'خطا در دریافت workflow boards' });
  }
});

router.post('/:id/workflow-boards', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const { workflowBoardId, isDefault } = req.body;
    const db = getDB();
    
    // If this is set as default, unset others
    if (isDefault) {
      await db.run(
        `UPDATE workspace_workflow_boards SET isDefault = 0 WHERE workspaceId = ?`,
        [req.params.id]
      );
    }
    
    const result = await db.run(
      `INSERT OR REPLACE INTO workspace_workflow_boards (workspaceId, workflowBoardId, isDefault, createdAt)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, workflowBoardId, isDefault ? 1 : 0, new Date().toISOString()]
    );
    
    const connection = await db.get(
      `SELECT wwb.*, wb.slug, wb.name as boardName
       FROM workspace_workflow_boards wwb
       LEFT JOIN workflow_boards wb ON wwb.workflowBoardId = wb.id
       WHERE wwb.id = ?`,
      [result.lastID]
    );
    
    res.status(201).json({ connection });
  } catch (error) {
    console.error('❌ Connect workflow board error:', error);
    res.status(400).json({ error: error.message || 'خطا در اتصال workflow board' });
  }
});

router.delete('/:id/workflow-boards/:connectionId', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'write');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const db = getDB();
    await db.run('DELETE FROM workspace_workflow_boards WHERE id = ?', [req.params.connectionId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Disconnect workflow board error:', error);
    res.status(400).json({ error: error.message || 'خطا در قطع اتصال workflow board' });
  }
});

// Get all available workflow boards for selection
router.get('/:id/available-workflow-boards', authenticateToken, async (req, res) => {
  try {
    const workspace = await Workspace.getById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace یافت نشد' });
    }
    
    const hasAccess = await WorkspaceShare.hasAccess(req.params.id, req.user.id, 'read');
    if (!hasAccess && workspace.personnelId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    
    const allBoards = await WorkflowBoard.getAll();
    const db = getDB();
    const connectedBoards = await db.all(
      `SELECT workflowBoardId FROM workspace_workflow_boards WHERE workspaceId = ?`,
      [req.params.id]
    );
    const connectedIds = connectedBoards.map(cb => cb.workflowBoardId);
    
    const availableBoards = allBoards.filter(board => !connectedIds.includes(board.id));
    
    res.json({ boards: availableBoards });
  } catch (error) {
    console.error('❌ Get available workflow boards error:', error);
    res.status(500).json({ error: 'خطا در دریافت workflow boards' });
  }
});

export default router;

