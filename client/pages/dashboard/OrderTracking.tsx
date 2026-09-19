import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Loader2, Search, RefreshCw, Package, MapPin, Truck, CheckCircle2, AlertCircle, Clock, XCircle, Building2, TrendingUp } from "lucide-react";

// Owner pipeline: 4 steps. OFD folds into "in_transit" (couriers flag it for
// days — false precision). Failed is its own bucket; returned/cancelled → attention.
const TRACKING_STEPS = [
  { key: "new",              labelKey: "tracking.stepNew",            color: "#0d9488" },
  { key: "confirmed",        labelKey: "tracking.stepConfirmed",      color: "#1c7ed6" },
  { key: "in_transit",       labelKey: "tracking.stepInTransit",      color: "#d9480f" },
  { key: "delivered",        labelKey: "tracking.stepDelivered",       color: "#2b8a3e" },
];

const STATUS_TO_STEP: Record<string, number> = {
  pending: 0, processing: 0,
  confirmed: 1, assigned: 1, picked_up: 1, shipped: 1,
  in_transit: 2, in_delivery: 2, at_warehouse: 2, at_hub: 2, ready_for_pickup: 2,
  out_for_delivery: 2, out_delivery: 2,
  delivered: 3, completed: 3,
  cancelled: -1, returned: -1, failed: -1, fake: -1, duplicate: -1, delivery_failed: -1, refunded: -1,
};

const STATUS_GROUP: Record<string, string> = {
  pending: "new", processing: "new",
  confirmed: "confirmed", assigned: "confirmed", picked_up: "confirmed", shipped: "confirmed",
  in_transit: "transit", in_delivery: "transit", at_warehouse: "transit", at_hub: "transit", ready_for_pickup: "transit",
  out_for_delivery: "transit", out_delivery: "transit",
  delivered: "done", completed: "done",
  failed: "failed",
  cancelled: "attention", returned: "attention", fake: "attention", duplicate: "attention", delivery_failed: "attention", refunded: "attention",
};

const GROUP_META: Record<string, { label: string; color: string; icon: React.ReactNode; kpiIcon: string; gradient: string; shadow: string }> = {
  new:       { label: "جديد",       color: "#0d9488", icon: <Clock className="w-3.5 h-3.5" />,          kpiIcon: "📥", gradient: "from-teal-500 to-teal-600",     shadow: "shadow-teal-500/20" },
  confirmed: { label: "مؤكد",       color: "#1c7ed6", icon: <Package className="w-3.5 h-3.5" />,        kpiIcon: "📋", gradient: "from-blue-500 to-blue-600",     shadow: "shadow-blue-500/20" },
  transit:   { label: "في الطريق",  color: "#d97706", icon: <Truck className="w-3.5 h-3.5" />,          kpiIcon: "🚚", gradient: "from-amber-500 to-orange-500",  shadow: "shadow-amber-500/20" },
  done:      { label: "تم التسليم", color: "#059669", icon: <CheckCircle2 className="w-3.5 h-3.5" />,  kpiIcon: "✅", gradient: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
  failed:    { label: "فشل",        color: "#dc2626", icon: <XCircle className="w-3.5 h-3.5" />,        kpiIcon: "❌", gradient: "from-red-500 to-red-600",         shadow: "shadow-red-500/20" },
  attention: { label: "يحتاج تدخل", color: "#d97706", icon: <AlertCircle className="w-3.5 h-3.5" />,   kpiIcon: "⚠️", gradient: "from-yellow-500 to-amber-600",   shadow: "shadow-amber-500/20" },
};

interface TrackingOrder {
  id: number; reference_id?: string;
  customer_name: string; customer_phone: string;
  product_title?: string; product_image?: string;
  total_price?: number; delivery_fee?: number;
  unit_price?: number; quantity?: number;
  status: string; delivery_status?: string;
  tracking_number?: string; delivery_company?: string;
  created_at: string; updated_at?: string;
  customer_address?: string; note?: string;
}

function timeAgo(iso: string, locale: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return locale === "ar" ? "الآن" : "now";
    if (mins < 60) return locale === "ar" ? `منذ ${mins} د` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return locale === "ar" ? `منذ ${hrs} س` : `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return locale === "ar" ? `منذ ${days} ي` : `${days}d`;
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "en-US", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function formatPrice(n: number, locale: string): string {
  return Math.round(n).toLocaleString(locale === "ar" ? "ar-DZ" : "en-US") + (locale === "ar" ? " دج" : " DA");
}

function getEffectiveStatus(order: TrackingOrder): string {
  // Owner intent wins: a manually set terminal status beats stale courier data
  const s = String(order.status || '').toLowerCase();
  if (['cancelled', 'delivered', 'completed', 'returned', 'refunded', 'failed', 'fake', 'duplicate', 'delivery_failed'].includes(s)) return s;
  return (order.tracking_number && order.delivery_status) ? order.delivery_status : order.status;
}

function ageDays(iso: string): number {
  try { return (Date.now() - new Date(iso).getTime()) / 86400000; } catch { return 0; }
}

function StepBar({ status, t, locale }: { status: string; t: (key: string) => string; locale: string }) {
  const rawStep = STATUS_TO_STEP[status] ?? 0;
  const isBad = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isRTL = locale === "ar";
  const steps = isRTL ? [...TRACKING_STEPS].reverse() : TRACKING_STEPS;
  const pct = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  return (
    <div className="w-full" dir="ltr">
      <div className="relative w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            [isRTL ? 'right' : 'left']: 0,
            [isRTL ? 'left' : 'right']: 'auto',
            background: isBad ? "#dc2626" : "linear-gradient(90deg, #34d399, #6366f1, #f97316)",
          }}
        />
      </div>
      <div className="flex items-start justify-between mt-2" style={{ direction: 'ltr' }}>
        {steps.map((step, displayIdx) => {
          const logicalIdx = isRTL ? (TRACKING_STEPS.length - 1 - displayIdx) : displayIdx;
          const done = !isBad && logicalIdx < currentStep;
          const active = !isBad && logicalIdx === currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: done ? step.color : active ? "#fff" : "hsl(var(--muted))",
                  border: active ? `2.5px solid ${step.color}` : done ? "none" : "1.5px solid hsl(var(--border))",
                  boxShadow: active ? `0 0 0 3px ${step.color}20` : "none",
                }}
              >
                {done && <svg width="8" height="8" viewBox="0 0 13 13" fill="none"><path d="M4 6.5L5.5 8L9.5 4.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                {active && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: step.color }} />}
              </div>
              <span className="w-full text-center mt-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis block"
                style={{ fontSize: '8px', fontWeight: active ? 700 : 500, color: active ? step.color : done ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order, t, locale }: { order: TrackingOrder; t: (key: string) => string; locale: string }) {
  const [copied, setCopied] = useState<'none' | 'id' | 'trk'>('none');
  const effectiveStatus = getEffectiveStatus(order);
  const group = STATUS_GROUP[effectiveStatus] || "new";
  const meta = GROUP_META[group];
  const hasCourier = !!order.tracking_number;
  const price = order.unit_price != null ? (order.unit_price * (order.quantity || 1)) : (order.total_price ?? 0);
  const stuck = (group === "new" || group === "confirmed" || group === "transit") && ageDays(order.updated_at || order.created_at) > 4;

  const handleCopy = async (text: string, type: 'id' | 'trk') => {
    try { await navigator.clipboard.writeText(text); setCopied(type); setTimeout(() => setCopied('none'), 1200); } catch {}
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 border-b border-border/50">
        <span className="text-sm font-black tabular-nums text-foreground">#{order.reference_id || order.id}</span>
        <span className="text-sm font-bold text-foreground truncate">{order.customer_name}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline tabular-nums" dir="ltr">{order.customer_phone}</span>
        {stuck && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
            🐌 عالق
          </span>
        )}
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        <span className="text-sm font-black tabular-nums text-foreground">{formatPrice(price, locale)}</span>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-muted">
              {order.product_image ? <img src={order.product_image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex flex-col items-start gap-1 shrink-0">
              {hasCourier ? (
                <button onClick={() => handleCopy(order.tracking_number!, 'trk')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  🚚 {order.delivery_company || 'شركة توصيل'}
                  {copied === 'trk' && <span className="text-emerald-500 ml-1">✓</span>}
                </button>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">بدون تتبع</span>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo(order.updated_at || order.created_at, locale)}</span>
            </div>
          </div>
          <div className="w-full"><StepBar status={effectiveStatus} t={t} locale={locale} /></div>
        </div>
      </div>
    </div>
  );
}

export default function OrderTracking() {
  const { t, locale } = useTranslation();
  const isRTL = locale === "ar";
  const [orders, setOrders] = useState<TrackingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: "99999" });
      const res = await fetch(`/api/client/orders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      const list: TrackingOrder[] = (data.orders || data || []).map((o: any) => ({
        id: o.id, reference_id: o.reference_id || o.order_number,
        customer_name: o.customer_name || "—", customer_phone: o.customer_phone || "—",
        product_title: o.product_title || o.product_name,
        product_image: (Array.isArray(o.product_images) ? o.product_images[0] : null) || o.product_image || o.product_thumbnail,
        total_price: o.total_price, delivery_fee: o.delivery_fee, unit_price: o.unit_price, quantity: o.quantity,
        status: o.status || "pending", delivery_status: o.delivery_status || null,
        tracking_number: o.tracking_number || null, delivery_company: o.delivery_company_name || o.company_name || null,
        created_at: o.created_at, updated_at: o.updated_at, customer_address: o.customer_address, note: o.note,
      }));
      const tracked = list.filter(o => o.status === 'in_delivery' || o.status === 'at_delivery');
      setOrders(tracked);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──
  const groups = useMemo(() => orders.map(o => STATUS_GROUP[getEffectiveStatus(o)] || "new"), [orders]);

  const liveCounts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, new: 0, confirmed: 0, transit: 0, done: 0, failed: 0, attention: 0 };
    for (const g of groups) if (c[g] !== undefined) c[g]++;
    return c;
  }, [groups, orders.length]);

  const deliveryRate = orders.length ? (liveCounts.done / orders.length) * 100 : null;

  const funnel = useMemo(() => {
    const total = Math.max(1, orders.length);
    const steps = [
      { key: "new", count: liveCounts.new + liveCounts.confirmed + liveCounts.transit + liveCounts.done },
      { key: "confirmed", count: liveCounts.confirmed + liveCounts.transit + liveCounts.done },
      { key: "transit", count: liveCounts.transit + liveCounts.done },
      { key: "done", count: liveCounts.done },
    ];
    return steps.map(s => ({ ...s, meta: GROUP_META[s.key], pct: Math.round((s.count / total) * 100) }));
  }, [liveCounts, orders.length]);

  const couriers = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.delivery_company || "بدون شركة", (m.get(o.delivery_company || "بدون شركة") || 0) + 1);
    const arr = [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    const max = arr.length ? arr[0].count : 1;
    return arr.map(c => ({ ...c, pct: Math.round((c.count / max) * 100) }));
  }, [orders]);

  const stuckCount = useMemo(() => orders.filter(o => {
    const g = STATUS_GROUP[getEffectiveStatus(o)] || "new";
    return (g === "new" || g === "confirmed" || g === "transit") && ageDays(o.updated_at || o.created_at) > 4;
  }).length, [orders]);

  const PIPELINE_GROUPS = ["all", "new", "confirmed", "transit", "done", "failed", "attention"] as const;

  const filtered = orders.filter(o => {
    const g = STATUS_GROUP[getEffectiveStatus(o)] || "new";
    const matchGroup = groupFilter === "all" || g === groupFilter;
    const q = search.toLowerCase();
    return matchGroup && (!q || String(o.reference_id || o.id).includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q));
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">جاري تحميل التتبع...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir={isRTL ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t("tracking.title")}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">{t("tracking.subtitle")}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("tracking.refresh")}
        </button>
      </div>

      {/* ── Row 1: KPI Cards (analytics style) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(["new","confirmed","transit","done","failed","attention"] as const).map(g => {
          const meta = GROUP_META[g];
          const count = liveCounts[g] || 0;
          const active = groupFilter === g;
          const share = orders.length ? Math.round((count / orders.length) * 100) : 0;
          const valueColor = g === "failed" ? "text-red-500 dark:text-red-400" : g === "attention" ? "text-amber-600 dark:text-amber-400" : g === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
          return (
            <button key={g} onClick={() => { setGroupFilter(active ? "all" : g); setPage(1); }}
              className={`bg-card rounded-xl border border-border p-3 text-start transition-all duration-200 shadow-sm hover:border-primary/30 ${active ? 'ring-2' : ''}`}
              style={active ? { borderColor: meta.color } : undefined}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow ${meta.shadow}`}>
                  <span className="text-sm">{meta.kpiIcon}</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground tracking-wide">{meta.label}</span>
              </div>
              <p className={`text-lg font-black tabular-nums leading-none ${valueColor}`}>{count}</p>
              <p className="text-[11px] mt-1 font-medium text-muted-foreground">{share}% من الكل</p>
            </button>
          );
        })}
      </div>

      {/* ── Spotlight: needs action ── */}
      {(liveCounts.failed > 0 || liveCounts.attention > 0 || stuckCount > 0) && (
        <div className="bg-gradient-to-l from-red-500/10 via-amber-500/10 to-transparent rounded-xl border border-red-500/20 p-3 flex flex-wrap items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow shadow-red-500/20 shrink-0">
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs font-bold text-foreground flex-1 min-w-[180px]">
            {liveCounts.failed > 0 && <span className="text-red-500">{liveCounts.failed} فاشلة</span>}
            {liveCounts.failed > 0 && (liveCounts.attention > 0 || stuckCount > 0) && <span className="text-muted-foreground"> • </span>}
            {liveCounts.attention > 0 && <span className="text-amber-600">{liveCounts.attention} تحتاج تدخل</span>}
            {liveCounts.attention > 0 && stuckCount > 0 && <span className="text-muted-foreground"> • </span>}
            {stuckCount > 0 && <span className="text-amber-600">{stuckCount} عالقة منذ +4 أيام</span>}
          </p>
          <button onClick={() => { setGroupFilter(liveCounts.failed > 0 ? "failed" : liveCounts.attention > 0 ? "attention" : "transit"); setPage(1); }}
            className="px-3 h-7 rounded-lg text-xs font-bold bg-red-500 text-white shadow-sm shadow-red-500/30 hover:bg-red-600 transition-colors">
            عرض
          </button>
        </div>
      )}

      {/* ── Row 2: Funnel + Couriers ── */}
      {orders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Delivery funnel */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-primary to-accent" />
                <span className="text-sm font-bold text-foreground">قمع التوصيل</span>
              </div>
              {deliveryRate !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  نسبة التوصيل {Math.round(deliveryRate)}%
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {funnel.map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground w-16 shrink-0">{s.meta.label}</span>
                  <div className="flex-1 h-6 rounded-lg bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-lg transition-all duration-700 flex items-center justify-end px-2"
                      style={{ width: `${Math.max(s.pct, 4)}%`, background: `linear-gradient(90deg, ${s.meta.color}55, ${s.meta.color})` }}>
                      <span className="text-[10px] font-black text-white tabular-nums">{s.count}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-muted-foreground w-9 text-end shrink-0">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Courier leaderboard */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-primary to-accent" />
              <span className="text-sm font-bold text-foreground">شركات التوصيل</span>
            </div>
            <div className="space-y-2.5">
              {couriers.map(c => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-foreground truncate">{c.name}</span>
                      <span className="text-[11px] font-black tabular-nums text-muted-foreground">{c.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {couriers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد شركات بعد</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("tracking.searchPlaceholder")}
            className="w-full pl-9 pr-4 h-10 text-sm rounded-xl border border-border bg-muted/30 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-xl border border-border/40">
          {PIPELINE_GROUPS.map(g => {
            const meta = g === "all" ? null : GROUP_META[g];
            const active = groupFilter === g;
            const count = liveCounts[g] || 0;
            return (
              <button key={g} onClick={() => { setGroupFilter(g); setPage(1); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                {g === "all" ? t("tracking.all") : meta!.label}
                <span className={active ? 'opacity-80' : 'opacity-50'}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Orders ── */}
      {error ? (
        <div className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">{t("tracking.loadFailed")}</p>
            <p className="text-xs mt-1 text-red-500/70">{error}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground">{t("tracking.noOrders")}</p>
          <p className="text-xs text-muted-foreground">{search ? t("tracking.noResults") : t("tracking.noFilterResults")}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("tracking.showing")} <span className="font-bold text-foreground">{paginated.length}</span> {t("tracking.of")} <span className="font-bold text-foreground">{filtered.length}</span> {t("tracking.orders")}
          </p>
          <div className="space-y-2">
            {paginated.map(order => <OrderCard key={order.id} order={order} t={t} locale={locale} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-20 disabled:pointer-events-none">
                {isRTL ? '→' : '←'} {t("tracking.prev")}
              </button>
              <span className="text-sm font-bold text-muted-foreground px-2">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-20 disabled:pointer-events-none">
                {t("tracking.next")} {isRTL ? '←' : '→'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
