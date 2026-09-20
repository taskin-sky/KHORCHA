import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, CircleDollarSign, Plus, Trash2, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Empty, ErrorState, PageHead, Progress, Spinner } from '../components/UI';
import { api } from '../services/api';
import { money, monthLabel, shiftMonth } from '../utils/finance';

const now = new Date();
const dateFor = (year, month, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function Income() {
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [form, setForm] = useState({ source: '', amount: '', date: now.toISOString().slice(0, 10), note: '', paymentMethod: 'bank' });
  const queryClient = useQueryClient();
  const income = useQuery({ queryKey: ['income', period.year, period.month], queryFn: () => api.get('/income', { params: period }) });
  const data = income.data?.data;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['income', period.year, period.month] });
    queryClient.invalidateQueries({ queryKey: ['sheet', period.year, period.month] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const addEntry = useMutation({
    mutationFn: () => api.post('/income/entries', { ...form, amount: Number(form.amount) }),
    onSuccess: response => { toast.success(response.message); setForm(current => ({ ...current, source: '', amount: '', note: '' })); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Income could not be added'),
  });
  const removeEntry = useMutation({
    mutationFn: id => api.delete(`/income/entries/${id}`),
    onSuccess: response => { toast.success(response.message); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Income entry could not be removed'),
  });
  const setMonth = next => { setPeriod(next); setForm(current => ({ ...current, date: dateFor(next.year, next.month), amount: '', note: '' })); };
  const move = offset => setMonth(shiftMonth(period.year, period.month, offset));
  const chooseMonth = event => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) setMonth({ year, month }); };

  if (income.isLoading) return <Spinner />;
  if (income.error) return <ErrorState message={income.error.response?.data?.message} retry={income.refetch} />;

  const periodControls = <div className="period-controls"><button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><ArrowLeft /></button><label className="month-picker"><CalendarDays /><input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={chooseMonth} /></label><button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><ArrowRight /></button></div>;
  const targetProgress = data.expectedIncome ? data.total / data.expectedIncome * 100 : 0;

  return <div className="page income-page">
    <PageHead eyebrow="MONEY IN" title="Income" action={periodControls} />
    <Card className="income-hero">
      <div className="income-hero-title"><span><ArrowDownToLine /></span><div><h2>Monthly income</h2><p>Add salary, business, freelance or any other income separately.</p></div></div>
      <div className="income-summary"><span><small>Expected</small><b>{money(data.expectedIncome)}</b></span><span><small>Received</small><b className="positive">{money(data.total)}</b></span><span><small>{data.remainingToTarget < 0 ? 'Above target' : 'Still expected'}</small><b>{money(Math.abs(data.remainingToTarget))}</b></span><span><small>Income sources</small><b>{data.sources.length}</b></span></div>
      <Progress value={targetProgress} />
    </Card>

    <Card className="income-entry-card">
      <div className="card-title"><div><p className="eyebrow">ADD INCOME</p><h2>Record money received</h2></div><CircleDollarSign /></div>
      <form className="income-entry-form" onSubmit={event => { event.preventDefault(); if (form.source.trim() && form.amount) addEntry.mutate(); }}>
        <label>Income source<input required value={form.source} onChange={event => setForm(current => ({ ...current, source: event.target.value }))} placeholder="Salary, business, freelance…" /></label>
        <label>Amount<input required type="number" inputMode="numeric" min="1" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="৳ 0" /></label>
        <label>Date<input required type="date" min={dateFor(period.year, period.month)} max={dateFor(period.year, period.month, new Date(period.year, period.month, 0).getDate())} value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label>
        <label>Received via<select value={form.paymentMethod} onChange={event => setForm(current => ({ ...current, paymentMethod: event.target.value }))}><option value="bank">Bank</option><option value="cash">Cash</option><option value="mobile-banking">Mobile banking</option><option value="card">Card</option></select></label>
        <label>Note <small>(optional)</small><input value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="Short note" /></label>
        <button className="btn primary" disabled={!form.source.trim() || !form.amount || addEntry.isPending}><Plus /> {addEntry.isPending ? 'Adding…' : 'Add income'}</button>
      </form>
    </Card>

    {!!data.sources.length && <section className="income-sources">{data.sources.map((source, index) => <Card key={source.name} style={{ '--income-delay': `${index * 45}ms` }}><span className="income-source-icon">{index === 0 ? <BriefcaseBusiness /> : <WalletCards />}</span><span><small>{source.name}</small><strong>{money(source.amount)}</strong></span></Card>)}</section>}

    <Card className="income-history">
      <div className="card-title"><div><p className="eyebrow">INCOME HISTORY</p><h2>{monthLabel(period.year, period.month)}</h2></div><b className="positive">{money(data.total)}</b></div>
      {data.transactions.length ? <div className="income-entry-list">{data.transactions.map(transaction => <article key={transaction._id}>
        <span className="income-history-icon"><ArrowDownToLine /></span><span><b>{transaction.incomeSource || 'Other income'}</b><small>{transaction.note} · {new Date(transaction.date).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}</small></span><strong>{money(transaction.amount)}</strong><button className="bare danger" onClick={() => confirm('Remove this income entry?') && removeEntry.mutate(transaction._id)} aria-label="Remove income"><Trash2 /></button>
      </article>)}</div> : <Empty title="No income received yet" text="Add salary, business or another income using the form above." />}
    </Card>
  </div>;
}
