import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimitMiddleware {
  /**
   * Create a rate limiter using Redis store
   */
  public static createRedisRateLimiter(config: RateLimitConfig) {
    return rateLimit({
      ...config,
      store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.getClient().sendCommand(args),
      }),
      keyGenerator: (req: Request) => {
        // Use IP address as default key
        let key = req.ip;
        
        // If user is authenticated, include user ID
        if (req.user) {
          key = `user:${req.user._id}`;
        }
        
        // Include endpoint in key for more granular control
        key += `:${req.method}:${req.path}`;
        
        return key;
      },
      handler: (req: Request, res: Response) => {
        logger.warn(`Rate limit exceeded for ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json({
          success: false,
          error: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000)
        });
      },
      skip: (req: Request) => {
        // Skip rate limiting for certain paths or users
        if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
          return true;
        }
        
        // Skip for admin users
        if (req.user?.role === 'admin') {
          return true;
        }
        
        return false;
      }
    });
  }

  /**
   * Global rate limiter for all requests
   */
  public static globalLimiter = this.createRedisRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Strict rate limiter for authentication endpoints
   */
  public static authLimiter = this.createRedisRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  /**
   * Rate limiter for API endpoints
   */
  public static apiLimiter = this.createRedisRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'API rate limit exceeded, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Rate limiter for file uploads
   */
  public static uploadLimiter = this.createRedisRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 uploads per hour
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Rate limiter for search endpoints
   */
  public static searchLimiter = this.createRedisRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 searches per minute
    message: 'Too many search requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Rate limiter for AI endpoints
   */
  public static aiLimiter = this.createRedisRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 AI requests per minute
    message: 'AI rate limit exceeded, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Dynamic rate limiter based on user tier
   */
  public static dynamicLimiter = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    let maxRequests = 100; // Default limit
    
    if (user) {
      switch (user.role) {
        case 'admin':
          maxRequests = 10000;
          break;
        case 'premium':
          maxRequests = 1000;
          break;
        case 'standard':
          maxRequests = 100;
          break;
        default:
          maxRequests = 50;
      }
    }

    const limiter = this.createRedisRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: maxRequests,
      message: 'Rate limit exceeded for your tier, please upgrade or try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

    limiter(req, res, next);
  };

  /**
   * Burst rate limiter for short time windows
   */
  public static burstLimiter = this.createRedisRateLimiter({
    windowMs: 1 * 1000, // 1 second
    max: 10, // limit each IP to 10 requests per second
    message: 'Burst rate limit exceeded, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * Custom rate limiter for specific endpoints
   */
  public static createCustomLimiter(
    windowMs: number,
    max: number,
    message: string,
    keyGenerator?: (req: Request) => string
  ) {
    return this.createRedisRateLimiter({
      windowMs,
      max,
      message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: keyGenerator || undefined,
    });
  }
}

// Redis store implementation for rate limiting
class RedisStore {
  private sendCommand: (command: string[]) => Promise<any>;

  constructor(options: { sendCommand: (command: string[]) => Promise<any> }) {
    this.sendCommand = options.sendCommand;
  }

  async incr(key: string): Promise<{ totalHits: number }> {
    const result = await this.sendCommand(['INCR', key]);
    return { totalHits: result };
  }

  async decr(key: string): Promise<void> {
    await this.sendCommand(['DECR', key]);
  }

  async resetKey(key: string): Promise<void> {
    await this.sendCommand(['DEL', key]);
  }

  async get(key: string): Promise<number> {
    const result = await this.sendCommand(['GET', key]);
    return result ? parseInt(result) : 0;
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.sendCommand(['SET', key, value, 'EX', ttl.toString()]);
  }
}

// Export middleware instances
export const globalLimiter = RateLimitMiddleware.globalLimiter;
export const authLimiter = RateLimitMiddleware.authLimiter;
export const apiLimiter = RateLimitMiddleware.apiLimiter;
export const uploadLimiter = RateLimitMiddleware.uploadLimiter;
export const searchLimiter = RateLimitMiddleware.searchLimiter;
export const aiLimiter = RateLimitMiddleware.aiLimiter;
export const dynamicLimiter = RateLimitMiddleware.dynamicLimiter;
export const burstLimiter = RateLimitMiddleware.burstLimiter;
export const createCustomLimiter = RateLimitMiddleware.createCustomLimiter;