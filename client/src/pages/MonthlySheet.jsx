import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { money, monthLabel, shiftMonth } from '../utils/finance';
import { Card, ErrorState, Spinner } from '../components/UI';

const now = new Date();
const amountOnly = value => Number(value || 0).toLocaleString('en-BD');

function SheetCell({ value, onSave, disabled }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);
  const commit = () => {
    const amount = draft === '' ? 0 : Number(draft);
    if (Number.isInteger(amount) && amount >= 0 && amount !== value) onSave(amount);
    else if (!Number.isInteger(amount) || amount < 0) setDraft(value || '');
  };
  return <input className="sheet-cell" type="number" inputMode="numeric" min="0" value={draft} disabled={disabled} aria-label="Amount" onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="—" />;
}

function rowCellPayload(row, day, amount) {
  return {
    categoryId: row.categoryId || row._id,
    tripId: row.tripId || null,
    tripUnassigned: Boolean(row.tripUnassigned),
    day,
    amount,
  };
}

export default function MonthlySheet() {
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const dateStripRef = useRef(null);
  const queryClient = useQueryClient();
  const sheet = useQuery({ queryKey: ['sheet', period.year, period.month], queryFn: () => api.get(`/sheet/${period.year}/${period.month}`) });
  const save = useMutation({
    mutationFn: cell => api.put('/sheet/cell/value', { ...cell, ...period }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sheet', period.year, period.month] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: error => { toast.error(error.response?.data?.message || 'Cell could not be saved'); queryClient.invalidateQueries({ queryKey: ['sheet', period.year, period.month] }); },
  });
  const move = offset => setPeriod(current => shiftMonth(current.year, current.month, offset));
  const chooseMonth = event => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) setPeriod({ year, month }); };
  const data = sheet.data?.data;
  useEffect(() => {
    const currentMonth = period.year === now.getFullYear() && period.month === now.getMonth() + 1;
    setSelectedDay(currentMonth ? Math.min(now.getDate(), new Date(period.year, period.month, 0).getDate()) : 1);
  }, [period.year, period.month]);
  useEffect(() => {
    dateStripRef.current?.querySelector('.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedDay]);
  const dailyExpenses = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.daysInMonth }, (_, index) => data.rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + Number(row.days[index + 1] || 0), 0));
  }, [data]);

  if (sheet.isLoading) return <Spinner />;
  if (sheet.error) return <ErrorState message={sheet.error.response?.data?.message} retry={sheet.refetch} />;

  const selectedDate = new Date(period.year, period.month - 1, selectedDay);
  const selectedDayExpense = data.rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + Number(row.days[selectedDay] || 0), 0);

  return <div className="sheet-page-wrap">
    <header className="sheet-header">
      <div><p className="eyebrow">MONTHLY MONEY SHEET</p><h1>{monthLabel(period.year, period.month)}</h1><p className="muted">Category row, date column—amount লিখে Enter চাপুন।</p></div>
      <div className="sheet-head-actions">
        <div className="period-controls">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><ArrowLeft /></button>
          <label className="month-picker"><CalendarDays /><input type="month" value={`${period.year}-${String(period.month).padStart(2, '0')}`} onChange={chooseMonth} /></label>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><ArrowRight /></button>
        </div>
      </div>
    </header>
    <section className="sheet-summary">
      <Card><small>Income</small><strong className="income">{money(data.summary.income)}</strong></Card>
      <Card><small>Expense</small><strong className="expense">{money(data.summary.expense)}</strong></Card>
      <Card><small>Saving</small><strong className="saving">{money(data.summary.saving)}</strong></Card>
      <Card><small>Available</small><strong>{money(data.summary.available)}</strong></Card>
    </section>
    <div className="sheet-help"><span><i className="income-dot" /> Income</span><span><i className="expense-dot" /> Expense</span><span><i className="saving-dot" /> Saving</span><span><RefreshCw /> Cell থেকে বের হলেই auto-save</span></div>
    <div className="money-sheet-shell desktop-sheet">
      <table className="money-sheet">
        <thead><tr><th className="category-column">Category</th>{Array.from({ length: data.daysInMonth }, (_, index) => <th key={index + 1}><b>{index + 1}</b><small>{new Date(period.year, period.month - 1, index + 1).toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}</small></th>)}<th className="total-column">Total</th></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row._id} className={`sheet-row ${row.type} ${row.rowType || ''}`}>
          <th className="category-column"><i style={{ background: row.color }} /><span>{row.name}<small>{row.rowType === 'trip' ? `${row.subtitle} · trip` : row.purpose === 'family' ? 'manage in Family' : row.purpose === 'income' ? 'manage in Income' : row.type}</small></span></th>
          {Array.from({ length: data.daysInMonth }, (_, index) => <td key={index + 1}><SheetCell value={Number(row.days[index + 1] || 0)} disabled={save.isPending || row.readOnly} onSave={amount => save.mutate(rowCellPayload(row, index + 1, amount))} /></td>)}
          <td className="total-column"><b>{money(Object.values(row.days).reduce((sum, amount) => sum + Number(amount), 0))}</b></td>
        </tr>)}</tbody>
        <tfoot><tr><th className="category-column">Daily expense</th>{dailyExpenses.map((amount, index) => <td key={index}><b>{amount ? amount.toLocaleString('en-BD') : '—'}</b></td>)}<td className="total-column"><b>{money(data.summary.expense)}</b></td></tr></tfoot>
      </table>
    </div>
    <section className="mobile-sheet">
      <div className="mobile-day-nav">
        <button className="icon-btn" disabled={selectedDay === 1} onClick={() => setSelectedDay(day => day - 1)} aria-label="Previous date"><ArrowLeft /></button>
        <div><small>SELECTED DATE</small><strong>{selectedDate.toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>
        <button className="icon-btn" disabled={selectedDay === data.daysInMonth} onClick={() => setSelectedDay(day => day + 1)} aria-label="Next date"><ArrowRight /></button>
      </div>
      <div className="mobile-date-strip" ref={dateStripRef} aria-label="Choose date">
        {Array.from({ length: data.daysInMonth }, (_, index) => {
          const day = index + 1, date = new Date(period.year, period.month - 1, day);
          return <button key={day} className={selectedDay === day ? 'active' : ''} onClick={() => setSelectedDay(day)}><small>{date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}</small><b>{day}</b></button>;
        })}
      </div>
      <div className="mobile-day-total"><span>Expense on this day</span><strong>{money(selectedDayExpense)}</strong></div>
      <div className="mobile-category-list">
        {data.rows.map(row => {
          const monthlyTotal = Object.values(row.days).reduce((sum, amount) => sum + Number(amount), 0);
          const budget = Number(row.budget || 0);
          const remaining = budget - monthlyTotal;
          return <article key={row._id} className={`mobile-category-row ${row.type} ${row.type === 'expense' ? 'with-budget' : ''} ${row.rowType || ''}`}>
            <div className="mobile-category-name"><i style={{ background: row.color }} /><span><b>{row.name}</b><small>{row.rowType === 'trip' ? `${row.subtitle} · trip` : row.purpose === 'family' ? 'Family total' : row.purpose === 'income' ? 'Income total' : row.type} · Month {money(monthlyTotal)}</small></span></div>
            <div className="mobile-amount"><span>৳</span><SheetCell value={Number(row.days[selectedDay] || 0)} disabled={save.isPending || row.readOnly} onSave={amount => save.mutate(rowCellPayload(row, selectedDay, amount))} /></div>
            {row.type === 'expense' && <div className="mobile-budget-stack" aria-label={`Budget ${amountOnly(budget)}, remaining ${amountOnly(remaining)}`}>
              <span><small>LIMIT</small><b>{amountOnly(budget)}</b></span>
              <span className={remaining < 0 ? 'over' : ''}><small>LEFT</small><b>{amountOnly(remaining)}</b></span>
            </div>}
          </article>;
        })}
      </div>
    </section>
    <p className="sheet-footnote">কোনো cell পরিবর্তন করলে ওই category ও date-এর নতুন total সরাসরি save হবে। খালি করলে amount মুছে যাবে।</p>
  </div>;
}
