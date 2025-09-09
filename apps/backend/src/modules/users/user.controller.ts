import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { catchAsync, AppError } from '../../utils/errors';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

export class UserController {
  private userService = new UserService();

  getUsers = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const {
      status,
      roles,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      tenantId: req.tenant?._id,
      status: status as string,
      roles: roles ? (roles as string).split(',') : undefined,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await this.userService.getUsers(filters);

    res.json({
      success: true,
      data: result,
    });
  });

  getUserById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = await this.userService.getUserById(id);

    res.json({
      success: true,
      data: { user },
    });
  });

  updateUser = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const updates = req.body;

    // Only admins can update other users
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      return next(new AppError('You can only update your own profile', 403));
    }

    const user = await this.userService.updateUser(id, updates, req.user.id);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  });

  updateProfile = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Users can only update their own profile
    if (req.user.id !== id) {
      return next(new AppError('You can only update your own profile', 403));
    }

    const user = await this.userService.updateProfile(id, req.body);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  });

  deleteUser = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await this.userService.deleteUser(id, req.user.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  });

  assignRoles = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { roles } = req.body;

    if (!roles || !Array.isArray(roles)) {
      return next(new AppError('Roles must be an array', 400));
    }

    const user = await this.userService.assignRoles(id, roles, req.user.id);

    res.json({
      success: true,
      message: 'Roles assigned successfully',
      data: { user },
    });
  });

  getUserStats = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const stats = await this.userService.getUserStats(req.tenant?._id);

    res.json({
      success: true,
      data: { stats },
    });
  });

  getUserActivity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { days } = req.query;

    const activity = await this.userService.getUserActivity(
      id,
      days ? parseInt(days as string) : 30
    );

    res.json({
      success: true,
      data: { activity },
    });
  });

  getCurrentUser = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.json({
      success: true,
      data: { user: req.user },
    });
  });
}