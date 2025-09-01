import { Request, Response, NextFunction } from 'express';
import { MessageService } from './message.service';
import { catchAsync, AppError } from '../../utils/errors';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

export class MessageController {
  private messageService = new MessageService();

  createMessage = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { content, type, channelId, attachments, mentions, replyTo } = req.body;

    if (!content || !channelId) {
      return next(new AppError('Content and channel ID are required', 400));
    }

    const message = await this.messageService.createMessage({
      content,
      type,
      senderId: req.user.id,
      channelId,
      tenantId: req.tenant?._id,
      attachments,
      mentions,
      replyTo,
    });

    res.status(201).json({
      success: true,
      message: 'Message created successfully',
      data: { message },
    });
  });

  getMessages = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { channelId } = req.params;
    const { page, limit, search, type, since } = req.query;

    const result = await this.messageService.getMessages({
      channelId,
      userId: req.user.id,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      search: search as string,
      type: type as string,
      since: since ? new Date(since as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  });

  updateMessage = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return next(new AppError('Content is required', 400));
    }

    const message = await this.messageService.updateMessage(id, content, req.user.id);

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: { message },
    });
  });

  deleteMessage = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await this.messageService.deleteMessage(id, req.user.id);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  });

  addReaction = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return next(new AppError('Emoji is required', 400));
    }

    const message = await this.messageService.addReaction(id, emoji, req.user.id);

    res.json({
      success: true,
      message: 'Reaction added successfully',
      data: { message },
    });
  });

  removeReaction = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return next(new AppError('Emoji is required', 400));
    }

    const message = await this.messageService.removeReaction(id, emoji, req.user.id);

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      data: { message },
    });
  });

  searchMessages = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { q, channels, type, dateFrom, dateTo, page, limit } = req.query;

    if (!q) {
      return next(new AppError('Search query is required', 400));
    }

    const result = await this.messageService.searchMessages({
      tenantId: req.tenant?._id,
      userId: req.user.id,
      query: q as string,
      channelIds: channels ? (channels as string).split(',') : undefined,
      type: type as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result,
    });
  });
}