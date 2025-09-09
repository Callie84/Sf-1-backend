import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { catchAsync, AppError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

interface AuthRequest extends Request {
  user?: any;
}

export class AuthController {
  private authService = new AuthService();

  register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, username, password, firstName, lastName, tenantId } = req.body;

    const { user, tokens } = await this.authService.register({
      email,
      username,
      password,
      firstName,
      lastName,
      tenantId,
    });

    // Create audit log
    await createAuditLog({
      userId: user._id,
      action: 'create',
      entityType: 'User',
      entityId: user._id,
      newValues: { email, username, firstName, lastName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user,
        tokens,
      },
    });
  });

  login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const { user, tokens } = await this.authService.login(
      email,
      password,
      req.get('User-Agent'),
      req.ip
    );

    // Create audit log
    await createAuditLog({
      userId: user._id,
      action: 'login',
      entityType: 'User',
      entityId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        tokens,
      },
    });
  });

  refreshToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    const tokens = await this.authService.refreshToken(refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
    });
  });

  logout = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;

    await this.authService.logout(req.user.id, refreshToken);

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'logout',
      entityType: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  });

  logoutAll = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    await this.authService.logoutAll(req.user.id);

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'logout',
      entityType: 'User',
      entityId: req.user.id,
      metadata: { type: 'all_devices' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  });

  verifyEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;

    await this.authService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  });

  forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Please provide email address', 400));
    }

    await this.authService.forgotPassword(email);

    res.json({
      success: true,
      message: 'If your email exists in our system, you will receive a password reset link',
    });
  });

  resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return next(new AppError('Please provide new password', 400));
    }

    await this.authService.resetPassword(token, password);

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  });

  changePassword = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError('Please provide current password and new password', 400));
    }

    await this.authService.changePassword(req.user.id, currentPassword, newPassword);

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'update',
      entityType: 'User',
      entityId: req.user.id,
      metadata: { action: 'password_change' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  getProfile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  });

  // OAuth endpoints
  googleAuth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.body;

    if (!token) {
      return next(new AppError('Google token is required', 400));
    }

    const { user, tokens } = await this.authService.googleAuth(token);

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user,
        tokens,
      },
    });
  });

  githubAuth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { code } = req.body;

    if (!code) {
      return next(new AppError('GitHub code is required', 400));
    }

    const { user, tokens } = await this.authService.githubAuth(code);

    res.json({
      success: true,
      message: 'GitHub authentication successful',
      data: {
        user,
        tokens,
      },
    });
  });
}