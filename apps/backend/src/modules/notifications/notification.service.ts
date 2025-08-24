import { Notification, INotification } from '../../models/Notification';
import { User } from '../../models/User';
import { AppError } from '../../utils/errors';
import { sendEmail } from '../../utils/email';
import { logger } from '../../utils/logger';

interface CreateNotificationParams {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  userId: string;
  tenantId?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: 'system' | 'message' | 'mention' | 'reaction' | 'invitation' | 'payment' | 'security';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  channels?: ('in_app' | 'email' | 'push' | 'sms')[];
  expiresAt?: Date;
}

export class NotificationService {
  async createNotification(params: CreateNotificationParams): Promise<INotification> {
    const notification = new Notification({
      title: params.title,
      message: params.message,
      type: params.type,
      userId: params.userId,
      tenantId: params.tenantId,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      category: params.category || 'system',
      priority: params.priority || 'normal',
      metadata: params.metadata ? new Map(Object.entries(params.metadata)) : new Map(),
      channels: params.channels || ['in_app'],
      expiresAt: params.expiresAt,
    });

    await notification.save();

    // Send to different channels
    await this.deliverNotification(notification);

    // Emit real-time event for in-app notifications
    if (params.channels?.includes('in_app') || !params.channels) {
      this.emitNotificationEvent(params.userId, notification);
    }

    logger.info(`Notification created for user ${params.userId}`, {
      notificationId: notification._id,
      type: params.type,
      category: params.category,
    });

    return notification;
  }

  async getNotifications(filters: {
    userId: string;
    tenantId?: string;
    read?: boolean;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      tenantId,
      read,
      category,
      priority,
      page = 1,
      limit = 20,
    } = filters;

    const query: any = { userId };

    if (tenantId) query.tenantId = tenantId;
    if (read !== undefined) query.read = read;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.getUnreadCount(userId, tenantId),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async markAsRead(
    notificationIds: string[],
    userId: string
  ): Promise<void> {
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId },
      { read: true, readAt: new Date() }
    );

    // Emit real-time event
    this.emitNotificationEvent(userId, { type: 'notifications:read', ids: notificationIds });
  }

  async markAllAsRead(userId: string, tenantId?: string): Promise<void> {
    const query: any = { userId, read: false };
    if (tenantId) query.tenantId = tenantId;

    await Notification.updateMany(query, {
      read: true,
      readAt: new Date(),
    });

    // Emit real-time event
    this.emitNotificationEvent(userId, { type: 'notifications:all_read' });
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Emit real-time event
    this.emitNotificationEvent(userId, { type: 'notification:deleted', id });
  }

  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    return Notification.getUnreadCount(userId, tenantId);
  }

  // Bulk notification methods
  async createBulkNotifications(
    userIds: string[],
    notification: Omit<CreateNotificationParams, 'userId'>
  ): Promise<void> {
    const notifications = userIds.map(userId => ({
      ...notification,
      userId,
      metadata: notification.metadata ? new Map(Object.entries(notification.metadata)) : new Map(),
      channels: notification.channels || ['in_app'],
    }));

    await Notification.insertMany(notifications);

    // Emit real-time events
    userIds.forEach(userId => {
      if (notification.channels?.includes('in_app') || !notification.channels) {
        this.emitNotificationEvent(userId, { type: 'notification:new' });
      }
    });

    logger.info(`Bulk notifications created for ${userIds.length} users`, {
      type: notification.type,
      category: notification.category,
    });
  }

  async createSystemNotification(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    userIds?: string[],
    tenantId?: string
  ): Promise<void> {
    let targetUserIds = userIds;

    if (!targetUserIds) {
      // Send to all users in tenant or all users if no tenant specified
      const query: any = { status: 'active' };
      if (tenantId) query.tenantId = tenantId;

      const users = await User.find(query).select('_id');
      targetUserIds = users.map(u => u._id.toString());
    }

    await this.createBulkNotifications(targetUserIds, {
      title: 'System Notification',
      message,
      type,
      tenantId,
      category: 'system',
      priority: type === 'error' ? 'high' : 'normal',
      channels: ['in_app', 'email'],
    });
  }

  private async deliverNotification(notification: INotification): Promise<void> {
    const channels = notification.channels || ['in_app'];
    const user = await User.findById(notification.userId);

    if (!user) {
      logger.error(`User not found for notification delivery: ${notification.userId}`);
      return;
    }

    // Email delivery
    if (channels.includes('email')) {
      try {
        await sendEmail({
          to: user.email,
          subject: notification.title,
          template: 'notification',
          data: {
            title: notification.title,
            message: notification.message,
            actionUrl: notification.actionUrl,
            actionLabel: notification.actionLabel,
            firstName: user.firstName,
          },
        });
      } catch (error) {
        logger.error('Failed to send email notification:', error);
      }
    }

    // Push notification delivery (placeholder)
    if (channels.includes('push')) {
      // Implement push notification logic here
      logger.info('Push notification would be sent here');
    }

    // SMS delivery (placeholder)
    if (channels.includes('sms')) {
      // Implement SMS logic here
      logger.info('SMS notification would be sent here');
    }

    // Mark as delivered
    await notification.markAsDelivered();
  }

  private emitNotificationEvent(userId: string, data: any) {
    if (global.io) {
      global.io.to(`user:${userId}`).emit('notification', data);
    }
  }

  // Utility methods for common notification types
  async notifyMention(
    mentionedUserId: string,
    mentionerName: string,
    messageContent: string,
    channelName: string,
    actionUrl: string,
    tenantId?: string
  ): Promise<void> {
    await this.createNotification({
      title: `You were mentioned by ${mentionerName}`,
      message: `"${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`,
      type: 'info',
      userId: mentionedUserId,
      tenantId,
      actionUrl,
      actionLabel: 'View Message',
      category: 'mention',
      priority: 'normal',
      channels: ['in_app', 'email'],
      metadata: {
        mentionerName,
        channelName,
      },
    });
  }

  async notifyNewMessage(
    userId: string,
    senderName: string,
    messageContent: string,
    channelName: string,
    actionUrl: string,
    tenantId?: string
  ): Promise<void> {
    await this.createNotification({
      title: `New message from ${senderName}`,
      message: `"${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"`,
      type: 'info',
      userId,
      tenantId,
      actionUrl,
      actionLabel: 'View Message',
      category: 'message',
      priority: 'normal',
      channels: ['in_app'],
      metadata: {
        senderName,
        channelName,
      },
    });
  }

  async notifyPaymentSuccess(
    userId: string,
    amount: string,
    planName: string,
    tenantId?: string
  ): Promise<void> {
    await this.createNotification({
      title: 'Payment Successful',
      message: `Your payment of ${amount} for ${planName} has been processed successfully.`,
      type: 'success',
      userId,
      tenantId,
      category: 'payment',
      priority: 'normal',
      channels: ['in_app', 'email'],
      metadata: {
        amount,
        planName,
      },
    });
  }

  async notifySecurityAlert(
    userId: string,
    alertType: string,
    details: string,
    tenantId?: string
  ): Promise<void> {
    await this.createNotification({
      title: 'Security Alert',
      message: `${alertType}: ${details}`,
      type: 'warning',
      userId,
      tenantId,
      category: 'security',
      priority: 'high',
      channels: ['in_app', 'email'],
      metadata: {
        alertType,
        details,
      },
    });
  }
}