import { useState, useEffect, useCallback } from "react";
import { Bot, Save, Loader2, MessageSquare, Check, Users, Code2, Truck, CreditCard, MapPin, Package, Navigation, ChevronDown, HelpCircle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import CustomerBot from "../CustomerBot";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeBot, setActiveBot] = useState<'confirmation' | 'updates' | 'tracking' | null>(null);
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
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bot/settings');

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Failed to load bot settings (HTTP ${response.status})`);
      }

      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load bot settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load bot settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...settings };

      const response = await fetch('/api/bot/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.botDisabled) {
          toast({
            title: "Saved (Bot disabled)",
            description: data?.reason || 'Settings saved, but the bot remains disabled until subscription is renewed.',
            variant: "destructive"
          });
        } else {
          toast({
            title: "Success",
            description: "Bot settings saved successfully"
          });
        }
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save bot settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save bot settings",
        variant: "destructive"
      });
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

  // Reusable collapsible section header
  const SectionHeader = ({ id, icon, iconBg, title, subtitle, trailing }: {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-2.5 text-left"
    >
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{title}</span>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
      {trailing && <div onClick={(e) => e.stopPropagation()}>{trailing}</div>}
      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${expandedSections.has(id) ? 'rotate-180' : ''}`} />
    </button>
  );

  const cardCls = "bg-white dark:bg-[#0f1623] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl";

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-gray-100 p-3 sm:p-4 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex flex-col gap-3">

        {/* Header */}
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white">{t('wasselni.settings')}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('wasselni.desc')}</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('bot.saveChanges')}
            </button>
          </div>

          {/* ── Bot Toggles inside header ── */}
          <div className="grid grid-cols-3 gap-2">
            {/* Confirmation bot */}
            <div onClick={() => setActiveBot(activeBot === 'confirmation' ? null : 'confirmation')} className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all ${activeBot === 'confirmation' ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : ''} ${
              settings.enabled ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600/30'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${settings.enabled ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-200 dark:bg-slate-700'} flex items-center justify-center shrink-0`}>
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t('bot.confirmation')}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{t('bot.confirmationDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${settings.enabled ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20' : 'text-slate-500 bg-slate-200 dark:bg-slate-700'}`}>
                  {settings.enabled ? t('bot.active') : t('bot.off')}
                </span>
                <Switch dir={isRTL ? 'rtl' : 'ltr'} checked={settings.enabled} onCheckedChange={(v) => updateSetting('enabled', v)} />
              </div>
            </div>

            {/* Updates bot */}
            <div onClick={() => setActiveBot(activeBot === 'updates' ? null : 'updates')} className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all ${activeBot === 'updates' ? 'ring-2 ring-violet-400 dark:ring-violet-500' : ''} ${
              settings.updatesEnabled ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600/30'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${settings.updatesEnabled ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-slate-200 dark:bg-slate-700'} flex items-center justify-center shrink-0`}>
                  <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t('bot.updates')}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{t('bot.updatesDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${settings.updatesEnabled ? 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/20' : 'text-slate-500 bg-slate-200 dark:bg-slate-700'}`}>
                  {settings.updatesEnabled ? t('bot.active') : t('bot.off')}
                </span>
                <Switch dir={isRTL ? 'rtl' : 'ltr'} checked={Boolean(settings.updatesEnabled)} onCheckedChange={(v) => updateSetting('updatesEnabled', v)} />
              </div>
            </div>

            {/* Tracking bot */}
            <div onClick={() => setActiveBot(activeBot === 'tracking' ? null : 'tracking')} className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all ${activeBot === 'tracking' ? 'ring-2 ring-orange-400 dark:ring-orange-500' : ''} ${
              settings.trackingEnabled ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600/30'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${settings.trackingEnabled ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-slate-200 dark:bg-slate-700'} flex items-center justify-center shrink-0`}>
                  <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t('bot.tracking')}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{t('bot.trackingDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${settings.trackingEnabled ? 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-500/20' : 'text-slate-500 bg-slate-200 dark:bg-slate-700'}`}>
                  {settings.trackingEnabled ? t('bot.active') : t('bot.off')}
                </span>
                <Switch dir={isRTL ? 'rtl' : 'ltr'} checked={Boolean(settings.trackingEnabled)} onCheckedChange={(v) => updateSetting('trackingEnabled', v)} />
              </div>
            </div>
          </div>
        </div>


        {/* Tracking Bot Tab */}
        {activeBot === 'tracking' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">إعدادات بوت التتبع</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              <div className="flex flex-col gap-3">

                {/* Tracking Status Messages */}
                <div className={`${cardCls} p-4`}>
                  <SectionHeader id="tracking-templates" icon={<Navigation className="w-3.5 h-3.5 text-orange-500" />}
                    iconBg="bg-orange-50 dark:bg-orange-500/10" title={t('bot.trackingStatusMessages') || 'إشعارات التتبع التلقائية'}
                    subtitle={t('bot.trackingStatusDesc') || 'تُرسل تلقائياً عند كل تحديث من شركة التوصيل'} />
                  {expandedSections.has('tracking-templates') && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                        <div>
                          <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">إشعارات التتبع التلقائية</p>
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">أرسل رسالة للعميل عند كل تحديث من شركة التوصيل (Webhook)</p>
                        </div>
                        <Switch
                          checked={(settings as any).delivery_notifications_enabled !== false}
                          onCheckedChange={(v) => updateSetting('delivery_notifications_enabled' as any, v)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          قالب رسالة التتبع (يُرسل تلقائياً عند كل تحديث)
                        </Label>
                        <Textarea
                          value={(settings as any).delivery_status_template || '🚚 تحديث حالة طلبك\n\nمرحباً {customer_name}،\nطلبك رقم *{order_id}* - {event_label}\n\n{description}\n{location_line}\nرقم التتبع: {tracking_number}\n\nشكراً لثقتك بنا 🙏'}
                          onChange={(e) => updateSetting('delivery_status_template' as any, e.target.value)}
                          rows={7}
                          className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                          dir="rtl"
                        />
                        <p className="text-[10px] text-slate-400">المتغيرات: {'{customer_name}'} {'{order_id}'} {'{event_label}'} {'{tracking_number}'} {'{description}'} {'{location_line}'}</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
              <div className="flex flex-col gap-3">

                {/* Variables Reference */}
                <div className={`${cardCls} p-4`}>
                  <SectionHeader id="variables-tracking" icon={<Code2 className="w-3.5 h-3.5 text-indigo-500" />}
                    iconBg="bg-indigo-50 dark:bg-indigo-500/10" title={t('bot.availableVariables') || 'المتغيرات المتاحة'} />
                  {expandedSections.has('variables-tracking') && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { key: '{customer_name}', desc: 'اسم العميل' },
                        { key: '{order_id}', desc: 'رقم الطلب' },
                        { key: '{event_label}', desc: 'حالة التوصيل (عربي)' },
                        { key: '{tracking_number}', desc: 'رقم التتبع' },
                        { key: '{description}', desc: 'وصف الحدث' },
                        { key: '{location_line}', desc: 'الموقع (إن وُجد)' },
                        { key: '{event_type}', desc: 'نوع الحدث (إنجليزي)' },
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
          </div>
        )}

        {/* Two-column layout — Confirmation + Updates tabs */}
        {(activeBot === 'confirmation' || activeBot === 'updates' || activeBot === null) && (<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex flex-col gap-3">

            {/* Tracking Status Messages (legacy templates kept in Updates tab for manual sends) */}
            <div className={`${cardCls} p-4`}>
              <SectionHeader id="tracking-templates" icon={<Navigation className="w-3.5 h-3.5 text-orange-500" />}
                iconBg="bg-orange-50 dark:bg-orange-500/10" title={t('bot.trackingStatusMessages') || 'رسائل حالة التتبع'}
                subtitle="قوالب الرسائل اليدوية لتحديثات الشحن" />
              {expandedSections.has('tracking-templates') && (
                <div className="mt-3 space-y-3">
                  {[
                    { key: 'templateTrackingShipped', label: t('bot.orderShipped'), color: 'blue',
                      fallback: `📦 مرحباً {customerName}!\n\nتم شحن طلبك #{orderId}.\n🚚 شركة التوصيل: {deliveryCompany}\n📍 رقم التتبع: {trackingNumber}\n\nيمكنك تتبع طلبك من هنا: {trackingUrl}` },
                    { key: 'templateTrackingOutForDelivery', label: t('bot.outForDelivery'), color: 'amber',
                      fallback: `🚛 {customerName}، طلبك في الطريق!\n\nطلبك #{orderId} خرج للتوصيل.\n📍 الوصول المتوقع: {estimatedTime}\n📞 السائق سيتصل بك قريباً.` },
                    { key: 'templateTrackingDelivered', label: t('bot.delivered'), color: 'green',
                      fallback: `✅ تم التوصيل بنجاح!\n\nمرحباً {customerName}،\nتم توصيل طلبك #{orderId} بنجاح.\n\n🙏 شكراً لتسوقك معنا!` },
                    { key: 'templateTrackingFailed', label: t('bot.deliveryFailed'), color: 'red',
                      fallback: `⚠️ فشل التوصيل\n\nمرحباً {customerName}،\nلم نتمكن من توصيل طلبك #{orderId}.\n\nالسبب: {failureReason}\n📞 تواصل معنا: {supportPhone}` },
                  ].map(tmpl => (
                    <div key={tmpl.key} className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full bg-${tmpl.color}-500`} />
                        {tmpl.label}
                      </Label>
                      <Textarea value={(settings as any)[tmpl.key] || tmpl.fallback}
                        onChange={(e) => updateSetting(tmpl.key as any, e.target.value)} rows={3}
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{t('bot.defaultDeliveryCompany')}</Label>
                      <Input value={(settings as any).defaultDeliveryCompany || ''}
                        onChange={(e) => updateSetting('defaultDeliveryCompany' as any, e.target.value)} placeholder="Yalidine, ZR Express..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{t('bot.trackingUrlTemplate')}</Label>
                      <Input value={(settings as any).trackingUrlTemplate || ''}
                        onChange={(e) => updateSetting('trackingUrlTemplate' as any, e.target.value)} placeholder="https://track.example.com/{trackingNumber}" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Variables Reference */}
            <div className={`${cardCls} p-4`}>
              <SectionHeader id="variables" icon={<Code2 className="w-3.5 h-3.5 text-indigo-500" />}
                iconBg="bg-indigo-50 dark:bg-indigo-500/10" title={t('bot.availableVariables')} />
              {expandedSections.has('variables') && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[...variables,
                    { key: '{deliveryCompany}', desc: t('bot.deliveryCompany') },
                    { key: '{trackingUrl}', desc: t('bot.trackingUrl') },
                    { key: '{estimatedTime}', desc: t('bot.estimatedTime') },
                    { key: '{failureReason}', desc: t('bot.failureReason') },
                  ].map((v) => (
                    <div key={v.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/[0.06]">
                      <code className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0">
                        {v.key}
                      </code>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] truncate">{v.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="flex flex-col gap-3">

            {/* Confirmation Templates */}
            <div className={`${cardCls} p-4`}>
              <SectionHeader id="confirmation-templates" icon={<Check className="w-3.5 h-3.5 text-emerald-500" />}
                iconBg="bg-emerald-50 dark:bg-emerald-500/10" title={t('bot.confirmation') + ' ' + (t('bot.templates') || 'Templates')} />
              {expandedSections.has('confirmation-templates') && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-blue-500" /> {t('bot.greetingMessage')}
                    </Label>
                    <p className="text-[10px] text-slate-500">{t('bot.greetingDesc')}</p>
                    <Textarea value={settings.templateGreeting || ''} onChange={(e) => updateSetting('templateGreeting', e.target.value)}
                      rows={3} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-emerald-500" /> {t('bot.instantOrder')}
                    </Label>
                    <p className="text-[10px] text-slate-500">{t('bot.instantOrderDesc')}</p>
                    <Textarea value={settings.templateInstantOrder || ''} onChange={(e) => updateSetting('templateInstantOrder', e.target.value)}
                      rows={8} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-amber-500" /> {t('bot.pinInstructions')}
                    </Label>
                    <p className="text-[10px] text-slate-500">{t('bot.pinInstructionsDesc')}</p>
                    <Textarea value={settings.templatePinInstructions || ''} onChange={(e) => updateSetting('templatePinInstructions', e.target.value)}
                      rows={4} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-green-500" /> {t('bot.orderConfirmation')}
                    </Label>
                    <p className="text-[10px] text-slate-500">{t('bot.orderConfirmationDesc')}</p>
                    <Textarea value={settings.templateOrderConfirmation} onChange={(e) => updateSetting('templateOrderConfirmation', e.target.value)}
                      rows={4} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3 text-purple-500" /> {t('bot.paymentConfirmation')}
                    </Label>
                    <Textarea value={settings.templatePayment} onChange={(e) => updateSetting('templatePayment', e.target.value)}
                      rows={3} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-orange-500" /> {t('bot.shippingNotification')}
                    </Label>
                    <Textarea value={settings.templateShipping} onChange={(e) => updateSetting('templateShipping', e.target.value)}
                      rows={3} className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* Customer Bot / Campaigns */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-4">
                <SectionHeader id="campaigns" icon={<Users className="w-3.5 h-3.5 text-violet-500" />}
                  iconBg="bg-violet-50 dark:bg-violet-500/10" title={t('bot.updates') || 'Customer Campaigns'} />
              </div>
              {expandedSections.has('campaigns') && (
                <CustomerBot embedded={true} />
              )}
            </div>
          </div>
        </div>)}

        {/* ── Help & FAQ Section ── */}
        <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">{isRTL ? 'كيف تعمل البوتات؟' : 'How do bots work?'}</h3>
          </div>
          
          <div className="space-y-2">
            <details className="group">
              <summary className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{isRTL ? 'ما هو البوت التجاري؟' : 'What is the Order Confirmation Bot?'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRTL 
                  ? 'يرسل البوت رسائل تأكيد الطلب تلقائياً عندما يقوم العميل بإنشاء طلب جديد. يمكنك تخصيص الرسالة لتتضمن اسم العميل، تفاصيل المنتج، السعر، والعنوان.'
                  : 'The bot automatically sends order confirmation messages when a customer creates a new order. You can customize the message to include the customer name, product details, price, and address.'}
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{isRTL ? 'ما هو بوت تحديثات الطلب؟' : 'What is the Order Updates Bot?'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRTL 
                  ? 'يرسل البوت إشعارات للعملاء عند تغيير حالة الطلب - مثل تأكيد الدفع، الشحن، أو التسليم. يساعد هذا العملاء على متابعة طلباتهم في الوقت الفعلي.'
                  : 'The bot sends notifications to customers when order status changes - like payment confirmation, shipping, or delivery. This helps customers track their orders in real-time.'}
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{isRTL ? 'ما هو بوت تتبع الشحن؟' : 'What is the Tracking Bot?'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRTL 
                  ? 'يقدم البوت معلومات تتبع الشحن للعملاء. عند إضافة رقم تتبع للطلب، يستطيع العملاء الاستعلام عن موقع شحنتهم في أي وقت.'
                  : 'The bot provides shipping tracking information to customers. When you add a tracking number to an order, customers can inquire about their shipment location at any time.'}
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{isRTL ? 'ما هي المتغيرات المتاحة في القوالب؟' : 'What variables are available in templates?'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRTL ? (
                  <>
                    يمكنك استخدام هذه المتغيرات في قوالب الرسائل:
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{customerName}'}</code> - اسم العميل</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{orderId}'}</code> - رقم الطلب</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{productName}'}</code> - اسم المنتج</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{totalPrice}'}</code> - السعر الإجمالي</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{address}'}</code> - عنوان التوصيل</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{trackingNumber}'}</code> - رقم التتبع</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{companyName}'}</code> - اسم المتجر</li>
                    </ul>
                  </>
                ) : (
                  <>
                    You can use these variables in your message templates:
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{customerName}'}</code> - Customer name</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{orderId}'}</code> - Order ID</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{productName}'}</code> - Product name</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{totalPrice}'}</code> - Total price</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{address}'}</code> - Delivery address</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{trackingNumber}'}</code> - Tracking number</li>
                      <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{companyName}'}</code> - Store name</li>
                    </ul>
                  </>
                )}
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{isRTL ? 'كيف يمكنني تخصيص الرسائل؟' : 'How can I customize messages?'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRTL 
                  ? 'اكتب رسالتك بالشكل الذي تريده في مربع النص. استخدم المتغيرات بين الأقواس المتموجة للبيانات الديناميكية. يمكنك استخدام الرموز التعبيرية (Emojis) لجعل الرسائل أكثر جاذبية وودية.'
                  : 'Write your message as you want it in the text box. Use variables between curly braces for dynamic data. You can use emojis to make messages more engaging and friendly.'}
              </div>
            </details>
          </div>
        </div>

        {/* Floating Save */}
        <div className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'}`}>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg transition-all disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{t('bot.saving')}</> : <><Save className="h-4 w-4" />{t('bot.saveChanges')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
