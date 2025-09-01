import mongoose, { Document, Schema } from 'mongoose';
import { FileUpload as FileType } from '@sf1/shared';

export interface IFile extends Document, Omit<FileType, '_id'> {}

const fileSchema = new Schema<IFile>({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
  },
  originalName: {
    type: String,
    required: [true, 'Original name is required'],
    trim: true,
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: 0,
  },
  path: {
    type: String,
    required: [true, 'File path is required'],
  },
  url: {
    type: String,
    trim: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true,
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
  // Image-specific metadata
  dimensions: {
    width: Number,
    height: Number,
  },
  // Video-specific metadata
  duration: Number,
  // Document-specific metadata
  pageCount: Number,
  // File versioning
  version: {
    type: Number,
    default: 1,
  },
  parentFileId: {
    type: Schema.Types.ObjectId,
    ref: 'File',
  },
  // Access control
  sharedWith: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    permissions: {
      type: String,
      enum: ['read', 'write', 'delete'],
      default: 'read',
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    sharedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  // Download tracking
  downloads: {
    type: Number,
    default: 0,
  },
  lastDownloaded: Date,
  // Storage information
  storageProvider: {
    type: String,
    enum: ['local', 'aws-s3', 'cloudinary'],
    default: 'local',
  },
  storageKey: String,
  // Security
  virus_scan: {
    status: {
      type: String,
      enum: ['pending', 'clean', 'infected', 'error'],
      default: 'pending',
    },
    scannedAt: Date,
    scanResult: String,
  },
  // Soft delete
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index({ tenantId: 1, createdAt: -1 });
fileSchema.index({ mimeType: 1 });
fileSchema.index({ tags: 1 });
fileSchema.index({ 'sharedWith.userId': 1 });
fileSchema.index({ filename: 'text', originalName: 'text', tags: 'text' });

// Virtual for file category
fileSchema.virtual('category').get(function() {
  if (this.mimeType.startsWith('image/')) return 'image';
  if (this.mimeType.startsWith('video/')) return 'video';
  if (this.mimeType.startsWith('audio/')) return 'audio';
  if (this.mimeType.includes('pdf')) return 'pdf';
  if (this.mimeType.includes('document') || this.mimeType.includes('text')) return 'document';
  return 'other';
});

// Virtual for human-readable file size
fileSchema.virtual('humanSize').get(function() {
  const bytes = this.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Method to increment download count
fileSchema.methods.incrementDownloads = function() {
  this.downloads += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

// Method to share file with user
fileSchema.methods.shareWith = function(userId: string, permissions: string = 'read', sharedBy: string) {
  const existingShare = this.sharedWith.find(s => s.userId.toString() === userId);
  
  if (!existingShare) {
    this.sharedWith.push({
      userId,
      permissions,
      sharedAt: new Date(),
      sharedBy,
    });
  } else {
    existingShare.permissions = permissions;
  }
  
  return this.save();
};

// Method to remove share
fileSchema.methods.removeShare = function(userId: string) {
  this.sharedWith = this.sharedWith.filter(s => s.userId.toString() !== userId);
  return this.save();
};

// Method to check if user has access
fileSchema.methods.hasAccess = function(userId: string): boolean {
  // Owner always has access
  if (this.ownerId.toString() === userId) return true;
  
  // Public files are accessible
  if (this.isPublic) return true;
  
  // Check shared permissions
  return this.sharedWith.some(s => s.userId.toString() === userId);
};

// Method to get user permissions
fileSchema.methods.getUserPermissions = function(userId: string): string[] {
  // Owner has all permissions
  if (this.ownerId.toString() === userId) {
    return ['read', 'write', 'delete'];
  }
  
  // Check shared permissions
  const share = this.sharedWith.find(s => s.userId.toString() === userId);
  if (share) {
    switch (share.permissions) {
      case 'read':
        return ['read'];
      case 'write':
        return ['read', 'write'];
      case 'delete':
        return ['read', 'write', 'delete'];
      default:
        return [];
    }
  }
  
  // Public files have read permission
  if (this.isPublic) {
    return ['read'];
  }
  
  return [];
};

export const File = mongoose.model<IFile>('File', fileSchema);