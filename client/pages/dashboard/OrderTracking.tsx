import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const GROUP_META: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: "قيد الانتظار", color: "#0d9488", dot: "#14b8a6" },
  transit: { label: "في الطريق",    color: "#d97706", dot: "#f59e0b" },
  hub:     { label: "في المحطة",    color: "#7c3aed", dot: "#8b5cf6" },
  ofd:     { label: "قيد التوصيل",  color: "#e11d48", dot: "#f43f5e" },
  done:    { label: "تم التسليم",   color: "#059669", dot: "#10b981" },
  bad:     { label: "مشكلة",        color: "#dc2626", dot: "#ef4444" },
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

// ─── Step bar ────────────────────────────────────────────────
function StepBar({ status, stepTimestamps, t, locale }: { status: string; stepTimestamps?: Record<number, string>; t: (key: string) => string; locale: string }) {
  const rawStep = STATUS_TO_STEP[status] ?? 0;
  const isBad = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isCancelled = ["cancelled","returned","fake","duplicate","failed"].includes(status);
  const isRTL = locale === "ar";
  const pct = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative w-full h-[52px]">
        <div className="absolute top-[22px] left-0 right-0 h-[4px] rounded-full bg-gray-200 dark:bg-white/[0.06] shadow-inner" />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`absolute top-[22px] ${isRTL ? 'right-0' : 'left-0'} h-[4px] rounded-full shadow-sm`}
          style={{
            [isRTL ? 'left' : 'right']: 'auto',
            background: isCancelled
              ? "linear-gradient(90deg,#e03131,#fc8181)"
              : isRTL
                ? "linear-gradient(270deg,#34d399,#6366f1,#f97316)"
                : "linear-gradient(90deg,#34d399,#6366f1,#f97316)",
            boxShadow: isCancelled
              ? "0 0 8px rgba(224,49,49,0.4)"
              : "0 0 8px rgba(99,102,241,0.3)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-[2px]">
          {TRACKING_STEPS.map((step, i) => {
            const done = !isBad && i < currentStep;
            const active = !isBad && i === currentStep;
            const size = active ? 24 : done ? 18 : 14;
            return (
              <div key={step.key} className="flex items-center justify-center z-10 relative"
                style={{ width: active ? 30 : 22, height: 32 }}>
                <div className="rounded-full transition-all duration-500 flex items-center justify-center"
                  style={{
                    width: size, height: size,
                    background: done ? step.color : active ? "transparent" : "rgba(0,0,0,0.04)",
                    border: active ? `3px solid ${step.color}` : done ? "none" : "1.5px solid rgba(0,0,0,0.12)",
                    boxShadow: active
                      ? `0 0 0 6px ${step.color}25, 0 0 20px ${step.color}30, inset 0 1px 0 rgba(255,255,255,0.2)`
                      : done
                        ? `0 0 10px ${step.color}30`
                        : "inset 0 1px 0 rgba(255,255,255,0.1)",
                  }}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 13 13" fill="none">
                      <path d="M4 6.5L5.5 8L9.5 4.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {active && (
                    <div className="w-[8px] h-[8px] rounded-full animate-pulse" style={{ background: step.color }} />
                  )}
                </div>
                {active && (
                  <span className="absolute top-full mt-0.5 text-[10px] font-bold whitespace-nowrap leading-tight"
                    style={{ color: step.color }}>
                    {t(step.labelKey)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Copy icon ───────────────────────────────────────────────
function CopyBadge({ copied }: { copied: boolean }) {
  return copied
    ? <svg width="10" height="10" viewBox="0 0 9 9" fill="none"><rect x="2.5" y="0.5" width="6" height="6" rx="1" stroke="#2b8a3e" strokeWidth="1"/><path d="M0.5 3V8H5.5" stroke="#2b8a3e" strokeWidth="1"/><path d="M3 5.5L4.5 7L7 4" stroke="#2b8a3e" strokeWidth="1.2" strokeLinecap="round"/></svg>
    : <svg width="10" height="10" viewBox="0 0 9 9" fill="none"><rect x="2.5" y="0.5" width="6" height="6" rx="1" stroke="#94a3b8" strokeWidth="1"/><path d="M0.5 3V8H5.5" stroke="#94a3b8" strokeWidth="1"/></svg>;
}

// ─── 3D Order card ───────────────────────────────────────────
function OrderCard({ order, events, t, locale, index }: { order: TrackingOrder; events?: TrackingEvent[]; t: (key: string) => string; locale: string; index: number }) {
  const [copied, setCopied] = useState<'none' | 'id' | 'trk'>('none');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const isRTL = locale === "ar";

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 12, y: y * -12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const effectiveStatus = getEffectiveStatus(order);
  const stepIdx = STATUS_TO_STEP[effectiveStatus] ?? 0;
  const isBad = stepIdx === -1;
  const group = STATUS_GROUP[effectiveStatus] || "pending";
  const meta = GROUP_META[group];
  const stepInfo = stepIdx >= 0 && stepIdx < TRACKING_STEPS.length ? TRACKING_STEPS[stepIdx] : null;
  const stepColor = isBad ? "#dc2626" : (stepInfo?.color ?? "#6b7280");
  const hasCourier = !!order.tracking_number;
  const price = order.unit_price != null ? (order.unit_price * (order.quantity || 1)) : (order.total_price ?? 0);

  const stepTimestamps: Record<number, string> = {};
  if (events) {
    const a = events.find(e => ['assigned','uploaded','label_generated'].includes(e.event_type));
    if (a) stepTimestamps[0] = a.timestamp;
    else if (order.created_at) stepTimestamps[0] = order.created_at;
    const p = events.find(e => ['pickup','picked_up'].includes(e.event_type));
    if (p) stepTimestamps[1] = p.timestamp;
    const t2 = events.find(e => e.event_type === 'in_transit');
    if (t2) stepTimestamps[2] = t2.timestamp;
    const h = events.find(e => ['at_hub','at_warehouse','ready_for_pickup'].includes(e.event_type));
    if (h) stepTimestamps[3] = h.timestamp;
    const o = events.find(e => ['out_for_delivery','out_delivery'].includes(e.event_type));
    if (o) stepTimestamps[4] = o.timestamp;
    const d = events.find(e => e.event_type === 'delivered');
    if (d) stepTimestamps[5] = d.timestamp;
  } else if (order.created_at) stepTimestamps[0] = order.created_at;

  const handleCopy = async (text: string, type: 'id' | 'trk') => {
    try { await navigator.clipboard.writeText(text); setCopied(type); setTimeout(() => setCopied('none'), 1200); } catch {}
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] backdrop-blur-xl rounded-2xl shadow-lg transition-all duration-200 cursor-default"
      style={{
        borderRight: isRTL ? `3px solid ${stepColor}` : undefined,
        borderLeft: isRTL ? undefined : `3px solid ${stepColor}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.2)`,
        transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${-tilt.x}deg)`,
        transition: tilt.x === 0 && tilt.y === 0 ? 'all 0.5s ease' : 'box-shadow 0.2s ease',
      }}>
      {/* Line 1: Order info */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `${stepColor}15`, border: `1.5px solid ${stepColor}25` }}>
          {order.product_image ? (
            <img src={order.product_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none"><rect x="3" y="7" width="22" height="17" rx="2" stroke={stepColor} strokeWidth="1.5"/><path d="M3 11H25" stroke={stepColor} strokeWidth="1.5"/><path d="M10 16H18" stroke={stepColor} strokeWidth="1.8" strokeLinecap="round"/></svg>
          )}
        </div>
        <button onClick={() => handleCopy(String(order.reference_id || order.id), 'id')}
          className="text-sm font-black flex items-center gap-1.5 group shrink-0 hover:opacity-80 transition-opacity" style={{ color: stepColor }}>
          #{order.reference_id || order.id}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBadge copied={copied === 'id'} /></span>
        </button>
        <span className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{order.customer_name}</span>
        <span className="text-xs text-gray-400 dark:text-white/30 shrink-0 hidden sm:inline">{order.customer_phone}</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur"
          style={{ background: `${meta.dot}18`, color: meta.dot, border: `1px solid ${meta.dot}25` }}>
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-[6px] h-[6px] rounded-full" style={{ background: meta.dot, boxShadow: `0 0 6px ${meta.dot}` }}
          />
          {meta.label}
        </span>
        <span className="text-base font-black tabular-nums" style={{ color: isBad ? "#f87171" : "#34d399" }}>
          {formatPrice(price, locale)}
        </span>
      </div>
      {/* Line 2: 3D step bar + meta */}
      <div className="flex items-center gap-3 px-4 pb-5">
        <StepBar status={effectiveStatus} stepTimestamps={stepTimestamps} t={t} locale={locale} />
        <div className="flex items-center gap-2 shrink-0">
          {hasCourier && order.tracking_number && (
            <button onClick={() => handleCopy(order.tracking_number!, 'trk')}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 group whitespace-nowrap border border-indigo-200 dark:border-indigo-500/15 backdrop-blur shadow-sm">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><rect x="3.5" y="2.5" width="5" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><path d="M1 4.5L2 3H3.5V7H1V4.5Z" fill="currentColor" opacity="0.6"/><circle cx="2" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="7.5" r="1" fill="currentColor"/></svg>
              <span className="max-w-[80px] truncate hidden sm:inline">{order.delivery_company}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBadge copied={copied === 'trk'} /></span>
            </button>
          )}
          <span className="text-[11px] text-gray-400 dark:text-white/30 font-medium whitespace-nowrap">{timeAgo(order.created_at, locale)}</span>
        </div>
      </div>
    </motion.div>
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

  const STEP_ICON = (g: string) => {
    switch (g) {
      case "all": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5.5V8.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
      case "pending": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 7H11.5M4.5 10H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
      case "transit": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4.5" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M9.5 7.5H12L13.5 9.5v3.5H9.5V7.5Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="11" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>;
      case "hub": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="5.5" width="11" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 5.5v-1a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5v1" stroke="currentColor" strokeWidth="1.3"/></svg>;
      case "ofd": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M3.5 7.5L8 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
      case "done": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
      case "bad": return <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6.5 6.5l3 3m-3 0l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-gray-50 dark:bg-[#03050A] relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background orbs — dark only */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden dark:block">
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -20, 30, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[150px]"
        />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-[200px]"
        />
      </div>

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-5 lg:px-6 py-6 space-y-4">

        {/* Header — glass */}
        <div className="flex items-center justify-between bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] backdrop-blur-xl rounded-2xl px-5 py-4 shadow-lg dark:shadow-none">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 0 0 rgba(99,102,241,0.3)", "0 0 20px 4px rgba(99,102,241,0.2)", "0 0 0 0 rgba(99,102,241,0.3)"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="10" height="10" rx="1.5" stroke="#fff" strokeWidth="1.5"/>
                <path d="M11 8H15L17 10.5V15H11V8Z" stroke="#fff" strokeWidth="1.5"/>
                <circle cx="5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/>
                <circle cx="13.5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </motion.div>
            <div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white">{t("tracking.title")}</h1>
              <p className="text-[11px] text-gray-400 dark:text-white/40 font-medium leading-none">{t("tracking.subtitle")}</p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/80 hover:border-gray-300 dark:hover:border-white/20 transition-all shadow-sm disabled:opacity-40 active:scale-95">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 117 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("tracking.refresh")}
          </button>
        </div>

        {/* Live pipeline — animated stages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] backdrop-blur-xl rounded-2xl p-4 overflow-hidden shadow-lg dark:shadow-none"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
              />
              <span className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Live</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-white/10 to-transparent" />
            <span className="text-[11px] font-medium text-gray-400 dark:text-white/30">{orders.length} orders in pipeline</span>
          </div>
          <div className="flex items-center gap-0">
            {(["pending","transit","hub","ofd","done","bad"] as const).map((g, i) => {
              const meta = GROUP_META[g];
              const count = liveCounts[g] || 0;
              const isLast = i === 5;
              return (
                <React.Fragment key={g}>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 300 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <motion.div
                      animate={count > 0 ? {
                        boxShadow: [`0 0 0 0 ${meta.dot}50`, `0 0 0 10px ${meta.dot}00`]
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${meta.dot}, ${meta.color})` }}
                    >
                      {count}
                    </motion.div>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-white/40 whitespace-nowrap">{meta.label}</span>
                  </motion.div>
                  {!isLast && (
                    <div className="flex-1 relative h-10 mx-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-[2px] rounded-full bg-gray-200 dark:bg-white/[0.06]" />
                        <motion.div
                          animate={{ x: ["0%", "100%"] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: i * 0.4 }}
                          className="absolute w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-white/20 shadow-lg"
                          style={{ marginLeft: "-5px" }}
                        />
                        <motion.div
                          animate={{ x: ["0%", "100%"] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: i * 0.4 + 1.2 }}
                          className="absolute w-1.5 h-1.5 rounded-full"
                          style={{ background: meta.dot, marginLeft: "-3px", boxShadow: `0 0 6px ${meta.dot}` }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>

        {/* Search + Pipeline pills — glass */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <svg className={`absolute ${isRTL ? "right-3.5" : "left-3.5"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30 pointer-events-none`} viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("tracking.searchPlaceholder")}
              className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} h-10 text-sm outline-none bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-800 dark:text-white/80 rounded-xl focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-400/15 dark:focus:ring-indigo-500/10 transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 shadow-sm`} />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] backdrop-blur-xl rounded-xl shadow-sm px-2 py-1.5">
            {PIPELINE_GROUPS.map(g => {
              const meta = g === "all" ? null : GROUP_META[g];
              const active = groupFilter === g;
              const count = liveCounts[g] || 0;
              return (
                <button key={g} onClick={() => { setGroupFilter(g); setPage(1); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
                    ${active ? 'text-white shadow-md' : 'text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white/60'}`}
                  style={active && meta ? { background: meta.dot } : active && g === "all" ? { background: '#6366f1' } : undefined}>
                  {STEP_ICON(g)}
                  {g === "all" ? t("tracking.all") : meta!.label}
                  <span className={`${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
              <svg className="w-7 h-7 animate-spin text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.15"/>
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm text-gray-400 dark:text-white/30 font-medium">{t("tracking.loading")}</p>
          </div>
        ) : error ? (
          <div className="bg-white/80 dark:bg-white/[0.03] border border-red-300 dark:border-red-500/20 backdrop-blur-xl rounded-2xl shadow-md p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-500/10">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#ef4444" strokeWidth="1.5"/><path d="M8 5V9M8 11V11.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">{t("tracking.loadFailed")}</p>
              <p className="text-xs mt-1 text-red-500/70 dark:text-red-400/60">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/80 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] backdrop-blur-xl rounded-2xl shadow-lg flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-gray-300 dark:text-white/15">
                <rect x="4" y="10" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="9.5" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="22" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M18 15H24L27 18V24H18V15Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-600 dark:text-white/50">{t("tracking.noOrders")}</p>
              <p className="text-sm text-gray-400 dark:text-white/30 mt-1">{search ? t("tracking.noResults") : t("tracking.noFilterResults")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 dark:text-white/30">
                {t("tracking.showing")} <span className="font-bold text-gray-700 dark:text-white/60">{paginated.length}</span> {t("tracking.of")} <span className="font-bold text-gray-700 dark:text-white/60">{filtered.length}</span> {t("tracking.orders")}
              </p>
            </div>
            <div className="space-y-3">
              {paginated.map((order, i) => <OrderCard key={order.id} order={order} events={events[order.id]} t={t} locale={locale} index={i} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-3 pb-5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold disabled:opacity-20 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-white/50 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white/70 hover:border-gray-300 dark:hover:border-white/[0.12] transition-all shadow-sm active:scale-95">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none"><path d="M7 3L4 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t("tracking.prev")}
                </button>
                <span className="text-sm font-bold text-gray-400 dark:text-white/30 px-3">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold disabled:opacity-20 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-white/50 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white/70 hover:border-gray-300 dark:hover:border-white/[0.12] transition-all shadow-sm active:scale-95">
                  {t("tracking.next")}
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none"><path d="M5 3L8 6L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
