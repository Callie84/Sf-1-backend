import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthedRequest extends Request {
  user?: { id: string; roles: string[]; tenantId?: string };
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = verifyAccessToken<{ sub: string; roles: string[]; tenantId?: string }>(token);
    req.user = { id: payload.sub, roles: payload.roles, tenantId: payload.tenantId };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRoles(roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const hasRole = req.user.roles.some((r) => roles.includes(r));
    if (!hasRole) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
