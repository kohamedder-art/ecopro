import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  DollarSign, Receipt, Plus, Pencil, Trash2, CheckCircle2, Clock,
  AlertCircle, BarChart3, X, Search
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  'webserver', 'database', 'ai', 'cdn', 'email', 'domain', 'other'
];

const CATEGORY_LABELS: Record<string, string> = {
  webserver: 'Web Server',
  database: 'Database',
  ai: 'AI / DeepInfra',
  cdn: 'CDN / Cloudinary',
  email: 'Email',
  domain: 'Domain',
  other: 'Other',
};

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

interface Bill {
  id: number;
  name: string;
  category: string;
  amount: string;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface BillForm {
  name: string;
  category: string;
  amount: string;
  currency: string;
  due_date: string;
  paid_at: string;
  notes: string;
}

const emptyForm = (): BillForm => ({
  name: '',
  category: 'other',
  amount: '',
  currency: 'USD',
  due_date: '',
  paid_at: '',
  notes: '',
});

export default function BillsTab() {
  const { t } = useTranslation();
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [billsRes, summaryRes] = await Promise.all([
        fetch('/api/admin/bills'),
        fetch('/api/admin/bills/summary'),
      ]);
      if (billsRes.ok) setBills(await billsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch (e) {
      console.error('Failed to load bills data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openNewForm = () => {
    setEditId(null);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const defaultDue = nextMonth.toISOString().split('T')[0];
    setForm({ ...emptyForm(), due_date: defaultDue });
    setShowForm(true);
  };

  const openEditForm = (bill: Bill) => {
    setEditId(bill.id);
    setForm({
      name: bill.name,
      category: bill.category,
      amount: bill.amount,
      currency: bill.currency,
      due_date: bill.due_date ? bill.due_date.split('T')[0] : '',
      paid_at: bill.paid_at ? bill.paid_at.split('T')[0] : '',
      notes: bill.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        due_date: form.due_date || null,
        paid_at: form.paid_at || null,
        notes: form.notes || null,
      };
      const url = editId ? `/api/admin/bills/${editId}` : '/api/admin/bills';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        loadData();
      }
    } catch (e) {
      console.error('Failed to save bill', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('platformAdmin.bills.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin/bills/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) loadData();
    } catch (e) {
      console.error('Failed to delete bill', e);
    }
  };

  const handleTogglePaid = async (bill: Bill) => {
    const newPaidAt = bill.paid_at ? null : new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/admin/bills/${bill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paid_at: newPaidAt }),
    });
    if (res.ok) loadData();
  };

  const filteredBills = useMemo(() => {
    let list = bills;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      list = list.filter(b => b.category === categoryFilter);
    }
    return list;
  }, [bills, search, categoryFilter]);

  const categoryData = useMemo(() => {
    if (!summary?.byCategory) return [];
    return summary.byCategory.map((c: any, i: number) => ({
      name: CATEGORY_LABELS[c.category] || c.category,
      value: parseFloat(c.total),
      color: COLORS[i % COLORS.length],
    }));
  }, [summary]);

  const monthlyData = useMemo(() => {
    if (!summary?.byMonth) return [];
    return [...summary.byMonth].reverse().map((m: any) => ({
      month: m.month,
      total: parseFloat(m.total),
    }));
  }, [summary]);

  const totalUnpaid = summary?.unpaid ? parseFloat(summary.unpaid.total) : 0;
  const totalPaid = summary?.paid ? parseFloat(summary.paid.total) : 0;
  const upcomingTotal = summary?.upcoming ? parseFloat(summary.upcoming.total) : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('platformAdmin.bills.total'), value: `${parseFloat(summary?.all?.total || 0).toLocaleString()} ${summary?.all?.count || 0}`, icon: Receipt, gradient: 'from-blue-500/15 to-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400', iconColor: 'text-blue-500/40' },
          { label: t('platformAdmin.bills.paid'), value: `${totalPaid.toLocaleString()}`, icon: CheckCircle2, gradient: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', iconColor: 'text-emerald-500/40' },
          { label: t('platformAdmin.bills.unpaid'), value: `${totalUnpaid.toLocaleString()}`, icon: AlertCircle, gradient: 'from-orange-500/15 to-orange-500/5', border: 'border-orange-500/30', text: 'text-orange-400', iconColor: 'text-orange-500/40' },
          { label: t('platformAdmin.bills.upcoming30'), value: `${upcomingTotal.toLocaleString()}`, icon: Clock, gradient: 'from-purple-500/15 to-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400', iconColor: 'text-purple-500/40' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpi.gradient} backdrop-blur-xl rounded-2xl border ${kpi.border} p-4 shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.text}`}>{kpi.value}</p>
              </div>
              <kpi.icon className={`w-7 h-7 ${kpi.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Pie */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            {t('platformAdmin.bills.byCategory')}
          </h3>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 text-xs">
                {categoryData.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                    <span className="text-gray-600 dark:text-slate-300">{c.name}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{Math.round(c.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('platformAdmin.bills.noData')}</p>
          )}
        </div>

        {/* Monthly Bar */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            {t('platformAdmin.bills.monthly')}
          </h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value: any) => Math.round(value).toLocaleString()}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('platformAdmin.bills.noData')}</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openNewForm} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-8 px-3">
          <Plus className="w-3.5 h-3.5 ml-1" /> {t('platformAdmin.bills.addBill')}
        </Button>
        <div className="flex-1 min-w-[150px] max-w-xs relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={t('platformAdmin.bills.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 ps-3 pe-8 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-8 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 outline-none"
        >
          <option value="all">{t('platformAdmin.bills.allCategories')}</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {/* Bills Table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-500">{t('common.loading')}</div>
      ) : (
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 overflow-hidden shadow-lg">
          {filteredBills.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">{t('platformAdmin.bills.noBills')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.name')}</th>
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.category')}</th>
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.amount')}</th>
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.dueDate')}</th>
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.status')}</th>
                    <th className="text-start p-3 font-medium">{t('platformAdmin.bills.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="p-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                        {bill.name}
                        {bill.notes && <p className="text-[10px] text-gray-400 mt-0.5 max-w-[200px] truncate">{bill.notes}</p>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {CATEGORY_LABELS[bill.category] || bill.category}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {parseFloat(bill.amount).toLocaleString()} {bill.currency}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-slate-400 whitespace-nowrap text-xs">
                        {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePaid(bill)}
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                            bill.paid_at
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {bill.paid_at ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {bill.paid_at ? t('platformAdmin.bills.paidLabel') : t('platformAdmin.bills.unpaidLabel')}
                        </button>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditForm(bill)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(bill.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editId ? t('platformAdmin.bills.editBill') : t('platformAdmin.bills.addBill')}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.name')}</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-9 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.category')}</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-9 px-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none">
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.amount')}</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="flex-1 h-9 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none" />
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-16 h-9 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="DZD">DZD</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.dueDate')}</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.paidDate')}</label>
                  <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t('platformAdmin.bills.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none resize-none" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-9 text-xs rounded-xl">{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 h-9 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
