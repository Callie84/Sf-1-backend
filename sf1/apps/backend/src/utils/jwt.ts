import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface JwtPayloadBase {
  sub: string;
  roles: string[];
  tenantId?: string;
}

export function signAccessToken(payload: JwtPayloadBase): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyAccessToken<T extends object = JwtPayloadBase>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

export function signRefreshToken(payload: JwtPayloadBase): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}
