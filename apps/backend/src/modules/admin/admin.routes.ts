import { Router } from 'express';
import { AdminController } from './admin.controller';
import { protect, restrictTo, checkTenantAccess } from '../../middleware/auth';
import { validate, validateQuery } from '../../utils/validation';
import { paginationValidation } from '../../utils/validation';
import { apiLimiter } from '../../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();
const adminController = new AdminController();

// Apply authentication and admin restriction to all routes
router.use(protect);
router.use(restrictTo('admin', 'moderator'));
router.use(apiLimiter);

// Validation schemas
const auditFiltersSchema = paginationValidation.keys({
  userId: Joi.string(),
  entityType: Joi.string(),
  entityId: Joi.string(),
  action: Joi.string().valid('create', 'read', 'update', 'delete', 'login', 'logout'),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
});

const userFiltersSchema = paginationValidation.keys({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'pending'),
  roles: Joi.string(), // comma-separated roles
  search: Joi.string().min(1),
});

const fileFiltersSchema = paginationValidation.keys({
  ownerId: Joi.string(),
  mimeType: Joi.string(),
  category: Joi.string().valid('image', 'video', 'audio', 'document', 'other'),
  search: Joi.string().min(1),
});

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'pending').required(),
});

const broadcastNotificationSchema = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error').required(),
  userIds: Joi.array().items(Joi.string()),
});

const exportDataSchema = Joi.object({
  dataType: Joi.string().valid('users', 'messages', 'files', 'notifications').required(),
  format: Joi.string().valid('json', 'csv').default('json'),
});

// System routes (no tenant required)
router.get('/dashboard/stats',
  checkTenantAccess,
  adminController.getDashboardStats
);

router.get('/system/health',
  adminController.getSystemHealth
);

// Tenant-specific routes
router.use(checkTenantAccess);

// Audit logs
router.get('/audit-logs',
  validateQuery(auditFiltersSchema),
  adminController.getAuditLogs
);

// User management
router.get('/users',
  validateQuery(userFiltersSchema),
  adminController.getUsers
);

router.patch('/users/:id/status',
  validate(updateUserStatusSchema),
  adminController.updateUserStatus
);

// File management
router.get('/files',
  validateQuery(fileFiltersSchema),
  adminController.getFiles
);

router.delete('/files/:id',
  restrictTo('admin'), // Only admins can delete files
  adminController.deleteFile
);

// Notifications
router.post('/notifications/broadcast',
  validate(broadcastNotificationSchema),
  adminController.broadcastNotification
);

// Data export
router.get('/export',
  restrictTo('admin'), // Only admins can export data
  validateQuery(exportDataSchema),
  adminController.exportData
);

export default router;