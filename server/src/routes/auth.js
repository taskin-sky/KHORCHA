import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';
import { auth } from '../middleware/auth.js';
const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const registerSchema = z.object({ name: z.string().min(2).max(60), email: z.string().email(), password: z.string().min(8).max(72) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), remember: z.boolean().optional() });
const sign = (id, remember = true) => jwt.sign({ sub: id }, process.env.JWT_SECRET, { expiresIn: remember ? (process.env.JWT_EXPIRES_IN || '7d') : '12h' });
router.post('/register', limiter, asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body); if (!parsed.success) throw new ApiError(422, 'Validation failed', parsed.error.flatten().fieldErrors);
  if (await User.exists({ email: parsed.data.email.toLowerCase() })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  ok(res, { user, token: sign(user.id) }, 'Account created successfully', 201);
}));
router.post('/login', limiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body); if (!parsed.success) throw new ApiError(422, 'Validation failed');
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new ApiError(401, 'Invalid email or password');
  user.passwordHash = undefined; ok(res, { user, token: sign(user.id, parsed.data.remember) }, 'Welcome back');
}));
router.get('/me', auth, (req, res) => ok(res, { user: req.user }));
router.post('/refresh', auth, (req, res) => ok(res, { token: sign(req.user.id) }, 'Session refreshed'));
router.post('/logout', (_req, res) => ok(res, null, 'Logged out successfully'));
export default router;
