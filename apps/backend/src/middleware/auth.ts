import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError, catchAsync } from '../utils/errors';
import { redisClient } from '../config/redis';

interface AuthRequest extends Request {
  user?: any;
  tenant?: any;
}

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

export const protect = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // Check if token is blacklisted
  const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
  if (isBlacklisted) {
    return next(new AppError('Token has been invalidated. Please log in again.', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  if (currentUser.status !== 'active') {
    return next(new AppError('Your account has been suspended. Please contact support.', 401));
  }

  req.user = currentUser;
  next();
});

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRoles = req.user.roles || [];
    const hasPermission = roles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

export const checkTenantAccess = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const tenantId = req.headers['x-tenant-id'] || req.user.tenantId;
  
  if (!tenantId) {
    return next(new AppError('Tenant ID is required', 400));
  }

  // Admin users can access any tenant
  if (req.user.roles.includes('admin')) {
    req.tenant = { _id: tenantId };
    return next();
  }

  // Regular users can only access their own tenant
  if (req.user.tenantId && req.user.tenantId !== tenantId) {
    return next(new AppError('Access denied to this tenant', 403));
  }

  req.tenant = { _id: tenantId };
  next();
});

export const optionalAuth = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const currentUser = await User.findById(decoded.id);
      if (currentUser && currentUser.status === 'active') {
        req.user = currentUser;
      }
    } catch (error) {
      // Token is invalid, but we continue without user
    }
  }

  next();
});