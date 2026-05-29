import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { KPICard } from './KPICard';
import { fmtNum, fmtCurrency, fmtPct } from './helpers';
import {
  MkrDollar, MkrCart, MkrCheck, MkrPackage, MkrTrend, MkrPin,
} from '@/components/icons/MarketingIcons';

interface OverviewData {
  sessions: number;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  realizedRevenue: number;
  netProfit: number;
}

interface WilayaRow {
  wilayaId: number;
  wilayaName: string;
  orders: number;
  revenue: number;
  customers: number;
}

interface OrdersByDay {
  date: string;
  orders: number;
  revenue: number;
}

interface SummaryTabProps {
  overview?: OverviewData;
  wilayaBreakdown?: WilayaRow[];
  ordersByDay?: OrdersByDay[];
}

export function SummaryTab({ overview, wilayaBreakdown, ordersByDay }: SummaryTabProps) {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  const chartData = useMemo(() => {
    if (!ordersByDay || ordersByDay.length === 0) return [];
    return ordersByDay.map(d => ({
      date: d.date,
      revenue: Number(d.revenue) || 0,
    }));
  }, [ordersByDay]);

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl p-[13px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-[11px]">
          <MkrTrend className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.noDataHint')}</p>
      </div>
    );
  }

  const topWilayas = (wilayaBreakdown || []).slice(0, 8);

  return (
    <div className="space-y-[9px]">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[9px]">
        <KPICard
          icon={<MkrDollar className="h-[13px] w-[13px] text-white" />}
          iconBg="bg-blue-600"
          label={t('marketing.kpi.netProfit')}
          value={fmtCurrency(overview.netProfit)}
          positive={overview.netProfit > 0}
        />
        <KPICard
          icon={<MkrCart className="h-[13px] w-[13px] text-white" />}
          iconBg="bg-orange-600"
          label={t('marketing.kpi.orders')}
          value={fmtNum(overview.totalOrders)}
          sub={overview.totalOrders > 0 ? `${fmtPct((overview.deliveredOrders / overview.totalOrders) * 100)} ${t('marketing.kpi.deliveredPct')?.replace('{pct}', '')}` : undefined}
        />
        <KPICard
          icon={<MkrCheck className="h-[13px] w-[13px] text-white" />}
          iconBg="bg-emerald-600"
          label={t('marketing.kpi.delivered')}
          value={fmtNum(overview.deliveredOrders)}
          sub={fmtCurrency(overview.realizedRevenue)}
          positive={overview.deliveredOrders > 0}
        />
        <KPICard
          icon={<MkrPackage className="h-[13px] w-[13px] text-white" />}
          iconBg="bg-rose-600"
          label={t('marketing.kpi.returnRate')}
          value={overview.deliveredOrders + overview.returnedOrders > 0 ? fmtPct((overview.returnedOrders / (overview.deliveredOrders + overview.returnedOrders)) * 100) : '—'}
          sub={t('marketing.kpi.returned', { count: fmtNum(overview.returnedOrders) })}
          positive={false}
        />
        <KPICard
          icon={<MkrDollar className="h-[13px] w-[13px] text-white" />}
          iconBg="bg-teal-600"
          label={t('marketing.kpi.revenue') || 'Revenue'}
          value={fmtCurrency(overview.realizedRevenue)}
        />
      </div>

      {/* Revenue Chart + Wilayas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[9px]">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-xl bg-card border border-border p-[13px] shadow-sm">
          <div className="flex items-center gap-[7px] mb-[9px]">
            <MkrTrend className="h-[11px] w-[11px] text-primary" />
            <span className="text-[13px] font-bold">{t('marketing.customers.orderTrend')}</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="revenueFillSummary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)' }}
                  formatter={(value: number) => [fmtCurrency(value), t('marketing.kpi.revenue') || 'Revenue']}
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueFillSummary)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
              {t('marketing.noData')}
            </div>
          )}
        </div>

        {/* Wilaya Breakdown */}
        <div className="rounded-xl bg-card border border-border p-[13px] shadow-sm">
          <div className="flex items-center gap-[7px] mb-[9px]">
            <MkrPin className="h-[11px] w-[11px] text-primary" />
            <span className="text-[13px] font-bold">{t('marketing.customers.geography')}</span>
          </div>
          {topWilayas.length > 0 ? (
            <div className="space-y-[7px]">
              {topWilayas.map((w, i) => (
                <div key={w.wilayaId} className="flex items-center gap-[7px]">
                  <span className="w-4 text-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{w.wilayaName}</span>
                      <span className="text-xs font-bold tabular-nums">{fmtNum(w.orders)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-[2px]">
                      <span className="text-[10px] text-muted-foreground">{fmtNum(w.customers)} {t('marketing.customers.customers')}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{fmtCurrency(w.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
              {t('marketing.customers.noGeo') || 'No location data yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
