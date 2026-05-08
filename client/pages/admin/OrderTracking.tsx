import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

// ─── Delivery step definitions ─────────────────────────────────────────────
const TRACKING_STEPS = [
  { key: "pending",        labelAr: "تم التأكيد",    color: "#2b8a3e", icon: "S5",  bg: "#ebfbee" },
  { key: "confirmed",      labelAr: "قيد التجهيز",    color: "#1c7ed6", icon: "G4", bg: "#e7f5ff" },
  { key: "processing",     labelAr: "تم الشحن",      color: "#7048e8", icon: "S5",  bg: "#f3f0ff" },
  { key: "shipped",        labelAr: "في الطريق",      color: "#d9480f", icon: "T2", bg: "#fff4e6" },
  { key: "warehouse",      labelAr: "وصل المستودع",  color: "#9c36b5", icon: "W3",  bg: "#f8f0fc" },
  { key: "out_delivery",   labelAr: "خرج للتسليم",    color: "#c2255c", icon: "H1", bg: "#fff0f6" },
  { key: "delivered",      labelAr: "تم التسليم",     color: "#2b8a3e", icon: "D2", bg: "#ebfbee" },
];

// Map status → step (covers both internal order status AND courier DeliveryStatus enum)
const STATUS_TO_STEP: Record<string, number> = {
  // ── internal order status ──
  pending:              0,
  confirmed:            1,
  processing:           2,
  shipped:              3,
  in_transit:           3,
  at_warehouse:         4,
  out_for_delivery:     5,
  out_delivery:         5,
  delivered:            6,
  completed:            6,
  // ── courier DeliveryStatus enum (from webhooks) ──
  assigned:             1,
  picked_up:            2,   // courier collected the parcel = تم الشحن
  ready_for_pickup:     4,   // at warehouse, awaiting pickup = وصل المستودع
  at_hub:               3,   // at sorting hub = في الطريق
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
    out_delivery:     "خرج للتسليم • المندوب في الطريق",
    out_for_delivery: "خرج للتسليم • المندوب في الطريق",
    at_warehouse:     "وصل المستودع • جاهز للشحن",
    shipped:          "الشحنة في الطريق",
    in_transit:       "الشحنة في الطريق",
    failed:           "فشل التوصيل • العميل غير متاح",
    cancelled:        "تم إلغاء الطلب",
    returned:         "تم إرجاع الطلب",
    fake:             "طلب مشبوه",
    duplicate:        "طلب مكرر",
  };

  return (
    <div className="flex-1 min-w-0 space-y-[9px] overflow-hidden">
      {/* Step nodes — organic spacing, irregular gaps */}
      <div className="flex items-end justify-between gap-[3px] sm:gap-[5px]">
        {TRACKING_STEPS.map((step, i) => {
          const done   = !isBad && i < currentStep;
          const active = !isBad && i === currentStep;
          const dim = done || active ? step.color : "#d1d5db";
          return (
            <div key={step.key} className="flex flex-col items-center gap-[5px] flex-1 min-w-0">
              <div
                className="rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  width: active ? 31 : 23,
                  height: active ? 31 : 23,
                  background: done ? step.color : active ? "#fff" : "#f3f4f6",
                  border: active ? `2.5px solid ${step.color}` : "none",
                  boxShadow: active ? `0 0 0 4px ${step.color}18` : "none",
                  transform: active ? "scale(1)" : "scale(1)",
                }}
              >
                <StepIcon type={step.icon} done={done} active={active} color={dim} />
              </div>
              <span
                className="text-[7px] sm:text-[8px] leading-tight text-center font-semibold leading-[1.2] max-w-[34px] sm:max-w-[42px]"
                style={{ color: done || active ? step.color : "#b0b0b0" }}
              >
                {step.labelAr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Road with animated truck — RTL: step 0 is rightmost, step 6 leftmost */}
      <div className="relative h-[22px] mx-[3px]" dir="ltr">
        {/* Road */}
        <div className="absolute inset-y-[9px] left-0 right-0 rounded-full" style={{ background: "#e8e8e8" }} />
        {/* Progress fill */}
        <div
          className="absolute inset-y-[9px] right-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isCancelled
              ? "linear-gradient(270deg,#e03131,#ff8787)"
              : "linear-gradient(270deg,#2b8a3e,#1c7ed6,#d9480f)",
          }}
        />
        {/* Dashes */}
        <div className="absolute inset-y-[12px] left-[11px] right-[11px] flex items-center gap-[7px] overflow-hidden pointer-events-none">
          {Array.from({ length: 13 }).map((_, i) => (
            <div key={i} className="h-[1.5px] w-[5px] bg-white/40 rounded-full flex-shrink-0" />
          ))}
        </div>
        {/* Truck icon — moves along the road */}
        <div
          className="absolute -top-[3px] transition-all duration-700"
          style={{ right: `clamp(0px, calc(${pct}% - 11px), calc(100% - 22px))` }}
        >
          {isCancelled ? (
            /* Crossed circle — cancelled */
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="#fee2e2"/><path d="M7 7L15 15M15 7L7 15" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round"/></svg>
          ) : currentStep >= 5 ? (
            /* House — delivered */
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="9" width="16" height="11" rx="0.8" fill="#1c7ed6"/><path d="M1 10L11 3L21 10" stroke="#1c7ed6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="9" y="14.5" width="4" height="5.5" rx="0.5" fill="#1864ab"/><rect x="4.5" y="10.5" width="3" height="3" rx="0.3" fill="#fff" opacity="0.3"/><rect x="14.5" y="10.5" width="3" height="3" rx="0.3" fill="#fff" opacity="0.3"/><circle cx="11.5" cy="17" r="0.4" fill="#fff" opacity="0.4"/></svg>
          ) : (
            /* Delivery truck — facing LEFT for RTL, cabin on left */
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="15" width="16" height="1.5" rx="0.5" fill="#343a40"/><rect x="9" y="5" width="10" height="10.5" rx="1" fill="#1c7ed6"/><rect x="9" y="5" width="10" height="10.5" rx="1" stroke="#1864ab" strokeWidth="0.4"/><line x1="14" y1="5" x2="14" y2="15.5" stroke="#1864ab" strokeWidth="0.5"/><rect x="12.3" y="9.5" width="0.8" height="2" rx="0.3" fill="#fff" opacity="0.4"/><path d="M3 12.5L5 6H9V15.5H3V12.5Z" fill="#d9480f"/><path d="M5.2 7L3.8 12.5H5.2V7Z" fill="#fff" opacity="0.35"/><rect x="6.2" y="7.5" width="2" height="3" rx="0.4" fill="#fff" opacity="0.25"/><circle cx="5.5" cy="17" r="2" fill="#343a40"/><circle cx="15.5" cy="17" r="2" fill="#343a40"/><circle cx="5.5" cy="17" r="0.7" fill="#adb5bd"/><circle cx="15.5" cy="17" r="0.7" fill="#adb5bd"/><circle cx="3.5" cy="13.5" r="0.5" fill="#ffd43b"/><path d="M10.5 7L13 9.5M11.5 7L14 9.5" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.3"/><path d="M10.5 10.5L13 13M11.5 10.5L14 13" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.3"/></svg>
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
      className="sm:flex sm:flex-row bg-card border border-border"
      style={{ borderRight: `3px solid ${stepColor}` }}
    >
      {/* Thumbnail + primary info */}
      <div className="flex items-start gap-[13px] p-[13px] sm:min-w-[200px]">
        <div
          className="w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-[7px] overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ background: `${stepColor}0d`, border: `1.5px solid ${stepColor}20` }}
        >
          {order.product_image ? (
            <img src={order.product_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <BoxIcon color={stepColor} />
          )}
        </div>
        <div className="space-y-[4px] min-w-0 leading-none">
          <button
            onClick={() => handleCopy(String(order.reference_id || order.id), 'order')}
            className="text-[13px] font-black flex items-center gap-[5px] group"
            style={{ color: stepColor }}
            title="انسخ رقم الطلب"
          >
            #{order.reference_id || order.id}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              {copied === 'order' ? <CopyCheck /> : <CopyIcon />}
            </span>
          </button>
          <p className="text-[15px] font-bold text-foreground truncate">{order.customer_name}</p>
          <p className="text-[13px] text-muted-foreground flex items-center gap-[5px]">
            <PhoneIcon /> {order.customer_phone}
          </p>
          <p className="text-[12px] text-muted-foreground/50 flex items-center gap-[5px]">
            <CalIcon /> {new Date(order.created_at).toLocaleDateString("ar-DZ")}
          </p>
          <p
            className="text-[17px] font-black tracking-tight"
            style={{ color: isCancelled ? "#e03131" : "#2b8a3e" }}
          >
            {Math.round(price).toLocaleString("ar-DZ")} دج
          </p>
          {hasCourier && (
            <button
              onClick={() => handleCopy(order.tracking_number!, 'tracking')}
              className="text-[11px] font-mono flex items-center gap-[5px] group text-muted-foreground hover:text-foreground transition-colors"
              title="انسخ رقم التتبع"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0.5" y="1.5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 4.5H8V9H4" stroke="currentColor" strokeWidth="1.2"/></svg>
              {order.tracking_number}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copied === 'tracking' ? <CopyCheck /> : <CopyIcon />}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Thin separator */}
      <div className="hidden sm:block w-px my-[11px] bg-border flex-shrink-0" />

      {/* Tracking bar — fills remaining width */}
      <div className="sm:flex-1 min-w-0 px-[13px] pb-[13px] sm:py-[11px] border-t sm:border-t-0 border-border pt-[9px] sm:pt-0">
        <div className="flex items-center gap-[7px] mb-[7px]">
          {hasCourier ? (
            <span className="inline-flex items-center gap-[5px] rounded-[5px] px-[7px] py-[3px] text-[8px] sm:text-[9px] font-bold" style={{ background: "#e7f5ff", color: "#1c7ed6" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="3.5" y="2.5" width="5" height="4" rx="0.5" fill="#1c7ed6"/><path d="M1 4.5L2 3H3.5V7H1V4.5Z" fill="#d9480f"/><circle cx="2" cy="7.5" r="1" fill="#495057"/><circle cx="6.5" cy="7.5" r="1" fill="#495057"/></svg>
              {order.delivery_company || "شركة التوصيل"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[5px] rounded-[5px] px-[7px] py-[3px] text-[8px] sm:text-[9px] font-bold bg-muted text-muted-foreground">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="1" y="0.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1"/><path d="M1 3H8" stroke="currentColor" strokeWidth="1"/></svg>
              داخلي
            </span>
          )}
        </div>
        <TrackingBar status={effectiveStatus} updatedAt={order.updated_at} />
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
  const PER_PAGE = 25;

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
      setOrders(list);
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
    <div className="p-[13px] bg-muted min-h-screen" dir="rtl">
    <div className="space-y-[9px]">

      {/* ── Header card ── */}
      <div className="bg-card border border-border rounded-xl p-[13px]">
        <div className="flex items-start justify-between gap-[13px]">
          <div className="relative">
            <div className="flex items-center gap-[9px]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary shrink-0">
                <rect x="1" y="4" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 8H15L17 10.5V15H11V8Z" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="5" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="13.5" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <h1 className="text-[17px] font-extrabold tracking-tight text-foreground">تتبع الطلبات</h1>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-[3px]">راود كل طلب وين وصل</p>
            <div className="w-[27px] h-[3px] rounded-full mt-[7px] bg-primary" />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex shrink-0 items-center gap-[5px] h-[31px] px-[11px] rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <svg className={`w-[13px] h-[13px] ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 117 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            حدّث
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-3 gap-[9px]">
        <div className="bg-card border border-border rounded-xl px-[13px] py-[9px] flex items-center gap-[9px]">
          <div className="flex h-[31px] w-[31px] items-center justify-center rounded-lg bg-orange-600 shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="4" width="7" height="7" rx="1" fill="#fff" opacity="0.9"/><path d="M8 7H11.5L13 9V12H8V7Z" fill="#fff" opacity="0.9"/><circle cx="4" cy="12" r="1.5" fill="#fff" opacity="0.9"/><circle cx="11" cy="12" r="1.5" fill="#fff" opacity="0.9"/></svg>
          </div>
          <div>
            <p className="text-lg font-extrabold text-orange-600 leading-none">{inTransit}</p>
            <p className="text-[11px] text-muted-foreground font-semibold mt-[3px]">بالطريق</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-[13px] py-[9px] flex items-center gap-[9px]">
          <div className="flex h-[31px] w-[31px] items-center justify-center rounded-lg bg-emerald-600 shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" fill="#fff" opacity="0.9"/><path d="M5 7.5L7 9.5L10.5 5.5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div>
            <p className="text-lg font-extrabold text-emerald-600 leading-none">{delivered}</p>
            <p className="text-[11px] text-muted-foreground font-semibold mt-[3px]">وصلو</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-[13px] py-[9px] flex items-center gap-[9px]">
          <div className="flex h-[31px] w-[31px] items-center justify-center rounded-lg bg-red-600 shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" fill="#fff" opacity="0.9"/><path d="M5 5L10 10M10 5L5 10" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div>
            <p className="text-lg font-extrabold text-red-600 leading-none">{failed}</p>
            <p className="text-[11px] text-muted-foreground font-semibold mt-[3px]">مشاكل</p>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg className="absolute inset-y-0 right-[9px] w-[13px] h-[13px] my-auto text-muted-foreground pointer-events-none" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="رقم الطلب أو اسم الزبون..."
          className="w-full pr-[27px] pl-[9px] py-[7px] text-xs outline-none bg-card border border-border rounded-lg focus:border-primary transition-colors"
        />
      </div>

      {/* ── Status tabs — underline style ── */}
      <div className="border-b border-border">
        <div className="flex overflow-x-auto">
          {STATUS_TABS.filter(tab => tab.key === "all" || tabCounts[tab.key] > 0).map(tab => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                className={`flex-shrink-0 flex items-center gap-[5px] px-[11px] py-[9px] text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? `text-foreground ${TAB_SHADOW_COLOR[tab.key] || 'shadow-blue-600'} shadow-[inset_0_-2px_0_0]`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[17px] h-[17px] rounded px-[4px] text-[9px] font-bold ${
                    active ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-[60px] gap-[11px]">
          <div className="flex items-center gap-[7px]">
            <svg className="w-[14px] h-[14px] animate-spin text-primary" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
              <path d="M12.5 7a5.5 5.5 0 00-5.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-xs text-muted-foreground font-medium">جلب الطلبات...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-[11px] flex items-start gap-[9px] bg-destructive/10 border border-destructive/30 rounded-xl">
          <div className="flex-shrink-0 mt-[2px] w-[4px] self-stretch bg-destructive rounded-full" />
          <div>
            <p className="text-xs font-bold text-destructive">ما قدرناش نجيب الطلبات</p>
            <p className="text-[11px] mt-[3px] text-destructive/80">{error}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-[60px] text-center gap-[7px]">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-muted-foreground/30">
            <rect x="4" y="10" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="9.5" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="22" cy="24" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M18 15H24L27 18V24H18V15Z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <p className="text-muted-foreground font-bold text-sm">خاوية</p>
          <p className="text-[11px] text-muted-foreground/50">{search ? "ما لقينا والو" : "ماكاش طلبات بهذا الفلتر"}</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground/50">
            <span className="font-bold text-muted-foreground">{paginated.length}</span> من <span className="font-bold text-muted-foreground">{filtered.length}</span> طلب
          </p>
          <div className="space-y-[5px]">
            {paginated.map(order => <OrderRow key={order.id} order={order} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-[5px] pt-[9px]">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-[11px] py-[5px] text-[12px] font-bold disabled:opacity-30 bg-muted text-muted-foreground border border-border">
                السابق
              </button>
              <span className="text-[12px] font-bold text-muted-foreground/50 px-[5px]">
                {page}
                <span className="text-muted-foreground/30 mx-[2px]">/</span>
                {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-[11px] py-[5px] text-[12px] font-bold disabled:opacity-30 bg-muted text-muted-foreground border border-border">
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
