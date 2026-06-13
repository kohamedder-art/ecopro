import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

// ─── Algeria Wilaya Coordinates (lat, lng) ──────────────────
const WILAYA_COORDS: Record<number, [number, number]> = {
  1:[27.87,-0.29],2:[36.17,1.33],3:[33.80,2.88],4:[35.87,7.11],5:[35.55,6.17],
  6:[36.75,5.08],7:[34.85,5.73],8:[31.62,-2.22],9:[36.47,2.83],10:[36.38,3.90],
  11:[22.79,5.52],12:[35.40,8.12],13:[34.88,-1.31],14:[35.38,1.32],15:[36.71,4.05],
  16:[36.75,3.06],17:[34.67,3.25],18:[36.82,5.77],19:[36.19,5.41],20:[34.83,0.15],
  21:[36.88,6.91],22:[35.19,-0.63],23:[36.90,7.77],24:[36.46,7.43],25:[36.37,6.61],
  26:[36.27,2.75],27:[35.93,0.09],28:[35.70,4.54],29:[35.40,0.14],30:[31.95,5.33],
  31:[35.69,-0.63],32:[33.68,1.02],33:[26.50,8.48],34:[36.07,4.76],35:[36.75,3.48],
  36:[36.77,8.31],37:[27.67,-8.14],38:[35.61,1.81],39:[33.35,6.85],40:[35.44,7.14],
  41:[36.29,7.95],42:[36.59,2.45],43:[36.45,6.26],44:[36.26,1.97],45:[33.26,-0.31],
  46:[35.30,-1.14],47:[32.49,3.67],48:[35.73,0.55],49:[33.95,5.93],50:[30.08,2.88],
  51:[34.42,5.07],52:[19.57,-0.30],53:[30.13,-2.16],54:[29.26,0.24],55:[33.10,6.06],
  56:[24.55,9.48],57:[27.19,2.46],58:[19.57,5.77],
};

// ─── Projection: lat/lng → SVG x/y ─────────────────────────
// Bounds from Natural Earth GeoJSON: lat [19.06, 37.12], lng [-8.68, 12.00]
// SVG path uses same bounds with 20px padding on 400×480 viewport
const project = (lat: number, lng: number): [number, number] => {
  const minLng = -8.68, maxLng = 12.00, minLat = 19.06, maxLat = 37.12;
  return [
    ((lng - minLng) / (maxLng - minLng)) * 360 + 20,
    ((maxLat - lat) / (maxLat - minLat)) * 440 + 20,
  ];
};

// ─── Helpers ─────────────────────────────────────────────────
const fmtNum = (n: number | null | undefined) => n != null ? Math.round(n).toLocaleString('ar-DZ') : '0';
const fmtCurr = (n: number | null | undefined) => n != null ? `${Math.round(n).toLocaleString('ar-DZ')} دج` : '0 دج';
const fmtPct = (n: number | null | undefined) => n != null ? `${Math.round(n)}%` : '—';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar', { month: 'short', day: 'numeric' });

const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد المعالجة',
  shipped: 'تم الشحن', in_delivery: 'قيد التوصيل', delivered: 'تم التوصيل',
  completed: 'مكتمل', cancelled: 'ملغي', declined: 'مرفوض', returned: 'مرجّع', refunded: 'مسترجع', fake: 'مزيف',
};
const STATUS_COLORS: Record<string, string> = {
  pending:'#f59e0b', confirmed:'#22c55e', processing:'#6366f1', shipped:'#3b82f6',
  in_delivery:'#8b5cf6', delivered:'#10b981', completed:'#10b981',
  cancelled:'#ef4444', declined:'#ef4444', returned:'#f97316', refunded:'#f97316', fake:'#6b7280',
};

const TRAFFIC_AR: Record<string, string> = {
  facebook:'فيسبوك', instagram:'إنستغرام', google:'غوغل', tiktok:'تيك توك',
  direct:'مباشر', organic:'عضوي', email:'بريد إلكتروني', referral:'إحالة', unknown:'غير معروف',
  fb:'فيسبوك', ig:'إنستغرام', an:'غير معروف',
};

// ─── Algeria SVG Outline (from Natural Earth GeoJSON) ──────
const ALGERIA_OUTLINE = `M 20 256.9 L 20.3 252.1 L 20.3 250.5 L 20.2 221.6 L 48.3 203.7 L 65.7 200
  L 79.9 193.4 L 86.6 181.2 L 106.9 171.6 L 107.7 153.5 L 117.7 151.4 L 125.6
  142.4 L 148.4 138.3 L 151.6 128.8 L 147 123.6 L 141 97.9 L 139.9 83.1 L 133.4
  67.5 L 150.1 54.2 L 168.9 50 L 179.9 39.9 L 196.7 32.5 L 226.2 28.1 L 255 26.2
  L 263.7 29.8 L 280.1 20.2 L 298.7 20 L 305.8 25.7 L 317.7 24.2 L 314.2 36.7 L
  316.9 59.9 L 312.8 80 L 302.1 93.6 L 303.6 111.9 L 317.9 126.5 L 318 132.4 L
  328.8 142.2 L 336.2 185.9 L 341.8 207.4 L 342.8 218.8 L 339.7 238.6 L 341
  249.7 L 338.7 263.1 L 340.3 278.4 L 333.4 288.6 L 343.6 306.3 L 344.3 316.8 L
  350.5 330.3 L 358.6 325.9 L 372.4 337.2 L 380 352.5 L 320.4 398.9 L 270 446.8
  L 245.4 457.6 L 226.1 460 L 225.9 444.5 L 217.9 440.5 L 207 433.6 L 202.9
  422.2 L 144.2 369 L 85.5 315.8 L 20 256.9 Z`;

// ─── Component ──────────────────────────────────────────────
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
  const { data: prodData, isLoading: l3 } = useQuery<any>({
    queryKey: ['omni-products', days],
    queryFn: () => apiFetch<any>(`/api/pixels/omni/products?days=${days}`),
  });

  const ov = omni?.overview;
  const wilayas = cust?.wilayaBreakdown || [];
  const ordersByDay = cust?.ordersByDay || [];
  const statuses = omni?.statusBreakdown || [];
  const sources = omni?.sourceBreakdown || [];
  const nvr = cust?.newVsReturning || {};
  const devices = cust?.deviceBreakdown || [];
  const products = prodData?.products || [];
  const funnel = omni?.funnel || [];

  const loading = l1 || l2 || l3;

  // ── Derived data ──
  const deliveryRate = ov ? (ov.deliveredOrders / Math.max(1, ov.totalOrders)) * 100 : null;
  const returnRate = ov && (ov.deliveredOrders + ov.returnedOrders) > 0
    ? (ov.returnedOrders / (ov.deliveredOrders + ov.returnedOrders)) * 100 : null;

  const chartData = useMemo(() =>
    ordersByDay.map((d: any) => ({ date: d.date, revenue: Number(d.revenue) || 0, orders: Number(d.orders) || 0 })),
    [ordersByDay]
  );

  const statusData = useMemo(() =>
    statuses.filter((s: any) => s.count > 0).map((s: any) => ({
      name: STATUS_AR[s.status] || s.status, value: s.count, color: STATUS_COLORS[s.status] || '#6b7280',
    })), [statuses]
  );

  const sourceData = useMemo(() =>
    sources.map((s: any) => ({
      name: TRAFFIC_AR[s.source] || s.source, sessions: s.sessions, purchases: s.purchases,
    })).filter((s: any) => s.sessions > 0),
    [sources]
  );

  const nvrData = useMemo(() => [
    { name: 'عملاء جدد', value: Number(nvr.newCustomers) || 0, revenue: Number(nvr.newRevenue) || 0, fill: '#6366f1' },
    { name: 'عملاء عائدون', value: Number(nvr.returningCustomers) || 0, revenue: Number(nvr.returningRevenue) || 0, fill: '#10b981' },
  ], [nvr]);

  const topWilayas = useMemo(() => wilayas, [wilayas]);
  const wilayaMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const w of wilayas) m.set(w.wilayaId, w);
    return m;
  }, [wilayas]);
  const maxOrders = topWilayas.length ? Math.max(...topWilayas.map((w: any) => w.orders)) : 1;

  const [hoveredWilaya, setHoveredWilaya] = useState<any>(null);

  // ── Loading / Empty ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">جاري تحميل التحليلات...</span>
        </div>
      </div>
    );
  }

  if (!ov) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <p className="text-lg font-bold text-foreground mb-1">لا توجد بيانات بعد</p>
        <p className="text-sm text-muted-foreground max-w-xs">ستظهر التحليلات بمجرد وصول الطلبات لمتجرك</p>
      </div>
    );
  }

  // ── KPI Cards Data ──
  const kpis = [
    {
      label: 'الإيرادات', value: fmtCurr(ov.realizedRevenue), icon: '💰',
      gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20',
      sub: ov.adSpend > 0 ? `صافي: ${fmtCurr(ov.netProfit)}` : null,
      subColor: ov.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
    },
    {
      label: 'صافي الربح', value: fmtCurr(ov.netProfit), icon: '📈',
      gradient: ov.netProfit >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600',
      shadow: ov.netProfit >= 0 ? 'shadow-emerald-500/20' : 'shadow-red-500/20',
      valueColor: ov.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
      sub: ov.realizedRevenue > 0 ? `هامش: ${fmtPct((ov.netProfit / ov.realizedRevenue) * 100)}` : null,
    },
    {
      label: 'الطلبات', value: fmtNum(ov.totalOrders), icon: '📦',
      gradient: 'from-violet-500 to-violet-600', shadow: 'shadow-violet-500/20',
      sub: deliveryRate !== null ? `توصيل: ${fmtPct(deliveryRate)}` : null,
      subColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'نسبة التوصيل', value: deliveryRate !== null ? fmtPct(deliveryRate) : '—', icon: '🚚',
      gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20',
      sub: ov.deliveredOrders > 0 ? `${fmtNum(ov.deliveredOrders)} طلب تم توصيله` : null,
    },
    {
      label: 'متوسط الطلب', value: fmtCurr(cust?.averageOrderValue), icon: '🧾',
      gradient: 'from-cyan-500 to-cyan-600', shadow: 'shadow-cyan-500/20',
      sub: cust?.totalCustomers ? `${fmtNum(cust.totalCustomers)} عميل` : null,
    },
    {
      label: 'نسبة الإرجاع', value: returnRate !== null ? fmtPct(returnRate) : '—', icon: '↩️',
      gradient: returnRate !== null && returnRate > 10 ? 'from-red-500 to-red-600' : 'from-teal-500 to-teal-600',
      shadow: returnRate !== null && returnRate > 10 ? 'shadow-red-500/20' : 'shadow-teal-500/20',
      valueColor: returnRate !== null && returnRate > 10 ? 'text-red-500 dark:text-red-400' : undefined,
      sub: ov.returnedOrders > 0 ? `${fmtNum(ov.returnedOrders)} طلب مرجّع` : null,
      subColor: 'text-red-500 dark:text-red-400',
    },
  ];

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <span className="text-white text-lg">📊</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              التحليلات
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">نظرة شاملة على أداء متجرك</p>
          </div>
        </div>
        <div className="bg-muted/40 p-1 rounded-lg border border-border/40">
          {['7','30','90'].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 h-7 rounded-md text-xs font-bold transition-all duration-200 ${
                days === d
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              }`}>
              {d === '7' ? '7 أيام' : d === '30' ? '30 يوم' : '90 يوم'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpis.map((k, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-3 hover:border-primary/30 transition-all duration-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow ${k.shadow}`}>
                <span className="text-sm">{k.icon}</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{k.label}</span>
            </div>
            <p className={`text-lg font-black tabular-nums leading-none ${k.valueColor || 'text-foreground'}`}>{k.value}</p>
            {k.sub && <p className={`text-[10px] mt-1 font-medium ${k.subColor || 'text-muted-foreground'}`}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Row 2: Revenue Chart + Order Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-primary to-accent" />
            <span className="text-sm font-bold text-foreground">الإيرادات اليومية</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={fmtDate} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={55}
                  tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                  axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [fmtCurr(value), 'الإيرادات']}
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString('ar', { weekday: 'short', month: 'short', day: 'numeric' })} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">لا توجد بيانات</div>
          )}
        </div>

        {/* Order Status Donut */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
            <span className="text-sm font-bold text-foreground">حالة الطلبات</span>
          </div>
          {statusData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">
                    {statusData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    formatter={(v: number, n: string) => [fmtNum(v), n]} />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-indigo-500" />
                <span className="text-[10px] font-semibold text-muted-foreground">زيارات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-emerald-500" />
                <span className="text-[10px] font-semibold text-muted-foreground">مشتريات</span>
              </div>
            </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 w-full">
                {statusData.map((s: any) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] font-medium text-muted-foreground truncate">{s.name}</span>
                    <span className="text-[10px] font-bold text-foreground tabular-nums mr-auto">{fmtNum(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">لا توجد بيانات</div>
          )}
        </div>
      </div>

      {/* ── Row 3: Algeria Map + Top Wilayas ── */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
          <span className="text-sm font-bold text-foreground">التوزيع الجغرافي — الولايات</span>
        </div>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Map */}
          <div className="flex-1 relative">
            <svg viewBox="0 0 400 480" className="w-full max-w-[400px] mx-auto h-auto">
              <path d={ALGERIA_OUTLINE} fill="hsl(var(--muted))" fillOpacity={0.5} stroke="hsl(var(--border))" strokeWidth={1.5} />
              {Object.entries(WILAYA_COORDS).map(([id, [lat, lng]]) => {
                const w = wilayaMap.get(Number(id));
                const orders = w?.orders || 0;
                if (orders === 0) return null;
                const intensity = Math.min(orders / maxOrders, 1);
                const r = 4 + intensity * 8;
                const [cx, cy] = project(lat, lng);
                const isHovered = hoveredWilaya?.wilayaId === Number(id);
                return (
                  <g key={id} className="cursor-pointer"
                    onMouseEnter={() => w && setHoveredWilaya(w)}
                    onMouseLeave={() => setHoveredWilaya(null)}>
                    <circle cx={cx} cy={cy} r={r + 4}
                      fill="hsl(var(--foreground))"
                      fillOpacity={0.08 + intensity * 0.12}
                      className="transition-all" />
                    <circle cx={cx} cy={cy} r={isHovered ? r + 2 : r}
                      fill="hsl(var(--foreground))"
                      fillOpacity={0.5 + intensity * 0.5}
                      stroke={isHovered ? 'hsl(var(--foreground))' : 'transparent'} strokeWidth={isHovered ? 2 : 0}
                      className="transition-all" />
                    {orders > 3 && (
                      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                        fill="hsl(var(--background))" className="text-[7px] font-bold pointer-events-none">{orders}</text>
                    )}
                  </g>
                );
              })}
            </svg>
            {hoveredWilaya && (
              <div className="absolute top-2 left-2 bg-card border border-border rounded-xl p-3 shadow-lg z-10 min-w-[150px]">
                <p className="text-sm font-bold text-foreground">{hoveredWilaya.wilayaName}</p>
                <div className="mt-1.5 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">الطلبات</span><span className="font-bold">{fmtNum(hoveredWilaya.orders)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">الإيرادات</span><span className="font-bold">{fmtCurr(hoveredWilaya.revenue)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">العملاء</span><span className="font-bold">{fmtNum(hoveredWilaya.customers)}</span></div>
                </div>
              </div>
            )}
          </div>
          {/* Top wilayas list */}
          <div className="lg:w-72 space-y-2 max-h-[320px] overflow-y-auto">
            {topWilayas.length > 0 ? topWilayas.map((w: any, i: number) => (
              <div key={w.wilayaId} className="flex items-center gap-2"
                onMouseEnter={() => setHoveredWilaya(w)} onMouseLeave={() => setHoveredWilaya(null)}>
                <span className="w-5 h-5 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate">{w.wilayaName}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums mr-2">{fmtNum(w.orders)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                      style={{ width: `${(w.orders / maxOrders) * 100}%` }} />
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات جغرافية</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: New vs Returning + Traffic Sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* New vs Returning */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
            <span className="text-sm font-bold text-foreground">العملاء الجدد vs العائدون</span>
          </div>
          {nvrData.some(n => n.value > 0) ? (
            <div className="space-y-3">
              {nvrData.map((n, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: n.fill }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{n.name}</span>
                      <span className="text-xs font-black text-foreground tabular-nums">{fmtNum(n.value)} عميل</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${cust?.totalCustomers ? (n.value / cust.totalCustomers) * 100 : 0}%`, backgroundColor: n.fill }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">الإيرادات: {fmtCurr(n.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات</p>
          )}
        </div>

        {/* Traffic Sources */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-pink-500 to-rose-500" />
            <span className="text-sm font-bold text-foreground">مصادر الزيارات</span>
          </div>
          {sourceData.length > 0 ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={Math.max(200, sourceData.length * 36)}>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} width={80} axisLine={false} tickLine={false} textAnchor="end" />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    formatter={(v: number, n: string) => [fmtNum(v), n === 'sessions' ? 'زيارات' : 'مشتريات']} />
                  <Bar dataKey="sessions" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10} name="sessions" />
                  <Bar dataKey="purchases" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} name="purchases" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* ── Row 5: Top Products ── */}
      {products.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
            <span className="text-sm font-bold text-foreground">المنتجات والأرباح</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">#</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">المنتج</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">الطلبات</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">الإيرادات</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">التكلفة/طلب</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">الربح/طلب</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">الربح الكلي</th>
                  <th className="text-right py-2 px-2 font-bold text-muted-foreground">ROI</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map((p: any, i: number) => (
                  <tr key={p.productId} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-2 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 font-bold text-foreground max-w-[160px] truncate">{p.title}</td>
                    <td className="py-2 px-2 font-bold text-foreground tabular-nums">{fmtNum(p.totalOrders)}</td>
                    <td className="py-2 px-2 font-bold text-foreground tabular-nums">{fmtCurr(p.revenue)}</td>
                    <td className="py-2 px-2 font-bold text-muted-foreground tabular-nums">{fmtCurr(p.totalCostPerOrder)}</td>
                    <td className="py-2 px-2">
                      <span className={`font-bold tabular-nums ${p.netProfitPerOrder >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {fmtCurr(p.netProfitPerOrder)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`font-bold tabular-nums ${p.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {fmtCurr(p.totalProfit)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.roi >= 50 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : p.roi >= 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{fmtPct(p.roi)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Product cost breakdown legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span>تكلفة الطلب = شراء + تغليف + مناولة + توصيل + مركز اتصال + أخرى + إعلانات</span>
          </div>
        </div>
      )}

      {/* ── Row 6: Device Breakdown ── */}
      {devices.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
            <span className="text-sm font-bold text-foreground">الأجهزة</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {devices.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                <span className="text-lg">{d.device === 'mobile' ? '📱' : d.device === 'desktop' ? '🖥️' : '📟'}</span>
                <div>
                  <p className="text-xs font-bold text-foreground">{d.device === 'mobile' ? 'هاتف' : d.device === 'desktop' ? 'كمبيوتر' : d.device === 'tablet' ? 'تابلت' : d.device}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtNum(d.sessions)} جلسة — {fmtPct(d.share)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
