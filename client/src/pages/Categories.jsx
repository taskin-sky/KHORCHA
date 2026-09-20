import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleDollarSign, Pencil, PiggyBank, Plus, Tags, Trash2, WalletCards, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Card, ErrorState, PageHead, Spinner } from '../components/UI';

export default function Categories() {
  const [name, setName] = useState(''), [type, setType] = useState('expense');
  const [editingId, setEditingId] = useState(null), [editingName, setEditingName] = useState('');
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['sheet'] });
    queryClient.invalidateQueries({ queryKey: ['plan'] });
  };
  const add = useMutation({
    mutationFn: () => api.post('/categories', { name: name.trim(), slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, type, color: type === 'expense' ? '#5177ff' : '#10b981', icon: 'WalletCards' }),
    onSuccess: response => { setName(''); toast.success(response.message); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Category could not be added'),
  });
  const edit = useMutation({
    mutationFn: () => api.patch(`/categories/${editingId}`, { name: editingName.trim() }),
    onSuccess: response => { setEditingId(null); setEditingName(''); toast.success(response.message); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Category name could not be updated'),
  });
  const remove = useMutation({
    mutationFn: id => api.delete(`/categories/${id}`),
    onSuccess: response => { toast.success(response.message); refresh(); },
    onError: error => toast.error(error.response?.data?.message || 'Category could not be removed'),
  });
  const beginEdit = category => { setEditingId(category._id); setEditingName(category.name); };
  const cancelEdit = () => { setEditingId(null); setEditingName(''); };

  if (categories.isLoading) return <Spinner />;
  if (categories.error) return <ErrorState message={categories.error.response?.data?.message} retry={categories.refetch} />;

  const items = categories.data.data;
  const counts = {
    expense: items.filter(category => category.type === 'expense' && category.isActive).length,
    income: items.filter(category => category.type === 'income' && category.isActive).length,
    saving: items.filter(category => category.type === 'saving' && category.isActive).length,
  };
  const visibleItems = filter === 'all' ? items : items.filter(category => category.type === filter);

  return <div className="page categories-page">
    <PageHead eyebrow="ORGANIZE YOUR MONEY" title="Categories" />
    <section className="category-overview">
      <Card><span className="category-stat-icon all"><Tags /></span><div><small>All categories</small><strong>{items.filter(category => category.isActive).length}</strong></div></Card>
      <Card><span className="category-stat-icon expense"><WalletCards /></span><div><small>Expenses</small><strong>{counts.expense}</strong></div></Card>
      <Card><span className="category-stat-icon income"><CircleDollarSign /></span><div><small>Income</small><strong>{counts.income}</strong></div></Card>
      <Card><span className="category-stat-icon saving"><PiggyBank /></span><div><small>Savings</small><strong>{counts.saving}</strong></div></Card>
    </section>
    <Card className="category-create-card">
      <div className="category-section-head"><div><span className="category-add-icon"><Plus /></span><span><b>Create category</b><small>Add a new place for your money.</small></span></div></div>
      <form className="category-create-form" onSubmit={event => { event.preventDefault(); if (name.trim()) add.mutate(); }}>
        <label><span>Category name</span><input value={name} onChange={event => setName(event.target.value)} placeholder="For example: Groceries" autoComplete="off" /></label>
        <label><span>Money type</span><select value={type} onChange={event => setType(event.target.value)}><option value="expense">Expense</option><option value="income">Income</option><option value="saving">Saving</option></select></label>
        <button className="btn primary" disabled={!name.trim() || add.isPending}><Plus />{add.isPending ? 'Adding…' : 'Add category'}</button>
      </form>
    </Card>
    <Card className="category-library">
      <div className="category-library-head"><div><p className="eyebrow">YOUR COLLECTION</p><h2>Manage categories</h2></div><div className="category-tabs">{['all', 'expense', 'income', 'saving'].map(item => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="category-grid">{visibleItems.map((category, index) => <article key={category._id} className={`category-tile ${!category.isActive ? 'inactive' : ''}`} style={{ '--category-color': category.color, '--category-delay': `${Math.min(index, 12) * 35}ms` }}>
        <span className="category-color"><i /></span>
        {editingId === category._id ? <form className="category-edit" onSubmit={event => { event.preventDefault(); if (editingName.trim()) edit.mutate(); }}>
          <input autoFocus value={editingName} onChange={event => setEditingName(event.target.value)} aria-label="Category name" />
          <button className="bare positive" disabled={!editingName.trim() || edit.isPending} aria-label="Save name"><Check /></button>
          <button className="bare" type="button" onClick={cancelEdit} aria-label="Cancel"><X /></button>
        </form> : <>
          <span className="category-tile-name"><b>{category.name}</b><small className={`category-type ${category.type}`}>{['family', 'trip', 'saving', 'income'].includes(category.purpose) ? `${category.purpose} module` : category.type}{!category.isActive ? ' · inactive' : ''}</small></span>
          {!['family', 'trip', 'saving', 'income'].includes(category.purpose) && <div className="category-actions">
            <button className="bare" onClick={() => beginEdit(category)} aria-label={`Edit ${category.name}`}><Pencil /></button>
            <button className="bare danger" onClick={() => confirm(`Remove ${category.name}?`) && remove.mutate(category._id)} aria-label={`Remove ${category.name}`}><Trash2 /></button>
          </div>}
        </>}
      </article>)}</div>
      {!visibleItems.length && <div className="category-empty"><Tags /><b>No {filter === 'all' ? '' : filter} categories yet</b><small>Create one using the form above.</small></div>}
    </Card>
  </div>;
}
