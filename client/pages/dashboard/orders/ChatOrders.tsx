import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw, Search, Bot, ShoppingBag, TrendingUp,
  X, Copy, Check, Download, ChevronRight, Phone, MapPin,
  Send, Truck, CheckCircle, XCircle, Clock, Package,
  AlertTriangle, ChevronDown, MessageCircle, Edit3, Save, Loader2,
} from "lucide-react";
import { OrderFulfillment } from "@/components/delivery/OrderFulfillment";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAlgeriaCommunesByWilayaId, getAlgeriaWilayas } from "@/lib/algeriaGeo";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  product_title: string;
  product_images: string[];
  quantity: number;
  total_price: number;
  unit_price: number;
  delivery_fee: number;
  status: string;
  delivery_type: string;
  shipping_address: string;
  shipping_wilaya_id?: number | null;
  shipping_commune_id?: number | null;
  source_platform: string;
  tracking_number?: string;
  delivery_status?: string;
  created_at: string;
  variant_id?: number;
  variant_color?: string;
  variant_size?: string;
  variant_name?: string;
}

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; emoji: string; color: string; bg: string; darkBg: string }> = {
  telegram:  { label: "Telegram",  emoji: "✈️", color: "#229ED9", bg: "#e8f5fb",  darkBg: "rgba(34,158,217,0.15)" },
  whatsapp:  { label: "WhatsApp",  emoji: "💬", color: "#25D366", bg: "#e8faf0",  darkBg: "rgba(37,211,102,0.15)"  },
  messenger: { label: "Messenger", emoji: "🟦", color: "#0084FF", bg: "#e5f2ff",  darkBg: "rgba(0,132,255,0.15)"   },
  instagram: { label: "Instagram", emoji: "📸", color: "#E1306C", bg: "#fde8ef",  darkBg: "rgba(225,48,108,0.15)"  },
};

// ─── Status config (mirrors Orders page built-ins) ────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: "قيد الانتظار",  color: "#eab308", icon: "●"  },
  confirmed:  { label: "مؤكد",          color: "#22c55e", icon: "✓"  },
  processing: { label: "قيد التجهيز",   color: "#3b82f6", icon: "◐"  },
  shipped:    { label: "تم الشحن",      color: "#8b5cf6", icon: "📦" },
  delivered:  { label: "تم التسليم",    color: "#10b981", icon: "✓"  },
  cancelled:  { label: "ملغى",          color: "#ef4444", icon: "✕"  },
  duplicate:  { label: "مكرر",          color: "#9ca3af", icon: "📋" },
  fake:       { label: "مشبوه",         color: "#dc2626", icon: "⚠️" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseUTCDate(s: string) {
  if (!s) return new Date();
  if (s.includes("Z") || s.includes("+")) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - parseUTCDate(iso).getTime()) / 60000);
  if (mins < 1)   return "الآن";
  if (mins < 60)  return `منذ ${mins} دقيقة`;
  if (mins < 1440) return `منذ ${Math.floor(mins / 60)} ساعة`;
  return `منذ ${Math.floor(mins / 1440)} يوم`;
}

function fmtPrice(n: number) {
  return Math.round(n).toLocaleString("ar-DZ");
}

function exportCSV(rows: ChatOrder[]) {
  const headers = ["رقم الطلب", "المنصة", "العميل", "الهاتف", "المنتج", "الكمية", "المبلغ", "الحالة", "التاريخ"];
  const lines = [
    headers.join(","),
    ...rows.map(o => [
      o.id,
      o.source_platform,
      `"${o.customer_name || ""}"`,
      o.customer_phone || "",
      `"${o.product_title || ""}"`,
      o.quantity,
      Math.round(Number(o.total_price)),
      o.status,
      parseUTCDate(o.created_at).toLocaleDateString("ar-DZ"),
    ].join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `chat-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status update options ─────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "pending",    label: "قيد الانتظار",  icon: <Clock className="w-3 h-3" />,        color: "#eab308" },
  { value: "confirmed",  label: "مؤكد",           icon: <CheckCircle className="w-3 h-3" />,   color: "#22c55e" },
  { value: "processing", label: "قيد التجهيز",    icon: <Package className="w-3 h-3" />,       color: "#3b82f6" },
  { value: "shipped",    label: "تم الشحن",       icon: <Truck className="w-3 h-3" />,         color: "#8b5cf6" },
  { value: "delivered",  label: "تم التسليم",     icon: <CheckCircle className="w-3 h-3" />,   color: "#10b981" },
  { value: "cancelled",  label: "ملغى",           icon: <XCircle className="w-3 h-3" />,       color: "#ef4444" },
  { value: "fake",       label: "مشبوه",          icon: <AlertTriangle className="w-3 h-3" />, color: "#dc2626" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChatOrders() {
  const [orders,         setOrders]         = useState<ChatOrder[]>([]);
  const [total,          setTotal]           = useState(0);
  const [loading,        setLoading]         = useState(true);
  const [loadingMore,    setLoadingMore]     = useState(false);
  const [isRefreshing,   setIsRefreshing]    = useState(false);
  const [search,         setSearch]          = useState("");
  const [platformFilter, setPlatformFilter]  = useState("all");
  const [statusFilter,   setStatusFilter]    = useState("all");
  const [dateRange,      setDateRange]       = useState<"all"|"today"|"week"|"month">("all");
  const [expandedId,     setExpandedId]      = useState<number | null>(null);
  const [copiedKey,      setCopiedKey]       = useState<string | null>(null);
  const [newCount,       setNewCount]        = useState(0);
  const [actionLoading,  setActionLoading]   = useState<number | null>(null);
  const [statusDropdown, setStatusDropdown]  = useState<number | null>(null);
  const [msgInput,       setMsgInput]        = useState<Record<number, string>>({});
  const [msgSending,     setMsgSending]      = useState<number | null>(null);
  const [toast,          setToast]           = useState<{ text: string; ok: boolean } | null>(null);
  const [showEditModal,  setShowEditModal]   = useState(false);
  const [editingOrder,   setEditingOrder]    = useState<ChatOrder | null>(null);
  const [editForm,       setEditForm]        = useState({ customer_name: "", customer_phone: "", shipping_address: "", quantity: 1, delivery_type: "home", shipping_wilaya_id: "", shipping_commune_id: "" });
  const [savingEdit,     setSavingEdit]      = useState(false);
  const [deliveryOrder,  setDeliveryOrder]   = useState<ChatOrder | null>(null);
  const [hasMore,        setHasMore]         = useState(false);
  const [confirmStatus,  setConfirmStatus]   = useState<{ orderId: number; status: string } | null>(null);
  const prevCountRef = useRef(0);
  const offsetRef = useRef(0);
  const LIMIT = 50;

  const showToast = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  // ── Load ──
  const load = useCallback(async (silent = false, append = false) => {
    if (!silent) { setIsRefreshing(true); setLoading(true); }
    if (append) setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (append) params.set("offset", String(offsetRef.current));
      const res  = await fetch(`/api/client/orders/chat?${params}`, { credentials: "include" });
      const data = await res.json();
      const arr  = data.orders || [];
      setOrders(prev => append ? [...prev, ...arr] : arr);
      setTotal(data.total || arr.length);
      setHasMore(data.hasMore || false);
      if (!append) offsetRef.current = arr.length;
      else offsetRef.current += arr.length;
    } catch {
      if (!append) setOrders([]);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [platformFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Poll 30 s, pause when tab hidden ──
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const tick = () => {
      if (!document.hidden) load(true);
    };
    id = setInterval(tick, 30000);
    const onVis = () => { if (!document.hidden) load(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  // ── New-order badge ──
  useEffect(() => {
    if (prevCountRef.current === 0) { prevCountRef.current = orders.length; return; }
    const diff = orders.length - prevCountRef.current;
    if (diff > 0) setNewCount(p => p + diff);
    prevCountRef.current = orders.length;
  }, [orders.length]);

  // ── Update status ──
  const updateStatus = async (orderId: number, newStatus: string) => {
    if (["cancelled", "fake"].includes(newStatus)) {
      setConfirmStatus({ orderId, status: newStatus });
      return;
    }
    await doUpdateStatus(orderId, newStatus);
  };

  const doUpdateStatus = async (orderId: number, newStatus: string) => {
    setActionLoading(orderId);
    setStatusDropdown(null);
    setConfirmStatus(null);
    try {
      const csrf = document.cookie.match(/ecopro_csrf=([^;]*)/)?.[1] || "";
      const res = await fetch(`/api/client/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      showToast("✓ تم تحديث الحالة");
    } catch {
      showToast("فشل تحديث الحالة", false);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Send bot message ──
  const sendMessage = async (orderId: number, intent: string, channel: string) => {
    if (!intent.trim()) return;
    setMsgSending(orderId);
    try {
      const csrf = document.cookie.match(/ecopro_csrf=([^;]*)/)?.[1] || "";
      const res = await fetch("/api/ai/bot-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        credentials: "include",
        body: JSON.stringify({ type: "bot_send_message", orderId, intent, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      showToast(`✓ تم إرسال الرسالة${data.preview ? `: "${data.preview.slice(0, 60)}..."` : ""}`);
      setMsgInput(prev => ({ ...prev, [orderId]: "" }));
    } catch (e: any) {
      showToast(e.message || "فشل إرسال الرسالة", false);
    } finally {
      setMsgSending(null);
    }
  };

  // ── Edit order ──
  const openEdit = (o: ChatOrder) => {
    setEditingOrder(o);
    setEditForm({
      customer_name: o.customer_name || "",
      customer_phone: o.customer_phone || "",
      shipping_address: o.shipping_address || "",
      quantity: o.quantity,
      delivery_type: o.delivery_type || "home",
      shipping_wilaya_id: o.shipping_wilaya_id != null ? String(o.shipping_wilaya_id) : "",
      shipping_commune_id: o.shipping_commune_id != null ? String(o.shipping_commune_id) : "",
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    setSavingEdit(true);
    try {
      const csrf = document.cookie.match(/ecopro_csrf=([^;]*)/)?.[1] || "";
      const body: Record<string, any> = {
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        shipping_address: editForm.shipping_address,
        quantity: editForm.quantity,
        delivery_type: editForm.delivery_type,
      };
      if (editForm.shipping_wilaya_id) body.shipping_wilaya_id = Number(editForm.shipping_wilaya_id);
      if (editForm.shipping_commune_id) body.shipping_commune_id = Number(editForm.shipping_commune_id);
      const res = await fetch(`/api/client/orders/${editingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? {
        ...o,
        customer_name: updated.customer_name ?? editForm.customer_name,
        customer_phone: updated.customer_phone ?? editForm.customer_phone,
        shipping_address: updated.shipping_address ?? editForm.shipping_address,
        quantity: Number(updated.quantity ?? editForm.quantity),
        delivery_type: updated.delivery_type ?? editForm.delivery_type,
        total_price: Number(updated.total_price ?? o.total_price),
        unit_price: Number(updated.unit_price ?? o.unit_price),
        delivery_fee: Number(updated.delivery_fee ?? o.delivery_fee),
        shipping_wilaya_id: updated.shipping_wilaya_id ?? o.shipping_wilaya_id,
        shipping_commune_id: updated.shipping_commune_id ?? o.shipping_commune_id,
      } : o));
      setShowEditModal(false);
      setEditingOrder(null);
      showToast("✓ تم حفظ التعديلات");
    } catch {
      showToast("فشل حفظ التعديلات", false);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Derived ──
  const filtered = orders.filter(o => {
    const q = search.trim().toLowerCase();
    if (q && !(
      String(o.id).includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").includes(q) ||
      (o.product_title || "").toLowerCase().includes(q)
    )) return false;

    if (statusFilter !== "all" && o.status !== statusFilter) return false;

    if (dateRange !== "all") {
      const cutoff = dateRange === "today" ? Date.now() - 86400000
                   : dateRange === "week"  ? Date.now() - 7  * 86400000
                   :                         Date.now() - 30 * 86400000;
      if (parseUTCDate(o.created_at).getTime() < cutoff) return false;
    }
    return true;
  });

  const revenue        = orders.filter(o => !["cancelled","fake"].includes(o.status)).reduce((s, o) => s + Number(o.total_price || 0), 0);
  const confirmedCount = orders.filter(o => o.status === "confirmed").length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="pt-4" dir="rtl" onClick={() => setStatusDropdown(null)}>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-bold text-white transition-all ${toast.ok ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {/* ── New orders banner ── */}
      {newCount > 0 && (
        <div
          onClick={() => { setNewCount(0); load(); }}
          className="mb-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-500/15 to-indigo-500/10 border border-violet-500/30 px-4 py-3 cursor-pointer hover:from-violet-500/25 transition-all shadow-sm shadow-violet-500/10"
        >
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-violet-600 animate-bounce" />
          </div>
          <div>
            <span className="text-sm font-bold text-violet-700 dark:text-violet-400 block">🤖 {newCount} طلب جديد من الدردشة!</span>
            <span className="text-xs text-violet-600/70">انقر للتحديث</span>
          </div>
          <span className="ml-auto text-xs font-bold bg-violet-500 text-white px-2.5 py-1 rounded-full animate-pulse">{newCount}</span>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5 hover:border-violet-500/50 transition-all shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-xl font-black tabular-nums leading-none">{total}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">طلبيات الرسائل</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5 hover:border-emerald-500/50 transition-all shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow">
            <TrendingUp className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-xl font-black tabular-nums leading-none text-emerald-500">{confirmedCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">مؤكد</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5 hover:border-amber-500/50 transition-all shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow text-sm leading-none">💰</div>
          <div>
            <div className="text-xl font-black tabular-nums leading-none text-amber-500">{fmtPrice(revenue)}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">الإيرادات · دج</div>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-md overflow-hidden">

        {/* Toolbar */}
        <div className="p-3 border-b border-border/40 bg-gradient-to-r from-muted/20 to-transparent">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base md:text-lg font-black bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2">
              <span className="inline-block w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500"></span>
              طلبيات الرسائل
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => load()}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted transition-all h-8 shadow-sm disabled:opacity-50"
              >
                {isRefreshing
                  ? <><span className="w-3 h-3 border-2 border-violet-400/40 border-t-violet-500 rounded-full animate-spin" /> جارٍ التحديث</>
                  : <><RefreshCw className="h-3.5 w-3.5" /> تحديث</>}
              </button>
              <button
                onClick={() => exportCSV(filtered)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted transition-all h-8 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">تصدير CSV</span>
              </button>
            </div>
          </div>

          {/* Search + date */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث برقم الطلب، الاسم، الهاتف، المنتج..."
                className="w-full h-9 pr-9 pl-3 rounded-lg border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 focus:bg-background transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded-full hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
              {(["all","today","week","month"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 h-7 rounded-md text-xs font-bold transition-all flex-1 sm:flex-none ${dateRange === r ? "bg-violet-500 text-white shadow-sm shadow-violet-500/30" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}
                >
                  {r === "all" ? "الكل" : r === "today" ? "اليوم" : r === "week" ? "7 أيام" : "30 يوم"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Platform + status tabs */}
        <div className="border-b border-border/40 bg-muted/10 px-3 py-2 flex flex-wrap gap-1.5">
          {/* Platform pills */}
          <button
            onClick={() => setPlatformFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              platformFilter === "all"
                ? "bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/30"
                : "bg-background text-muted-foreground border-border hover:border-violet-400/40 hover:text-foreground"
            }`}
          >
            🤖 الكل ({orders.length})
          </button>
          {Object.entries(PLATFORM_META).map(([key, meta]) => {
            const cnt = orders.filter(o => o.source_platform === key).length;
            const active = platformFilter === key;
            return (
              <button
                key={key}
                onClick={() => setPlatformFilter(key)}
                style={active ? { backgroundColor: meta.color, borderColor: meta.color, boxShadow: `0 4px 12px ${meta.color}40` } : { color: meta.color, borderColor: `${meta.color}40`, backgroundColor: meta.bg }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${active ? "text-white" : ""}`}
              >
                {meta.emoji} {meta.label} ({cnt})
              </button>
            );
          })}
          <div className="w-px bg-border/60 mx-1 self-stretch" />
          {/* Status pills */}
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:text-foreground"}`}
          >
            كل الحالات
          </button>
          {Object.entries(STATUS_META).map(([key, s]) => {
            const cnt   = orders.filter(o => o.status === key).length;
            const active = statusFilter === key;
            if (!cnt && !active) return null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                style={active
                  ? { backgroundColor: s.color, borderColor: s.color, color: "#fff", boxShadow: `0 4px 12px ${s.color}40` }
                  : { color: s.color, borderColor: `${s.color}40`, backgroundColor: `${s.color}15` }}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
              >
                {s.icon} {s.label} ({cnt})
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="overflow-x-auto">
          {loading && (
            <>
              {/* Desktop skeleton */}
              <div className="hidden lg:block">
                <table className="w-full text-sm font-semibold">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/50 dark:bg-muted/20">
                      {["الصورة", "رقم الطلب", "المنصة", "المنتج", "العميل", "المبلغ", "الحالة", "الوقت", ""].map(h => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2.5"><div className="w-11 h-11 rounded-xl bg-muted/60 animate-pulse ml-auto" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-20 rounded-md bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-32 rounded bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-24 rounded bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-14 rounded bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" /></td>
                        <td className="px-3 py-2.5"><div className="h-5 w-12 rounded bg-muted/60 animate-pulse" /></td>
                        <td className="px-2 py-2.5"><div className="h-4 w-4 rounded bg-muted/60 animate-pulse" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile skeleton */}
              <div className="lg:hidden space-y-3 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-card p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-muted/60 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
                        <div className="h-3 w-40 rounded bg-muted/60 animate-pulse" />
                        <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-20 rounded bg-muted/60 animate-pulse" />
                      <div className="h-5 w-16 rounded-full bg-muted/60 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && orders.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-base">لا توجد طلبيات دردشة بعد</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  عندما يطلب العملاء عبر الذكاء الاصطناعي في Telegram أو WhatsApp أو Messenger، ستظهر طلباتهم هنا تلقائياً
                </p>
              </div>
            </div>
          )}

          {!loading && orders.length > 0 && filtered.length === 0 && (
            <div className="p-8 text-center">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm font-semibold text-muted-foreground">لا توجد نتائج</p>
              <p className="text-xs text-muted-foreground mt-1">جرّب تغيير الفلتر أو كلمة البحث</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <>
            {/* Desktop Table */}
            <table className="hidden lg:table w-full text-sm font-semibold">
              <thead>
                <tr className="border-b border-border/50 bg-muted/50 dark:bg-muted/20">
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">الصورة</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">رقم الطلب</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">المنصة</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">المنتج</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">العميل</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">المبلغ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">الحالة</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-xs text-foreground/60 uppercase tracking-wider">الوقت</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const pm    = PLATFORM_META[o.source_platform] || { label: o.source_platform || "AI", emoji: "🤖", color: "#6b7280", bg: "#f3f4f6", darkBg: "rgba(107,114,128,0.15)" };
                  const sm    = STATUS_META[o.status]            || { label: o.status, color: "#6b7280", icon: "●" };
                  const img   = Array.isArray(o.product_images) ? o.product_images[0] : null;
                  const open  = expandedId === o.id;

                  return (
                    <React.Fragment key={o.id}>
                      <tr
                        onClick={() => setExpandedId(open ? null : o.id)}
                        className={`group border-b border-border/30 transition-all duration-150 cursor-pointer hover:bg-primary/5 ${open ? "bg-violet-500/5" : ""}`}
                      >
                        {/* Image */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          {img ? (
                            <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-border/40 ml-auto shadow-sm group-hover:border-violet-500/30 transition-all">
                              <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-muted/80 flex items-center justify-center border-2 border-border/30 ml-auto">
                              <ShoppingBag className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </td>

                        {/* Order # */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => copy(`ORD-${String(o.id).padStart(3,"0")}`, `id-${o.id}`)}
                            className="inline-flex items-center gap-1.5 group/copy hover:text-violet-600 transition-colors font-mono text-xs font-bold bg-muted/50 hover:bg-violet-500/10 px-2 py-1 rounded-md"
                          >
                            ORD-{String(o.id).padStart(3,"0")}
                            {copiedKey === `id-${o.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-70" />}
                          </button>
                        </td>

                        {/* Platform */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ color: pm.color, background: pm.bg }}
                          >
                            <span>{pm.emoji}</span>
                            {pm.label}
                          </span>
                        </td>

                        {/* Product */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span className="text-sm font-semibold max-w-[160px] truncate block" title={o.product_title}>
                            {o.product_title || "—"}
                          </span>
                          {o.variant_name && <span className="text-xs text-muted-foreground block">{o.variant_name}</span>}
                          {(o.variant_color || o.variant_size) && (
                            <span className="text-xs text-muted-foreground block">
                              {o.variant_color && <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: o.variant_color }}></span>}
                              {o.variant_color}{o.variant_size ? ` / ${o.variant_size}` : ''}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">×{o.quantity}</span>
                        </td>

                        {/* Customer */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold max-w-[140px] truncate block" title={o.customer_name}>{o.customer_name || "—"}</span>
                            {o.customer_phone && (
                              <button
                                onClick={() => copy(o.customer_phone, `ph-${o.id}`)}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 transition-colors group/ph"
                                dir="ltr"
                              >
                                {o.customer_phone}
                                {copiedKey === `ph-${o.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-0 group-hover/ph:opacity-60" />}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span className="text-sm font-black tabular-nums">{fmtPrice(Number(o.total_price))}</span>
                          <span className="text-xs text-muted-foreground mr-0.5">دج</span>
                        </td>

                        {/* Status — interactive dropdown */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="relative inline-block">
                            <button
                              onClick={() => setStatusDropdown(statusDropdown === o.id ? null : o.id)}
                              disabled={actionLoading === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:opacity-80 active:scale-95"
                              style={{ color: sm.color, background: `${sm.color}18`, border: `1px solid ${sm.color}30` }}
                            >
                              {actionLoading === o.id
                                ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                : <span>{sm.icon}</span>}
                              {sm.label}
                              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                            </button>
                            {statusDropdown === o.id && (
                              <div className="absolute top-full mt-1 right-0 z-30 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                                {STATUS_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => updateStatus(o.id, opt.value)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors text-right ${o.status === opt.value ? "opacity-40 pointer-events-none" : ""}`}
                                    style={{ color: opt.color }}
                                  >
                                    {opt.icon}
                                    {opt.label}
                                    {o.status === opt.value && <Check className="w-3 h-3 mr-auto" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Time */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
                        </td>

                        {/* Expand toggle */}
                        <td className="px-2 py-2.5 text-center">
                          <ChevronRight className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-90" : "group-hover:translate-x-0.5"}`} />
                        </td>
                      </tr>

                      {/* ── Expanded panel ── Desktop */}
                      {open && (
                        <tr className="border-b border-border/30 hidden lg:table-row">
                          <td colSpan={9} className="p-0">
                            <div className="bg-gradient-to-r from-violet-500/5 via-background to-indigo-500/5 border-t border-violet-500/10 px-4 py-4 space-y-4">

                              {/* Info grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> عنوان التوصيل
                                  </span>
                                  <span className="font-semibold text-foreground truncate block" title={o.shipping_address}>{o.shipping_address || "—"}</span>
                                  <span className="text-xs text-muted-foreground">{o.delivery_type === "desk" ? "🏪 توصيل للمكتب" : "🏠 توصيل للمنزل"}</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> التواصل
                                  </span>
                                  <span className="font-semibold text-foreground" dir="ltr">{o.customer_phone || "—"}</span>
                                  <span className="text-xs capitalize" style={{ color: pm.color }}>{pm.emoji} {pm.label}</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">تفاصيل المبلغ</span>
                                  <span className="text-xs text-muted-foreground">سعر الوحدة: <strong className="text-foreground">{fmtPrice(Number(o.unit_price))} دج</strong></span>
                                  <span className="text-xs text-muted-foreground">رسوم التوصيل: <strong className="text-foreground">{fmtPrice(Number(o.delivery_fee))} دج</strong></span>
                                  <span className="text-xs font-black text-amber-600">الإجمالي: {fmtPrice(Number(o.total_price))} دج</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">التاريخ</span>
                                  <span className="text-xs text-foreground">
                                    {parseUTCDate(o.created_at).toLocaleDateString("ar-DZ", { day: "2-digit", month: "long", year: "numeric" })}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {parseUTCDate(o.created_at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {o.tracking_number && (
                                    <button onClick={() => copy(o.tracking_number!, `trk-${o.id}`)} className="text-xs font-mono text-violet-600 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded w-fit flex items-center gap-1 transition-colors">
                                      🚚 {o.tracking_number}
                                      {copiedKey === `trk-${o.id}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* ── Status shortcuts row ── */}
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                                <span className="text-[11px] font-bold text-muted-foreground">تغيير الحالة:</span>
                                {STATUS_OPTIONS.filter(s => s.value !== o.status).slice(0, 5).map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => updateStatus(o.id, opt.value)}
                                    disabled={actionLoading === o.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                                    style={{ color: opt.color, borderColor: `${opt.color}40`, background: `${opt.color}10` }}
                                  >
                                    {opt.icon} {opt.label}
                                  </button>
                                ))}
                              </div>

                              {/* ── Feature actions row ── */}
                              <div className="flex items-center gap-3 pt-1">
                                {/* Edit order — blue, data action */}
                                <button
                                  onClick={() => openEdit(o)}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-sm shadow-blue-500/30 transition-all active:scale-95"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  تعديل الطلب
                                </button>

                                {/* Upload to delivery — orange/amber, logistics action */}
                                <button
                                  onClick={() => setDeliveryOrder(o)}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm shadow-orange-500/30 transition-all active:scale-95"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  رفع للتوصيل
                                </button>

                                {/* Tracking — slate, navigation action */}
                                <a
                                  href="/dashboard/tracking"
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-sm shadow-slate-700/30 transition-all active:scale-95"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  تتبع الشحن
                                </a>
                              </div>

                              {/* Send message panel */}
                              <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl p-2">
                                <MessageCircle className="w-4 h-4 text-violet-500 shrink-0" />
                                <input
                                  value={msgInput[o.id] || ""}
                                  onChange={e => setMsgInput(prev => ({ ...prev, [o.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") sendMessage(o.id, msgInput[o.id] || "", o.source_platform); }}
                                  placeholder={`أرسل رسالة للزبون عبر ${pm.label}...`}
                                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                                  dir="rtl"
                                />
                                <div className="flex items-center gap-1">
                                  {["messenger","whatsapp","telegram"].map(ch => (
                                    <button
                                      key={ch}
                                      onClick={() => sendMessage(o.id, msgInput[o.id] || "", ch)}
                                      disabled={!msgInput[o.id]?.trim() || msgSending === o.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-30 hover:bg-muted"
                                      style={{
                                        color: ch === "messenger" ? "#0084FF" : ch === "whatsapp" ? "#25D366" : "#229ED9",
                                        borderColor: ch === "messenger" ? "#0084FF40" : ch === "whatsapp" ? "#25D36640" : "#229ED940",
                                      }}
                                    >
                                      {msgSending === o.id ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                                      {ch === "messenger" ? "M" : ch === "whatsapp" ? "W" : "TG"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {filtered.map(o => {
                const pm    = PLATFORM_META[o.source_platform] || { label: o.source_platform || "AI", emoji: "🤖", color: "#6b7280", bg: "#f3f4f6", darkBg: "rgba(107,114,128,0.15)" };
                const sm    = STATUS_META[o.status]            || { label: o.status, color: "#6b7280", icon: "●" };
                const img   = Array.isArray(o.product_images) ? o.product_images[0] : null;
                const open  = expandedId === o.id;

                return (
                  <div
                    key={o.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${open ? "border-violet-500/40 bg-violet-500/5" : "border-border/50 bg-card hover:border-violet-300/30"}`}
                  >
                    {/* Card Header - Click to expand */}
                    <div
                      onClick={() => setExpandedId(open ? null : o.id)}
                      className="p-3 flex items-center gap-3 cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        {img ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-border/40 shadow-sm">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-muted/80 flex items-center justify-center border-2 border-border/40">
                            <ShoppingBag className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); copy(`ORD-${String(o.id).padStart(3,"0")}`, `id-${o.id}`); }}
                            className="font-mono text-xs font-bold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded"
                          >
                            ORD-{String(o.id).padStart(3,"0")}
                          </button>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ color: pm.color, background: pm.bg }}
                          >
                            {pm.emoji} {pm.label}
                          </span>
                        </div>
                        <p className="text-sm font-bold truncate">{o.product_title || "—"}</p>
                        {o.variant_name && <p className="text-xs text-muted-foreground">{o.variant_name}</p>}
                        {(o.variant_color || o.variant_size) && (
                          <p className="text-xs text-muted-foreground">
                            {o.variant_color && <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: o.variant_color }}></span>}
                            {o.variant_color}{o.variant_size ? ` / ${o.variant_size}` : ''}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">×{o.quantity}</span>
                          <span className="text-sm font-black text-emerald-600">{fmtPrice(Number(o.total_price))} دج</span>
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
                    </div>

                    {/* Card Actions Row */}
                    <div className="px-3 pb-3 flex items-center justify-between gap-2 border-t border-border/30 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate max-w-[120px]" title={o.customer_name}>{o.customer_name || "—"}</span>
                        {o.customer_phone && (
                          <button
                            onClick={() => copy(o.customer_phone, `ph-${o.id}`)}
                            className="text-[10px] text-muted-foreground hover:text-violet-600"
                            dir="ltr"
                          >
                            {o.customer_phone}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === o.id ? null : o.id); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                          style={{ color: sm.color, background: `${sm.color}18`, border: `1px solid ${sm.color}30` }}
                        >
                          {sm.icon} {sm.label}
                        </button>
                        {statusDropdown === o.id && (
                          <div className="absolute top-full mt-1 right-0 z-30 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => { updateStatus(o.id, opt.value); setStatusDropdown(null); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors text-right"
                                style={{ color: opt.color }}
                              >
                                {opt.icon} {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground">{timeAgo(o.created_at)}</span>
                      </div>
                    </div>

                    {/* Expanded Panel */}
                    {open && (
                      <div className="border-t border-violet-500/10 bg-gradient-to-r from-violet-500/5 via-background to-indigo-500/5 px-3 py-3 space-y-3">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground">العنوان</span>
                            <p className="font-semibold truncate">{o.shipping_address || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">الهاتف</span>
                            <p className="font-semibold" dir="ltr">{o.customer_phone || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">السعر</span>
                            <p className="font-semibold">{fmtPrice(Number(o.unit_price))} دج × {o.quantity}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">التاريخ</span>
                            <p className="font-semibold">{parseUTCDate(o.created_at).toLocaleDateString("ar-DZ")}</p>
                          </div>
                          {o.variant_name && (
                            <div className="col-span-2">
                              <span className="text-[10px] text-muted-foreground">الخيار</span>
                              <p className="font-semibold">{o.variant_name}</p>
                            </div>
                          )}
                          {(o.variant_color || o.variant_size) && (
                            <div className="col-span-2">
                              <span className="text-[10px] text-muted-foreground">التفاصيل</span>
                              <p className="font-semibold">
                                {o.variant_color && <span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ backgroundColor: o.variant_color }}></span>}
                                {o.variant_color}{o.variant_size ? ` / ${o.variant_size}` : ''}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Status Change */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground">تغيير:</span>
                          {STATUS_OPTIONS.filter(s => s.value !== o.status).slice(0, 4).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateStatus(o.id, opt.value)}
                              disabled={actionLoading === o.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border"
                              style={{ color: opt.color, borderColor: `${opt.color}40`, background: `${opt.color}10` }}
                            >
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => openEdit(o)} className="flex-1 h-9 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                            <Edit3 className="w-3 h-3" /> تعديل
                          </button>
                          <button onClick={() => setDeliveryOrder(o)} className="flex-1 h-9 rounded-lg bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                            <Truck className="w-3 h-3" /> توصيل
                          </button>
                        </div>

                        {/* Message Input */}
                        <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-lg p-2">
                          <input
                            value={msgInput[o.id] || ""}
                            onChange={e => setMsgInput(prev => ({ ...prev, [o.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") sendMessage(o.id, msgInput[o.id] || "", o.source_platform); }}
                            placeholder={`رسالة ${pm.label}...`}
                            className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/50 focus:outline-none text-right"
                          />
                          <button
                            onClick={() => sendMessage(o.id, msgInput[o.id] || "", o.source_platform)}
                            disabled={!msgInput[o.id]?.trim() || msgSending === o.id}
                            className="h-8 px-2 rounded-md bg-violet-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                          >
                            {msgSending === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-border/40 bg-muted/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              عرض <strong>{filtered.length}</strong> من <strong>{total}</strong> طلب
            </span>
            <div className="flex items-center gap-2">
              {hasMore && (
                <button
                  onClick={() => load(true, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border bg-background text-xs font-bold hover:bg-muted transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="w-3 h-3 border-2 border-violet-400/40 border-t-violet-500 rounded-full animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  تحميل المزيد
                </button>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Bot className="w-3 h-3 text-violet-500" />
                مصدر: الذكاء الاصطناعي
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit order modal ── */}
      <Dialog open={showEditModal} onOpenChange={v => { if (!v) { setShowEditModal(false); setEditingOrder(null); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-500" />
              تعديل الطلب {editingOrder ? `ORD-${String(editingOrder.id).padStart(3,"0")}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4 pt-2">
              {/* Product summary (read-only) */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                {editingOrder.product_images?.[0] ? (
                  <img src={editingOrder.product_images[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/40" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-muted-foreground/50" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{editingOrder.product_title}</p>
                  {editingOrder.variant_name && <p className="text-xs text-muted-foreground">{editingOrder.variant_name}</p>}
                  {(editingOrder.variant_color || editingOrder.variant_size) && (
                    <p className="text-xs text-muted-foreground">
                      {editingOrder.variant_color && <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: editingOrder.variant_color }}></span>}
                      {editingOrder.variant_color}{editingOrder.variant_size ? ` / ${editingOrder.variant_size}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-sm font-black">{fmtPrice(Number(editingOrder.unit_price))} دج</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">اسم الزبون</label>
                  <input
                    value={editForm.customer_name}
                    onChange={e => setEditForm(p => ({ ...p, customer_name: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="اسم الزبون"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">رقم الهاتف</label>
                  <input
                    value={editForm.customer_phone}
                    onChange={e => setEditForm(p => ({ ...p, customer_phone: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">الولاية</label>
                  <select
                    value={editForm.shipping_wilaya_id}
                    onChange={e => setEditForm(p => ({ ...p, shipping_wilaya_id: e.target.value, shipping_commune_id: "" }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">اختر الولاية</option>
                    {getAlgeriaWilayas().map(w => (
                      <option key={w.id} value={String(w.id)}>{String(w.code).padStart(2, '0')} - {w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">البلدية</label>
                  <select
                    value={editForm.shipping_commune_id}
                    onChange={e => setEditForm(p => ({ ...p, shipping_commune_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                    disabled={!editForm.shipping_wilaya_id}
                  >
                    <option value="">اختر البلدية</option>
                    {getAlgeriaCommunesByWilayaId(editForm.shipping_wilaya_id).map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">العنوان التفصيلي</label>
                  <input
                    value={editForm.shipping_address}
                    onChange={e => setEditForm(p => ({ ...p, shipping_address: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="الحي، الشارع، رقم البناية..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">الكمية</label>
                  <div className="flex h-9">
                    <button
                      onClick={() => setEditForm(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
                      className="w-9 rounded-r-lg border border-border bg-muted/50 hover:bg-muted flex items-center justify-center text-sm font-bold transition-all"
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={editForm.quantity}
                      onChange={e => setEditForm(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="flex-1 h-full border-y border-border bg-muted/30 text-sm text-center font-bold tabular-nums focus:outline-none"
                      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                    />
                    <button
                      onClick={() => setEditForm(p => ({ ...p, quantity: Math.min(9999, p.quantity + 1) }))}
                      className="w-9 rounded-l-lg border border-border bg-muted/50 hover:bg-muted flex items-center justify-center text-sm font-bold transition-all"
                    >+</button>
                  </div>
                  {editingOrder && (
                    <p className="text-xs text-muted-foreground mt-1">
                      المجموع: <strong className="text-foreground">{fmtPrice(Number(editingOrder.unit_price) * editForm.quantity + Number(editingOrder.delivery_fee || 0))} دج</strong>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">نوع التوصيل</label>
                  <select
                    value={editForm.delivery_type}
                    onChange={e => setEditForm(p => ({ ...p, delivery_type: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="home">🏠 توصيل للمنزل</option>
                    <option value="desk">🏪 توصيل للمكتب</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ التعديلات
                </button>
                <button
                  onClick={() => { setShowEditModal(false); setEditingOrder(null); }}
                  className="h-10 px-4 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delivery assignment modal ── */}
      <Dialog open={!!deliveryOrder} onOpenChange={v => { if (!v) setDeliveryOrder(null); }}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-violet-500" />
              رفع للتوصيل — {deliveryOrder ? `ORD-${String(deliveryOrder.id).padStart(3,"0")}` : ""}
            </DialogTitle>
          </DialogHeader>
          {deliveryOrder && (
            <OrderFulfillment
              order={{
                id: deliveryOrder.id,
                customer_name: deliveryOrder.customer_name,
                customer_phone: deliveryOrder.customer_phone,
                customer_address: deliveryOrder.shipping_address,
                total_price: Number(deliveryOrder.total_price),
                delivery_company_id: undefined,
                tracking_number: deliveryOrder.tracking_number,
                delivery_status: deliveryOrder.delivery_status,
              }}
              onDeliveryAssigned={() => { setDeliveryOrder(null); load(); showToast("✓ تم رفع الطلب للتوصيل"); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm destructive status change ── */}
      <Dialog open={!!confirmStatus} onOpenChange={v => { if (!v) setConfirmStatus(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {confirmStatus?.status === "cancelled" ? "تأكيد إلغاء الطلب" : "تأكيد الطلب المشبوه"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {confirmStatus?.status === "cancelled"
                ? "هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
                : "هل أنت متأكد من وضع هذا الطلب كمشبوه؟ لا يمكن التراجع عن هذا الإجراء."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmStatus && doUpdateStatus(confirmStatus.orderId, confirmStatus.status)}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                {confirmStatus?.status === "cancelled" ? "تأكيد الإلغاء" : "تأكيد كمشبوه"}
              </button>
              <button
                onClick={() => setConfirmStatus(null)}
                className="h-10 px-4 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all"
              >
                رجوع
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
