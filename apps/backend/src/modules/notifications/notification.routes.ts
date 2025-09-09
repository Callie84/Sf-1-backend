import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { protect, restrictTo, checkTenantAccess } from '../../middleware/auth';
import { validate, validateQuery } from '../../utils/validation';
import { notificationValidation, paginationValidation } from '../../utils/validation';
import { apiLimiter } from '../../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();
const notificationController = new NotificationController();

// Apply authentication to all routes
router.use(protect);
router.use(apiLimiter);

// Validation schemas
const markAsReadSchema = Joi.object({
  notificationIds: Joi.array().items(Joi.string()).required(),
});

const bulkNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).required(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error').required(),
  actionUrl: Joi.string().uri(),
  actionLabel: Joi.string(),
  category: Joi.string().valid('system', 'message', 'mention', 'reaction', 'invitation', 'payment', 'security'),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
  metadata: Joi.object(),
  channels: Joi.array().items(Joi.string().valid('in_app', 'email', 'push', 'sms')),
});

const systemNotificationSchema = Joi.object({
  message: Joi.string().required(),
  type: Joi.string().valid('info', 'success', 'warning', 'error').default('info'),
  userIds: Joi.array().items(Joi.string()),
});

const notificationFiltersSchema = paginationValidation.keys({
  read: Joi.boolean(),
  category: Joi.string().valid('system', 'message', 'mention', 'reaction', 'invitation', 'payment', 'security'),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
});

// Routes that require tenant context
router.use(checkTenantAccess);

// User routes
router.get('/',
  validateQuery(notificationFiltersSchema),
  notificationController.getNotifications
);

router.get('/unread-count',
  notificationController.getUnreadCount
);

router.post('/',
  validate(notificationValidation.create),
  notificationController.createNotification
);

router.patch('/mark-read',
  validate(markAsReadSchema),
  notificationController.markAsRead
);

router.patch('/mark-all-read',
  notificationController.markAllAsRead
);

router.delete('/:id',
  notificationController.deleteNotification
);

// Admin routes
router.post('/bulk',
  restrictTo('admin', 'moderator'),
  validate(bulkNotificationSchema),
  notificationController.createBulkNotifications
);

router.post('/system',
  restrictTo('admin'),
  validate(systemNotificationSchema),
  notificationController.createSystemNotification
);

export default router;