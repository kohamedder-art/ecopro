import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Bot, MessageCircle, Smartphone, Globe, Camera, Shield, Pen, FileText, Send, BarChart3, RefreshCw, Plus, Trash2, Pencil, Palette, Brain, Sparkles, Loader2, CheckCircle2, AlertCircle, User, Tag, BookOpen, Heart, ShoppingCart, SmilePlus, X, ChevronDown } from "lucide-react";

interface AISettings {
  ai_chat_enabled: boolean;
  storefront_assistant: boolean;
  guardian_enabled: boolean;
  auto_descriptions: boolean;
  auto_alt_text: boolean;
  broadcast_composer: boolean;
  reply_suggestions: boolean;
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

export default function AISettingsPage() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const isRTL = locale === 'ar';
  const [settings, setSettings] = useState<AISettings>(DEFAULT);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'auto-reply' | 'permissions' | 'product' | 'advanced' | 'persona'>('auto-reply');
  const [persona, setPersona] = useState<PersonaConfig>(DEFAULT_PERSONA);
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
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
    setTestChat(prev => [...prev, { role: 'user', text: testMessage }]);
    setTestResponse('');
    try {
      const res = await fetch('/api/ai/persona/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: testMessage }),
      });
      const data = await res.json();
      if (data.answer) {
        setTestChat(prev => [...prev, { role: 'ai', text: data.answer }]);
        setTestResponse(data.answer);
      }
    } catch {
      setTestChat(prev => [...prev, { role: 'ai', text: isRTL ? 'حدث خطأ' : 'An error occurred' }]);
    } finally {
      setTestLoading(false);
      setTestMessage('');
    }
  };

  const handleCustomerTestSend = async () => {
    if (!customerTestMessage.trim()) return;
    setCustomerTestLoading(true);
    setCustomerTestChat(prev => [...prev, { role: 'user', text: customerTestMessage }]);
    try {
      const res = await fetch('/api/ai/test-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: customerTestMessage, chatId: customerTestChatId }),
      });
      const data = await res.json();
      if (data.answer) {
        setCustomerTestChat(prev => [...prev, { role: 'ai', text: data.answer }]);
      }
    } catch {
      setCustomerTestChat(prev => [...prev, { role: 'ai', text: isRTL ? 'حدث خطأ' : 'An error occurred' }]);
    } finally {
      setCustomerTestLoading(false);
      setCustomerTestMessage('');
    }
  };

  const TabButton = ({ id, label, icon }: { id: typeof activeTab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
        activeTab === id
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const ToggleRow = ({ checked, onChange, label, desc, icon }: { checked: boolean; onChange: () => void; label: string; desc: string; icon: React.ReactNode }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="flex-shrink-0 ml-3" />
    </div>
  );

  const platforms: PlatformToggle[] = [
    { key: 'ai_reply_messenger', icon: <MessageCircle className="w-4 h-4 text-blue-600" />, label: 'Facebook Messenger', desc: 'الرد على رسائل الفيسبوك' },
    { key: 'ai_reply_whatsapp', icon: <Smartphone className="w-4 h-4 text-green-600" />, label: 'WhatsApp', desc: 'الرد على رسائل واتساب' },
    { key: 'ai_reply_telegram', icon: <Send className="w-4 h-4 text-blue-500" />, label: 'Telegram', desc: 'الرد على رسائل تيليجرام' },
    { key: 'ai_reply_instagram', icon: <Camera className="w-4 h-4 text-pink-600" />, label: 'Instagram', desc: 'الرد على رسائل إنستغرام' },
    { key: 'ai_reply_viber', icon: <Globe className="w-4 h-4 text-purple-600" />, label: 'Viber', desc: 'الرد على رسائل Viber' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-500" />
            {isRTL ? 'الذكاء الاصطناعي' : 'AI Settings'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isRTL ? 'تحكم في إعدادات الذكاء الاصطناعي لمتجرك' : 'Control your store\'s AI settings'}
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25">
          {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      {/* Monthly Usage */}
      {quota && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-500/5 to-slate-600/5 border border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            {isRTL ? 'استخدام الشهر الحالي' : 'Monthly Usage'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{isRTL ? 'مساعد المتجر' : 'Store Owner AI'}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{quota.ownerUsed.toLocaleString()} / {quota.ownerLimit.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all" style={{ width: `${Math.min(100, (quota.ownerUsed / quota.ownerLimit) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{isRTL ? 'الرد على العملاء' : 'Customer Auto-Reply'}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{quota.customerUsed.toLocaleString()} / {quota.customerLimit.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${Math.min(100, (quota.customerUsed / quota.customerLimit) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <TabButton id="auto-reply" label={isRTL ? 'الرد التلقائي' : 'Auto-Reply'} icon={<MessageCircle className="w-4 h-4" />} />
        <TabButton id="permissions" label={isRTL ? 'الصلاحيات' : 'Permissions'} icon={<Shield className="w-4 h-4" />} />
        <TabButton id="product" label={isRTL ? 'المنتجات' : 'Products'} icon={<FileText className="w-4 h-4" />} />
        <TabButton id="advanced" label={isRTL ? 'خيارات متقدمة' : 'Advanced'} icon={<Sparkles className="w-4 h-4" />} />
        <TabButton id="persona" label={isRTL ? 'شخصية المساعد' : 'AI Persona'} icon={<User className="w-4 h-4" />} />
      </div>

      {/* ── AUTO-REPLY TAB ── */}
      {activeTab === 'auto-reply' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Master toggle */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-200/50 dark:border-purple-800/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    {isRTL ? 'الرد التلقائي على العملاء' : 'Customer Auto-Reply'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {isRTL ? 'الذكاء الاصطناعي يرد تلقائياً على رسائل العملاء في جميع المنصات' : 'AI automatically replies to customers across all platforms'}
                  </p>
                </div>
                <Switch checked={settings.storefront_assistant} onCheckedChange={() => toggle('storefront_assistant')} />
              </div>
              {/* Per-platform toggles */}
              <div className={`grid ${settings.storefront_assistant ? 'grid-cols-1 sm:grid-cols-2 gap-2' : 'hidden'}`}>
                {platforms.map(p => (
                  <div key={p.key} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2.5">
                      {p.icon}
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.label}</span>
                    </div>
                    <Switch checked={settings[p.key] as boolean} onCheckedChange={() => toggle(p.key)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  {isRTL ? 'تعليمات الذكاء الاصطناعي' : 'AI Instructions'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {isRTL ? 'أخبر الذكاء الاصطناعي كيف يتعامل مع عملائك — مثلاً: "قل للزبون أن التوصيل متاح لجميع الولايات"' : 'Tell the AI how to treat your customers — e.g., "Inform customers delivery is available nationwide"'}
                </p>
                <Textarea
                  value={settings.ai_instructions}
                  onChange={e => updateInstructions(e.target.value)}
                  placeholder={isRTL ? 'اكتب تعليماتك هنا...' : 'Write your instructions here...'}
                  className="min-h-[100px] text-sm"
                />
              </div>

              {/* Guardian */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/50 dark:border-amber-800/30 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isRTL ? 'حارس المتجر' : 'Store Guardian'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'تنبيهات تلقائية عن الطلبات المعلقة والمخزون المنخفض' : 'Automatic alerts for stale orders and low stock'}</p>
                  </div>
                </div>
                <Switch checked={settings.guardian_enabled} onCheckedChange={() => toggle('guardian_enabled')} />
              </div>

              {/* AI Chat (store owner) */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-200/50 dark:border-indigo-800/30 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isRTL ? 'المساعد الذكي (لوحة التحكم)' : 'AI Assistant (Dashboard)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'فقاعة المساعد الذكي في لوحة التحكم للاستشارات' : 'Floating AI chat bubble in your dashboard for advice'}</p>
                  </div>
                </div>
                <Switch checked={settings.ai_chat_enabled} onCheckedChange={() => toggle('ai_chat_enabled')} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PERMISSIONS TAB ── */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? 'الصلاحيات التي يملكها الذكاء الاصطناعي لتنفيذ الإجراءات في متجرك' : 'Permissions the AI has to execute actions in your store'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <ToggleRow checked={settings.action_order_status} onChange={() => toggle('action_order_status')} label={isRTL ? 'تعديل حالة الطلبات' : 'Change Order Status'} desc={isRTL ? 'تحديث حالة الطلب (مؤكد، ملغي، تم التوصيل...)' : 'Update order status (confirmed, cancelled, delivered...)'} icon={<RefreshCw className="w-4 h-4 text-rose-500" />} />
              <ToggleRow checked={settings.action_create_product} onChange={() => toggle('action_create_product')} label={isRTL ? 'إضافة منتجات جديدة' : 'Create Products'} desc={isRTL ? 'إضافة منتجات جديدة للمتجر' : 'Add new products to your store'} icon={<Plus className="w-4 h-4 text-emerald-500" />} />
              <ToggleRow checked={settings.action_edit_product} onChange={() => toggle('action_edit_product')} label={isRTL ? 'تعديل المنتجات' : 'Edit Products'} desc={isRTL ? 'تعديل الأسعار، المخزون، الوصف والعناوين' : 'Edit prices, stock, descriptions, and titles'} icon={<Pencil className="w-4 h-4 text-blue-500" />} />
            </div>
            <div className="space-y-3">
              <ToggleRow checked={settings.action_delete_product} onChange={() => toggle('action_delete_product')} label={isRTL ? 'حذف المنتجات' : 'Delete Products'} desc={isRTL ? 'إلغاء تفعيل المنتجات من المتجر' : 'Deactivate products from your store'} icon={<Trash2 className="w-4 h-4 text-red-500" />} />
              <ToggleRow checked={settings.action_store_design} onChange={() => toggle('action_store_design')} label={isRTL ? 'تعديل التصميم' : 'Edit Store Design'} desc={isRTL ? 'تغيير الألوان، الخطوط، والنصوص في المتجر' : 'Change colors, fonts, and store text'} icon={<Palette className="w-4 h-4 text-purple-500" />} />
              <ToggleRow checked={settings.action_bot_control} onChange={() => toggle('action_bot_control')} label={isRTL ? 'التحكم في البوت' : 'Control Bot'} desc={isRTL ? 'تشغيل وإيقاف البوت عبر الأوامر الصوتية' : 'Enable/disable the bot via voice commands'} icon={<Bot className="w-4 h-4 text-amber-500" />} />
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT TAB ── */}
      {activeTab === 'product' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? 'أتمتة كتابة محتوى المنتجات باستخدام الذكاء الاصطناعي' : 'Automate product content writing with AI'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ToggleRow checked={settings.auto_descriptions} onChange={() => toggle('auto_descriptions')} label={isRTL ? 'وصف المنتجات تلقائياً' : 'Auto-Generate Descriptions'} desc={isRTL ? 'الذكاء الاصطناعي يكتب وصفاً لكل منتج جديد تضيفه' : 'AI writes a description for every new product you add'} icon={<FileText className="w-4 h-4 text-indigo-500" />} />
            <ToggleRow checked={settings.auto_alt_text} onChange={() => toggle('auto_alt_text')} label={isRTL ? 'وصف الصور تلقائياً' : 'Auto-Generate Image Alt Text'} desc={isRTL ? 'نصوص بديلة للصور لتحسين ظهور متجرك في محركات البحث' : 'Alt text for images to improve your store\'s SEO'} icon={<Camera className="w-4 h-4 text-sky-500" />} />
          </div>
        </div>
      )}

      {/* ── ADVANCED TAB ── */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Broadcast Composer */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-200/50 dark:border-orange-800/30 flex items-center justify-center">
                  <Send className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isRTL ? 'كاتب الحملات التسويقية' : 'Broadcast Composer'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'صياغة رسائل الحملات التسويقية بالذكاء الاصطناعي' : 'AI composes marketing campaign messages'}</p>
                </div>
              </div>
              <Switch checked={settings.broadcast_composer} onCheckedChange={() => toggle('broadcast_composer')} />
            </div>

            {/* Storefront Assistant */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isRTL ? 'توصيات الردود (Chat)' : 'Reply Suggestions (Chat)'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'اقتراحات ردود جاهزة في شاشة المحادثات' : 'Ready-made reply suggestions in the chat screen'}</p>
                </div>
              </div>
              <Switch checked={settings.reply_suggestions} onCheckedChange={() => toggle('reply_suggestions')} />
            </div>
          </div>
        </div>
      )}

      {/* ── PERSONA TAB ── */}
      {activeTab === 'persona' && (
        <div className="space-y-4">
          {personaLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-500" />
                    {isRTL ? 'شخصية المساعد الذكي' : 'AI Assistant Persona'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {isRTL ? 'كيف يتحدث المساعد الذكي مع عملائك' : 'How your AI assistant talks to customers'}
                  </p>
                </div>
                <Button onClick={savePersona} disabled={personaSaving} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25">
                  {personaSaving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT COLUMN */}
                <div className="space-y-4">
                  {/* Identity */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-500" /> {isRTL ? 'الهوية' : 'Identity'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'الاسم' : 'Name'}</label>
                        <Input value={persona.persona_name} onChange={e => updatePersona('persona_name', e.target.value)} className="text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'النبرة' : 'Tone'}</label>
                        <Select value={persona.tone} onValueChange={v => updatePersona('tone', v)}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">{isRTL ? 'مهنية' : 'Professional'}</SelectItem>
                            <SelectItem value="friendly">{isRTL ? 'ودودة' : 'Friendly'}</SelectItem>
                            <SelectItem value="casual">{isRTL ? 'عادية' : 'Casual'}</SelectItem>
                            <SelectItem value="luxury">{isRTL ? 'فاخرة' : 'Luxury'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'اللغة' : 'Language'}</label>
                        <Select value={persona.primary_language} onValueChange={v => updatePersona('primary_language', v)}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ar">العربية</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'ملاحظات عن الشخصية' : 'Personality Note'}</label>
                      <Textarea value={persona.personality_note} onChange={e => updatePersona('personality_note', e.target.value)}
                        placeholder={isRTL ? 'مثال: نحن علامة تجارية فاخرة، كن راقياً في الرد' : 'e.g. We are a luxury brand, be elegant'}
                        className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'نوع النشاط' : 'Business Type'}</label>
                      <Input value={persona.business_type} onChange={e => updatePersona('business_type', e.target.value)}
                        placeholder={isRTL ? 'مثال: تجزئة، جملة، منتجات يدوية' : 'retail, wholesale, handmade'} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'مجالات الخبرة' : 'Expertise Areas'}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {persona.expertise_areas.map((area, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                            {area}
                            <button onClick={() => updatePersona('expertise_areas', persona.expertise_areas.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder={isRTL ? 'أضف مجالاً...' : 'Add area...'} className="text-sm flex-1"
                          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('expertise_areas', [...persona.expertise_areas, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                      </div>
                    </div>
                  </div>

                  {/* Story & Philosophy */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-500" /> {isRTL ? 'القصة والفلسفة' : 'Story & Philosophy'}
                    </h3>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'قصة المتجر' : 'Store Story'}</label>
                      <Textarea value={persona.store_story} onChange={e => updatePersona('store_story', e.target.value)}
                        placeholder={isRTL ? 'مثال: بدأنا رحلتنا في 2020 بهدف توفير منتجات عضوية...' : 'Our journey...'} className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'فلسفة المنتجات' : 'Product Philosophy'}</label>
                      <Textarea value={persona.product_philosophy} onChange={e => updatePersona('product_philosophy', e.target.value)}
                        placeholder={isRTL ? 'مثال: نبيع فقط المنتجات العضوية الطبيعية...' : 'We only sell organic...'} className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'نقاط القوة' : 'Unique Selling Points'}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {persona.unique_selling_points.map((usp, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {usp}
                            <button onClick={() => updatePersona('unique_selling_points', persona.unique_selling_points.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <Input placeholder={isRTL ? 'أضف نقطة قوة...' : 'Add USP...'} className="text-sm"
                        onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('unique_selling_points', [...persona.unique_selling_points, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                    </div>
                  </div>

                  {/* Sales Behavior */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-amber-500" /> {isRTL ? 'سلوك البيع' : 'Sales Behavior'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{isRTL ? 'اقتراح منتجات إضافية' : 'Upsell'}</span>
                        <Switch checked={persona.upsell_enabled} onCheckedChange={v => updatePersona('upsell_enabled', v)} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{isRTL ? 'اقتراح منتجات مكملة' : 'Cross-sell'}</span>
                        <Switch checked={persona.cross_sell_enabled} onCheckedChange={v => updatePersona('cross_sell_enabled', v)} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{isRTL ? 'خلق إلحاح (بقي فقط X)' : 'Urgency'}</span>
                        <Switch checked={persona.urgency_enabled} onCheckedChange={v => updatePersona('urgency_enabled', v)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'سياسة الخصم' : 'Discount Policy'}</label>
                      <Textarea value={persona.discount_policy} onChange={e => updatePersona('discount_policy', e.target.value)}
                        placeholder={isRTL ? 'مثال: لا تقدم خصماً أكثر من 10% بدون موافقة المدير' : 'Never offer more than 10% without manager approval'}
                        className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'سياسة المنافسين' : 'Competitor Policy'}</label>
                      <Select value={persona.competitor_policy} onValueChange={v => updatePersona('competitor_policy', v)}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">{isRTL ? 'تجاهل' : 'Ignore'}</SelectItem>
                          <SelectItem value="acknowledge_neutral">{isRTL ? 'اعتراف محايد' : 'Acknowledge (neutral)'}</SelectItem>
                          <SelectItem value="dont_mention">{isRTL ? 'لا تذكرهم' : "Don't mention"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-4">
                  {/* Communication */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <SmilePlus className="w-4 h-4 text-pink-500" /> {isRTL ? 'التواصل' : 'Communication'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'استخدام الإيموجي' : 'Emoji Usage'}</label>
                        <Switch checked={persona.use_emojis} onCheckedChange={v => updatePersona('use_emojis', v)} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'نمط الإيموجي' : 'Emoji Style'}</label>
                        <Select value={persona.emoji_style} onValueChange={v => updatePersona('emoji_style', v)}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{isRTL ? 'بدون' : 'None'}</SelectItem>
                            <SelectItem value="minimal">{isRTL ? 'بسيط' : 'Minimal'}</SelectItem>
                            <SelectItem value="moderate">{isRTL ? 'معتدل' : 'Moderate'}</SelectItem>
                            <SelectItem value="heavy">{isRTL ? 'كثير' : 'Heavy'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'طول الرد' : 'Response Length'}</label>
                        <Select value={persona.response_length} onValueChange={v => updatePersona('response_length', v)}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">{isRTL ? 'قصير' : 'Short'}</SelectItem>
                            <SelectItem value="medium">{isRTL ? 'متوسط' : 'Medium'}</SelectItem>
                            <SelectItem value="detailed">{isRTL ? 'مفصل' : 'Detailed'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'تحية مخصصة' : 'Custom Greeting'}</label>
                      <Input value={persona.greeting_template} onChange={e => updatePersona('greeting_template', e.target.value)}
                        placeholder={isRTL ? 'مثال: أهلاً بك في متجرنا! كيف نقدر نخدمك؟' : 'Welcome to our store! How can we help?'} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{isRTL ? 'ختام مخصص' : 'Custom Closing'}</label>
                      <Input value={persona.closing_template} onChange={e => updatePersona('closing_template', e.target.value)}
                        placeholder={isRTL ? 'مثال: وشكراً لتسوقك معنا، دايماً في خدمتك!' : 'Thank you for shopping with us!'} className="text-sm" />
                    </div>
                  </div>

                  {/* FAQ Entries */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-blue-500" /> {isRTL ? 'الأسئلة المتكررة' : 'FAQ'}
                    </h3>
                    {persona.faq_entries.map((faq, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">{isRTL ? `سؤال ${i + 1}` : `Q${i + 1}`}</span>
                          <button onClick={() => updatePersona('faq_entries', persona.faq_entries.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Input value={faq.q} onChange={e => { const copy = [...persona.faq_entries]; copy[i] = { ...copy[i], q: e.target.value }; updatePersona('faq_entries', copy); }}
                          placeholder={isRTL ? 'السؤال...' : 'Question...'} className="text-sm" />
                        <Textarea value={faq.a} onChange={e => { const copy = [...persona.faq_entries]; copy[i] = { ...copy[i], a: e.target.value }; updatePersona('faq_entries', copy); }}
                          placeholder={isRTL ? 'الإجابة...' : 'Answer...'} className="text-sm min-h-[50px]" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updatePersona('faq_entries', [...persona.faq_entries, { q: '', a: '' }])}>
                      <Plus className="w-3.5 h-3.5 ml-1" /> {isRTL ? 'إضافة سؤال' : 'Add FAQ'}
                    </Button>
                  </div>

                  {/* Common Objections */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-500" /> {isRTL ? 'الاعتراضات الشائعة' : 'Common Objections'}
                    </h3>
                    {persona.common_objections.map((obj, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">{isRTL ? `اعتراض ${i + 1}` : `Objection ${i + 1}`}</span>
                          <button onClick={() => updatePersona('common_objections', persona.common_objections.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Input value={obj.q} onChange={e => { const copy = [...persona.common_objections]; copy[i] = { ...copy[i], q: e.target.value }; updatePersona('common_objections', copy); }}
                          placeholder={isRTL ? 'مثال: السعر مرتفع' : 'e.g. Price is too high'} className="text-sm" />
                        <Textarea value={obj.a} onChange={e => { const copy = [...persona.common_objections]; copy[i] = { ...copy[i], a: e.target.value }; updatePersona('common_objections', copy); }}
                          placeholder={isRTL ? 'مثال: السعر يشمل توصيل ومضمون 100%' : 'e.g. The price includes free delivery and is 100% guaranteed'}
                          className="text-sm min-h-[50px]" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updatePersona('common_objections', [...persona.common_objections, { q: '', a: '' }])}>
                      <Plus className="w-3.5 h-3.5 ml-1" /> {isRTL ? 'إضافة اعتراض' : 'Add Objection'}
                    </Button>
                  </div>

                  {/* Forbidden Topics */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500" /> {isRTL ? 'مواضيع ممنوعة' : 'Forbidden Topics'}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {persona.forbidden_topics.map((topic, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                          {topic}
                          <button onClick={() => updatePersona('forbidden_topics', persona.forbidden_topics.filter((_, j) => j !== i))} className="hover:text-red-700"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <Input placeholder={isRTL ? 'أضف موضوعاً ممنوعاً...' : 'Add forbidden topic...'} className="text-sm"
                      onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { updatePersona('forbidden_topics', [...persona.forbidden_topics, v]); (e.target as HTMLInputElement).value = ''; } } }} />
                  </div>

                  {/* Test Chat */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Send className="w-4 h-4 text-green-500" /> {isRTL ? 'تجربة المساعد' : 'Test Your AI Assistant'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isRTL ? 'جرب كيف سيرد المساعد على عملائك بعد الحفظ' : 'Test how the AI will respond to customers after saving'}
                    </p>

                    {/* Chat messages */}
                    <div className="max-h-[300px] overflow-y-auto space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                      {testChat.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-8">{isRTL ? 'أرسل رسالة لبدء التجربة' : 'Send a message to start testing'}</p>
                      )}
                      {testChat.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                            msg.role === 'user'
                              ? 'bg-purple-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-100 dark:border-slate-700/50'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {testLoading && (
                        <div className="flex justify-start">
                          <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          </div>

          {/* ── Customer AI Test Chat ── */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Send className="w-4 h-4 text-green-500" /> {isRTL ? 'تجربة الرد على العملاء' : 'Test Customer AI'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? 'أرسل رسالة كأنك زبون وشوف كيفيرد المساعد' : 'Send a message as a customer and see how the AI responds'}
            </p>
            <div className="max-h-[300px] overflow-y-auto space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
              {customerTestChat.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">{isRTL ? 'أرسل رسالة لبدء الاختبار' : 'Send a message to start testing'}</p>
              )}
              {customerTestChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-100 dark:border-slate-700/50'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {customerTestLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input value={customerTestMessage} onChange={e => setCustomerTestMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustomerTestSend(); } }}
                placeholder={isRTL ? 'اكتب رسالة زبون...' : 'Type a customer message...'} className="text-sm flex-1" />
              <Button onClick={handleCustomerTestSend} disabled={customerTestLoading || !customerTestMessage.trim()} size="sm"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                {customerTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                      <Input value={testMessage} onChange={e => setTestMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); } }}
                        placeholder={isRTL ? 'اكتب رسالة زبون...' : 'Type a customer message...'} className="text-sm flex-1" />
                      <Button onClick={handleTestSend} disabled={testLoading || !testMessage.trim()} size="sm"
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                        {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
