import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { KPICard } from './KPICard';
import { AlgeriaMap } from './AlgeriaMap';
import { fmtNum, fmtCurrency, fmtPct } from './helpers';

interface OverviewData {
  sessions: number;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  realizedRevenue: number;
  netProfit: number;
  adSpend?: number;
  poas?: number;
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
      orders: Number(d.orders) || 0,
    }));
  }, [ordersByDay]);

  const topWilayas = (wilayaBreakdown || []).slice(0, 6);
  const maxWilayaOrders = topWilayas.length > 0 ? Math.max(...topWilayas.map(w => w.orders)) : 1;

  const deliveryRate = overview && overview.totalOrders > 0
    ? ((overview.deliveredOrders / overview.totalOrders) * 100)
    : null;

  const returnRate = overview && (overview.deliveredOrders + overview.returnedOrders) > 0
    ? ((overview.returnedOrders / (overview.deliveredOrders + overview.returnedOrders)) * 100)
    : null;

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 mb-4">
          <svg className="h-8 w-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t('marketing.noData')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t('marketing.noDataHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={<svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          label="الإيرادات"
          value={fmtCurrency(overview.realizedRevenue)}
          sub={overview.adSpend ? `${fmtCurrency(overview.realizedRevenue - overview.adSpend)} صافي` : undefined}
          positive={overview.realizedRevenue > 0}
        />
        <KPICard
          icon={<svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          label="صافي الربح"
          value={fmtCurrency(overview.netProfit)}
          sub={overview.realizedRevenue > 0 ? `${fmtPct((overview.netProfit / overview.realizedRevenue) * 100)} هامش` : undefined}
          positive={overview.netProfit > 0}
        />
        <KPICard
          icon={<svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
          label="الطلبات"
          value={fmtNum(overview.totalOrders)}
          sub={deliveryRate !== null ? `${fmtPct(deliveryRate)} تم التوصيل` : undefined}
          positive={overview.totalOrders > 0}
        />
        <KPICard
          icon={<svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>}
          iconBg="bg-gradient-to-br from-rose-500 to-rose-600"
          label="نسبة الإرجاع"
          value={returnRate !== null ? fmtPct(returnRate) : '—'}
          sub={overview.returnedOrders > 0 ? `${fmtNum(overview.returnedOrders)} طلب مرجّع` : undefined}
          positive={false}
        />
      </div>

      {/* ── Row 2: Revenue Chart + Geography ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Revenue Over Time */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">الإيرادات اليومية</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  width={50}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [fmtCurrency(value), 'الإيرادات']}
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-xs text-slate-500 dark:text-slate-400">
              لا توجد بيانات بعد
            </div>
          )}
        </div>

        {/* Geography */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">خريطة الطلبات</span>
          </div>
          <AlgeriaMap data={topWilayas} />
        </div>
      </div>
    </div>
  );
}
