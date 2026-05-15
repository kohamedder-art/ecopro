import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Bot, MessageCircle, Smartphone, Globe, Camera, Shield, Pen, FileText, Send, BarChart3, RefreshCw, Plus, Trash2, Pencil, Palette, Brain, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<'auto-reply' | 'permissions' | 'product' | 'advanced'>('auto-reply');

  useEffect(() => {
    Promise.all([
      fetch('/api/ai-settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/ai/quota-summary', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([data, quotaData]) => {
      if (data && !data.error) setSettings({ ...DEFAULT, ...data });
      if (quotaData) setQuota(quotaData);
    }).finally(() => setLoading(false));
  }, []);

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

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <TabButton id="auto-reply" label={isRTL ? 'الرد التلقائي' : 'Auto-Reply'} icon={<MessageCircle className="w-4 h-4" />} />
        <TabButton id="permissions" label={isRTL ? 'الصلاحيات' : 'Permissions'} icon={<Shield className="w-4 h-4" />} />
        <TabButton id="product" label={isRTL ? 'المنتجات' : 'Products'} icon={<FileText className="w-4 h-4" />} />
        <TabButton id="advanced" label={isRTL ? 'خيارات متقدمة' : 'Advanced'} icon={<Sparkles className="w-4 h-4" />} />
      </div>

      {/* ── AUTO-REPLY TAB ── */}
      {activeTab === 'auto-reply' && (
        <div className="space-y-4">
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
      )}

      {/* ── PERMISSIONS TAB ── */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? 'الصلاحيات التي يملكها الذكاء الاصطناعي لتنفيذ الإجراءات في متجرك' : 'Permissions the AI has to execute actions in your store'}
          </p>
          <div className="grid gap-3">
            <ToggleRow checked={settings.action_order_status} onChange={() => toggle('action_order_status')} label={isRTL ? 'تعديل حالة الطلبات' : 'Change Order Status'} desc={isRTL ? 'تحديث حالة الطلب (مؤكد، ملغي، تم التوصيل...)' : 'Update order status (confirmed, cancelled, delivered...)'} icon={<RefreshCw className="w-4 h-4 text-rose-500" />} />
            <ToggleRow checked={settings.action_create_product} onChange={() => toggle('action_create_product')} label={isRTL ? 'إضافة منتجات جديدة' : 'Create Products'} desc={isRTL ? 'إضافة منتجات جديدة للمتجر' : 'Add new products to your store'} icon={<Plus className="w-4 h-4 text-emerald-500" />} />
            <ToggleRow checked={settings.action_edit_product} onChange={() => toggle('action_edit_product')} label={isRTL ? 'تعديل المنتجات' : 'Edit Products'} desc={isRTL ? 'تعديل الأسعار، المخزون، الوصف والعناوين' : 'Edit prices, stock, descriptions, and titles'} icon={<Pencil className="w-4 h-4 text-blue-500" />} />
            <ToggleRow checked={settings.action_delete_product} onChange={() => toggle('action_delete_product')} label={isRTL ? 'حذف المنتجات' : 'Delete Products'} desc={isRTL ? 'إلغاء تفعيل المنتجات من المتجر' : 'Deactivate products from your store'} icon={<Trash2 className="w-4 h-4 text-red-500" />} />
            <ToggleRow checked={settings.action_store_design} onChange={() => toggle('action_store_design')} label={isRTL ? 'تعديل التصميم' : 'Edit Store Design'} desc={isRTL ? 'تغيير الألوان، الخطوط، والنصوص في المتجر' : 'Change colors, fonts, and store text'} icon={<Palette className="w-4 h-4 text-purple-500" />} />
            <ToggleRow checked={settings.action_bot_control} onChange={() => toggle('action_bot_control')} label={isRTL ? 'التحكم في البوت' : 'Control Bot'} desc={isRTL ? 'تشغيل وإيقاف البوت عبر الأوامر الصوتية' : 'Enable/disable the bot via voice commands'} icon={<Bot className="w-4 h-4 text-amber-500" />} />
          </div>
        </div>
      )}

      {/* ── PRODUCT TAB ── */}
      {activeTab === 'product' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? 'أتمتة كتابة محتوى المنتجات باستخدام الذكاء الاصطناعي' : 'Automate product content writing with AI'}
          </p>
          <ToggleRow checked={settings.auto_descriptions} onChange={() => toggle('auto_descriptions')} label={isRTL ? 'وصف المنتجات تلقائياً' : 'Auto-Generate Descriptions'} desc={isRTL ? 'الذكاء الاصطناعي يكتب وصفاً لكل منتج جديد تضيفه' : 'AI writes a description for every new product you add'} icon={<FileText className="w-4 h-4 text-indigo-500" />} />
          <ToggleRow checked={settings.auto_alt_text} onChange={() => toggle('auto_alt_text')} label={isRTL ? 'وصف الصور تلقائياً' : 'Auto-Generate Image Alt Text'} desc={isRTL ? 'نصوص بديلة للصور لتحسين ظهور متجرك في محركات البحث' : 'Alt text for images to improve your store\'s SEO'} icon={<Camera className="w-4 h-4 text-sky-500" />} />
        </div>
      )}

      {/* ── ADVANCED TAB ── */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
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

          {/* Monthly Usage */}
          {quota && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-500/5 to-slate-600/5 border border-slate-200/50 dark:border-slate-700/50">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
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
      )}
    </div>
  );
}
