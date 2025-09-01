import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppError } from '../utils/errors';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://sf1.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    sanitizeObject(req.body);
  }
  if (req.query) {
    sanitizeObject(req.query);
  }
  if (req.params) {
    sanitizeObject(req.params);
  }
  next();
};

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Remove potentially dangerous characters
        obj[key] = obj[key]
          .replace(/[<>]/g, '') // Remove < and >
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  }
}

// NoSQL injection prevention
export const preventNoSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    checkForInjection(req.body);
  }
  if (req.query) {
    checkForInjection(req.query);
  }
  if (req.params) {
    checkForInjection(req.params);
  }
  next();
};

function checkForInjection(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Check for MongoDB operators
        if (key.startsWith('$') || key.includes('.')) {
          throw new AppError('Invalid query parameters detected', 400);
        }
        checkForInjection(obj[key]);
      }
    }
  }
}

// Request size limiter
export const requestSizeLimiter = (maxSize: number = 10) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes

    if (contentLength > maxSizeBytes) {
      return next(new AppError(`Request too large. Maximum size is ${maxSize}MB`, 413));
    }

    next();
  };
};

// IP whitelisting middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
      return next(); // Skip in development
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    if (!allowedIPs.includes(clientIP as string)) {
      return next(new AppError('Access denied from this IP address', 403));
    }

    next();
  };
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(new AppError('API key required', 401));
  }

  // In a real implementation, you'd validate against a database
  // For now, check against environment variable
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return next(new AppError('Invalid API key', 401));
  }

  next();
};