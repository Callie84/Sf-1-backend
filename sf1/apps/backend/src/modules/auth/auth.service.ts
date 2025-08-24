import { UserService } from '../user/user.service';
import { UserModel, UserDocument } from '../user/user.model';
import { User, UserRole } from '@/types';
import { generateAccessToken, generateRefreshToken, validateRefreshToken, blacklistToken } from '@/middleware/auth';
import { redisClient } from '@/config/redis';
import { createModuleLogger } from '@/utils/logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const moduleLogger = createModuleLogger('auth-service');

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
}

export interface SignupData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId?: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  /**
   * Authenticate user login
   */
  public static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, password, tenantId } = credentials;

      // Find user by email
      const user = await UserModel.findByEmail(email, tenantId);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Check if account is locked
      if (user.isLocked()) {
        throw new Error('Account is temporarily locked due to too many failed attempts');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        throw new Error('Invalid credentials');
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      const refreshToken = generateRefreshToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      // Store refresh token in Redis
      await redisClient.set(
        `refresh_token:${user._id}`,
        refreshToken,
        7 * 24 * 60 * 60 // 7 days
      );

      // Log successful login
      moduleLogger.info(`User logged in: ${user.email}`);

      // Return user without password
      const userObj = user.toObject();
      delete userObj.password;

      return {
        user: userObj,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };
    } catch (error: any) {
      moduleLogger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  public static async signup(signupData: SignupData): Promise<AuthResponse> {
    try {
      // Create user
      const user = await UserService.createUser({
        ...signupData,
        role: UserRole.STANDARD // Default role for new users
      });

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Store verification token in Redis
      await redisClient.set(
        `email_verification:${user._id}`,
        verificationToken,
        24 * 60 * 60 // 24 hours
      );

      // TODO: Send verification email
      moduleLogger.info(`Verification email should be sent to: ${user.email}`);

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      const refreshToken = generateRefreshToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      // Store refresh token in Redis
      await redisClient.set(
        `refresh_token:${user._id}`,
        refreshToken,
        7 * 24 * 60 * 60 // 7 days
      );

      // Log successful signup
      moduleLogger.info(`User signed up: ${user.email}`);

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };
    } catch (error: any) {
      moduleLogger.error('Signup error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  public static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Validate refresh token
      const decoded = await validateRefreshToken(refreshToken);
      if (!decoded) {
        throw new Error('Invalid refresh token');
      }

      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Refresh token not found or expired');
      }

      // Get user from database
      const user = await UserModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      const newRefreshToken = generateRefreshToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      });

      // Update refresh token in Redis
      await redisClient.set(
        `refresh_token:${user._id}`,
        newRefreshToken,
        7 * 24 * 60 * 60 // 7 days
      );

      // Log token refresh
      moduleLogger.info(`Token refreshed for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };
    } catch (error: any) {
      moduleLogger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  public static async logout(userId: string, accessToken: string): Promise<void> {
    try {
      // Blacklist access token
      await blacklistToken(accessToken, 15 * 60); // 15 minutes

      // Remove refresh token from Redis
      await redisClient.del(`refresh_token:${userId}`);

      // Log logout
      moduleLogger.info(`User logged out: ${userId}`);
    } catch (error: any) {
      moduleLogger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  public static async logoutAllDevices(userId: string): Promise<void> {
    try {
      // Remove refresh token from Redis
      await redisClient.del(`refresh_token:${userId}`);

      // Log logout from all devices
      moduleLogger.info(`User logged out from all devices: ${userId}`);
    } catch (error: any) {
      moduleLogger.error('Logout all devices error:', error);
      throw error;
    }
  }

  /**
   * Verify email address
   */
  public static async verifyEmail(userId: string, token: string): Promise<boolean> {
    try {
      // Get verification token from Redis
      const storedToken = await redisClient.get(`email_verification:${userId}`);
      if (!storedToken || storedToken !== token) {
        throw new Error('Invalid or expired verification token');
      }

      // Update user email verification status
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isEmailVerified = true;
      await user.save();

      // Remove verification token from Redis
      await redisClient.del(`email_verification:${userId}`);

      // Log email verification
      moduleLogger.info(`Email verified for user: ${userId}`);

      return true;
    } catch (error: any) {
      moduleLogger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  public static async requestPasswordReset(email: string, tenantId?: string): Promise<void> {
    try {
      // Find user by email
      const user = await UserModel.findByEmail(email, tenantId);
      if (!user) {
        // Don't reveal if user exists or not
        return;
      }

      // Generate password reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Store reset token in Redis
      await redisClient.set(
        `password_reset:${user._id}`,
        resetToken,
        60 * 60 // 1 hour
      );

      // TODO: Send password reset email
      moduleLogger.info(`Password reset email should be sent to: ${email}`);

      // Log password reset request
      moduleLogger.info(`Password reset requested for user: ${user._id}`);
    } catch (error: any) {
      moduleLogger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  public static async resetPasswordWithToken(token: string, newPassword: string, tenantId?: string): Promise<boolean> {
    try {
      // Find user by reset token
      const userId = await this.findUserIdByResetToken(token);
      if (!userId) {
        throw new Error('Invalid or expired reset token');
      }

      // Reset password
      const success = await UserService.resetPassword(userId, newPassword, tenantId);
      if (!success) {
        throw new Error('Failed to reset password');
      }

      // Remove reset token from Redis
      await redisClient.del(`password_reset:${userId}`);

      // Log password reset
      moduleLogger.info(`Password reset completed for user: ${userId}`);

      return true;
    } catch (error: any) {
      moduleLogger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  public static async changePassword(userId: string, currentPassword: string, newPassword: string, tenantId?: string): Promise<boolean> {
    try {
      const success = await UserService.changePassword(userId, currentPassword, newPassword, tenantId);
      
      if (success) {
        // Log password change
        moduleLogger.info(`Password changed for user: ${userId}`);
      }

      return success;
    } catch (error: any) {
      moduleLogger.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Validate reset token
   */
  public static async validateResetToken(token: string): Promise<boolean> {
    try {
      const userId = await this.findUserIdByResetToken(token);
      return !!userId;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get user sessions (refresh tokens)
   */
  public static async getUserSessions(userId: string): Promise<{ active: boolean; lastActivity: Date }[]> {
    try {
      const refreshToken = await redisClient.get(`refresh_token:${userId}`);
      
      if (refreshToken) {
        return [{ active: true, lastActivity: new Date() }];
      }

      return [];
    } catch (error: any) {
      moduleLogger.error('Get user sessions error:', error);
      return [];
    }
  }

  /**
   * Revoke specific session
   */
  public static async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // For now, we only support one session per user
      // In a more complex implementation, you might store multiple sessions
      const result = await redisClient.del(`refresh_token:${userId}`);
      
      if (result > 0) {
        moduleLogger.info(`Session revoked for user: ${userId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      moduleLogger.error('Revoke session error:', error);
      return false;
    }
  }

  /**
   * Helper method to find user ID by reset token
   */
  private static async findUserIdByResetToken(token: string): Promise<string | null> {
    try {
      // This is a simplified implementation
      // In production, you might want to store token-to-user mapping more efficiently
      const keys = await redisClient.getClient().keys('password_reset:*');
      
      for (const key of keys) {
        const storedToken = await redisClient.get(key);
        if (storedToken === token) {
          const userId = key.replace('password_reset:', '');
          return userId;
        }
      }

      return null;
    } catch (error: any) {
      moduleLogger.error('Find user ID by reset token error:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  public static async isAuthenticated(userId: string): Promise<boolean> {
    try {
      const refreshToken = await redisClient.get(`refresh_token:${userId}`);
      return !!refreshToken;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get authentication statistics
   */
  public static async getAuthStats(tenantId?: string): Promise<{
    totalUsers: number;
    activeSessions: number;
    verifiedUsers: number;
    recentLogins: number;
  }> {
    try {
      const [totalUsers, verifiedUsers, recentLogins] = await Promise.all([
        UserModel.countDocuments(tenantId ? { tenantId } : {}),
        UserModel.countDocuments(tenantId ? { tenantId, isEmailVerified: true } : { isEmailVerified: true }),
        UserModel.countDocuments({
          ...(tenantId ? { tenantId } : {}),
          lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);

      // Count active sessions (simplified)
      const activeSessions = await redisClient.getClient().dbSize();

      return {
        totalUsers,
        activeSessions,
        verifiedUsers,
        recentLogins
      };
    } catch (error: any) {
      moduleLogger.error('Get auth stats error:', error);
      throw error;
    }
  }
}