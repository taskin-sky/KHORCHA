import { Router } from 'express';
import { Category, MonthlyPlan, Transaction, Trip } from '../models/index.js';
import { ensureSystemCategories } from '../services/systemCategories.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';

const router = Router();
const validPeriod = (year, month) => Number.isInteger(year) && year >= 2000 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12;
const isTripCategory = category => category.purpose === 'trip' || /trip|travel|ভ্রমণ/i.test(`${category.name} ${category.slug}`);

router.get('/:year/:month', asyncHandler(async (req, res) => {
  const year = Number(req.params.year), month = Number(req.params.month);
  if (!validPeriod(year, month)) throw new ApiError(422, 'Invalid month or year');
  await ensureSystemCategories(req.user._id);
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1)), daysInMonth = new Date(year, month, 0).getDate();
  const [categories, plan, trips, cells, totals] = await Promise.all([
    Category.find({ userId: req.user._id, isActive: true }).sort({ type: 1, sortOrder: 1, name: 1 }).lean(),
    MonthlyPlan.findOne({ userId: req.user._id, year, month }).lean(),
    Trip.find({ userId: req.user._id, startDate: { $gte: start, $lt: end } }).sort({ startDate: 1, tripNumber: 1 }).lean(),
    Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: start, $lt: end } } },
      { $group: { _id: { categoryId: '$categoryId', tripId: '$tripId', day: { $dayOfMonth: '$date' } }, amount: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', amount: { $sum: '$amount' } } },
    ]),
  ]);
  const generalAmounts = new Map(), tripAmounts = new Map(), unassignedTripAmounts = new Map();
  const categoryBudgets = new Map((plan?.categoryBudgets || []).map(item => [String(item.categoryId?._id || item.categoryId), Number(item.plannedAmount || 0)]));
  const tripCategory = categories.find(isTripCategory);
  for (const cell of cells) {
    const categoryId = String(cell._id.categoryId), day = cell._id.day, tripId = cell._id.tripId ? String(cell._id.tripId) : null;
    if (tripCategory && categoryId === String(tripCategory._id)) {
      const target = tripId ? tripAmounts : unassignedTripAmounts, key = `${tripId || 'none'}:${day}`;
      target.set(key, (target.get(key) || 0) + cell.amount);
    } else {
      const key = `${categoryId}:${day}`;
      generalAmounts.set(key, (generalAmounts.get(key) || 0) + cell.amount);
    }
  }
  const daysFrom = getter => Object.fromEntries(Array.from({ length: daysInMonth }, (_, index) => [index + 1, getter(index + 1) || 0]));
  const rows = [];
  for (const category of categories) {
    if (!isTripCategory(category)) {
      rows.push({ ...category, categoryId: category._id, rowType: 'category', readOnly: ['family', 'income'].includes(category.purpose), budget: categoryBudgets.get(String(category._id)) || 0, days: daysFrom(day => generalAmounts.get(`${category._id}:${day}`)) });
      continue;
    }
    for (const trip of trips) rows.push({ _id: `trip-${trip._id}`, categoryId: category._id, tripId: trip._id, rowType: 'trip', name: trip.title, subtitle: category.name, color: category.color, type: 'expense', budget: trip.budget, days: daysFrom(day => tripAmounts.get(`${trip._id}:${day}`)) });
    const unassignedTotal = Array.from(unassignedTripAmounts.values()).reduce((sum, amount) => sum + amount, 0);
    if (unassignedTotal) rows.push({ _id: `trip-unassigned-${category._id}`, categoryId: category._id, tripId: null, tripUnassigned: true, rowType: 'trip-unassigned', name: 'Unassigned trip expense', subtitle: category.name, color: category.color, type: 'expense', days: daysFrom(day => unassignedTripAmounts.get(`none:${day}`)) });
  }
  const summary = Object.fromEntries(totals.map(item => [item._id, item.amount]));
  const income = summary.income || 0, expense = summary.expense || 0, saving = summary.saving || 0;
  ok(res, { year, month, daysInMonth, rows, summary: { income, expense, saving, available: income - expense - saving } });
}));

router.put('/cell/value', asyncHandler(async (req, res) => {
  const year = Number(req.body.year), month = Number(req.body.month), day = Number(req.body.day), amount = Number(req.body.amount);
  if (!validPeriod(year, month) || !Number.isInteger(day) || day < 1 || day > new Date(year, month, 0).getDate() || !Number.isInteger(amount) || amount < 0) throw new ApiError(422, 'Enter a valid whole-number amount and date');
  const category = await Category.findOne({ _id: req.body.categoryId, userId: req.user._id, isActive: true });
  if (!category) throw new ApiError(404, 'Active category not found');
  if (category.purpose === 'family') throw new ApiError(409, 'Add member payments from the Family module');
  if (category.purpose === 'income') throw new ApiError(409, 'Add income from the Income module');
  const start = new Date(Date.UTC(year, month - 1, day)), end = new Date(Date.UTC(year, month - 1, day + 1));

  if (req.body.tripId) {
    const trip = await Trip.findOne({ _id: req.body.tripId, userId: req.user._id });
    if (!trip) throw new ApiError(404, 'Trip not found');
    if (trip.categoryId && String(trip.categoryId) !== String(category._id)) throw new ApiError(422, 'Trip category mismatch');
    if (!trip.categoryId) { trip.categoryId = category._id; await trip.save(); }
    await Transaction.deleteMany({ userId: req.user._id, categoryId: category._id, tripId: trip._id, date: { $gte: start, $lt: end } });
    if (amount) await Transaction.create({ userId: req.user._id, categoryId: category._id, tripId: trip._id, type: 'expense', amount, date: start, note: `${trip.title} · sheet entry`, paymentMethod: 'cash', entryMode: 'sheet' });
    return ok(res, { amount, tripId: trip._id }, amount ? 'Trip amount saved' : 'Trip amount cleared');
  }

  if (req.body.tripUnassigned) {
    await Transaction.deleteMany({ userId: req.user._id, categoryId: category._id, tripId: null, date: { $gte: start, $lt: end } });
    if (amount) await Transaction.create({ userId: req.user._id, categoryId: category._id, type: 'expense', amount, date: start, note: 'Unassigned trip expense', paymentMethod: 'cash', entryMode: 'sheet' });
    return ok(res, { amount }, amount ? 'Unassigned trip amount saved' : 'Unassigned trip amount cleared');
  }

  await Transaction.deleteMany({ userId: req.user._id, categoryId: category._id, tripId: null, date: { $gte: start, $lt: end } });
  if (amount) await Transaction.create({ userId: req.user._id, categoryId: category._id, type: category.type, amount, date: start, note: 'Monthly sheet entry', paymentMethod: 'cash', entryMode: 'sheet' });
  ok(res, { amount }, amount ? 'Sheet cell saved' : 'Sheet cell cleared');
}));

export default router;
