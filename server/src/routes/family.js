import { Router } from 'express';
import { FamilyMember, MonthlyPlan, Transaction } from '../models/index.js';
import { ensureFamilySetup } from '../services/family.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';

const router = Router();
const validPeriod = (year, month) => Number.isInteger(year) && year >= 2000 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12;

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date(), year = Number(req.query.year || now.getFullYear()), month = Number(req.query.month || now.getMonth() + 1);
  if (!validPeriod(year, month)) throw new ApiError(422, 'Invalid month or year');
  const { category, members } = await ensureFamilySetup(req.user._id);
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1));
  const [transactions, plan] = await Promise.all([
    Transaction.find({ userId: req.user._id, categoryId: category._id, familyMemberId: { $ne: null }, date: { $gte: start, $lt: end } }).populate('familyMemberId', 'name color').sort({ date: -1, createdAt: -1 }).lean(),
    MonthlyPlan.findOne({ userId: req.user._id, year, month }).lean(),
  ]);
  const totals = new Map();
  for (const transaction of transactions) {
    const memberId = String(transaction.familyMemberId?._id || transaction.familyMemberId);
    totals.set(memberId, (totals.get(memberId) || 0) + transaction.amount);
  }
  const budget = Number(plan?.categoryBudgets?.find(item => String(item.categoryId?._id || item.categoryId) === String(category._id))?.plannedAmount || 0);
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  ok(res, {
    year,
    month,
    category,
    budget,
    total,
    remaining: budget - total,
    members: members.map(member => ({ ...member.toObject(), total: totals.get(String(member._id)) || 0 })),
    transactions,
  });
}));

router.post('/payments', asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount), date = new Date(req.body.date);
  if (!Number.isInteger(amount) || amount < 1) throw new ApiError(422, 'Enter a valid whole-number amount');
  if (Number.isNaN(date.getTime())) throw new ApiError(422, 'Enter a valid date');
  const { category } = await ensureFamilySetup(req.user._id);
  const member = await FamilyMember.findOne({ _id: req.body.memberId, userId: req.user._id, isActive: true });
  if (!member) throw new ApiError(404, 'Family member not found');
  const transaction = await Transaction.create({ userId: req.user._id, categoryId: category._id, familyMemberId: member._id, type: 'expense', amount, date, note: String(req.body.note || `${member.name} family support`).trim(), paymentMethod: 'cash', entryMode: 'manual' });
  ok(res, transaction, `Payment for ${member.name} added`, 201);
}));

router.delete('/payments/:id', asyncHandler(async (req, res) => {
  const { category } = await ensureFamilySetup(req.user._id);
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id, categoryId: category._id, familyMemberId: { $ne: null } });
  if (!transaction) throw new ApiError(404, 'Family payment not found');
  ok(res, transaction, 'Family payment removed');
}));

export default router;
