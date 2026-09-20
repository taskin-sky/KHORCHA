import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/index.js';
export const auth = asyncHandler(async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : req.cookies?.token;
  if (!token) throw new ApiError(401, 'Authentication required');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Session is no longer valid');
  req.user = user; next();
});
