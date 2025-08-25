import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redisClient } from '../config/redis';

// Custom store using Redis
class RedisStore {
  private prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  async incr(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      const multi = redisClient.getClient().multi();
      multi.incr(redisKey);
      multi.ttl(redisKey);
      
      const results = await multi.exec();
      const hits = results?.[0]?.[1] as number;
      const ttl = results?.[1]?.[1] as number;

      let resetTime: Date | undefined;
      if (ttl === -1) {
        // First request, set expiry
        await redisClient.set(redisKey, hits.toString(), 60); // 1 minute default
        resetTime = new Date(Date.now() + 60 * 1000);
      } else if (ttl > 0) {
        resetTime = new Date(Date.now() + ttl * 1000);
      }

      return { totalHits: hits, resetTime };
    } catch (error) {
      return { totalHits: 1 };
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    try {
      await redisClient.getClient().decr(redisKey);
    } catch (error) {
      // Ignore errors
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    try {
      await redisClient.del(redisKey);
    } catch (error) {
      // Ignore errors
    }
  }
}

const redisStore = new RedisStore();

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});

// API rate limiter for authenticated users
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each user to 60 requests per minute
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return (req as any).user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'API rate limit exceeded, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});

// Premium users get higher limits
export const premiumApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    const user = (req as any).user;
    if (user?.roles?.includes('premium') || user?.roles?.includes('admin')) {
      return 300; // 300 requests per minute for premium users
    }
    return 60; // 60 requests per minute for regular users
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'API rate limit exceeded, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'Upload limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});

// AI endpoint rate limiter
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: Request) => {
    const user = (req as any).user;
    if (user?.roles?.includes('premium')) {
      return 100; // 100 AI requests per hour for premium
    }
    if (user?.roles?.includes('admin')) {
      return 1000; // 1000 AI requests per hour for admin
    }
    return 10; // 10 AI requests per hour for free users
  },
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'AI API limit exceeded. Upgrade to premium for higher limits.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore as any,
});