import React, { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Package, Phone, User, Calendar, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// ─── Delivery step definitions ─────────────────────────────────────────────
const TRACKING_STEPS = [
  { key: "pending",        labelAr: "تم التأكيد",    color: "#34c759", icon: "✓",  bg: "#e8fbed" },
  { key: "confirmed",      labelAr: "قيد التجهيز",    color: "#007aff", icon: "⚙️", bg: "#e5f0ff" },
  { key: "processing",     labelAr: "تم الشحن",      color: "#5856d6", icon: "✓",  bg: "#efedff" },
  { key: "shipped",        labelAr: "في الطريق",      color: "#ff9500", icon: "�", bg: "#fff5e5" },
  { key: "warehouse",      labelAr: "وصل المستودع",  color: "#af52de", icon: "�", bg: "#f9edff" },
  { key: "out_delivery",   labelAr: "خرج للتسليم",    color: "#ff2d55", icon: "🏠", bg: "#ffe5ea" },
  { key: "delivered",      labelAr: "تم التسليم",     color: "#34c759", icon: "🎉", bg: "#e8fbed" },
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

// ─── Step bar component ────────────────────────────────────────────────────
function TrackingBar({ status, updatedAt }: { status: string; updatedAt?: string }) {
  const rawStep     = STATUS_TO_STEP[status] ?? 0;
  const isBad       = rawStep === -1;
  const currentStep = isBad ? 0 : rawStep;
  const isCancelled = ["cancelled", "returned", "fake", "duplicate", "failed"].includes(status);
  const pct         = (currentStep / (TRACKING_STEPS.length - 1)) * 100;

  const statusNote: Record<string, string> = {
    delivered:        `✅ تم التسليم${updatedAt ? " • " + new Date(updatedAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : ""}`,
    completed:        `✅ تم التسليم${updatedAt ? " • " + new Date(updatedAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : ""}`,
    out_delivery:     "🏠 خرج للتسليم • في الطريق إليك",
    out_for_delivery: "🏠 خرج للتسليم • في الطريق إليك",
    at_warehouse:     "🏥 جاهز للاستلام من المستودع",
    shipped:          "🚚 في الطريق للتوصيل",
    in_transit:       "🚚 في الطريق للتوصيل",
    failed:           "❌ فشل التسليم • العميل غير متاح",
    cancelled:        "⛔️ تم إلغاء الطلب",
    returned:         "↩️ تم إرجاع الطلب",
    fake:             "⚠️ طلب مزيف",
    duplicate:        "🔄 طلب مكرر",
  };

  return (
    <div className="flex-1 min-w-0 space-y-2.5">
      {/* Step circles + labels */}
      <div className="flex items-end">
        {TRACKING_STEPS.map((step, i) => {
          const done   = !isBad && i < currentStep;
          const active = !isBad && i === currentStep;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done
                    ? step.color
                    : active && isCancelled
                    ? "#ef4444"
                    : active
                    ? step.color
                    : "#e5e7eb",
                  color: (done || active) ? "#fff" : "#9ca3af",
                  boxShadow: active && !isCancelled
                    ? `0 0 0 3px ${step.color}35, 0 2px 8px ${step.color}50`
                    : undefined,
                  transform: active ? "scale(1.18)" : "scale(1)",
                }}
              >
                {done ? "✓" : isCancelled && active ? "✕" : step.icon}
              </div>
              <span
                className="text-[9px] leading-tight text-center font-semibold line-clamp-2 max-w-[44px]"
                style={{ color: done || active ? step.color : "#9ca3af" }}
              >
                {step.labelAr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Road with animated truck — RTL: step 0 is rightmost, step 6 leftmost */}
      <div className="relative h-6 mx-1" dir="ltr">
        {/* Road bg */}
        <div className="absolute inset-y-[8px] left-0 right-0 rounded-full bg-gray-200" />
        {/* Progress fill from RIGHT (step 0) toward LEFT (step 6) */}
        <div
          className="absolute inset-y-[8px] right-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isCancelled
              ? "linear-gradient(270deg,#ef4444,#fca5a5)"
              : "linear-gradient(270deg,#34c759,#007aff,#ff9500)",
          }}
        />
        {/* Dashes */}
        <div className="absolute inset-y-[11px] left-2 right-2 flex items-center gap-2 overflow-hidden pointer-events-none">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-px w-3 bg-white/50 rounded-full flex-shrink-0" />
          ))}
        </div>
        {/* Truck: starts at far right (step 0), moves left as order progresses */}
        <div
          className="absolute -top-0.5 transition-all duration-700"
          style={{ right: `clamp(0px, calc(${pct}% - 10px), calc(100% - 20px))` }}
        >
          <span className="text-[18px] leading-none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
            {isCancelled ? "❌" : currentStep >= 5 ? "🏠" : "🚚"}
          </span>
        </div>
      </div>

      {/* Status note pill */}
      {statusNote[status] && (
        <div
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{
            background: isCancelled ? "#fef2f2" : currentStep >= 6 ? "#f0fdf4" : "#f0f9ff",
            color: isCancelled ? "#dc2626" : currentStep >= 6 ? "#16a34a" : "#0369a1",
          }}
        >
          {statusNote[status]}
        </div>
      )}
    </div>
  );
}

// ─── Order row ─────────────────────────────────────────────────────────────
function OrderRow({ order }: { order: TrackingOrder }) {
  const price = order.unit_price != null
    ? (order.unit_price * (order.quantity || 1))
    : (order.total_price ?? 0);

  // Use courier delivery_status when available (order assigned to a company),
  // otherwise fall back to internal order status
  const effectiveStatus = (order.tracking_number && order.delivery_status)
    ? order.delivery_status
    : order.status;

  const stepIdx   = STATUS_TO_STEP[effectiveStatus] ?? 0;
  const isBad     = stepIdx === -1;
  const stepColor = isBad ? "#ef4444" : (TRACKING_STEPS[stepIdx]?.color ?? "#6b7280");
  const isCancelled = ["cancelled","returned","fake","duplicate","failed"].includes(effectiveStatus);
  const hasCourier  = !!order.tracking_number;

  return (
    <div
      dir="rtl"
      className="rounded-2xl overflow-hidden flex transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "#fff",
        boxShadow: `0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px ${stepColor}18`,
      }}
    >
      {/* Color stripe */}
      <div className="w-1.5 flex-shrink-0" style={{ background: stepColor }} />

      {/* Thumbnail */}
      <div className="p-3 flex-shrink-0 flex items-center">
        <div
          className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: `${stepColor}12`, border: `1.5px solid ${stepColor}25` }}
        >
          {order.product_image ? (
            <img src={order.product_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-6 h-6" style={{ color: stepColor }} />
          )}
        </div>
      </div>

      {/* Info block */}
      <div className="flex-shrink-0 w-40 py-3 pr-0 pl-3 space-y-1 flex flex-col justify-center">
        <button
          onClick={() => navigator.clipboard?.writeText(String(order.reference_id || order.id))}
          className="text-[11px] font-black text-right flex items-center gap-1 group w-fit"
          style={{ color: stepColor }}
          title="انقر لنسخ رقم الطلب"
        >
          #{order.reference_id || order.id}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px]">📋</span>
        </button>
        <p className="text-xs font-bold text-gray-800 truncate">{order.customer_name}</p>
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <Phone className="w-3 h-3" /> {order.customer_phone}
        </p>
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(order.created_at).toLocaleDateString("ar-DZ")}
        </p>
        <p
          className="text-[12px] font-black mt-0.5"
          style={{ color: isCancelled ? "#ef4444" : "#16a34a" }}
        >
          {Math.round(price).toLocaleString("ar-DZ")} دج
        </p>
        {/* Tracking number (copyable) — only if assigned to courier */}
        {hasCourier && (
          <button
            onClick={() => navigator.clipboard?.writeText(order.tracking_number!)}
            className="text-[10px] font-mono text-right flex items-center gap-1 group w-fit max-w-full truncate mt-0.5"
            style={{ color: "#6b7280" }}
            title="انقر لنسخ رقم التتبع"
          >
            🚚 {order.tracking_number}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px]">📋</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px my-3 bg-gray-100 flex-shrink-0" />

      {/* Tracking bar */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
        {/* Source label: courier or internal */}
        <div className="flex items-center gap-1.5 mb-1">
          {hasCourier ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "#e5f0ff", color: "#007aff" }}
            >
              🛰️ {order.delivery_company || "شركة التوصيل"}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              📋 حالة داخلية
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
    { key: "all",              label: "الكل",         emoji: "📋" },
    { key: "pending",          label: "تم التأكيد",   emoji: "✅" },
    { key: "confirmed",        label: "قيد التجهيز",  emoji: "📦" },
    { key: "processing",       label: "تم الشحن",     emoji: "🔧" },
    { key: "shipped",          label: "في الطريق",    emoji: "🚚" },
    { key: "in_transit",       label: "في الطريق",    emoji: "🛣️" },
    { key: "out_for_delivery", label: "خرج للتسليم",  emoji: "🏠" },
    { key: "delivered",        label: "تم التسليم",   emoji: "🎉" },
    { key: "completed",        label: "مكتمل",        emoji: "🎉" },
    { key: "cancelled",        label: "ملغي",         emoji: "⛔️" },
    { key: "returned",         label: "مرتجع",        emoji: "↩️" },
    { key: "failed",           label: "فشل",          emoji: "❌" },
  ];

  const TAB_STYLE: Record<string, { activeBg: string; activeText: string; badgeBg: string; badgeText: string }> = {
    all:              { activeBg: "#007aff", activeText: "#fff", badgeBg: "#e5f0ff", badgeText: "#007aff" },
    pending:          { activeBg: "#34c759", activeText: "#fff", badgeBg: "#e8fbed", badgeText: "#16a34a" },
    confirmed:        { activeBg: "#007aff", activeText: "#fff", badgeBg: "#e5f0ff", badgeText: "#007aff" },
    processing:       { activeBg: "#5856d6", activeText: "#fff", badgeBg: "#efedff", badgeText: "#5856d6" },
    shipped:          { activeBg: "#ff9500", activeText: "#fff", badgeBg: "#fff5e5", badgeText: "#d97706" },
    in_transit:       { activeBg: "#ff9500", activeText: "#fff", badgeBg: "#fff5e5", badgeText: "#d97706" },
    out_for_delivery: { activeBg: "#ff2d55", activeText: "#fff", badgeBg: "#ffe5ea", badgeText: "#be123c" },
    out_delivery:     { activeBg: "#ff2d55", activeText: "#fff", badgeBg: "#ffe5ea", badgeText: "#be123c" },
    delivered:        { activeBg: "#34c759", activeText: "#fff", badgeBg: "#e8fbed", badgeText: "#16a34a" },
    completed:        { activeBg: "#34c759", activeText: "#fff", badgeBg: "#e8fbed", badgeText: "#16a34a" },
    cancelled:        { activeBg: "#ef4444", activeText: "#fff", badgeBg: "#fef2f2", badgeText: "#dc2626" },
    returned:         { activeBg: "#f97316", activeText: "#fff", badgeBg: "#fff7ed", badgeText: "#ea580c" },
    failed:           { activeBg: "#ef4444", activeText: "#fff", badgeBg: "#fef2f2", badgeText: "#dc2626" },
  };
  const fallbackTab = { activeBg: "#6b7280", activeText: "#fff", badgeBg: "#f3f4f6", badgeText: "#374151" };

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

  // quick stat counts
  const inTransit  = orders.filter(o => ["shipped","in_transit","out_for_delivery","out_delivery"].includes(o.status)).length;
  const delivered  = orders.filter(o => ["delivered","completed"].includes(o.status)).length;
  const failed     = orders.filter(o => ["failed","cancelled","returned"].includes(o.status)).length;

  return (
    <div className="space-y-5 py-4" dir="rtl">

      {/* ── Hero header ───────────────────────────────── */}
      <div
        className="rounded-3xl px-6 py-5 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, #007aff 0%, #5856d6 60%, #af52de 100%)",
          boxShadow: "0 8px 32px rgba(0,122,255,0.25)",
        }}
      >
        <div className="text-white">
          <h1 className="text-2xl font-black tracking-tight">تتبع الطلبات 🚚</h1>
          <p className="text-white/70 text-sm mt-0.5">تابع رحلة كل طلب لحظة بلحظة</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-60"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)" }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* ── Quick stats ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "في الطريق", count: inTransit,  color: "#ff9500", bg: "#fff8ee", emoji: "🚚" },
          { label: "تم التسليم", count: delivered, color: "#34c759", bg: "#edfff2", emoji: "✅" },
          { label: "فشل / ملغي", count: failed,    color: "#ef4444", bg: "#fff0f0", emoji: "❌" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[11px] text-gray-500 font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث برقم الطلب، اسم العميل أو الهاتف..."
          className="w-full pr-10 pl-4 py-3 rounded-2xl text-sm outline-none transition-all"
          style={{
            background: "#fff",
            border: "1.5px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "#007aff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,122,255,0.12)"; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
        />
      </div>

      {/* ── Status Tabs ──────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap">
        {STATUS_TABS.filter(tab => tab.key === "all" || tabCounts[tab.key] > 0).map(tab => {
          const active = statusFilter === tab.key;
          const tc = TAB_STYLE[tab.key] ?? fallbackTab;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: active ? tc.activeBg : "#fff",
                color: active ? tc.activeText : "#6b7280",
                border: `1.5px solid ${active ? tc.activeBg : "#e5e7eb"}`,
                boxShadow: active ? `0 2px 8px ${tc.activeBg}50` : undefined,
              }}
            >
              {tab.emoji} {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black"
                  style={{
                    background: active ? "rgba(255,255,255,0.3)" : tc.badgeBg,
                    color: active ? "#fff" : tc.badgeText,
                  }}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-5xl animate-bounce">🚚</div>
          <p className="text-sm font-semibold text-gray-500">جاري تحميل الطلبات...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">تعذر تحميل الطلبات</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <span className="text-6xl">📭</span>
          <p className="text-gray-500 font-bold text-lg">لا توجد طلبات</p>
          <p className="text-xs text-gray-400">{search ? "لا توجد نتائج للبحث" : "لا توجد طلبات بهذا الفلتر"}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            يتم عرض <span className="font-bold text-gray-600">{paginated.length}</span> من أصل <span className="font-bold text-gray-600">{filtered.length}</span> طلب
          </p>
          <div className="space-y-2.5">
            {paginated.map(order => <OrderRow key={order.id} order={order} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors">
                السابق
              </button>
              <span className="text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2">
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors">
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
