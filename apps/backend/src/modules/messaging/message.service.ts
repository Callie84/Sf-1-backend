import { Message, IMessage } from '../../models/Message';
import { Channel } from '../../models/Channel';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';
import { logger } from '../../utils/logger';

export class MessageService {
  async createMessage(data: {
    content: string;
    type: string;
    senderId: string;
    channelId: string;
    tenantId?: string;
    attachments?: string[];
    mentions?: string[];
    replyTo?: string;
  }): Promise<IMessage> {
    // Check if channel exists and user has permission
    const channel = await Channel.findById(data.channelId);
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    if (!channel.isMember(data.senderId)) {
      throw new AppError('You are not a member of this channel', 403);
    }

    if (!channel.hasPermission(data.senderId, 'canPost')) {
      throw new AppError('You do not have permission to post in this channel', 403);
    }

    // Create message
    const message = new Message({
      content: data.content,
      type: data.type || 'text',
      senderId: data.senderId,
      channelId: data.channelId,
      tenantId: data.tenantId,
      attachments: data.attachments || [],
      mentions: data.mentions || [],
      replyTo: data.replyTo,
    });

    await message.save();

    // Update channel message count
    await channel.incrementMessageCount();

    // Populate sender info
    await message.populate('senderId', 'firstName lastName username avatar');
    await message.populate('attachments');
    await message.populate('mentions', 'firstName lastName username');

    // Create audit log
    await createAuditLog({
      userId: data.senderId,
      tenantId: data.tenantId,
      action: 'create',
      entityType: 'Message',
      entityId: message._id.toString(),
      newValues: {
        content: data.content,
        channelId: data.channelId,
        type: data.type,
      },
    });

    // Emit real-time event
    this.emitMessageEvent('message:created', data.channelId, message);

    logger.info(`Message created in channel ${data.channelId}`, {
      messageId: message._id,
      senderId: data.senderId,
    });

    return message;
  }

  async getMessages(filters: {
    channelId: string;
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    since?: Date;
  }) {
    const {
      channelId,
      userId,
      page = 1,
      limit = 50,
      search,
      type,
      since,
    } = filters;

    // Check if user has access to channel
    const channel = await Channel.findById(channelId);
    if (!channel || !channel.isMember(userId)) {
      throw new AppError('Channel not found or access denied', 404);
    }

    const query: any = {
      channelId,
      deleted: { $ne: true },
    };

    if (search) {
      query.$text = { $search: search };
    }

    if (type) {
      query.type = type;
    }

    if (since) {
      query.createdAt = { $gte: since };
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate('senderId', 'firstName lastName username avatar')
        .populate('attachments')
        .populate('mentions', 'firstName lastName username')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments(query),
    ]);

    // Mark messages as read by the requesting user
    const unreadMessages = messages.filter(msg => 
      !msg.readBy?.some(r => r.userId.toString() === userId)
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessages.map(m => m._id) } },
        { $addToSet: { readBy: { userId, readAt: new Date() } } }
      );
    }

    return {
      messages: messages.reverse(), // Reverse to show oldest first
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

  async updateMessage(
    id: string,
    content: string,
    userId: string
  ): Promise<IMessage> {
    const message = await Message.findById(id);
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    if (message.senderId.toString() !== userId) {
      throw new AppError('You can only edit your own messages', 403);
    }

    const oldContent = message.content;
    message.content = content;
    await message.save();

    await message.populate('senderId', 'firstName lastName username avatar');

    // Create audit log
    await createAuditLog({
      userId,
      action: 'update',
      entityType: 'Message',
      entityId: id,
      oldValues: { content: oldContent },
      newValues: { content },
    });

    // Emit real-time event
    this.emitMessageEvent('message:updated', message.channelId.toString(), message);

    return message;
  }

  async deleteMessage(id: string, userId: string): Promise<void> {
    const message = await Message.findById(id);
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user can delete (owner or admin)
    const channel = await Channel.findById(message.channelId);
    const canDelete = message.senderId.toString() === userId || 
                     channel?.hasPermission(userId, 'canModerate');

    if (!canDelete) {
      throw new AppError('You do not have permission to delete this message', 403);
    }

    message.deleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Create audit log
    await createAuditLog({
      userId,
      action: 'delete',
      entityType: 'Message',
      entityId: id,
      oldValues: { deleted: false },
      newValues: { deleted: true },
    });

    // Emit real-time event
    this.emitMessageEvent('message:deleted', message.channelId.toString(), { messageId: id });
  }

  async addReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<IMessage> {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user has access to channel
    const channel = await Channel.findById(message.channelId);
    if (!channel || !channel.isMember(userId)) {
      throw new AppError('Access denied', 403);
    }

    await message.addReaction(emoji, userId);
    await message.populate('senderId', 'firstName lastName username avatar');

    // Emit real-time event
    this.emitMessageEvent('message:reaction:added', message.channelId.toString(), {
      messageId,
      emoji,
      userId,
    });

    return message;
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<IMessage> {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    await message.removeReaction(emoji, userId);
    await message.populate('senderId', 'firstName lastName username avatar');

    // Emit real-time event
    this.emitMessageEvent('message:reaction:removed', message.channelId.toString(), {
      messageId,
      emoji,
      userId,
    });

    return message;
  }

  async searchMessages(filters: {
    tenantId?: string;
    userId: string;
    query: string;
    channelIds?: string[];
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      tenantId,
      userId,
      query,
      channelIds,
      type,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    // Get user's accessible channels
    const accessibleChannels = await Channel.find({
      ...(tenantId && { tenantId }),
      'members.userId': userId,
      ...(channelIds && { _id: { $in: channelIds } }),
    }).select('_id');

    const accessibleChannelIds = accessibleChannels.map(c => c._id);

    const searchQuery: any = {
      channelId: { $in: accessibleChannelIds },
      $text: { $search: query },
      deleted: { $ne: true },
    };

    if (type) {
      searchQuery.type = type;
    }

    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) searchQuery.createdAt.$gte = dateFrom;
      if (dateTo) searchQuery.createdAt.$lte = dateTo;
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find(searchQuery)
        .populate('senderId', 'firstName lastName username avatar')
        .populate('channelId', 'name type')
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments(searchQuery),
    ]);

    return {
      messages,
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

  private emitMessageEvent(event: string, channelId: string, data: any) {
    if (global.io) {
      global.io.to(channelId).emit(event, data);
    }
  }
}