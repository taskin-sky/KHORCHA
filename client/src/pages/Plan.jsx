import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, CalendarDays, CircleDollarSign, Copy, PiggyBank, Save, Search, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import { money, monthLabel, reconcile, shiftMonth, syncCategoryBudgets } from '../utils/finance';
import { Card, ErrorState, PageHead, Progress, Spinner } from '../components/UI';

const now = new Date();

export default function Plan() {
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [categorySearch, setCategorySearch] = useState('');
  const [showAllocatedOnly, setShowAllocatedOnly] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuth(state => state.user);
  const previousPeriod = shiftMonth(period.year, period.month, -1);
  const planQuery = useQuery({
    queryKey: ['plan', period.year, period.month],
    queryFn: () => api.get(`/plans/${period.year}/${period.month}`),
  });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });
  const previousPlanQuery = useQuery({
    queryKey: ['plan', previousPeriod.year, previousPeriod.month],
    queryFn: () => api.get(`/plans/${previousPeriod.year}/${previousPeriod.month}`),
    enabled: planQuery.isSuccess && !planQuery.data?.data,
  });
  const { register, control, reset, watch, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: { expectedIncome: 35000, savingTarget: 5000, status: 'draft', categoryBudgets: [] },
  });
  const { fields } = useFieldArray({ control, name: 'categoryBudgets' });

  useEffect(() => {
    if (planQuery.data?.data && categoriesQuery.data?.data) {
      reset({
        ...planQuery.data.data,
        categoryBudgets: syncCategoryBudgets(planQuery.data.data.categoryBudgets, categoriesQuery.data.data),
      });
    } else if (!planQuery.isLoading && !categoriesQuery.isLoading && !planQuery.data?.data) {
      reset({ expectedIncome: 35000, savingTarget: 5000, status: 'draft', categoryBudgets: [] });
    }
  }, [planQuery.data, planQuery.isLoading, categoriesQuery.data, categoriesQuery.isLoading, reset]);

  const values = watch();
  const reconciliation = reconcile({
    income: values.expectedIncome,
    saving: values.savingTarget,
    budgets: (values.categoryBudgets || []).map(item => ({ amount: item.plannedAmount })),
  });
  const categoryBudgetTotal = (values.categoryBudgets || []).reduce((sum, item) => sum + Number(item.plannedAmount || 0), 0);
  const visibleFields = fields.filter((field, index) => {
    const matchesSearch = (field.label || '').toLowerCase().includes(categorySearch.trim().toLowerCase());
    const hasBudget = Number(values.categoryBudgets?.[index]?.plannedAmount || 0) > 0;
    return matchesSearch && (!showAllocatedOnly || hasBudget);
  });

  const save = useMutation({
    mutationFn: form => api.patch(`/plans/${planQuery.data.data._id}`, {
      ...form,
      expectedIncome: Number(form.expectedIncome),
      savingTarget: Number(form.savingTarget),
      categoryBudgets: form.categoryBudgets.map(item => ({ categoryId: item.categoryId, label: item.label, plannedAmount: Number(item.plannedAmount) })),
    }),
    onSuccess: () => {
      toast.success(`${monthLabel(period.year, period.month)} plan updated`);
      queryClient.invalidateQueries({ queryKey: ['plan', period.year, period.month] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: error => toast.error(error.response?.data?.message || 'Could not save the plan'),
  });

  const createEmpty = useMutation({
    mutationFn: async () => {
      const categories = await api.get('/categories');
      return api.post('/plans', {
        month: period.month,
        year: period.year,
        expectedIncome: Number(user?.defaultIncome || 35000),
        savingTarget: Number(user?.defaultSavingTarget || 5000),
        expectedTripCount: 0,
        tripBudget: 0,
        status: 'draft',
        notes: `Plan for ${monthLabel(period.year, period.month)}`,
        categoryBudgets: categories.data
          .filter(category => category.type === 'expense' && category.isActive)
          .map(category => ({ categoryId: category._id, label: category.name, plannedAmount: 0 })),
      });
    },
    onSuccess: () => {
      toast.success(`${monthLabel(period.year, period.month)} plan created`);
      queryClient.invalidateQueries({ queryKey: ['plan', period.year, period.month] });
    },
    onError: error => toast.error(error.response?.data?.message || 'Could not create the plan'),
  });

  const copyPrevious = useMutation({
    mutationFn: () => api.post(`/plans/${previousPlanQuery.data.data._id}/copy`, period),
    onSuccess: () => {
      toast.success(`${monthLabel(previousPeriod.year, previousPeriod.month)} plan copied successfully`);
      queryClient.invalidateQueries({ queryKey: ['plan', period.year, period.month] });
    },
    onError: error => toast.error(error.response?.data?.message || 'Could not copy the previous plan'),
  });

  const move = offset => setPeriod(current => shiftMonth(current.year, current.month, offset));
  const chooseMonth = event => {
    const [year, month] = event.target.value.split('-').map(Number);
    if (year && month) setPeriod({ year, month });
  };

  const periodControls = <div className="period-controls">
    <button className="icon-btn" type="button" onClick={() => move(-1)} aria-label="Previous month"><ArrowLeft /></button>
    <label className="month-picker">
      <CalendarDays />
      <input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={chooseMonth} />
    </label>
    <button className="icon-btn" type="button" onClick={() => move(1)} aria-label="Next month"><ArrowRight /></button>
  </div>;

  if (planQuery.isLoading || categoriesQuery.isLoading) return <Spinner />;
  if (planQuery.error || categoriesQuery.error) return <ErrorState message={(planQuery.error || categoriesQuery.error)?.response?.data?.message} retry={() => { planQuery.refetch(); categoriesQuery.refetch(); }} />;

  if (!planQuery.data?.data) return <div className="page">
    <PageHead eyebrow="MONTHLY MAP" title={monthLabel(period.year, period.month)} action={periodControls} />
    <Card className="empty-plan">
      <CalendarDays />
      <h2>No plan for {monthLabel(period.year, period.month)}</h2>
      <p>Create a fresh plan for this month, or copy all budget allocations from {monthLabel(previousPeriod.year, previousPeriod.month)}. Transactions will not be copied.</p>
      <div>
        <button className="btn secondary" disabled={!previousPlanQuery.data?.data || copyPrevious.isPending} onClick={() => copyPrevious.mutate()}>
          <Copy /> {previousPlanQuery.isLoading ? 'Checking previous month…' : copyPrevious.isPending ? 'Copying…' : previousPlanQuery.data?.data ? 'Copy previous month' : 'No previous plan'}
        </button>
        <button className="btn primary" disabled={createEmpty.isPending} onClick={() => createEmpty.mutate()}>
          <CalendarDays /> {createEmpty.isPending ? 'Creating…' : 'Create empty plan'}
        </button>
      </div>
    </Card>
  </div>;

  return <div className="page plan-page">
    <PageHead eyebrow="MONTHLY MAP" title={monthLabel(period.year, period.month)} action={periodControls} />
    <div className="plan-actions">
      <div><span className={`plan-status ${values.status}`}>{values.status}</span><small>Set income, savings and spending limits for this month.</small></div>
      <label className="plan-status-select"><span>Plan status</span><select {...register('status')}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
    </div>
    <form onSubmit={handleSubmit(form => save.mutate(form))}>
      <section className="plan-summary">
        <Card className="plan-metric editable"><span className="plan-metric-icon income"><CircleDollarSign /></span><div><small>Expected income</small><label className="plan-money-input"><span>৳</span><input type="number" inputMode="numeric" min="0" {...register('expectedIncome')} /></label><p>Money available this month</p></div></Card>
        <Card className="plan-metric editable"><span className="plan-metric-icon saving"><PiggyBank /></span><div><small>Saving target</small><label className="plan-money-input"><span>৳</span><input type="number" inputMode="numeric" min="0" {...register('savingTarget')} /></label><p>Set aside before spending</p></div></Card>
        <Card className={`plan-metric balance ${reconciliation.unallocated < 0 ? 'over' : ''}`}><span className="plan-metric-icon"><WalletCards /></span><div><small>{reconciliation.unallocated < 0 ? 'Over budget' : 'Still available'}</small><strong>{money(Math.abs(reconciliation.unallocated))}</strong><Progress value={reconciliation.planned / (+values.expectedIncome || 1) * 100} tone={reconciliation.over ? 'red' : ''} /><p>{reconciliation.unallocated < 0 ? 'Reduce one or more category limits' : `${Math.round((reconciliation.planned / (+values.expectedIncome || 1)) * 100)}% of income planned`}</p></div></Card>
      </section>
      <Card className="plan-budget-card">
        <div className="plan-budget-head"><div><p className="eyebrow">ALLOCATIONS</p><h2>Category budgets</h2><p>Enter the maximum amount you want to spend in each category.</p></div><div><small>Total category budget</small><strong>{money(categoryBudgetTotal)}</strong></div></div>
        <div className="plan-budget-tools">
          <label className="plan-category-search"><Search /><input value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Find a category" /></label>
          <button type="button" className={`plan-filter ${showAllocatedOnly ? 'active' : ''}`} onClick={() => setShowAllocatedOnly(current => !current)}>{showAllocatedOnly ? 'Showing budgeted' : 'Hide zero budgets'}</button>
        </div>
        <div className="plan-allocation-grid">{visibleFields.map(field => {
          const index = fields.findIndex(item => item.id === field.id);
          const amount = Number(values.categoryBudgets?.[index]?.plannedAmount || 0);
          const share = Number(values.expectedIncome) > 0 ? Math.round(amount / Number(values.expectedIncome) * 100) : 0;
          return <label className="plan-allocation-row" key={field.id}>
            <span className="plan-category-info"><i style={{ background: field.color || '#5177ff' }} /><span><b>{field.label || 'Category'}</b><small>{amount ? `${share}% of monthly income` : 'No limit set'}</small></span></span>
            <span className="plan-allocation-input"><em>৳</em><input aria-label={`${field.label} budget`} type="number" inputMode="numeric" min="0" {...register(`categoryBudgets.${index}.plannedAmount`)} /></span>
          </label>;
        })}</div>
        {!visibleFields.length && <div className="plan-no-results">No matching categories found.</div>}
        <div className={`plan-save-bar ${reconciliation.unallocated < 0 ? 'over' : ''}`}>
          <div><span>Income <b>{money(values.expectedIncome)}</b></span><span>Categories <b>{money(categoryBudgetTotal)}</b></span><span>Savings <b>{money(values.savingTarget)}</b></span><span>{reconciliation.unallocated < 0 ? 'Over' : 'Available'} <b>{money(Math.abs(reconciliation.unallocated))}</b></span></div>
          <button className="btn primary" disabled={save.isPending || !isDirty}><Save /> {save.isPending ? 'Saving…' : isDirty ? 'Save plan' : 'Saved'}</button>
        </div>
      </Card>
    </form>
  </div>;
}
