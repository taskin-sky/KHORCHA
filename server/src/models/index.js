import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const base = { userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true } };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false }, preferredCurrency: { type: String, default: 'BDT' }, timezone: { type: String, default: 'Asia/Dhaka' },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' }, defaultIncome: { type: Number, default: 35000, min: 0 }, defaultSavingTarget: { type: Number, default: 5000, min: 0 }
}, { timestamps: true });
userSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } });

const categorySchema = new Schema({ ...base, name: { type: String, required: true }, slug: { type: String, required: true }, icon: { type: String, default: 'Wallet' }, color: { type: String, default: '#4361ee' }, type: { type: String, enum: ['income', 'expense', 'saving'], required: true }, purpose: { type: String, enum: ['general', 'trip', 'family', 'income', 'saving'], default: 'general' }, isDefault: { type: Boolean, default: false }, isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 } }, { timestamps: true });
categorySchema.index({ userId: 1, slug: 1, type: 1 }, { unique: true });

const planSchema = new Schema({ ...base, month: { type: Number, min: 1, max: 12, required: true }, year: { type: Number, required: true }, expectedIncome: { type: Number, min: 0, required: true }, savingTarget: { type: Number, min: 0, default: 0 }, categoryBudgets: [{ categoryId: { type: Schema.Types.ObjectId, ref: 'Category' }, label: String, plannedAmount: { type: Number, min: 0 } }], expectedTripCount: { type: Number, min: 0, default: 0 }, tripBudget: { type: Number, min: 0, default: 0 }, notes: String, status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' } }, { timestamps: true });
planSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const transactionSchema = new Schema({ ...base, type: { type: String, enum: ['income', 'expense', 'saving'], required: true }, amount: { type: Number, required: true, min: 1 }, categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true }, date: { type: Date, required: true }, note: { type: String, trim: true, maxlength: 240 }, paymentMethod: { type: String, enum: ['cash', 'card', 'bank', 'mobile-banking'], default: 'cash' }, tripId: { type: Schema.Types.ObjectId, ref: 'Trip', default: null }, familyMemberId: { type: Schema.Types.ObjectId, ref: 'FamilyMember', default: null }, incomeSource: { type: String, trim: true, maxlength: 100 }, entryMode: { type: String, enum: ['manual', 'sheet'], default: 'manual' }, month: Number, year: Number }, { timestamps: true });
transactionSchema.pre('validate', function () { const d = new Date(this.date); this.month = d.getMonth() + 1; this.year = d.getFullYear(); });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: 1, entryMode: 1 });

const tripSchema = new Schema({ ...base, title: { type: String, required: true }, destination: { type: String, default: '' }, categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true }, tripNumber: { type: Number, required: true }, startDate: { type: Date, required: true }, endDate: Date, budget: { type: Number, min: 1, required: true }, notes: String }, { timestamps: true });
tripSchema.index({ userId: 1, tripNumber: 1 });
const familyMemberSchema = new Schema({ ...base, name: { type: String, required: true, trim: true }, color: { type: String, default: '#8b5cf6' }, isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 } }, { timestamps: true });
familyMemberSchema.index({ userId: 1, name: 1 }, { unique: true });
const goalSchema = new Schema({ ...base, title: { type: String, required: true }, targetAmount: { type: Number, min: 1, required: true }, targetDate: Date, icon: { type: String, default: 'Target' }, color: { type: String, default: '#10b981' }, status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' } }, { timestamps: true });

export const User = model('User', userSchema);
export const Category = model('Category', categorySchema);
export const MonthlyPlan = model('MonthlyPlan', planSchema);
export const Transaction = model('Transaction', transactionSchema);
export const Trip = model('Trip', tripSchema);
export const FamilyMember = model('FamilyMember', familyMemberSchema);
export const SavingGoal = model('SavingGoal', goalSchema);
