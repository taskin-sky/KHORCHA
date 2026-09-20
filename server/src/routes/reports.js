import { Router } from 'express';
import { Transaction } from '../models/index.js';
import { asyncHandler, monthRange, ok } from '../utils/index.js';
import { dashboardFor } from '../services/finance.js';
const router = Router();
const period = req => { const now = new Date(); return { year: +(req.query.year || now.getFullYear()), month: +(req.query.month || now.getMonth() + 1) }; };
router.get('/dashboard', asyncHandler(async (req, res) => { const p = period(req); ok(res, await dashboardFor(req.user._id, p.year, p.month)); }));
router.get('/reports/:kind', asyncHandler(async (req, res) => { const p = period(req), { start, end } = monthRange(p.year, p.month), kind = req.params.kind; if (kind === 'export') { const items = await Transaction.find({ userId: req.user._id, date: { $gte: start, $lt: end } }).populate('categoryId', 'name').lean(); const esc = x => `"${String(x ?? '').replaceAll('"', '""')}"`; const csv = ['Date,Type,Category,Amount,Payment Method,Note', ...items.map(x => [x.date.toISOString().slice(0, 10), x.type, x.categoryId?.name || 'Archived', x.amount, x.paymentMethod, x.note].map(esc).join(','))].join('\n'); res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', `attachment; filename=khorocha-${p.year}-${p.month}.csv`); return res.send('\ufeff' + csv); } const unit = kind === 'daily' ? { $dayOfMonth: '$date' } : kind === 'weekly' ? { $week: '$date' } : kind === 'monthly' ? '$month' : '$categoryId'; const rows = await Transaction.aggregate([{ $match: { userId: req.user._id, type: 'expense', date: { $gte: start, $lt: end } } }, { $group: { _id: unit, amount: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]); ok(res, { kind, rows, summary: await dashboardFor(req.user._id, p.year, p.month) }); }));
export default router;
