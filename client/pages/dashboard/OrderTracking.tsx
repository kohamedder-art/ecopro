import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { Loader2, Search, RefreshCw, Package, MapPin, Truck, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const TRACKING_STEPS = [
  { key: "confirmed",      labelKey: "tracking.stepConfirmed",    color: "#2b8a3e" },
  { key: "picked_up",      labelKey: "tracking.stepPickedUp",    color: "#1c7ed6" },
  { key: "in_transit",     labelKey: "tracking.stepInTransit",   color: "#d9480f" },
  { key: "at_hub",         labelKey: "tracking.stepAtHub",       color: "#9c36b5" },
  { key: "out_for_delivery", labelKey: "tracking.stepOutForDelivery", color: "#c2255c" },
  { key: "delivered",      labelKey: "tracking.stepDelivered",   color: "#2b8a3e" },
];

const STATUS_TO_STEP: Record<string, number> = {
  pending: 0, confirmed: 0, processing: 0,
  shipped: 1, in_delivery: 1, in_transit: 2,
  at_warehouse: 3, out_for_delivery: 4, out_delivery: 4,
  delivered: 5, completed: 5,
  assigned: 0, picked_up: 1, ready_for_pickup: 3, at_hub: 3,
  cancelled: -1, returned: -1, failed: -1, fake: -1, duplicate: -1,
};

const STATUS_GROUP: Record<string, string> = {
  pending: "pending", confirmed: "pending", processing: "pending",
  shipped: "transit", in_delivery: "transit", in_transit: "transit",
  at_warehouse: "hub", out_for_delivery: "ofd", out_delivery: "ofd",
  delivered: "done", completed: "done",
  assigned: "transit", picked_up: "transit", ready_for_pickup: "hub", at_hub: "hub",
  cancelled: "bad", returned: "bad", failed: "bad", fake: "bad", duplicate: "bad",
};

const GROUP_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد الانتظار", color: "#0d9488", icon: <Clock className="w-3.5 h-3.5" /> },
  transit: { label: "في الطريق",    color: "#d97706", icon: <Truck className="w-3.5 h-3.5" /> },
  hub:     { label: "في المحطة",    color: "#7c3aed", icon: <MapPin className="w-3.5 h-3.5" /> },
  ofd:     { label: "قيد التوصيل",  color: "#e11d48", icon: <Package className="w-3.5 h-3.5" /> },
  done:    { label: "تم التسليم",   color: "#059669", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  bad:     { label: "مشكلة",        color: "#dc2626", icon: <AlertCircle className="w-3.5 h-3.5" /> },
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

interface TrackingEvent {
  event_type: string; timestamp: string;
  description?: string | null; location?: string | null;
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
  return (order.tracking_number && order.delivery_status) ? order.delivery_status : order.status;
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
            background: "linear-gradient(90deg, #34d399, #6366f1, #f97316)",
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
  const group = STATUS_GROUP[effectiveStatus] || "pending";
  const meta = GROUP_META[group];
  const hasCourier = !!order.tracking_number;
  const price = order.unit_price != null ? (order.unit_price * (order.quantity || 1)) : (order.total_price ?? 0);

  const handleCopy = async (text: string, type: 'id' | 'trk') => {
    try { await navigator.clipboard.writeText(text); setCopied(type); setTimeout(() => setCopied('none'), 1200); } catch {}
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <span className="text-sm font-bold tabular-nums text-foreground">#{order.reference_id || order.id}</span>
        <span className="text-sm font-semibold text-foreground truncate">{order.customer_name}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{order.customer_phone}</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        <span className="text-sm font-bold tabular-nums text-foreground">{formatPrice(price, locale)}</span>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-muted">
              {order.product_image ? <img src={order.product_image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {hasCourier && (
                <button onClick={() => handleCopy(order.tracking_number!, 'trk')}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  🚚 {order.delivery_company}
                  {copied === 'trk' && <span className="text-emerald-500 ml-1">✓</span>}
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo(order.created_at, locale)}</span>
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

  const liveCounts: Record<string, number> = { all: orders.length, pending: 0, transit: 0, hub: 0, ofd: 0, done: 0, bad: 0 };
  for (const o of orders) {
    const g = STATUS_GROUP[getEffectiveStatus(o)] || "pending";
    if (liveCounts[g] !== undefined) liveCounts[g]++;
  }

  const PIPELINE_GROUPS = ["all", "pending", "transit", "hub", "ofd", "done", "bad"] as const;

  const filtered = orders.filter(o => {
    const g = STATUS_GROUP[getEffectiveStatus(o)] || "pending";
    const matchGroup = groupFilter === "all" || g === groupFilter;
    const q = search.toLowerCase();
    return matchGroup && (!q || String(o.reference_id || o.id).includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q));
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(["pending","transit","hub","ofd","done","bad"] as const).map(g => {
          const meta = GROUP_META[g];
          const count = liveCounts[g] || 0;
          const active = groupFilter === g;
          return (
            <button key={g} onClick={() => setGroupFilter(g)}
              className={`bg-card rounded-xl border border-border p-3 text-center transition-all shadow-sm ${active ? 'ring-2' : 'hover:border-primary/30'}`}
              style={active ? { borderColor: meta.color, ringColor: `${meta.color}30` } : undefined}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                  {meta.icon}
                </div>
              </div>
              <p className="text-lg font-black tabular-nums" style={{ color: meta.color }}>{count}</p>
              <p className="text-[9px] font-semibold text-muted-foreground mt-0.5 truncate">{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search + Filter */}
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

      {/* Orders */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-2 bg-muted rounded w-1/2" /></div>
                <div className="w-16 h-6 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
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
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Package className="w-6 h-6 text-muted-foreground" />
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
