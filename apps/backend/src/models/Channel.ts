import mongoose, { Document, Schema } from 'mongoose';
import { Channel as ChannelType, ChannelType as ChanType } from '@sf1/shared';

export interface IChannel extends Document, Omit<ChannelType, '_id'> {}

const channelSchema = new Schema<IChannel>({
  name: {
    type: String,
    required: [true, 'Channel name is required'],
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  type: {
    type: String,
    enum: ['direct', 'group', 'public', 'private'],
    required: [true, 'Channel type is required'],
    index: true,
  },
  members: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member'],
      default: 'member',
    },
    permissions: {
      canPost: { type: Boolean, default: true },
      canInvite: { type: Boolean, default: false },
      canModerate: { type: Boolean, default: false },
    },
  }],
  admins: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required'],
  },
  settings: {
    allowFileUploads: {
      type: Boolean,
      default: true,
    },
    allowReactions: {
      type: Boolean,
      default: true,
    },
    allowThreads: {
      type: Boolean,
      default: true,
    },
    messageRetention: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    requireApproval: {
      type: Boolean,
      default: false,
    },
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  avatar: String,
  tags: [String],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
channelSchema.index({ tenantId: 1, type: 1 });
channelSchema.index({ 'members.userId': 1 });
channelSchema.index({ createdBy: 1 });
channelSchema.index({ name: 'text', description: 'text' });

// Virtual for member count
channelSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for online members (would require real-time data)
channelSchema.virtual('onlineMembers').get(function() {
  return 0; // Placeholder
});

// Pre-save middleware to update last activity
channelSchema.pre('save', function(next) {
  if (this.isModified('messageCount')) {
    this.lastActivity = new Date();
  }
  next();
});

// Method to add member
channelSchema.methods.addMember = function(userId: string, role: string = 'member') {
  const existingMember = this.members.find(m => m.userId.toString() === userId);
  
  if (!existingMember) {
    this.members.push({
      userId,
      joinedAt: new Date(),
      role,
      permissions: {
        canPost: true,
        canInvite: role === 'admin' || role === 'owner',
        canModerate: role === 'admin' || role === 'owner' || role === 'moderator',
      },
    });
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to remove member
channelSchema.methods.removeMember = function(userId: string) {
  this.members = this.members.filter(m => m.userId.toString() !== userId);
  this.admins = this.admins.filter(id => id.toString() !== userId);
  return this.save();
};

// Method to update member role
channelSchema.methods.updateMemberRole = function(userId: string, role: string) {
  const member = this.members.find(m => m.userId.toString() === userId);
  
  if (member) {
    member.role = role;
    member.permissions = {
      canPost: true,
      canInvite: role === 'admin' || role === 'owner',
      canModerate: role === 'admin' || role === 'owner' || role === 'moderator',
    };
    
    // Update admins array
    if (role === 'admin' || role === 'owner') {
      if (!this.admins.includes(userId as any)) {
        this.admins.push(userId as any);
      }
    } else {
      this.admins = this.admins.filter(id => id.toString() !== userId);
    }
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to check if user is member
channelSchema.methods.isMember = function(userId: string): boolean {
  return this.members.some(m => m.userId.toString() === userId);
};

// Method to check if user has permission
channelSchema.methods.hasPermission = function(userId: string, permission: string): boolean {
  const member = this.members.find(m => m.userId.toString() === userId);
  return member ? member.permissions[permission] : false;
};

// Method to increment message count
channelSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastActivity = new Date();
  return this.save();
};

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);