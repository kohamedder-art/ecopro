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

const GROUP_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "قيد الانتظار", color: "#0d6efd", bg: "#e7f1ff", border: "#b6d4fe" },
  transit: { label: "في الطريق",    color: "#fd7e14", bg: "#fff4e6", border: "#ffec99" },
  hub:     { label: "في المحطة",    color: "#6f42c1", bg: "#f3f0ff", border: "#d0bfff" },
  ofd:     { label: "قيد التوصيل",  color: "#dc3545", bg: "#fff5f5", border: "#ffc9c9" },
  done:    { label: "تم التسليم",   color: "#198754", bg: "#d1e7dd", border: "#badbcc" },
  bad:     { label: "مشكلة",        color: "#dc3545", bg: "#fff5f5", border: "#ffc9c9" },
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
    if (mins < 60) return locale === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return locale === "ar" ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return locale === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "en-US", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function formatPrice(n: number, locale: string): string {
  return Math.round(n).toLocaleString(locale === "ar" ? "ar-DZ" : "en-US") + (locale === "ar" ? " دج" : " DA");
}

function getEffectiveStatus(order: TrackingOrder): string {
  return (order.tracking_number && order.delivery_status) ? order.delivery_status : order.status;
}

// ─── 2010-style Step bar ─────────────────────────────────────
function StepBar({ status, t, locale }: { status: string; t: (key: string) => string; locale: string }) {
  const rawStep = STATUS_TO_STEP[status] ?? 0;
  const isBad = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isCancelled = ["cancelled","returned","fake","duplicate","failed"].includes(status);
  const pct = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  return (
    <div style={{ width: '100%' }}>
      {/* Progress bar — Web 2.0 gradient style */}
      <div style={{
        width: '100%', height: '22px', borderRadius: '11px',
        background: '#e9ecef', border: '1px solid #adb5bd',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          height: '100%', borderRadius: '10px', transition: 'width 0.8s ease',
          width: `${pct}%`,
          background: isCancelled
            ? 'linear-gradient(180deg, #f87171, #dc2626)'
            : 'linear-gradient(180deg, #4ade80, #16a34a)',
          boxShadow: isCancelled
            ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(220,38,38,0.3)'
            : 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(22,163,74,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px',
        }}>
          {pct > 15 && (
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>

      {/* Step labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 2px' }}>
        {TRACKING_STEPS.map((step, i) => {
          const done = !isBad && i < currentStep;
          const active = !isBad && i === currentStep;
          return (
            <div key={step.key} style={{
              textAlign: 'center', flex: 1,
              fontSize: '9px', fontWeight: active ? 800 : 600,
              color: active ? step.color : done ? '#495057' : '#adb5bd',
              lineHeight: 1.2,
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%', margin: '0 auto 3px',
                background: done ? step.color : active ? '#fff' : '#e9ecef',
                border: active ? `3px solid ${step.color}` : done ? 'none' : '2px solid #dee2e6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active ? `0 0 8px ${step.color}40` : 'none',
              }}>
                {done && <span style={{ color: '#fff', fontSize: '8px', fontWeight: 900 }}>✓</span>}
                {active && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: step.color }} />}
              </div>
              {t(step.labelKey)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2010-style Order card ───────────────────────────────────
function OrderCard({ order, events, t, locale, index }: { order: TrackingOrder; events?: TrackingEvent[]; t: (key: string) => string; locale: string; index: number }) {
  const [copied, setCopied] = useState<'none' | 'id' | 'trk'>('none');
  const effectiveStatus = getEffectiveStatus(order);
  const stepIdx = STATUS_TO_STEP[effectiveStatus] ?? 0;
  const isBad = stepIdx === -1;
  const group = STATUS_GROUP[effectiveStatus] || "pending";
  const meta = GROUP_META[group];
  const hasCourier = !!order.tracking_number;
  const price = order.unit_price != null ? (order.unit_price * (order.quantity || 1)) : (order.total_price ?? 0);

  const handleCopy = async (text: string, type: 'id' | 'trk') => {
    try { await navigator.clipboard.writeText(text); setCopied(type); setTimeout(() => setCopied('none'), 1500); } catch {}
  };

  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${meta.border}`,
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
      overflow: 'hidden',
      animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
    }}>
      {/* Header bar */}
      <div style={{
        background: `linear-gradient(180deg, ${meta.bg}, ${meta.bg}dd)`,
        borderBottom: `1px solid ${meta.border}`,
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: meta.color, color: '#fff',
            padding: '3px 10px', borderRadius: '4px',
            fontSize: '11px', fontWeight: 800,
            boxShadow: `0 1px 3px ${meta.color}40`,
          }}>
            #{order.reference_id || order.id}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#212529' }}>
            {order.customer_name}
          </span>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>
            {order.customer_phone}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: meta.color, color: '#fff',
            padding: '2px 8px', borderRadius: '3px',
            fontSize: '10px', fontWeight: 700,
          }}>
            {meta.label}
          </span>
          <span style={{
            fontSize: '14px', fontWeight: 900,
            color: isBad ? '#dc3545' : '#198754',
          }}>
            {formatPrice(price, locale)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Product image */}
          <div style={{
            width: '50px', height: '50px', borderRadius: '6px',
            background: '#f8f9fa', border: '1px solid #dee2e6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
          }}>
            {order.product_image ? (
              <img src={order.product_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '20px' }}>📦</span>
            )}
          </div>

          {/* Info + step bar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <StepBar status={effectiveStatus} t={t} locale={locale} />
          </div>

          {/* Side info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            {hasCourier && (
              <button onClick={() => handleCopy(order.tracking_number!, 'trk')}
                style={{
                  background: '#e7f1ff', border: '1px solid #b6d4fe',
                  padding: '3px 8px', borderRadius: '4px',
                  fontSize: '10px', fontWeight: 700, color: '#0d6efd',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                🚚 {order.delivery_company}
                {copied === 'trk' && <span style={{ color: '#198754' }}>✓</span>}
              </button>
            )}
            <span style={{ fontSize: '10px', color: '#adb5bd' }}>
              {timeAgo(order.created_at, locale)}
            </span>
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #e9ecef 0%, #dee2e6 50%, #ced4da 100%)',
      fontFamily: 'Tahoma, Arial, Helvetica, sans-serif',
      direction: isRTL ? 'rtl' : 'ltr',
    }}>
      {/* 2010-style top bar */}
      <div style={{
        background: 'linear-gradient(180deg, #4a90d9, #357abd)',
        borderBottom: '2px solid #2a5f9e',
        padding: '0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '6px',
              background: 'linear-gradient(180deg, #fff, #e9ecef)',
              border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              fontSize: '18px',
            }}>
              🚚
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {t("tracking.title")}
              </h1>
              <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                {t("tracking.subtitle")}
              </p>
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{
            background: 'linear-gradient(180deg, #fff, #e9ecef)',
            border: '1px solid #adb5bd',
            borderRadius: '4px',
            padding: '6px 14px',
            fontSize: '11px', fontWeight: 700, color: '#495057',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}>
            {loading ? '⏳' : '🔄'} {t("tracking.refresh")}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 20px' }}>

        {/* Pipeline counters — 2010 dashboard style */}
        <div style={{
          background: '#fff',
          border: '2px solid #adb5bd',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1), inset 0 1px 0 #fff',
          padding: '14px',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#198754', boxShadow: '0 0 6px #19875460', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '1px' }}>LIVE</span>
            <span style={{ flex: 1, height: '1px', background: '#dee2e6' }} />
            <span style={{ fontSize: '10px', color: '#adb5bd' }}>{orders.length} orders</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(["pending","transit","hub","ofd","done","bad"] as const).map(g => {
              const meta = GROUP_META[g];
              const count = liveCounts[g] || 0;
              const active = groupFilter === g;
              return (
                <button key={g} onClick={() => setGroupFilter(g)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: '6px',
                    background: active ? `linear-gradient(180deg, ${meta.color}, ${meta.color}cc)` : meta.bg,
                    border: `2px solid ${active ? meta.color : meta.border}`,
                    color: active ? '#fff' : meta.color,
                    cursor: 'pointer', textAlign: 'center',
                    boxShadow: active ? `0 2px 6px ${meta.color}30` : '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>{meta.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + filter pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#adb5bd' }}>🔍</span>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("tracking.searchPlaceholder")}
              style={{
                width: '100%', padding: '8px 10px 8px 32px',
                border: '2px solid #adb5bd', borderRadius: '6px',
                fontSize: '12px', outline: 'none',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                background: '#fff',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4a90d9'}
              onBlur={e => e.currentTarget.style.borderColor = '#adb5bd'}
            />
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '2px solid #dee2e6', borderRadius: '6px', padding: '4px', flexWrap: 'wrap' }}>
            {PIPELINE_GROUPS.map(g => {
              const meta = g === "all" ? null : GROUP_META[g];
              const active = groupFilter === g;
              const count = liveCounts[g] || 0;
              return (
                <button key={g} onClick={() => { setGroupFilter(g); setPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: '4px',
                    border: `1px solid ${active ? (meta?.color || '#4a90d9') : '#dee2e6'}`,
                    background: active ? (meta?.color || '#4a90d9') : '#fff',
                    color: active ? '#fff' : '#495057',
                    fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: active ? `0 1px 3px ${meta?.color || '#4a90d9'}30` : 'none',
                  }}>
                  {g === "all" ? t("tracking.all") : meta!.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{
            background: '#fff', border: '2px solid #dee2e6', borderRadius: '8px',
            padding: '60px 20px', textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <p style={{ fontSize: '13px', color: '#6c757d', margin: 0 }}>{t("tracking.loading")}</p>
          </div>
        ) : error ? (
          <div style={{
            background: '#fff5f5', border: '2px solid #ffc9c9', borderRadius: '8px',
            padding: '20px', display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#dc3545', margin: 0 }}>{t("tracking.loadFailed")}</p>
              <p style={{ fontSize: '11px', color: '#dc3545aa', margin: '4px 0 0' }}>{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#fff', border: '2px solid #dee2e6', borderRadius: '8px',
            padding: '50px 20px', textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#495057', margin: 0 }}>{t("tracking.noOrders")}</p>
            <p style={{ fontSize: '12px', color: '#adb5bd', margin: '6px 0 0' }}>{search ? t("tracking.noResults") : t("tracking.noFilterResults")}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6c757d' }}>
                {t("tracking.showing")} <strong>{paginated.length}</strong> {t("tracking.of")} <strong>{filtered.length}</strong> {t("tracking.orders")}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paginated.map((order, i) => <OrderCard key={order.id} order={order} events={events[order.id]} t={t} locale={locale} index={i} />)}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{
                    padding: '6px 16px', border: '2px solid #adb5bd', borderRadius: '4px',
                    background: 'linear-gradient(180deg, #f8f9fa, #e9ecef)',
                    fontSize: '11px', fontWeight: 700, color: '#495057',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.4 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                  ← {t("tracking.prev")}
                </button>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6c757d', padding: '0 8px' }}>
                  {page} / {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{
                    padding: '6px 16px', border: '2px solid #adb5bd', borderRadius: '4px',
                    background: 'linear-gradient(180deg, #f8f9fa, #e9ecef)',
                    fontSize: '11px', fontWeight: 700, color: '#495057',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.4 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                  {t("tracking.next")} →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
