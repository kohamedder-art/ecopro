import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KPICard } from './KPICard';
import { SectionHeader } from './SectionHeader';
import {
  surfaceCard, PIE_COLORS, funnelLabelKey, fmtNum, fmtCurrency, fmtPct, fmtPoas,
} from './helpers';
import {
  MkrPerson, MkrCart, MkrCheck, MkrDollar, MkrPackage, MkrTarget, MkrMegaphone,
  MkrDownload, MkrRefresh,
} from '@/components/icons/MarketingIcons';

interface OverviewData {
  sessions: number; partialSessions: number; totalOrders: number; deliveredOrders: number;
  returnedOrders: number; realizedRevenue: number; netProfit: number; poas: number | null;
  bookedRevenue: number; adSpend: number; grossProfit: number;
}

interface OverviewTabProps {
  overview?: OverviewData;
  funnel: { label: string; value: number; rate: number }[];
  sources: { source: string; sessions: number; purchases: number }[];
  statuses: { status: string; count: number; share: number }[];
  onRefresh?: () => void;
}

export function OverviewTab({ overview, funnel, sources, statuses, onRefresh }: OverviewTabProps) {
  const { t } = useTranslation();

  const funnelChartData = useMemo(() => funnel.map(f => ({
    name: t(funnelLabelKey[f.label] || f.label),
    value: f.value, rate: f.rate,
  })), [funnel, t]);

  const sourceChartData = useMemo(() => sources.slice(0, 6).map((s, i) => ({
    name: s.source, sessions: s.sessions, purchases: s.purchases,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })), [sources]);

  if (!overview) return null;

  const convRate = overview.sessions > 0 ? (overview.totalOrders / overview.sessions) * 100 : 0;
  const deliveredRate = overview.totalOrders > 0 ? (overview.deliveredOrders / overview.totalOrders) * 100 : 0;

  const handleExport = () => {
    const data = {
      overview,
      funnel,
      sources,
      statuses,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-[9px]">
      {/* Quick actions */}
      <div className="flex items-center gap-[7px]">
        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-[5px]" onClick={handleExport}>
          <MkrDownload className="h-[11px] w-[11px]" />
          {t('marketing.export') || 'Export'}
        </Button>
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

      {/* Metric highlights (from Insights) */}
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

      {/* Funnel + Sources */}
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
            {sourceChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MkrMegaphone className="h-5 w-5 text-indigo-400 mb-[7px]" />
                <p className="text-xs font-medium">{t('marketing.sources.noData')}</p>
                <p className="text-[11px] text-muted-foreground mt-[3px]">Source data appears once tracked traffic arrives.</p>
              </div>
            ) : (
              <div className="flex items-center gap-[11px]">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={sourceChartData} dataKey="sessions" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={2} stroke="var(--background)">
                      {sourceChartData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-[7px]">
                  {sourceChartData.map(src => (
                    <div key={src.name} className="flex items-center gap-[7px] text-xs">
                      <span className="w-[9px] h-[9px] rounded-full shrink-0 shadow-sm" style={{ background: src.fill }} />
                      <span className="font-bold capitalize flex-1 truncate">{src.name}</span>
                      <span className="text-muted-foreground tabular-nums font-medium">{fmtNum(src.sessions)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Source Quality + Statuses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[11px]">
        {sources.length > 0 && (
          <Card className={surfaceCard}>
            <SectionHeader icon={<MkrTarget className="h-[11px] w-[11px]" />} title={t('marketing.sourceQuality.title') || 'Source Quality'} />
            <CardContent className="p-[13px] pt-[9px] space-y-[7px]">
              {[...sources]
                .sort((a, b) => {
                  const rateA = a.sessions > 0 ? a.purchases / a.sessions : 0;
                  const rateB = b.sessions > 0 ? b.purchases / b.sessions : 0;
                  return rateB - rateA;
                })
                .slice(0, 6)
                .map(src => {
                  const rate = src.sessions > 0 ? (src.purchases / src.sessions) * 100 : 0;
                  return (
                    <div key={src.source} className="flex items-center gap-[9px] text-xs">
                      <span className="w-[9px] h-[9px] rounded-full shrink-0 shadow-sm" style={{ background: PIE_COLORS[sources.indexOf(src) % PIE_COLORS.length] }} />
                      <span className="font-bold capitalize flex-1 truncate">{src.source}</span>
                      <span className="text-muted-foreground tabular-nums">{fmtNum(src.sessions)}</span>
                      <span className={`font-bold tabular-nums ${rate >= 3 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                        {fmtPct(rate)}
                      </span>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}

        {statuses.length > 0 && (
          <Card className={surfaceCard}>
            <SectionHeader icon={<MkrPackage className="h-[11px] w-[11px]" />} title={t('marketing.status.title')} />
            <CardContent className="p-[13px] pt-[9px]">
              <div className="flex flex-wrap gap-[7px]">
                {statuses.map(st => (
                  <Badge key={st.status} variant="secondary" className="text-[11px] py-1 px-[9px] rounded-lg font-medium">
                    {t(`marketing.orderStatus.${st.status}`)}: {fmtNum(st.count)} ({fmtPct(st.share)})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
