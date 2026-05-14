import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle, CheckCircle2, CheckCircle, XCircle, WifiOff, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type Platform = 'facebook' | 'instagram' | 'telegram' | 'whatsapp_cloud' | 'viber';

interface BotSettings {
  provider: string;
  telegramBotToken?: string;
  telegramTokenConfigured?: boolean;
  telegramBotUsername?: string;
  telegramDelayMinutes?: number;
  platformTelegramAvailable?: boolean;
  usePlatformTelegram?: boolean;
  telegramUsingPlatform?: boolean;
  whatsappPhoneId?: string;
  whatsappToken?: string;
  whatsappTokenConfigured?: boolean;
  whatsappDelayMinutes?: number;
  platformWhatsappAvailable?: boolean;
  usePlatformWhatsapp?: boolean;
  fbPageId?: string;
  fbPageAccessToken?: string;
  fbPageAccessTokenConfigured?: boolean;
  messengerDelayMinutes?: number;
  platformMessengerAvailable?: boolean;
  usePlatformMessenger?: boolean;
  messengerUsingPlatform?: boolean;
  messengerEnabled?: boolean;
  instagramAccountId?: string;
  instagramPageAccessToken?: string;
  instagramTokenConfigured?: boolean;
  platformInstagramAvailable?: boolean;
  usePlatformInstagram?: boolean;
  viberAuthToken?: string;
  viberSenderName?: string;
  viberDelayMinutes?: number;
  platformViberAvailable?: boolean;
  usePlatformViber?: boolean;
  autoExpireHours?: number;
}

interface PlatformDef { value: Platform; label: string; desc: string; bgColor: string; }

const ICONS: Record<Platform, () => JSX.Element> = {
  facebook:       () => <svg width="20" height="20" viewBox="0 0 640 640" fill="currentColor"><path d="M240 363.3V576h116V363.3h86.5l18-97.8H356v-34.6c0-51.7 20.3-71.5 72.7-71.5 16.3 0 29.4.4 37 1.2V71.9C451.4 68 416.4 64 396.2 64 289.3 64 240 114.5 240 223.4v42.1h-66v97.8h66z"/></svg>,
  instagram:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  telegram:       () => <svg width="20" height="20" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm115 168.9-41.9 197.5c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 115.3-104.2c5-4.4-1.1-6.9-7.7-2.5L134.7 319.9l-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l238.3-91.9c11.1-4 20.8 2.7 17.4 19.7z"/></svg>,
  whatsapp_cloud: () => <svg width="20" height="20" viewBox="0 0 448 512" fill="currentColor"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>,
  viber:          () => <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor"><path d="M444 49.9C431.3 38.2 379.9.9 265.3.4c0 0-135.1-8.1-200.9 52.3C27.8 89.3 14.9 143 13.5 209.5c-1.4 66.5-3.1 191.1 117 224.9h.1l-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5z"/></svg>,
};

const PLATFORM_DEFS: PlatformDef[] = [
  { value: 'facebook',       label: 'Facebook',  desc: 'Messenger',      bgColor: '#1877F2' },
  { value: 'instagram',      label: 'Instagram', desc: 'Instagram DMs',  bgColor: '#E4405F' },
  { value: 'telegram',       label: 'Telegram',  desc: 'Chat Bot',       bgColor: '#08c'    },
  { value: 'whatsapp_cloud', label: 'WhatsApp',  desc: 'Cloud API',      bgColor: '#25D366' },
  { value: 'viber',          label: 'Viber',     desc: 'Coming Soon',    bgColor: '#7360F2' },
];

export default function Integrations() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbSavingPage, setFbSavingPage] = useState(false);
  const [fbPages, setFbPages] = useState<{ id: string; name: string; hasInstagram: boolean }[]>([]);
  const [fbShowPagePicker, setFbShowPagePicker] = useState(false);
  const [fbSelectedPageId, setFbSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('telegram');
  const [pingDetail, setPingDetail] = useState<Record<Platform, { errorType?: string } | null>>({
    telegram: null, facebook: null, instagram: null, whatsapp_cloud: null, viber: null,
  });
  const [pingState, setPingState] = useState<Record<Platform, 'idle' | 'loading' | 'ok' | 'fail' | 'warn'>>({
    telegram: 'idle', facebook: 'idle', instagram: 'idle', whatsapp_cloud: 'idle', viber: 'idle',
  });
  const savedSettingsRef = useRef<BotSettings | null>(null);
  const [settings, setSettings] = useState<BotSettings>({ provider: 'telegram', autoExpireHours: 24 });

  useEffect(() => { loadSettings(false); }, []);

  useEffect(() => {
    const fb = params.get("fb");
    if (fb === "connected") {
      toast({ title: isRTL ? "تم الربط بـ Facebook" : "Facebook Connected", description: isRTL ? "تم ربط الصفحة بنجاح" : "Page linked successfully" });
      params.delete("fb"); setParams(params, { replace: true }); loadSettings(true);
    } else if (fb === "select-page") {
      loadFbPages(); params.delete("fb"); setParams(params, { replace: true });
    } else if (fb === "error") {
      toast({ title: isRTL ? "فشل الربط" : "Connection Failed", variant: "destructive" });
      params.delete("fb"); setParams(params, { replace: true });
    }
  }, [params]);

  async function connectFacebook() {
    try {
      setFbConnecting(true);
      const data = await apiFetch<{ url: string }>("/api/facebook/auth-url");
      if (data?.url) window.location.href = data.url;
    } catch {
      toast({ title: isRTL ? "خطأ في الاتصال" : "Connection Error", variant: "destructive" });
      setFbConnecting(false);
    }
  }

  async function loadFbPages() {
    try {
      const data = await apiFetch<{ pages: { id: string; name: string; hasInstagram: boolean }[] }>("/api/facebook/pages");
      if (data?.pages?.length) { setFbPages(data.pages); setFbShowPagePicker(true); }
    } catch { toast({ title: isRTL ? "فشل تحميل الصفحات" : "Failed to load pages", variant: "destructive" }); }
  }

  async function selectFbPage() {
    if (!fbSelectedPageId) return;
    try {
      setFbSavingPage(true);
      const data = await apiFetch<{ success: boolean; pageName: string }>("/api/facebook/select-page", { method: "POST", body: JSON.stringify({ pageId: fbSelectedPageId }) });
      if (data?.success) { setFbShowPagePicker(false); setFbPages([]); toast({ title: isRTL ? "تم الربط" : "Connected", description: data.pageName }); loadSettings(true); }
    } catch { toast({ title: isRTL ? "فشل الحفظ" : "Failed to save page", variant: "destructive" }); }
    finally { setFbSavingPage(false); }
  }

  const loadSettings = async (background = false) => {
    if (!background) setLoading(true); else setRefreshing(true);
    try {
      const response = await fetch('/api/bot/settings');
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `HTTP ${response.status}`);
      const data = await response.json();
      setSettings(data); savedSettingsRef.current = data;
      if (data?.provider) setActivePlatform(data.provider as Platform);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load", variant: "destructive" });
    } finally { if (!background) setLoading(false); else setRefreshing(false); }
  };

  const updateSetting = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  async function saveSettings(payload: any, platformName: string) {
    setSaving(platformName);
    try {
      if (payload.whatsappPhoneId && payload.whatsappToken) {
        try {
          const test = await fetch('/api/whatsapp/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneId: payload.whatsappPhoneId, token: payload.whatsappToken }) });
          const testData = await test.json();
          if (!testData.success) console.warn('[Integrations] WhatsApp test failed:', testData.error);
        } catch (e) { console.warn('[Integrations] WhatsApp test error:', e); }
      }
      const response = await fetch('/api/bot/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to save');
      const result = await response.json().catch(() => ({}));
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
      if (result?.webhookWarning) toast({ title: isRTL ? 'تحذير Webhook' : 'Webhook Warning', description: result.webhookWarning, variant: 'destructive' });
      const currentPlatform = activePlatform;
      await loadSettings(true);
      setActivePlatform(currentPlatform);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save", variant: "destructive" });
    } finally { setSaving(null); }
  }

  async function pingPlatform(platform: Platform) {
    setPingState(prev => ({ ...prev, [platform]: 'loading' }));
    try {
      let data: any = {};
      if (platform === 'whatsapp_cloud') {
        const r = await fetch('/api/whatsapp/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneId: settings.whatsappPhoneId, token: settings.whatsappToken }) });
        data = await r.json();
      } else {
        const r = await fetch('/api/bot/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) });
        data = await r.json();
      }
      const ok = data.success === true;
      const state: 'ok' | 'fail' | 'warn' = ok ? 'ok' : data.errorType === 'missing_permissions' ? 'warn' : 'fail';
      setPingState(prev => ({ ...prev, [platform]: state }));
      setPingDetail(prev => ({ ...prev, [platform]: ok ? null : { errorType: data.errorType } }));
      if (ok) toast({ title: isRTL ? 'يعمل! ✓' : 'Working! ✓', description: data.pageName || data.botName || '' });
      else toast({ title: isRTL ? 'فشل الاختبار' : 'Test Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      setTimeout(() => setPingState(prev => ({ ...prev, [platform]: 'idle' })), 8000);
    } catch {
      setPingState(prev => ({ ...prev, [platform]: 'fail' }));
      setTimeout(() => setPingState(prev => ({ ...prev, [platform]: 'idle' })), 4000);
    }
  }

  function handleUsePlatformBot(platform: Platform) {
    const payload: Record<string, any> = { provider: platform };
    if (platform === 'telegram') payload.usePlatformTelegram = true;
    else if (platform === 'facebook') { payload.usePlatformMessenger = true; payload.messengerEnabled = true; }
    saveSettings(payload, platform);
  }

  async function handleDisconnect(platform: Platform) {
    if (platform === 'facebook' || platform === 'instagram') {
      setSaving(platform);
      try {
        await apiFetch('/api/facebook/disconnect', { method: 'POST' });
        toast({ title: isRTL ? 'تم إلغاء الربط' : 'Disconnected' });
        await loadSettings(true);
      } catch {
        toast({ title: isRTL ? 'فشل إلغاء الربط' : 'Disconnect failed', variant: 'destructive' });
      } finally { setSaving(null); }
      return;
    }
    const payload: Record<string, any> = { provider: platform };
    if (platform === 'telegram') { payload.telegramBotToken = ''; payload.telegramBotUsername = ''; payload.usePlatformTelegram = false; }
    else if (platform === 'whatsapp_cloud') { payload.whatsappToken = ''; payload.whatsappPhoneId = ''; payload.usePlatformWhatsapp = false; }
    else if (platform === 'viber') { payload.viberAuthToken = ''; payload.usePlatformViber = false; }
    saveSettings(payload, platform);
  }

  function isUsingPlatform(platform: Platform) {
    if (platform === 'facebook') return !!(settings.usePlatformMessenger || settings.messengerUsingPlatform);
    if (platform === 'telegram') return !!(settings.usePlatformTelegram || settings.telegramUsingPlatform);
    return false;
  }

  function isConnected(platform: Platform) {
    if (platform === 'facebook') return !!(settings.fbPageAccessTokenConfigured && !settings.messengerUsingPlatform) || !!(settings.usePlatformMessenger || settings.messengerUsingPlatform);
    if (platform === 'instagram') return !!(settings.instagramTokenConfigured || settings.usePlatformInstagram);
    if (platform === 'telegram') return !!(settings.telegramTokenConfigured || settings.telegramUsingPlatform);
    if (platform === 'whatsapp_cloud') return !!settings.whatsappTokenConfigured;
    if (platform === 'viber') return !!settings.viberAuthToken;
    return false;
  }

  const plat = PLATFORM_DEFS.find(p => p.value === activePlatform)!;
  const connected = isConnected(activePlatform);
  const usingPlatform = isUsingPlatform(activePlatform);
  const ping = pingState[activePlatform];
  const isViber = activePlatform === 'viber';

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        </div>
        <p className="text-sm font-medium text-slate-500">{isRTL ? 'جاري التحميل...' : 'Loading integrations...'}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{isRTL ? 'ربط المنصات' : 'Integrations'}</h1>
            <p className="text-sm text-slate-500">{isRTL ? 'اربط منصات المراسلة للرد التلقائي بالذكاء الاصطناعي' : 'Connect messaging platforms for AI-powered auto-replies'}</p>
          </div>
        </div>
        {refreshing && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Platform Tabs */}
      <div className="grid grid-cols-5 gap-3">
        {PLATFORM_DEFS.map(p => {
          const c = isConnected(p.value);
          const active = activePlatform === p.value;
          const vib = p.value === 'viber';
          return (
            <button key={p.value} onClick={() => setActivePlatform(p.value)}
              className={`relative p-4 rounded-2xl border-2 text-center transition-all ${
                active ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm'
                : c     ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              {c && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />}
              {vib && <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-slate-400 text-white text-[8px] font-bold whitespace-nowrap">{isRTL ? 'قريباً' : 'Soon'}</span>}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: p.bgColor, opacity: vib ? 0.5 : 1 }}>
                <span className="text-white">{ICONS[p.value]()}</span>
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.label}</p>
              <p className={`text-[10px] mt-0.5 font-medium ${active ? 'text-indigo-500' : c ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {vib ? (isRTL ? 'قريباً' : 'Soon') : c ? (isRTL ? 'متصل' : 'Connected') : (isRTL ? 'غير متصل' : 'Not connected')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Settings Panel */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">

        {/* Panel Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: plat.bgColor, opacity: isViber ? 0.6 : 1 }}>
            <span className="text-white">{ICONS[plat.value]()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{plat.label}</h2>
              {isViber ? (
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400">🚧 {isRTL ? 'قريباً' : 'Coming Soon'}</span>
              ) : connected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />{isRTL ? 'متصل' : 'Connected'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                  <WifiOff className="w-3 h-3" />{isRTL ? 'غير متصل' : 'Not connected'}
                </span>
              )}
              {ping === 'ok'   && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3" />{isRTL ? 'يعمل!' : 'Working!'}</span>}
              {ping === 'warn' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-600"><AlertTriangle className="w-3 h-3" />{isRTL ? 'أذونات ناقصة' : 'Missing permissions'}</span>}
              {ping === 'fail' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-[10px] font-bold text-red-600"><XCircle className="w-3 h-3" />{isRTL ? 'لا يستجيب' : 'Not responding'}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{plat.desc}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected && !isViber && !usingPlatform && (
              <button onClick={() => pingPlatform(activePlatform)} disabled={ping === 'loading'}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1.5">
                {ping === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                {isRTL ? 'اختبار' : 'Test'}
              </button>
            )}
            {connected && !isViber && (
              <button onClick={() => handleDisconnect(activePlatform)} disabled={saving === activePlatform}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5">
                {saving === activePlatform ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isRTL ? 'إلغاء الربط' : 'Disconnect'}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* Viber — coming soon */}
          {isViber && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-3">🚧</p>
              <p className="font-semibold text-slate-600 dark:text-slate-300">{isRTL ? 'قريباً' : 'Coming Soon'}</p>
              <p className="text-sm mt-1">{isRTL ? 'دعم Viber قيد التطوير' : 'Viber integration is under development'}</p>
            </div>
          )}

          {/* Connected state banner */}
          {!isViber && connected && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {isRTL ? 'متصل وجاهز' : 'Connected & Ready'}
                  {usingPlatform && <span className="mr-2 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{isRTL ? 'بوت المنصة' : 'Platform Bot'}</span>}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {usingPlatform
                    ? (isRTL ? 'EcoPro يدير البوت تلقائياً.' : 'EcoPro manages the bot automatically.')
                    : (isRTL ? 'بياناتك محفوظة وآمنة.' : 'Your credentials are saved and active.')}
                </p>
              </div>
            </div>
          )}

          {/* Missing permissions warning */}
          {pingDetail[activePlatform]?.errorType === 'missing_permissions' && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {isRTL
                  ? 'الرمز صالح لكن تطبيق Meta يفتقر للأذونات. أضف: pages_messaging، pages_read_engagement، pages_manage_metadata من App Review.'
                  : 'Token is valid but Meta App is missing permissions. Add: pages_messaging, pages_read_engagement, pages_manage_metadata from App Review.'}
              </p>
            </div>
          )}

          {/* ── FACEBOOK ── */}
          {activePlatform === 'facebook' && !connected && (
            <div className="space-y-4">
              <Button onClick={connectFacebook} disabled={fbConnecting}
                className="w-full h-12 rounded-xl font-bold text-white text-base bg-[#1877F2] hover:bg-[#166FE5] shadow gap-2">
                {fbConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <svg width="20" height="20" viewBox="0 0 640 640" fill="white"><path d="M240 363.3V576h116V363.3h86.5l18-97.8H356v-34.6c0-51.7 20.3-71.5 72.7-71.5 16.3 0 29.4.4 37 1.2V71.9C451.4 68 416.4 64 396.2 64 289.3 64 240 114.5 240 223.4v42.1h-66v97.8h66z"/></svg>
                )}
                {isRTL ? 'الاتصال بـ Facebook' : 'Connect with Facebook'}
              </Button>

              {/* Page Picker */}
              {fbShowPagePicker && fbPages.length > 0 && (
                <div className="rounded-xl border-2 border-blue-300 dark:border-blue-700 overflow-hidden">
                  <div className="px-4 py-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{isRTL ? 'اختر الصفحة' : 'Select a Page'}</p>
                    <p className="text-xs text-slate-500">{isRTL ? 'اختر الصفحة التي تريد ربطها' : 'Choose which page to connect'}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {fbPages.map(page => (
                      <button key={page.id} onClick={() => setFbSelectedPageId(page.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${
                          fbSelectedPageId === page.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                        }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${fbSelectedPageId === page.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          <svg width="16" height="16" viewBox="0 0 640 640" fill="currentColor"><path d="M240 363.3V576h116V363.3h86.5l18-97.8H356v-34.6c0-51.7 20.3-71.5 72.7-71.5 16.3 0 29.4.4 37 1.2V71.9C451.4 68 416.4 64 396.2 64 289.3 64 240 114.5 240 223.4v42.1h-66v97.8h66z"/></svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{page.name}</p>
                          {page.hasInstagram && <p className="text-[10px] text-pink-500 font-semibold">{isRTL ? '+ Instagram مربوط' : '+ Instagram linked'}</p>}
                        </div>
                        {fbSelectedPageId === page.id && <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />}
                      </button>
                    ))}
                    <Button className="w-full h-10 rounded-xl font-bold mt-1 bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2"
                      disabled={!fbSelectedPageId || fbSavingPage} onClick={selectFbPage}>
                      {fbSavingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      {isRTL ? 'تأكيد الاختيار' : 'Confirm Selection'}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── INSTAGRAM ── */}
          {activePlatform === 'instagram' && (
            <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{isRTL ? 'ربط Instagram عبر Facebook' : 'Connect Instagram via Facebook'}</p>
                <p className="text-xs text-slate-500">{isRTL ? 'إذا كانت صفحة Facebook مرتبطة بحساب Instagram، سيتم ربطه تلقائياً عند ربط Facebook.' : 'If your Facebook Page is linked to an Instagram Business account, it connects automatically when you connect Facebook.'}</p>
              </div>
              <Button onClick={connectFacebook} disabled={fbConnecting}
                className="w-full h-11 rounded-xl font-bold text-white bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 gap-2">
                {fbConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 5.838c-2.209 0-4 1.791-4 4s1.791 4 4 4 4-1.791 4-4-1.791-4-4-4zm0 6.162c-1.205 0-2.162-.957-2.162-2.162s.957-2.162 2.162-2.162 2.162.957 2.162 2.162-.957 2.162-2.162 2.162zm5.406-7.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                )}
                {isRTL ? 'ربط عبر Facebook' : 'Connect via Facebook'}
              </Button>
            </div>
          )}

          {/* ── TELEGRAM ── */}
          {activePlatform === 'telegram' && (!connected || usingPlatform) && (
            <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{isRTL ? 'بيانات البوت' : 'Bot Credentials'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('bot.telegramBotToken')}</Label>
                  <Input className="h-10 rounded-lg" type="password" value={settings.telegramBotToken || ''} onChange={e => updateSetting('telegramBotToken', e.target.value)} placeholder="123456:ABCDEF..." />
                  {settings.telegramTokenConfigured && !settings.telegramBotToken?.trim() && <p className="text-[10px] text-slate-400">{t('bot.tokenSavedHidden')}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('bot.telegramBotUsername')}</Label>
                  <Input className="h-10 rounded-lg" value={settings.telegramBotUsername || ''} onChange={e => updateSetting('telegramBotUsername', e.target.value)} placeholder="@YourBotUsername" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => {
                  if (!settings.telegramBotToken?.trim()) { toast({ title: isRTL ? 'أدخل رمز البوت' : 'Enter bot token', variant: 'destructive' }); return; }
                  saveSettings({ provider: 'telegram', telegramBotToken: settings.telegramBotToken, telegramBotUsername: settings.telegramBotUsername, usePlatformTelegram: false }, 'telegram');
                }} disabled={saving === 'telegram'} className="h-9 px-5 rounded-lg font-bold bg-[#08c] hover:bg-[#0099cc] text-white">
                  {saving === 'telegram' ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? 'حفظ' : 'Save'}
                </Button>
                {settings.platformTelegramAvailable && (
                  <button onClick={() => handleUsePlatformBot('telegram')} disabled={saving === 'telegram'}
                    className="h-9 px-4 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100">
                    {isRTL ? 'استخدام بوت المنصة' : 'Use Platform Bot'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── WHATSAPP ── */}
          {activePlatform === 'whatsapp_cloud' && !connected && (
            <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{isRTL ? 'بيانات WhatsApp Cloud API' : 'WhatsApp Cloud API Credentials'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('bot.whatsappPhoneId')}</Label>
                  <Input className="h-10 rounded-lg" value={settings.whatsappPhoneId || ''} onChange={e => updateSetting('whatsappPhoneId', e.target.value)} placeholder="123456789012345" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('bot.whatsappAccessToken')}</Label>
                  <Input className="h-10 rounded-lg" type="password" value={settings.whatsappToken || ''} onChange={e => updateSetting('whatsappToken', e.target.value)} placeholder="Paste access token" />
                  {settings.whatsappTokenConfigured && !settings.whatsappToken?.trim() && <p className="text-[10px] text-slate-400">{t('bot.tokenSavedHidden')}</p>}
                </div>
              </div>
              <Button onClick={() => {
                if (!settings.whatsappPhoneId?.trim() || !settings.whatsappToken?.trim()) { toast({ title: isRTL ? 'أدخل البيانات' : 'Enter credentials', variant: 'destructive' }); return; }
                saveSettings({ provider: 'whatsapp_cloud', whatsappPhoneId: settings.whatsappPhoneId, whatsappToken: settings.whatsappToken, usePlatformWhatsapp: false }, 'whatsapp_cloud');
              }} disabled={saving === 'whatsapp_cloud'} className="h-9 px-5 rounded-lg font-bold bg-[#25D366] hover:bg-[#1fad52] text-white">
                {saving === 'whatsapp_cloud' ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? 'حفظ' : 'Save'}
              </Button>
            </div>
          )}

          {/* ── Timing Settings (all active platforms) ── */}
          {!isViber && (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">{isRTL ? 'الإعدادات العامة' : 'General Settings'}</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'تأخير الرد (دقيقة)' : 'Reply Delay (min)'}</Label>
                  <Input type="number" min={0} max={60} className="h-9 rounded-lg text-sm"
                    value={activePlatform === 'telegram' ? settings.telegramDelayMinutes ?? 5 : activePlatform === 'facebook' ? settings.messengerDelayMinutes ?? 5 : (settings as any)[`${activePlatform === 'whatsapp_cloud' ? 'whatsapp' : activePlatform}DelayMinutes`] ?? 5}
                    onChange={e => {
                      const key = activePlatform === 'telegram' ? 'telegramDelayMinutes' : activePlatform === 'facebook' ? 'messengerDelayMinutes' : activePlatform === 'whatsapp_cloud' ? 'whatsappDelayMinutes' : 'viberDelayMinutes';
                      updateSetting(key, parseInt(e.target.value, 10) || 0);
                    }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'انتهاء الطلب (ساعة)' : 'Order Expiry (h)'}</Label>
                  <Input type="number" min={1} max={72} className="h-9 rounded-lg text-sm"
                    value={settings.autoExpireHours ?? 24}
                    onChange={e => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'حفظ' : 'Save'}</Label>
                  <Button onClick={() => {
                    const payload: any = { provider: activePlatform, autoExpireHours: settings.autoExpireHours ?? 24 };
                    if (activePlatform === 'telegram') payload.telegramDelayMinutes = settings.telegramDelayMinutes ?? 5;
                    else if (activePlatform === 'facebook') payload.messengerDelayMinutes = settings.messengerDelayMinutes ?? 5;
                    else if (activePlatform === 'whatsapp_cloud') payload.whatsappDelayMinutes = (settings as any).whatsappDelayMinutes ?? 5;
                    saveSettings(payload, activePlatform);
                  }} disabled={saving === activePlatform}
                    className="h-9 w-full rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50">
                    {saving === activePlatform ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : isRTL ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>


    </div>
  );
}

