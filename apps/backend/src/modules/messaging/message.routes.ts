import { Router } from 'express';
import { MessageController } from './message.controller';
import { protect, checkTenantAccess } from '../../middleware/auth';
import { validate, validateQuery } from '../../utils/validation';
import { messageValidation, paginationValidation } from '../../utils/validation';
import { apiLimiter } from '../../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();
const messageController = new MessageController();

// Apply authentication to all routes
router.use(protect);
router.use(apiLimiter);
router.use(checkTenantAccess);

// Validation schemas
const reactionSchema = Joi.object({
  emoji: Joi.string().required(),
});

const messageFiltersSchema = paginationValidation.keys({
  search: Joi.string().min(1),
  type: Joi.string().valid('text', 'image', 'file', 'video', 'audio'),
  since: Joi.date().iso(),
});

const searchMessagesSchema = Joi.object({
  q: Joi.string().required().min(1),
  channels: Joi.string(), // comma-separated channel IDs
  type: Joi.string().valid('text', 'image', 'file', 'video', 'audio'),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

// Routes
router.post('/',
  validate(messageValidation.create),
  messageController.createMessage
);

router.get('/search',
  validateQuery(searchMessagesSchema),
  messageController.searchMessages
);

router.get('/channel/:channelId',
  validateQuery(messageFiltersSchema),
  messageController.getMessages
);

router.patch('/:id',
  validate(messageValidation.update),
  messageController.updateMessage
);

router.delete('/:id',
  messageController.deleteMessage
);

router.post('/:id/reactions',
  validate(reactionSchema),
  messageController.addReaction
);

router.delete('/:id/reactions',
  validate(reactionSchema),
  messageController.removeReaction
);

export default router;