import express from 'express';
import { Assignment } from '../models/Assignment.js';
import telegramBot from '../services/telegramBot.js';
import { flushReports } from '../services/cache.js';

const router = express.Router();

// Get all assignments with filters and pagination
router.get('/', async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default: 50 items per page
    const offset = (page - 1) * limit;
    
    const filters = {
      personnelId: req.query.personnelId ? parseInt(req.query.personnelId) : undefined,
      centerId: req.query.centerId ? parseInt(req.query.centerId) : undefined,
      status: req.query.status,
      managerId: req.query.managerId ? parseInt(req.query.managerId) : undefined,
      limit: limit,
      offset: offset
    };
    
    // Get total count for pagination metadata
    const totalCount = await Assignment.count({
      personnelId: filters.personnelId,
      centerId: filters.centerId,
      status: filters.status,
      managerId: filters.managerId
    });
    
    const assignments = await Assignment.getAll(filters);
    
    // Return paginated response
    res.json({
      data: assignments,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single assignment
router.get('/:id', async (req, res) => {
  try {
    const assignment = await Assignment.getById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'ماموریت یافت نشد' });
    }
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new assignment
router.post('/', async (req, res) => {
  try {
    if (!req.body.personnelId || !req.body.centerId) {
      return res.status(400).json({ error: 'پرسنل و مرکز الزامی است' });
    }

    const assignment = await Assignment.create(req.body);
    
    // حذف cache مربوط به reports
    flushReports();
    
    // اطلاع‌رسانی به ربات تلگرام
    if (assignment) {
      telegramBot.notifyNewAssignment(assignment).catch(err => {
        console.error('Error notifying telegram:', err);
      });
    }
    
    res.status(201).json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Approve assignment
router.post('/:id/approve', async (req, res) => {
  try {
    const { managerId, personalPayment, managerComment } = req.body;
    
    if (!managerId) {
      return res.status(400).json({ error: 'مدیر باید مشخص شود' });
    }

    const assignment = await Assignment.approve(req.params.id, managerId, personalPayment || 0, managerComment || null);
    
    // حذف cache مربوط به reports
    flushReports();
    
    // اطلاع‌رسانی به ربات تلگرام
    if (assignment) {
      telegramBot.notifyAssignmentApproval(assignment).catch(err => {
        console.error('Error notifying telegram:', err);
      });
    }
    
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reject assignment
router.post('/:id/reject', async (req, res) => {
  try {
    const { managerId, managerComment } = req.body;
    
    if (!managerId) {
      return res.status(400).json({ error: 'مدیر باید مشخص شود' });
    }

    const assignment = await Assignment.reject(req.params.id, managerId, managerComment || null);
    
    // حذف cache مربوط به reports
    flushReports();
    
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update assignment status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, userId } = req.body;
    
    if (!status || !userId) {
      return res.status(400).json({ error: 'وضعیت و کاربر الزامی است' });
    }

    const assignment = await Assignment.updateStatus(req.params.id, status, userId);
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update an assignment
router.put('/:id', async (req, res) => {
  try {
    const assignment = await Assignment.update(req.params.id, req.body);
    if (!assignment) {
      return res.status(404).json({ error: 'ماموریت یافت نشد' });
    }
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an assignment
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Assignment.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'ماموریت یافت نشد' });
    }
    res.json({ message: 'ماموریت با موفقیت حذف شد' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
