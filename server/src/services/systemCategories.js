import { Category, MonthlyPlan, Transaction, Trip } from '../models/index.js';
import { ensureFamilySetup } from './family.js';

async function createSafely(userId, values) {
  try {
    return await Category.create({ userId, ...values, isDefault: true, isActive: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Category.findOne({ userId, slug: values.slug, type: values.type });
  }
}

async function normalizeCategory(category, values) {
  await Category.updateOne({ _id: category._id }, { $set: { ...values, isDefault: true, isActive: true } });
  Object.assign(category, values, { isDefault: true, isActive: true });
  return category;
}

export async function ensureSystemCategories(userId) {
  const family = await ensureFamilySetup(userId);
  let categories = await Category.find({ userId });

  let income = categories.find(category => category.purpose === 'income' || (category.type === 'income' && /^income$/i.test(category.name)));
  if (!income) income = await createSafely(userId, { name: 'Income', slug: 'income', icon: 'CircleDollarSign', color: '#10b981', type: 'income', purpose: 'income', sortOrder: 0 });
  await normalizeCategory(income, { name: 'Income', icon: 'CircleDollarSign', color: '#10b981', type: 'income', purpose: 'income' });
  const legacyIncome = categories.filter(category => category.type === 'income' && String(category._id) !== String(income._id));
  for (const category of legacyIncome) {
    await Transaction.updateMany({ userId, categoryId: category._id, $or: [{ incomeSource: { $exists: false } }, { incomeSource: null }, { incomeSource: '' }] }, { $set: { incomeSource: category.name } });
    await Transaction.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: income._id } });
  }
  if (legacyIncome.length) await Category.updateMany({ _id: { $in: legacyIncome.map(category => category._id) } }, { $set: { isActive: false } });

  let saving = categories.find(category => category.purpose === 'saving' || (category.type === 'saving' && /^savings?$/i.test(category.name))) || categories.find(category => category.type === 'saving');
  if (!saving) saving = await createSafely(userId, { name: 'Savings', slug: 'savings', icon: 'PiggyBank', color: '#22c55e', type: 'saving', purpose: 'saving', sortOrder: 1 });
  await normalizeCategory(saving, { name: 'Savings', icon: 'PiggyBank', color: '#22c55e', type: 'saving', purpose: 'saving' });
  const legacySaving = categories.filter(category => category.type === 'saving' && String(category._id) !== String(saving._id));
  for (const category of legacySaving) await Transaction.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: saving._id } });
  if (legacySaving.length) await Category.updateMany({ _id: { $in: legacySaving.map(category => category._id) } }, { $set: { isActive: false } });

  categories = await Category.find({ userId });
  const tripCandidates = categories.filter(category => category.purpose === 'trip' || (category.type === 'expense' && /trip|travel|ভ্রমণ/i.test(`${category.name} ${category.slug}`)));
  let trips = tripCandidates.find(category => category.purpose === 'trip' && category.isActive) || tripCandidates.find(category => category.isActive) || tripCandidates[0];
  if (!trips) trips = await createSafely(userId, { name: 'Trips', slug: 'trips', icon: 'Map', color: '#0ea5e9', type: 'expense', purpose: 'trip', sortOrder: 3 });
  await normalizeCategory(trips, { name: 'Trips', icon: 'Map', color: trips.color || '#0ea5e9', type: 'expense', purpose: 'trip' });
  const legacyTrips = tripCandidates.filter(category => String(category._id) !== String(trips._id));
  for (const category of legacyTrips) {
    await Promise.all([
      Transaction.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: trips._id } }),
      Trip.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: trips._id } }),
    ]);
  }

  const legacyTripIds = new Set(legacyTrips.map(category => String(category._id)));
  const plans = await MonthlyPlan.find({ userId });
  for (const plan of plans) {
    let tripBudget = 0, tripEntries = 0, legacyEntries = 0;
    const retained = [];
    for (const budget of plan.categoryBudgets) {
      const categoryId = String(budget.categoryId?._id || budget.categoryId);
      if (categoryId === String(trips._id)) { tripEntries += 1; tripBudget += Number(budget.plannedAmount || 0); }
      else if (legacyTripIds.has(categoryId)) { legacyEntries += 1; tripBudget += Number(budget.plannedAmount || 0); }
      else retained.push({ categoryId: budget.categoryId, label: budget.label, plannedAmount: Number(budget.plannedAmount || 0) });
    }
    if (tripEntries !== 1 || legacyEntries > 0) {
      retained.push({ categoryId: trips._id, label: 'Trips', plannedAmount: tripBudget });
      await MonthlyPlan.updateOne({ _id: plan._id, userId }, { $set: { categoryBudgets: retained } });
    }
  }
  if (legacyTrips.length) await Category.updateMany({ _id: { $in: legacyTrips.map(category => category._id) } }, { $set: { isActive: false } });

  return { family: family.category, income, saving, trips };
}

export const isProtectedCategory = category => ['family', 'trip', 'saving', 'income'].includes(category.purpose);
