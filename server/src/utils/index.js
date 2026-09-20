export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const ok = (res, data, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
export class ApiError extends Error { constructor(status, message, errors = []) { super(message); this.status = status; this.errors = errors; } }
export const monthRange = (year, month) => ({ start: new Date(year, month - 1, 1), end: new Date(year, month, 1) });
export const budgetStatus = (actual, budget) => !budget ? (actual ? 'No budget set' : 'Safe') : actual > budget ? 'Over budget' : actual === budget ? 'Budget reached' : actual / budget >= .8 ? 'Warning' : 'Safe';
