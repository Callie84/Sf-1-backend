import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService, CreateUserData, UpdateUserData, UserFilters, UserPagination } from './user.service';
import { AuthenticatedRequest } from '@/types';
import { authenticate, requirePermission, requireRole } from '@/middleware/auth';
import { Permission, UserRole } from '@/types';
import { logger } from '@/utils/logger';
import { createModuleLogger } from '@/utils/logger';

const moduleLogger = createModuleLogger('user-controller');

export class UserController {
  /**
   * Validation rules for user creation
   */
  public static createUserValidation = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('username')
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('firstName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name is required and must be less than 50 characters'),
    body('lastName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name is required and must be less than 50 characters'),
    body('role')
      .optional()
      .isIn(Object.values(UserRole))
      .withMessage('Invalid role specified')
  ];

  /**
   * Validation rules for user updates
   */
  public static updateUserValidation = [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('profilePicture')
      .optional()
      .isURL()
      .withMessage('Profile picture must be a valid URL'),
    body('preferences.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Theme must be light, dark, or auto'),
    body('preferences.language')
      .optional()
      .isLength({ min: 2, max: 5 })
      .withMessage('Language must be 2-5 characters'),
    body('preferences.timezone')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Timezone must be 1-50 characters')
  ];

  /**
   * Validation rules for password change
   */
  public static changePasswordValidation = [
    body('currentPassword')
      .isLength({ min: 1 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ];

  /**
   * Validation rules for password reset
   */
  public static resetPasswordValidation = [
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ];

  /**
   * Create a new user
   * POST /api/users
   */
  public static async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userData: CreateUserData = {
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role,
        tenantId: req.tenantId,
        preferences: req.body.preferences
      };

      const user = await UserService.createUser(userData);

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error creating user:', error);
      
      if (error.message === 'Email already exists' || error.message === 'Username already exists') {
        res.status(409).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create user'
        });
      }
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  public static async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const user = await UserService.getUserById(userId, req.tenantId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      moduleLogger.error('Error getting user by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user'
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/users/profile
   */
  public static async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      res.json({
        success: true,
        data: req.user
      });
    } catch (error: any) {
      moduleLogger.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }
  }

  /**
   * Update user
   * PUT /api/users/:id
   */
  public static async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userId = req.params.id;
      const updateData: UpdateUserData = req.body;

      // Users can only update their own profile unless they have permission
      if (userId !== req.user?._id && !req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to update this user'
        });
        return;
      }

      const user = await UserService.updateUser(userId, updateData, req.tenantId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user'
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  public static async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;

      // Users can only delete their own account unless they have permission
      if (userId !== req.user?._id && !req.permissions?.includes(Permission.USER_DELETE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to delete this user'
        });
        return;
      }

      const deleted = await UserService.deleteUser(userId, req.tenantId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  }

  /**
   * Deactivate user
   * PATCH /api/users/:id/deactivate
   */
  public static async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;

      if (!req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to deactivate user'
        });
        return;
      }

      const deactivated = await UserService.deactivateUser(userId, req.tenantId);

      if (!deactivated) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error deactivating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate user'
      });
    }
  }

  /**
   * Reactivate user
   * PATCH /api/users/:id/reactivate
   */
  public static async reactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;

      if (!req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to reactivate user'
        });
        return;
      }

      const reactivated = await UserService.reactivateUser(userId, req.tenantId);

      if (!reactivated) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User reactivated successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error reactivating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reactivate user'
      });
    }
  }

  /**
   * Change user password
   * PATCH /api/users/:id/change-password
   */
  public static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userId = req.params.id;
      const { currentPassword, newPassword } = req.body;

      // Users can only change their own password unless they have permission
      if (userId !== req.user?._id && !req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to change password for this user'
        });
        return;
      }

      const success = await UserService.changePassword(userId, currentPassword, newPassword, req.tenantId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to change password'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error changing password:', error);
      
      if (error.message === 'Current password is incorrect') {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to change password'
        });
      }
    }
  }

  /**
   * Reset user password
   * PATCH /api/users/:id/reset-password
   */
  public static async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const userId = req.params.id;
      const { newPassword } = req.body;

      if (!req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to reset password'
        });
        return;
      }

      const success = await UserService.resetPassword(userId, newPassword, req.tenantId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to reset password'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error resetting password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }

  /**
   * Update user preferences
   * PATCH /api/users/:id/preferences
   */
  public static async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const preferences = req.body;

      // Users can only update their own preferences unless they have permission
      if (userId !== req.user?._id && !req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to update preferences for this user'
        });
        return;
      }

      const user = await UserService.updatePreferences(userId, preferences, req.tenantId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        message: 'Preferences updated successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }
  }

  /**
   * Update notification settings
   * PATCH /api/users/:id/notification-settings
   */
  public static async updateNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const settings = req.body;

      // Users can only update their own notification settings unless they have permission
      if (userId !== req.user?._id && !req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to update notification settings for this user'
        });
        return;
      }

      const user = await UserService.updateNotificationSettings(userId, settings, req.tenantId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        message: 'Notification settings updated successfully'
      });
    } catch (error: any) {
      moduleLogger.error('Error updating notification settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification settings'
      });
    }
  }

  /**
   * Get users with filters and pagination
   * GET /api/users
   */
  public static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.permissions?.includes(Permission.USER_READ)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view users'
        });
        return;
      }

      const filters: UserFilters = {
        role: req.query.role as UserRole,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        isEmailVerified: req.query.isEmailVerified === 'true' ? true : req.query.isEmailVerified === 'false' ? false : undefined,
        tenantId: req.tenantId,
        search: req.query.search as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        lastLoginAfter: req.query.lastLoginAfter ? new Date(req.query.lastLoginAfter as string) : undefined,
        lastLoginBefore: req.query.lastLoginBefore ? new Date(req.query.lastLoginBefore as string) : undefined
      };

      const pagination: UserPagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
        sort: req.query.sort ? JSON.parse(req.query.sort as string) : undefined
      };

      const result = await UserService.getUsers(filters, pagination);

      res.json({
        success: true,
        data: result.users,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error: any) {
      moduleLogger.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  }

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  public static async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.permissions?.includes(Permission.USER_READ)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to view user statistics'
        });
        return;
      }

      const stats = await UserService.getUserStats(req.tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      moduleLogger.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user statistics'
      });
    }
  }

  /**
   * Export users to CSV
   * GET /api/users/export
   */
  public static async exportUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.permissions?.includes(Permission.USER_READ)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to export users'
        });
        return;
      }

      const filters: UserFilters = {
        role: req.query.role as UserRole,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        isEmailVerified: req.query.isEmailVerified === 'true' ? true : req.query.isEmailVerified === 'false' ? false : undefined,
        tenantId: req.tenantId
      };

      const csv = await UserService.exportUsers(filters, req.tenantId);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      res.send(csv);
    } catch (error: any) {
      moduleLogger.error('Error exporting users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export users'
      });
    }
  }

  /**
   * Bulk update users
   * PATCH /api/users/bulk-update
   */
  public static async bulkUpdateUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.permissions?.includes(Permission.USER_UPDATE)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to bulk update users'
        });
        return;
      }

      const { userIds, updateData } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User IDs array is required and must not be empty'
        });
        return;
      }

      if (!updateData || typeof updateData !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Update data is required and must be an object'
        });
        return;
      }

      const updatedCount = await UserService.bulkUpdateUsers(userIds, updateData, req.tenantId);

      res.json({
        success: true,
        data: { updatedCount },
        message: `Successfully updated ${updatedCount} users`
      });
    } catch (error: any) {
      moduleLogger.error('Error bulk updating users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update users'
      });
    }
  }
}