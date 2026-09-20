import { Router } from 'express';
import { MonthlyPlan, Trip } from '../models/index.js';
import { ensureSystemCategories } from '../services/systemCategories.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';
const router = Router();
router.use(asyncHandler(async (req, _res, next) => { await ensureSystemCategories(req.user._id); next(); }));
const sanitize = body => { const x = { ...body }; delete x.userId; delete x._id; return x; };
router.get('/current', asyncHandler(async (req, res) => { const now = new Date(); ok(res, await MonthlyPlan.findOne({ userId: req.user._id, year: +(req.query.year || now.getFullYear()), month: +(req.query.month || now.getMonth() + 1) }).populate('categoryBudgets.categoryId')); }));
router.get('/:year/:month', asyncHandler(async (req, res) => ok(res, await MonthlyPlan.findOne({ userId: req.user._id, year: +req.params.year, month: +req.params.month }).populate('categoryBudgets.categoryId'))));
router.post('/', asyncHandler(async (req, res) => {
  const month = Number(req.body.month), year = Number(req.body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) throw new ApiError(422, 'A valid plan month and year are required');
  if (await MonthlyPlan.exists({ userId: req.user._id, month, year })) throw new ApiError(409, `A plan already exists for ${month}/${year}`);
  const item = await MonthlyPlan.create({ ...sanitize(req.body), month, year, userId: req.user._id });
  ok(res, item, 'Monthly plan created', 201);
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const current = await MonthlyPlan.findOne({ _id: req.params.id, userId: req.user._id });
  if (!current) throw new ApiError(404, 'Plan not found');
  const updates = sanitize(req.body), budgets = updates.categoryBudgets || current.categoryBudgets;
  const start = new Date(Date.UTC(current.year, current.month - 1, 1)), end = new Date(Date.UTC(current.year, current.month, 1));
  const reserved = await Trip.aggregate([{ $match: { userId: req.user._id, startDate: { $gte: start, $lt: end }, categoryId: { $ne: null } } }, { $group: { _id: '$categoryId', amount: { $sum: '$budget' } } }]);
  for (const row of reserved) {
    const planned = budgets.find(item => String(item.categoryId?._id || item.categoryId) === String(row._id))?.plannedAmount || 0;
    if (planned < row.amount) throw new ApiError(409, `This category has ${row.amount} BDT reserved across trips. Its plan budget cannot be lower.`);
  }
  Object.assign(current, updates); await current.save(); ok(res, current, 'Plan updated');
}));
router.post('/:id/copy', asyncHandler(async (req, res) => {
  const month = Number(req.body.month), year = Number(req.body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) throw new ApiError(422, 'A valid target month and year are required');
  const source = await MonthlyPlan.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!source) throw new ApiError(404, 'Plan not found');
  if (await MonthlyPlan.exists({ userId: req.user._id, month, year })) throw new ApiError(409, 'A plan already exists for the target month');
  delete source._id; delete source.createdAt; delete source.updatedAt; source.month = month; source.year = year; source.status = 'draft';
  ok(res, await MonthlyPlan.create(source), 'Plan copied to the next month', 201);
}));
export default router;
