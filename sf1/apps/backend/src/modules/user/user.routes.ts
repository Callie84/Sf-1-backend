import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, requirePermission, requireRole } from '@/middleware/auth';
import { Permission, UserRole } from '@/types';
import { authLimiter, apiLimiter } from '@/middleware/rateLimit';

const router = Router();

// Apply rate limiting to all user routes
router.use(authLimiter);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Public (for signup) or Admin
 */
router.post(
  '/',
  UserController.createUserValidation,
  UserController.createUser
);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  UserController.getCurrentUser
);

/**
 * @route   GET /api/users
 * @desc    Get users with filters and pagination
 * @access  Private (requires USER_READ permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission(Permission.USER_READ),
  UserController.getUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (requires USER_READ permission)
 */
router.get(
  '/stats',
  authenticate,
  requirePermission(Permission.USER_READ),
  UserController.getUserStats
);

/**
 * @route   GET /api/users/export
 * @desc    Export users to CSV
 * @access  Private (requires USER_READ permission)
 */
router.get(
  '/export',
  authenticate,
  requirePermission(Permission.USER_READ),
  UserController.exportUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (requires USER_READ permission or own profile)
 */
router.get(
  '/:id',
  authenticate,
  async (req, res, next) => {
    // Users can view their own profile without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_READ permission
    return requirePermission(Permission.USER_READ)(req, res, next);
  },
  UserController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (requires USER_UPDATE permission or own profile)
 */
router.put(
  '/:id',
  authenticate,
  UserController.updateUserValidation,
  async (req, res, next) => {
    // Users can update their own profile without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_UPDATE permission
    return requirePermission(Permission.USER_UPDATE)(req, res, next);
  },
  UserController.updateUser
);

/**
 * @route   PATCH /api/users/:id/preferences
 * @desc    Update user preferences
 * @access  Private (requires USER_UPDATE permission or own profile)
 */
router.patch(
  '/:id/preferences',
  authenticate,
  async (req, res, next) => {
    // Users can update their own preferences without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_UPDATE permission
    return requirePermission(Permission.USER_UPDATE)(req, res, next);
  },
  UserController.updatePreferences
);

/**
 * @route   PATCH /api/users/:id/notification-settings
 * @desc    Update user notification settings
 * @access  Private (requires USER_UPDATE permission or own profile)
 */
router.patch(
  '/:id/notification-settings',
  authenticate,
  async (req, res, next) => {
    // Users can update their own notification settings without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_UPDATE permission
    return requirePermission(Permission.USER_UPDATE)(req, res, next);
  },
  UserController.updateNotificationSettings
);

/**
 * @route   PATCH /api/users/:id/change-password
 * @desc    Change user password
 * @access  Private (requires USER_UPDATE permission or own profile)
 */
router.patch(
  '/:id/change-password',
  authenticate,
  UserController.changePasswordValidation,
  async (req, res, next) => {
    // Users can change their own password without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_UPDATE permission
    return requirePermission(Permission.USER_UPDATE)(req, res, next);
  },
  UserController.changePassword
);

/**
 * @route   PATCH /api/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (requires USER_UPDATE permission)
 */
router.patch(
  '/:id/reset-password',
  authenticate,
  requirePermission(Permission.USER_UPDATE),
  UserController.resetPasswordValidation,
  UserController.resetPassword
);

/**
 * @route   PATCH /api/users/:id/deactivate
 * @desc    Deactivate user
 * @access  Private (requires USER_UPDATE permission)
 */
router.patch(
  '/:id/deactivate',
  authenticate,
  requirePermission(Permission.USER_UPDATE),
  UserController.deactivateUser
);

/**
 * @route   PATCH /api/users/:id/reactivate
 * @desc    Reactivate user
 * @access  Private (requires USER_UPDATE permission)
 */
router.patch(
  '/:id/reactivate',
  authenticate,
  requirePermission(Permission.USER_UPDATE),
  UserController.reactivateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (requires USER_DELETE permission or own profile)
 */
router.delete(
  '/:id',
  authenticate,
  async (req, res, next) => {
    // Users can delete their own account without special permission
    if (req.user && req.params.id === req.user._id) {
      return next();
    }
    // Otherwise require USER_DELETE permission
    return requirePermission(Permission.USER_DELETE)(req, res, next);
  },
  UserController.deleteUser
);

/**
 * @route   PATCH /api/users/bulk-update
 * @desc    Bulk update users
 * @access  Private (requires USER_UPDATE permission)
 */
router.patch(
  '/bulk-update',
  authenticate,
  requirePermission(Permission.USER_UPDATE),
  UserController.bulkUpdateUsers
);

// Admin-only routes
router.use('/admin', authenticate, requireRole([UserRole.ADMIN]));

/**
 * @route   GET /api/users/admin/analytics
 * @desc    Get advanced user analytics (admin only)
 * @access  Private (admin only)
 */
router.get('/admin/analytics', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Advanced analytics endpoint - to be implemented'
    }
  });
});

/**
 * @route   POST /api/users/admin/import
 * @desc    Import users from CSV (admin only)
 * @access  Private (admin only)
 */
router.post('/admin/import', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'User import endpoint - to be implemented'
    }
  });
});

export default router;