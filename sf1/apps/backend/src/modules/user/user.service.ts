import { UserModel, UserDocument } from './user.model';
import { User, UserRole, UserPreferences, NotificationSettings } from '@/types';
import { logger } from '@/utils/logger';
import { redisClient } from '@/config/redis';
import { generateAccessToken, generateRefreshToken } from '@/middleware/auth';
import { createModuleLogger } from '@/utils/logger';

const moduleLogger = createModuleLogger('user-service');

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  preferences?: Partial<UserPreferences>;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  isEmailVerified?: boolean;
  tenantId?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

export interface UserPagination {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export class UserService {
  /**
   * Create a new user
   */
  public static async createUser(userData: CreateUserData): Promise<User> {
    try {
      // Check if email already exists
      const existingEmail = await UserModel.findByEmail(userData.email, userData.tenantId);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Check if username already exists
      const existingUsername = await UserModel.findByUsername(userData.username, userData.tenantId);
      if (existingUsername) {
        throw new Error('Username already exists');
      }

      // Create user
      const user = new UserModel({
        ...userData,
        email: userData.email.toLowerCase(),
        username: userData.username.toLowerCase(),
        preferences: {
          theme: 'auto',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            push: true,
            inApp: true,
            marketing: false
          },
          ...userData.preferences
        }
      });

      await user.save();
      
      // Clear cache
      await this.clearUserCache(user._id.toString());
      
      moduleLogger.info(`User created: ${user.email}`);
      
      // Return user without password
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    } catch (error) {
      moduleLogger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  public static async getUserById(userId: string, tenantId?: string): Promise<User | null> {
    try {
      // Try to get from cache first
      const cacheKey = `user:${userId}`;
      const cachedUser = await redisClient.get(cacheKey);
      
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOne(query).select('-password');
      
      if (user) {
        // Cache user for 1 hour
        await redisClient.set(cacheKey, JSON.stringify(user), 3600);
      }

      return user;
    } catch (error) {
      moduleLogger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  public static async getUserByEmail(email: string, tenantId?: string): Promise<User | null> {
    try {
      const user = await UserModel.findByEmail(email, tenantId);
      return user;
    } catch (error) {
      moduleLogger.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  public static async getUserByUsername(username: string, tenantId?: string): Promise<User | null> {
    try {
      const user = await UserModel.findByUsername(username, tenantId);
      return user;
    } catch (error) {
      moduleLogger.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  public static async updateUser(userId: string, updateData: UpdateUserData, tenantId?: string): Promise<User | null> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`User updated: ${userId}`);
      }

      return user;
    } catch (error) {
      moduleLogger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  public static async deleteUser(userId: string, tenantId?: string): Promise<boolean> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const result = await UserModel.deleteOne(query);
      
      if (result.deletedCount > 0) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`User deleted: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      moduleLogger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Soft delete user (deactivate)
   */
  public static async deactivateUser(userId: string, tenantId?: string): Promise<boolean> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const result = await UserModel.updateOne(query, { $set: { isActive: false } });
      
      if (result.modifiedCount > 0) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`User deactivated: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      moduleLogger.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Reactivate user
   */
  public static async reactivateUser(userId: string, tenantId?: string): Promise<boolean> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const result = await UserModel.updateOne(query, { $set: { isActive: true } });
      
      if (result.modifiedCount > 0) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`User reactivated: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      moduleLogger.error('Error reactivating user:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  public static async changePassword(userId: string, currentPassword: string, newPassword: string, tenantId?: string): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (tenantId && user.tenantId !== tenantId) {
        throw new Error('User not found in tenant');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Clear cache
      await this.clearUserCache(userId);
      moduleLogger.info(`Password changed for user: ${userId}`);

      return true;
    } catch (error) {
      moduleLogger.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Reset user password
   */
  public static async resetPassword(userId: string, newPassword: string, tenantId?: string): Promise<boolean> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOne(query);
      if (!user) {
        throw new Error('User not found');
      }

      user.password = newPassword;
      await user.save();

      // Clear cache
      await this.clearUserCache(userId);
      moduleLogger.info(`Password reset for user: ${userId}`);

      return true;
    } catch (error) {
      moduleLogger.error('Error resetting password:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  public static async updatePreferences(userId: string, preferences: Partial<UserPreferences>, tenantId?: string): Promise<User | null> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOneAndUpdate(
        query,
        { $set: { preferences } },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`Preferences updated for user: ${userId}`);
      }

      return user;
    } catch (error) {
      moduleLogger.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  public static async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>, tenantId?: string): Promise<User | null> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOneAndUpdate(
        query,
        { $set: { 'preferences.notifications': settings } },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`Notification settings updated for user: ${userId}`);
      }

      return user;
    } catch (error) {
      moduleLogger.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  public static async verifyEmail(userId: string, token: string, tenantId?: string): Promise<boolean> {
    try {
      const query: any = { _id: userId };
      if (tenantId) query.tenantId = tenantId;

      const user = await UserModel.findOne(query);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.verifyEmailVerificationToken(token)) {
        user.isEmailVerified = true;
        user.clearEmailVerificationToken();
        await user.save();

        // Clear cache
        await this.clearUserCache(userId);
        moduleLogger.info(`Email verified for user: ${userId}`);

        return true;
      }

      return false;
    } catch (error) {
      moduleLogger.error('Error verifying email:', error);
      throw error;
    }
  }

  /**
   * Get users with filters and pagination
   */
  public static async getUsers(filters: UserFilters = {}, pagination: UserPagination): Promise<{ users: User[], total: number, totalPages: number }> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.role) query.role = filters.role;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;
      if (filters.isEmailVerified !== undefined) query.isEmailVerified = filters.isEmailVerified;
      if (filters.tenantId) query.tenantId = filters.tenantId;
      if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) query.createdAt.$gte = filters.createdAfter;
        if (filters.createdBefore) query.createdAt.$lte = filters.createdBefore;
      }
      if (filters.lastLoginAfter || filters.lastLoginBefore) {
        query.lastLoginAt = {};
        if (filters.lastLoginAfter) query.lastLoginAt.$gte = filters.lastLoginAfter;
        if (filters.lastLoginBefore) query.lastLoginAt.$lte = filters.lastLoginBefore;
      }

      // Apply search filter
      if (filters.search) {
        query.$or = [
          { firstName: { $regex: filters.search, $options: 'i' } },
          { lastName: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { username: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Get total count
      const total = await UserModel.countDocuments(query);

      // Apply pagination and sorting
      const skip = (pagination.page - 1) * pagination.limit;
      const sort = pagination.sort || { createdAt: -1 };

      const users = await UserModel.find(query)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(pagination.limit);

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        users,
        total,
        totalPages
      };
    } catch (error) {
      moduleLogger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  public static async getUserStats(tenantId?: string): Promise<{
    total: number;
    active: number;
    verified: number;
    byRole: Record<string, number>;
    recentSignups: number;
  }> {
    try {
      const query: any = {};
      if (tenantId) query.tenantId = tenantId;

      const [
        total,
        active,
        verified,
        byRole,
        recentSignups
      ] = await Promise.all([
        UserModel.countDocuments(query),
        UserModel.countDocuments({ ...query, isActive: true }),
        UserModel.countDocuments({ ...query, isEmailVerified: true }),
        UserModel.aggregate([
          { $match: query },
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        UserModel.countDocuments({
          ...query,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      const roleStats: Record<string, number> = {};
      byRole.forEach((item: any) => {
        roleStats[item._id] = item.count;
      });

      return {
        total,
        active,
        verified,
        byRole: roleStats,
        recentSignups
      };
    } catch (error) {
      moduleLogger.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Clear user cache
   */
  private static async clearUserCache(userId: string): Promise<void> {
    try {
      const cacheKey = `user:${userId}`;
      await redisClient.del(cacheKey);
    } catch (error) {
      moduleLogger.error('Error clearing user cache:', error);
    }
  }

  /**
   * Bulk update users
   */
  public static async bulkUpdateUsers(userIds: string[], updateData: Partial<User>, tenantId?: string): Promise<number> {
    try {
      const query: any = { _id: { $in: userIds } };
      if (tenantId) query.tenantId = tenantId;

      const result = await UserModel.updateMany(query, { $set: updateData });
      
      // Clear cache for all updated users
      await Promise.all(userIds.map(id => this.clearUserCache(id)));
      
      moduleLogger.info(`Bulk updated ${result.modifiedCount} users`);
      
      return result.modifiedCount;
    } catch (error) {
      moduleLogger.error('Error bulk updating users:', error);
      throw error;
    }
  }

  /**
   * Export users to CSV
   */
  public static async exportUsers(filters: UserFilters = {}, tenantId?: string): Promise<string> {
    try {
      const query: any = {};
      if (tenantId) query.tenantId = tenantId;

      // Apply filters
      if (filters.role) query.role = filters.role;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;
      if (filters.isEmailVerified !== undefined) query.isEmailVerified = filters.isEmailVerified;

      const users = await UserModel.find(query)
        .select('firstName lastName email username role isActive isEmailVerified createdAt lastLoginAt')
        .sort({ createdAt: -1 });

      // Convert to CSV
      const headers = ['First Name', 'Last Name', 'Email', 'Username', 'Role', 'Active', 'Email Verified', 'Created At', 'Last Login'];
      const csvRows = [headers.join(',')];

      users.forEach(user => {
        const row = [
          user.firstName,
          user.lastName,
          user.email,
          user.username,
          user.role,
          user.isActive ? 'Yes' : 'No',
          user.isEmailVerified ? 'Yes' : 'No',
          user.createdAt.toISOString(),
          user.lastLoginAt ? user.lastLoginAt.toISOString() : ''
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (error) {
      moduleLogger.error('Error exporting users:', error);
      throw error;
    }
  }
}