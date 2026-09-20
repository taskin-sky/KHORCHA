import { Router } from 'express';
import { MonthlyPlan, Transaction } from '../models/index.js';
import { ensureSystemCategories } from '../services/systemCategories.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';

const router = Router();
const validPeriod = (year, month) => Number.isInteger(year) && year >= 2000 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12;

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date(), year = Number(req.query.year || now.getFullYear()), month = Number(req.query.month || now.getMonth() + 1);
  if (!validPeriod(year, month)) throw new ApiError(422, 'Invalid month or year');
  const { income } = await ensureSystemCategories(req.user._id);
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1));
  const [transactions, plan] = await Promise.all([
    Transaction.find({ userId: req.user._id, categoryId: income._id, type: 'income', date: { $gte: start, $lt: end } }).sort({ date: -1, createdAt: -1 }).lean(),
    MonthlyPlan.findOne({ userId: req.user._id, year, month }).lean(),
  ]);
  const sourceTotals = new Map();
  for (const transaction of transactions) {
    const source = transaction.incomeSource || transaction.note || 'Other income';
    sourceTotals.set(source, (sourceTotals.get(source) || 0) + transaction.amount);
  }
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  ok(res, { year, month, category: income, expectedIncome: Number(plan?.expectedIncome || 0), total, remainingToTarget: Number(plan?.expectedIncome || 0) - total, sources: Array.from(sourceTotals, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount), transactions });
}));

router.post('/entries', asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount), date = new Date(req.body.date), source = String(req.body.source || '').trim();
  if (!source) throw new ApiError(422, 'Income source is required');
  if (!Number.isInteger(amount) || amount < 1) throw new ApiError(422, 'Enter a valid whole-number amount');
  if (Number.isNaN(date.getTime())) throw new ApiError(422, 'Enter a valid date');
  const { income } = await ensureSystemCategories(req.user._id);
  const transaction = await Transaction.create({ userId: req.user._id, categoryId: income._id, type: 'income', amount, date, incomeSource: source, note: String(req.body.note || source).trim(), paymentMethod: req.body.paymentMethod || 'bank', entryMode: 'manual' });
  ok(res, transaction, `${source} income added`, 201);
}));

router.delete('/entries/:id', asyncHandler(async (req, res) => {
  const { income } = await ensureSystemCategories(req.user._id);
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id, categoryId: income._id, type: 'income' });
  if (!transaction) throw new ApiError(404, 'Income entry not found');
  ok(res, transaction, 'Income entry removed');
}));

export default router;
