import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { KPICard } from './KPICard';
import { SectionHeader } from './SectionHeader';
import { TabShell } from './TabShell';
import { surfaceCard, surfaceMuted, fmtNum, fmtCurrency, fmtPct, fmtSeconds, frictionColor, PIE_COLORS } from './helpers';
import { useTranslation } from '@/lib/i18n';
import {
  MkrPerson, MkrRepeat, MkrDollar, MkrCart, MkrTarget, MkrUserCheck, MkrPhone, MkrMonitor, MkrTablet,
  MkrPin, MkrCrown, MkrTrend, MkrPulse, MkrCheck, MkrScroll, MkrClock, MkrGrid, MkrAlert,
} from '@/components/icons/MarketingIcons';

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

interface FrictionCluster {
  label: string; sessions: number; share: number; avgScrollDepth: number; avgActiveTimeSeconds: number;
  topExitPage: string | null; topProductTitle: string | null; topSource: string | null; reason: string;
}

interface RecentSession {
  id: string; startedAt: string; source: string | null; productTitle: string | null;
  diagnosticLabel: string | null; activeTimeSeconds: number; maxScrollDepth: number; converted: boolean; partial: boolean;
}

interface AudienceTabProps {
  customerData?: CustomerAnalytics;
  genderData?: GenderAnalytics;
  clusters: FrictionCluster[];
  sessions: RecentSession[];
}

export function AudienceTab({ customerData, genderData, clusters, sessions }: AudienceTabProps) {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <TabShell
      isEmpty={!customerData}
      emptyIcon={<MkrPerson className="h-7 w-7 text-primary" />}
      emptyGradient="from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
      emptyTitle={t('marketing.customers.noData')}
      emptyHint={t('marketing.customers.noDataHint')}
    >
      {customerData && (
        <div className="space-y-[9px]">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-[9px]">
            <KPICard icon={<MkrPerson className="h-[13px] w-[13px] text-white" />} iconBg="bg-blue-600" label={t('marketing.customers.total')} value={fmtNum(customerData.totalCustomers)} />
            <KPICard icon={<MkrRepeat className="h-[13px] w-[13px] text-white" />} iconBg="bg-violet-600" label={t('marketing.customers.repeat')} value={fmtNum(customerData.repeatCustomers)} sub={`${fmtPct(customerData.repeatRate)} ${t('marketing.customers.repeatRate')}`} positive={customerData.repeatRate > 15} />
            <KPICard icon={<MkrDollar className="h-[13px] w-[13px] text-white" />} iconBg="bg-emerald-600" label={t('marketing.customers.aov')} value={fmtCurrency(customerData.averageOrderValue)} />
            <KPICard icon={<MkrTarget className="h-[13px] w-[13px] text-white" />} iconBg="bg-rose-600" label={t('marketing.customers.conversion')} value={fmtPct(customerData.conversionRate)} positive={customerData.conversionRate > 2} />
            <KPICard icon={<MkrCart className="h-[13px] w-[13px] text-white" />} iconBg="bg-red-600" label={t('marketing.customers.cartAbandonment')} value={fmtPct(customerData.cartAbandonmentRate)} positive={false} />
          </div>

          {/* Friction clusters first (more actionable) */}
          {clusters.length > 0 && (
            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrPulse className="h-[11px] w-[11px]" />} title={t('marketing.diag.frictionTitle')} description={t('marketing.diag.frictionDesc')} />
              <CardContent className="p-[13px] pt-[9px] space-y-[7px]">
                {clusters.map((cl, idx) => (
                  <div key={idx} className={`rounded-xl border p-[11px] ${surfaceMuted}`}>
                    <div className="flex items-center justify-between mb-[7px]">
                      <Badge className={`text-xs py-0.5 rounded-lg ${frictionColor(cl.label)}`}>{t(`marketing.friction.${cl.label}`)}</Badge>
                      <span className="text-xs font-bold">{fmtNum(cl.sessions)} ({fmtPct(cl.share)})</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-[7px]">{t(`marketing.frictionReason.${cl.reason}`)}</p>
                    <div className="flex flex-wrap gap-[7px] text-xs text-muted-foreground">
                      <span className="flex items-center gap-[3px]"><MkrScroll className="h-[11px] w-[11px]" /> {t('marketing.diag.scroll')}: {Math.round(cl.avgScrollDepth)}%</span>
                      <span className="flex items-center gap-[3px]"><MkrClock className="h-[11px] w-[11px]" /> {t('marketing.diag.time')}: {fmtSeconds(cl.avgActiveTimeSeconds)}</span>
                      {cl.topExitPage && <span className="flex items-center gap-[3px]">{t('marketing.diag.exit')}: {cl.topExitPage}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                        <linearGradient id="ordersFillAudience" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="orders" stroke="#818cf8" strokeWidth={2} fill="url(#ordersFillAudience)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Geography + Top Customers */}
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

            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrCrown className="h-[11px] w-[11px]" />} title={t('marketing.customers.topCustomers')} />
              <CardContent className="p-[13px] pt-[9px]">
                {customerData.topCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <MkrCrown className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-[7px]" />
                    <p className="text-xs text-muted-foreground">{t('marketing.customers.noCustomers')}</p>
                  </div>
                ) : (
                  <div className="space-y-[7px] max-h-[280px] overflow-y-auto pr-1">
                    {customerData.topCustomers.map((c, i) => (
                      <div key={i} className={`flex items-center gap-[9px] p-[9px] rounded-xl ${i < 3 ? 'bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30' : 'bg-slate-50/60 dark:bg-slate-800/20'}`}>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold shrink-0 ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.orders} {t('marketing.customers.orders')} &middot; {t('marketing.customers.lastOrder')}: {new Date(c.lastOrder).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span className="text-xs font-extrabold shrink-0">{fmtCurrency(c.totalSpent)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrGrid className="h-[11px] w-[11px]" />} title={t('marketing.diag.recentTitle')} />
              <CardContent className="p-[13px] pt-[9px]">
                <div className="overflow-x-auto">
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </TabShell>
  );
}
