import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TabShell } from './TabShell';
import { surfaceCard, fmtNum, fmtCurrency, fmtPoas, fmtPct, fmtSeconds, frictionColor } from './helpers';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { MkrMegaphone, MkrAlert, MkrChevron, MkrDollar, MkrTrend, MkrGrid } from '@/components/icons/MarketingIcons';
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

interface CreativeRow {
  key: string; platform: string | null; campaignName: string | null; creativeName: string | null;
  sessions: number; productViews: number; purchases: number; deliveredOrders: number;
  realizedRevenue: number; netProfit: number; grossProfit: number; spend: number;
  poas: number | null; returnRate: number; deliveredRate: number;
  topFriction: string | null; toxicSuccess: boolean;
}

interface RecentSession {
  id: string; startedAt: string; source: string | null; productTitle: string | null;
  diagnosticLabel: string | null; activeTimeSeconds: number; maxScrollDepth: number; converted: boolean; partial: boolean;
}

interface CreativesTabProps {
  creatives: CreativeRow[];
  toxicCreativeCount: number;
  sessions: RecentSession[];
}

export function CreativesTab({ creatives, toxicCreativeCount, sessions }: CreativesTabProps) {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCreative, setExpandedCreative] = useState<string | null>(null);
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

  const { data: inputs, isLoading: inputsLoading } = useQuery<any>({
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
      isEmpty={creatives.length === 0 && sessions.length === 0}
      emptyIcon={<MkrMegaphone className="h-7 w-7 text-orange-500" />}
      emptyGradient="from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30"
      emptyTitle={t('marketing.creatives.noData')}
      emptyHint={t('marketing.creatives.noDataHint')}
    >
      <div className="space-y-[9px]">
        {toxicCreativeCount > 0 && (
          <div className="rounded-xl border border-red-300/50 dark:border-red-700/50 bg-red-50/80 dark:bg-red-900/20 p-[9px] flex items-center gap-[7px]">
            <MkrAlert className="h-[11px] w-[11px] text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-800 dark:text-red-300 font-medium">
              {t('marketing.creatives.toxicWarning', { count: String(toxicCreativeCount) })}
            </span>
          </div>
        )}

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

              {spendEntries.length > 0 && (
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
              )}
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

        {creatives.length > 0 && (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[9px]">
            <div className="rounded-xl border border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-900/20 p-[11px]">
              <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.netProfit')}</p>
              <p className="text-lg font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {fmtCurrency(creatives.reduce((s, c) => s + c.netProfit, 0))}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200/50 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-900/20 p-[11px]">
              <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.poas')} ({t('marketing.creatives.best')})</p>
              <p className="text-lg font-black mt-1 text-violet-600 dark:text-violet-400">
                {fmtPoas(Math.max(...creatives.map(c => c.poas ?? 0)))}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/20 p-[11px]">
              <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.spend')}</p>
              <p className="text-lg font-black mt-1 text-amber-600 dark:text-amber-400">
                {fmtCurrency(creatives.reduce((s, c) => s + c.spend, 0))}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/50 dark:border-sky-800/50 bg-sky-50/60 dark:bg-sky-900/20 p-[11px]">
              <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.ads')}</p>
              <p className="text-lg font-black mt-1 text-sky-600 dark:text-sky-400">{creatives.length}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[9px]">
            {creatives.map(c => {
              const isOpen = expandedCreative === c.key;
              return (
                <div key={c.key} className={`${surfaceCard} ${c.toxicSuccess ? 'ring-2 ring-red-400/40' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedCreative(isOpen ? null : c.key)}
                    className="w-full text-left p-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-[7px]">
                      <div className="flex items-center gap-[7px] min-w-0 flex-1">
                        <span className="text-xs font-bold truncate">{c.creativeName || c.campaignName || c.key}</span>
                        {c.platform && <Badge variant="secondary" className="text-[10px] py-0 px-[5px] capitalize">{c.platform}</Badge>}
                      </div>
                      {c.toxicSuccess && <Badge variant="destructive" className="text-[10px] py-0 px-[5px] shrink-0">{t('marketing.creatives.toxic')}</Badge>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[7px]">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.sessions')}</p>
                        <p className="text-xs font-bold mt-[3px]">{fmtNum(c.sessions)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.orders')}</p>
                        <p className="text-xs font-bold mt-[3px]">{fmtNum(c.purchases)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.netProfit')}</p>
                        <p className={`text-xs font-bold mt-[3px] ${c.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(c.netProfit)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.poas')}</p>
                        <p className={`text-xs font-bold mt-[3px] ${c.poas !== null && c.poas >= 1 ? 'text-emerald-600' : c.poas !== null && c.poas >= 0.5 ? 'text-amber-600' : 'text-slate-500'}`}>{fmtPoas(c.poas)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-[7px]">
                      <div className="flex items-center gap-[7px]">
                        <MkrDollar className="h-[11px] w-[11px] text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{t('marketing.creatives.col.spend')}: {fmtCurrency(c.spend)}</span>
                      </div>
                      <MkrChevron className={`h-[13px] w-[13px] text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-[11px] pb-[11px] pt-0 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-[7px] pt-[9px]">
                        {[
                          { label: t('marketing.kpi.productViews'), value: fmtNum(c.productViews) },
                          { label: t('marketing.creatives.col.delivered'), value: fmtNum(c.deliveredOrders), color: 'text-emerald-600' },
                          { label: t('marketing.creatives.col.revenue'), value: fmtCurrency(c.realizedRevenue) },
                          { label: t('marketing.mini.grossProfit'), value: fmtCurrency(c.grossProfit) },
                          { label: t('marketing.creatives.col.returnPct'), value: fmtPct(c.returnRate) },
                          { label: t('marketing.creatives.col.friction'), value: c.topFriction ? null : '—', badge: c.topFriction ? { text: t(`marketing.friction.${c.topFriction}`), color: frictionColor(c.topFriction) } : undefined },
                        ].map((item, i) => (
                          <div key={i} className="text-center p-[7px] rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                            {item.badge ? (
                              <Badge className={`text-[10px] py-0 mt-[3px] ${item.badge.color}`}>{item.badge.text}</Badge>
                            ) : (
                              <p className={`text-xs font-bold mt-[3px] ${item.color || ''}`}>{item.value}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className={`${surfaceCard}`}>
            <div className="flex items-center gap-[7px] px-[13px] pt-[13px] pb-[9px]">
              <MkrGrid className="h-[11px] w-[11px] text-primary" />
              <span className="text-[13px] font-bold">{t('marketing.diag.recentTitle')}</span>
            </div>
            <div className="p-[13px] pt-[9px] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wider">
                    <TableHead>{t('marketing.diag.col.time')}</TableHead>
                    <TableHead>{t('marketing.diag.col.source')}</TableHead>
                    <TableHead>{t('marketing.diag.col.product')}</TableHead>
                    <TableHead>{t('marketing.diag.col.friction')}</TableHead>
                    <TableHead className="text-right">{t('marketing.diag.col.scroll')}</TableHead>
                    <TableHead className="text-right">{t('marketing.diag.col.duration')}</TableHead>
                    <TableHead>{t('marketing.diag.col.outcome')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{s.source || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{s.productTitle || '—'}</TableCell>
                      <TableCell>{s.diagnosticLabel ? <Badge className={`text-xs py-0.5 rounded-lg ${frictionColor(s.diagnosticLabel)}`}>{t(`marketing.friction.${s.diagnosticLabel}`)}</Badge> : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{Math.round(s.maxScrollDepth)}%</TableCell>
                      <TableCell className="text-right text-xs">{fmtSeconds(s.activeTimeSeconds)}</TableCell>
                      <TableCell>
                        {s.converted ? (
                          <Badge className="text-xs py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{t('marketing.diag.converted')}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs py-0">{t('marketing.diag.dropped')}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </TabShell>
  );
}
