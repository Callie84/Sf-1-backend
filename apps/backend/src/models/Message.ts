import mongoose, { Document, Schema } from 'mongoose';
import { Message as MessageType, MessageType as MsgType } from '@sf1/shared';

export interface IMessage extends Document, Omit<MessageType, '_id'> {}

const messageSchema = new Schema<IMessage>({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: 10000,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'video', 'audio'],
    default: 'text',
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required'],
    index: true,
  },
  channelId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: [true, 'Channel ID is required'],
    index: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File',
  }],
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
  },
  reactions: [{
    emoji: {
      type: String,
      required: true,
    },
    users: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    count: {
      type: Number,
      default: 0,
    },
  }],
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: Date,
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
  readBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ tenantId: 1, createdAt: -1 });
messageSchema.index({ mentions: 1 });
messageSchema.index({ 'reactions.users': 1 });

// Text search index
messageSchema.index({
  content: 'text',
});

// Virtual for reply count
messageSchema.virtual('replyCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'replyTo',
  count: true,
});

// Pre-save middleware to update edit history
messageSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.edited = true;
    this.editedAt = new Date();
    
    if (!this.editHistory) {
      this.editHistory = [];
    }
    
    this.editHistory.push({
      content: this.content,
      editedAt: new Date(),
    });
  }
  next();
});

// Method to add reaction
messageSchema.methods.addReaction = function(emoji: string, userId: string) {
  const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
  
  if (reactionIndex === -1) {
    // Create new reaction
    this.reactions.push({
      emoji,
      users: [userId],
      count: 1,
    });
  } else {
    // Add user to existing reaction
    const reaction = this.reactions[reactionIndex];
    if (!reaction.users.includes(userId)) {
      reaction.users.push(userId);
      reaction.count = reaction.users.length;
    }
  }
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(emoji: string, userId: string) {
  const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
  
  if (reactionIndex !== -1) {
    const reaction = this.reactions[reactionIndex];
    reaction.users = reaction.users.filter(id => id.toString() !== userId);
    reaction.count = reaction.users.length;
    
    if (reaction.count === 0) {
      this.reactions.splice(reactionIndex, 1);
    }
  }
  
  return this.save();
};

// Method to mark as read
messageSchema.methods.markAsRead = function(userId: string) {
  const existingRead = this.readBy.find(r => r.userId.toString() === userId);
  
  if (!existingRead) {
    this.readBy.push({
      userId,
      readAt: new Date(),
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

export const Message = mongoose.model<IMessage>('Message', messageSchema);