export const money = (value = 0) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value);
export const reconcile = ({ income = 0, saving = 0, budgets = [] }) => { const planned = Number(saving) + budgets.reduce((n, x) => n + Number(x.amount || x.plannedAmount || 0), 0); return { planned, unallocated: Number(income) - planned, over: Math.max(0, planned - Number(income)) }; };
export const statusFor = (actual, budget) => !budget ? (actual ? 'No budget set' : 'Safe') : actual > budget ? 'Over budget' : actual === budget ? 'Budget reached' : actual / budget >= .8 ? 'Warning' : 'Safe';
export const shiftMonth = (year, month, offset) => { const date = new Date(year, month - 1 + offset, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; };
export const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleString('en-BD', { month: 'long', year: 'numeric' });
export const syncCategoryBudgets = (budgets = [], categories = []) => {
  const amounts = new Map(budgets.map(item => [String(item.categoryId?._id || item.categoryId), Number(item.plannedAmount || 0)]));
  return categories
    .filter(category => category.type === 'expense' && category.isActive)
    .map(category => ({ categoryId: category._id, label: category.name, color: category.color, plannedAmount: amounts.get(String(category._id)) || 0 }));
};
