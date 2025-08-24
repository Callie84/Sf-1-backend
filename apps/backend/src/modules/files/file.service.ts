import { File, IFile } from '../../models/File';
import { User } from '../../models/User';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

export class FileService {
  private uploadDir = process.env.UPLOAD_DIR || './uploads';

  constructor() {
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    fileData: Express.Multer.File,
    ownerId: string,
    tenantId?: string,
    options?: {
      isPublic?: boolean;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<IFile> {
    // Generate unique filename
    const fileExtension = path.extname(fileData.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, uniqueFilename);

    // Move uploaded file to permanent location
    await fs.writeFile(filePath, fileData.buffer);

    // Generate metadata based on file type
    const metadata = await this.generateMetadata(filePath, fileData.mimetype);

    // Create file record
    const file = new File({
      filename: uniqueFilename,
      originalName: fileData.originalname,
      mimeType: fileData.mimetype,
      size: fileData.size,
      path: filePath,
      url: `/api/files/${uniqueFilename}`,
      ownerId,
      tenantId,
      isPublic: options?.isPublic || false,
      tags: options?.tags || [],
      metadata: new Map(Object.entries({ ...metadata, ...(options?.metadata || {}) })),
      storageProvider: 'local',
    });

    await file.save();

    // Create audit log
    await createAuditLog({
      userId: ownerId,
      tenantId,
      action: 'create',
      entityType: 'File',
      entityId: file._id.toString(),
      newValues: {
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
      },
    });

    logger.info(`File uploaded successfully`, {
      fileId: file._id,
      filename: file.filename,
      ownerId,
    });

    return file;
  }

  private async generateMetadata(filePath: string, mimeType: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    try {
      if (mimeType.startsWith('image/')) {
        const imageInfo = await sharp(filePath).metadata();
        metadata.dimensions = {
          width: imageInfo.width,
          height: imageInfo.height,
        };
        metadata.format = imageInfo.format;
        metadata.colorSpace = imageInfo.space;
      }
      
      // Add more metadata extraction for other file types as needed
    } catch (error) {
      logger.warn('Failed to extract metadata:', error);
    }

    return metadata;
  }

  async getFiles(filters: {
    ownerId?: string;
    tenantId?: string;
    userId: string; // For access control
    mimeType?: string;
    category?: string;
    tags?: string[];
    search?: string;
    isPublic?: boolean;
    sharedWithMe?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      ownerId,
      tenantId,
      userId,
      mimeType,
      category,
      tags,
      search,
      isPublic,
      sharedWithMe,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const query: any = {
      deleted: { $ne: true },
    };

    // Access control
    if (sharedWithMe) {
      query['sharedWith.userId'] = userId;
    } else if (ownerId) {
      query.ownerId = ownerId;
    } else {
      // Show files user has access to
      query.$or = [
        { ownerId: userId },
        { isPublic: true },
        { 'sharedWith.userId': userId },
      ];
    }

    if (tenantId) query.tenantId = tenantId;
    if (isPublic !== undefined) query.isPublic = isPublic;

    if (mimeType) {
      if (category) {
        // Filter by category (image, video, document, etc.)
        switch (category) {
          case 'image':
            query.mimeType = { $regex: '^image/' };
            break;
          case 'video':
            query.mimeType = { $regex: '^video/' };
            break;
          case 'audio':
            query.mimeType = { $regex: '^audio/' };
            break;
          case 'document':
            query.mimeType = { $in: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
            ]};
            break;
        }
      } else {
        query.mimeType = mimeType;
      }
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [files, total] = await Promise.all([
      File.find(query)
        .populate('ownerId', 'firstName lastName username')
        .populate('sharedWith.userId', 'firstName lastName username')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      File.countDocuments(query),
    ]);

    return {
      files,
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

  async getFileById(id: string, userId: string): Promise<IFile> {
    const file = await File.findById(id)
      .populate('ownerId', 'firstName lastName username')
      .populate('sharedWith.userId', 'firstName lastName username');

    if (!file) {
      throw new AppError('File not found', 404);
    }

    if (!file.hasAccess(userId)) {
      throw new AppError('Access denied', 403);
    }

    return file;
  }

  async downloadFile(id: string, userId: string): Promise<{ file: IFile; filePath: string }> {
    const file = await this.getFileById(id, userId);

    const permissions = file.getUserPermissions(userId);
    if (!permissions.includes('read')) {
      throw new AppError('Access denied', 403);
    }

    // Check if file exists on disk
    try {
      await fs.access(file.path);
    } catch {
      throw new AppError('File not found on disk', 404);
    }

    // Increment download count
    await file.incrementDownloads();

    // Create audit log
    await createAuditLog({
      userId,
      action: 'read',
      entityType: 'File',
      entityId: id,
      metadata: { action: 'download' },
    });

    return { file, filePath: file.path };
  }

  async updateFile(
    id: string,
    updates: {
      originalName?: string;
      isPublic?: boolean;
      tags?: string[];
      metadata?: Record<string, any>;
    },
    userId: string
  ): Promise<IFile> {
    const file = await File.findById(id);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    const permissions = file.getUserPermissions(userId);
    if (!permissions.includes('write')) {
      throw new AppError('Access denied', 403);
    }

    const oldValues = {
      originalName: file.originalName,
      isPublic: file.isPublic,
      tags: file.tags,
    };

    if (updates.originalName) file.originalName = updates.originalName;
    if (updates.isPublic !== undefined) file.isPublic = updates.isPublic;
    if (updates.tags) file.tags = updates.tags;
    if (updates.metadata) {
      const currentMetadata = Object.fromEntries(file.metadata);
      file.metadata = new Map(Object.entries({ ...currentMetadata, ...updates.metadata }));
    }

    await file.save();

    // Create audit log
    await createAuditLog({
      userId,
      action: 'update',
      entityType: 'File',
      entityId: id,
      oldValues,
      newValues: {
        originalName: file.originalName,
        isPublic: file.isPublic,
        tags: file.tags,
      },
    });

    return file;
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    const file = await File.findById(id);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    const permissions = file.getUserPermissions(userId);
    if (!permissions.includes('delete')) {
      throw new AppError('Access denied', 403);
    }

    // Soft delete
    file.deleted = true;
    file.deletedAt = new Date();
    await file.save();

    // Create audit log
    await createAuditLog({
      userId,
      action: 'delete',
      entityType: 'File',
      entityId: id,
      oldValues: { deleted: false },
      newValues: { deleted: true },
    });

    // Optionally delete from disk (implement based on requirements)
    // await fs.unlink(file.path);

    logger.info(`File deleted`, { fileId: id, userId });
  }

  async shareFile(
    id: string,
    targetUserId: string,
    permissions: 'read' | 'write' | 'delete',
    userId: string
  ): Promise<IFile> {
    const file = await File.findById(id);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    const userPermissions = file.getUserPermissions(userId);
    if (!userPermissions.includes('write')) {
      throw new AppError('Access denied', 403);
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }

    await file.shareWith(targetUserId, permissions, userId);

    // Create audit log
    await createAuditLog({
      userId,
      action: 'update',
      entityType: 'File',
      entityId: id,
      metadata: {
        action: 'share',
        targetUserId,
        permissions,
      },
    });

    return file;
  }

  async removeShare(id: string, targetUserId: string, userId: string): Promise<IFile> {
    const file = await File.findById(id);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    const userPermissions = file.getUserPermissions(userId);
    if (!userPermissions.includes('write')) {
      throw new AppError('Access denied', 403);
    }

    await file.removeShare(targetUserId);

    // Create audit log
    await createAuditLog({
      userId,
      action: 'update',
      entityType: 'File',
      entityId: id,
      metadata: {
        action: 'remove_share',
        targetUserId,
      },
    });

    return file;
  }

  async getFileStats(tenantId?: string, userId?: string) {
    const matchStage: any = {
      deleted: { $ne: true },
    };

    if (tenantId) matchStage.tenantId = tenantId;
    if (userId) matchStage.ownerId = userId;

    const stats = await File.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          imageCount: {
            $sum: { $cond: [{ $regexMatch: { input: '$mimeType', regex: '^image/' } }, 1, 0] },
          },
          videoCount: {
            $sum: { $cond: [{ $regexMatch: { input: '$mimeType', regex: '^video/' } }, 1, 0] },
          },
          documentCount: {
            $sum: { $cond: [{ $in: ['$mimeType', [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ]] }, 1, 0] },
          },
          totalDownloads: { $sum: '$downloads' },
        },
      },
    ]);

    return stats[0] || {
      totalFiles: 0,
      totalSize: 0,
      imageCount: 0,
      videoCount: 0,
      documentCount: 0,
      totalDownloads: 0,
    };
  }
}