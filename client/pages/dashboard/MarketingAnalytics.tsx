import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

const WILAYA_COORDS: Record<number, [number, number]> = {
  1: [28.02, -0.26], 2: [36.16, 1.34], 3: [33.81, 2.86], 4: [35.87, 7.11],
  5: [35.56, 6.19], 6: [36.75, 5.06], 7: [36.37, 2.83], 8: [36.90, 3.97],
  9: [36.72, 5.08], 10: [36.83, 6.91], 11: [34.88, -1.31], 12: [34.68, 3.26],
  13: [32.92, 1.29], 14: [35.40, 4.74], 15: [34.38, 3.67], 16: [36.17, 4.42],
  17: [35.39, 6.17], 18: [35.69, 5.37], 19: [34.67, 0.45], 20: [35.77, 0.56],
  21: [36.62, 1.48], 22: [35.17, 1.28], 23: [34.42, 1.66], 24: [32.49, 3.66],
  25: [35.41, 4.18], 26: [34.88, 5.73], 27: [35.26, 7.32], 28: [33.38, -0.63],
  29: [36.07, 1.82], 30: [35.69, -0.64], 31: [34.74, -1.70], 32: [36.36, 2.55],
  33: [35.60, 3.17], 34: [33.50, -0.59], 35: [35.10, -1.31], 36: [36.50, 4.74],
  37: [36.38, 6.61], 38: [35.90, 6.86], 39: [36.09, 5.34], 40: [35.85, 7.12],
  41: [36.06, 4.50], 42: [36.00, 1.27], 43: [34.68, 2.10], 44: [32.63, 3.03],
  45: [35.76, 0.55], 46: [33.23, 0.86], 47: [32.93, 0.58], 48: [32.09, 1.85],
  49: [33.80, 1.03], 50: [31.75, -2.22], 51: [31.63, -4.09], 52: [28.97, -1.06],
  53: [32.76, 0.57], 54: [33.07, 0.79], 55: [34.07, -1.31], 56: [32.55, -1.25],
  57: [33.36, -0.63], 58: [27.40, -1.81],
};

const fmtNum = (n: number | null | undefined) => n ? Number(n).toLocaleString() : '0';
const fmtCurr = (n: number | null | undefined) => n ? `${Number(n).toLocaleString()} دج` : '0 دج';
const fmtPct = (n: number | null | undefined) => n ? `${Number(n).toFixed(1)}%` : '0%';

const STATUS_MAP: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', in_delivery: 'قيد التوصيل',
  delivered: 'تم التوصيل', cancelled: 'ملغي', declined: 'مرفوض',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#22c55e', in_delivery: '#3b82f6',
  delivered: '#10b981', cancelled: '#ef4444', declined: '#ef4444',
};

export default function MarketingAnalytics() {
  const [days, setDays] = useState('30');

  const { data: omni, isLoading: l1 } = useQuery<any>({
    queryKey: ['omni-overview', days],
    queryFn: () => apiFetch<any>(`/api/pixels/omni/overview?days=${days}`),
  });
  const { data: cust, isLoading: l2 } = useQuery<any>({
    queryKey: ['omni-customers', days],
    queryFn: () => apiFetch<any>(`/api/pixels/omni/customers?days=${days}`),
  });

  const ov = omni?.overview;
  const wilayas = cust?.wilayaBreakdown || [];
  const ordersByDay = cust?.ordersByDay || [];
  const statuses = omni?.statusBreakdown || [];

  const chartData = useMemo(() =>
    ordersByDay.map((d: any) => ({ date: d.date, revenue: Number(d.revenue) || 0 })),
    [ordersByDay]
  );

  const topWilayas = useMemo(() => wilayas.slice(0, 6), [wilayas]);
  const wilayaMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const w of wilayas) m.set(w.wilayaId, w);
    return m;
  }, [wilayas]);
  const maxOrders = topWilayas.length ? Math.max(...topWilayas.map((w: any) => w.orders)) : 1;

  const statusData = useMemo(() =>
    statuses.filter((s: any) => s.count > 0).map((s: any) => ({
      name: STATUS_MAP[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || '#6b7280',
    })), [statuses]
  );

  const deliveryRate = ov ? ((ov.deliveredOrders / ov.totalOrders) * 100) : null;
  const returnRate = ov && (ov.deliveredOrders + ov.returnedOrders) > 0
    ? ((ov.returnedOrders / (ov.deliveredOrders + ov.returnedOrders)) * 100) : null;

  const project = (lat: number, lng: number, w: number, h: number): [number, number] => [
    ((lng + 9) / 13) * w, ((37.5 - lat) / 12) * h,
  ];

  const [hoveredWilaya, setHoveredWilaya] = useState<any>(null);

  const loading = l1 || l2;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-5 space-y-4" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">لوحة التحليلات</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ملخص أداء متجرك</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[110px] h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="h-7 w-7 animate-spin border-[3px] border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : !ov ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <svg className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">لا توجد بيانات بعد</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">ستظهر التحليلات بمجرد بدء وصول الطلبات</p>
        </div>
      ) : (
        <>
          {/* ── Row 1: KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm shadow-blue-500/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">الإيرادات</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{fmtCurr(ov.realizedRevenue)}</p>
              {ov.adSpend ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">صافي: {fmtCurr(ov.realizedRevenue - ov.adSpend)}</p> : null}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">صافي الربح</span>
              </div>
              <p className={`text-xl font-extrabold ${ov.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{fmtCurr(ov.netProfit)}</p>
              {ov.realizedRevenue > 0 ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">هامش: {fmtPct((ov.netProfit / ov.realizedRevenue) * 100)}</p> : null}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm shadow-violet-500/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">الطلبات</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{fmtNum(ov.totalOrders)}</p>
              {deliveryRate !== null ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtPct(deliveryRate)} تم التوصيل</p> : null}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-sm shadow-rose-500/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">نسبة الإرجاع</span>
              </div>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{returnRate !== null ? fmtPct(returnRate) : '—'}</p>
              {ov.returnedOrders > 0 ? <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">{fmtNum(ov.returnedOrders)} طلب مرجّع</p> : null}
            </div>
          </div>

          {/* ── Row 2: Revenue Chart + Delivery Status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">الإيرادات اليومية</span>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(d: string) => new Date(d).toLocaleDateString('ar', { month: 'short', day: 'numeric' })}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={50}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [fmtCurr(value), 'الإيرادات']}
                      labelFormatter={(d: string) => new Date(d).toLocaleDateString('ar', { weekday: 'short', month: 'short', day: 'numeric' })} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rg)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-xs text-slate-400">لا توجد بيانات</div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
                  <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">حالة الطلبات</span>
              </div>
              {statusData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value" stroke="none">
                        {statusData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} formatter={(v: number, n: string) => [fmtNum(v), n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1 w-full">
                    {statusData.map((s: any) => (
                      <div key={s.name} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] font-medium text-slate-500 truncate">{s.name}</span>
                        <span className="text-[10px] font-bold text-slate-900 dark:text-white mr-auto">{fmtNum(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-xs text-slate-400">لا توجد بيانات</div>
              )}
            </div>
          </div>

          {/* ── Row 3: Algeria Map ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">خريطة الطلبات حسب الولايات</span>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Map */}
              <div className="flex-1 relative">
                <svg viewBox="0 0 400 500" className="w-full max-w-[400px] mx-auto h-auto">
                  <path d="M 48 30 L 140 15 L 220 10 L 300 20 L 350 40 L 380 80 L 390 140 L 385 200 L 370 260 L 340 300 L 300 340 L 260 370 L 220 390 L 180 400 L 140 395 L 100 380 L 60 350 L 30 310 L 15 260 L 10 200 L 15 140 L 25 80 Z"
                    fill="var(--muted)" opacity={0.25} stroke="var(--border)" strokeWidth={1} />
                  {Object.entries(WILAYA_COORDS).map(([id, [lat, lng]]) => {
                    const w = wilayaMap.get(Number(id));
                    const orders = w?.orders || 0;
                    const intensity = orders > 0 ? Math.min(orders / maxOrders, 1) : 0;
                    const r = orders > 0 ? 4 + intensity * 8 : 3;
                    const [cx, cy] = project(lat, lng, 400, 500);
                    const isHovered = hoveredWilaya?.wilayaId === Number(id);
                    return (
                      <g key={id} className="cursor-pointer" onMouseEnter={() => setHoveredWilaya(w)} onMouseLeave={() => setHoveredWilaya(null)}>
                        {orders > 0 && <circle cx={cx} cy={cy} r={r + 4} fill={`rgba(59, 130, 246, ${0.15 + intensity * 0.2})`} className="transition-all" />}
                        <circle cx={cx} cy={cy} r={isHovered ? r + 2 : r}
                          fill={orders > 0 ? `rgba(59, 130, 246, ${0.4 + intensity * 0.6})` : '#94a3b8'}
                          opacity={orders > 0 ? 1 : 0.3}
                          stroke={isHovered ? '#3b82f6' : 'transparent'} strokeWidth={isHovered ? 2 : 0} />
                        {orders > 5 && (
                          <text x={cx} y={cy - r - 4} textAnchor="middle" className="fill-slate-900 dark:fill-white text-[7px] font-bold pointer-events-none">{orders}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                {/* Tooltip */}
                {hoveredWilaya && (
                  <div className="absolute top-2 left-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg z-10 min-w-[150px]">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{hoveredWilaya.wilayaName}</p>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">الطلبات</span><span className="font-bold">{fmtNum(hoveredWilaya.orders)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">الإيرادات</span><span className="font-bold">{fmtCurr(hoveredWilaya.revenue)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">العملاء</span><span className="font-bold">{fmtNum(hoveredWilaya.customers)}</span></div>
                    </div>
                  </div>
                )}
              </div>
              {/* Top wilayas list */}
              <div className="lg:w-72 space-y-2">
                {topWilayas.map((w: any, i: number) => (
                  <div key={w.wilayaId} className="flex items-center gap-2" onMouseEnter={() => setHoveredWilaya(w)} onMouseLeave={() => setHoveredWilaya(null)}>
                    <span className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{w.wilayaName}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mr-2">{fmtNum(w.orders)}</span>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-0.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                          style={{ width: `${(w.orders / maxOrders) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
