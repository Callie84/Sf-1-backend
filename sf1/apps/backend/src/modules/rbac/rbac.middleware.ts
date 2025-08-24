import { Response, NextFunction } from 'express';
import { AuthedRequest } from '../../middleware/auth';
import { RoleToPermissions, Permission } from './rbac.constants';

export function requirePermissions(required: Permission[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userPermissions = (req.user.roles || []).flatMap((r) => RoleToPermissions[r as keyof typeof RoleToPermissions] || []);
    const ok = required.every((p) => userPermissions.includes(p));
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
