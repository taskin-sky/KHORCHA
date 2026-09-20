import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from '../config/db.js';
import { Category, MonthlyPlan, SavingGoal, Transaction, Trip, User } from '../models/index.js';
const categories = [
  ['Salary','salary','income','#10b981'], ['Savings','savings','saving','#22c55e'], ['Babamony','babamony','expense','#8b5cf6'], ['Ammu','ammu','expense','#ec4899'], ['Tanjim','tanjim','expense','#f97316'], ['Niha','niha','expense','#e879f9'],
  ['Sublet + Khabar','sublet-khabar','expense','#4361ee'], ['Nasta','nasta','expense','#f59e0b'], ['Mobile/Internet','mobile-internet','expense','#06b6d4'], ['Personal Care','personal-care','expense','#fb7185'], ['Cha/Snacks/Hatkhoroch','snacks','expense','#f97316'], ['Lottery/Somiti','somiti','expense','#a78bfa'], ['Rajshahi Trips','rajshahi-trips','expense','#0ea5e9'], ['Emergency','emergency','expense','#ef4444']
];
async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seeding is disabled in production'); await connectDb();
  const email = 'demo@khorocha.app'; let user = await User.findOne({ email }); if (!user) user = await User.create({ name: 'Taskin', email, passwordHash: await bcrypt.hash('Khorocha123!', 12) });
  await Promise.all([Category.deleteMany({ userId: user._id }), MonthlyPlan.deleteMany({ userId: user._id }), Transaction.deleteMany({ userId: user._id }), Trip.deleteMany({ userId: user._id }), SavingGoal.deleteMany({ userId: user._id })]);
  const created = await Category.insertMany(categories.map(([name,slug,type,color], i) => ({ userId: user._id, name, slug, type, color, purpose: slug === 'rajshahi-trips' ? 'trip' : 'general', icon: type === 'income' ? 'BriefcaseBusiness' : type === 'saving' ? 'PiggyBank' : 'WalletCards', isDefault: true, sortOrder: i })));
  const bySlug = Object.fromEntries(created.map(x => [x.slug, x])); const now = new Date(), year = now.getFullYear(), month = now.getMonth() + 1;
  await MonthlyPlan.create({ userId: user._id, year, month, expectedIncome: 35000, savingTarget: 5000, expectedTripCount: 3, tripBudget: 9000, status: 'active', notes: 'Balanced 35,000 BDT sample plan', categoryBudgets: [['babamony',2000],['ammu',1000],['tanjim',500],['niha',1000],['sublet-khabar',9500],['nasta',2000],['mobile-internet',500],['personal-care',500],['snacks',1500],['somiti',500],['rajshahi-trips',9000],['emergency',2000]].map(([slug, plannedAmount]) => ({ categoryId: bySlug[slug]._id, label: bySlug[slug].name, plannedAmount })) });
  const trips = await Trip.insertMany([1,2,3].map((n, i) => ({ userId: user._id, title: `Rajshahi Trip ${n}`, destination: 'Rajshahi', tripNumber: n, startDate: new Date(year, month - 1, 4 + i * 8), endDate: new Date(year, month - 1, 6 + i * 8), budget: 3000 })));
  await Transaction.insertMany([{ userId:user._id,type:'income',amount:35000,categoryId:bySlug.salary._id,date:new Date(year,month-1,1),note:'Monthly salary',paymentMethod:'bank' },{ userId:user._id,type:'saving',amount:3000,categoryId:bySlug.savings._id,date:new Date(year,month-1,2),note:'Monthly savings',paymentMethod:'bank' },{ userId:user._id,type:'expense',amount:9500,categoryId:bySlug['sublet-khabar']._id,date:new Date(year,month-1,3),note:'Rent and food',paymentMethod:'cash' },{ userId:user._id,type:'expense',amount:1200,categoryId:bySlug['rajshahi-trips']._id,date:new Date(year,month-1,5),note:'Train ticket',paymentMethod:'mobile-banking',tripId:trips[0]._id }]);
  await SavingGoal.create({ userId:user._id,title:'Emergency fund',targetAmount:60000,targetDate:new Date(year+1,0,1),icon:'ShieldCheck',color:'#10b981' });
  console.log('Seed complete. Demo: demo@khorocha.app / Khorocha123!'); process.exit(0);
}
seed().catch(err => { console.error(err.message); process.exit(1); });
