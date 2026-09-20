import { MonthlyPlan, Transaction } from '../models/index.js';
import { budgetStatus, monthRange } from '../utils/index.js';
export async function dashboardFor(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const [totals, byCategory, daily, plan, recent] = await Promise.all([
    Transaction.aggregate([{ $match: { userId, date: { $gte: start, $lt: end } } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { userId, type: 'expense', date: { $gte: start, $lt: end } } }, { $group: { _id: '$categoryId', actual: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { userId, type: 'expense', date: { $gte: start, $lt: end } } }, { $group: { _id: { $dayOfMonth: '$date' }, amount: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    MonthlyPlan.findOne({ userId, year, month }).populate('categoryBudgets.categoryId'),
    Transaction.find({ userId, date: { $gte: start, $lt: end } }).sort({ date: -1 }).limit(6).populate('categoryId', 'name color icon')
  ]);
  const map = Object.fromEntries(totals.map(x => [x._id, x.total]));
  const income = map.income || 0, expense = map.expense || 0, saving = map.saving || 0;
  const actualMap = new Map(byCategory.map(x => [String(x._id), x.actual]));
  const budgets = (plan?.categoryBudgets || []).map(x => { const actual = actualMap.get(String(x.categoryId?._id || x.categoryId)) || 0; const budget = x.plannedAmount; return { categoryId: x.categoryId?._id, name: x.categoryId?.name || x.label || 'Archived', color: x.categoryId?.color, budget, actual, remaining: budget - actual, usage: budget ? Math.round(actual / budget * 100) : null, status: budgetStatus(actual, budget) }; });
  const plannedExpense = Math.max(0, (plan?.expectedIncome || 0) - (plan?.savingTarget || 0));
  return { period: { year, month }, income, expense, saving, available: income - expense - saving, budgetUsage: plannedExpense ? Math.round(expense / plannedExpense * 100) : null, savingProgress: plan?.savingTarget ? Math.round(saving / plan.savingTarget * 100) : 0, plan, budgets, daily: daily.map(x => ({ day: x._id, amount: x.amount })), recent };
}
