import express from 'express';
import { PermissionController } from '../controllers/permissionController.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all system modules
router.get('/modules', PermissionController.getModules);

// Get user permissions
router.get('/user/:userId', PermissionController.getUserPermissions);

// Grant permission
router.post('/grant', PermissionController.grantPermission);

// Revoke permission
router.post('/revoke', PermissionController.revokePermission);

// Bulk update permissions
router.post('/bulk-update', PermissionController.bulkUpdatePermissions);

// Get all permissions (admin view)
router.get('/all', PermissionController.getAllPermissions);

// Get permission logs
router.get('/logs/:userId', PermissionController.getPermissionLogs);

// Check permission
router.get('/check', PermissionController.checkPermission);

export default router;

