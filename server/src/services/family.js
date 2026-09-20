import { Category, FamilyMember, MonthlyPlan, Transaction } from '../models/index.js';

export const DEFAULT_FAMILY_MEMBERS = [
  { name: 'Babamony', color: '#8b5cf6' },
  { name: 'Ammu', color: '#ec4899' },
  { name: 'Tanjim', color: '#f97316' },
  { name: 'Niha', color: '#d946ef' },
];

export async function ensureFamilySetup(userId) {
  const categories = await Category.find({ userId });
  let familyCategory = categories.find(category => category.purpose === 'family' || /^family$/i.test(category.name) || /^family$/i.test(category.slug));
  if (!familyCategory) {
    try {
      familyCategory = await Category.create({ userId, name: 'Family', slug: 'family', icon: 'UsersRound', color: '#8b5cf6', type: 'expense', purpose: 'family', isDefault: true, sortOrder: 2 });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      familyCategory = await Category.findOne({ userId, slug: 'family' });
    }
  } else {
    const needsUpdate = familyCategory.name !== 'Family' || familyCategory.type !== 'expense' || familyCategory.purpose !== 'family' || !familyCategory.isActive || familyCategory.icon !== 'UsersRound';
    if (needsUpdate) {
      Object.assign(familyCategory, { name: 'Family', type: 'expense', purpose: 'family', isActive: true, icon: 'UsersRound' });
      await familyCategory.save();
    }
  }

  const existingMembers = await FamilyMember.find({ userId });
  const memberByName = new Map(existingMembers.map(member => [member.name.toLowerCase(), member]));
  for (const [sortOrder, item] of DEFAULT_FAMILY_MEMBERS.entries()) {
    if (!memberByName.has(item.name.toLowerCase())) {
      const member = await FamilyMember.findOneAndUpdate({ userId, name: item.name }, { $setOnInsert: { ...item, sortOrder, isActive: true } }, { upsert: true, new: true });
      memberByName.set(item.name.toLowerCase(), member);
    }
  }

  const legacyNames = new Set(DEFAULT_FAMILY_MEMBERS.map(item => item.name.toLowerCase()));
  const legacyCategories = categories.filter(category => String(category._id) !== String(familyCategory._id) && legacyNames.has(category.name.trim().toLowerCase()));
  if (legacyCategories.length) {
    for (const category of legacyCategories) {
      const member = memberByName.get(category.name.trim().toLowerCase());
      await Transaction.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: familyCategory._id, familyMemberId: member._id } });
    }
  }

  const legacyIds = new Set(legacyCategories.map(category => String(category._id)));
  const plans = await MonthlyPlan.find({ userId });
  for (const plan of plans) {
    let familyBudget = 0;
    const retained = [];
    let familyEntries = 0, legacyEntries = 0;
    for (const budget of plan.categoryBudgets) {
      const categoryId = String(budget.categoryId?._id || budget.categoryId);
      if (categoryId === String(familyCategory._id)) { familyEntries += 1; familyBudget += Number(budget.plannedAmount || 0); }
      else if (legacyIds.has(categoryId)) { legacyEntries += 1; familyBudget += Number(budget.plannedAmount || 0); }
      else retained.push({ categoryId: budget.categoryId, label: budget.label, plannedAmount: Number(budget.plannedAmount || 0) });
    }
    if (familyEntries !== 1 || legacyEntries > 0) {
      retained.push({ categoryId: familyCategory._id, label: 'Family', plannedAmount: familyBudget });
      await MonthlyPlan.updateOne({ _id: plan._id, userId }, { $set: { categoryBudgets: retained } });
    }
  }

  if (legacyCategories.length) await Category.updateMany({ userId, _id: { $in: legacyCategories.map(category => category._id) } }, { $set: { isActive: false } });
  const members = await FamilyMember.find({ userId, isActive: true }).sort({ sortOrder: 1, name: 1 });
  return { category: familyCategory, members };
}
