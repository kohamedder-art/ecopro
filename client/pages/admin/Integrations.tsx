import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe, Save, Loader2, Phone, MessageSquare, Check, ExternalLink, Unplug, CheckCircle, Instagram, Send, Smartphone, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

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

interface IntegrationSettings {
  provider: string;
  // Telegram
  telegramBotToken?: string;
  telegramTokenConfigured?: boolean;
  telegramBotUsername?: string;
  telegramDelayMinutes?: number;
  platformTelegramAvailable?: boolean;
  usePlatformTelegram?: boolean;
  telegramUsingPlatform?: boolean;
  // WhatsApp
  whatsappPhoneId?: string;
  whatsappToken?: string;
  whatsappTokenConfigured?: boolean;
  whatsappDelayMinutes?: number;
  platformWhatsappAvailable?: boolean;
  usePlatformWhatsapp?: boolean;
  // Facebook / Messenger
  fbPageId?: string;
  fbPageAccessToken?: string;
  fbPageAccessTokenConfigured?: boolean;
  messengerDelayMinutes?: number;
  platformMessengerAvailable?: boolean;
  platformMessengerPageId?: string;
  usePlatformMessenger?: boolean;
  messengerUsingPlatform?: boolean;
  // Instagram
  platformInstagramAvailable?: boolean;
  usePlatformInstagram?: boolean;
  instagramUsingPlatform?: boolean;
  instagramAccountId?: string;
  instagramPageAccessToken?: string;
  instagramTokenConfigured?: boolean;
  // Viber
  viberAuthToken?: string;
  viberSenderName?: string;
  viberDelayMinutes?: number;
  platformViberAvailable?: boolean;
  usePlatformViber?: boolean;
  viberUsingPlatform?: boolean;
  // General
  autoExpireHours?: number;
}

type Platform = 'facebook' | 'instagram' | 'telegram' | 'whatsapp_cloud' | 'viber';

export default function Integrations() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>('telegram');

  // Advanced mode toggles (custom bot vs platform bot)
  const [showMessengerAdvanced, setShowMessengerAdvanced] = useState(false);
  const [showTelegramAdvanced, setShowTelegramAdvanced] = useState(false);
  const [showWhatsappAdvanced, setShowWhatsappAdvanced] = useState(false);
  const [showViberAdvanced, setShowViberAdvanced] = useState(false);
  const [showInstagramAdvanced, setShowInstagramAdvanced] = useState(false);
  const [showFacebookManual, setShowFacebookManual] = useState(false);

  // Facebook OAuth state
  const [fbStatus, setFbStatus] = useState<FbOAuthStatus | null>(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbDisconnecting, setFbDisconnecting] = useState(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [savingPage, setSavingPage] = useState(false);

  const [settings, setSettings] = useState<IntegrationSettings>({
    provider: 'telegram',
    autoExpireHours: 24,
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
        throw new Error(errJson?.error || `Failed to load settings (HTTP ${response.status})`);
      }
      const data = await response.json();
      setSettings(data);

      if (data?.platformMessengerAvailable)
        setShowMessengerAdvanced(!(data?.usePlatformMessenger ?? data?.messengerUsingPlatform ?? true));
      if (data?.platformTelegramAvailable)
        setShowTelegramAdvanced(!(data?.usePlatformTelegram ?? data?.telegramUsingPlatform ?? true));
      if (data?.platformWhatsappAvailable)
        setShowWhatsappAdvanced(!(data?.usePlatformWhatsapp ?? data?.whatsappUsingPlatform ?? true));
      if (data?.platformViberAvailable)
        setShowViberAdvanced(!(data?.usePlatformViber ?? data?.viberUsingPlatform ?? true));
      if (data?.platformInstagramAvailable)
        setShowInstagramAdvanced(!(data?.usePlatformInstagram ?? data?.instagramUsingPlatform ?? true));

      // Set active platform to whichever is currently configured
      if (data?.provider) setActivePlatform(data.provider as Platform);
    } catch (error) {
      console.error('Failed to load integration settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load settings",
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

      payload.usePlatformMessenger = Boolean(settings.platformMessengerAvailable) && !showMessengerAdvanced;
      payload.usePlatformTelegram = Boolean(settings.platformTelegramAvailable) && !showTelegramAdvanced;
      payload.usePlatformWhatsapp = Boolean(settings.platformWhatsappAvailable) && !showWhatsappAdvanced;
      payload.usePlatformViber = Boolean(settings.platformViberAvailable) && !showViberAdvanced;
      payload.usePlatformInstagram = Boolean(settings.platformInstagramAvailable) && !showInstagramAdvanced;

      const maybeDeleteEmpty = (key: string) => {
        const v = payload[key];
        if (typeof v !== 'string' || !v.trim()) delete payload[key];
      };
      maybeDeleteEmpty('whatsappToken');
      maybeDeleteEmpty('telegramBotToken');
      maybeDeleteEmpty('telegramBotUsername');
      maybeDeleteEmpty('fbPageAccessToken');
      maybeDeleteEmpty('fbPageId');
      maybeDeleteEmpty('instagramAccountId');
      maybeDeleteEmpty('instagramPageAccessToken');

      if (payload.usePlatformMessenger) { delete payload.fbPageId; delete payload.fbPageAccessToken; }
      if (payload.usePlatformTelegram) { delete payload.telegramBotToken; delete payload.telegramBotUsername; }
      if (payload.usePlatformViber) { delete payload.viberAuthToken; delete payload.viberSenderName; }
      if (payload.usePlatformInstagram) { delete payload.instagramAccountId; delete payload.instagramPageAccessToken; }
      if (payload.usePlatformWhatsapp) { delete payload.whatsappPhoneId; delete payload.whatsappToken; }

      const response = await fetch('/api/bot/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'تم حفظ إعدادات الربط بنجاح' : 'Integration settings saved successfully' });
      } else {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || 'Failed to save settings');
      }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{isRTL ? 'جاري التحميل...' : 'Loading integrations...'}</p>
        </div>
      </div>
    );
  }

  const platforms: { value: Platform; label: string; desc: string; icon: React.ReactNode; color: string; activeGradient: string; iconBg: string; connected: boolean; status: string | null }[] = [
    { value: 'facebook', label: 'Facebook', desc: isRTL ? 'ماسنجر' : 'Messenger',
      icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400',
      activeGradient: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-blue-500/40 dark:border-blue-400/30',
      iconBg: 'bg-blue-100 dark:bg-blue-500/20',
      connected: !!fbStatus?.connected, status: fbStatus?.pageName || null },
    { value: 'instagram', label: 'Instagram', desc: isRTL ? 'الرسائل المباشرة' : 'Direct Messages',
      icon: <Instagram className="w-5 h-5" />, color: 'text-pink-600 dark:text-pink-400',
      activeGradient: 'from-pink-500/10 to-fuchsia-600/5 dark:from-pink-500/20 dark:to-fuchsia-600/10 border-pink-500/40 dark:border-pink-400/30',
      iconBg: 'bg-pink-100 dark:bg-pink-500/20',
      connected: !!(fbStatus?.instagramConnected || settings.instagramUsingPlatform || settings.instagramTokenConfigured), status: fbStatus?.instagramUsername ? `@${fbStatus.instagramUsername}` : null },
    { value: 'telegram', label: 'Telegram', desc: isRTL ? 'بوت المحادثة' : 'Chat Bot',
      icon: <Send className="w-5 h-5" />, color: 'text-sky-600 dark:text-sky-400',
      activeGradient: 'from-sky-500/10 to-cyan-600/5 dark:from-sky-500/20 dark:to-cyan-600/10 border-sky-500/40 dark:border-sky-400/30',
      iconBg: 'bg-sky-100 dark:bg-sky-500/20',
      connected: !!(settings.telegramTokenConfigured || settings.telegramUsingPlatform), status: settings.telegramBotUsername ? `@${settings.telegramBotUsername}` : null },
    { value: 'whatsapp_cloud', label: 'WhatsApp', desc: isRTL ? 'واتساب سحابي' : 'Cloud API',
      icon: <Phone className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400',
      activeGradient: 'from-emerald-500/10 to-green-600/5 dark:from-emerald-500/20 dark:to-green-600/10 border-emerald-500/40 dark:border-emerald-400/30',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
      connected: !!settings.whatsappTokenConfigured, status: null },
    { value: 'viber', label: 'Viber', desc: isRTL ? 'رسائل فايبر' : 'Viber Messages',
      icon: <Smartphone className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400',
      activeGradient: 'from-violet-500/10 to-purple-600/5 dark:from-violet-500/20 dark:to-purple-600/10 border-violet-500/40 dark:border-violet-400/30',
      iconBg: 'bg-violet-100 dark:bg-violet-500/20',
      connected: !!(settings.viberAuthToken || settings.viberUsingPlatform), status: null },
  ];

  const activePlatformData = platforms.find(p => p.value === activePlatform)!;

  // Reusable platform mode toggle
  const PlatformModeToggle = ({ available, showAdvanced, setShowAdvanced }: { available?: boolean; showAdvanced: boolean; setShowAdvanced: (fn: (v: boolean) => boolean) => void }) => {
    if (!available) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06]">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            !showAdvanced ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-amber-100 dark:bg-amber-500/20'
          }`}>
            {!showAdvanced ? <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Unplug className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {!showAdvanced ? (isRTL ? 'وضع المنصة' : 'Platform Mode') : (isRTL ? 'وضع مخصص' : 'Custom Mode')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {!showAdvanced
                ? (isRTL ? 'EcoPro يدير هذه المنصة تلقائياً' : 'EcoPro manages this platform automatically')
                : (isRTL ? 'أدخل بيانات البوت الخاص بك' : 'Enter your own bot credentials')}
            </p>
          </div>
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 active:scale-95">
            {showAdvanced ? (isRTL ? 'استخدام بوت المنصة' : 'Use Platform Bot') : (isRTL ? 'استخدام بوتي الخاص' : 'Use My Own Bot')}
          </button>
        </div>
        {!showAdvanced && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/80 dark:border-emerald-500/20">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {isRTL ? 'EcoPro سيستخدم البوت الخاص بالمنصة لمتجرك.' : 'EcoPro will use its own bot for your store.'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Delay / expiry settings row — reused across all platforms
  const DelaySettings = ({ delayKey, delayValue }: { delayKey: string; delayValue: number }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'تأخير الرسالة (دقائق)' : 'Message Delay (min)'}</Label>
        <Input type="number" min={0} max={60} value={delayValue}
          className="h-11 rounded-xl"
          onChange={(e) => updateSetting(delayKey, parseInt(e.target.value, 10) || 5)} placeholder="5" />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'انتهاء تلقائي (ساعات)' : 'Auto-expire (hours)'}</Label>
        <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
          className="h-11 rounded-xl"
          onChange={(e) => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} placeholder="24" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-gray-100 transition-colors duration-300">
      {/* ── Mobile: app-like top bar ── */}
      <div className="lg:hidden sticky top-0 z-20 bg-white/80 dark:bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06] px-4 pt-4 pb-3 -mx-px">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">{isRTL ? 'ربط المنصات' : 'Integrations'}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{isRTL ? 'اربط منصات التواصل' : 'Connect your platforms'}</p>
            </div>
          </div>
        </div>
        {/* Horizontal scrollable platform pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {platforms.map(p => (
            <button key={p.value} onClick={() => setActivePlatform(p.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border whitespace-nowrap transition-all active:scale-95 shrink-0 ${
                activePlatform === p.value
                  ? `bg-gradient-to-r ${p.activeGradient} shadow-sm`
                  : p.connected
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-500/[0.06]'
                    : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-white/[0.03]'
              }`}>
              {p.connected && activePlatform !== p.value && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
              <span className={activePlatform === p.value ? p.color : 'text-slate-500 dark:text-slate-400'}>{p.icon}</span>
              <span className={`text-xs font-bold ${activePlatform === p.value ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Desktop & Mobile content ── */}
      <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Desktop header — hidden on mobile */}
        <div className="hidden lg:flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{isRTL ? 'ربط المنصات' : 'Integrations'}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{isRTL ? 'اربط منصات التواصل الاجتماعي لاستقبال الرسائل تلقائياً' : 'Connect social platforms to receive messages automatically'}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold flex items-center gap-2.5 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
          {/* ── Desktop sidebar: platform list ── */}
          <div className="hidden lg:flex flex-col gap-2 w-[260px] shrink-0">
            {platforms.map(p => {
              const isActive = activePlatform === p.value;
              return (
                <button key={p.value} onClick={() => setActivePlatform(p.value)}
                  className={`group flex items-center gap-3.5 w-full p-3.5 rounded-2xl border text-start transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-r ${p.activeGradient} shadow-sm`
                      : p.connected
                        ? 'border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-500/[0.04] hover:bg-emerald-50/80 dark:hover:bg-emerald-500/[0.08]'
                        : 'border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.1]'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? p.iconBg : p.connected ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-slate-100 dark:bg-white/[0.06] group-hover:bg-slate-200/70 dark:group-hover:bg-white/[0.08]'
                  }`}>
                    <span className={isActive ? p.color : p.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'}>
                      {p.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{p.label}</p>
                      {p.connected && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <Check className="w-2.5 h-2.5" />{isRTL ? 'متصل' : 'On'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {p.status || p.desc}
                    </p>
                  </div>
                  {isActive && (
                    <div className={`w-1.5 h-8 rounded-full ${p.iconBg}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Settings panel ── */}
          <div className="flex-1 min-w-0">
            {/* Platform header inside settings panel */}
            <div className={`p-5 rounded-2xl bg-gradient-to-r ${activePlatformData.activeGradient} mb-4`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${activePlatformData.iconBg} flex items-center justify-center`}>
                  <span className={activePlatformData.color}>{activePlatformData.icon}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{activePlatformData.label}</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{activePlatformData.desc}</p>
                </div>
                {activePlatformData.connected && (
                  <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5" />{isRTL ? 'متصل' : 'Connected'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* ── Facebook ── */}
              {activePlatform === 'facebook' && (
                <>
                  {fbLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  ) : fbStatus?.connected ? (
                    <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/80 dark:border-emerald-500/20">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                            {t('platforms.facebook.connectedTo')} <strong>{fbStatus.pageName}</strong>
                          </p>
                          {fbStatus.instagramConnected && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                              <Instagram className="w-3.5 h-3.5" />
                              Instagram: {fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : t('platforms.connected')}
                            </p>
                          )}
                          {!fbStatus.instagramConnected && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <Instagram className="w-3.5 h-3.5" />
                              {isRTL ? 'Instagram غير مربوط — تأكد أن صفحتك مربوطة بحساب Instagram Business' : 'Instagram not linked — make sure your Page is linked to an Instagram Business account'}
                            </p>
                          )}
                          {fbStatus.tokenExpiresAt && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              {t('platforms.facebook.tokenExpires')}: {new Date(fbStatus.tokenExpiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm"
                          className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 shrink-0 h-10 px-4"
                          onClick={disconnectFacebook} disabled={fbDisconnecting}>
                          {fbDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                          <span className="mx-1.5">{t('platforms.disconnect')}</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                      <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-blue-500" />
                      </div>
                      <p className="text-sm font-bold mb-1">{t('platforms.facebook.notConnected')}</p>
                      <p className="text-xs text-slate-500 max-w-sm text-center mb-5">{t('platforms.facebook.connectHint')}</p>
                      <Button
                        className="h-11 px-8 rounded-2xl font-bold text-white bg-[#1877F2] hover:bg-[#166FE5] shadow-lg shadow-blue-500/20 gap-2.5 text-sm active:scale-[0.98] transition-all"
                        onClick={connectFacebook} disabled={fbConnecting}>
                        {fbConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {t('platforms.facebook.connectBtn')}
                      </Button>
                    </div>
                  )}

                  {/* Page picker */}
                  {showPagePicker && fbPages.length > 0 && (
                    <div className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 overflow-hidden">
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-950/20">
                        <p className="text-sm font-bold">{t('platforms.facebook.selectPage')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t('platforms.facebook.selectPageDesc')}</p>
                      </div>
                      <div className="p-4 space-y-2">
                        {fbPages.map((page) => (
                          <button key={page.id} onClick={() => setSelectedPageId(page.id)}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-start active:scale-[0.98] ${
                              selectedPageId === page.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                            }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              selectedPageId === page.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              <MessageSquare className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold">{page.name}</p>
                              {page.hasInstagram && (
                                <p className="text-xs text-pink-600 flex items-center gap-1 mt-0.5">
                                  <Instagram className="w-3 h-3" /> Instagram {t('platforms.connected')}
                                </p>
                              )}
                            </div>
                            {selectedPageId === page.id && <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />}
                          </button>
                        ))}
                        <Button className="w-full h-11 rounded-2xl font-bold mt-3 bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2.5 text-sm"
                          disabled={!selectedPageId || savingPage} onClick={selectFbPage}>
                          {savingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          {t('platforms.facebook.confirmPage')}
                        </Button>
                      </div>
                    </div>
                  )}

                  <PlatformModeToggle available={settings.platformMessengerAvailable} showAdvanced={showMessengerAdvanced} setShowAdvanced={setShowMessengerAdvanced} />
                  {(showMessengerAdvanced || !settings.platformMessengerAvailable) && (
                    <>
                      <div className="relative py-3">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
                        <div className="relative flex justify-center">
                          <button type="button" onClick={() => setShowFacebookManual(v => !v)}
                            className="px-4 py-1.5 bg-white dark:bg-[#0a0e1a] rounded-full text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700">
                            {showFacebookManual ? (isRTL ? 'إخفاء الإعدادات اليدوية' : 'Hide manual setup') : (isRTL ? 'أو أدخل البيانات يدوياً' : 'Or enter credentials manually')}
                          </button>
                        </div>
                      </div>
                      {showFacebookManual && (
                        <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                          <p className="text-xs text-slate-500">
                            {isRTL ? 'أدخل معرّف صفحة فيسبوك ورمز وصول الصفحة من Meta Developer Dashboard.' : 'Enter your Facebook Page ID and Page Access Token from Meta Developer Dashboard.'}
                          </p>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'معرّف صفحة فيسبوك' : 'Facebook Page ID'}</Label>
                            <Input className="h-11 rounded-xl" value={settings.fbPageId || ''} onChange={(e) => updateSetting('fbPageId', e.target.value)} placeholder="e.g. 123456789012345" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'رمز وصول الصفحة' : 'Page Access Token'}</Label>
                            <Input className="h-11 rounded-xl" type="password" value={settings.fbPageAccessToken || ''} onChange={(e) => updateSetting('fbPageAccessToken', e.target.value)} placeholder="Paste page access token" />
                            {settings.fbPageAccessTokenConfigured && !String(settings.fbPageAccessToken || '').trim() && (
                              <p className="text-[11px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <DelaySettings delayKey="messengerDelayMinutes" delayValue={settings.messengerDelayMinutes ?? 5} />
                </>
              )}

              {/* ── Instagram ── */}
              {activePlatform === 'instagram' && (
                <>
                  <PlatformModeToggle available={settings.platformInstagramAvailable} showAdvanced={showInstagramAdvanced} setShowAdvanced={setShowInstagramAdvanced} />
                  {showInstagramAdvanced && (
                    fbLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                      </div>
                    ) : fbStatus?.connected && fbStatus?.instagramConnected ? (
                      <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/80 dark:border-emerald-500/20">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <Instagram className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                              {fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : 'Instagram Business'}
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">
                              {isRTL ? 'مربوط عبر فيسبوك — الرسائل المباشرة يتم الرد عليها تلقائياً بالذكاء الاصطناعي' : 'Connected via Facebook — DMs are auto-replied by AI'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm"
                            className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 shrink-0 h-10 px-4"
                            onClick={disconnectFacebook} disabled={fbDisconnecting}>
                            {fbDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                            <span className="mx-1.5">{t('platforms.disconnect')}</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 px-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="w-16 h-16 rounded-3xl bg-pink-100 dark:bg-pink-500/15 flex items-center justify-center mb-4">
                          <Instagram className="w-8 h-8 text-pink-500" />
                        </div>
                        <p className="text-sm font-bold mb-1">
                          {isRTL ? 'غير متصل بـ Instagram' : 'Not connected to Instagram'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-sm text-center">
                          {isRTL
                            ? 'يرجى الاتصال أولاً بحساب فيسبوك من علامة التبويب "فيسبوك". سيتم اكتشاف Instagram تلقائياً.'
                            : 'Please connect your Facebook account first from the "Facebook" tab. Instagram will be auto-detected.'}
                        </p>
                      </div>
                    )
                  )}

                  {showInstagramAdvanced && (
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                      <p className="text-xs text-slate-500">
                        {isRTL ? 'أدخل معرّف حساب Instagram Business ورمز وصول الصفحة المرتبطة من Meta Developer Dashboard.' : 'Enter your Instagram Business Account ID and the linked Page Access Token from Meta Developer Dashboard.'}
                      </p>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{isRTL ? 'معرّف حساب Instagram' : 'Instagram Account ID'}</Label>
                        <Input className="h-11 rounded-xl" value={settings.instagramAccountId || ''} onChange={(e) => updateSetting('instagramAccountId', e.target.value)} placeholder="e.g. 17841400123456789" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{isRTL ? 'رمز وصول الصفحة' : 'Page Access Token'}</Label>
                        <Input className="h-11 rounded-xl" type="password" value={settings.instagramPageAccessToken || ''} onChange={(e) => updateSetting('instagramPageAccessToken', e.target.value)} placeholder="Paste page access token" />
                        {settings.instagramTokenConfigured && !String(settings.instagramPageAccessToken || '').trim() && (
                          <p className="text-[11px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <DelaySettings delayKey="messengerDelayMinutes" delayValue={settings.messengerDelayMinutes ?? 5} />
                </>
              )}

              {/* ── Telegram ── */}
              {activePlatform === 'telegram' && (
                <>
                  <PlatformModeToggle available={settings.platformTelegramAvailable} showAdvanced={showTelegramAdvanced} setShowAdvanced={setShowTelegramAdvanced} />
                  {(showTelegramAdvanced || !settings.platformTelegramAvailable) && (
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.telegramBotToken')}</Label>
                        <Input className="h-11 rounded-xl" type="password" value={settings.telegramBotToken || ''} onChange={(e) => updateSetting('telegramBotToken', e.target.value)} placeholder="123456:ABCDEF..." />
                        {settings.telegramTokenConfigured && !String(settings.telegramBotToken || '').trim() && (
                          <p className="text-[11px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.telegramBotUsername')}</Label>
                        <Input className="h-11 rounded-xl" value={settings.telegramBotUsername || ''} onChange={(e) => updateSetting('telegramBotUsername', e.target.value)} placeholder="@YourBotUsername" />
                      </div>
                    </div>
                  )}
                  <DelaySettings delayKey="telegramDelayMinutes" delayValue={settings.telegramDelayMinutes ?? 5} />
                </>
              )}

              {/* ── WhatsApp ── */}
              {activePlatform === 'whatsapp_cloud' && (
                <>
                  <PlatformModeToggle available={settings.platformWhatsappAvailable} showAdvanced={showWhatsappAdvanced} setShowAdvanced={setShowWhatsappAdvanced} />
                  {(showWhatsappAdvanced || !settings.platformWhatsappAvailable) && (
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.whatsappPhoneId')}</Label>
                        <Input className="h-11 rounded-xl" value={settings.whatsappPhoneId || ''} onChange={(e) => updateSetting('whatsappPhoneId', e.target.value)} placeholder="e.g. 123456789012345" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.whatsappAccessToken')}</Label>
                        <Input className="h-11 rounded-xl" type="password" value={settings.whatsappToken || ''} onChange={(e) => updateSetting('whatsappToken', e.target.value)} placeholder="Paste access token" />
                        {settings.whatsappTokenConfigured && !String(settings.whatsappToken || '').trim() && (
                          <p className="text-[11px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <DelaySettings delayKey="whatsappDelayMinutes" delayValue={(settings as any).whatsappDelayMinutes ?? 5} />
                </>
              )}

              {/* ── Viber ── */}
              {activePlatform === 'viber' && (
                <>
                  <PlatformModeToggle available={settings.platformViberAvailable} showAdvanced={showViberAdvanced} setShowAdvanced={setShowViberAdvanced} />
                  {(showViberAdvanced || !settings.platformViberAvailable) && (
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.viberAuthToken')}</Label>
                        <Input className="h-11 rounded-xl" value={settings.viberAuthToken || ''} onChange={(e) => updateSetting('viberAuthToken', e.target.value)} placeholder="viber-auth-token" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('bot.viberSenderName')}</Label>
                        <Input className="h-11 rounded-xl" value={settings.viberSenderName || ''} onChange={(e) => updateSetting('viberSenderName', e.target.value)} placeholder="Sahla4Eco" />
                      </div>
                    </div>
                  )}
                  <DelaySettings delayKey="viberDelayMinutes" delayValue={(settings as any).viberDelayMinutes ?? 5} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom save bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-white/90 dark:bg-[#0a0e1a]/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-white/[0.06] safe-area-bottom">
        <button onClick={handleSave} disabled={saving}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</> : <><Save className="h-4 w-4" />{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</>}
        </button>
      </div>
      {/* Bottom padding to prevent content from being hidden behind mobile save bar */}
      <div className="lg:hidden h-20" />
    </div>
  );
}
