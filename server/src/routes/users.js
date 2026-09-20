import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Category, MonthlyPlan, SavingGoal, Transaction, Trip, User } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';
const router = Router();
router.patch('/me', asyncHandler(async (req, res) => { const allowed = ['name', 'preferredCurrency', 'timezone', 'theme', 'defaultIncome', 'defaultSavingTarget']; const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k))); const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }); ok(res, user, 'Settings updated'); }));
router.delete('/me', asyncHandler(async (req, res) => { const user = await User.findById(req.user._id).select('+passwordHash'); if (!req.body.confirm || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) throw new ApiError(401, 'Password confirmation failed'); await Promise.all([Category.deleteMany({ userId: user._id }), MonthlyPlan.deleteMany({ userId: user._id }), Transaction.deleteMany({ userId: user._id }), Trip.deleteMany({ userId: user._id }), SavingGoal.deleteMany({ userId: user._id })]); await user.deleteOne(); ok(res, null, 'Account deleted'); }));
export default router;
