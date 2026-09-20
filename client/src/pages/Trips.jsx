import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, MapPin, Plus, Trash2, Train, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api';
import { money, monthLabel, shiftMonth } from '../utils/finance';
import { Card, Empty, ErrorState, PageHead, Progress, Spinner } from '../components/UI';

const now = new Date();

export default function Trips() {
  const { id } = useParams(), navigate = useNavigate(), queryClient = useQueryClient();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', destination: '', budget: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
  const [expense, setExpense] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const trips = useQuery({ queryKey: ['trips', period.year, period.month], queryFn: () => api.get('/trips', { params: period }), enabled: !id });
  const options = useQuery({ queryKey: ['trip-budget-options', period.year, period.month], queryFn: () => api.get('/trips/budget-options', { params: period }), enabled: !id });
  const detail = useQuery({ queryKey: ['trip', id], queryFn: () => api.get(`/trips/${id}/summary`), enabled: Boolean(id) });
  const refreshList = () => { queryClient.invalidateQueries({ queryKey: ['trips', period.year, period.month] }); queryClient.invalidateQueries({ queryKey: ['trip-budget-options', period.year, period.month] }); };
  const create = useMutation({
    mutationFn: () => api.post('/trips', { ...form, budget: Number(form.budget), endDate: form.endDate || form.startDate }),
    onSuccess: response => { toast.success(response.message); setShowForm(false); setForm({ title: '', destination: '', budget: '', startDate: `${period.year}-${String(period.month).padStart(2, '0')}-01`, endDate: '', notes: '' }); refreshList(); },
    onError: error => toast.error(error.response?.data?.message || 'Trip could not be created'),
  });
  const remove = useMutation({ mutationFn: tripId => api.delete(`/trips/${tripId}`), onSuccess: response => { toast.success(response.message); refreshList(); }, onError: error => toast.error(error.response?.data?.message || 'Trip could not be deleted') });
  const addExpense = useMutation({
    mutationFn: () => api.post('/transactions', { type: 'expense', amount: Number(expense.amount), categoryId: detail.data.data.trip.categoryId._id, tripId: id, date: expense.date, note: expense.note || detail.data.data.trip.title, paymentMethod: 'cash' }),
    onSuccess: () => { toast.success('Trip expense added'); setExpense(value => ({ ...value, amount: '', note: '' })); queryClient.invalidateQueries({ queryKey: ['trip', id] }); queryClient.invalidateQueries({ queryKey: ['sheet'] }); },
    onError: error => toast.error(error.response?.data?.message || 'Expense could not be added'),
  });
  const deleteExpense = useMutation({ mutationFn: transactionId => api.delete(`/transactions/${transactionId}`), onSuccess: () => { toast.success('Trip expense removed'); queryClient.invalidateQueries({ queryKey: ['trip', id] }); queryClient.invalidateQueries({ queryKey: ['sheet'] }); } });
  const setTripPeriod = next => { setPeriod(next); setForm(current => ({ ...current, startDate: `${next.year}-${String(next.month).padStart(2, '0')}-01`, endDate: '' })); };
  const move = offset => setTripPeriod(shiftMonth(period.year, period.month, offset));
  const chooseMonth = event => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) setTripPeriod({ year, month }); };
  const updateForm = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  if (id) {
    if (detail.isLoading) return <Spinner />;
    if (detail.error) return <ErrorState message={detail.error.response?.data?.message} retry={detail.refetch} />;
    const data = detail.data.data, trip = data.trip;
    return <div className="page">
      <button className="bare back" onClick={() => navigate('/trips')}><ArrowLeft /> All trips</button>
      <PageHead eyebrow={trip.categoryId?.name || 'TRIP BUDGET'} title={trip.title} />
      <section className="plan-summary"><Card><small>Budget</small><strong>{money(trip.budget)}</strong></Card><Card><small>Spent</small><strong>{money(data.actual)}</strong></Card><Card><small>Remaining</small><strong className={data.remaining < 0 ? 'danger' : 'positive'}>{money(data.remaining)}</strong><Progress value={data.usage || 0} tone={data.remaining < 0 ? 'red' : ''} /></Card></section>
      {trip.categoryId && <Card className="trip-expense-entry"><h2>Add expense to this trip</h2><form onSubmit={event => { event.preventDefault(); if (expense.amount) addExpense.mutate(); }}><input type="number" min="1" inputMode="numeric" value={expense.amount} onChange={event => setExpense(current => ({ ...current, amount: event.target.value }))} placeholder="Amount (BDT)" /><input type="date" value={expense.date} onChange={event => setExpense(current => ({ ...current, date: event.target.value }))} /><input value={expense.note} onChange={event => setExpense(current => ({ ...current, note: event.target.value }))} placeholder="Note (optional)" /><button className="btn primary" disabled={addExpense.isPending}><Plus /> Add</button></form></Card>}
      <Card><h2>Trip expenses</h2>{data.transactions.length ? data.transactions.map(transaction => <div className="row" key={transaction._id}><span>{transaction.note || transaction.categoryId?.name}<small>{new Date(transaction.date).toLocaleDateString()}</small></span><b>{money(transaction.amount)}</b><button className="bare danger" onClick={() => confirm('Remove this expense?') && deleteExpense.mutate(transaction._id)}><Trash2 /></button></div>) : <Empty title="No expenses yet" text="Add this trip’s first expense above." />}</Card>
    </div>;
  }

  if (trips.isLoading || options.isLoading) return <Spinner />;
  if (trips.error || options.error) return <ErrorState message={(trips.error || options.error)?.response?.data?.message} retry={() => { trips.refetch(); options.refetch(); }} />;
  const pool = options.data.data;
  const hasTripBudget = Boolean(pool.category && pool.allocated > 0);
  const periodControls = <div className="period-controls"><button className="icon-btn" onClick={() => move(-1)}><ArrowLeft /></button><label className="month-picker"><CalendarDays /><input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={chooseMonth} /></label><button className="icon-btn" onClick={() => move(1)}><ArrowRight /></button></div>;

  return <div className="page trips-page">
    <PageHead eyebrow="TRAVEL WALLET" title="Trips" action={periodControls} />
    {hasTripBudget && <Card className="trip-budget-overview">
      <div className="trip-budget-title"><span className="trip-hero-icon"><Train /></span><div><p className="eyebrow">MONTHLY TRIP FUND</p><h2>{pool.category.name}</h2><small>Split this budget between as many trips as you need.</small></div><button className={`btn ${showForm ? 'secondary' : 'primary'}`} onClick={() => setShowForm(value => !value)}>{showForm ? <X /> : <Plus />}{showForm ? 'Close form' : 'Add trip'}</button></div>
      <div className="trip-budget-metrics"><span><small>Monthly limit</small><b>{money(pool.allocated)}</b></span><span><small>Allocated to trips</small><b>{money(pool.reserved)}</b></span><span><small>Available</small><b className={pool.remaining ? 'positive' : ''}>{money(pool.remaining)}</b></span><span><small>Trips this month</small><b>{trips.data.data.length}</b></span></div>
      <div className="trip-budget-progress"><div><span>Budget allocated</span><b>{pool.allocated ? Math.round(pool.reserved / pool.allocated * 100) : 0}%</b></div><Progress value={pool.allocated ? pool.reserved / pool.allocated * 100 : 0} /></div>
    </Card>}
    {showForm && <Card className="trip-create-card"><div className="card-title"><div><p className="eyebrow">NEW TRIP</p><h2>Plan your next trip</h2><p className="muted">Available from the monthly trip fund: {money(pool.remaining)}</p></div></div><form className="form-grid" onSubmit={event => { event.preventDefault(); create.mutate(); }}><label>Trip name<input required name="title" value={form.title} onChange={updateForm} placeholder="Example: Sylhet weekend" /></label><label>Destination<input name="destination" value={form.destination} onChange={updateForm} placeholder="Sylhet" /></label><label>Trip budget<input required type="number" min="1" max={pool.remaining || undefined} name="budget" value={form.budget} onChange={updateForm} placeholder={`Maximum ${pool.remaining}`} /></label><label>Start date<input required type="date" name="startDate" value={form.startDate} onChange={updateForm} /></label><label>End date<input type="date" name="endDate" value={form.endDate} onChange={updateForm} /></label><label className="full">Notes<textarea name="notes" value={form.notes} onChange={updateForm} placeholder="Anything useful to remember" /></label><button className="btn primary full" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create trip'}</button></form></Card>}
    {!hasTripBudget && <Card className="trip-budget-empty"><h2>Trip budget is not ready</h2><p className="muted">Create or keep one expense category with “Trip” in its name, then allocate its budget in the {monthLabel(period.year, period.month)} Plan.</p><Link className="btn primary" to="/plans">Open Plan</Link></Card>}
    {hasTripBudget && <div className="trip-section-head"><div><p className="eyebrow">ITINERARY</p><h2>Your trips</h2></div><small>{trips.data.data.length} {trips.data.data.length === 1 ? 'trip' : 'trips'} in {monthLabel(period.year, period.month)}</small></div>}
    <div className="trip-grid">{trips.data.data.length ? trips.data.data.map((trip, index) => <Card className="trip-card" key={trip._id} style={{ '--trip-delay': `${Math.min(index, 9) * 55}ms` }}>
      {trip.actual === 0 && <button className="bare danger trip-delete" onClick={() => confirm(`Delete ${trip.title}?`) && remove.mutate(trip._id)} aria-label={`Delete ${trip.title}`}><Trash2 /></button>}
      <Link className="trip-card-link" to={`/trips/${trip._id}`}>
        <div className="trip-card-top"><span className="trip-icon"><Train /></span><span className={`trip-status ${trip.actual > trip.budget ? 'over' : trip.actual ? 'active' : ''}`}>{trip.actual > trip.budget ? 'Over budget' : trip.actual ? 'In progress' : 'Planned'}</span></div>
        <p className="eyebrow">TRIP {trip.tripNumber}</p><h2>{trip.title}</h2><p className="trip-meta"><MapPin /> {trip.destination || 'Destination not set'}<span>•</span><CalendarDays /> {new Date(trip.startDate).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}</p>
        <div className="trip-card-numbers"><span><small>Budget</small><b>{money(trip.budget)}</b></span><span><small>Spent</small><b>{money(trip.actual)}</b></span><span><small>Left</small><b className={trip.remaining < 0 ? 'danger' : 'positive'}>{money(trip.remaining)}</b></span></div>
        <Progress value={trip.budget ? trip.actual / trip.budget * 100 : 0} tone={trip.actual > trip.budget ? 'red' : ''} />
        <span className="trip-open">View trip details <ArrowUpRight /></span>
      </Link>
    </Card>) : <Card className="trip-empty"><Empty title="No trips this month" text="Create as many trips as needed within your allocated category budget." />{hasTripBudget && <button className="btn primary" onClick={() => setShowForm(true)}><Plus /> Create first trip</button>}</Card>}</div>
  </div>;
}
