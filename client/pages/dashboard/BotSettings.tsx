import { useState, useEffect, useCallback } from "react";
import { Bot, Save, Loader2, MessageSquare, Check, Users, Code2, Truck, CreditCard, MapPin, Package, Navigation, ChevronDown, HelpCircle, Zap, Send, Settings, Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import CustomerBot from './CustomerBot';
import { useStore } from '@/contexts/StoreContext';

interface BotSettings {
  enabled: boolean;
  updatesEnabled?: boolean;
  trackingEnabled?: boolean;
  templateOrderConfirmation: string;
  templatePayment: string;
  templateShipping: string;
  [key: string]: any;
}

export default function AdminBotSettings() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const { activeStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'confirmation' | 'updates' | 'tracking' | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['provider']));

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const [settings, setSettings] = useState<BotSettings>({
    enabled: true,
    updatesEnabled: false,
    trackingEnabled: false,
    templateOrderConfirmation: `مرحباً {customerName}! 🌟\n\nشكراً لطلبك من {companyName}!\n\n📦 تفاصيل الطلب:\n• المنتج: {productName}\n• السعر: {totalPrice} دج\n• العنوان: {address}\n\nهل تؤكد الطلب؟ اضغط ✅ للتأكيد أو ❌ للإلغاء.`,
    templatePayment: `تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.`,
    templateShipping: `تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.`
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    loadSettings(signal);
    return () => controller.abort();
  }, [activeStore?.id]);

  const loadSettings = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/bot/settings', { signal });
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Failed to load bot settings (HTTP ${response.status})`);
      }
      const data = await response.json();
      setSettings(data);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to load bot settings:', error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load bot settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/bot/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.botDisabled) {
          toast({ title: "Saved (Bot disabled)", description: data?.reason || 'Settings saved, but the bot remains disabled until subscription is renewed.', variant: "destructive" });
        } else {
          toast({ title: "Success", description: "Bot settings saved successfully" });
        }
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || 'Failed to save settings');
      }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{t('bot.loadingSettings')}</p>
        </div>
      </div>
    );
  }

  const variables = [
    { key: '{customerName}', desc: t('bot.customerName') },
    { key: '{orderId}', desc: t('bot.orderId') },
    { key: '{productName}', desc: t('bot.productName') },
    { key: '{totalPrice}', desc: t('bot.totalPrice') },
    { key: '{address}', desc: t('bot.deliveryAddress') },
    { key: '{companyName}', desc: t('bot.companyName') },
    { key: '{supportPhone}', desc: t('bot.supportPhone') },
    { key: '{storeUrl}', desc: t('bot.storeUrl') },
    { key: '{trackingNumber}', desc: t('bot.trackingNumber') },
    { key: '{quantity}', desc: t('bot.quantity') },
    { key: '{storeName}', desc: t('bot.storeName') },
    { key: '{customerPhone}', desc: t('bot.customerPhone') },
  ];

  const SectionHeader = ({ id, icon, iconBg, title, subtitle, trailing }: {
    id: string; icon: React.ReactNode; iconBg: string; title: string; subtitle?: string; trailing?: React.ReactNode;
  }) => (
    <button type="button" onClick={() => toggleSection(id)} className="w-full flex items-center gap-2.5 text-left">
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{title}</span>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
      {trailing && <div onClick={(e) => e.stopPropagation()}>{trailing}</div>}
      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${expandedSections.has(id) ? 'rotate-180' : ''}`} />
    </button>
  );

  const cardCls = "bg-white dark:bg-[#0f1623] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl";

  // Feature cards config
  const features = [
    {
      id: 'confirmation' as const,
      title: isRTL ? 'تأكيد الطلبات' : 'Order Confirmation',
      desc: isRTL ? 'يرسل رسالة ترحيب وتأكيد تلقائي للعميل عند إنشاء طلب جديد' : 'Sends welcome & confirmation message when customer places an order',
      icon: MessageSquare,
      color: 'emerald',
      enabled: settings.enabled,
      toggle: (v: boolean) => updateSetting('enabled', v),
    },
    {
      id: 'updates' as const,
      title: isRTL ? 'حملات التسويق' : 'Marketing Campaigns',
      desc: isRTL ? 'أرسل عروض الخصم والمنتجات الجديدة لعملائك عبر رسائل تلقائية' : 'Send discounts & new products to customers via automated messages',
      icon: Send,
      color: 'violet',
      enabled: Boolean(settings.updatesEnabled),
      toggle: (v: boolean) => updateSetting('updatesEnabled', v),
    },
    {
      id: 'tracking' as const,
      title: isRTL ? 'تتبع الشحنات' : 'Shipping Tracking',
      desc: isRTL ? 'أرسل إشعارات تلقائية للعملاء عند تحديث حالة الشحن (شحن، توصيل، فشل)' : 'Auto-notify customers on shipping status changes (shipped, delivered, failed)',
      icon: Truck,
      color: 'orange',
      enabled: Boolean(settings.trackingEnabled),
      toggle: (v: boolean) => updateSetting('trackingEnabled', v),
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string; badge: string; badgeText: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400 dark:ring-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', badgeOff: 'bg-slate-200 dark:bg-slate-700 text-slate-500' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-400 dark:ring-violet-500', badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300', badgeOff: 'bg-slate-200 dark:bg-slate-700 text-slate-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-400 dark:ring-orange-500', badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300', badgeOff: 'bg-slate-200 dark:bg-slate-700 text-slate-500' },
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-gray-100 p-3 sm:p-4 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">

        {/* ── Hero Header ── */}
        <div className={`${cardCls} p-5 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5 dark:from-blue-500/10 dark:to-violet-500/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">{isRTL ? 'المساعد الذكي' : 'Smart Assistant'}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-md leading-relaxed">
                  {isRTL
                    ? 'يتعامل مع عملائك تلقائياً — يؤكد الطلبات، يُرسل تحديثات الشحن، ويرسل حملات تسويقية لزيادة المبيعات.'
                    : 'Handles your customers automatically — confirms orders, sends shipping updates, and runs marketing campaigns to boost sales.'}
                </p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="h-10 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('bot.saveChanges')}
            </button>
          </div>
        </div>

        {/* ── Feature Cards (3-column toggle grid) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {features.map(f => {
            const c = colorMap[f.color];
            const Icon = f.icon;
            const isActive = activeSection === f.id;
            return (
              <div key={f.id}
                onClick={() => setActiveSection(isActive ? null : f.id)}
                className={`${cardCls} p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${isActive ? `ring-2 ${c.ring}` : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{f.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.enabled ? c.badge : c.badgeOff}`}>
                      {f.enabled ? (isRTL ? 'مفعّل' : 'ON') : (isRTL ? 'معطّل' : 'OFF')}
                    </span>
                    <Switch dir={isRTL ? 'rtl' : 'ltr'} checked={f.enabled} onCheckedChange={f.toggle} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Confirmation Bot Settings ── */}
        {(activeSection === 'confirmation' || activeSection === null) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {/* Left: Templates */}
            <div className="flex flex-col gap-3">
              <div className={`${cardCls} p-4`}>
                <SectionHeader id="confirmation-templates" icon={<MessageSquare className="w-3.5 h-3.5 text-emerald-500" />}
                  iconBg="bg-emerald-50 dark:bg-emerald-500/10" title={isRTL ? 'قوالب رسائل الطلب' : 'Order Message Templates'}
                  subtitle={isRTL ? 'تُرسل تلقائياً عند كل طلب جديد' : 'Sent automatically on each new order'} />
                {expandedSections.has('confirmation-templates') && (
                  <div className="mt-3 space-y-4">
                    {[
                      { key: 'templateInstantOrder', label: isRTL ? 'رسالة فورية (أول رسالة)' : 'Instant Message (first reply)', icon: Zap, color: 'emerald',
                        fallback: `✅ تم استلام طلبك!\n\nطلب #{orderId}\nالمنتج: {productName}\nالمجموع: {totalPrice} دج\nالاسم: {customerName}\nالهاتف: {customerPhone}`,
                        vars: ['{orderId}','{productName}','{totalPrice}','{customerName}','{customerPhone}','{address}','{quantity}','{storeName}'] },
                      { key: 'templatePinInstructions', label: isRTL ? 'تثبيت المحادثة' : 'Pin Conversation', icon: Package, color: 'amber',
                        fallback: '📌 قم بتثبيت هذه المحادثة لتتبع طلبك بسهولة.',
                        vars: [] },
                      { key: 'templateOrderConfirmation', label: isRTL ? 'تأكيد الطلب' : 'Order Confirmation', icon: Check, color: 'blue',
                        fallback: `مرحباً {customerName}! 🌟\n\nشكراً لطلبك!\n\n📦 المنتج: {productName}\n💰 السعر: {totalPrice} دج\n📍 العنوان: {address}\n\nهل تؤكد الطلب؟`,
                        vars: ['{orderId}','{productName}','{totalPrice}','{customerName}','{address}','{companyName}'] },
                      { key: 'templatePayment', label: isRTL ? 'تأكيد الدفع' : 'Payment Confirmation', icon: CreditCard, color: 'purple',
                        fallback: 'تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.',
                        vars: ['{orderId}','{totalPrice}','{customerName}'] },
                      { key: 'templateShipping', label: isRTL ? 'إشعار الشحن' : 'Shipping Notification', icon: Truck, color: 'orange',
                        fallback: 'تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.',
                        vars: ['{orderId}','{trackingNumber}','{customerName}','{status}'] },
                    ].map(tmpl => (
                      <div key={tmpl.key} className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-2">
                          <tmpl.icon className={`w-3.5 h-3.5 text-${tmpl.color}-500`} /> {tmpl.label}
                        </Label>
                        <Textarea value={(settings as any)[tmpl.key] || tmpl.fallback}
                          onChange={(e) => updateSetting(tmpl.key, e.target.value)} rows={4}
                          className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono" dir="rtl" />
                        {tmpl.vars.length > 0 && (
                          <p className="text-[10px] text-slate-400">{isRTL ? 'المتغيرات:' : 'Variables:'} {tmpl.vars.join(' ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Variables + Info */}
            <div className="flex flex-col gap-3">
              <div className={`${cardCls} p-4`}>
                <SectionHeader id="variables" icon={<Code2 className="w-3.5 h-3.5 text-indigo-500" />}
                  iconBg="bg-indigo-50 dark:bg-indigo-500/10" title={isRTL ? 'المتغيرات المتاحة' : 'Available Variables'} />
                {expandedSections.has('variables') && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {variables.map((v) => (
                      <div key={v.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/[0.06]">
                        <code className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0">{v.key}</code>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] truncate">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick info card */}
              <div className={`${cardCls} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <Wand2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{isRTL ? 'كيف يعمل؟' : 'How it works?'}</span>
                </div>
                <div className="space-y-2">
                  {[
                    { step: '1', text: isRTL ? 'العميل يُنشئ طلب جديد في المتجر' : 'Customer places a new order in your store' },
                    { step: '2', text: isRTL ? 'البوت يُرسل رسالة ترحيب فورية بالعربي' : 'Bot sends an instant welcome message in Arabic' },
                    { step: '3', text: isRTL ? 'العميل يُثبت المحادثة لسهولة التتبع' : 'Customer pins the conversation for easy tracking' },
                    { step: '4', text: isRTL ? 'بعد الدفع يُرسل تأكيد الطلب والشحن' : 'After payment, sends order & shipping confirmation' },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{s.step}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tracking Bot Settings ── */}
        {activeSection === 'tracking' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-3">
              <div className={`${cardCls} p-4`}>
                <SectionHeader id="tracking-templates" icon={<Navigation className="w-3.5 h-3.5 text-orange-500" />}
                  iconBg="bg-orange-50 dark:bg-orange-500/10" title={isRTL ? 'إشعارات التتبع التلقائية' : 'Auto Tracking Notifications'}
                  subtitle={isRTL ? 'تُرسل تلقائياً عند كل تحديث من شركة التوصيل' : 'Sent automatically on each delivery update'} />
                {expandedSections.has('tracking-templates') && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                      <div>
                        <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{isRTL ? 'إشعارات التتبع التلقائية' : 'Auto Tracking Notifications'}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">{isRTL ? 'أرسل رسالة للعميل عند كل تحديث من شركة التوصيل (Webhook)' : 'Send message to customer on each delivery update (Webhook)'}</p>
                      </div>
                      <Switch checked={(settings as any).delivery_notifications_enabled !== false}
                        onCheckedChange={(v) => updateSetting('delivery_notifications_enabled' as any, v)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        {isRTL ? 'قالب رسالة التتبع' : 'Tracking Message Template'}
                      </Label>
                      <Textarea
                        value={(settings as any).delivery_status_template || '🚚 تحديث حالة طلبك\n\nمرحباً {customer_name}،\nطلبك رقم *{order_id}* - {event_label}\n\n{description}\n{location_line}\nرقم التتبع: {tracking_number}\n\nشكراً لثقتك بنا 🙏'}
                        onChange={(e) => updateSetting('delivery_status_template' as any, e.target.value)} rows={7}
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono" dir="rtl" />
                      <p className="text-[10px] text-slate-400">{isRTL ? 'المتغيرات:' : 'Variables:'} {'{customer_name}'} {'{order_id}'} {'{event_label}'} {'{tracking_number}'} {'{description}'} {'{location_line}'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className={`${cardCls} p-4`}>
                <SectionHeader id="variables-tracking" icon={<Code2 className="w-3.5 h-3.5 text-indigo-500" />}
                  iconBg="bg-indigo-50 dark:bg-indigo-500/10" title={isRTL ? 'المتغيرات المتاحة' : 'Available Variables'} />
                {expandedSections.has('variables-tracking') && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { key: '{customer_name}', desc: isRTL ? 'اسم العميل' : 'Customer name' },
                      { key: '{order_id}', desc: isRTL ? 'رقم الطلب' : 'Order ID' },
                      { key: '{event_label}', desc: isRTL ? 'حالة التوصيل' : 'Delivery status' },
                      { key: '{tracking_number}', desc: isRTL ? 'رقم التتبع' : 'Tracking number' },
                      { key: '{description}', desc: isRTL ? 'وصف الحدث' : 'Event description' },
                      { key: '{location_line}', desc: isRTL ? 'الموقع' : 'Location' },
                    ].map((v) => (
                      <div key={v.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/[0.06]">
                        <code className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0">{v.key}</code>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] truncate">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Marketing Campaigns ── */}
        {activeSection === 'updates' && (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4">
              <SectionHeader id="campaigns" icon={<Users className="w-3.5 h-3.5 text-violet-500" />}
                iconBg="bg-violet-50 dark:bg-violet-500/10" title={isRTL ? 'حملات التسويق' : 'Marketing Campaigns'} />
            </div>
            {expandedSections.has('campaigns') && <CustomerBot embedded={true} />}
          </div>
        )}

        {/* ── Help & FAQ ── */}
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <HelpCircle className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isRTL ? 'الأسئلة الشائعة' : 'FAQ'}</h3>
          </div>
          <div className="space-y-2">
            {[
              { q: isRTL ? 'هل البوت يرد باللغة العربية؟' : 'Does the bot reply in Arabic?', a: isRTL ? 'نعم، جميع الرسائل افتراضياً بالعربي. يمكنك تخصيص أي رسالة باللغة التي تريدها.' : 'Yes, all messages are in Arabic by default. You can customize any message in the language you want.' },
              { q: isRTL ? 'هل يمكنني تعطيل بوت معين؟' : 'Can I disable a specific bot?', a: isRTL ? 'نعم، كل بوت له مفتاح تفعيل مستقل. يمكنك تشغيل تأكيد الطلبات وتعطيل الحملات مثلاً.' : 'Yes, each bot has its own toggle. You can enable order confirmation and disable campaigns for example.' },
              { q: isRTL ? 'ماذا يحدث إذا لم يُؤكد العميل الطلب؟' : 'What happens if the customer does not confirm?', a: isRTL ? 'البوت يُرسل تذكيراً تلقائياً بعد فترة. يمكنك تعديل وقت التذكير من إعدادات الحملات.' : 'The bot sends an automatic reminder after a period. You can adjust reminder timing from campaign settings.' },
              { q: isRTL ? 'كيف أضيف رقم واتساب أو تيليجرام؟' : 'How to connect WhatsApp or Telegram?', a: isRTL ? 'اذهب إلى إعدادات البوت وفعّل المنصة التي تريدها. اتبع خطوات التوصيل لكل منصة.' : 'Go to bot settings and enable the platform you want. Follow the connection steps for each platform.' },
            ].map((item, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">{item.q}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <div className="p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Floating Save */}
        <div className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'}`}>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</> : <><Save className="h-4 w-4" />{t('bot.saveChanges')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
