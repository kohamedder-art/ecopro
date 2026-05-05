import { useState, useEffect } from "react";
import {
  Save, Loader2, MessageSquareText, ShieldAlert,
  FileText, DollarSign, ImageIcon, BarChart3, Package,
  ClipboardList, Store, Brain, ScanEye, AlertTriangle,
  TrendingDown, MessageCircleReply, Radio, Radar,
  RefreshCw, PlusCircle, Pencil, Trash2, Palette, BotMessageSquare, Sparkles,
  Zap, CheckCheck, XCircle, ChevronRight, Info,
  Send, MessageCircle, Instagram, Phone
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface AISettings {
  ai_chat_enabled: boolean;
  guardian_enabled: boolean;
  storefront_assistant: boolean;
  auto_descriptions: boolean;
  auto_pricing: boolean;
  auto_alt_text: boolean;
  image_analysis: boolean;
  analytics_narration: boolean;
  inventory_forecast: boolean;
  order_suggestions: boolean;
  order_priority: boolean;
  churn_warning: boolean;
  reply_suggestions: boolean;
  broadcast_composer: boolean;
  omni_intelligence: boolean;
  action_order_status: boolean;
  action_create_product: boolean;
  action_edit_product: boolean;
  action_delete_product: boolean;
  action_store_design: boolean;
  action_bot_control: boolean;
  ai_reply_telegram: boolean;
  ai_reply_messenger: boolean;
  ai_reply_instagram: boolean;
  ai_reply_whatsapp: boolean;
  ai_reply_viber: boolean;
  ai_instructions: string;
}

const DEFAULT: AISettings = {
  ai_chat_enabled: true,
  guardian_enabled: true,
  storefront_assistant: true,
  auto_descriptions: false,
  auto_pricing: false,
  auto_alt_text: false,
  image_analysis: true,
  analytics_narration: true,
  inventory_forecast: true,
  order_suggestions: true,
  order_priority: true,
  churn_warning: true,
  reply_suggestions: true,
  broadcast_composer: true,
  omni_intelligence: true,
  action_order_status: true,
  action_create_product: true,
  action_edit_product: true,
  action_delete_product: true,
  action_store_design: true,
  action_bot_control: true,
  ai_reply_telegram: true,
  ai_reply_messenger: true,
  ai_reply_instagram: true,
  ai_reply_whatsapp: true,
  ai_reply_viber: true,
  ai_instructions: '',
};

interface ToggleItem {
  key: keyof AISettings;
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

interface Category {
  id: string;
  titleAr: string;
  titleEn: string;
  color: string;
  items: ToggleItem[];
}

const CATEGORIES: Category[] = [
  {
    id: "core",
    titleAr: "الأساسيات",
    titleEn: "Core",
    color: "violet",
    items: [
      {
        key: "ai_chat_enabled",
        icon: <MessageSquareText className="h-5 w-5" />,
        titleAr: "مساعد الذكاء الاصطناعي",
        titleEn: "AI Chat Assistant",
        descAr: "فقاعة المساعد الذكي في لوحة التحكم",
        descEn: "Smart assistant bubble in your dashboard",
      },
      {
        key: "guardian_enabled",
        icon: <ShieldAlert className="h-5 w-5" />,
        titleAr: "حارس المتجر",
        titleEn: "Store Guardian",
        descAr: "تنبيهات تلقائية: طلبات معلقة، مخزون منخفض",
        descEn: "Auto-alerts for stale orders, low stock",
      },
      {
        key: "storefront_assistant",
        icon: <Store className="h-5 w-5" />,
        titleAr: "مساعد الزبائن",
        titleEn: "Storefront Assistant",
        descAr: "يردّ على أسئلة الزبائن حول المنتجات",
        descEn: "Answers customer product questions",
      },
    ],
  },
  {
    id: "product",
    titleAr: "أتمتة المنتجات",
    titleEn: "Product Automation",
    color: "blue",
    items: [
      {
        key: "auto_descriptions",
        icon: <FileText className="h-5 w-5" />,
        titleAr: "وصف المنتجات تلقائياً",
        titleEn: "Auto Descriptions",
        descAr: "الذكاء الاصطناعي يكتب الوصف عند إضافة منتج",
        descEn: "AI writes descriptions for new products",
      },
      {
        key: "auto_pricing",
        icon: <DollarSign className="h-5 w-5" />,
        titleAr: "اقتراح الأسعار",
        titleEn: "Price Suggestions",
        descAr: "اقتراحات تسعير بناءً على السوق",
        descEn: "Market-based pricing suggestions",
      },
      {
        key: "auto_alt_text",
        icon: <ImageIcon className="h-5 w-5" />,
        titleAr: "وصف الصور تلقائياً",
        titleEn: "Auto Alt Text",
        descAr: "نصوص بديلة للصور لتحسين SEO",
        descEn: "Image alt text for SEO",
      },
      {
        key: "image_analysis",
        icon: <ScanEye className="h-5 w-5" />,
        titleAr: "تحليل صور المنتجات",
        titleEn: "Image Analysis",
        descAr: "الذكاء الاصطناعي يحلل صور المنتجات",
        descEn: "AI analyzes product photos",
      },
    ],
  },
  {
    id: "analytics",
    titleAr: "التحليلات والطلبات",
    titleEn: "Analytics & Orders",
    color: "emerald",
    items: [
      {
        key: "analytics_narration",
        icon: <BarChart3 className="h-5 w-5" />,
        titleAr: "تحليل الأداء",
        titleEn: "Analytics Narration",
        descAr: "ملخصات أسبوعية عن أداء المتجر",
        descEn: "Weekly AI performance summaries",
      },
      {
        key: "inventory_forecast",
        icon: <Package className="h-5 w-5" />,
        titleAr: "توقعات المخزون",
        titleEn: "Inventory Forecast",
        descAr: "تنبؤات بالمنتجات التي تنفد قريباً",
        descEn: "Restock predictions before sellout",
      },
      {
        key: "order_suggestions",
        icon: <ClipboardList className="h-5 w-5" />,
        titleAr: "اقتراحات الطلبات",
        titleEn: "Order Suggestions",
        descAr: "الخطوة التالية لكل طلب",
        descEn: "Next-action hints per order",
      },
      {
        key: "order_priority",
        icon: <AlertTriangle className="h-5 w-5" />,
        titleAr: "أولوية الطلبات",
        titleEn: "Order Priority",
        descAr: "يحدد الطلبات العاجلة والمتأخرة",
        descEn: "Flags urgent & overdue orders",
      },
      {
        key: "churn_warning",
        icon: <TrendingDown className="h-5 w-5" />,
        titleAr: "تحذير انخفاض المبيعات",
        titleEn: "Churn Warning",
        descAr: "يكشف انخفاض الإيرادات ويقترح حلول",
        descEn: "Detects revenue decline & suggests fixes",
      },
    ],
  },
  {
    id: "messaging",
    titleAr: "الرسائل والتسويق",
    titleEn: "Messaging & Marketing",
    color: "amber",
    items: [
      {
        key: "reply_suggestions",
        icon: <MessageCircleReply className="h-5 w-5" />,
        titleAr: "اقتراحات الردود",
        titleEn: "Reply Suggestions",
        descAr: "ردود جاهزة للرسائل على واتساب",
        descEn: "Ready-made WhatsApp reply templates",
      },
      {
        key: "broadcast_composer",
        icon: <Radio className="h-5 w-5" />,
        titleAr: "كاتب الحملات",
        titleEn: "Broadcast Composer",
        descAr: "صياغة رسائل حملات واتساب بالذكاء الاصطناعي",
        descEn: "AI-drafted WhatsApp campaign messages",
      },
      {
        key: "omni_intelligence",
        icon: <Radar className="h-5 w-5" />,
        titleAr: "تحليل السلوك العميق",
        titleEn: "Omni Intelligence",
        descAr: "تحليل عميق: عقبات الشراء، أداء الإعلانات",
        descEn: "Deep analysis: friction clusters, ad performance",
      },
    ],
  },
  {
    id: "actions",
    titleAr: "صلاحيات الذكاء الاصطناعي",
    titleEn: "AI Actions",
    color: "rose",
    items: [
      {
        key: "action_order_status",
        icon: <RefreshCw className="h-5 w-5" />,
        titleAr: "تعديل حالة الطلبات",
        titleEn: "Update Order Status",
        descAr: "السماح للذكاء الاصطناعي بتغيير حالة الطلبات",
        descEn: "Allow AI to change order statuses",
      },
      {
        key: "action_create_product",
        icon: <PlusCircle className="h-5 w-5" />,
        titleAr: "إنشاء منتجات",
        titleEn: "Create Products",
        descAr: "السماح للذكاء الاصطناعي بإضافة منتجات جديدة",
        descEn: "Allow AI to add new products",
      },
      {
        key: "action_edit_product",
        icon: <Pencil className="h-5 w-5" />,
        titleAr: "تعديل المنتجات",
        titleEn: "Edit Products",
        descAr: "تعديل الأسعار، المخزون، الوصف، العناوين",
        descEn: "Edit prices, stock, descriptions, titles",
      },
      {
        key: "action_delete_product",
        icon: <Trash2 className="h-5 w-5" />,
        titleAr: "حذف المنتجات",
        titleEn: "Remove Products",
        descAr: "السماح للذكاء الاصطناعي بإلغاء تفعيل المنتجات",
        descEn: "Allow AI to deactivate products",
      },
      {
        key: "action_store_design",
        icon: <Palette className="h-5 w-5" />,
        titleAr: "تعديل تصميم المتجر",
        titleEn: "Edit Store Design",
        descAr: "تغيير الألوان، الخطوط، النصوص، التصميم",
        descEn: "Change colors, fonts, text, layout",
      },
      {
        key: "action_bot_control",
        icon: <BotMessageSquare className="h-5 w-5" />,
        titleAr: "التحكم بالبوت",
        titleEn: "Bot Control",
        descAr: "تشغيل/إيقاف البوت وتعديل قوالب الرسائل",
        descEn: "Toggle bot & edit message templates",
      },
    ],
  },
];

const COLOR_MAP: Record<string, {
  tab: string; tabActive: string; badge: string; icon: string; glow: string; border: string; ring: string;
}> = {
  violet: {
    tab: "text-violet-500",
    tabActive: "border-b-2 border-violet-500 text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    glow: "bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40",
    border: "border-violet-200 dark:border-violet-800/50",
    ring: "ring-violet-300 dark:ring-violet-700",
  },
  blue: {
    tab: "text-blue-500",
    tabActive: "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    glow: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40",
    border: "border-blue-200 dark:border-blue-800/50",
    ring: "ring-blue-300 dark:ring-blue-700",
  },
  emerald: {
    tab: "text-emerald-500",
    tabActive: "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    glow: "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40",
    border: "border-emerald-200 dark:border-emerald-800/50",
    ring: "ring-emerald-300 dark:ring-emerald-700",
  },
  amber: {
    tab: "text-amber-500",
    tabActive: "border-b-2 border-amber-500 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    glow: "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40",
    border: "border-amber-200 dark:border-amber-800/50",
    ring: "ring-amber-300 dark:ring-amber-700",
  },
  rose: {
    tab: "text-rose-500",
    tabActive: "border-b-2 border-rose-500 text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
    glow: "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40",
    border: "border-rose-200 dark:border-rose-800/50",
    ring: "ring-rose-300 dark:ring-rose-700",
  },
};

const TAB_ICONS: Record<string, React.ReactNode> = {
  core: <Brain className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  messaging: <Radio className="h-4 w-4" />,
  actions: <Zap className="h-4 w-4" />,
};

export default function AISettingsPage() {
  const { locale } = useTranslation();
  const isRTL = locale === "ar";
  const { toast } = useToast();
  const [settings, setSettings] = useState<AISettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("core");

  useEffect(() => {
    fetch("/api/ai-settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: keyof AISettings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
    setDirty(true);
  };

  const toggleAllInCategory = (cat: Category, value: boolean) => {
    const updates: Partial<AISettings> = {};
    cat.items.forEach((item) => { (updates as any)[item.key] = value; });
    setSettings((s) => ({ ...s, ...updates }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setDirty(false);
      toast({
        title: isRTL ? "تم الحفظ" : "Saved",
        description: isRTL ? "تم تحديث إعدادات الذكاء الاصطناعي" : "AI settings updated successfully",
      });
    } catch {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const platformKeys = new Set(["ai_reply_telegram", "ai_reply_messenger", "ai_reply_instagram", "ai_reply_whatsapp", "ai_reply_viber"]);
  const enabledCount = Object.entries(settings).filter(([k, v]) => k !== "ai_instructions" && !platformKeys.has(k) && v === true).length;
  const totalCount = Object.keys(settings).filter((k) => k !== "ai_instructions" && !platformKeys.has(k)).length;
  const progressPct = Math.round((enabledCount / totalCount) * 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-background flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">
          {isRTL ? "جارٍ التحميل..." : "Loading AI settings..."}
        </p>
      </div>
    );
  }

  const activeCat = CATEGORIES.find((c) => c.id === activeTab)!;
  const colors = COLOR_MAP[activeCat.color];
  const enabledInActive = activeCat.items.filter((i) => settings[i.key]).length;
  const allEnabled = enabledInActive === activeCat.items.length;
  const noneEnabled = enabledInActive === 0;

  return (
    <div className="min-h-screen pb-24" dir={isRTL ? "rtl" : "ltr"}>

      {/* ── Hero Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 pt-4 pb-4">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg ring-1 ring-white/30">
                <Brain className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  {isRTL ? "إعدادات الذكاء الاصطناعي" : "AI Autopilot"}
                </h1>
                <p className="text-sm text-white/70 mt-0.5">
                  {isRTL
                    ? `${enabledCount} من ${totalCount} ميزة مفعّلة — التحكم الكامل بالذكاء الاصطناعي`
                    : `${enabledCount} of ${totalCount} features active — full AI control`}
                </p>
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex shrink-0 items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold bg-white text-violet-700 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isRTL ? "حفظ" : "Save"}
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                {isRTL ? "نسبة التفعيل" : "Activation rate"}
              </span>
              <span className="text-xs font-bold text-white">{progressPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Category stat pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {CATEGORIES.map((cat) => {
              const en = cat.items.filter((i) => settings[i.key]).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    activeTab === cat.id
                      ? "bg-white text-violet-700 shadow-md"
                      : "bg-white/15 text-white/80 hover:bg-white/25"
                  }`}
                >
                  {TAB_ICONS[cat.id]}
                  {isRTL ? cat.titleAr : cat.titleEn}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === cat.id ? "bg-violet-100 text-violet-700" : "bg-white/20 text-white"
                  }`}>{en}/{cat.items.length}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

        {/* Category panel */}
        <div className={`rounded-2xl border overflow-hidden shadow-sm transition-colors ${colors.glow}`}>

          {/* Panel header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.border}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.icon}`}>
                {TAB_ICONS[activeCat.id]}
              </div>
              <div>
                <h2 className="text-sm font-extrabold">
                  {isRTL ? activeCat.titleAr : activeCat.titleEn}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? `${enabledInActive} من ${activeCat.items.length} مفعّل`
                    : `${enabledInActive} of ${activeCat.items.length} enabled`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeCat.id === "actions" && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg px-2.5 py-1 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {isRTL ? "صلاحيات حساسة" : "Sensitive permissions"}
                </div>
              )}
              <button
                onClick={() => toggleAllInCategory(activeCat, !allEnabled)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  allEnabled
                    ? "border-border text-muted-foreground hover:bg-muted/50"
                    : `${colors.badge} border-transparent`
                }`}
              >
                {allEnabled
                  ? <><XCircle className="h-3.5 w-3.5" />{isRTL ? "تعطيل الكل" : "Disable all"}</>
                  : <><CheckCheck className="h-3.5 w-3.5" />{isRTL ? "تفعيل الكل" : "Enable all"}</>
                }
              </button>
            </div>
          </div>

          {/* Feature cards grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCat.items.map((item) => {
              const isOn = settings[item.key] as boolean;
              return (
                <div key={item.key}>
                  <button
                    onClick={() => toggle(item.key)}
                    className={`w-full text-start rounded-xl border p-4 transition-all duration-200 group ${
                      isOn
                        ? `${colors.glow} ${colors.border} shadow-sm ring-1 ${colors.ring}`
                        : "bg-card border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isOn ? colors.icon : "bg-muted text-muted-foreground group-hover:bg-muted/70"
                        }`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className={`text-sm font-bold leading-tight ${isOn ? "" : "text-foreground"}`}>
                            {isRTL ? item.titleAr : item.titleEn}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                            {isRTL ? item.descAr : item.descEn}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <Switch
                          checked={isOn}
                          onCheckedChange={() => toggle(item.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {isOn && (
                      <div className={`mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${colors.tab}`}>
                        <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        {isRTL ? "مفعّل" : "Active"}
                      </div>
                    )}
                  </button>

                  {/* Inline AI Instructions + Platform Toggles under storefront_assistant */}
                  {item.key === "storefront_assistant" && isOn && (
                    <div className="space-y-2 mt-2">
                      {/* Per-platform AI toggles */}
                      <div className={`rounded-xl border p-4 ${colors.glow} ${colors.border}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <MessageCircle className="h-4 w-4 text-blue-500" />
                          <p className="text-xs font-bold">
                            {isRTL ? "منصات الرد التلقائي" : "Auto-Reply Platforms"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-3">
                          {isRTL
                            ? "اختر المنصات التي يرد عليها الذكاء الاصطناعي تلقائياً"
                            : "Choose which platforms AI auto-replies on"}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {([
                            { key: 'ai_reply_telegram' as keyof AISettings, icon: <Send className="h-4 w-4" />, label: 'Telegram', labelAr: 'تيليغرام', color: 'text-sky-500' },
                            { key: 'ai_reply_messenger' as keyof AISettings, icon: <MessageCircle className="h-4 w-4" />, label: 'Messenger', labelAr: 'ماسنجر', color: 'text-blue-500' },
                            { key: 'ai_reply_instagram' as keyof AISettings, icon: <Instagram className="h-4 w-4" />, label: 'Instagram', labelAr: 'إنستغرام', color: 'text-pink-500' },
                            { key: 'ai_reply_whatsapp' as keyof AISettings, icon: <Phone className="h-4 w-4" />, label: 'WhatsApp', labelAr: 'واتساب', color: 'text-green-500' },
                            { key: 'ai_reply_viber' as keyof AISettings, icon: <MessageCircle className="h-4 w-4" />, label: 'Viber', labelAr: 'فايبر', color: 'text-purple-500' },
                          ]).map(p => (
                            <div
                              key={p.key}
                              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                settings[p.key] ? 'bg-background/80 border-border' : 'bg-muted/30 border-border/50 opacity-60'
                              }`}
                              onClick={() => toggle(p.key)}
                            >
                              <div className="flex items-center gap-2">
                                <span className={p.color}>{p.icon}</span>
                                <span className="text-xs font-semibold">{isRTL ? p.labelAr : p.label}</span>
                              </div>
                              <Switch
                                checked={settings[p.key] as boolean}
                                onCheckedChange={() => toggle(p.key)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* AI Instructions as separate card in grid */}
            {activeTab === "core" && settings.storefront_assistant && (
              <div className={`rounded-xl border p-6 ${colors.glow} ${colors.border} row-span-2 flex flex-col`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-bold">
                      {isRTL ? "تعليمات الذكاء الاصطناعي" : "AI Instructions"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {settings.ai_instructions?.length || 0}/500
                  </span>
                </div>
                <Textarea
                  value={settings.ai_instructions || ""}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, ai_instructions: e.target.value.slice(0, 500) }));
                    setDirty(true);
                  }}
                  rows={12}
                  placeholder={
                    isRTL
                      ? "مثال: ركز على بيع المنتجات الجديدة، رحب بالزبائن باسم المتجر، لا تعطي خصومات..."
                      : "E.g. Focus on new products, greet by store name, never offer discounts..."
                  }
                  className="bg-background/60 border-border/60 rounded-xl text-xs resize-none flex-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Category navigation footer ───────────────── */}
        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const en = cat.items.filter((i) => settings[i.key]).length;
            const c = COLOR_MAP[cat.color];
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-w-[70px] ${
                  isActive
                    ? `${c.badge} shadow-sm`
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className={isActive ? "" : "opacity-60"}>{TAB_ICONS[cat.id]}</span>
                <span className="hidden sm:block truncate">{isRTL ? cat.titleAr : cat.titleEn}</span>
                <span className={`text-[9px] font-bold rounded-full px-1.5 ${
                  isActive ? "bg-white/40 dark:bg-black/20" : "bg-muted"
                }`}>{en}/{cat.items.length}</span>
              </button>
            );
          })}
        </div>

        {/* ── Unsaved changes bar ───────────────────────── */}
        {dirty && (
          <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50">
            <div className="flex items-center justify-between gap-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-black/30 border border-slate-700">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                {isRTL ? "لديك تغييرات غير محفوظة" : "Unsaved changes"}
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm font-bold bg-violet-500 hover:bg-violet-400 text-white px-4 py-1.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isRTL ? "حفظ" : "Save now"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
