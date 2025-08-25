import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../../models/User';
import { Tenant } from '../../models/Tenant';
import { AppError } from '../../utils/errors';
import { redisClient } from '../../config/redis';
import { sendEmail } from '../../utils/email';
import { logger } from '../../utils/logger';

interface TokenPayload {
  id: string;
  email: string;
  roles: string[];
  tenantId?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRY || '15m',
    });
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await User.findByIdAndUpdate(userId, {
      $push: {
        refreshTokens: {
          token: refreshToken,
          expiresAt,
          userAgent,
          ipAddress,
        },
      },
    });

    // Store in Redis for quick lookup
    await redisClient.set(
      `refresh_token:${refreshToken}`,
      userId,
      7 * 24 * 60 * 60 // 7 days in seconds
    );
  }

  async generateTokens(user: IUser, userAgent?: string, ipAddress?: string): Promise<AuthTokens> {
    const payload: TokenPayload = {
      id: user._id.toString(),
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId?.toString(),
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    await this.saveRefreshToken(user._id.toString(), refreshToken, userAgent, ipAddress);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
    };
  }

  async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId?: string;
  }): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new AppError('Email already in use', 400);
      }
      throw new AppError('Username already taken', 400);
    }

    // Create new user
    const user = new User({
      ...userData,
      status: 'pending', // Requires email verification
    });

    await user.save();

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove sensitive data from user object
    const userObject = user.toJSON();

    return { user: userObject, tokens };
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user || !(await user.comparePassword(password))) {
      if (user) {
        await user.incLoginAttempts();
      }
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new AppError('Account temporarily locked due to too many failed login attempts', 423);
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new AppError('Account is not active. Please verify your email or contact support.', 401);
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const tokens = await this.generateTokens(user, userAgent, ipAddress);

    // Remove sensitive data
    const userObject = user.toJSON();

    // Log successful login
    logger.info(`User ${user.email} logged in successfully`, {
      userId: user._id,
      userAgent,
      ipAddress,
    });

    return { user: userObject, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Check if refresh token exists in Redis
    const userId = await redisClient.get(`refresh_token:${refreshToken}`);
    if (!userId) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Find user and verify refresh token
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const tokenData = user.refreshTokens.find(rt => rt.token === refreshToken);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      // Remove expired token
      await this.removeRefreshToken(userId, refreshToken);
      throw new AppError('Refresh token expired', 401);
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Remove old refresh token
    await this.removeRefreshToken(userId, refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.removeRefreshToken(userId, refreshToken);
    }

    // Could also blacklist the access token here if needed
    logger.info(`User ${userId} logged out`);
  }

  async logoutAll(userId: string): Promise<void> {
    // Remove all refresh tokens for user
    const user = await User.findById(userId);
    if (user) {
      // Remove from Redis
      for (const tokenData of user.refreshTokens) {
        await redisClient.del(`refresh_token:${tokenData.token}`);
      }

      // Clear from database
      user.refreshTokens = [];
      await user.save();
    }

    logger.info(`User ${userId} logged out from all devices`);
  }

  private async removeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Remove from Redis
    await redisClient.del(`refresh_token:${refreshToken}`);

    // Remove from database
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: { token: refreshToken } },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    user.emailVerified = true;
    user.status = 'active';
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    logger.info(`User ${user.email} verified their email`);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.save();

    await this.sendPasswordResetEmail(user.email, resetToken);

    logger.info(`Password reset requested for ${user.email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    // Logout from all devices for security
    await this.logoutAll(user._id.toString());

    logger.info(`Password reset successful for ${user.email}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 400);
    }

    user.password = newPassword;
    await user.save();

    // Logout from all other devices for security
    await this.logoutAll(userId);

    logger.info(`Password changed for user ${user.email}`);
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Verify your email address',
      template: 'emailVerification',
      data: { verificationUrl },
    });
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: 'passwordReset',
      data: { resetUrl },
    });
  }

  // OAuth methods would be implemented here
  async googleAuth(googleToken: string): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Implementation for Google OAuth
    throw new AppError('Google OAuth not implemented yet', 501);
  }

  async githubAuth(githubCode: string): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Implementation for GitHub OAuth
    throw new AppError('GitHub OAuth not implemented yet', 501);
  }
}