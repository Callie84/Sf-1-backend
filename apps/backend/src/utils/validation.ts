import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    next();
  };
};

// Common validation schemas
export const userValidation = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(1).required(),
    lastName: Joi.string().min(1).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1),
    lastName: Joi.string().min(1),
    avatar: Joi.string().uri(),
    preferences: Joi.object(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

export const messageValidation = {
  create: Joi.object({
    content: Joi.string().required(),
    type: Joi.string().valid('text', 'image', 'file', 'video', 'audio').default('text'),
    channelId: Joi.string().required(),
    attachments: Joi.array().items(Joi.string()),
    mentions: Joi.array().items(Joi.string()),
  }),

  update: Joi.object({
    content: Joi.string().required(),
  }),
};

export const channelValidation = {
  create: Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    type: Joi.string().valid('direct', 'group', 'public', 'private').required(),
    members: Joi.array().items(Joi.string()),
  }),

  update: Joi.object({
    name: Joi.string(),
    description: Joi.string(),
    members: Joi.array().items(Joi.string()),
  }),
};

export const notificationValidation = {
  create: Joi.object({
    title: Joi.string().required(),
    message: Joi.string().required(),
    type: Joi.string().valid('info', 'success', 'warning', 'error').required(),
    userId: Joi.string().required(),
    actionUrl: Joi.string().uri(),
    metadata: Joi.object(),
  }),
};

export const paginationValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});