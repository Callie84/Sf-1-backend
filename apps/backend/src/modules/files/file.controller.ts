import { Request, Response, NextFunction } from 'express';
import { FileService } from './file.service';
import { catchAsync, AppError } from '../../utils/errors';
import multer from 'multer';
import path from 'path';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // List of allowed MIME types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/json',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} is not supported`, 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export class FileController {
  private fileService = new FileService();

  uploadMiddleware = upload.single('file');

  uploadFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const { isPublic, tags, metadata } = req.body;

    const file = await this.fileService.uploadFile(
      req.file,
      req.user.id,
      req.tenant?._id,
      {
        isPublic: isPublic === 'true',
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : undefined,
        metadata: metadata ? JSON.parse(metadata) : undefined,
      }
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: { file },
    });
  });

  getFiles = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      ownerId,
      mimeType,
      category,
      tags,
      search,
      isPublic,
      sharedWithMe,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await this.fileService.getFiles({
      ownerId: ownerId as string,
      tenantId: req.tenant?._id,
      userId: req.user.id,
      mimeType: mimeType as string,
      category: category as string,
      tags: tags ? (tags as string).split(',') : undefined,
      search: search as string,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      sharedWithMe: sharedWithMe === 'true',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  });

  getFileById = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const file = await this.fileService.getFileById(id, req.user.id);

    res.json({
      success: true,
      data: { file },
    });
  });

  downloadFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { file, filePath } = await this.fileService.downloadFile(id, req.user.id);

    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size.toString());

    res.sendFile(path.resolve(filePath));
  });

  streamFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { filename } = req.params;
    
    // Find file by filename
    const file = await this.fileService.getFiles({
      userId: req.user.id,
      search: filename,
      limit: 1,
    });

    if (!file.files.length) {
      return next(new AppError('File not found', 404));
    }

    const fileRecord = file.files[0];
    
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    
    res.sendFile(path.resolve(fileRecord.path));
  });

  updateFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const updates = req.body;

    const file = await this.fileService.updateFile(id, updates, req.user.id);

    res.json({
      success: true,
      message: 'File updated successfully',
      data: { file },
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

  shareFile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId, permissions } = req.body;

    if (!userId || !permissions) {
      return next(new AppError('User ID and permissions are required', 400));
    }

    const file = await this.fileService.shareFile(id, userId, permissions, req.user.id);

    res.json({
      success: true,
      message: 'File shared successfully',
      data: { file },
    });
  });

  removeShare = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id, userId } = req.params;

    const file = await this.fileService.removeShare(id, userId, req.user.id);

    res.json({
      success: true,
      message: 'Share removed successfully',
      data: { file },
    });
  });

  getFileStats = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { userId } = req.query;
    
    // Only admins can view stats for other users
    const targetUserId = userId && req.user.roles.includes('admin') 
      ? userId as string 
      : req.user.id;

    const stats = await this.fileService.getFileStats(req.tenant?._id, targetUserId);

    res.json({
      success: true,
      data: { stats },
    });
  });
}