import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { catchAsync, AppError } from '../../utils/errors';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

export class NotificationController {
  private notificationService = new NotificationService();

  createNotification = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      title,
      message,
      type,
      userId,
      actionUrl,
      actionLabel,
      category,
      priority,
      metadata,
      channels,
      expiresAt,
    } = req.body;

    // Only admins can create notifications for other users
    if (userId !== req.user.id && !req.user.roles.includes('admin')) {
      return next(new AppError('You can only create notifications for yourself', 403));
    }

    const notification = await this.notificationService.createNotification({
      title,
      message,
      type,
      userId,
      tenantId: req.tenant?._id,
      actionUrl,
      actionLabel,
      category,
      priority,
      metadata,
      channels,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification },
    });
  });

  getNotifications = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { read, category, priority, page, limit } = req.query;

    const result = await this.notificationService.getNotifications({
      userId: req.user.id,
      tenantId: req.tenant?._id,
      read: read !== undefined ? read === 'true' : undefined,
      category: category as string,
      priority: priority as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result,
    });
  });

  markAsRead = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(new AppError('Notification IDs must be an array', 400));
    }

    await this.notificationService.markAsRead(notificationIds, req.user.id);

    res.json({
      success: true,
      message: 'Notifications marked as read',
    });
  });

  markAllAsRead = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    await this.notificationService.markAllAsRead(req.user.id, req.tenant?._id);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  });

  deleteNotification = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await this.notificationService.deleteNotification(id, req.user.id);

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  });

  getUnreadCount = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const count = await this.notificationService.getUnreadCount(
      req.user.id,
      req.tenant?._id
    );

    res.json({
      success: true,
      data: { count },
    });
  });

  // Admin routes
  createBulkNotifications = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { userIds, title, message, type, actionUrl, actionLabel, category, priority, metadata, channels } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return next(new AppError('User IDs must be an array', 400));
    }

    await this.notificationService.createBulkNotifications(userIds, {
      title,
      message,
      type,
      tenantId: req.tenant?._id,
      actionUrl,
      actionLabel,
      category,
      priority,
      metadata,
      channels,
    });

    res.json({
      success: true,
      message: `Bulk notifications sent to ${userIds.length} users`,
    });
  });

  createSystemNotification = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { message, type, userIds } = req.body;

    await this.notificationService.createSystemNotification(
      message,
      type,
      userIds,
      req.tenant?._id
    );

    res.json({
      success: true,
      message: 'System notification sent successfully',
    });
  });
}