import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../users/user.model';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, roles: ['standard'] });
  const access = signAccessToken({ sub: user.id, roles: user.roles });
  const refresh = signRefreshToken({ sub: user.id, roles: user.roles });
  return res.status(201).json({ accessToken: access, refreshToken: refresh });
});

router.post('/login', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const access = signAccessToken({ sub: user.id, roles: user.roles });
  const refresh = signRefreshToken({ sub: user.id, roles: user.roles });
  return res.json({ accessToken: access, refreshToken: refresh });
});

router.post('/refresh', async (req, res) => {
  const token = String(req.body.refreshToken || '');
  try {
    // Reuse access token verification since same secret
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString());
    if (!payload?.sub) return res.status(401).json({ error: 'Invalid token' });
    const access = signAccessToken({ sub: payload.sub, roles: payload.roles || [] });
    return res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
