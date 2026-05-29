import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TabShell } from './TabShell';
import { fmtNum, fmtCurrency } from './helpers';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { MkrMegaphone } from '@/components/icons/MarketingIcons';
import { Plus, Trash2, DollarSign, Target, TrendingUp, TrendingDown, Loader, X, Megaphone } from 'lucide-react';

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

interface CreativeRow {
  key: string;
  platform: string | null;
  campaignName: string | null;
  creativeName: string | null;
  sessions: number;
  purchases: number;
  netProfit: number;
  spend: number;
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

interface CreativesTabProps {
  creatives: CreativeRow[];
}

export function CreativesTab({ creatives }: CreativesTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [spendForm, setSpendForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    platform: 'facebook',
    campaignName: '',
    spend: '',
    impressions: '',
    clicks: '',
    notes: '',
  });

  const { data: inputs } = useQuery<any>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<any>('/api/pixels/omni/inputs'),
  });

  const addSpendMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/creative-spend', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      toast({ title: 'تمت الإضافة' });
      setShowSpendForm(false);
      setSpendForm({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
    },
    onError: () => toast({ title: 'خطأ', variant: 'destructive' }),
  });

  const deleteSpendMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/pixels/omni/creative-spend/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['omni-inputs'] }),
  });

  const spendEntries: SpendEntry[] = inputs?.spendEntries || [];

  const totalSpend = spendEntries.reduce((s, e) => s + (e.spend || 0), 0);
  const totalImpressions = spendEntries.reduce((s, e) => s + (e.impressions || 0), 0);
  const totalClicks = spendEntries.reduce((s, e) => s + (e.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
  const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0';

  const fmt = (n: number) => Math.round(n).toLocaleString('ar-DZ');

  const handleAddSpend = () => {
    if (!spendForm.spend || parseFloat(spendForm.spend) <= 0) {
      toast({ title: 'أدخل مبلغ الإنفاق', variant: 'destructive' });
      return;
    }
    addSpendMutation.mutate({
      entryDate: spendForm.entryDate,
      platform: spendForm.platform,
      campaignName: spendForm.campaignName || undefined,
      spend: parseFloat(spendForm.spend) || 0,
      impressions: parseInt(spendForm.impressions) || undefined,
      clicks: parseInt(spendForm.clicks) || undefined,
      notes: spendForm.notes || undefined,
    });
  };

  const showSpend = spendEntries.length > 0 || showSpendForm;

  return (
    <TabShell
      isEmpty={creatives.length === 0 && spendEntries.length === 0}
      emptyIcon={<MkrMegaphone className="h-7 w-7 text-orange-500" />}
      emptyGradient="from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30"
      emptyTitle={t('marketing.creatives.noData')}
      emptyHint={t('marketing.creatives.noDataHint')}
    >
      <div className="space-y-[9px]">
        {/* ── Ad Spend Section ── */}
        <div className="bg-card border border-border rounded-xl p-[11px] shadow-sm">
          <div className="flex items-center justify-between mb-[9px]">
            <h3 className="text-sm font-bold text-foreground">الإنفاق الإعلاني</h3>
            <button
              onClick={() => setShowSpendForm(!showSpendForm)}
              className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              {showSpendForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showSpendForm ? 'إلغاء' : 'إضافة إنفاق'}
            </button>
          </div>

          {showSpendForm && (
            <div className="space-y-3 mb-3 p-3 bg-muted/20 rounded-xl border border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">التاريخ</label>
                  <input type="date" className={inputCls} value={spendForm.entryDate} onChange={e => setSpendForm(f => ({ ...f, entryDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">المنصة</label>
                  <select className={selectCls} value={spendForm.platform} onChange={e => setSpendForm(f => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">اسم الحملة</label>
                  <input className={inputCls} placeholder="اختياري" value={spendForm.campaignName} onChange={e => setSpendForm(f => ({ ...f, campaignName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">المبلغ (دج)</label>
                  <input className={inputCls} type="number" placeholder="0" value={spendForm.spend} onChange={e => setSpendForm(f => ({ ...f, spend: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">المشاهدات</label>
                  <input className={inputCls} type="number" placeholder="اختياري" value={spendForm.impressions} onChange={e => setSpendForm(f => ({ ...f, impressions: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">النقرات</label>
                  <input className={inputCls} type="number" placeholder="اختياري" value={spendForm.clicks} onChange={e => setSpendForm(f => ({ ...f, clicks: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">ملاحظات</label>
                  <input className={inputCls} placeholder="اختياري" value={spendForm.notes} onChange={e => setSpendForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <button
                onClick={handleAddSpend}
                disabled={addSpendMutation.isPending}
                className="flex items-center gap-1.5 h-8 px-4 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                {addSpendMutation.isPending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                إضافة
              </button>
            </div>
          )}

          {showSpend && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <DollarSign className="w-4 h-4 text-red-500 mb-1" />
                  <p className="text-base font-extrabold text-foreground">{fmt(totalSpend)} دج</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي الإنفاق</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <Target className="w-4 h-4 text-blue-500 mb-1" />
                  <p className="text-base font-extrabold text-foreground">{totalImpressions.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">المشاهدات</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
                  <p className="text-base font-extrabold text-foreground">{ctr}%</p>
                  <p className="text-[10px] text-muted-foreground">معدل النقر (CTR)</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <TrendingDown className="w-4 h-4 text-orange-500 mb-1" />
                  <p className="text-base font-extrabold text-foreground">{cpc} دج</p>
                  <p className="text-[10px] text-muted-foreground">تكلفة النقرة (CPC)</p>
                </div>
              </div>
            </>
          )}

          {!showSpend && (
            <div className="text-center py-6">
              <Megaphone className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs font-bold text-foreground mb-1">لا توجد إنفاق بعد</p>
              <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">أضف إنفاقك الإعلاني لتتبع أداء حملاتك</p>
            </div>
          )}
        </div>

        {/* ── Creative Profit Cards ── */}
        {creatives.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-[11px] shadow-sm">
            <div className="flex items-center gap-[7px] mb-[9px]">
              <MkrMegaphone className="h-[11px] w-[11px] text-primary" />
              <span className="text-sm font-bold text-foreground">{t('marketing.creatives.ads')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[7px]">
              {creatives.map(c => (
                <div key={c.key} className="bg-muted/20 border border-border rounded-lg p-[9px]">
                  <div className="flex items-center justify-between mb-[7px]">
                    <span className="text-xs font-bold truncate">{c.creativeName || c.campaignName || c.key}</span>
                    {c.platform && (
                      <span className="text-[10px] capitalize text-muted-foreground bg-background/50 rounded px-1.5 py-0.5">{c.platform}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-[7px] text-center">
                    <div className="bg-background/50 rounded-lg p-[5px]">
                      <p className="text-[10px] text-muted-foreground">زيارات</p>
                      <p className="text-xs font-bold">{fmtNum(c.sessions)}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-[5px]">
                      <p className="text-[10px] text-muted-foreground">طلبات</p>
                      <p className="text-xs font-bold">{fmtNum(c.purchases)}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-[5px]">
                      <p className="text-[10px] text-muted-foreground">الربح</p>
                      <p className={`text-xs font-bold ${c.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {c.netProfit >= 0 ? '+' : ''}{fmtCurrency(c.netProfit)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Spend History Table ── */}
        {spendEntries.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-[11px] shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-[9px]">سجل الإنفاق</h3>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">التاريخ</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">المنصة</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">الحملة</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">المشاهدات</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">النقرات</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground">المبلغ</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {spendEntries.slice().reverse().map(e => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-2 py-2">{e.entry_date}</td>
                      <td className="px-2 py-2 capitalize">{e.platform}</td>
                      <td className="px-2 py-2 truncate max-w-[100px]">{e.campaign_name || '—'}</td>
                      <td className="px-2 py-2">{(e.impressions || 0).toLocaleString()}</td>
                      <td className="px-2 py-2">{(e.clicks || 0).toLocaleString()}</td>
                      <td className="px-2 py-2 font-bold">{fmt(e.spend)} دج</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => deleteSpendMutation.mutate(e.id)}
                          className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </TabShell>
  );
}
