import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Megaphone, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, Target, Loader, X } from 'lucide-react';

interface SpendEntry {
  id: number;
  entry_date: string;
  platform: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  notes: string | null;
}

const inputCls = "w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";
const selectCls = "w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'other', label: 'أخرى' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('ar-DZ');

export default function AdsPage() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    platform: 'facebook',
    campaignName: '',
    spend: '',
    impressions: '',
    clicks: '',
    notes: '',
  });

  const { data: inputs, isLoading } = useQuery<any>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<any>('/api/pixels/omni/inputs'),
  });

  const addMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/creative-spend', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      toast({ title: 'تمت الإضافة' });
      setShowForm(false);
      setForm({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
    },
    onError: () => toast({ title: 'خطأ', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/pixels/omni/creative-spend/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['omni-inputs'] }),
  });

  const entries: SpendEntry[] = inputs?.spendEntries || [];

  // Group by campaign
  const campaigns = entries.reduce((acc: Record<string, { spend: number; impressions: number; clicks: number; entries: SpendEntry[] }>, e) => {
    const key = e.campaign_name || 'بدون حملة';
    if (!acc[key]) acc[key] = { spend: 0, impressions: 0, clicks: 0, entries: [] };
    acc[key].spend += e.spend || 0;
    acc[key].impressions += e.impressions || 0;
    acc[key].clicks += e.clicks || 0;
    acc[key].entries.push(e);
    return acc;
  }, {});

  const totalSpend = entries.reduce((s, e) => s + (e.spend || 0), 0);
  const totalImpressions = entries.reduce((s, e) => s + (e.impressions || 0), 0);
  const totalClicks = entries.reduce((s, e) => s + (e.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0';

  const handleAdd = () => {
    if (!form.spend || parseFloat(form.spend) <= 0) {
      toast({ title: 'أدخل مبلغ الإنفاق', variant: 'destructive' });
      return;
    }
    addMutation.mutate({
      entryDate: form.entryDate,
      platform: form.platform,
      campaignName: form.campaignName || undefined,
      spend: parseFloat(form.spend) || 0,
      impressions: parseInt(form.impressions) || undefined,
      clicks: parseInt(form.clicks) || undefined,
      notes: form.notes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-foreground">إعلاناتي</h1>
          <p className="text-xs text-muted-foreground mt-0.5">تتبع إنفاق الإعلانات وأداء الحملات</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'إلغاء' : 'إضافة إنفاق'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground">إضافة إنفاق إعلاني</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">التاريخ</label>
              <input type="date" className={inputCls} value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المنصة</label>
              <select className={selectCls} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم الحملة</label>
              <input className={inputCls} placeholder="اختياري" value={form.campaignName} onChange={e => setForm(f => ({ ...f, campaignName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المبلغ (دج)</label>
              <input className={inputCls} type="number" placeholder="0" value={form.spend} onChange={e => setForm(f => ({ ...f, spend: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المشاهدات</label>
              <input className={inputCls} type="number" placeholder="اختياري" value={form.impressions} onChange={e => setForm(f => ({ ...f, impressions: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">النقرات</label>
              <input className={inputCls} type="number" placeholder="اختياري" value={form.clicks} onChange={e => setForm(f => ({ ...f, clicks: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
              <input className={inputCls} placeholder="اختياري" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="flex items-center gap-2 h-9 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {addMutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <DollarSign className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-xl font-extrabold text-foreground">{fmt(totalSpend)} دج</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي الإنفاق</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <Target className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-xl font-extrabold text-foreground">{totalImpressions.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">المشاهدات</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-xl font-extrabold text-foreground">{ctr}%</p>
          <p className="text-xs text-muted-foreground mt-1">معدل النقر (CTR)</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <TrendingDown className="w-5 h-5 text-orange-500 mb-2" />
          <p className="text-xl font-extrabold text-foreground">{cpc} دج</p>
          <p className="text-xs text-muted-foreground mt-1">تكلفة النقرة (CPC)</p>
        </div>
      </div>

      {/* Campaigns */}
      {Object.keys(campaigns).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">الحملات</h3>
          {Object.entries(campaigns).map(([name, data]) => (
            <div key={name} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{name}</h4>
                  <p className="text-xs text-muted-foreground">{data.entries.length} إدخال • {data.entries[0]?.platform}</p>
                </div>
                <span className="text-lg font-extrabold text-foreground">{fmt(data.spend)} دج</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-sm font-bold text-foreground">{data.impressions.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">مشاهدات</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-sm font-bold text-foreground">{data.clicks.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">نقرات</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-sm font-bold text-foreground">
                    {data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : '0'}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entries Table */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">سجل الإنفاق</h3>
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">التاريخ</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">المنصة</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">الحملة</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">المشاهدات</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">النقرات</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">المبلغ</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.slice().reverse().map(e => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs">{e.entry_date}</td>
                    <td className="px-3 py-2.5 text-xs capitalize">{e.platform}</td>
                    <td className="px-3 py-2.5 text-xs truncate max-w-[120px]">{e.campaign_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{(e.impressions || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs">{(e.clicks || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs font-bold">{fmt(e.spend)} دج</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => deleteMutation.mutate(e.id)}
                        className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Megaphone className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground mb-1">لا توجد إنفاق بعد</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">أضف إنفاقك الإعلاني لتتبع أداء حملاتك وحساب الربح الحقيقي</p>
        </div>
      )}
    </div>
  );
}
