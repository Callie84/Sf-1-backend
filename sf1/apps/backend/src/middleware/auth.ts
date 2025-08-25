import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, AuthenticatedRequest, Permission } from '@/types';
import { UserModel } from '@/modules/user/user.model';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  iat: number;
  exp: number;
}

export class AuthMiddleware {
  /**
   * Authenticate JWT token and attach user to request
   */
  public static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Access token required'
        });
        return;
      }

      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        res.status(401).json({
          success: false,
          error: 'Token has been revoked'
        });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Get user from database
      const user = await UserModel.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
        return;
      }

      // Check if user's role has changed since token was issued
      if (user.role !== decoded.role) {
        res.status(401).json({
          success: false,
          error: 'User role has changed, please login again'
        });
        return;
      }

      // Attach user and permissions to request
      req.user = user;
      req.tenantId = decoded.tenantId;
      
      // Get user permissions
      const permissions = await this.getUserPermissions(user._id.toString(), user.role);
      req.permissions = permissions;

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      } else if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      } else {
        logger.error('Authentication error:', error);
        res.status(500).json({
          success: false,
          error: 'Authentication failed'
        });
      }
    }
  }

  /**
   * Require specific permission to access endpoint
   */
  public static requirePermission(permission: Permission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!req.permissions?.includes(permission)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
        return;
      }

      next();
    };
  }

  /**
   * Require specific role to access endpoint
   */
  public static requireRole(roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient role permissions'
        });
        return;
      }

      next();
    };
  }

  /**
   * Optional authentication - attach user if token is valid
   */
  public static async optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        return next();
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Get user from database
      const user = await UserModel.findById(decoded.userId).select('-password');
      if (user && user.isActive && user.role === decoded.role) {
        req.user = user;
        req.tenantId = decoded.tenantId;
        
        // Get user permissions
        const permissions = await this.getUserPermissions(user._id.toString(), user.role);
        req.permissions = permissions;
      }

      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  }

  /**
   * Get user permissions based on role
   */
  private static async getUserPermissions(userId: string, role: string): Promise<Permission[]> {
    try {
      // Cache permissions in Redis for performance
      const cacheKey = `permissions:${userId}`;
      const cachedPermissions = await redisClient.get(cacheKey);
      
      if (cachedPermissions) {
        return JSON.parse(cachedPermissions);
      }

      // Define role-based permissions
      const rolePermissions: Record<string, Permission[]> = {
        admin: [
          Permission.USER_CREATE,
          Permission.USER_READ,
          Permission.USER_UPDATE,
          Permission.USER_DELETE,
          Permission.CONTENT_CREATE,
          Permission.CONTENT_READ,
          Permission.CONTENT_UPDATE,
          Permission.CONTENT_DELETE,
          Permission.ADMIN_ACCESS,
          Permission.MODERATION_ACCESS,
          Permission.PAYMENT_READ,
          Permission.SUBSCRIPTION_MANAGE
        ],
        moderator: [
          Permission.USER_READ,
          Permission.CONTENT_CREATE,
          Permission.CONTENT_READ,
          Permission.CONTENT_UPDATE,
          Permission.CONTENT_DELETE,
          Permission.MODERATION_ACCESS
        ],
        premium: [
          Permission.CONTENT_CREATE,
          Permission.CONTENT_READ,
          Permission.CONTENT_UPDATE,
          Permission.CONTENT_DELETE
        ],
        standard: [
          Permission.CONTENT_READ
        ]
      };

      const permissions = rolePermissions[role] || [];
      
      // Cache permissions for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(permissions), 3600);
      
      return permissions;
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Validate refresh token
   */
  public static async validateRefreshToken(token: string): Promise<JWTPayload | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!) as JWTPayload;
      
      // Check if refresh token is blacklisted
      const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Blacklist a token (for logout)
   */
  public static async blacklistToken(token: string, expiresIn: number): Promise<void> {
    try {
      await redisClient.set(`blacklist:${token}`, '1', expiresIn);
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }

  /**
   * Generate access token
   */
  public static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRY || '15m'
    });
  }

  /**
   * Generate refresh token
   */
  public static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
    });
  }
}

// Export middleware functions
export const authenticate = AuthMiddleware.authenticate;
export const requirePermission = AuthMiddleware.requirePermission;
export const requireRole = AuthMiddleware.requireRole;
export const optionalAuth = AuthMiddleware.optionalAuth;
export const generateAccessToken = AuthMiddleware.generateAccessToken;
export const generateRefreshToken = AuthMiddleware.generateRefreshToken;
export const validateRefreshToken = AuthMiddleware.validateRefreshToken;
export const blacklistToken = AuthMiddleware.blacklistToken;