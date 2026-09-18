import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { Bot, MessageCircle, Smartphone, Globe, Camera, Shield, FileText, Send, RefreshCw, Plus, Trash2, Pencil, Palette, Brain, Sparkles, Loader2, User, Tag, X } from "lucide-react";

interface AISettings {
  ai_chat_enabled: boolean;
  storefront_assistant: boolean;
  guardian_enabled: boolean;
  auto_descriptions: boolean;
  auto_alt_text: boolean;
  broadcast_composer: boolean;
  reply_suggestions: boolean;
  auto_cancel_orders: boolean;
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

interface QuotaSummary {
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  periodStart: string;
  passActive?: boolean;
  passEndsAt?: string | null;
  dayPassPriceDzd?: number;
}

interface FAQPair { q: string; a: string }

interface PersonaConfig {
  persona_name: string;
  tone: string;
  personality_note: string;
  business_type: string;
  expertise_areas: string[];
  primary_language: string;
  use_emojis: boolean;
  emoji_style: string;
  store_story: string;
  product_philosophy: string;
  unique_selling_points: string[];
  forbidden_topics: string[];
  competitor_policy: string;
  upsell_enabled: boolean;
  cross_sell_enabled: boolean;
  discount_policy: string;
  urgency_enabled: boolean;
  response_length: string;
  greeting_template: string;
  closing_template: string;
  faq_entries: FAQPair[];
  common_objections: FAQPair[];
}

const DEFAULT_PERSONA: PersonaConfig = {
  persona_name: 'المساعد الافتراضي',
  tone: 'friendly',
  personality_note: '',
  business_type: '',
  expertise_areas: [],
  primary_language: 'ar',
  use_emojis: true,
  emoji_style: 'minimal',
  store_story: '',
  product_philosophy: '',
  unique_selling_points: [],
  forbidden_topics: [],
  competitor_policy: 'ignore',
  upsell_enabled: true,
  cross_sell_enabled: true,
  discount_policy: '',
  urgency_enabled: false,
  response_length: 'medium',
  greeting_template: '',
  closing_template: '',
  faq_entries: [],
  common_objections: [],
};

const DEFAULT: AISettings = {
  ai_chat_enabled: true,
  storefront_assistant: true,
  guardian_enabled: true,
  auto_descriptions: false,
  auto_alt_text: false,
  broadcast_composer: true,
  reply_suggestions: true,
  auto_cancel_orders: true,
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

interface PlatformToggle {
  key: keyof AISettings;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

type TabId = 'auto-reply' | 'persona' | 'permissions' | 'product' | 'advanced';

export default function AISettingsPage() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const { activeStore } = useStore();
  const activeStoreId: number | null = activeStore?.id ?? null;
  const isRTL = locale === 'ar';
  const [settings, setSettings] = useState<AISettings>(DEFAULT);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('auto-reply');
  const [persona, setPersona] = useState<PersonaConfig>(DEFAULT_PERSONA);
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testChat, setTestChat] = useState<{role: 'user'|'ai', text: string}[]>([]);

  // Customer AI test chat state (uses /api/ai/test-customer)
  const [customerTestMessage, setCustomerTestMessage] = useState('');
  const [customerTestLoading, setCustomerTestLoading] = useState(false);
  const [customerTestChat, setCustomerTestChat] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const customerTestChatId = 'web_ui_test'; // persistent chatId for multi-turn

  useEffect(() => {
    Promise.all([
      fetch('/api/ai-settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/ai/quota', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([data, quotaData]) => {
      if (data && !data.error) setSettings({ ...DEFAULT, ...data });
      if (quotaData) setQuota(quotaData);
    }).finally(() => setLoading(false));
  }, []);

  // Load persona
  useEffect(() => {
    if (activeTab !== 'persona') return;
    setPersonaLoading(true);
    fetch('/api/ai/persona', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data && !data.error) setPersona({ ...DEFAULT_PERSONA, ...data }); })
      .finally(() => setPersonaLoading(false));
  }, [activeTab]);

  const toggle = (key: keyof AISettings) => {
    if (key === 'ai_instructions') return;
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Day-pass purchase state (200 DZD / 24h after monthly allowance)
  const [buyingPass, setBuyingPass] = useState(false);

  const buyDayPass = async () => {
    setBuyingPass(true);
    try {
      const res = await fetch('/api/ai/day-pass/checkout', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'تعذر إنشاء الدفع، حاول مجدداً' : 'Could not start payment, try again', variant: 'destructive' });
      setBuyingPass(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'تم تحديث الإعدادات' : 'Settings updated' });
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل الحفظ' : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateInstructions = (val: string) => setSettings(prev => ({ ...prev, ai_instructions: val }));

  const savePersona = async () => {
    setPersonaSaving(true);
    try {
      const res = await fetch('/api/ai/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(persona),
      });
      if (res.ok) {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'تم تحديث شخصية المساعد' : 'AI persona updated' });
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل الحفظ' : 'Failed to save', variant: 'destructive' });
    } finally {
      setPersonaSaving(false);
    }
  };

  const updatePersona = (key: keyof PersonaConfig, val: any) => {
    setPersona(prev => ({ ...prev, [key]: val }));
  };

  const handleTestSend = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    const msg = testMessage;
    setTestChat(prev => [...prev, { role: 'user', text: msg }]);
    setTestMessage('');
    try {
      const res = await fetch('/api/ai/persona/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, ...(activeStoreId ? { storeId: activeStoreId } : {}) }),
      });
      const data = await res.json();
      if (data.answer) {
        setTestChat(prev => [...prev, { role: 'ai', text: data.answer }]);
      }
    } catch {
      setTestChat(prev => [...prev, { role: 'ai', text: isRTL ? 'حدث خطأ' : 'An error occurred' }]);
    } finally {
      setTestLoading(false);
    }
  };

  const handleCustomerTestSend = async () => {
    if (!customerTestMessage.trim()) return;
    setCustomerTestLoading(true);
    const msg = customerTestMessage;
    setCustomerTestChat(prev => [...prev, { role: 'user', text: msg }]);
    setCustomerTestMessage('');
    try {
      const res = await fetch('/api/ai/test-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, chatId: customerTestChatId, ...(activeStoreId ? { storeId: activeStoreId } : {}) }),
      });
      const data = await res.json();
      if (data.answer) {
        setCustomerTestChat(prev => [...prev, { role: 'ai', text: data.answer }]);
      }
    } catch {
      setCustomerTestChat(prev => [...prev, { role: 'ai', text: isRTL ? 'حدث خطأ' : 'An error occurred' }]);
    } finally {
      setCustomerTestLoading(false);
    }
  };

  const platforms: PlatformToggle[] = [
    { key: 'ai_reply_messenger', icon: <MessageCircle className="w-3.5 h-3.5 text-blue-600" />, label: 'Facebook Messenger', desc: 'الرد على رسائل الفيسبوك' },
    { key: 'ai_reply_whatsapp', icon: <Smartphone className="w-3.5 h-3.5 text-green-600" />, label: 'WhatsApp', desc: 'الرد على رسائل واتساب' },
    { key: 'ai_reply_telegram', icon: <Send className="w-3.5 h-3.5 text-blue-500" />, label: 'Telegram', desc: 'الرد على رسائل تيليجرام' },
    { key: 'ai_reply_instagram', icon: <Camera className="w-3.5 h-3.5 text-pink-600" />, label: 'Instagram', desc: 'الرد على رسائل إنستغرام' },
    { key: 'ai_reply_viber', icon: <Globe className="w-3.5 h-3.5 text-purple-600" />, label: 'Viber', desc: 'الرد على رسائل Viber' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">{isRTL ? 'جاري تحميل إعدادات الذكاء الاصطناعي...' : 'Loading AI settings...'}</span>
        </div>
      </div>
    );
  }

  // ── Derived overview (KPI row, same pattern as MarketingAnalytics) ──
  const platformsActive = platforms.filter(p => settings.storefront_assistant && (settings[p.key] as boolean)).length;
  const ownerPct = quota && quota.ownerLimit > 0 ? Math.min(100, (quota.ownerUsed / quota.ownerLimit) * 100) : 0;
  const customerPct = quota && quota.customerLimit > 0 ? Math.min(100, (quota.customerUsed / quota.customerLimit) * 100) : 0;
  const personaDone = Boolean(persona.persona_name && persona.greeting_template);

  const kpis = [
    {
      label: isRTL ? 'الرد التلقائي' : 'Auto-Reply',
      value: settings.storefront_assistant ? (isRTL ? 'مفعّل' : 'ON') : (isRTL ? 'متوقف' : 'OFF'),
      icon: <Bot className="w-3.5 h-3.5 text-white" />,
      gradient: settings.storefront_assistant ? 'from-emerald-500 to-emerald-600' : 'from-slate-400 to-slate-500',
      shadow: 'shadow-emerald-500/20',
      valueColor: settings.storefront_assistant ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      sub: `${platformsActive}/5 ${isRTL ? 'منصات' : 'platforms'}`,
    },
    {
      label: isRTL ? 'مساعد اللوحة' : 'Dashboard AI',
      value: settings.ai_chat_enabled ? (isRTL ? 'مفعّل' : 'ON') : (isRTL ? 'متوقف' : 'OFF'),
      icon: <Brain className="w-3.5 h-3.5 text-white" />,
      gradient: 'from-violet-500 to-violet-600', shadow: 'shadow-violet-500/20',
      sub: isRTL ? 'فقاعة المساعدة' : 'Help bubble',
    },
    {
      label: isRTL ? 'استهلاك المالك' : 'Owner usage',
      value: quota ? `${Math.round(ownerPct)}%` : '—',
      icon: <FileText className="w-3.5 h-3.5 text-white" />,
      gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20',
      sub: quota ? `${quota.ownerUsed.toLocaleString()} / ${quota.ownerLimit.toLocaleString()}` : undefined,
    },
    {
      label: isRTL ? 'ردود العملاء' : 'Customer replies',
      value: quota ? `${Math.round(customerPct)}%` : '—',
      icon: <MessageCircle className="w-3.5 h-3.5 text-white" />,
      gradient: 'from-cyan-500 to-cyan-600', shadow: 'shadow-cyan-500/20',
      sub: quota ? `${quota.customerUsed.toLocaleString()} / ${quota.customerLimit.toLocaleString()}` : undefined,
    },
    {
      label: isRTL ? 'الحارس' : 'Guardian',
      value: settings.guardian_enabled ? (isRTL ? 'مفعّل' : 'ON') : (isRTL ? 'متوقف' : 'OFF'),
      icon: <Shield className="w-3.5 h-3.5 text-white" />,
      gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20',
      sub: isRTL ? 'تنبيهات المخزون والطلبات' : 'Stock & order alerts',
    },
    {
      label: isRTL ? 'الشخصية' : 'Persona',
      value: personaDone ? (isRTL ? 'جاهزة' : 'Ready') : (isRTL ? 'ناقصة' : 'Setup'),
      icon: <User className="w-3.5 h-3.5 text-white" />,
      gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/20',
      valueColor: personaDone ? undefined : 'text-amber-600 dark:text-amber-400',
      sub: isRTL ? 'اسم + تحية' : 'Name + greeting',
    },
  ];

  const tabs: { id: TabId; label: string }[] = [
    { id: 'auto-reply', label: isRTL ? 'الرد التلقائي' : 'Auto-Reply' },
    { id: 'persona', label: isRTL ? 'شخصية المساعد' : 'Persona' },
    { id: 'permissions', label: isRTL ? 'الصلاحيات' : 'Permissions' },
    { id: 'product', label: isRTL ? 'المنتجات' : 'Products' },
    { id: 'advanced', label: isRTL ? 'متقدم' : 'Advanced' },
  ];

  const SectionTitle = ({ bar = 'from-primary to-accent', children }: { bar?: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className={`inline-block w-1 h-4 rounded-full bg-gradient-to-b ${bar}`} />
      <span className="text-sm font-bold text-foreground">{children}</span>
    </div>
  );

  const ToggleRow = ({ checked, onChange, label, desc, icon }: { checked: boolean; onChange: () => void; label: string; desc: string; icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
      <div className="w-7 h-7 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );

  const ChatBox = ({ messages, emptyText, loading: chatLoading }: { messages: {role:'user'|'ai',text:string}[]; emptyText: string; loading: boolean }) => (
    <div className="h-[220px] overflow-y-auto space-y-2 p-3 rounded-lg bg-muted/40 border border-border/40">
      {messages.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-10">{emptyText}</p>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
            msg.role === 'user'
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-card text-foreground rounded-bl-sm border border-border/60 shadow-sm'
          }`}>
            {msg.text}
          </div>
        </div>
      ))}
      {chatLoading && (
        <div className="flex justify-start">
          <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-card border border-border/60 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header (same as MarketingAnalytics) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {isRTL ? 'الذكاء الاصطناعي' : 'AI Settings'}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              {isRTL ? '3 خطوات: فعّل الرد ← خصّص الشخصية ← جرّب' : '3 steps: enable → customize → test'}
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/30 h-8 text-xs font-bold px-4">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : null}
          {isRTL ? 'حفظ الإعدادات' : 'Save'}
        </Button>
      </div>

      {/* ── Row 1: KPI Cards (same as MarketingAnalytics) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpis.map((k, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-3 hover:border-primary/30 transition-all duration-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow ${k.shadow}`}>
                {k.icon}
              </div>
              <span className="text-xs font-bold text-muted-foreground tracking-wide">{k.label}</span>
            </div>
            <p className={`text-lg font-black tabular-nums leading-none ${k.valueColor || 'text-foreground'}`}>{k.value}</p>
            {k.sub && <p className="text-[11px] mt-1 font-medium text-muted-foreground">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Tabs (same segmented style as Analytics days filter) ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="bg-muted/40 p-1 rounded-lg border border-border/40 flex gap-1 overflow-x-auto max-w-full">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setActiveTab(tb.id)}
              className={`px-3 h-7 rounded-md text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                activeTab === tb.id
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              }`}>
              {tb.label}
            </button>
          ))}
        </div>
        {activeTab === 'persona' && (
          <Button onClick={savePersona} disabled={personaSaving} size="sm" className="bg-primary hover:bg-primary/90 text-white shadow-sm h-7 text-xs font-bold">
            {personaSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : null}
            {isRTL ? 'حفظ الشخصية' : 'Save persona'}
          </Button>
        )}
      </div>

      {/* ── AUTO-REPLY TAB ── */}
      {activeTab === 'auto-reply' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 shadow-sm">
            <SectionTitle bar="from-emerald-500 to-teal-500">
              {isRTL ? 'الرد التلقائي على العملاء' : 'Customer Auto-Reply'}
            </SectionTitle>
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/40 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{isRTL ? 'تفعيل الرد التلقائي' : 'Enable auto-reply'}</p>
                <p className="text-[11px] text-muted-foreground">{isRTL ? 'الذكاء الاصطناعي يرد تلقائياً على رسائل العملاء في جميع المنصات المفعّلة' : 'AI replies automatically on all enabled platforms'}</p>
              </div>
              <Switch checked={settings.storefront_assistant} onCheckedChange={() => toggle('storefront_assistant')} />
            </div>
            {settings.storefront_assistant ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {platforms.map(p => (
                  <div key={p.key} className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                    <div className="w-7 h-7 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0">{p.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.desc}</p>
                    </div>
                    <Switch checked={settings[p.key] as boolean} onCheckedChange={() => toggle(p.key)} className="shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center py-6">
                {isRTL ? 'الرد التلقائي متوقف — فعّله ليبدأ المساعد بالرد على زبائنك' : 'Auto-reply is off — enable it to let AI answer customers'}
              </p>
            )}
            <div className="mt-3">
              <label className="text-xs font-bold text-foreground mb-1 block">{isRTL ? 'تعليمات للمساعد' : 'AI instructions'}</label>
              <p className="text-[11px] text-muted-foreground mb-2">
                {isRTL ? 'مثال: "التوصيل متاح لجميع الولايات، الدفع عند الاستلام"' : 'e.g. "Delivery nationwide, cash on delivery"'}
              </p>
              <Textarea
                value={settings.ai_instructions}
                onChange={e => updateInstructions(e.target.value)}
                placeholder={isRTL ? 'اكتب تعليماتك هنا...' : 'Write your instructions here...'}
                className="min-h-[80px] text-xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <SectionTitle bar="from-blue-500 to-cyan-500">{isRTL ? 'استخدام الشهر' : 'Monthly usage'}</SectionTitle>
              {quota ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{isRTL ? 'مساعد المتجر' : 'Store AI'}</span>
                      <span className="text-xs font-black text-foreground tabular-nums">{quota.ownerUsed.toLocaleString()} / {quota.ownerLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" style={{ width: `${ownerPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{isRTL ? 'الرد على العملاء' : 'Customer replies'}</span>
                      <span className="text-xs font-black text-foreground tabular-nums">{quota.customerUsed.toLocaleString()} / {quota.customerLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${customerPct}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center py-4">{isRTL ? 'لا توجد بيانات استخدام' : 'No usage data'}</p>
              )}
              {/* ── Day pass (200 DZD / 24h): price always visible, buy box when running low ── */}
              {quota?.passActive && quota.passEndsAt ? (
                <div className="mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {isRTL
                      ? `اليوم الإضافي مفعّل حتى ${new Date(quota.passEndsAt).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                      : `Day pass active until ${new Date(quota.passEndsAt).toLocaleString()}`}
                  </p>
                </div>
              ) : (ownerPct >= 70 || customerPct >= 70) ? (
                <div className="mt-3 bg-muted/40 border border-border/40 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow shadow-amber-500/20 shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        {isRTL ? `استهلكت حصتك؟ واصل اليوم كاملاً بـ ${quota?.dayPassPriceDzd || 200} دج` : `Out of allowance? Continue today for ${quota?.dayPassPriceDzd || 200} DZD`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{isRTL ? 'ردود غير محدودة لمدة 24 ساعة' : 'Unlimited replies for 24 hours'}</p>
                    </div>
                  </div>
                  <Button onClick={buyDayPass} disabled={buyingPass} size="sm" className="w-full mt-2 h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
                    {buyingPass ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : null}
                    {isRTL ? `تفعيل اليوم الإضافي — ${quota?.dayPassPriceDzd || 200} دج` : `Activate day pass — ${quota?.dayPassPriceDzd || 200} DZD`}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 px-1">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground flex-1">
                    {isRTL
                      ? `عند نفاد الحصة: يوم إضافي (24 ساعة، ردود غير محدودة) بـ ${quota?.dayPassPriceDzd || 200} دج`
                      : `When allowance runs out: extra day (24h, unlimited replies) for ${quota?.dayPassPriceDzd || 200} DZD`}
                  </p>
                  <Button onClick={buyDayPass} disabled={buyingPass} variant="ghost" size="sm" className="h-6 px-2 text-[11px] font-bold text-primary hover:text-primary shrink-0">
                    {buyingPass ? <Loader2 className="w-3 h-3 animate-spin" /> : (isRTL ? 'تفعيل' : 'Get it')}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2">
              <SectionTitle bar="from-violet-500 to-purple-500">{isRTL ? 'خدمات سريعة' : 'Quick services'}</SectionTitle>
              <ToggleRow checked={settings.guardian_enabled} onChange={() => toggle('guardian_enabled')}
                label={isRTL ? 'حارس المتجر' : 'Store Guardian'}
                desc={isRTL ? 'تنبيهات الطلبات المعلقة والمخزون' : 'Stale orders & low stock alerts'}
                icon={<Shield className="w-3.5 h-3.5 text-amber-500" />} />
              <ToggleRow checked={settings.ai_chat_enabled} onChange={() => toggle('ai_chat_enabled')}
                label={isRTL ? 'مساعد اللوحة' : 'Dashboard assistant'}
                desc={isRTL ? 'فقاعة المساعدة داخل لوحة التحكم' : 'Help bubble inside dashboard'}
                icon={<Brain className="w-3.5 h-3.5 text-indigo-500" />} />
            </div>
          </div>
        </div>
      )}

      {/* ── PERSONA TAB ── */}
      {activeTab === 'persona' && (
        <>
          {personaLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-3">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-violet-500 to-purple-500">{isRTL ? 'الهوية' : 'Identity'}</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'الاسم' : 'Name'}</label>
                      <Input value={persona.persona_name} onChange={e => updatePersona('persona_name', e.target.value)} className="text-xs h-8" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'النبرة' : 'Tone'}</label>
                      <Select value={persona.tone} onValueChange={v => updatePersona('tone', v)}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">{isRTL ? 'مهنية' : 'Professional'}</SelectItem>
                          <SelectItem value="friendly">{isRTL ? 'ودودة' : 'Friendly'}</SelectItem>
                          <SelectItem value="casual">{isRTL ? 'عادية' : 'Casual'}</SelectItem>
                          <SelectItem value="luxury">{isRTL ? 'فاخرة' : 'Luxury'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'اللغة' : 'Language'}</label>
                      <Select value={persona.primary_language} onValueChange={v => updatePersona('primary_language', v)}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">العربية</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'ملاحظة عن الشخصية' : 'Personality note'}</label>
                    <Textarea value={persona.personality_note} onChange={e => updatePersona('personality_note', e.target.value)}
                      placeholder={isRTL ? 'مثال: علامة فاخرة، رد برقي' : 'e.g. luxury brand, elegant tone'}
                      className="text-xs min-h-[56px]" />
                  </div>
                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'نوع النشاط' : 'Business type'}</label>
                    <Input value={persona.business_type} onChange={e => updatePersona('business_type', e.target.value)}
                      placeholder={isRTL ? 'تجزئة، جملة، يدوي...' : 'retail, wholesale...'} className="text-xs h-8" />
                  </div>
                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'مجالات الخبرة (Enter للإضافة)' : 'Expertise (Enter to add)'}</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {persona.expertise_areas.map((area, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                          {area}
                          <button onClick={() => updatePersona('expertise_areas', persona.expertise_areas.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <Input placeholder={isRTL ? 'أضف مجالاً...' : 'Add area...'} className="text-xs h-8"
                      onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('expertise_areas', [...persona.expertise_areas, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-emerald-500 to-teal-500">{isRTL ? 'القصة والفلسفة' : 'Story & philosophy'}</SectionTitle>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'قصة المتجر' : 'Store story'}</label>
                      <Textarea value={persona.store_story} onChange={e => updatePersona('store_story', e.target.value)}
                        placeholder={isRTL ? 'بدأنا في 2020 بهدف...' : 'Our journey...'} className="text-xs min-h-[56px]" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'فلسفة المنتجات' : 'Product philosophy'}</label>
                      <Textarea value={persona.product_philosophy} onChange={e => updatePersona('product_philosophy', e.target.value)}
                        placeholder={isRTL ? 'نبيع فقط...' : 'We only sell...'} className="text-xs min-h-[56px]" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'نقاط القوة (Enter للإضافة)' : 'USPs (Enter to add)'}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {persona.unique_selling_points.map((usp, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {usp}
                            <button onClick={() => updatePersona('unique_selling_points', persona.unique_selling_points.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <Input placeholder={isRTL ? 'أضف نقطة قوة...' : 'Add USP...'} className="text-xs h-8"
                        onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('unique_selling_points', [...persona.unique_selling_points, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-amber-500 to-orange-500">{isRTL ? 'سلوك البيع' : 'Sales behavior'}</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <div className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                      <span className="text-xs font-bold text-foreground">{isRTL ? 'Upsell' : 'Upsell'}</span>
                      <Switch checked={persona.upsell_enabled} onCheckedChange={v => updatePersona('upsell_enabled', v)} />
                    </div>
                    <div className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                      <span className="text-xs font-bold text-foreground">{isRTL ? 'Cross-sell' : 'Cross-sell'}</span>
                      <Switch checked={persona.cross_sell_enabled} onCheckedChange={v => updatePersona('cross_sell_enabled', v)} />
                    </div>
                    <div className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                      <span className="text-xs font-bold text-foreground">{isRTL ? 'إلحاح' : 'Urgency'}</span>
                      <Switch checked={persona.urgency_enabled} onCheckedChange={v => updatePersona('urgency_enabled', v)} />
                    </div>
                  </div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'سياسة الخصم' : 'Discount policy'}</label>
                  <Textarea value={persona.discount_policy} onChange={e => updatePersona('discount_policy', e.target.value)}
                    placeholder={isRTL ? 'مثال: لا خصم فوق 10% بدون موافقة' : 'Max 10% without approval'}
                    className="text-xs min-h-[56px] mb-2" />
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'سياسة المنافسين' : 'Competitor policy'}</label>
                  <Select value={persona.competitor_policy} onValueChange={v => updatePersona('competitor_policy', v)}>
                    <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">{isRTL ? 'تجاهل' : 'Ignore'}</SelectItem>
                      <SelectItem value="acknowledge_neutral">{isRTL ? 'اعتراف محايد' : 'Acknowledge (neutral)'}</SelectItem>
                      <SelectItem value="dont_mention">{isRTL ? 'لا تذكرهم' : "Don't mention"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-pink-500 to-rose-500">{isRTL ? 'التواصل' : 'Communication'}</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <div className="bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'إيموجي' : 'Emoji'}</label>
                      <Switch checked={persona.use_emojis} onCheckedChange={v => updatePersona('use_emojis', v)} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'نمط الإيموجي' : 'Emoji style'}</label>
                      <Select value={persona.emoji_style} onValueChange={v => updatePersona('emoji_style', v)}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{isRTL ? 'بدون' : 'None'}</SelectItem>
                          <SelectItem value="minimal">{isRTL ? 'بسيط' : 'Minimal'}</SelectItem>
                          <SelectItem value="moderate">{isRTL ? 'معتدل' : 'Moderate'}</SelectItem>
                          <SelectItem value="heavy">{isRTL ? 'كثير' : 'Heavy'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'طول الرد' : 'Length'}</label>
                      <Select value={persona.response_length} onValueChange={v => updatePersona('response_length', v)}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">{isRTL ? 'قصير' : 'Short'}</SelectItem>
                          <SelectItem value="medium">{isRTL ? 'متوسط' : 'Medium'}</SelectItem>
                          <SelectItem value="detailed">{isRTL ? 'مفصل' : 'Detailed'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'تحية' : 'Greeting'}</label>
                  <Input value={persona.greeting_template} onChange={e => updatePersona('greeting_template', e.target.value)}
                    placeholder={isRTL ? 'أهلاً بك في متجرنا! كيف نخدمك؟' : 'Welcome! How can we help?'} className="text-xs h-8 mb-2" />
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">{isRTL ? 'ختام' : 'Closing'}</label>
                  <Input value={persona.closing_template} onChange={e => updatePersona('closing_template', e.target.value)}
                    placeholder={isRTL ? 'شكراً لتسوقك معنا!' : 'Thanks for shopping!'} className="text-xs h-8" />
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-blue-500 to-indigo-500">{isRTL ? 'الأسئلة المتكررة' : 'FAQ'}</SectionTitle>
                  <div className="space-y-2">
                    {persona.faq_entries.map((faq, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-muted-foreground">{isRTL ? `سؤال ${i + 1}` : `Q${i + 1}`}</span>
                          <button onClick={() => updatePersona('faq_entries', persona.faq_entries.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Input value={faq.q} onChange={e => { const copy = [...persona.faq_entries]; copy[i] = { ...copy[i], q: e.target.value }; updatePersona('faq_entries', copy); }}
                          placeholder={isRTL ? 'السؤال...' : 'Question...'} className="text-xs h-8 bg-card" />
                        <Textarea value={faq.a} onChange={e => { const copy = [...persona.faq_entries]; copy[i] = { ...copy[i], a: e.target.value }; updatePersona('faq_entries', copy); }}
                          placeholder={isRTL ? 'الإجابة...' : 'Answer...'} className="text-xs min-h-[48px] bg-card" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updatePersona('faq_entries', [...persona.faq_entries, { q: '', a: '' }])}>
                      <Plus className="w-3.5 h-3.5 ml-1" /> {isRTL ? 'إضافة سؤال' : 'Add FAQ'}
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-red-500 to-orange-500">{isRTL ? 'الاعتراضات الشائعة' : 'Objections'}</SectionTitle>
                  <div className="space-y-2">
                    {persona.common_objections.map((obj, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-muted-foreground">{isRTL ? `اعتراض ${i + 1}` : `Objection ${i + 1}`}</span>
                          <button onClick={() => updatePersona('common_objections', persona.common_objections.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Input value={obj.q} onChange={e => { const copy = [...persona.common_objections]; copy[i] = { ...copy[i], q: e.target.value }; updatePersona('common_objections', copy); }}
                          placeholder={isRTL ? 'مثال: السعر مرتفع' : 'Price too high'} className="text-xs h-8 bg-card" />
                        <Textarea value={obj.a} onChange={e => { const copy = [...persona.common_objections]; copy[i] = { ...copy[i], a: e.target.value }; updatePersona('common_objections', copy); }}
                          placeholder={isRTL ? 'مثال: السعر يشمل التوصيل...' : 'Includes delivery...'}
                          className="text-xs min-h-[48px] bg-card" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updatePersona('common_objections', [...persona.common_objections, { q: '', a: '' }])}>
                      <Plus className="w-3.5 h-3.5 ml-1" /> {isRTL ? 'إضافة اعتراض' : 'Add objection'}
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <SectionTitle bar="from-slate-400 to-slate-500">{isRTL ? 'مواضيع ممنوعة' : 'Forbidden topics'}</SectionTitle>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {persona.forbidden_topics.map((topic, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400">
                        {topic}
                        <button onClick={() => updatePersona('forbidden_topics', persona.forbidden_topics.filter((_, j) => j !== i))} className="hover:text-red-700"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <Input placeholder={isRTL ? 'أضف موضوعاً + Enter' : 'Add topic + Enter'} className="text-xs h-8"
                    onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('forbidden_topics', [...persona.forbidden_topics, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PERMISSIONS TAB ── */}
      {activeTab === 'permissions' && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <SectionTitle bar="from-red-500 to-rose-500">{isRTL ? 'صلاحيات الذكاء الاصطناعي' : 'AI permissions'}</SectionTitle>
          <p className="text-[11px] text-muted-foreground mb-3">
            {isRTL ? 'اختر ما يستطيع المساعد فعله في متجرك — للمبتدئين اترك الافتراضي' : 'Choose what AI can do — beginners can keep defaults'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <ToggleRow checked={settings.action_order_status} onChange={() => toggle('action_order_status')} label={isRTL ? 'تعديل حالة الطلبات' : 'Change order status'} desc={isRTL ? 'مؤكد، ملغي، تم التوصيل...' : 'Confirmed, cancelled, delivered...'} icon={<RefreshCw className="w-3.5 h-3.5 text-rose-500" />} />
            <ToggleRow checked={settings.action_create_product} onChange={() => toggle('action_create_product')} label={isRTL ? 'إضافة منتجات' : 'Create products'} desc={isRTL ? 'إضافة منتجات جديدة' : 'Add new products'} icon={<Plus className="w-3.5 h-3.5 text-emerald-500" />} />
            <ToggleRow checked={settings.action_edit_product} onChange={() => toggle('action_edit_product')} label={isRTL ? 'تعديل المنتجات' : 'Edit products'} desc={isRTL ? 'السعر، المخزون، الوصف' : 'Price, stock, description'} icon={<Pencil className="w-3.5 h-3.5 text-blue-500" />} />
            <ToggleRow checked={settings.action_delete_product} onChange={() => toggle('action_delete_product')} label={isRTL ? 'حذف المنتجات' : 'Delete products'} desc={isRTL ? 'إلغاء تفعيل المنتجات' : 'Deactivate products'} icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} />
            <ToggleRow checked={settings.action_store_design} onChange={() => toggle('action_store_design')} label={isRTL ? 'تعديل التصميم' : 'Edit design'} desc={isRTL ? 'الألوان، الخطوط، النصوص' : 'Colors, fonts, text'} icon={<Palette className="w-3.5 h-3.5 text-purple-500" />} />
            <ToggleRow checked={settings.action_bot_control} onChange={() => toggle('action_bot_control')} label={isRTL ? 'التحكم في البوت' : 'Control bot'} desc={isRTL ? 'تشغيل/إيقاف بالأوامر' : 'Enable/disable via commands'} icon={<Bot className="w-3.5 h-3.5 text-amber-500" />} />
          </div>
        </div>
      )}

      {/* ── PRODUCT TAB ── */}
      {activeTab === 'product' && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <SectionTitle bar="from-indigo-500 to-violet-500">{isRTL ? 'أتمتة محتوى المنتجات' : 'Product automation'}</SectionTitle>
          <p className="text-[11px] text-muted-foreground mb-3">
            {isRTL ? 'الذكاء الاصطناعي يكتب عنك أوصاف المنتجات والصور' : 'AI writes descriptions and image text for you'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <ToggleRow checked={settings.auto_descriptions} onChange={() => toggle('auto_descriptions')} label={isRTL ? 'وصف المنتجات تلقائياً' : 'Auto descriptions'} desc={isRTL ? 'وصف لكل منتج جديد' : 'Description for each new product'} icon={<FileText className="w-3.5 h-3.5 text-indigo-500" />} />
            <ToggleRow checked={settings.auto_alt_text} onChange={() => toggle('auto_alt_text')} label={isRTL ? 'وصف الصور تلقائياً' : 'Auto alt-text'} desc={isRTL ? 'تحسين الظهور في البحث' : 'Better SEO'} icon={<Camera className="w-3.5 h-3.5 text-sky-500" />} />
          </div>
        </div>
      )}

      {/* ── ADVANCED TAB ── */}
      {activeTab === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <SectionTitle bar="from-orange-500 to-amber-500">{isRTL ? 'أدوات متقدمة' : 'Advanced tools'}</SectionTitle>
            <div className="space-y-2">
              <ToggleRow checked={settings.broadcast_composer} onChange={() => toggle('broadcast_composer')}
                label={isRTL ? 'كاتب الحملات' : 'Broadcast composer'}
                desc={isRTL ? 'صياغة رسائل الحملات' : 'Compose campaign messages'}
                icon={<Send className="w-3.5 h-3.5 text-orange-500" />} />
              <ToggleRow checked={settings.reply_suggestions} onChange={() => toggle('reply_suggestions')}
                label={isRTL ? 'اقتراحات الردود' : 'Reply suggestions'}
                desc={isRTL ? 'ردود جاهزة في المحادثات' : 'Ready replies in chat'}
                icon={<Sparkles className="w-3.5 h-3.5 text-purple-500" />} />
              <ToggleRow checked={settings.auto_cancel_orders} onChange={() => toggle('auto_cancel_orders')}
                label={isRTL ? 'الإلغاء التلقائي للطلبات' : 'Auto-cancel orders'}
                desc={isRTL ? 'يلغي الطلبات غير المشحونة عندما يطلب الزبون ذلك' : 'Cancels unshipped orders when the customer asks'}
                icon={<Shield className="w-3.5 h-3.5 text-red-500" />} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <SectionTitle bar="from-emerald-500 to-teal-500">{isRTL ? 'جرّب المساعد' : 'Test assistant'}</SectionTitle>
            <p className="text-[11px] text-muted-foreground mb-2">
              {isRTL ? 'احفظ أولاً ثم أرسل رسالة كزبون' : 'Save first, then send a test message'}
            </p>
            <ChatBox messages={testChat} emptyText={isRTL ? 'أرسل رسالة لبدء التجربة' : 'Send a message to start'} loading={testLoading} />
            <div className="flex gap-2 mt-2">
              <Input value={testMessage} onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); } }}
                placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'} className="text-xs h-8 flex-1" />
              <Button onClick={handleTestSend} disabled={testLoading || !testMessage.trim()} size="sm" className="h-8 bg-primary text-white">
                {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-xs font-bold text-foreground mb-2">{isRTL ? 'تجربة رد العملاء' : 'Customer reply test'}</p>
              <ChatBox messages={customerTestChat} emptyText={isRTL ? 'أرسل رسالة كزبون...' : 'Send as customer...'} loading={customerTestLoading} />
              <div className="flex gap-2 mt-2">
                <Input value={customerTestMessage} onChange={e => setCustomerTestMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustomerTestSend(); } }}
                  placeholder={isRTL ? 'رسالة زبون...' : 'Customer message...'} className="text-xs h-8 flex-1" />
                <Button onClick={handleCustomerTestSend} disabled={customerTestLoading || !customerTestMessage.trim()} size="sm" className="h-8 bg-primary text-white">
                  {customerTestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom helper for new users ── */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {[
            { n: '1', t: isRTL ? 'فعّل الرد التلقائي واختر المنصات' : 'Enable auto-reply + platforms', c: 'from-emerald-500 to-teal-500' },
            { n: '2', t: isRTL ? 'اكتب اسم المساعد + تحية + تعليمات' : 'Set name + greeting + instructions', c: 'from-violet-500 to-purple-500' },
            { n: '3', t: isRTL ? 'جرّب واحفظ' : 'Test and save', c: 'from-blue-500 to-cyan-500' },
          ].map(s => (
            <div key={s.n} className="flex items-center gap-2 flex-1 min-w-[180px]">
              <span className={`w-5 h-5 rounded-lg bg-gradient-to-br ${s.c} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>{s.n}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">{s.t}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Tag className="w-3.5 h-3.5" />
            {isRTL ? 'نصيحة: اترك الصلاحيات الافتراضية في البداية' : 'Tip: keep default permissions at first'}
          </div>
        </div>
      </div>
    </div>
  );
}
