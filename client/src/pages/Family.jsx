import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, HeartHandshake, Plus, Trash2, UserRound, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Empty, ErrorState, PageHead, Progress, Spinner } from '../components/UI';
import { api } from '../services/api';
import { money, monthLabel, shiftMonth } from '../utils/finance';

const now = new Date();
const dateFor = (year, month, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function Family() {
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [form, setForm] = useState({ memberId: '', amount: '', date: now.toISOString().slice(0, 10), note: '' });
  const queryClient = useQueryClient();
  const family = useQuery({ queryKey: ['family', period.year, period.month], queryFn: () => api.get('/family', { params: period }) });
  const data = family.data?.data;

  useEffect(() => {
    if (data?.members?.length && !form.memberId) setForm(current => ({ ...current, memberId: data.members[0]._id }));
  }, [data?.members, form.memberId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['family', period.year, period.month] });
    queryClient.invalidateQueries({ queryKey: ['sheet', period.year, period.month] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const addPayment = useMutation({
    mutationFn: () => api.post('/family/payments', { ...form, amount: Number(form.amount) }),
    onSuccess: response => { toast.success(response.message); setForm(current => ({ ...current, amount: '', note: '' })); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Family payment could not be added'),
  });
  const removePayment = useMutation({
    mutationFn: id => api.delete(`/family/payments/${id}`),
    onSuccess: response => { toast.success(response.message); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Family payment could not be removed'),
  });
  const setMonth = next => { setPeriod(next); setForm(current => ({ ...current, date: dateFor(next.year, next.month), amount: '', note: '' })); };
  const move = offset => setMonth(shiftMonth(period.year, period.month, offset));
  const chooseMonth = event => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) setMonth({ year, month }); };

  if (family.isLoading) return <Spinner />;
  if (family.error) return <ErrorState message={family.error.response?.data?.message} retry={family.refetch} />;

  const periodControls = <div className="period-controls"><button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><ArrowLeft /></button><label className="month-picker"><CalendarDays /><input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={chooseMonth} /></label><button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><ArrowRight /></button></div>;
  const usage = data.budget ? data.total / data.budget * 100 : 0;

  return <div className="page family-page">
    <PageHead eyebrow="FAMILY LEDGER" title="Family" action={periodControls} />
    <Card className="family-hero">
      <div className="family-hero-title"><span><UsersRound /></span><div><h2>Family support</h2><p>Track every payment for Babamony, Ammu, Tanjim and Niha.</p></div></div>
      <div className="family-summary"><span><small>Monthly limit</small><b>{money(data.budget)}</b></span><span><small>Given this month</small><b>{money(data.total)}</b></span><span><small>{data.remaining < 0 ? 'Over budget' : 'Remaining'}</small><b className={data.remaining < 0 ? 'danger' : 'positive'}>{money(Math.abs(data.remaining))}</b></span><span><small>Members</small><b>{data.members.length}</b></span></div>
      <Progress value={usage} tone={data.remaining < 0 ? 'red' : ''} />
    </Card>

    <Card className="family-payment-card">
      <div className="card-title"><div><p className="eyebrow">NEW PAYMENT</p><h2>Who did you give money to?</h2></div><HeartHandshake /></div>
      <form className="family-payment-form" onSubmit={event => { event.preventDefault(); if (form.memberId && form.amount) addPayment.mutate(); }}>
        <label>Family member<select required value={form.memberId} onChange={event => setForm(current => ({ ...current, memberId: event.target.value }))}>{data.members.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label>
        <label>Amount<input required type="number" inputMode="numeric" min="1" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="৳ 0" /></label>
        <label>Date<input required type="date" min={dateFor(period.year, period.month)} max={dateFor(period.year, period.month, new Date(period.year, period.month, 0).getDate())} value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label>
        <label>Note <small>(optional)</small><input value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="What was it for?" /></label>
        <button className="btn primary" disabled={!form.memberId || !form.amount || addPayment.isPending}><Plus /> {addPayment.isPending ? 'Adding…' : 'Add payment'}</button>
      </form>
    </Card>

    <section className="family-members">
      {data.members.map((member, index) => <Card className="family-member-card" key={member._id} style={{ '--member-color': member.color, '--member-delay': `${index * 55}ms` }}>
        <div><span className="family-avatar"><UserRound /></span><span><b>{member.name}</b><small>{monthLabel(period.year, period.month)}</small></span></div>
        <strong>{money(member.total)}</strong><small>received this month</small>
        <button className="bare" onClick={() => { setForm(current => ({ ...current, memberId: member._id })); document.querySelector('.family-payment-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Add payment</button>
      </Card>)}
    </section>

    <Card className="family-history">
      <div className="card-title"><div><p className="eyebrow">PAYMENT HISTORY</p><h2>{monthLabel(period.year, period.month)}</h2></div><b>{money(data.total)}</b></div>
      {data.transactions.length ? <div className="family-payment-list">{data.transactions.map(transaction => <article key={transaction._id}>
        <span className="family-history-avatar" style={{ '--member-color': transaction.familyMemberId?.color }}><UserRound /></span>
        <span><b>{transaction.familyMemberId?.name}</b><small>{transaction.note} · {new Date(transaction.date).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}</small></span>
        <strong>{money(transaction.amount)}</strong>
        <button className="bare danger" onClick={() => confirm('Remove this family payment?') && removePayment.mutate(transaction._id)} aria-label="Remove payment"><Trash2 /></button>
      </article>)}</div> : <Empty title="No family payments yet" text="Add the first payment using the form above." />}
    </Card>
  </div>;
}
