import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

// ─── Delivery step definitions ─────────────────────────────────────────────
const TRACKING_STEPS = [
  { key: "confirmed",      labelAr: "تم تأكيد الطلب",     color: "#2b8a3e", icon: "S5",  bg: "#ebfbee" },
  { key: "picked_up",      labelAr: "استُلم الطرد",       color: "#1c7ed6", icon: "G4", bg: "#e7f5ff" },
  { key: "in_transit",     labelAr: "في الطريق إليك",     color: "#d9480f", icon: "T2", bg: "#fff4e6" },
  { key: "at_hub",         labelAr: "وصل المستودع",        color: "#9c36b5", icon: "W3",  bg: "#f8f0fc" },
  { key: "out_for_delivery", labelAr: "خرج للتوصيل",       color: "#c2255c", icon: "H1", bg: "#fff0f6" },
  { key: "delivered",      labelAr: "تم التسليم ✅",       color: "#2b8a3e", icon: "D2", bg: "#ebfbee" },
];

// Map status → step (covers both internal order status AND courier DeliveryStatus enum)
const STATUS_TO_STEP: Record<string, number> = {
  // ── internal order status ──
  pending:              0,
  confirmed:            0,
  processing:           0,
  shipped:              1,
  in_transit:           2,
  at_warehouse:         3,
  out_for_delivery:     4,
  out_delivery:         4,
  delivered:            5,
  completed:            5,
  // ── courier DeliveryStatus enum (from webhooks) ──
  assigned:             0,
  picked_up:            1,
  ready_for_pickup:     3,
  at_hub:               3,
  // in_transit, out_for_delivery, delivered, failed, returned already above
  cancelled:           -1,
  returned:            -1,
  failed:              -1,
  fake:                -1,
  duplicate:           -1,
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface TrackingOrder {
  id: number;
  reference_id?: string;
  customer_name: string;
  customer_phone: string;
  product_title?: string;
  product_image?: string;
  total_price?: number;
  delivery_fee?: number;
  unit_price?: number;
  quantity?: number;
  status: string;             // internal order status
  delivery_status?: string;   // courier-reported status (from webhooks)
  tracking_number?: string;   // courier tracking number
  delivery_company?: string;  // courier company name
  created_at: string;
  updated_at?: string;
  customer_address?: string;
  delivery_type?: string;
  note?: string;
}

// ─── Custom step icon (SVG instead of emoji) ────────────────────────────────
function StepIcon({ type, done, active, color }: { type: string; done: boolean; active: boolean; color: string }) {
  const s = "13";
  const fill = done || active ? color : "#d1d5db";
  if (type === "S5") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke={fill} strokeWidth="2"/>{done && <path d="M4 6.5L6 8.5L9.5 5" stroke={fill} strokeWidth="1.8" strokeLinecap="round"/>}</svg>;
  if (type === "G4") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2.5" stroke={fill} strokeWidth="2"/>{done && <path d="M4.5 6.5L6 8L9 5" stroke={fill} strokeWidth="1.5" strokeLinecap="round"/>}</svg>;
  if (type === "T2") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5H11.5M9.5 3L11.5 6.5L9.5 10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "W3") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><rect x="1.5" y="3.5" width="10" height="8" rx="1.5" stroke={fill} strokeWidth="1.5"/><path d="M4.5 3.5V2A1.5 1.5 0 016 0.5H7A1.5 1.5 0 018.5 2V3.5" stroke={fill} strokeWidth="1.5"/></svg>;
  if (type === "H1") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5V11.5M1.5 6.5H11.5" stroke={fill} strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (type === "D2") return <svg width={s} height={s} viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke={fill} strokeWidth="2"/><path d="M4.5 7L6 8.5L9 5" stroke={fill} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return null;
}

// ─── Step bar component ────────────────────────────────────────────────────
function TrackingBar({ status, updatedAt }: { status: string; updatedAt?: string }) {
  const rawStep     = STATUS_TO_STEP[status] ?? 0;
  const isBad       = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isCancelled = ["cancelled", "returned", "fake", "duplicate", "failed"].includes(status);
  const pct         = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  const statusNote: Record<string, string> = {
    delivered:        `تم التسليم${updatedAt ? " • " + new Date(updatedAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : ""}`,
    completed:        `تم التسليم${updatedAt ? " • " + new Date(updatedAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : ""}`,
    out_for_delivery: "خرج للتوصيل • المندوب في الطريق",
    out_delivery:     "خرج للتوصيل • المندوب في الطريق",
    at_hub:           "وصل المستودع • قيد الفرز",
    at_warehouse:     "وصل المستودع • قيد الفرز",
    ready_for_pickup: "جاهز للاستلام من المستودع",
    shipped:          "الشحنة في الطريق",
    in_transit:       "الشحنة في الطريق",
    picked_up:        "تم استلام الطرد من البائع",
    assigned:         "تم تعيينه لشركة التوصيل",
    failed:           "فشل التوصيل • العميل غير متاح",
    cancelled:        "تم إلغاء الطلب",
    returned:         "تم إرجاع الطلب",
    fake:             "طلب مشبوه",
    duplicate:        "طلب مكرر",
  };

  return (
    <div className="flex-1 min-w-0 space-y-[7px] overflow-hidden">
      {/* Step nodes */}
      <div className="flex items-end justify-between gap-[2px]">
        {TRACKING_STEPS.map((step, i) => {
          const done   = !isBad && i < currentStep;
          const active = !isBad && i === currentStep;
          const dim = done || active ? step.color : "#d1d5db";
          return (
            <div key={step.key} className="flex flex-col items-center gap-[4px] flex-1 min-w-0">
              <div
                className="rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  width: active ? 20 : 16,
                  height: active ? 20 : 16,
                  background: done ? step.color : active ? "#fff" : "#f3f4f6",
                  border: active ? `2px solid ${step.color}` : done ? "none" : "1.5px solid #e5e7eb",
                  boxShadow: active ? `0 0 0 3px ${step.color}20` : "none",
                }}
              >
                <StepIcon type={step.icon} done={done} active={active} color={dim} />
              </div>
              <span
                className="text-[10px] leading-tight text-center font-semibold max-w-[55px]"
                style={{ color: done || active ? step.color : "#c0c0c0" }}
              >
                {step.labelAr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress road */}
      <div className="relative h-[22px] mx-[2px]">
        {/* Track */}
        <div className="absolute top-[9px] bottom-[9px] left-0 right-0 rounded-full bg-slate-200 dark:bg-slate-700" />
        {/* Fill — grows from right (RTL: delivery starts right, ends left) */}
        <div
          className="absolute top-[9px] bottom-[9px] right-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isCancelled
              ? "linear-gradient(90deg,#e03131,#fc8181)"
              : "linear-gradient(90deg,#059669,#3b82f6,#f97316)",
          }}
        />
        {/* Moving truck — positioned from right, moves toward left as pct grows */}
        <div
          className="absolute top-0 transition-all duration-700"
          style={{ right: `clamp(0px, calc(${pct}% - 11px), calc(100% - 22px))` }}
        >
          {isCancelled ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/><path d="M7 7L15 15M15 7L7 15" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/></svg>
          ) : currentStep >= 5 ? (
            // House/delivered icon
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1"/><path d="M5 11L11 5L17 11" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="8" y="12" width="6" height="5" rx="0.8" fill="#059669"/><rect x="9.5" y="13.5" width="3" height="3.5" rx="0.5" fill="#d1fae5"/></svg>
          ) : (
            // 3D truck facing LEFT (RTL: moving toward delivery on left)
            <svg width="22" height="22" viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
              </defs>
              <ellipse cx="16" cy="21" rx="13" ry="1.8" fill="#00000022"/>
              <rect x="12" y="5" width="19" height="12" rx="2" fill="url(#tg)"/>
              <rect x="12" y="5" width="19" height="3.5" rx="2" fill="#3b82f6"/>
              <line x1="19" y1="5" x2="19" y2="17" stroke="#1e40af" strokeWidth="0.6"/>
              <line x1="26" y1="5" x2="26" y2="17" stroke="#1e40af" strokeWidth="0.6"/>
              <rect x="12" y="15.5" width="19" height="0.7" fill="#f87171" opacity="0.5"/>
              <path d="M1 8 H11 Q13 8 13 10 L13 17 H1 Z" fill="url(#cg)"/>
              <path d="M1 8 H9.5 Q11 8 11.5 9.5 L11.5 10 H1 Z" fill="#3b82f6"/>
              <path d="M4 10 H10 Q11 10 11.5 11.5 V12.5 H4 Z" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.4"/>
              <path d="M6 10.3 H9 Q9.5 10.3 10 11 H6 Z" fill="#fff" opacity="0.35"/>
              <rect x="2.5" y="12" width="3.2" height="3.5" rx="0.4" fill="#1e40af" stroke="#3b82f6" strokeWidth="0.4"/>
              <rect x="2.8" y="13" width="0.8" height="0.5" rx="0.2" fill="#93c5fd"/>
              <rect x="0.5" y="7.5" width="1" height="1.2" rx="0.3" fill="#374151" stroke="#1f2937" strokeWidth="0.3"/>
              <rect x="0.5" y="12.8" width="1" height="2" rx="0.3" fill="#fef08a"/>
              <rect x="0.5" y="12.8" width="1" height="2" rx="0.3" fill="#fff" opacity="0.25"/>
              <path d="M0 13.5 L-2 12 L-2 16 Z" fill="#fef08a" opacity="0.1"/>
              <rect x="11" y="3" width="1.5" height="4" rx="0.4" fill="#374151"/>
              <circle cx="11.75" cy="3" r="0.8" fill="#6b7280" opacity="0.4"/>
              <rect x="1" y="16.5" width="30" height="0.8" fill="#1f2937"/>
              <circle cx="6" cy="18" r="3.2" fill="#1f2937"/><circle cx="6" cy="18" r="1.8" fill="#374151"/><circle cx="6" cy="18" r="1" fill="#4b5563"/><circle cx="6" cy="18" r="0.4" fill="#9ca3af"/>
              <line x1="6" y1="16.2" x2="6" y2="19.8" stroke="#6b7280" strokeWidth="0.3"/><line x1="4.2" y1="18" x2="7.8" y2="18" stroke="#6b7280" strokeWidth="0.3"/>
              <circle cx="17" cy="18" r="3.2" fill="#1f2937"/><circle cx="17" cy="18" r="1.8" fill="#374151"/><circle cx="17" cy="18" r="1" fill="#4b5563"/><circle cx="17" cy="18" r="0.4" fill="#9ca3af"/>
              <line x1="17" y1="16.2" x2="17" y2="19.8" stroke="#6b7280" strokeWidth="0.3"/><line x1="15.2" y1="18" x2="18.8" y2="18" stroke="#6b7280" strokeWidth="0.3"/>
              <circle cx="24" cy="18" r="3.2" fill="#1f2937"/><circle cx="24" cy="18" r="1.8" fill="#374151"/><circle cx="24" cy="18" r="1" fill="#4b5563"/><circle cx="24" cy="18" r="0.4" fill="#9ca3af"/>
              <line x1="24" y1="16.2" x2="24" y2="19.8" stroke="#6b7280" strokeWidth="0.3"/><line x1="22.2" y1="18" x2="25.8" y2="18" stroke="#6b7280" strokeWidth="0.3"/>
            </svg>
          )}
        </div>
      </div>

      {/* Status note — clean text, no emoji noise */}
      {statusNote[status] && (
        <div
          className="inline-flex items-center gap-[7px] rounded-[7px] px-[11px] py-[5px] text-[10px] font-semibold"
          style={{
            background: isCancelled ? "#fef2f2" : currentStep >= 6 ? "#ebfbee" : "#e7f5ff",
            color: isCancelled ? "#e03131" : currentStep >= 6 ? "#2b8a3e" : "#1c7ed6",
            border: `1px solid ${isCancelled ? "#ffc9c9" : currentStep >= 6 ? "#b2f2bb" : "#a5d8ff"}`,
          }}
        >
          {statusNote[status]}
        </div>
      )}
    </div>
  );
}

// ─── Tiny inline SVGs ────────────────────────────────────────────────────────
function PhoneIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 1.5A11 11 0 0011.5 10" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/><path d="M1.5 3L4 4L5 1.5" stroke="#9ca3af" strokeWidth="1.3" strokeLinejoin="round"/><path d="M11.5 10L10 12.5L7.5 11.5" stroke="#9ca3af" strokeWidth="1.3" strokeLinejoin="round"/></svg>; }
function CalIcon() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="9" rx="1.5" stroke="#c4c4c4" strokeWidth="1.3"/><path d="M1 5H12" stroke="#c4c4c4" strokeWidth="1.3"/><path d="M4 1V3.5M9 1V3.5" stroke="#c4c4c4" strokeWidth="1.3" strokeLinecap="round"/></svg>; }
function BoxIcon({ color }: { color: string }) { return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="3" y="7" width="22" height="17" rx="2" stroke={color} strokeWidth="1.5"/><path d="M3 11H25" stroke={color} strokeWidth="1.5"/><path d="M10 16H18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></svg>; }
function CopyIcon() { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="2.5" y="0.5" width="6" height="6" rx="1" stroke="#9ca3af" strokeWidth="1"/><path d="M0.5 3V8H5.5" stroke="#9ca3af" strokeWidth="1"/></svg>; }
function CopyCheck() { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="2.5" y="0.5" width="6" height="6" rx="1" stroke="#2b8a3e" strokeWidth="1"/><path d="M0.5 3V8H5.5" stroke="#2b8a3e" strokeWidth="1"/><path d="M3 5.5L4.5 7L7 4" stroke="#2b8a3e" strokeWidth="1.2" strokeLinecap="round"/></svg>; }

// ─── Order row ─────────────────────────────────────────────────────────────
function OrderRow({ order }: { order: TrackingOrder }) {
  const [copied, setCopied] = useState<'none' | 'order' | 'tracking'>('none');
  const price = order.unit_price != null
    ? (order.unit_price * (order.quantity || 1))
    : (order.total_price ?? 0);

  const effectiveStatus = (order.tracking_number && order.delivery_status)
    ? order.delivery_status
    : order.status;

  const stepIdx   = STATUS_TO_STEP[effectiveStatus] ?? 0;
  const isBad     = stepIdx === -1;
  const stepColor = isBad ? "#e03131" : (TRACKING_STEPS[stepIdx]?.color ?? "#6b7280");
  const isCancelled = ["cancelled","returned","fake","duplicate","failed"].includes(effectiveStatus);
  const hasCourier  = !!order.tracking_number;

  const handleCopy = (text: string, type: 'order' | 'tracking') => {
    navigator.clipboard?.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied('none'), 1300);
  };

  return (
    <div
      dir="rtl"
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderRightWidth: '4px', borderRightColor: stepColor }}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Left: Product image + info */}
        <div className="flex items-start gap-2.5 p-3 sm:w-52 sm:shrink-0">
          <div
            className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: `${stepColor}12`, border: `1.5px solid ${stepColor}25` }}
          >
            {order.product_image ? (
              <img src={order.product_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <BoxIcon color={stepColor} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => handleCopy(String(order.reference_id || order.id), 'order')}
              className="text-[11px] font-black flex items-center gap-1 group mb-0.5"
              style={{ color: stepColor }}
            >
              #{order.reference_id || order.id}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">{copied === 'order' ? <CopyCheck /> : <CopyIcon />}</span>
            </button>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{order.customer_name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><PhoneIcon /> {order.customer_phone}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5"><CalIcon /> {new Date(order.created_at).toLocaleDateString("ar-DZ")}</p>
            <p className="text-sm font-black mt-1" style={{ color: isCancelled ? "#e03131" : "#059669" }}>
              {Math.round(price).toLocaleString("ar-DZ")} دج
            </p>
            {hasCourier && (
              <button
                onClick={() => handleCopy(order.tracking_number!, 'tracking')}
                className="text-[9px] font-mono flex items-center gap-1 group text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5"
              >
                <svg width="9" height="9" viewBox="0 0 11 11" fill="none"><rect x="0.5" y="1.5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 4.5H8V9H4" stroke="currentColor" strokeWidth="1.2"/></svg>
                {order.tracking_number}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">{copied === 'tracking' ? <CopyCheck /> : <CopyIcon />}</span>
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px my-3 bg-slate-100 dark:bg-slate-700 flex-shrink-0" />
        <div className="block sm:hidden h-px mx-3 bg-slate-100 dark:bg-slate-700" />

        {/* Right: Tracking bar */}
        <div className="flex-1 min-w-0 px-3 pb-3 pt-2 sm:pt-3">
          <div className="mb-2">
            {hasCourier ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                <svg width="9" height="9" viewBox="0 0 11 11" fill="none"><rect x="3.5" y="2.5" width="5" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><path d="M1 4.5L2 3H3.5V7H1V4.5Z" fill="currentColor" opacity="0.6"/><circle cx="2" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="7.5" r="1" fill="currentColor"/></svg>
                {order.delivery_company || "شركة التوصيل"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <svg width="9" height="9" viewBox="0 0 11 11" fill="none"><rect x="1" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/><path d="M1 4H10" stroke="currentColor" strokeWidth="1"/></svg>
                توصيل داخلي
              </span>
            )}
          </div>
          <TrackingBar status={effectiveStatus} updatedAt={order.updated_at} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function OrderTracking() {
  const { t } = useTranslation();
  const [orders, setOrders]         = useState<TrackingOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage]             = useState(1);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      const res = await fetch(`/api/client/orders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      const list: TrackingOrder[] = (data.orders || data || []).map((o: any) => ({
        id:             o.id,
        reference_id:   o.reference_id || o.order_number,
        customer_name:  o.customer_name || "—",
        customer_phone: o.customer_phone || "—",
        product_title:  o.product_title || o.product_name,
        product_image:  (Array.isArray(o.product_images) ? o.product_images[0] : null) || o.product_image || o.product_thumbnail,
        total_price:    o.total_price,
        delivery_fee:   o.delivery_fee,
        unit_price:     o.unit_price,
        quantity:       o.quantity,
        status:           o.status || "pending",
        delivery_status:  o.delivery_status || null,
        tracking_number:  o.tracking_number || null,
        delivery_company: o.delivery_company_name || o.company_name || null,
        created_at:       o.created_at,
        updated_at:       o.updated_at,
        customer_address: o.customer_address,
        delivery_type:    o.delivery_type,
        note:             o.note,
      }));
      setOrders(list.filter(o => o.tracking_number || o.delivery_status));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Status tabs — built from actual statuses present
  const STATUS_TABS = [
    { key: "all",              label: "الكل" },
    { key: "pending",          label: "تم التأكيد" },
    { key: "confirmed",        label: "قيد التجهيز" },
    { key: "processing",       label: "تم الشحن" },
    { key: "shipped",          label: "في الطريق" },
    { key: "in_transit",       label: "في الطريق" },
    { key: "out_for_delivery", label: "خرج للتسليم" },
    { key: "delivered",        label: "تم التسليم" },
    { key: "completed",        label: "مكتمل" },
    { key: "cancelled",        label: "ملغي" },
    { key: "returned",         label: "مرتجع" },
    { key: "failed",           label: "فشل" },
  ];

  const TAB_ACTIVE_COLOR: Record<string, string> = {
    all: "text-blue-600", pending: "text-emerald-600", confirmed: "text-blue-600",
    processing: "text-violet-600", shipped: "text-orange-600", in_transit: "text-orange-600",
    out_for_delivery: "text-rose-600", out_delivery: "text-rose-600",
    delivered: "text-emerald-600", completed: "text-emerald-600",
    cancelled: "text-red-600", returned: "text-orange-600", failed: "text-red-600",
  };
  const TAB_SHADOW_COLOR: Record<string, string> = {
    all: "shadow-blue-600", pending: "shadow-emerald-600", confirmed: "shadow-blue-600",
    processing: "shadow-violet-600", shipped: "shadow-orange-600", in_transit: "shadow-orange-600",
    out_for_delivery: "shadow-rose-600", out_delivery: "shadow-rose-600",
    delivered: "shadow-emerald-600", completed: "shadow-emerald-600",
    cancelled: "shadow-red-600", returned: "shadow-orange-600", failed: "shadow-red-600",
  };

  const tabCounts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all"
      ? orders.length
      : orders.filter(o => o.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      String(o.reference_id || o.id).includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const inTransit  = orders.filter(o => ["shipped","in_transit","out_for_delivery","out_delivery","assigned","picked_up","at_hub","at_warehouse","ready_for_pickup","processing","confirmed"].includes(o.status)).length;
  const delivered  = orders.filter(o => ["delivered","completed"].includes(o.status)).length;
  const failed     = orders.filter(o => ["failed","cancelled","returned","fake","duplicate"].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><rect x="1" y="4" width="10" height="10" rx="1.5" stroke="#fff" strokeWidth="1.5"/><path d="M11 8H15L17 10.5V15H11V8Z" stroke="#fff" strokeWidth="1.5"/><circle cx="5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/><circle cx="13.5" cy="15" r="2.5" stroke="#fff" strokeWidth="1.5"/></svg>
              </span>
              تتبع الطلبات
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mr-9">تابع حالة كل طلب في الوقت الحقيقي</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-40 active:scale-95"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 117 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            تحديث
          </button>
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="9" height="9" rx="1.5" stroke="#ea580c" strokeWidth="1.5"/><path d="M11 9H15L17 12V16H11V9Z" stroke="#ea580c" strokeWidth="1.5"/><circle cx="5.5" cy="16" r="2" stroke="#ea580c" strokeWidth="1.5"/><circle cx="14" cy="16" r="2" stroke="#ea580c" strokeWidth="1.5"/></svg>
              </div>
              <div>
                <p className="text-xl font-black text-orange-600 dark:text-orange-400 leading-none">{inTransit}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">في الطريق</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="#059669" strokeWidth="1.5"/><path d="M6.5 10L9 12.5L13.5 7.5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{delivered}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">تم التسليم</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="#dc2626" strokeWidth="1.5"/><path d="M7 7L13 13M13 7L7 13" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p className="text-xl font-black text-red-600 dark:text-red-400 leading-none">{failed}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">مشاكل</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search + Filters ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <svg className="absolute inset-y-0 right-2.5 w-3.5 h-3.5 my-auto text-slate-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="ابحث برقم الطلب أو اسم العميل..."
                className="w-full pr-8 pl-3 py-2 text-xs outline-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
          {/* Status tabs */}
          <div className="flex overflow-x-auto scrollbar-hide px-1">
            {STATUS_TABS.filter(tab => tab.key === "all" || tabCounts[tab.key] > 0).map(tab => {
              const active = statusFilter === tab.key;
              const colors: Record<string, string> = {
                all: "indigo", pending: "emerald", confirmed: "blue", processing: "violet",
                shipped: "orange", in_transit: "orange", out_for_delivery: "rose",
                delivered: "emerald", completed: "emerald", cancelled: "red", returned: "amber", failed: "red",
              };
              const c = colors[tab.key] || "slate";
              return (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 sm:px-3 py-2 text-xs font-bold transition-all whitespace-nowrap border-b-2 ${
                    active
                      ? `border-${c}-500 text-${c}-600 dark:text-${c}-400`
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                  {tabCounts[tab.key] > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[9px] font-bold ${
                      active ? `bg-${c}-100 dark:bg-${c}-500/20 text-${c}-700 dark:text-${c}-300` : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">جاري تحميل الطلبات...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5V9M8 11V11.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">فشل تحميل الطلبات</p>
              <p className="text-xs mt-1 text-red-600/70 dark:text-red-400/70">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-slate-300 dark:text-slate-600">
                <rect x="4" y="10" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="9.5" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="22" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M18 15H24L27 18V24H18V15Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-300 font-bold">لا توجد طلبات</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{search ? "لم نجد نتائج لبحثك" : "لا توجد طلبات بهذا الفلتر"}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                عرض <span className="font-bold text-slate-600 dark:text-slate-300">{paginated.length}</span> من <span className="font-bold text-slate-600 dark:text-slate-300">{filtered.length}</span> طلب
              </p>
            </div>
            <div className="space-y-3">
              {paginated.map(order => <OrderRow key={order.id} order={order} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 pb-4">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 text-sm font-bold disabled:opacity-30 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  ← السابق
                </button>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 px-3">
                  {page} / {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 text-sm font-bold disabled:opacity-30 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  التالي →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
