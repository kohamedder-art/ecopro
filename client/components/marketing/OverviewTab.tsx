import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KPICard } from './KPICard';
import { SectionHeader } from './SectionHeader';
import {
  surfaceCard, surfaceMuted, PIE_COLORS, funnelLabelKey, fmtNum, fmtCurrency, fmtPct, fmtPoas,
} from './helpers';
import {
  MkrPerson, MkrCart, MkrCheck, MkrDollar, MkrPackage, MkrTarget, MkrMegaphone,
  MkrRefresh, MkrRepeat, MkrUserCheck, MkrPhone, MkrMonitor, MkrTablet,
  MkrPin, MkrTrend, MkrCrown,
} from '@/components/icons/MarketingIcons';

interface OverviewData {
  sessions: number; partialSessions: number; totalOrders: number; deliveredOrders: number;
  returnedOrders: number; realizedRevenue: number; netProfit: number; poas: number | null;
  bookedRevenue: number; adSpend: number; grossProfit: number;
}

interface CustomerAnalytics {
  totalCustomers: number; repeatCustomers: number; repeatRate: number;
  averageOrderValue: number; averageOrdersPerCustomer: number; totalRevenue: number;
  topCustomers: { name: string; phone: string; orders: number; totalSpent: number; lastOrder: string }[];
  wilayaBreakdown: { wilayaId: number; wilayaName: string; orders: number; revenue: number; customers: number }[];
  deviceBreakdown: { device: string; sessions: number; share: number }[];
  ordersByDay: { date: string; orders: number; revenue: number }[];
  newVsReturning: { newCustomers: number; returningCustomers: number; newRevenue: number; returningRevenue: number };
  conversionRate: number; cartAbandonmentRate: number;
}

interface GenderAnalytics {
  male: number; female: number; unknown: number; total: number;
  malePercent: number; femalePercent: number; unknownPercent: number;
  byProduct: { productId: number; productTitle: string; male: number; female: number; unknown: number }[];
}

interface OverviewTabProps {
  overview?: OverviewData;
  funnel: { label: string; value: number; rate: number }[];
  sources: { source: string; sessions: number; purchases: number }[];
  customerData?: CustomerAnalytics;
  genderData?: GenderAnalytics;
  clusters: { label: string; sessions: number; share: number; avgScrollDepth: number; avgActiveTimeSeconds: number; topExitPage: string | null; topProductTitle: string | null; topSource: string | null; reason: string }[];
  sessions: { id: string; startedAt: string; source: string | null; productTitle: string | null; diagnosticLabel: string | null; activeTimeSeconds: number; maxScrollDepth: number; converted: boolean; partial: boolean }[];
  onRefresh?: () => void;
}

export function OverviewTab({ overview, funnel, sources, customerData, genderData, clusters, sessions, onRefresh }: OverviewTabProps) {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  const funnelChartData = useMemo(() => funnel.map(f => ({
    name: t(funnelLabelKey[f.label] || f.label),
    value: f.value, rate: f.rate,
  })), [funnel, t]);

  const sourceChartData = useMemo(() => sources.slice(0, 6).map((s, i) => ({
    name: s.source, sessions: s.sessions, purchases: s.purchases, rate: s.sessions > 0 ? (s.purchases / s.sessions) * 100 : 0,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })), [sources]);

  if (!overview) return null;

  const convRate = overview.sessions > 0 ? (overview.totalOrders / overview.sessions) * 100 : 0;
  const deliveredRate = overview.totalOrders > 0 ? (overview.deliveredOrders / overview.totalOrders) * 100 : 0;

  return (
    <div className="space-y-[9px]">
      {/* Quick actions */}
      <div className="flex items-center gap-[7px]">
        {onRefresh && (
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-[5px]" onClick={onRefresh}>
            <MkrRefresh className="h-[11px] w-[11px]" />
            {t('marketing.refresh') || 'Refresh'}
          </Button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-[9px]">
        <div className="sm:col-span-2"><KPICard icon={<MkrPerson className="h-[13px] w-[13px] text-white" />} iconBg="bg-blue-600" label={t('marketing.kpi.sessions')} value={fmtNum(overview.sessions)} sub={overview.partialSessions > 0 ? t('marketing.kpi.partial', { count: fmtNum(overview.partialSessions) }) : undefined} /></div>
        <KPICard icon={<MkrCart className="h-[13px] w-[13px] text-white" />} iconBg="bg-orange-600" label={t('marketing.kpi.orders')} value={fmtNum(overview.totalOrders)} sub={overview.totalOrders > 0 ? t('marketing.kpi.deliveredPct', { pct: fmtPct((overview.deliveredOrders / overview.totalOrders) * 100) }) : undefined} />
        <KPICard icon={<MkrCheck className="h-[13px] w-[13px] text-white" />} iconBg="bg-emerald-600" label={t('marketing.kpi.delivered')} value={fmtNum(overview.deliveredOrders)} sub={fmtCurrency(overview.realizedRevenue)} positive={overview.deliveredOrders > 0} />
        <KPICard icon={<MkrDollar className="h-[13px] w-[13px] text-white" />} iconBg="bg-teal-600" label={t('marketing.kpi.netProfit')} value={fmtCurrency(overview.netProfit)} sub={overview.poas !== null ? `POAS ${fmtPoas(overview.poas)}` : t('marketing.kpi.noSpend')} positive={overview.netProfit > 0} />
        <KPICard icon={<MkrPackage className="h-[13px] w-[13px] text-white" />} iconBg="bg-rose-600" label={t('marketing.kpi.returnRate')} value={overview.deliveredOrders + overview.returnedOrders > 0 ? fmtPct((overview.returnedOrders / (overview.deliveredOrders + overview.returnedOrders)) * 100) : '—'} sub={t('marketing.kpi.returned', { count: fmtNum(overview.returnedOrders) })} positive={false} />
      </div>

      {/* Metric highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[9px]">
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrTarget className="h-[11px] w-[11px] text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.insights.convRate') || 'Conversion'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtPct(convRate)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrCheck className="h-[11px] w-[11px] text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.insights.deliveryRate') || 'Delivery'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtPct(deliveredRate)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrDollar className="h-[11px] w-[11px] text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.mini.grossProfit') || 'Gross Profit'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtCurrency(overview.grossProfit)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrPerson className="h-[11px] w-[11px] text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.mini.adSpend') || 'Ad Spend'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtCurrency(overview.adSpend)}</p>
        </div>
      </div>

      {/* Funnel + Sources (merged with source quality) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[11px]">
        <Card className={surfaceCard}>
          <SectionHeader icon={<MkrTarget className="h-[11px] w-[11px]" />} title={t('marketing.funnel.title')} />
          <CardContent className="p-[13px] pt-[9px]">
            {funnelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)' }}
                    formatter={(value: number, _name: string, entry: any) => [`${fmtNum(value)} (${fmtPct(entry.payload.rate)})`, '']} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={32}>
                    {funnelChartData.map((_e, i) => (<Cell key={i} fill={['#818cf8', '#a78bfa', '#fbbf24', '#34d399'][i] || '#818cf8'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MkrTarget className="h-5 w-5 text-violet-400 mb-[7px]" />
                <p className="text-xs font-medium">{t('marketing.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <SectionHeader icon={<MkrMegaphone className="h-[11px] w-[11px]" />} title={t('marketing.sources.title')} />
          <CardContent className="p-[13px] pt-[9px]">
            {sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MkrMegaphone className="h-5 w-5 text-indigo-400 mb-[7px]" />
                <p className="text-xs font-medium">{t('marketing.sources.noData')}</p>
                <p className="text-[11px] text-muted-foreground mt-[3px]">Source data appears once tracked traffic arrives.</p>
              </div>
            ) : (
              <div className="space-y-[7px]">
                {sourceChartData.map(src => (
                  <div key={src.name} className="flex items-center gap-[7px] text-xs">
                    <span className="w-[9px] h-[9px] rounded-full shrink-0 shadow-sm" style={{ background: src.fill }} />
                    <span className="font-bold capitalize flex-1 truncate">{src.name}</span>
                    <span className="text-muted-foreground tabular-nums font-medium">{fmtNum(src.sessions)}</span>
                    <span className={`font-bold tabular-nums ${src.rate >= 3 ? 'text-emerald-600 dark:text-emerald-400' : src.rate >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                      {fmtPct(src.rate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Audience KPIs ── */}
      {customerData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-[9px]">
            <KPICard icon={<MkrPerson className="h-[13px] w-[13px] text-white" />} iconBg="bg-blue-600" label={t('marketing.customers.total')} value={fmtNum(customerData.totalCustomers)} />
            <KPICard icon={<MkrRepeat className="h-[13px] w-[13px] text-white" />} iconBg="bg-violet-600" label={t('marketing.customers.repeat')} value={fmtNum(customerData.repeatCustomers)} sub={`${fmtPct(customerData.repeatRate)} ${t('marketing.customers.repeatRate')}`} positive={customerData.repeatRate > 15} />
            <KPICard icon={<MkrDollar className="h-[13px] w-[13px] text-white" />} iconBg="bg-emerald-600" label={t('marketing.customers.aov')} value={fmtCurrency(customerData.averageOrderValue)} />
            <KPICard icon={<MkrTarget className="h-[13px] w-[13px] text-white" />} iconBg="bg-rose-600" label={t('marketing.customers.conversion')} value={fmtPct(customerData.conversionRate)} positive={customerData.conversionRate > 2} />
            <KPICard icon={<MkrCart className="h-[13px] w-[13px] text-white" />} iconBg="bg-red-600" label={t('marketing.customers.cartAbandonment')} value={fmtPct(customerData.cartAbandonmentRate)} positive={false} />
          </div>

          {/* New vs Returning + Devices */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[11px]">
            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrUserCheck className="h-[11px] w-[11px]" />} title={t('marketing.customers.newVsReturning')} />
              <CardContent className="p-[13px] pt-[9px]">
                <div className="grid grid-cols-2 gap-[9px]">
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 p-[11px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('marketing.customers.new')}</p>
                    <p className="text-xl font-extrabold mt-[3px]">{fmtNum(customerData.newVsReturning.newCustomers)}</p>
                    <p className="text-xs text-muted-foreground mt-[3px]">{fmtCurrency(customerData.newVsReturning.newRevenue)} {t('marketing.customers.revenue')}</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/50 p-[11px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">{t('marketing.customers.returning')}</p>
                    <p className="text-xl font-extrabold mt-[3px]">{fmtNum(customerData.newVsReturning.returningCustomers)}</p>
                    <p className="text-xs text-muted-foreground mt-[3px]">{fmtCurrency(customerData.newVsReturning.returningRevenue)} {t('marketing.customers.revenue')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrPhone className="h-[11px] w-[11px]" />} title={t('marketing.customers.devices')} />
              <CardContent className="p-[13px] pt-[9px]">
                {customerData.deviceBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('marketing.customers.noDevices')}</p>
                ) : (
                  <div className="space-y-[7px]">
                    {customerData.deviceBreakdown.map(d => {
                      const DeviceIcon = d.device === 'mobile' ? MkrPhone : d.device === 'tablet' ? MkrTablet : MkrMonitor;
                      return (
                        <div key={d.device} className="flex items-center gap-[9px]">
                          <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-[3px]">
                              <span className="text-xs font-bold capitalize">{d.device}</span>
                              <span className="text-xs text-muted-foreground">{fmtNum(d.sessions)} ({fmtPct(d.share)})</span>
                            </div>
                            <div className="h-[7px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500" style={{ width: `${Math.min(d.share, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gender + Order Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[11px]">
            {genderData && genderData.total > 0 && (
              <Card className={surfaceCard}>
                <SectionHeader icon={<MkrPerson className="h-[11px] w-[11px]" />} title={t('marketing.customers.gender')} />
                <CardContent className="p-[13px] pt-[9px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[11px] items-start">
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: t('marketing.customers.gender.male'), value: genderData.male, color: '#3b82f6' },
                              { name: t('marketing.customers.gender.female'), value: genderData.female, color: '#ec4899' },
                              { name: t('marketing.customers.gender.unknown'), value: genderData.unknown, color: '#94a3b8' },
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value"
                          >
                            {[{ color: '#3b82f6' }, { color: '#ec4899' }, { color: '#94a3b8' }].map((e, i) => (<Cell key={i} fill={e.color} />))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)' }}
                            formatter={(value: number, name: string) => [`${value} (${genderData.total > 0 ? Math.round((value / genderData.total) * 100) : 0}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex items-center gap-[7px] flex-wrap justify-center mt-[3px]">
                        {[
                          { label: t('marketing.customers.gender.male'), count: genderData.male, pct: genderData.malePercent, color: 'bg-blue-500' },
                          { label: t('marketing.customers.gender.female'), count: genderData.female, pct: genderData.femalePercent, color: 'bg-pink-500' },
                          ...(genderData.unknown > 0 ? [{ label: t('marketing.customers.gender.unknown'), count: genderData.unknown, pct: genderData.unknownPercent, color: 'bg-slate-400' }] : []),
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-[5px]">
                            <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${item.color}`} />
                            <span className="text-xs font-semibold">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.count} <span className="font-bold">({item.pct}%)</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {genderData.byProduct.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-[7px]">{t('marketing.customers.gender.byProduct')}</p>
                        <div className="space-y-[7px] max-h-[200px] overflow-y-auto pr-1">
                          {genderData.byProduct.map(p => {
                            const total = p.male + p.female + p.unknown;
                            const malePct = total > 0 ? Math.round((p.male / total) * 100) : 0;
                            const femalePct = total > 0 ? Math.round((p.female / total) * 100) : 0;
                            return (
                              <div key={p.productId} className="text-xs">
                                <div className="flex items-center justify-between mb-[3px]">
                                  <span className="font-semibold truncate max-w-[160px]">{p.productTitle}</span>
                                  <span className="text-muted-foreground shrink-0 ml-1">{total}</span>
                                </div>
                                <div className="h-[7px] rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${malePct}%` }} />
                                  <div className="h-full bg-pink-500 transition-all" style={{ width: `${femalePct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {customerData.ordersByDay.length > 0 && (
              <Card className={surfaceCard}>
                <SectionHeader icon={<MkrTrend className="h-[11px] w-[11px]" />} title={t('marketing.customers.orderTrend')} />
                <CardContent className="p-[13px] pt-[9px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={customerData.ordersByDay} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                      <defs>
                        <linearGradient id="ordersFillOverview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <RechartsTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)' }}
                        formatter={(value: number, name: string) => [name === 'revenue' ? fmtCurrency(value) : fmtNum(value), name === 'revenue' ? t('marketing.customers.revenue') : t('marketing.customers.orderTrend')]}
                        labelFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })} />
                      <Area type="monotone" dataKey="orders" stroke="#818cf8" strokeWidth={2} fill="url(#ordersFillOverview)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Geography */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[11px]">
            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrPin className="h-[11px] w-[11px]" />} title={t('marketing.customers.geography')} />
              <CardContent className="p-[13px] pt-[9px]">
                {customerData.wilayaBreakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <MkrPin className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-[7px]" />
                    <p className="text-xs text-muted-foreground">{t('marketing.customers.noGeo')}</p>
                  </div>
                ) : (
                  <div className="space-y-[7px] max-h-[280px] overflow-y-auto pr-1">
                    {customerData.wilayaBreakdown.slice(0, 15).map((w, i) => (
                      <div key={w.wilayaId} className="flex items-center gap-[9px] text-xs">
                        <span className="w-5 text-center font-bold text-muted-foreground">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">{w.wilayaName}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">{fmtNum(w.orders)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-[3px]">
                            <span className="text-muted-foreground">{fmtNum(w.customers)} {t('marketing.customers.customers')}</span>
                            <span className="font-medium">{fmtCurrency(w.revenue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
