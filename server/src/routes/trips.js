import { Router } from 'express';
import { Category, MonthlyPlan, Transaction, Trip } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';
import { ensureSystemCategories } from '../services/systemCategories.js';

const router = Router();
router.use(asyncHandler(async (req, _res, next) => { await ensureSystemCategories(req.user._id); next(); }));
const periodFor = dateValue => { const date = new Date(dateValue); return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)) }; };
const tripCategoryFor = async userId => Category.findOne({ userId, type: 'expense', isActive: true, $or: [{ purpose: 'trip' }, { slug: /trip|travel/i }, { name: /trip|travel|ভ্রমণ/i }] }).sort({ purpose: -1, sortOrder: 1 });

async function allocationFor({ userId, startDate, budget, excludeId }) {
  if (!Number.isInteger(Number(budget)) || Number(budget) < 1) throw new ApiError(422, 'Trip budget must be a positive whole number');
  const category = await tripCategoryFor(userId);
  if (!category) throw new ApiError(422, 'Create one expense category containing “Trip” and allocate its monthly budget first');
  const period = periodFor(startDate);
  if (Number.isNaN(period.year)) throw new ApiError(422, 'A valid start date is required');
  const plan = await MonthlyPlan.findOne({ userId, year: period.year, month: period.month });
  const allocation = plan?.categoryBudgets.find(item => String(item.categoryId) === String(category._id))?.plannedAmount || 0;
  if (!allocation) throw new ApiError(422, `${category.name} has no budget allocation in this month's plan`);
  const tripQuery = { userId, startDate: { $gte: period.start, $lt: period.end } };
  if (excludeId) tripQuery._id = { $ne: excludeId };
  const reservedRows = await Trip.aggregate([{ $match: tripQuery }, { $group: { _id: null, total: { $sum: '$budget' } } }]);
  const reserved = reservedRows[0]?.total || 0;
  if (reserved + Number(budget) > allocation) throw new ApiError(409, `Only ${Math.max(0, allocation - reserved)} BDT remains in the ${category.name} trip budget`);
  return { category, allocation, reserved, period };
}

router.get('/budget-options', asyncHandler(async (req, res) => {
  const now = new Date(), year = Number(req.query.year || now.getFullYear()), month = Number(req.query.month || now.getMonth() + 1);
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1));
  const [plan, category] = await Promise.all([MonthlyPlan.findOne({ userId: req.user._id, year, month }), tripCategoryFor(req.user._id)]);
  if (!plan || !category) return ok(res, { year, month, category: category ? { _id: category._id, name: category.name, color: category.color } : null, allocated: 0, reserved: 0, remaining: 0 });
  const allocated = plan.categoryBudgets.find(item => String(item.categoryId) === String(category._id))?.plannedAmount || 0;
  const reservedRows = await Trip.aggregate([{ $match: { userId: req.user._id, startDate: { $gte: start, $lt: end } } }, { $group: { _id: null, amount: { $sum: '$budget' } } }]);
  const reserved = reservedRows[0]?.amount || 0;
  ok(res, { year, month, category: { _id: category._id, name: category.name, color: category.color }, allocated, reserved, remaining: Math.max(0, allocated - reserved) });
}));

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date(), year = Number(req.query.year || now.getFullYear()), month = Number(req.query.month || now.getMonth() + 1);
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1));
  const tripCategory = await tripCategoryFor(req.user._id);
  if (tripCategory) await Trip.updateMany({ userId: req.user._id, categoryId: null }, { categoryId: tripCategory._id });
  const trips = await Trip.find({ userId: req.user._id, startDate: { $gte: start, $lt: end } }).populate('categoryId', 'name color').sort({ startDate: 1, tripNumber: 1 });
  const totals = await Transaction.aggregate([{ $match: { userId: req.user._id, type: 'expense', tripId: { $in: trips.map(trip => trip._id) } } }, { $group: { _id: '$tripId', actual: { $sum: '$amount' } } }]);
  const map = new Map(totals.map(item => [String(item._id), item.actual]));
  ok(res, trips.map(trip => { const actual = map.get(String(trip._id)) || 0; return { ...trip.toJSON(), actual, remaining: trip.budget - actual }; }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { category } = await allocationFor({ userId: req.user._id, startDate: req.body.startDate, budget: req.body.budget });
  const period = periodFor(req.body.startDate);
  const lastTrip = await Trip.findOne({ userId: req.user._id, startDate: { $gte: period.start, $lt: period.end } }).sort({ tripNumber: -1 });
  const item = await Trip.create({ userId: req.user._id, title: req.body.title, destination: req.body.destination || '', categoryId: category._id, tripNumber: (lastTrip?.tripNumber || 0) + 1, startDate: req.body.startDate, endDate: req.body.endDate || req.body.startDate, budget: Number(req.body.budget), notes: req.body.notes || '' });
  ok(res, item, 'Trip created from the monthly category budget', 201);
}));

router.get('/:id/summary', asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
  if (!trip) throw new ApiError(404, 'Trip not found');
  if (!trip.categoryId) { const category = await tripCategoryFor(req.user._id); if (category) { trip.categoryId = category._id; await trip.save(); } }
  await trip.populate('categoryId', 'name color');
  const transactions = await Transaction.find({ userId: req.user._id, tripId: trip._id }).populate('categoryId');
  const actual = transactions.reduce((sum, item) => sum + item.amount, 0);
  ok(res, { trip, actual, remaining: trip.budget - actual, usage: trip.budget ? Math.round(actual / trip.budget * 100) : null, transactions });
}));

router.get('/:id', asyncHandler(async (req, res) => { const item = await Trip.findOne({ _id: req.params.id, userId: req.user._id }).populate('categoryId', 'name color'); if (!item) throw new ApiError(404, 'Trip not found'); ok(res, item); }));

router.patch('/:id', asyncHandler(async (req, res) => {
  const current = await Trip.findOne({ _id: req.params.id, userId: req.user._id });
  if (!current) throw new ApiError(404, 'Trip not found');
  const startDate = req.body.startDate || current.startDate, budget = req.body.budget ?? current.budget;
  const { category } = await allocationFor({ userId: req.user._id, startDate, budget, excludeId: current._id });
  current.categoryId = category._id;
  for (const key of ['title', 'destination', 'startDate', 'endDate', 'budget', 'notes']) if (req.body[key] !== undefined) current[key] = req.body[key];
  await current.save(); ok(res, current, 'Trip updated');
}));

router.delete('/:id', asyncHandler(async (req, res) => { if (await Transaction.exists({ userId: req.user._id, tripId: req.params.id })) throw new ApiError(409, 'Clear this trip’s expenses before deleting it'); const item = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.user._id }); if (!item) throw new ApiError(404, 'Trip not found'); ok(res, item, 'Trip deleted'); }));

export default router;
