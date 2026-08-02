import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

/*
 * ── CRITICAL: Only in-delivery orders show here ──────
 * Matches the 🚚 عند شركة التوصيل tab in the Orders page.
 * Filter:
 *   list.filter(o => o.status === 'in_delivery' || o.status === 'at_delivery')
 * ──────────────────────────────────────────────────────
 */

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

const GROUP_META: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "#0d9488" },
  transit: { label: "في الطريق",    color: "#d97706" },
  hub:     { label: "في المحطة",    color: "#7c3aed" },
  ofd:     { label: "قيد التوصيل",  color: "#e11d48" },
  done:    { label: "تم التسليم",   color: "#059669" },
  bad:     { label: "مشكلة",        color: "#dc2626" },
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

// ─── Step bar — RTL-aware with labels always under circles ───
function StepBar({ status, t, locale }: { status: string; t: (key: string) => string; locale: string }) {
  const rawStep = STATUS_TO_STEP[status] ?? 0;
  const isBad = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isRTL = locale === "ar";

  // In RTL, we reverse the visual order but keep logic the same
  const steps = isRTL ? [...TRACKING_STEPS].reverse() : TRACKING_STEPS;
  const logicalCurrentStep = isBad ? 0 : (TRACKING_STEPS.length - 1 - currentStep);

  const pct = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  return (
    <div className="w-full" dir="ltr">
      {/* Progress bar — always LTR internally, steps rendered in RTL order */}
      <div className="relative w-full h-[6px] bg-muted rounded-full overflow-hidden border border-border/50"
        style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)' }}>
        <div
          className="absolute inset-y-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            [isRTL ? 'right' : 'left']: 0,
            [isRTL ? 'left' : 'right']: 'auto',
            background: "linear-gradient(90deg, #34d399, #6366f1, #f97316)",
            boxShadow: "0 1px 4px rgba(99,102,241,0.3)",
          }}
        />
      </div>

      {/* Step circles + labels — always arranged in display order */}
      <div className="flex items-start justify-between mt-2" style={{ direction: 'ltr' }}>
        {steps.map((step, displayIdx) => {
          const logicalIdx = isRTL ? (TRACKING_STEPS.length - 1 - displayIdx) : displayIdx;
          const done = !isBad && logicalIdx < currentStep;
          const active = !isBad && logicalIdx === currentStep;
          const isCurrentStep = active;

          return (
            <div key={step.key} className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
              {/* Circle */}
              <div className="relative">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: done ? step.color : isCurrentStep ? "#fff" : "hsl(var(--muted))",
                    border: isCurrentStep
                      ? `3px solid ${step.color}`
                      : done
                        ? "none"
                        : "2px solid hsl(var(--border))",
                    boxShadow: isCurrentStep
                      ? `0 0 0 4px ${step.color}20, 0 2px 8px ${step.color}30`
                      : done
                        ? `0 1px 4px ${step.color}25`
                        : "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 13 13" fill="none">
                      <path d="M4 6.5L5.5 8L9.5 4.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isCurrentStep && (
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: step.color }} />
                  )}
                </div>
              </div>
              {/* Label — always below the circle */}
              <span
                className="text-center mt-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  fontSize: '8px',
                  fontWeight: isCurrentStep ? 800 : 600,
                  color: isCurrentStep ? step.color : done ? '#495057' : 'hsl(var(--muted-foreground))',
                  maxWidth: '70px',
                }}
              >
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Order card — Web 2.0 + modern hybrid ────────────────────
function OrderCard({ order, t, locale }: { order: TrackingOrder; t: (key: string) => string; locale: string }) {
  const [copied, setCopied] = useState<'none' | 'id' | 'trk'>('none');
  const effectiveStatus = getEffectiveStatus(order);
  const stepIdx = STATUS_TO_STEP[effectiveStatus] ?? 0;
  const isBad = stepIdx === -1;
  const group = STATUS_GROUP[effectiveStatus] || "pending";
  const meta = GROUP_META[group];
  const hasCourier = !!order.tracking_number;
  const price = order.unit_price != null ? (order.unit_price * (order.quantity || 1)) : (order.total_price ?? 0);

  const handleCopy = async (text: string, type: 'id' | 'trk') => {
    try { await navigator.clipboard.writeText(text); setCopied(type); setTimeout(() => setCopied('none'), 1200); } catch {}
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
      style={{
        background: 'hsl(var(--card))',
        border: `2px solid hsl(var(--border))`,
        borderRight: `4px solid ${meta.color}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
      {/* Header — Web 2.0 colored bar */}
      <div className="flex items-center gap-3 px-4 py-2"
        style={{
          background: `linear-gradient(135deg, ${meta.color}12, ${meta.color}06)`,
          borderBottom: `1px solid ${meta.color}20`,
        }}>
        <span className="text-sm font-black tabular-nums" style={{ color: meta.color }}>
          #{order.reference_id || order.id}
        </span>
        <span className="text-sm font-bold text-foreground truncate">{order.customer_name}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{order.customer_phone}</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
          style={{
            backgroundColor: `${meta.color}15`,
            borderColor: `${meta.color}40`,
            color: meta.color,
          }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}60` }} />
          {meta.label}
        </span>
        <span className="text-sm font-black tabular-nums" style={{ color: isBad ? "#ef4444" : "#22c55e" }}>
          {formatPrice(price, locale)}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Info row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-border"
              style={{ background: `${meta.color}08` }}>
              {order.product_image ? (
                <img src={order.product_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">📦</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {hasCourier && (
                <button onClick={() => handleCopy(order.tracking_number!, 'trk')}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border transition-colors"
                  style={{
                    background: `hsl(var(--primary))10`,
                    borderColor: `hsl(var(--primary))25`,
                    color: 'hsl(var(--primary))',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `hsl(var(--primary))20`}
                  onMouseLeave={e => e.currentTarget.style.background = `hsl(var(--primary))10`}>
                  🚚 {order.delivery_company}
                  {copied === 'trk' && <span className="text-green-500">✓</span>}
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo(order.created_at, locale)}</span>
            </div>
          </div>
          <div className="w-full">
            <StepBar status={effectiveStatus} t={t} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function OrderTracking() {
  const { t, locale } = useTranslation();
  const isRTL = locale === "ar";
  const [orders, setOrders] = useState<TrackingOrder[]>([]);
  const [events, setEvents] = useState<Record<number, TrackingEvent[]>>({});
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
      if (tracked.length > 0) {
        try {
          const ids = tracked.map(o => o.id).join(',');
          const evRes = await fetch(`/api/delivery/orders/tracking-events-batch?ids=${ids}`, { credentials: "include" });
          if (evRes.ok) {
            const evData = await evRes.json();
            const parsed: Record<number, TrackingEvent[]> = {};
            const raw = evData.events || {};
            for (const [oid, evts] of Object.entries(raw)) {
              parsed[Number(oid)] = (evts as any[]).map(e => ({ event_type: e.event_type, timestamp: e.timestamp, description: e.description ?? null, location: e.location ?? null }));
            }
            setEvents(parsed);
          }
        } catch (evErr) { console.warn('[OrderTracking] Failed to load events:', evErr); }
      }
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
    <div dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-screen-xl mx-auto px-2 md:px-3 pt-4 pb-20 lg:pb-6 space-y-3">

        {/* Toolbar — matches Orders page style */}
        <div className="flex items-center justify-between bg-gradient-to-r from-muted/20 to-transparent rounded-xl border border-border px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="10" height="10" rx="1.5" stroke="#fff" strokeWidth="1.5"/>
                <path d="M11 8H15L17 10.5V15H11V8Z" stroke="#fff" strokeWidth="1.5"/>
                <circle cx="5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/>
                <circle cx="13.5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <h1 className="text-lg font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t("tracking.title")}
            </h1>
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
              {t("tracking.subtitle")}
            </span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
            <svg className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 117 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("tracking.refresh")}
          </button>
        </div>

        {/* Pipeline counters — Web 2.0 dashboard style */}
        <div className="rounded-xl border-2 border-border overflow-hidden"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' }}>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">LIVE</span>
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground">{orders.length} orders</span>
          </div>
          <div className="grid grid-cols-6 divide-x divide-border">
            {(["pending","transit","hub","ofd","done","bad"] as const).map(g => {
              const meta = GROUP_META[g];
              const count = liveCounts[g] || 0;
              const active = groupFilter === g;
              return (
                <button key={g} onClick={() => setGroupFilter(g)}
                  className="p-3 text-center transition-all relative"
                  style={{
                    background: active ? `linear-gradient(180deg, ${meta.color}15, ${meta.color}08)` : 'transparent',
                  }}>
                  <div className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>{count}</div>
                  <div className="text-[9px] font-bold text-muted-foreground mt-0.5">{meta.label}</div>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px]"
                      style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80)` }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Filter pills */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("tracking.searchPlaceholder")}
              className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-border bg-muted/30 text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-muted/40 p-1 rounded-lg border border-border">
            {PIPELINE_GROUPS.map(g => {
              const meta = g === "all" ? null : GROUP_META[g];
              const active = groupFilter === g;
              const count = liveCounts[g] || 0;
              return (
                <button key={g} onClick={() => { setGroupFilter(g); setPage(1); }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all
                    ${active ? 'text-white shadow-md' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                  style={active && meta ? { background: meta.color, boxShadow: `0 2px 8px ${meta.color}30` } : active && g === "all" ? { background: 'hsl(var(--primary))', boxShadow: '0 2px 8px hsl(var(--primary) / 0.3)' } : undefined}>
                  {g === "all" ? t("tracking.all") : meta!.label}
                  <span className={active ? 'opacity-80' : 'opacity-50'}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl bg-card border border-border p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                  <div className="w-16 h-6 bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-card border-2 border-red-200 dark:border-red-500/20 p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-500/10">
              <span className="text-red-500 text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">{t("tracking.loadFailed")}</p>
              <p className="text-xs mt-1 text-red-500/70 dark:text-red-400/60">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-card border-2 border-border shadow-sm flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center border border-border">
              <span className="text-3xl">📭</span>
            </div>
            <p className="text-sm font-bold text-foreground">{t("tracking.noOrders")}</p>
            <p className="text-xs text-muted-foreground">{search ? t("tracking.noResults") : t("tracking.noFilterResults")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("tracking.showing")} <span className="font-bold text-foreground">{paginated.length}</span> {t("tracking.of")} <span className="font-bold text-foreground">{filtered.length}</span> {t("tracking.orders")}
              </p>
            </div>
            <div className="space-y-2">
              {paginated.map((order, i) => <OrderCard key={order.id} order={order} t={t} locale={locale} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-20 disabled:pointer-events-none">
                  {isRTL ? '→' : '←'} {t("tracking.prev")}
                </button>
                <span className="text-sm font-bold text-muted-foreground px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted transition-colors disabled:opacity-20 disabled:pointer-events-none">
                  {t("tracking.next")} {isRTL ? '←' : '→'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
