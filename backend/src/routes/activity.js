import express from 'express';
import { ActivityLog } from '../models/ActivityLog.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Get activity logs for current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await ActivityLog.getByUserId(req.user.id, limit);
    res.json({ logs });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'خطا در دریافت لاگ‌ها' });
  }
});

// Get all activity logs (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const { Personnel } = await import('../models/Personnel.js');
    const user = await Personnel.getById(req.user.id);
    
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : undefined,
      action: req.query.action || undefined,
      resourceType: req.query.resourceType || undefined,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined
    };

    const limit = parseInt(req.query.limit) || 100;
    const logs = await ActivityLog.getAll(filters, limit);
    res.json({ logs });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'خطا در دریافت لاگ‌ها' });
  }
});

// Get activity logs by action
router.get('/action/:action', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await ActivityLog.getByAction(req.params.action, limit);
    res.json({ logs });
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).json({ error: 'خطا در دریافت لاگ‌ها' });
  }
});

export default router;

