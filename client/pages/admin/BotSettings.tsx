import { useState, useEffect } from "react";
import { Bot, Save, Loader2, Phone, MessageSquare, Globe, Check, Users, Code2, Truck, CreditCard, MapPin, Package, Navigation } from "lucide-react";
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
  provider: 'whatsapp_cloud' | 'telegram' | 'viber' | 'facebook' | 'messenger' | string;
  whatsappPhoneId: string;
  whatsappToken: string;
  whatsappTokenConfigured?: boolean;
  telegramBotToken?: string;
  telegramTokenConfigured?: boolean;
  telegramBotUsername?: string;
  telegramDelayMinutes?: number;
  autoExpireHours?: number;
  viberAuthToken?: string;
  viberSenderName?: string;
  facebookPageId?: string;
  facebookAccessToken?: string;
  // Facebook Messenger fields
  messengerEnabled?: boolean;
  fbPageId?: string;
  fbPageAccessToken?: string;
  fbPageAccessTokenConfigured?: boolean;
  messengerDelayMinutes?: number;
  platformMessengerAvailable?: boolean;
  platformMessengerPageId?: string;
  platformTelegramAvailable?: boolean;
  usePlatformMessenger?: boolean;
  messengerUsingPlatform?: boolean;
  usePlatformTelegram?: boolean;
  telegramUsingPlatform?: boolean;
  templateGreeting?: string;
  templateInstantOrder?: string;
  templatePinInstructions?: string;
  templateOrderConfirmation: string;
  templatePayment: string;
  templateShipping: string;
}

export default function AdminBotSettings() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingUpMessenger, setSettingUpMessenger] = useState(false);
  const [showMessengerAdvanced, setShowMessengerAdvanced] = useState(false);
  const [showTelegramAdvanced, setShowTelegramAdvanced] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string>('');
  const [activeBot, setActiveBot] = useState<'confirmation' | 'updates' | 'tracking' | null>(null);
  const [settings, setSettings] = useState<BotSettings>({
    enabled: true,
    updatesEnabled: false,
    trackingEnabled: false,
    provider: 'telegram',
    whatsappPhoneId: '',
    whatsappToken: '',
    whatsappTokenConfigured: false,
    telegramBotToken: '',
    telegramTokenConfigured: false,
    telegramBotUsername: '',
    telegramDelayMinutes: 5,
    autoExpireHours: 24,
    viberAuthToken: '',
    viberSenderName: '',
    facebookPageId: '',
    facebookAccessToken: '',
    messengerEnabled: false,
    fbPageId: '',
    fbPageAccessToken: '',
    fbPageAccessTokenConfigured: false,
    messengerDelayMinutes: 5,
    platformMessengerAvailable: false,
    platformMessengerPageId: '',
    platformTelegramAvailable: false,
    usePlatformMessenger: false,
    messengerUsingPlatform: false,
    usePlatformTelegram: false,
    telegramUsingPlatform: false,
    templateGreeting: `شكراً لطلبك من {storeName}، {customerName}! 🎉\n\n✅ فعّل الإشعارات لتلقي تأكيد الطلب وتحديثات التتبع.`,
    templateInstantOrder: `🎉 شكراً لك {customerName}!\n\nتم استلام طلبك بنجاح ✅\n\n━━━━━━━━━━━━━━━━\n📦 تفاصيل الطلب\n━━━━━━━━━━━━━━━━\n🔢 رقم الطلب: #{orderId}\n📱 المنتج: {productName}\n💰 السعر: {totalPrice} دج\n📍 الكمية: {quantity}\n\n━━━━━━━━━━━━━━━━\n👤 معلومات التوصيل\n━━━━━━━━━━━━━━━━\n📛 الاسم: {customerName}\n📞 الهاتف: {customerPhone}\n🏠 العنوان: {address}\n\n━━━━━━━━━━━━━━━━\n🚚 حالة الطلب: قيد المعالجة\n━━━━━━━━━━━━━━━━\n\nسنتصل بك قريباً للتأكيد 📞\n\n⭐ من {storeName}`,
    templatePinInstructions: `📌 نصيحة مهمة:\n\nاضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!\n\n🔔 تأكد من:\n• تفعيل الإشعارات\n• عدم كتم المحادثة\n• ستتلقى تحديثات حالة الطلب هنا مباشرة`,
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

      // Default to platform mode when available (no Page/token fields shown).
      if (data?.platformMessengerAvailable) {
        setShowMessengerAdvanced(!(data?.usePlatformMessenger ?? data?.messengerUsingPlatform ?? true));
      }

      if (data?.platformTelegramAvailable) {
        setShowTelegramAdvanced(!(data?.usePlatformTelegram ?? data?.telegramUsingPlatform ?? true));
      }

      // Also load store settings so we can call Messenger setup endpoints without asking for slug.
      try {
        const storeRes = await fetch('/api/client/store/settings');
        if (storeRes.ok) {
          const storeData = await storeRes.json();
          setStoreSlug(String(storeData?.store_slug || ''));
        }
      } catch {
        // ignore
      }
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

      // Derive platform-mode flags from UI state (never trust hidden fields).
      payload.usePlatformMessenger = Boolean(settings.platformMessengerAvailable) && !showMessengerAdvanced;
      payload.usePlatformTelegram = Boolean(settings.platformTelegramAvailable) && !showTelegramAdvanced;

      // Never send empty secrets; server preserves existing secrets unless replaced.
      const maybeDeleteEmpty = (key: string) => {
        const v = payload[key];
        if (typeof v !== 'string' || !v.trim()) {
          delete payload[key];
        }
      };
      maybeDeleteEmpty('whatsappToken');
      maybeDeleteEmpty('telegramBotToken');
      maybeDeleteEmpty('telegramBotUsername');
      maybeDeleteEmpty('fbPageAccessToken');
      maybeDeleteEmpty('facebookAccessToken');
      maybeDeleteEmpty('fbPageId');
      maybeDeleteEmpty('facebookPageId');

      // In platform mode, do not send any page/token/username; server will apply env-based config.
      if (payload.usePlatformMessenger) {
        delete payload.fbPageId;
        delete payload.fbPageAccessToken;
        delete payload.facebookPageId;
        delete payload.facebookAccessToken;
      }
      if (payload.usePlatformTelegram) {
        delete payload.telegramBotToken;
        delete payload.telegramBotUsername;
      }

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

  const updateSetting = (key: keyof BotSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };



  const handleSetupMessengerGetStarted = async () => {
    // Requires store slug + saved page token
    const slug = String(storeSlug || '').trim();
    if (!slug) {
      toast({
        title: 'Error',
        description: 'Store slug not available yet. Please refresh this page.',
        variant: 'destructive',
      });
      return;
    }

    setSettingUpMessenger(true);
    try {
      const res = await fetch(`/api/messenger/setup-get-started/${encodeURIComponent(slug)}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to setup Get Started');
      }
      toast({
        title: 'Success',
        description: 'Messenger Get Started button configured.',
      });
    } catch (error) {
      console.error('Failed to setup Messenger Get Started:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to setup Messenger Get Started',
        variant: 'destructive',
      });
    } finally {
      setSettingUpMessenger(false);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-black dark:via-slate-900 dark:to-black p-3 sm:p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h1 className="text-2xl md:text-xl md:text-2xl lg:text-lg md:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                {t('wasselni.settings')}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                {t('wasselni.desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Three Bot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Bot Confirmation Card */}
          <div 
            className={`relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all duration-300 ${
              activeBot === 'confirmation' 
                ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/25 scale-[1.02]' 
                : settings.enabled
                  ? 'bg-gradient-to-br from-emerald-500/90 to-green-600/90 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.01]'
                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-lg hover:shadow-xl border border-slate-300 dark:border-slate-700'
            }`}
            onClick={() => setActiveBot(activeBot === 'confirmation' ? null : 'confirmation')}
          >
            {/* Decorative circles */}
            <div className="absolute -top-5 -right-5 w-16 h-16 bg-white/10 rounded-full" />
            <div className="absolute -bottom-7 -left-7 w-24 h-24 bg-white/5 rounded-full" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${settings.enabled || activeBot === 'confirmation' ? 'bg-white/20' : 'bg-slate-300/50 dark:bg-slate-700'}`}>
                  <MessageSquare className={`h-4 w-4 ${settings.enabled || activeBot === 'confirmation' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${settings.enabled || activeBot === 'confirmation' ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{t('bot.confirmation')}</p>
                  <p className={`text-xs ${settings.enabled || activeBot === 'confirmation' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{t('bot.confirmationDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${settings.enabled ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
                  {settings.enabled ? `● ${t('bot.active')}` : `○ ${t('bot.off')}`}
                </span>
                <Switch
                  dir={isRTL ? 'rtl' : 'ltr'}
                  checked={settings.enabled}
                  onCheckedChange={(checked) => {
                    updateSetting('enabled', checked);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bot Updates Card */}
          <div 
            className={`relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all duration-300 ${
              activeBot === 'updates' 
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl shadow-violet-500/25 scale-[1.02]' 
                : settings.updatesEnabled
                  ? 'bg-gradient-to-br from-violet-500/90 to-purple-600/90 shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.01]'
                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-lg hover:shadow-xl border border-slate-300 dark:border-slate-700'
            }`}
            onClick={() => setActiveBot(activeBot === 'updates' ? null : 'updates')}
          >
            {/* Decorative circles */}
            <div className="absolute -top-5 -right-5 w-16 h-16 bg-white/10 rounded-full" />
            <div className="absolute -bottom-7 -left-7 w-24 h-24 bg-white/5 rounded-full" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${settings.updatesEnabled || activeBot === 'updates' ? 'bg-white/20' : 'bg-slate-300/50 dark:bg-slate-700'}`}>
                  <Users className={`h-4 w-4 ${settings.updatesEnabled || activeBot === 'updates' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${settings.updatesEnabled || activeBot === 'updates' ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{t('bot.updates')}</p>
                  <p className={`text-xs ${settings.updatesEnabled || activeBot === 'updates' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{t('bot.updatesDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${settings.updatesEnabled ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
                  {settings.updatesEnabled ? `● ${t('bot.active')}` : `○ ${t('bot.off')}`}
                </span>
                <Switch
                  dir={isRTL ? 'rtl' : 'ltr'}
                  checked={settings.updatesEnabled || false}
                  onCheckedChange={(checked) => {
                    updateSetting('updatesEnabled', checked);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bot Tracking Card */}
          <div 
            className={`relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all duration-300 ${
              activeBot === 'tracking' 
                ? 'bg-gradient-to-br from-orange-500 to-amber-600 shadow-xl shadow-orange-500/25 scale-[1.02]' 
                : settings.trackingEnabled
                  ? 'bg-gradient-to-br from-orange-500/90 to-amber-600/90 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.01]'
                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-lg hover:shadow-xl border border-slate-300 dark:border-slate-700'
            }`}
            onClick={() => setActiveBot(activeBot === 'tracking' ? null : 'tracking')}
          >
            {/* Decorative circles */}
            <div className="absolute -top-5 -right-5 w-16 h-16 bg-white/10 rounded-full" />
            <div className="absolute -bottom-7 -left-7 w-24 h-24 bg-white/5 rounded-full" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${settings.trackingEnabled || activeBot === 'tracking' ? 'bg-white/20' : 'bg-slate-300/50 dark:bg-slate-700'}`}>
                  <MapPin className={`h-4 w-4 ${settings.trackingEnabled || activeBot === 'tracking' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${settings.trackingEnabled || activeBot === 'tracking' ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{t('bot.tracking')}</p>
                  <p className={`text-xs ${settings.trackingEnabled || activeBot === 'tracking' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{t('bot.trackingDesc')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${settings.trackingEnabled ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
                  {settings.trackingEnabled ? `● ${t('bot.active')}` : `○ ${t('bot.off')}`}
                </span>
                <Switch
                  dir={isRTL ? 'rtl' : 'ltr'}
                  checked={settings.trackingEnabled || false}
                  onCheckedChange={(checked) => {
                    updateSetting('trackingEnabled', checked);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Bot Templates - Show when confirmation bot is selected */}
        {activeBot === 'confirmation' && (
          <div className="space-y-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Provider Selection */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                  <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                {t('bot.provider')}
              </h3>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { value: 'facebook', label: 'Facebook' },
                  { value: 'telegram', label: 'Telegram' },
                  { value: 'whatsapp_cloud', label: 'WhatsApp' },
                  { value: 'viber', label: 'Viber' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => updateSetting('provider', option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      settings.provider === option.value
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md shadow-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {/* Provider-specific settings */}
              {settings.provider === 'telegram' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  {settings.platformTelegramAvailable && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>{!showTelegramAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>
                        {' '}
                        {!showTelegramAdvanced
                          ? t('bot.platformModeDesc')
                          : t('bot.customModeDesc')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTelegramAdvanced((v) => !v)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      >
                        {showTelegramAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                      </button>
                    </div>
                  )}

                  {!showTelegramAdvanced && settings.platformTelegramAvailable && (
                    <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30">
                      <p className="text-xs text-emerald-800 dark:text-emerald-200">
                        <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                      </p>
                    </div>
                  )}

                  {(showTelegramAdvanced || !settings.platformTelegramAvailable) && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.telegramBotToken')}</Label>
                        <Input
                          type="password"
                          value={settings.telegramBotToken || ''}
                          onChange={(e) => updateSetting('telegramBotToken', e.target.value)}
                          placeholder="123456:ABCDEF..."
                        />
                        {settings.telegramTokenConfigured && !String(settings.telegramBotToken || '').trim() && (
                          <p className="text-xs text-slate-500">
                            {t('bot.tokenSavedHidden')}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.telegramBotUsername')}</Label>
                        <Input
                          value={settings.telegramBotUsername || ''}
                          onChange={(e) => updateSetting('telegramBotUsername', e.target.value)}
                          placeholder="@YourBotUsername"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.messengerDelay') || 'Message Delay (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={settings.telegramDelayMinutes ?? 5}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('telegramDelayMinutes', isNaN(num) ? 5 : num);
                      }}
                      placeholder="5"
                    />
                    <p className="text-xs text-slate-500">{t('bot.delayDescription') || 'Delay before sending confirmation message after order'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.autoExpire')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      value={settings.autoExpireHours ?? 24}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('autoExpireHours', isNaN(num) ? 24 : num);
                      }}
                      placeholder="24"
                    />
                    <p className="text-xs text-slate-500">{t('bot.autoExpireDesc')}</p>
                  </div>
                </div>
              )}

              {settings.provider === 'whatsapp_cloud' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.whatsappPhoneId')}</Label>
                    <Input
                      value={settings.whatsappPhoneId}
                      onChange={(e) => updateSetting('whatsappPhoneId', e.target.value)}
                      placeholder="e.g. 123456789012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.whatsappAccessToken')}</Label>
                    <Input
                      type="password"
                      value={settings.whatsappToken}
                      onChange={(e) => updateSetting('whatsappToken', e.target.value)}
                      placeholder="Paste access token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.messengerDelay') || 'Message Delay (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={(settings as any).whatsappDelayMinutes ?? 5}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('whatsappDelayMinutes' as any, isNaN(num) ? 5 : num);
                      }}
                      placeholder="5"
                    />
                    <p className="text-xs text-slate-500">{t('bot.delayDescription') || 'Delay before sending confirmation message after order'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.autoExpire')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      value={settings.autoExpireHours ?? 24}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('autoExpireHours', isNaN(num) ? 24 : num);
                      }}
                      placeholder="24"
                    />
                    <p className="text-xs text-slate-500">{t('bot.autoExpireDesc')}</p>
                  </div>
                </div>
              )}

              {settings.provider === 'viber' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.viberAuthToken')}</Label>
                    <Input
                      value={settings.viberAuthToken || ''}
                      onChange={(e) => updateSetting('viberAuthToken', e.target.value)}
                      placeholder="viber-auth-token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.viberSenderName')}</Label>
                    <Input
                      value={settings.viberSenderName || ''}
                      onChange={(e) => updateSetting('viberSenderName', e.target.value)}
                      placeholder="Sahla4Eco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.messengerDelay') || 'Message Delay (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={(settings as any).viberDelayMinutes ?? 5}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('viberDelayMinutes' as any, isNaN(num) ? 5 : num);
                      }}
                      placeholder="5"
                    />
                    <p className="text-xs text-slate-500">{t('bot.delayDescription') || 'Delay before sending confirmation message after order'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.autoExpire')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      value={settings.autoExpireHours ?? 24}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('autoExpireHours', isNaN(num) ? 24 : num);
                      }}
                      placeholder="24"
                    />
                    <p className="text-xs text-slate-500">{t('bot.autoExpireDesc')}</p>
                  </div>
                </div>
              )}

              {settings.provider === 'facebook' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 mb-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Setup:</strong>
                      {' '}
                      If you have your own Facebook Page, connect it in Meta and paste the Page ID + Page Access Token.
                      {' '}
                      {settings.platformMessengerAvailable
                        ? 'Or enable Messenger below to use the EcoPro platform Page (no Page/token needed).'
                        : 'If you don’t have a Page yet, EcoPro needs a Page + token to send/receive.'}
                    </p>
                  </div>

                  {settings.platformMessengerAvailable && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>Platform mode:</strong> EcoPro uses the shared platform Page automatically.
                        {' '}
                        <span className="text-slate-500 dark:text-slate-400">(Page ID/token are not shown.)</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowMessengerAdvanced((v) => !v)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      >
                        {showMessengerAdvanced ? 'Hide advanced' : 'Use my own Page'}
                      </button>
                    </div>
                  )}

                  {(() => {
                    const pageId = String(settings.fbPageId || settings.facebookPageId || '').trim();
                    const token = String(settings.fbPageAccessToken || settings.facebookAccessToken || '').trim();
                    const wantsMessenger = Boolean(settings.messengerEnabled);
                    const platformAvailable = Boolean(settings.platformMessengerAvailable);
                    const hasStorePageConfig = Boolean(pageId && (token || settings.fbPageAccessTokenConfigured));

                    if (!wantsMessenger) {
                      return (
                        <div className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Messenger is currently <strong>disabled</strong>.
                            {' '}
                            {platformAvailable
                              ? 'Enable it below to use the EcoPro platform Page, or paste your own Page ID + token.'
                              : 'Enable it below after you connect a Facebook Page in Meta and paste the Page ID + Page Access Token here.'}
                          </p>
                        </div>
                      );
                    }

                    if (!hasStorePageConfig && platformAvailable) {
                      return (
                        <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30">
                          <p className="text-xs text-emerald-800 dark:text-emerald-200">
                            <strong>Configured (platform mode):</strong>
                            {' '}
                            EcoPro will use the platform Messenger Page to send/receive messages for your store.
                          </p>
                        </div>
                      );
                    }

                    if (!hasStorePageConfig) {
                      return (
                        <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30">
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            <strong>Not connected yet:</strong> Messenger is enabled, but EcoPro can’t send/receive until a Facebook Page is connected in Meta and a <strong>Page Access Token</strong> is saved.
                            {' '}
                            If Meta shows <strong>“No FB pages yet”</strong>, it means the app has <strong>zero Pages connected</strong>, so there is no Page token to generate.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30">
                        <p className="text-xs text-emerald-800 dark:text-emerald-200">
                          <strong>Configured:</strong> Page ID + access token are set. Webhook events and customer linking should work once Meta webhooks are active.
                        </p>
                      </div>
                    );
                  })()}

                  {(!settings.platformMessengerAvailable || showMessengerAdvanced) && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.facebookPageId') || 'Facebook Page ID'}</Label>
                        <Input
                          value={settings.fbPageId || settings.facebookPageId || ''}
                          onChange={(e) => updateSetting('fbPageId', e.target.value)}
                          placeholder="e.g. 123456789012345"
                        />
                      </div>
                      <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
                        <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.facebookAccessToken') || 'Page Access Token'}</Label>
                        <Input
                          name="fbPageAccessToken"
                          autoComplete="new-password"
                          type="password"
                          value={settings.fbPageAccessToken || settings.facebookAccessToken || ''}
                          onChange={(e) => updateSetting('fbPageAccessToken', e.target.value)}
                          placeholder="Paste Page Access Token from Facebook"
                        />
                        {settings.fbPageAccessTokenConfigured && !String(settings.fbPageAccessToken || settings.facebookAccessToken || '').trim() && (
                          <p className="text-xs text-slate-500">
                            Token is saved (hidden). Paste a new token to replace it.
                          </p>
                        )}
                      </form>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.messengerDelay') || 'Message Delay (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={settings.messengerDelayMinutes ?? 5}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('messengerDelayMinutes', isNaN(num) ? 5 : num);
                      }}
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.autoExpire')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      value={settings.autoExpireHours ?? 24}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        updateSetting('autoExpireHours', isNaN(num) ? 24 : num);
                      }}
                      placeholder="24"
                    />
                    <p className="text-xs text-slate-500">{t('bot.autoExpireDesc')}</p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch
                      checked={settings.messengerEnabled ?? false}
                      onCheckedChange={(checked) => updateSetting('messengerEnabled', checked)}
                    />
                    <Label className="text-sm text-slate-700 dark:text-slate-300">
                      {t('bot.messengerEnabled') || 'Enable Messenger notifications'}
                    </Label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSetupMessengerGetStarted}
                      disabled={
                        settingUpMessenger ||
                        !storeSlug ||
                        (((!String(settings.fbPageId || '').trim() || (!String(settings.fbPageAccessToken || '').trim() && !Boolean(settings.fbPageAccessTokenConfigured))) && !Boolean(settings.platformMessengerAvailable))) ||
                        !(settings.messengerEnabled ?? false)
                      }
                      className="w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {settingUpMessenger ? 'Setting up…' : 'Setup Messenger Get Started'}
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                      This configures the Page “Get Started” button so customers can link faster after clicking Connect.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Greeting Template */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                {t('bot.greetingMessage')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('bot.greetingDesc')}</p>
              <Textarea
                value={settings.templateGreeting || ''}
                onChange={(e) => updateSetting('templateGreeting', e.target.value)}
                rows={4}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            {/* Instant Order Notification - NEW */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-700 shadow-lg shadow-emerald-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                📦 {t('bot.instantOrder')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('bot.instantOrderDesc')}</p>
              <Textarea
                value={settings.templateInstantOrder || ''}
                onChange={(e) => updateSetting('templateInstantOrder', e.target.value)}
                rows={12}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
              />
            </div>

            {/* Pin Instructions - NEW */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-amber-200 dark:border-amber-700 shadow-lg shadow-amber-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                  <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                📌 {t('bot.pinInstructions')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('bot.pinInstructionsDesc')}</p>
              <Textarea
                value={settings.templatePinInstructions || ''}
                onChange={(e) => updateSetting('templatePinInstructions', e.target.value)}
                rows={6}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
              />
            </div>

            {/* Order Confirmation Template */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-green-200 dark:border-green-700 shadow-lg shadow-green-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                ⏱️ {t('bot.orderConfirmation')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('bot.orderConfirmationDesc')}</p>
              
              <Textarea
                value={settings.templateOrderConfirmation}
                onChange={(e) => updateSetting('templateOrderConfirmation', e.target.value)}
                rows={6}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            {/* Payment Template */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                {t('bot.paymentConfirmation')}
              </h3>
              <Textarea
                value={settings.templatePayment}
                onChange={(e) => updateSetting('templatePayment', e.target.value)}
                rows={4}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            {/* Shipping Template */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                  <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                {t('bot.shippingNotification')}
              </h3>
              <Textarea
                value={settings.templateShipping}
                onChange={(e) => updateSetting('templateShipping', e.target.value)}
                rows={4}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            {/* Variables Reference */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20">
                  <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">{t('bot.availableVariables')}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {variables.map((v) => (
                  <div key={v.key} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <code className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md font-mono text-xs font-semibold">
                      {v.key}
                    </code>
                    <span className="text-slate-600 dark:text-slate-400 text-xs">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bot Updates - Show when updates bot is selected */}
        {activeBot === 'updates' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-violet-200/30 dark:shadow-black/20 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <CustomerBot embedded={true} />
          </div>
        )}

        {/* Bot Tracking - Show when tracking bot is selected */}
        {activeBot === 'tracking' && (
          <div className="space-y-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Tracking Overview */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800/50 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                  <Navigation className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('bot.realTimeTracking')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('bot.realTimeTrackingDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Tracking Status Messages */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-lg">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                  <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                {t('bot.trackingStatusMessages')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {t('bot.trackingStatusDesc')}
              </p>
              
              <div className="space-y-3">
                {/* Order Shipped */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {t('bot.orderShipped')}
                  </Label>
                  <Textarea
                    value={(settings as any).templateTrackingShipped || `📦 مرحباً {customerName}!\n\nتم شحن طلبك #{orderId}.\n🚚 شركة التوصيل: {deliveryCompany}\n📍 رقم التتبع: {trackingNumber}\n\nيمكنك تتبع طلبك من هنا: {trackingUrl}`}
                    onChange={(e) => updateSetting('templateTrackingShipped' as any, e.target.value)}
                    rows={4}
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                {/* Out for Delivery */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {t('bot.outForDelivery')}
                  </Label>
                  <Textarea
                    value={(settings as any).templateTrackingOutForDelivery || `🚛 {customerName}، طلبك في الطريق!\n\nطلبك #{orderId} خرج للتوصيل.\n📍 الوصول المتوقع: {estimatedTime}\n📞 السائق سيتصل بك قريباً.\n\nتأكد من تواجدك لاستلام الطلب!`}
                    onChange={(e) => updateSetting('templateTrackingOutForDelivery' as any, e.target.value)}
                    rows={4}
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                {/* Delivered */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {t('bot.delivered')}
                  </Label>
                  <Textarea
                    value={(settings as any).templateTrackingDelivered || `✅ تم التوصيل بنجاح!\n\nمرحباً {customerName}،\nتم توصيل طلبك #{orderId} بنجاح.\n\n🙏 شكراً لتسوقك معنا!\n⭐ نتمنى أن تستمتع بمنتجاتك.\n\nللاستفسارات: {supportPhone}`}
                    onChange={(e) => updateSetting('templateTrackingDelivered' as any, e.target.value)}
                    rows={4}
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                {/* Delivery Failed */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    {t('bot.deliveryFailed')}
                  </Label>
                  <Textarea
                    value={(settings as any).templateTrackingFailed || `⚠️ فشل التوصيل\n\nمرحباً {customerName}،\nلم نتمكن من توصيل طلبك #{orderId}.\n\nالسبب: {failureReason}\n\n📞 يرجى التواصل معنا لإعادة جدولة التوصيل: {supportPhone}`}
                    onChange={(e) => updateSetting('templateTrackingFailed' as any, e.target.value)}
                    rows={4}
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Company Integration */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-lg">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                  <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                {t('bot.deliveryCompanySettings')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {t('bot.deliveryCompanyDesc')}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.defaultDeliveryCompany')}</Label>
                  <Input
                    value={(settings as any).defaultDeliveryCompany || ''}
                    onChange={(e) => updateSetting('defaultDeliveryCompany' as any, e.target.value)}
                    placeholder="Yalidine, ZR Express..."
                    className="bg-slate-50 dark:bg-slate-800/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900 dark:text-white">{t('bot.trackingUrlTemplate')}</Label>
                  <Input
                    value={(settings as any).trackingUrlTemplate || ''}
                    onChange={(e) => updateSetting('trackingUrlTemplate' as any, e.target.value)}
                    placeholder="https://track.example.com/{trackingNumber}"
                    className="bg-slate-50 dark:bg-slate-800/50"
                  />
                </div>
              </div>
            </div>

            {/* Tracking Variables */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                  <Code2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">{t('bot.trackingVariables')}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { key: '{customerName}', desc: t('bot.customerName') },
                  { key: '{orderId}', desc: t('bot.orderId') },
                  { key: '{trackingNumber}', desc: t('bot.trackingNumber') },
                  { key: '{deliveryCompany}', desc: t('bot.deliveryCompany') },
                  { key: '{trackingUrl}', desc: t('bot.trackingUrl') },
                  { key: '{estimatedTime}', desc: t('bot.estimatedTime') },
                  { key: '{failureReason}', desc: t('bot.failureReason') },
                  { key: '{supportPhone}', desc: t('bot.supportPhone') },
                ].map((v) => (
                  <div key={v.key} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <code className="bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-md font-mono text-xs font-semibold">
                      {v.key}
                    </code>
                    <span className="text-slate-600 dark:text-slate-400 text-xs">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* Save Button */}
        <div className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'}`}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('bot.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t('bot.saveChanges')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
