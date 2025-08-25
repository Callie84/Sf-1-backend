import mongoose, { Document, Schema } from 'mongoose';
import { Notification as NotificationType, NotificationType as NotifType } from '@sf1/shared';

export interface INotification extends Document, Omit<NotificationType, '_id'> {}

const notificationSchema = new Schema<INotification>({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: 200,
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: 1000,
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    required: [true, 'Notification type is required'],
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: Date,
  actionUrl: {
    type: String,
    trim: true,
  },
  actionLabel: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  category: {
    type: String,
    enum: ['system', 'message', 'mention', 'reaction', 'invitation', 'payment', 'security'],
    default: 'system',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true,
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'push', 'sms'],
  }],
  delivered: {
    type: Boolean,
    default: false,
  },
  deliveredAt: Date,
  expiresAt: Date,
}, {
  timestamps: true,
});

// Indexes for performance
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ category: 1, priority: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to set readAt when read is set to true
notificationSchema.pre('save', function(next) {
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Method to mark as delivered
notificationSchema.methods.markAsDelivered = function() {
  this.delivered = true;
  this.deliveredAt = new Date();
  return this.save();
};

// Static method to mark multiple as read
notificationSchema.statics.markManyAsRead = function(userId: string, notificationIds?: string[]) {
  const query: any = { userId, read: false };
  if (notificationIds) {
    query._id = { $in: notificationIds };
  }
  
  return this.updateMany(query, {
    read: true,
    readAt: new Date(),
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId: string, tenantId?: string) {
  const query: any = { userId, read: false };
  if (tenantId) query.tenantId = tenantId;
  
  return this.countDocuments(query);
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);