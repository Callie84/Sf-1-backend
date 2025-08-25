import { Request, Response, NextFunction } from 'express';
import { UserService } from '../users/user.service';
import { FileService } from '../files/file.service';
import { NotificationService } from '../notifications/notification.service';
import { getAuditLogs } from '../audit/audit.service';
import { catchAsync } from '../../utils/errors';
import { User } from '../../models/User';
import { Message } from '../../models/Message';
import { File } from '../../models/File';
import { Notification } from '../../models/Notification';
import { AuditLog } from '../../models/AuditLog';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

export class AdminController {
  private userService = new UserService();
  private fileService = new FileService();
  private notificationService = new NotificationService();

  getDashboardStats = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = req.tenant?._id;

    // Get stats for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      userStats,
      fileStats,
      messageStats,
      notificationStats,
      auditStats,
    ] = await Promise.all([
      // User statistics
      User.aggregate([
        { $match: { ...(tenantId && { tenantId }), createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // File statistics
      File.aggregate([
        { $match: { ...(tenantId && { tenantId }), createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: '$size' },
            avgSize: { $avg: '$size' },
          },
        },
      ]),

      // Message statistics
      Message.aggregate([
        { $match: { ...(tenantId && { tenantId }), createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Notification statistics
      Notification.aggregate([
        { $match: { ...(tenantId && { tenantId }), createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]),

      // Audit log statistics
      AuditLog.aggregate([
        { $match: { ...(tenantId && { tenantId }), timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Get overall counts
    const [
      totalUsers,
      totalFiles,
      totalMessages,
      totalNotifications,
    ] = await Promise.all([
      User.countDocuments(tenantId ? { tenantId } : {}),
      File.countDocuments(tenantId ? { tenantId } : {}),
      Message.countDocuments(tenantId ? { tenantId } : {}),
      Notification.countDocuments(tenantId ? { tenantId } : {}),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalFiles,
          totalMessages,
          totalNotifications,
        },
        charts: {
          userGrowth: userStats,
          messageActivity: messageStats,
          fileStats: fileStats[0] || { totalFiles: 0, totalSize: 0, avgSize: 0 },
          notificationTypes: notificationStats,
          auditActivity: auditStats,
        },
      },
    });
  });

  getSystemHealth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        fileSystem: 'healthy',
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    // TODO: Add actual health checks for external services
    res.json({
      success: true,
      data: health,
    });
  });

  getAuditLogs = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await getAuditLogs({
      userId: userId as string,
      tenantId: req.tenant?._id,
      entityType: entityType as string,
      entityId: entityId as string,
      action: action as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      success: true,
      data: result,
    });
  });

  getUsers = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      status,
      roles,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await this.userService.getUsers({
      tenantId: req.tenant?._id,
      status: status as string,
      roles: roles ? (roles as string).split(',') : undefined,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  });

  updateUserStatus = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    const user = await this.userService.updateUser(
      id,
      { status },
      req.user.id
    );

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: { user },
    });
  });

  getFiles = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      ownerId,
      mimeType,
      category,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await this.fileService.getFiles({
      ownerId: ownerId as string,
      tenantId: req.tenant?._id,
      userId: req.user.id, // Admin has access to all files
      mimeType: mimeType as string,
      category: category as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  });

  deleteFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await this.fileService.deleteFile(id, req.user.id);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  });

  broadcastNotification = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { title, message, type, userIds } = req.body;

    await this.notificationService.createBulkNotifications(
      userIds || [], // If no userIds provided, it will be handled in the service
      {
        title,
        message,
        type,
        tenantId: req.tenant?._id,
        category: 'system',
        priority: 'normal',
        channels: ['in_app', 'email'],
      }
    );

    res.json({
      success: true,
      message: 'Notification broadcast successfully',
    });
  });

  exportData = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { dataType, format = 'json' } = req.query;
    
    // This is a simplified implementation
    // In a real application, you'd want to implement proper data export
    // with streaming for large datasets and proper formatting
    
    let data: any = {};
    
    switch (dataType) {
      case 'users':
        data = await User.find(req.tenant?._id ? { tenantId: req.tenant._id } : {})
          .select('-password -refreshTokens')
          .lean();
        break;
      case 'messages':
        data = await Message.find(req.tenant?._id ? { tenantId: req.tenant._id } : {})
          .populate('senderId', 'email username')
          .lean();
        break;
      case 'files':
        data = await File.find(req.tenant?._id ? { tenantId: req.tenant._id } : {})
          .populate('ownerId', 'email username')
          .lean();
        break;
      default:
        data = { error: 'Invalid data type' };
    }

    if (format === 'csv') {
      // Convert to CSV format (simplified)
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${dataType}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${dataType}.json"`);
    }

    res.json({
      success: true,
      data,
      exportedAt: new Date().toISOString(),
    });
  });
}