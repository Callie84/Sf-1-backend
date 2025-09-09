import { Router } from 'express';
import { FileController } from './file.controller';
import { protect, restrictTo, checkTenantAccess, optionalAuth } from '../../middleware/auth';
import { validate, validateQuery } from '../../utils/validation';
import { paginationValidation } from '../../utils/validation';
import { uploadLimiter, apiLimiter } from '../../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();
const fileController = new FileController();

// Validation schemas
const fileFiltersSchema = paginationValidation.keys({
  ownerId: Joi.string(),
  mimeType: Joi.string(),
  category: Joi.string().valid('image', 'video', 'audio', 'document', 'other'),
  tags: Joi.string(), // comma-separated tags
  search: Joi.string().min(1),
  isPublic: Joi.boolean(),
  sharedWithMe: Joi.boolean(),
});

const updateFileSchema = Joi.object({
  originalName: Joi.string().min(1),
  isPublic: Joi.boolean(),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object(),
});

const shareFileSchema = Joi.object({
  userId: Joi.string().required(),
  permissions: Joi.string().valid('read', 'write', 'delete').required(),
});

// Public routes (for file serving)
router.get('/serve/:filename',
  optionalAuth,
  fileController.streamFile
);

// Protected routes
router.use(protect);

// File upload (with rate limiting)
router.post('/',
  uploadLimiter,
  checkTenantAccess,
  fileController.uploadMiddleware,
  fileController.uploadFile
);

// Apply API rate limiting to other routes
router.use(apiLimiter);
router.use(checkTenantAccess);

// File management routes
router.get('/',
  validateQuery(fileFiltersSchema),
  fileController.getFiles
);

router.get('/stats',
  fileController.getFileStats
);

router.get('/:id',
  fileController.getFileById
);

router.get('/:id/download',
  fileController.downloadFile
);

router.patch('/:id',
  validate(updateFileSchema),
  fileController.updateFile
);

router.delete('/:id',
  fileController.deleteFile
);

// File sharing routes
router.post('/:id/share',
  validate(shareFileSchema),
  fileController.shareFile
);

router.delete('/:id/share/:userId',
  fileController.removeShare
);

export default router;