import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Save, Loader2, Phone, MessageSquare, Globe, Check, Users, Code2, Truck, CreditCard, MapPin, Package, Navigation, ChevronDown, ExternalLink, Unplug, CheckCircle, Instagram, Send, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import CustomerBot from "../CustomerBot";

interface FbOAuthStatus {
  connected: boolean;
  pageId?: string;
  pageName?: string;
  instagramConnected?: boolean;
  instagramUsername?: string;
  tokenExpiresAt?: string;
}

interface FbPage {
  id: string;
  name: string;
  hasInstagram: boolean;
}

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
  platformWhatsappAvailable?: boolean;
  platformViberAvailable?: boolean;
  usePlatformViber?: boolean;
  viberUsingPlatform?: boolean;
  // Platform Instagram
  platformInstagramAvailable?: boolean;
  usePlatformInstagram?: boolean;
  instagramUsingPlatform?: boolean;
  instagramAccountId?: string;
  instagramPageAccessToken?: string;
  instagramTokenConfigured?: boolean;
  templateOrderConfirmation: string;
  templatePayment: string;
  templateShipping: string;
}

export default function AdminBotSettings() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMessengerAdvanced, setShowMessengerAdvanced] = useState(false);
  const [showTelegramAdvanced, setShowTelegramAdvanced] = useState(false);
  const [showWhatsappAdvanced, setShowWhatsappAdvanced] = useState(false);
  const [showFacebookManual, setShowFacebookManual] = useState(false);
  const [showViberAdvanced, setShowViberAdvanced] = useState(false);
  const [showInstagramAdvanced, setShowInstagramAdvanced] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string>('');
  const [activeBot, setActiveBot] = useState<'confirmation' | 'updates' | 'tracking' | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['provider']));

  // Facebook OAuth state
  const [fbStatus, setFbStatus] = useState<FbOAuthStatus | null>(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbDisconnecting, setFbDisconnecting] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [savingPage, setSavingPage] = useState(false);

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
    platformViberAvailable: false,
    usePlatformViber: false,
    viberUsingPlatform: false,
    platformInstagramAvailable: false,
    usePlatformInstagram: false,
    instagramUsingPlatform: false,
    instagramAccountId: '',
    instagramPageAccessToken: '',
    instagramTokenConfigured: false,
    templateOrderConfirmation: `مرحباً {customerName}! 🌟\n\nشكراً لطلبك من {companyName}!\n\n📦 تفاصيل الطلب:\n• المنتج: {productName}\n• السعر: {totalPrice} دج\n• العنوان: {address}\n\nهل تؤكد الطلب؟ اضغط ✅ للتأكيد أو ❌ للإلغاء.`,
    templatePayment: `تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.`,
    templateShipping: `تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.`
  });

  useEffect(() => {
    loadSettings();
    loadFbStatus();
  }, []);

  // Handle Facebook OAuth callback params
  useEffect(() => {
    const fb = params.get('fb');
    if (fb === 'connected') {
      toast({ title: t('platforms.facebook.connectedToast'), description: t('platforms.facebook.connectedDesc') });
      loadFbStatus();
      params.delete('fb');
      setParams(params, { replace: true });
    } else if (fb === 'select-page') {
      loadFbPages();
      params.delete('fb');
      setParams(params, { replace: true });
    } else if (fb === 'error') {
      toast({ title: t('platforms.facebook.errorToast'), variant: 'destructive' });
      params.delete('fb');
      setParams(params, { replace: true });
    }
  }, [params]);

  // ── Facebook OAuth helpers ─────────────────────────────────
  async function loadFbStatus() {
    try {
      setFbLoading(true);
      const data = await apiFetch<FbOAuthStatus>('/api/facebook/status');
      setFbStatus(data);
    } catch {
      setFbStatus({ connected: false });
    } finally {
      setFbLoading(false);
    }
  }

  async function loadFbPages() {
    try {
      const data = await apiFetch<{ pages: FbPage[] }>('/api/facebook/pages');
      if (data?.pages?.length) {
        setFbPages(data.pages);
        setShowPagePicker(true);
      }
    } catch {
      toast({ title: t('platforms.facebook.errorToast'), variant: 'destructive' });
    }
  }

  async function connectFacebook() {
    try {
      setFbConnecting(true);
      const data = await apiFetch<{ url: string }>('/api/facebook/auth-url');
      if (data?.url) window.location.href = data.url;
    } catch {
      toast({ title: t('platforms.facebook.errorToast'), variant: 'destructive' });
      setFbConnecting(false);
    }
  }

  async function disconnectFacebook() {
    try {
      setFbDisconnecting(true);
      await apiFetch('/api/facebook/disconnect', { method: 'POST' });
      setFbStatus({ connected: false });
      toast({ title: t('platforms.facebook.disconnectedToast') });
    } catch {
      toast({ title: t('platforms.facebook.errorToast'), variant: 'destructive' });
    } finally {
      setFbDisconnecting(false);
    }
  }

  async function selectFbPage() {
    if (!selectedPageId) return;
    try {
      setSavingPage(true);
      const data = await apiFetch<{ success: boolean; pageName: string; instagramConnected: boolean }>(
        '/api/facebook/select-page',
        { method: 'POST', body: JSON.stringify({ pageId: selectedPageId }) }
      );
      if (data?.success) {
        setShowPagePicker(false);
        setFbPages([]);
        toast({ title: t('platforms.facebook.connectedToast'), description: data.pageName });
        loadFbStatus();
      }
    } catch {
      toast({ title: t('platforms.facebook.errorToast'), variant: 'destructive' });
    } finally {
      setSavingPage(false);
    }
  }

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

      if (data?.platformWhatsappAvailable) {
        setShowWhatsappAdvanced(!(data?.usePlatformWhatsapp ?? data?.whatsappUsingPlatform ?? true));
      }
      if (data?.platformViberAvailable) {
        setShowViberAdvanced(!(data?.usePlatformViber ?? data?.viberUsingPlatform ?? true));
      }
      if (data?.platformInstagramAvailable) {
        setShowInstagramAdvanced(!(data?.usePlatformInstagram ?? data?.instagramUsingPlatform ?? true));
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
      payload.usePlatformWhatsapp = Boolean(settings.platformWhatsappAvailable) && !showWhatsappAdvanced;
      payload.usePlatformViber = Boolean(settings.platformViberAvailable) && !showViberAdvanced;
      payload.usePlatformInstagram = Boolean(settings.platformInstagramAvailable) && !showInstagramAdvanced;

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
      maybeDeleteEmpty('instagramAccountId');
      maybeDeleteEmpty('instagramPageAccessToken');
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
      if (payload.usePlatformViber) {
        delete payload.viberAuthToken;
        delete payload.viberSenderName;
      }
      if (payload.usePlatformInstagram) {
        delete payload.instagramAccountId;
        delete payload.instagramPageAccessToken;
      }
      if (payload.usePlatformWhatsapp) {
        delete payload.whatsappPhoneId;
        delete payload.whatsappToken;
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

        {/* ═══ Platform Connections (always visible below header) ═══ */}
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{t('platforms.title')}</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t('platforms.subtitle')}</p>
            </div>
          </div>

          {/* Platform selector cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {([
              { value: 'facebook', label: 'Facebook', icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-600', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30',
                connected: !!fbStatus?.connected, status: fbStatus?.pageName || null, oauth: true },
              { value: 'instagram', label: 'Instagram', icon: <Instagram className="w-5 h-5" />, color: 'text-pink-600', border: 'border-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30',
                connected: !!fbStatus?.instagramConnected, status: fbStatus?.instagramUsername ? `@${fbStatus.instagramUsername}` : null, oauth: true },
              { value: 'telegram', label: 'Telegram', icon: <Send className="w-5 h-5" />, color: 'text-sky-600', border: 'border-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/30',
                connected: !!(settings.telegramTokenConfigured || settings.telegramUsingPlatform), status: settings.telegramBotUsername ? `@${settings.telegramBotUsername}` : null, oauth: false },
              { value: 'whatsapp_cloud', label: 'WhatsApp', icon: <Phone className="w-5 h-5" />, color: 'text-green-600', border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-950/30',
                connected: !!settings.whatsappTokenConfigured, status: null, oauth: false },
              { value: 'viber', label: 'Viber', icon: <Smartphone className="w-5 h-5" />, color: 'text-purple-600', border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30',
                connected: !!(settings.viberAuthToken), status: null, oauth: false },
            ] as const).map((p) => (
              <button key={p.value} onClick={() => updateSetting('provider', p.value)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  settings.provider === p.value
                    ? `${p.border} ${p.bg} shadow-sm`
                    : p.connected
                      ? `border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20`
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}>
                {p.connected && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className={p.color}>{p.icon}</span>
                <span className="text-[11px] font-bold">{p.label}</span>
                {p.connected && p.status && (
                  <span className="text-[9px] text-slate-500 truncate max-w-full">{p.status}</span>
                )}
              </button>
            ))}
          </div>

          {/* Platform-specific settings below the cards */}

          {/* ── Facebook ── */}
          {settings.provider === 'facebook' && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {fbLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              ) : fbStatus?.connected ? (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      {t('platforms.facebook.connectedTo')} <strong>{fbStatus.pageName}</strong>
                    </p>
                    {fbStatus.instagramConnected && (
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <Instagram className="w-3 h-3" />
                        Instagram: {fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : t('platforms.connected')}
                      </p>
                    )}
                    {!fbStatus.instagramConnected && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Instagram className="w-3 h-3" />
                        {isRTL ? 'Instagram غير مربوط — تأكد أن صفحتك مربوطة بحساب Instagram Business' : 'Instagram not linked — make sure your Page is linked to an Instagram Business account'}
                      </p>
                    )}
                    {fbStatus.tokenExpiresAt && (
                      <p className="text-[10px] text-slate-500">
                        {t('platforms.facebook.tokenExpires')}: {new Date(fbStatus.tokenExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm"
                    className="rounded-xl text-[10px] text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 shrink-0"
                    onClick={disconnectFacebook} disabled={fbDisconnecting}>
                    {fbDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                    <span className="mx-1">{t('platforms.disconnect')}</span>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-xs font-semibold">{t('platforms.facebook.notConnected')}</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">{t('platforms.facebook.connectHint')}</p>
                  <Button
                    className="h-9 px-6 rounded-xl font-bold text-white bg-[#1877F2] hover:bg-[#166FE5] shadow-sm gap-2 text-xs"
                    onClick={connectFacebook} disabled={fbConnecting}>
                    {fbConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    {t('platforms.facebook.connectBtn')}
                  </Button>
                </div>
              )}

              {/* Page picker */}
              {showPagePicker && fbPages.length > 0 && (
                <div className="rounded-xl border-2 border-blue-300 dark:border-blue-700 overflow-hidden">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-950/20">
                    <p className="text-xs font-bold">{t('platforms.facebook.selectPage')}</p>
                    <p className="text-[10px] text-slate-500">{t('platforms.facebook.selectPageDesc')}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {fbPages.map((page) => (
                      <button key={page.id} onClick={() => setSelectedPageId(page.id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all text-start ${
                          selectedPageId === page.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selectedPageId === page.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold">{page.name}</p>
                          {page.hasInstagram && (
                            <p className="text-[10px] text-pink-600 flex items-center gap-1">
                              <Instagram className="w-2.5 h-2.5" /> Instagram {t('platforms.connected')}
                            </p>
                          )}
                        </div>
                        {selectedPageId === page.id && <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />}
                      </button>
                    ))}
                    <Button className="w-full h-9 rounded-xl font-bold mt-2 bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2 text-xs"
                      disabled={!selectedPageId || savingPage} onClick={selectFbPage}>
                      {savingPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {t('platforms.facebook.confirmPage')}
                    </Button>
                  </div>
                </div>
              )}

              {settings.platformMessengerAvailable && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>{!showMessengerAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>{' '}
                    {!showMessengerAdvanced ? t('bot.platformModeDesc') : t('bot.customModeDesc')}
                  </p>
                  <button type="button" onClick={() => setShowMessengerAdvanced(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    {showMessengerAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                  </button>
                </div>
              )}
              {!showMessengerAdvanced && settings.platformMessengerAvailable && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                  </p>
                </div>
              )}
              {(showMessengerAdvanced || !settings.platformMessengerAvailable) && (
                <>
                  {/* Manual credentials divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="relative flex justify-center">
                      <button type="button" onClick={() => setShowFacebookManual(v => !v)}
                        className="px-3 py-1 bg-white dark:bg-slate-900 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        {showFacebookManual
                          ? (isRTL ? 'إخفاء الإعدادات اليدوية' : 'Hide manual setup')
                          : (isRTL ? 'أو أدخل البيانات يدوياً' : 'Or enter credentials manually')}
                      </button>
                    </div>
                  </div>
                  {showFacebookManual && (
                    <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] text-slate-500">
                        {isRTL
                          ? 'أدخل معرّف صفحة فيسبوك ورمز وصول الصفحة من Meta Developer Dashboard.'
                          : 'Enter your Facebook Page ID and Page Access Token from Meta Developer Dashboard.'}
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{isRTL ? 'معرّف صفحة فيسبوك' : 'Facebook Page ID'}</Label>
                        <Input value={settings.fbPageId || ''} onChange={(e) => updateSetting('fbPageId', e.target.value)} placeholder="e.g. 123456789012345" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{isRTL ? 'رمز وصول الصفحة' : 'Page Access Token'}</Label>
                        <Input type="password" value={settings.fbPageAccessToken || ''} onChange={(e) => updateSetting('fbPageAccessToken', e.target.value)} placeholder="Paste page access token" />
                        {settings.fbPageAccessTokenConfigured && !String(settings.fbPageAccessToken || '').trim() && (
                          <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.messengerDelay') || 'Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} value={settings.messengerDelayMinutes ?? 5}
                    onChange={(e) => updateSetting('messengerDelayMinutes', parseInt(e.target.value, 10) || 5)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.autoExpire')}</Label>
                  <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                    onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
                </div>
              </div>
            </div>
          )}

          {/* ── Instagram ── */}
          {settings.provider === 'instagram' && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>{!showInstagramAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>{' '}
                  {!showInstagramAdvanced ? t('bot.platformModeDesc') : t('bot.customModeDesc')}
                </p>
                <button type="button" onClick={() => setShowInstagramAdvanced(v => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                  {showInstagramAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                </button>
              </div>
              {!showInstagramAdvanced && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                  </p>
                </div>
              )}
              {showInstagramAdvanced && fbLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                </div>
              ) : fbStatus?.connected && fbStatus?.instagramConnected ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                        <Instagram className="w-3.5 h-3.5" />
                        {fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : 'Instagram Business'}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                        {isRTL
                          ? 'مربوط عبر فيسبوك — الرسائل المباشرة يتم الرد عليها تلقائياً بالذكاء الاصطناعي'
                          : 'Connected via Facebook — DMs are auto-replied by AI'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {isRTL ? 'الصفحة:' : 'Page:'} {fbStatus.pageName}
                      </p>
                    </div>
                    <Button variant="outline" size="sm"
                      className="rounded-xl text-[10px] text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 shrink-0"
                      onClick={disconnectFacebook} disabled={fbDisconnecting}>
                      {fbDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                      <span className="mx-1">{t('platforms.disconnect')}</span>
                    </Button>
                  </div>
                  <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/20">
                    <p className="text-[11px] text-pink-800 dark:text-pink-200">
                      {isRTL
                        ? '✨ الردود التلقائية: الذكاء الاصطناعي يرد على رسائل Instagram المباشرة تلقائياً بناءً على منتجات متجرك والتعليمات في إعدادات AI.'
                        : '✨ Auto-replies: AI responds to Instagram DMs automatically based on your store products and instructions in AI settings.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center mx-auto">
                    <Instagram className="w-6 h-6 text-pink-500" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'غير متصل بـ Instagram' : 'Not connected to Instagram'}
                  </p>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                    {isRTL
                      ? 'يرجى الاتصال أولاً بحساب فيسبوك من علامة التبويب "فيسبوك" أعلاه. سيتم اكتشاف Instagram تلقائياً إذا كان مربوطاً بالصفحة.'
                      : 'Please connect your Facebook account from the "Facebook" tab above. Instagram will be auto-detected if linked to your Page.'}
                  </p>
                </div>
              )}

              {/* Manual credentials for custom mode - only show when useMyOwnBot selected */}
              {showInstagramAdvanced && (
                <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500">
                    {isRTL
                      ? 'أدخل معرّف حساب Instagram Business ورمز وصول الصفحة المرتبطة من Meta Developer Dashboard.'
                      : 'Enter your Instagram Business Account ID and the linked Page Access Token from Meta Developer Dashboard.'}
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{isRTL ? 'معرّف حساب Instagram' : 'Instagram Account ID'}</Label>
                    <Input value={settings.instagramAccountId || ''}
                      onChange={(e) => updateSetting('instagramAccountId', e.target.value)}
                      placeholder="e.g. 17841400123456789" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{isRTL ? 'رمز وصول الصفحة' : 'Page Access Token'}</Label>
                    <Input type="password" value={settings.instagramPageAccessToken || ''}
                      onChange={(e) => updateSetting('instagramPageAccessToken', e.target.value)}
                      placeholder="Paste page access token" />
                    {settings.instagramTokenConfigured && !String(settings.instagramPageAccessToken || '').trim() && (
                      <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.messengerDelay') || 'Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} value={settings.messengerDelayMinutes ?? 5}
                    onChange={(e) => updateSetting('messengerDelayMinutes', parseInt(e.target.value, 10) || 5)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.autoExpire')}</Label>
                  <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                    onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
                </div>
              </div>
            </div>
          )}

          {/* ── Telegram ── */}
          {settings.provider === 'telegram' && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {settings.platformTelegramAvailable && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>{!showTelegramAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>{' '}
                    {!showTelegramAdvanced ? t('bot.platformModeDesc') : t('bot.customModeDesc')}
                  </p>
                  <button type="button" onClick={() => setShowTelegramAdvanced(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    {showTelegramAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                  </button>
                </div>
              )}
              {!showTelegramAdvanced && settings.platformTelegramAvailable && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                  </p>
                </div>
              )}
              {(showTelegramAdvanced || !settings.platformTelegramAvailable) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('bot.telegramBotToken')}</Label>
                    <Input type="password" value={settings.telegramBotToken || ''} onChange={(e) => updateSetting('telegramBotToken', e.target.value)} placeholder="123456:ABCDEF..." />
                    {settings.telegramTokenConfigured && !String(settings.telegramBotToken || '').trim() && (
                      <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('bot.telegramBotUsername')}</Label>
                    <Input value={settings.telegramBotUsername || ''} onChange={(e) => updateSetting('telegramBotUsername', e.target.value)} placeholder="@YourBotUsername" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.messengerDelay') || 'Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} value={settings.telegramDelayMinutes ?? 5}
                    onChange={(e) => updateSetting('telegramDelayMinutes', parseInt(e.target.value, 10) || 5)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.autoExpire')}</Label>
                  <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                    onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
                </div>
              </div>
            </div>
          )}

          {/* ── WhatsApp ── */}
          {settings.provider === 'whatsapp_cloud' && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {settings.platformWhatsappAvailable && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>{!showWhatsappAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>{' '}
                    {!showWhatsappAdvanced ? t('bot.platformModeDesc') : t('bot.customModeDesc')}
                  </p>
                  <button type="button" onClick={() => setShowWhatsappAdvanced(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    {showWhatsappAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                  </button>
                </div>
              )}
              {!showWhatsappAdvanced && settings.platformWhatsappAvailable && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                  </p>
                </div>
              )}
              {(showWhatsappAdvanced || !settings.platformWhatsappAvailable) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('bot.whatsappPhoneId')}</Label>
                    <Input value={settings.whatsappPhoneId} onChange={(e) => updateSetting('whatsappPhoneId', e.target.value)} placeholder="e.g. 123456789012345" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('bot.whatsappAccessToken')}</Label>
                    <Input type="password" value={settings.whatsappToken} onChange={(e) => updateSetting('whatsappToken', e.target.value)} placeholder="Paste access token" />
                    {settings.whatsappTokenConfigured && !String(settings.whatsappToken || '').trim() && (
                      <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                    )}
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.messengerDelay') || 'Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} value={(settings as any).whatsappDelayMinutes ?? 5}
                    onChange={(e) => updateSetting('whatsappDelayMinutes' as any, parseInt(e.target.value, 10) || 5)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.autoExpire')}</Label>
                  <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                    onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
                </div>
              </div>
            </div>
          )}

          {/* ── Viber ── */}
          {settings.provider === 'viber' && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {settings.platformViberAvailable && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>{!showViberAdvanced ? t('bot.platformMode') : t('bot.customMode')}</strong>{' '}
                    {!showViberAdvanced ? t('bot.platformModeDesc') : t('bot.customModeDesc')}
                  </p>
                  <button type="button" onClick={() => setShowViberAdvanced(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    {showViberAdvanced ? t('bot.usePlatformBot') : t('bot.useMyOwnBot')}
                  </button>
                </div>
              )}
              {!showViberAdvanced && settings.platformViberAvailable && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    <strong>{t('bot.configuredPlatformMode')}</strong> {t('bot.configuredPlatformModeDesc')}
                  </p>
                </div>
              )}
              {(showViberAdvanced || !settings.platformViberAvailable) && (
              <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('bot.viberAuthToken')}</Label>
                <Input value={settings.viberAuthToken || ''} onChange={(e) => updateSetting('viberAuthToken', e.target.value)} placeholder="viber-auth-token" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('bot.viberSenderName')}</Label>
                <Input value={settings.viberSenderName || ''} onChange={(e) => updateSetting('viberSenderName', e.target.value)} placeholder="Sahla4Eco" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.messengerDelay') || 'Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} value={(settings as any).viberDelayMinutes ?? 5}
                    onChange={(e) => updateSetting('viberDelayMinutes' as any, parseInt(e.target.value, 10) || 5)} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('bot.autoExpire')}</Label>
                  <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                    onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
                </div>
              </div>
              </>
              )}
            </div>
          )}
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
