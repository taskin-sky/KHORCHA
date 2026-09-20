import { Router } from 'express';
import { Category, MonthlyPlan, Transaction, Trip } from '../models/index.js';
import { DEFAULT_FAMILY_MEMBERS } from '../services/family.js';
import { ensureSystemCategories, isProtectedCategory } from '../services/systemCategories.js';
import { ApiError, asyncHandler, ok } from '../utils/index.js';
const router = Router();
router.use(asyncHandler(async (req, _res, next) => { await ensureSystemCategories(req.user._id); next(); }));
router.get('/', asyncHandler(async (req, res) => {
  const hiddenFamilyNames = new Set(DEFAULT_FAMILY_MEMBERS.map(item => item.name.toLowerCase()));
  const items = await Category.find({ userId: req.user._id }).sort({ type: 1, sortOrder: 1 });
  ok(res, items.filter(category => {
    if (hiddenFamilyNames.has(category.name.trim().toLowerCase()) && category.purpose !== 'family') return false;
    if (!category.isActive && (['income', 'saving'].includes(category.type) || category.purpose === 'trip')) return false;
    return true;
  }));
}));
router.post('/', asyncHandler(async (req, res) => {
  const sameName = await Category.exists({ userId: req.user._id, type: req.body.type, name: { $regex: `^${String(req.body.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
  if (sameName) throw new ApiError(409, 'A category with this name already exists');
  const inferredPurpose = req.body.type === 'expense' && /trip|travel|ভ্রমণ/i.test(`${req.body.name || ''} ${req.body.slug || ''}`) ? 'trip' : 'general';
  const item = await Category.create({ ...req.body, purpose: req.body.purpose || inferredPurpose, userId: req.user._id });
  if (item.type === 'expense' && item.isActive) {
    await MonthlyPlan.updateMany(
      { userId: req.user._id, status: { $in: ['draft', 'active'] } },
      { $addToSet: { categoryBudgets: { categoryId: item._id, label: item.name, plannedAmount: 0 } } },
    );
  }
  ok(res, item, 'Category created and added to open plans', 201);
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  delete req.body.userId;
  const current = await Category.findOne({ _id: req.params.id, userId: req.user._id });
  if (!current) throw new ApiError(404, 'Category not found');
  if (isProtectedCategory(current) && req.body.name && req.body.name !== current.name) throw new ApiError(409, `${current.name} is a system category and cannot be renamed`);
  if (req.body.name) {
    const duplicate = await Category.exists({ _id: { $ne: current._id }, userId: req.user._id, type: current.type, name: { $regex: `^${String(req.body.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (duplicate) throw new ApiError(409, 'A category with this name already exists');
  }
  Object.assign(current, req.body); await current.save();
  if (req.body.name) await MonthlyPlan.updateMany(
    { userId: req.user._id, 'categoryBudgets.categoryId': current._id },
    { $set: { 'categoryBudgets.$[budget].label': current.name } },
    { arrayFilters: [{ 'budget.categoryId': current._id }] },
  );
  ok(res, current, 'Category renamed successfully');
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  const query = { _id: req.params.id, userId: req.user._id };
  const protectedCategory = await Category.findOne(query);
  if (protectedCategory && isProtectedCategory(protectedCategory)) throw new ApiError(409, `${protectedCategory.name} is a system category and cannot be removed`);
  if (await Trip.exists({ userId: req.user._id, categoryId: req.params.id })) throw new ApiError(409, 'This category is assigned to trips and cannot be removed');
  const used = await Transaction.exists({ userId: req.user._id, categoryId: req.params.id });
  const item = used ? await Category.findOneAndUpdate(query, { isActive: false }, { new: true }) : await Category.findOneAndDelete(query);
  if (!item) throw new ApiError(404, 'Category not found');
  await MonthlyPlan.updateMany(
    { userId: req.user._id, status: { $in: ['draft', 'active'] } },
    { $pull: { categoryBudgets: { categoryId: item._id } } },
  );
  ok(res, item, used ? 'Category deactivated and removed from open plans' : 'Category deleted from open plans');
}));
export default router;
