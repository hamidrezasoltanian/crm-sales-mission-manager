import { Permission } from '../models/Permission.js';
import { Personnel } from '../models/Personnel.js';
import { AuthController } from './authController.js';

export class PermissionController {
  /**
   * Get all system modules
   */
  static async getModules(req, res) {
    try {
      // Only super_admin and admin can view modules
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const modules = await Permission.getAllModules();
      res.json({ modules });
    } catch (error) {
      console.error('Error getting modules:', error);
      res.status(500).json({ message: 'خطا در دریافت ماژول‌ها' });
    }
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Users can view their own permissions, or admin/super_admin can view any
      if (parseInt(userId) !== requestingUserId && 
          req.user.role !== 'super_admin' && 
          req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const permissions = await Permission.getUserPermissions(userId);
      res.json({ permissions });
    } catch (error) {
      console.error('Error getting user permissions:', error);
      res.status(500).json({ message: 'خطا در دریافت دسترسی‌ها' });
    }
  }

  /**
   * Grant permission to user
   */
  static async grantPermission(req, res) {
    try {
      // Only super_admin and admin can grant permissions
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const { userId, moduleKey, permission, notes } = req.body;

      if (!userId || !moduleKey || !permission) {
        return res.status(400).json({ message: 'اطلاعات ناقص است' });
      }

      // Verify user exists
      const user = await Personnel.getById(userId);
      if (!user) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      // Verify module exists
      const module = await Permission.getModuleByKey(moduleKey);
      if (!module) {
        return res.status(404).json({ message: 'ماژول یافت نشد' });
      }

      await Permission.grantPermission(userId, moduleKey, permission, req.user.id, notes);

      // Log activity
      await AuthController.logActivity(
        req.user.id,
        'permission_granted',
        { userId, moduleKey, permission },
        req
      );

      res.json({ message: 'دسترسی با موفقیت اعطا شد' });
    } catch (error) {
      console.error('Error granting permission:', error);
      res.status(500).json({ message: 'خطا در اعطای دسترسی' });
    }
  }

  /**
   * Revoke permission from user
   */
  static async revokePermission(req, res) {
    try {
      // Only super_admin and admin can revoke permissions
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const { userId, moduleKey, permission, reason } = req.body;

      if (!userId || !moduleKey || !permission) {
        return res.status(400).json({ message: 'اطلاعات ناقص است' });
      }

      await Permission.revokePermission(userId, moduleKey, permission, req.user.id, reason);

      // Log activity
      await AuthController.logActivity(
        req.user.id,
        'permission_revoked',
        { userId, moduleKey, permission, reason },
        req
      );

      res.json({ message: 'دسترسی با موفقیت لغو شد' });
    } catch (error) {
      console.error('Error revoking permission:', error);
      res.status(500).json({ message: 'خطا در لغو دسترسی' });
    }
  }

  /**
   * Bulk update permissions
   */
  static async bulkUpdatePermissions(req, res) {
    try {
      // Only super_admin and admin can update permissions
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const { userId, permissions } = req.body;

      if (!userId || !Array.isArray(permissions)) {
        return res.status(400).json({ message: 'اطلاعات ناقص است' });
      }

      // Verify user exists
      const user = await Personnel.getById(userId);
      if (!user) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      await Permission.bulkUpdatePermissions(userId, permissions, req.user.id);

      // Log activity
      await AuthController.logActivity(
        req.user.id,
        'permissions_bulk_updated',
        { userId, count: permissions.length },
        req
      );

      res.json({ message: 'دسترسی‌ها با موفقیت به‌روزرسانی شدند' });
    } catch (error) {
      console.error('Error bulk updating permissions:', error);
      res.status(500).json({ message: 'خطا در به‌روزرسانی دسترسی‌ها' });
    }
  }

  /**
   * Get all permissions (admin view)
   */
  static async getAllPermissions(req, res) {
    try {
      // Only super_admin and admin can view all permissions
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId) : undefined,
        moduleKey: req.query.moduleKey,
        granted: req.query.granted !== undefined ? req.query.granted === 'true' : undefined
      };

      const permissions = await Permission.getAllPermissions(filters);
      res.json({ permissions });
    } catch (error) {
      console.error('Error getting all permissions:', error);
      res.status(500).json({ message: 'خطا در دریافت دسترسی‌ها' });
    }
  }

  /**
   * Get permission logs
   */
  static async getPermissionLogs(req, res) {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Users can view their own logs, or admin/super_admin can view any
      if (parseInt(userId) !== requestingUserId && 
          req.user.role !== 'super_admin' && 
          req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const limit = parseInt(req.query.limit) || 50;
      const logs = await Permission.getPermissionLogs(userId, limit);
      res.json({ logs });
    } catch (error) {
      console.error('Error getting permission logs:', error);
      res.status(500).json({ message: 'خطا در دریافت لاگ دسترسی‌ها' });
    }
  }

  /**
   * Check if user has permission
   */
  static async checkPermission(req, res) {
    try {
      const { userId, moduleKey, permission } = req.query;

      if (!userId || !moduleKey || !permission) {
        return res.status(400).json({ message: 'اطلاعات ناقص است' });
      }

      // Users can check their own permissions, or admin/super_admin can check any
      if (parseInt(userId) !== req.user.id && 
          req.user.role !== 'super_admin' && 
          req.user.role !== 'admin') {
        return res.status(403).json({ message: 'دسترسی غیرمجاز' });
      }

      const hasPermission = await Permission.hasPermission(userId, moduleKey, permission);
      res.json({ hasPermission });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ message: 'خطا در بررسی دسترسی' });
    }
  }
}

