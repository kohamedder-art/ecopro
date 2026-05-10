import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  MkrAiBrain, MkrAiShield, MkrAiStore,
  MkrAiFile, MkrAiDollar, MkrAiImage, MkrAiScan,
  MkrAiChart, MkrAiBox, MkrAiClipboard, MkrAiAlert,
  MkrAiTrendDown, MkrAiReply, MkrAiBroadcast, MkrAiRadar,
  MkrAiRefresh, MkrAiPlus, MkrAiPencil, MkrAiTrash,
  MkrAiPalette, MkrAiBot, MkrAiZap,
  MkrAiSave, MkrAiSpinner, MkrAiCheck, MkrAiX,
  MkrAiMsg, MkrAiSend, MkrAiInsta, MkrAiPhone,
  MkrAiSparkle, MkrAiInfo,
} from "@/components/icons/AIIcons";

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
        icon: <MkrAiBrain className="h-[13px] w-[13px]" />,
        titleAr: "مساعد الذكاء الاصطناعي",
        titleEn: "AI Chat Assistant",
        descAr: "فقاعة المساعد الذكي في لوحة التحكم",
        descEn: "Smart assistant bubble in your dashboard",
      },
      {
        key: "guardian_enabled",
        icon: <MkrAiShield className="h-[13px] w-[13px]" />,
        titleAr: "حارس المتجر",
        titleEn: "Store Guardian",
        descAr: "تنبيهات تلقائية: طلبات معلقة، مخزون منخفض",
        descEn: "Auto-alerts for stale orders, low stock",
      },
      {
        key: "storefront_assistant",
        icon: <MkrAiStore className="h-[13px] w-[13px]" />,
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
        icon: <MkrAiFile className="h-[13px] w-[13px]" />,
        titleAr: "وصف المنتجات تلقائياً",
        titleEn: "Auto Descriptions",
        descAr: "الذكاء الاصطناعي يكتب الوصف عند إضافة منتج",
        descEn: "AI writes descriptions for new products",
      },
      {
        key: "auto_pricing",
        icon: <MkrAiDollar className="h-[13px] w-[13px]" />,
        titleAr: "اقتراح الأسعار",
        titleEn: "Price Suggestions",
        descAr: "اقتراحات تسعير بناءً على السوق",
        descEn: "Market-based pricing suggestions",
      },
      {
        key: "auto_alt_text",
        icon: <MkrAiImage className="h-[13px] w-[13px]" />,
        titleAr: "وصف الصور تلقائياً",
        titleEn: "Auto Alt Text",
        descAr: "نصوص بديلة للصور لتحسين SEO",
        descEn: "Image alt text for SEO",
      },
      {
        key: "image_analysis",
        icon: <MkrAiScan className="h-[13px] w-[13px]" />,
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
        icon: <MkrAiChart className="h-[13px] w-[13px]" />,
        titleAr: "تحليل الأداء",
        titleEn: "Analytics Narration",
        descAr: "ملخصات أسبوعية عن أداء المتجر",
        descEn: "Weekly AI performance summaries",
      },
      {
        key: "inventory_forecast",
        icon: <MkrAiBox className="h-[13px] w-[13px]" />,
        titleAr: "توقعات المخزون",
        titleEn: "Inventory Forecast",
        descAr: "تنبؤات بالمنتجات التي تنفد قريباً",
        descEn: "Restock predictions before sellout",
      },
      {
        key: "order_suggestions",
        icon: <MkrAiClipboard className="h-[13px] w-[13px]" />,
        titleAr: "اقتراحات الطلبات",
        titleEn: "Order Suggestions",
        descAr: "الخطوة التالية لكل طلب",
        descEn: "Next-action hints per order",
      },
      {
        key: "order_priority",
        icon: <MkrAiAlert className="h-[13px] w-[13px]" />,
        titleAr: "أولوية الطلبات",
        titleEn: "Order Priority",
        descAr: "يحدد الطلبات العاجلة والمتأخرة",
        descEn: "Flags urgent & overdue orders",
      },
      {
        key: "churn_warning",
        icon: <MkrAiTrendDown className="h-[13px] w-[13px]" />,
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
        icon: <MkrAiReply className="h-[13px] w-[13px]" />,
        titleAr: "اقتراحات الردود",
        titleEn: "Reply Suggestions",
        descAr: "ردود جاهزة للرسائل على واتساب",
        descEn: "Ready-made WhatsApp reply templates",
      },
      {
        key: "broadcast_composer",
        icon: <MkrAiBroadcast className="h-[13px] w-[13px]" />,
        titleAr: "كاتب الحملات",
        titleEn: "Broadcast Composer",
        descAr: "صياغة رسائل حملات واتساب بالذكاء الاصطناعي",
        descEn: "AI-drafted WhatsApp campaign messages",
      },
      {
        key: "omni_intelligence",
        icon: <MkrAiRadar className="h-[13px] w-[13px]" />,
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
        icon: <MkrAiRefresh className="h-[13px] w-[13px]" />,
        titleAr: "تعديل حالة الطلبات",
        titleEn: "Update Order Status",
        descAr: "السماح للذكاء الاصطناعي بتغيير حالة الطلبات",
        descEn: "Allow AI to change order statuses",
      },
      {
        key: "action_create_product",
        icon: <MkrAiPlus className="h-[13px] w-[13px]" />,
        titleAr: "إنشاء منتجات",
        titleEn: "Create Products",
        descAr: "السماح للذكاء الاصطناعي بإضافة منتجات جديدة",
        descEn: "Allow AI to add new products",
      },
      {
        key: "action_edit_product",
        icon: <MkrAiPencil className="h-[13px] w-[13px]" />,
        titleAr: "تعديل المنتجات",
        titleEn: "Edit Products",
        descAr: "تعديل الأسعار، المخزون، الوصف، العناوين",
        descEn: "Edit prices, stock, descriptions, titles",
      },
      {
        key: "action_delete_product",
        icon: <MkrAiTrash className="h-[13px] w-[13px]" />,
        titleAr: "حذف المنتجات",
        titleEn: "Remove Products",
        descAr: "السماح للذكاء الاصطناعي بإلغاء تفعيل المنتجات",
        descEn: "Allow AI to deactivate products",
      },
      {
        key: "action_store_design",
        icon: <MkrAiPalette className="h-[13px] w-[13px]" />,
        titleAr: "تعديل تصميم المتجر",
        titleEn: "Edit Store Design",
        descAr: "تغيير الألوان، الخطوط، النصوص، التصميم",
        descEn: "Change colors, fonts, text, layout",
      },
      {
        key: "action_bot_control",
        icon: <MkrAiBot className="h-[13px] w-[13px]" />,
        titleAr: "التحكم بالبوت",
        titleEn: "Bot Control",
        descAr: "تشغيل/إيقاف البوت وتعديل قوالب الرسائل",
        descEn: "Toggle bot & edit message templates",
      },
    ],
  },
];

const TAB_COLORS: Record<string, { badge: string; border: string; dot: string }> = {
  violet: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800", dot: "bg-violet-500" },
  blue:   { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  emerald: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  amber:  { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  rose:   { badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800", dot: "bg-rose-500" },
};

const TAB_ICONS: Record<string, React.ReactNode> = {
  core: <MkrAiBrain className="h-[13px] w-[13px]" />,
  product: <MkrAiBox className="h-[13px] w-[13px]" />,
  analytics: <MkrAiChart className="h-[13px] w-[13px]" />,
  messaging: <MkrAiBroadcast className="h-[13px] w-[13px]" />,
  actions: <MkrAiZap className="h-[13px] w-[13px]" />,
};

const PLATFORM_TOGGLES = [
  { key: 'ai_reply_telegram' as keyof AISettings, icon: <MkrAiSend className="h-[13px] w-[13px]" />, label: 'Telegram', labelAr: 'تيليغرام', color: 'text-sky-500' },
  { key: 'ai_reply_messenger' as keyof AISettings, icon: <MkrAiMsg className="h-[13px] w-[13px]" />, label: 'Messenger', labelAr: 'ماسنجر', color: 'text-blue-500' },
  { key: 'ai_reply_instagram' as keyof AISettings, icon: <MkrAiInsta className="h-[13px] w-[13px]" />, label: 'Instagram', labelAr: 'إنستغرام', color: 'text-pink-500' },
  { key: 'ai_reply_whatsapp' as keyof AISettings, icon: <MkrAiPhone className="h-[13px] w-[13px]" />, label: 'WhatsApp', labelAr: 'واتساب', color: 'text-emerald-500' },
  { key: 'ai_reply_viber' as keyof AISettings, icon: <MkrAiMsg className="h-[13px] w-[13px]" />, label: 'Viber', labelAr: 'فايبر', color: 'text-purple-500' },
];

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
  const progressPct = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-[9px] py-32">
        <MkrAiBrain className="h-10 w-10 text-primary" />
        <MkrAiSpinner className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? "جارٍ التحميل..." : "Loading AI settings..."}
        </p>
      </div>
    );
  }

  const activeCat = CATEGORIES.find((c) => c.id === activeTab)!;
  const colors = TAB_COLORS[activeCat.color];
  const enabledInActive = activeCat.items.filter((i) => settings[i.key]).length;
  const allEnabled = enabledInActive === activeCat.items.length;

  const FeatureCard = ({ item, isOn }: { item: ToggleItem; isOn: boolean }) => (
    <div className="relative">
      <button
        onClick={() => toggle(item.key)}
        className={`w-full text-start rounded-xl border p-[11px] transition-all ${
          isOn
            ? `bg-gradient-to-br from-card to-primary/5 ${colors.border} shadow-sm`
            : "bg-card border-border hover:border-muted-foreground/30 hover:shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-[9px]">
          <div className="flex items-start gap-[9px] min-w-0">
            <div className={`flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-lg transition-all ${
              isOn
                ? `${colors.badge} shadow-sm`
                : "bg-muted text-muted-foreground"
            }`}>
              {item.icon}
            </div>
            <div className="min-w-0 pt-[3px]">
              <p className="text-xs font-bold leading-tight">
                {isRTL ? item.titleAr : item.titleEn}
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-[3px]">
                {isRTL ? item.descAr : item.descEn}
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-[3px]">
            <Switch checked={isOn} onCheckedChange={() => toggle(item.key)} onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
        {isOn && (
          <div className="mt-[7px] flex items-center gap-[5px] text-[10px] font-bold uppercase tracking-wider">
            <span className={`h-[5px] w-[5px] rounded-full animate-pulse ${colors.dot}`} />
            <span className={colors.badge.split(' ')[1]}>{isRTL ? "مفعّل" : "Active"}</span>
          </div>
        )}
      </button>

      {item.key === "storefront_assistant" && isOn && (
        <div className="space-y-[7px] mt-[7px]">
          <div className={`rounded-xl border p-[11px] ${colors.border} bg-card`}>
            <div className="flex items-center gap-[7px] mb-[7px]">
              <MkrAiMsg className="h-[13px] w-[13px] text-blue-500" />
              <p className="text-xs font-bold">{isRTL ? "منصات الرد التلقائي" : "Auto-Reply Platforms"}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mb-[7px]">
              {isRTL ? "اختر المنصات التي يرد عليها الذكاء الاصطناعي تلقائياً" : "Choose which platforms AI auto-replies on"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[7px]">
              {PLATFORM_TOGGLES.map(p => (
                <div
                  key={p.key}
                  className={`flex items-center justify-between gap-[7px] px-[9px] py-[9px] rounded-lg border transition-colors cursor-pointer ${
                    settings[p.key] ? 'bg-card border-border' : 'bg-muted/30 border-border/50'
                  }`}
                  onClick={() => toggle(p.key)}
                >
                  <div className="flex items-center gap-[7px]">
                    <span className={p.color}>{p.icon}</span>
                    <span className="text-xs font-semibold">{isRTL ? p.labelAr : p.label}</span>
                  </div>
                  <Switch checked={settings[p.key] as boolean} onCheckedChange={() => toggle(p.key)} onClick={(e) => e.stopPropagation()} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pb-24" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-[9px]">
        {/* ── Hero header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-[18px] shadow-sm">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="url(#pg)" strokeWidth="2.5"
                    strokeDasharray={`${progressPct * 0.942} 94.2`} strokeLinecap="round" />
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--accent, #8b5cf6)" />
                    </linearGradient>
                  </defs>
                </svg>
                <MkrAiBrain className="w-4 h-4 text-primary relative z-10" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-foreground">
                  {isRTL ? "إعدادات الذكاء الاصطناعي" : "AI Autopilot"}
                </h1>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {isRTL
                    ? `${enabledCount} من ${totalCount} ميزة مفعّلة — ${progressPct}%`
                    : `${enabledCount} of ${totalCount} features active — ${progressPct}%`}
                </p>
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex shrink-0 items-center gap-[5px] h-9 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
            >
              {saving ? <MkrAiSpinner className="h-[11px] w-[11px]" /> : <MkrAiSave className="h-[11px] w-[11px]" />}
              {isRTL ? "حفظ" : "Save"}
            </button>
          </div>
          <div className="relative mt-3">
            <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-card border border-border rounded-xl p-1 flex overflow-x-auto gap-1 shadow-sm">
          {CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            const tc = TAB_COLORS[cat.color];
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-[5px] text-xs font-bold px-3 py-2 rounded-lg transition-all flex-shrink-0 whitespace-nowrap ${
                  isActive
                    ? `bg-gradient-to-br from-primary to-accent text-white shadow-md`
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {TAB_ICONS[cat.id]}
                <span>{isRTL ? cat.titleAr : cat.titleEn}</span>
                <span className={`text-[10px] rounded-full px-[7px] py-[1px] ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {cat.items.filter((i) => settings[i.key]).length}/{cat.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Category panel ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-[13px] border-b border-border">
            <div className="flex items-center gap-[9px]">
              <div className={`flex h-[31px] w-[31px] items-center justify-center rounded-lg ${colors.badge}`}>
                {TAB_ICONS[activeCat.id]}
              </div>
              <div>
                <h2 className="text-sm font-extrabold">{isRTL ? activeCat.titleAr : activeCat.titleEn}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL ? `${enabledInActive} من ${activeCat.items.length} مفعّل` : `${enabledInActive} of ${activeCat.items.length} enabled`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[7px]">
              {activeCat.id === "actions" && (
                <div className="flex items-center gap-[5px] text-[11px] text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg px-[9px] py-[3px] font-medium">
                  <MkrAiInfo className="h-[11px] w-[11px]" />
                  {isRTL ? "صلاحيات حساسة" : "Sensitive permissions"}
                </div>
              )}
              <button
                onClick={() => toggleAllInCategory(activeCat, !allEnabled)}
                className={`flex items-center gap-[5px] text-xs font-bold px-[9px] py-[5px] rounded-lg border transition-colors ${
                  allEnabled
                    ? "border-border text-muted-foreground hover:bg-muted/50"
                    : `${colors.badge} border-transparent`
                }`}
              >
                {allEnabled
                  ? <><MkrAiX className="h-[11px] w-[11px]" />{isRTL ? "تعطيل الكل" : "Disable all"}</>
                  : <><MkrAiCheck className="h-[11px] w-[11px]" />{isRTL ? "تفعيل الكل" : "Enable all"}</>
                }
              </button>
            </div>
          </div>

          <div className="p-[13px] grid grid-cols-1 sm:grid-cols-2 gap-[9px]">
            {activeCat.items.map((item) => {
              const isOn = settings[item.key] as boolean;
              return <FeatureCard key={item.key} item={item} isOn={isOn} />;
            })}

            {activeTab === "core" && settings.storefront_assistant && (
              <div className={`rounded-xl border p-[13px] ${colors.border} bg-card flex flex-col`}>
                <div className="flex items-center justify-between mb-[9px]">
                  <div className="flex items-center gap-[7px]">
                    <MkrAiSparkle className="h-[13px] w-[13px] text-amber-500" />
                    <p className="text-xs font-bold">{isRTL ? "تعليمات الذكاء الاصطناعي" : "AI Instructions"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{settings.ai_instructions?.length || 0}/500</span>
                </div>
                <Textarea
                  value={settings.ai_instructions || ""}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, ai_instructions: e.target.value.slice(0, 500) }));
                    setDirty(true);
                  }}
                  rows={10}
                  placeholder={isRTL ? "مثال: ركز على بيع المنتجات الجديدة، رحب بالزبائن باسم المتجر، لا تعطي خصومات..." : "E.g. Focus on new products, greet by store name, never offer discounts..."}
                  className="bg-muted/30 border-border/60 rounded-xl text-xs resize-none flex-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom tab nav ── */}
        <div className="rounded-2xl border border-border bg-card p-2 flex overflow-x-auto gap-1.5 shadow-sm">
          {CATEGORIES.map((cat) => {
            const en = cat.items.filter((i) => settings[i.key]).length;
            const isActive = activeTab === cat.id;
            const tc = TAB_COLORS[cat.color];
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-w-[60px] ${
                  isActive
                    ? 'bg-gradient-to-br from-primary to-accent text-white shadow-md'
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className={isActive ? "opacity-100" : "opacity-50"}>{TAB_ICONS[cat.id]}</span>
                <span className="hidden sm:block truncate">{isRTL ? cat.titleAr : cat.titleEn}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20' : 'bg-muted'
                }`}>{en}/{cat.items.length}</span>
              </button>
            );
          })}
        </div>

        {/* ── Unsaved changes bar ── */}
        {dirty && (
          <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50">
            <div className="flex items-center justify-between gap-[9px] bg-foreground text-background rounded-xl px-[13px] py-[11px] border border-border">
              <div className="flex items-center gap-[7px] text-sm font-medium">
                <div className="h-[7px] w-[7px] rounded-full bg-amber-400" />
                {isRTL ? "لديك تغييرات غير محفوظة" : "Unsaved changes"}
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-[5px] text-xs font-bold bg-primary text-primary-foreground px-[11px] py-[5px] rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? <MkrAiSpinner className="h-[11px] w-[11px]" /> : <MkrAiSave className="h-[11px] w-[11px]" />}
                {isRTL ? "حفظ" : "Save now"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
