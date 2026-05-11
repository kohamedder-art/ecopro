import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, WifiOff, Clock, Save, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const surfaceCard = "rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40";

interface IntegrationSettings {
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
  whatsappUsingPlatform?: boolean;
  fbPageId?: string;
  fbPageAccessToken?: string;
  fbPageAccessTokenConfigured?: boolean;
  messengerDelayMinutes?: number;
  platformMessengerAvailable?: boolean;
  usePlatformMessenger?: boolean;
  messengerUsingPlatform?: boolean;
  platformInstagramAvailable?: boolean;
  usePlatformInstagram?: boolean;
  instagramAccountId?: string;
  instagramPageAccessToken?: string;
  instagramTokenConfigured?: boolean;
  viberAuthToken?: string;
  viberSenderName?: string;
  viberDelayMinutes?: number;
  platformViberAvailable?: boolean;
  usePlatformViber?: boolean;
  viberUsingPlatform?: boolean;
  autoExpireHours?: number;
  messengerEnabled?: boolean;
}

type Platform = 'facebook' | 'instagram' | 'telegram' | 'whatsapp_cloud' | 'viber';

interface PlatformDef {
  value: Platform;
  label: string;
  desc: string;
  color: string;
  bgColor: string;
}

const ICONS: Record<string, () => JSX.Element> = {
  facebook: () => <svg width="22" height="22" viewBox="0 0 640 640" fill="none"><path d="M240 363.3L240 576L356 576L356 363.3L442.5 363.3L460.5 265.5L356 265.5L356 230.9C356 179.2 376.3 159.4 428.7 159.4C445 159.4 458.1 159.8 465.7 160.6L465.7 71.9C451.4 68 416.4 64 396.2 64C289.3 64 240 114.5 240 223.4L240 265.5L174 265.5L174 363.3L240 363.3z" fill="currentColor"/></svg>,
  instagram: () => <svg width="22" height="22" viewBox="0 0 640 640" fill="none"><path d="M320.3 205C256.8 204.8 205.2 256.2 205 319.7C204.8 383.2 256.2 434.8 319.7 435C383.2 435.2 434.8 383.8 435 320.3C435.2 256.8 383.8 205.2 320.3 205zM319.7 245.4C360.9 245.2 394.4 278.5 394.6 319.7C394.8 360.9 361.5 394.4 320.3 394.6C279.1 394.8 245.6 361.5 245.4 320.3C245.2 279.1 278.5 245.6 319.7 245.4zM413.1 200.3C413.1 185.5 425.1 173.5 439.9 173.5C454.7 173.5 466.7 185.5 466.7 200.3C466.7 215.1 454.7 227.1 439.9 227.1C425.1 227.1 413.1 215.1 413.1 200.3zM542.8 227.5C541.1 191.6 532.9 159.8 506.6 133.6C480.4 107.4 448.6 99.2 412.7 97.4C375.7 95.3 264.8 95.3 227.8 97.4C192 99.1 160.2 107.3 133.9 133.5C107.6 159.7 99.5 191.5 97.7 227.4C95.6 264.4 95.6 375.3 97.7 412.3C99.4 448.2 107.6 480 133.9 506.2C160.2 532.4 191.9 540.6 227.8 542.4C264.8 544.5 375.7 544.5 412.7 542.4C448.6 540.7 480.4 532.5 506.6 506.2C532.8 480 541 448.2 542.8 412.3C544.9 375.3 544.9 264.5 542.8 227.5zM495 452C487.2 471.6 472.1 486.7 452.4 494.6C422.9 506.3 352.9 503.6 320.3 503.6C287.7 503.6 217.6 506.2 188.2 494.6C168.6 486.8 153.5 471.7 145.6 452C133.9 422.5 136.6 352.5 136.6 319.9C136.6 287.3 134 217.2 145.6 187.8C153.4 168.2 168.5 153.1 188.2 145.2C217.7 133.5 287.7 136.2 320.3 136.2C352.9 136.2 423 133.6 452.4 145.2C472 153 487.1 168.1 495 187.8C506.7 217.3 504 287.3 504 319.9C504 352.5 506.7 422.6 495 452z" fill="currentColor"/></svg>,
  telegram: () => <svg width="22" height="22" viewBox="0 0 496 512" fill="none"><path d="M248,8C111.033,8,0,119.033,0,256S111.033,504,248,504,496,392.967,496,256,384.967,8,248,8ZM362.952,176.66c-3.732,39.215-19.881,134.378-28.1,178.3-3.476,18.584-10.322,24.816-16.948,25.425-14.4,1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25,5.342-39.5,3.652-3.793,67.107-61.51,68.335-66.746.153-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608,69.142-14.845,10.194-26.894,9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7,18.45-13.7,108.446-47.248,144.628-62.3c68.872-28.647,83.183-33.623,92.511-33.789,2.052-.034,6.639.474,9.61,2.885a10.452,10.452,0,0,1,3.53,6.716A43.765,43.765,0,0,1,362.952,176.66Z" fill="currentColor"/></svg>,
  whatsapp_cloud: () => <svg width="22" height="22" viewBox="0 0 448 512" fill="none"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" fill="currentColor"/></svg>,
  viber: () => <svg width="22" height="22" viewBox="0 0 512 512" fill="none"><path d="M444 49.9C431.3 38.2 379.9.9 265.3.4c0 0-135.1-8.1-200.9 52.3C27.8 89.3 14.9 143 13.5 209.5c-1.4 66.5-3.1 191.1 117 224.9h.1l-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM457.9 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9.4-85.7.4-85.7-.1 0-.1 0 0 0-101.8-28.2-95.8-134.3-94.7-189.8 1.1-55.5 11.6-101 42.6-131.6 55.7-50.5 170.4-43 170.4-43 96.9.4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9.6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4.7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5.9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9.1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7.5 133 51.4 133.7 139.2zM374.9 329v.2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8h.2c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1.8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z" fill="currentColor"/></svg>,
};

const PLATFORM_DEFS: PlatformDef[] = [
  { value: 'facebook', label: 'Facebook', desc: 'Messenger', color: '#1877F2', bgColor: '#1877F2' },
  { value: 'instagram', label: 'Instagram', desc: 'Instagram DMs', color: '#E4405F', bgColor: '#E4405F' },
  { value: 'telegram', label: 'Telegram', desc: 'Chat Bot', color: '#08c', bgColor: '#08c' },
  { value: 'whatsapp_cloud', label: 'WhatsApp', desc: 'Cloud API', color: '#25D366', bgColor: '#25D366' },
  { value: 'viber', label: 'Viber', desc: 'Viber Messages', color: '#7360F2', bgColor: '#7360F2' },
];

export default function Integrations() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('telegram');
  const [pingState, setPingState] = useState<Record<Platform, 'idle' | 'loading' | 'ok' | 'fail'>>({
    telegram: 'idle', facebook: 'idle', instagram: 'idle', whatsapp_cloud: 'idle', viber: 'idle',
  });
  const [lastSaved, setLastSaved] = useState<Record<Platform, string | null>>({
    telegram: null, facebook: null, instagram: null, whatsapp_cloud: null, viber: null,
  });
  const savedSettingsRef = useRef<IntegrationSettings | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [settings, setSettings] = useState<IntegrationSettings>({
    provider: 'telegram',
    autoExpireHours: 24,
  });

  useEffect(() => { loadSettings(false); }, []);

  const loadSettings = async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await fetch('/api/bot/settings');
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `HTTP ${response.status}`);
      const data = await response.json();
      setSettings(data);
      savedSettingsRef.current = data;
      setHasUnsaved(false);
      if (data?.provider) setActivePlatform(data.provider as Platform);
    } catch (error) {
      console.error('Failed to load integration settings:', error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load settings", variant: "destructive" });
    } finally { if (!background) setLoading(false); else setRefreshing(false); }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (savedSettingsRef.current) {
        const changed = Object.keys(next).some(k => (next as any)[k] !== (savedSettingsRef.current as any)[k]);
        setHasUnsaved(changed);
      }
      return next;
    });
  };

  async function saveSettings(payload: any, platformName: string) {
    setSaving(platformName);
    try {
      // Test WhatsApp connection before saving (non-blocking — save even if test fails)
      if (payload.whatsappPhoneId && payload.whatsappToken) {
        try {
          const test = await fetch('/api/whatsapp/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneId: payload.whatsappPhoneId, token: payload.whatsappToken })
          });
          const testData = await test.json();
          if (!testData.success) {
            console.warn('[Integrations] WhatsApp test failed but saving anyway:', testData.error);
          }
        } catch (e) {
          console.warn('[Integrations] WhatsApp test error, saving anyway:', e);
        }
      }
      const response = await fetch('/api/bot/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to save');
      const result = await response.json().catch(() => ({}));
      if (payload.whatsappPhoneId && payload.whatsappToken) {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'واتساب يعمل!' : 'WhatsApp working!' });
      } else {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
      }
      if (result?.webhookWarning) {
        toast({ title: isRTL ? 'تحذير الـ Webhook' : 'Webhook Warning', description: result.webhookWarning, variant: 'destructive' });
      }
      setLastSaved(prev => ({ ...prev, [platformName]: new Date().toLocaleTimeString() }));
      setHasUnsaved(false);
      await loadSettings(true);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save", variant: "destructive" });
    } finally { setSaving(null); }
  }

  async function pingPlatform(platform: Platform) {
    setPingState(prev => ({ ...prev, [platform]: 'loading' }));
    try {
      let ok = false;
      if (platform === 'telegram' && settings.telegramBotToken) {
        const r = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/getMe`);
        ok = r.ok && (await r.json()).ok === true;
      } else if (platform === 'whatsapp_cloud' && settings.whatsappPhoneId && settings.whatsappToken) {
        const r = await fetch('/api/whatsapp/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneId: settings.whatsappPhoneId, token: settings.whatsappToken }) });
        ok = (await r.json()).success === true;
      } else if (platform === 'facebook' && (settings.fbPageId || settings.usePlatformMessenger)) {
        ok = !!(settings.fbPageAccessTokenConfigured || settings.usePlatformMessenger || settings.messengerUsingPlatform);
      } else if (platform === 'instagram') {
        ok = !!(settings.instagramTokenConfigured || settings.usePlatformInstagram);
      } else {
        ok = isConnected(platform);
      }
      setPingState(prev => ({ ...prev, [platform]: ok ? 'ok' : 'fail' }));
      setTimeout(() => setPingState(prev => ({ ...prev, [platform]: 'idle' })), 4000);
    } catch {
      setPingState(prev => ({ ...prev, [platform]: 'fail' }));
      setTimeout(() => setPingState(prev => ({ ...prev, [platform]: 'idle' })), 4000);
    }
  }

  function handleUseCustom(platform: Platform, useCustom: boolean) {
    if (platform === 'instagram') return;
    const payload: Record<string, any> = {};
    if (platform === 'telegram') {
      payload.usePlatformTelegram = !useCustom;
      if (!useCustom) { payload.telegramBotToken = ''; payload.telegramBotUsername = ''; }
    } else if (platform === 'facebook') {
      payload.usePlatformMessenger = !useCustom;
      payload.messengerEnabled = true;
      if (!useCustom) { payload.fbPageId = ''; payload.fbPageAccessToken = ''; }
    } else if (platform === 'whatsapp_cloud') {
      payload.usePlatformWhatsapp = !useCustom;
      if (!useCustom) { payload.whatsappToken = ''; payload.whatsappPhoneId = ''; }
    } else if (platform === 'viber') {
      payload.usePlatformViber = !useCustom;
      if (!useCustom) { payload.viberAuthToken = ''; }
    }
    saveSettings(payload, platform);
  }

  function handleDisconnect(platform: Platform) {
    const payload: Record<string, any> = {};
    if (platform === 'telegram') { payload.telegramBotToken = ''; payload.telegramBotUsername = ''; payload.usePlatformTelegram = false; }
    else if (platform === 'whatsapp_cloud') { payload.whatsappToken = ''; payload.whatsappPhoneId = ''; payload.usePlatformWhatsapp = false; }
    else if (platform === 'viber') { payload.viberAuthToken = ''; payload.usePlatformViber = false; }
    else if (platform === 'instagram') { payload.instagramAccountId = ''; payload.instagramPageAccessToken = ''; payload.usePlatformInstagram = false; }
    else if (platform === 'facebook') { payload.fbPageId = ''; payload.fbPageAccessToken = ''; payload.usePlatformMessenger = false; payload.messengerEnabled = false; }
    saveSettings(payload, platform);
  }

  function handleSaveCustomCredentials(platform: Platform) {
    if (platform === 'telegram') {
      if (!settings.telegramBotToken?.trim()) { toast({ title: isRTL ? 'الرجاء إدخال رمز البوت' : 'Please enter bot token', variant: 'destructive' }); return; }
      saveSettings({ telegramBotToken: settings.telegramBotToken, telegramBotUsername: settings.telegramBotUsername, usePlatformTelegram: false }, platform);
    } else if (platform === 'facebook') {
      if (!settings.fbPageId?.trim() || !settings.fbPageAccessToken?.trim()) { toast({ title: isRTL ? 'الرجاء إدخال بيانات الصفحة' : 'Please enter page credentials', variant: 'destructive' }); return; }
      saveSettings({ fbPageId: settings.fbPageId, fbPageAccessToken: settings.fbPageAccessToken, usePlatformMessenger: false, messengerEnabled: true }, platform);
    } else if (platform === 'whatsapp_cloud') {
      if (!settings.whatsappPhoneId?.trim() || !settings.whatsappToken?.trim()) { toast({ title: isRTL ? 'الرجاء إدخال بيانات واتساب' : 'Please enter WhatsApp credentials', variant: 'destructive' }); return; }
      saveSettings({ whatsappPhoneId: settings.whatsappPhoneId, whatsappToken: settings.whatsappToken, usePlatformWhatsapp: false }, platform);
    } else if (platform === 'viber') {
      if (!settings.viberAuthToken?.trim()) { toast({ title: isRTL ? 'الرجاء إدخال رمز فايبر' : 'Please enter Viber token', variant: 'destructive' }); return; }
      saveSettings({ viberAuthToken: settings.viberAuthToken, usePlatformViber: false }, platform);
    }
  }

  function isUsingPlatform(platform: Platform): boolean {
    if (platform === 'facebook') return !!(settings.usePlatformMessenger ?? settings.messengerUsingPlatform ?? false);
    if (platform === 'instagram') return false;
    if (platform === 'telegram') return !!(settings.usePlatformTelegram ?? settings.telegramUsingPlatform ?? true);
    if (platform === 'whatsapp_cloud') return false;
    if (platform === 'viber') return false;
    return false;
  }

  function isConnected(platform: Platform): boolean {
    if (platform === 'facebook') return !!(settings.fbPageAccessTokenConfigured || settings.usePlatformMessenger || settings.messengerUsingPlatform);
    if (platform === 'instagram') return !!(settings.instagramTokenConfigured || settings.usePlatformInstagram || settings.instagramUsingPlatform);
    if (platform === 'telegram') return !!(settings.telegramTokenConfigured || settings.telegramUsingPlatform);
    if (platform === 'whatsapp_cloud') return !!settings.whatsappTokenConfigured;
    if (platform === 'viber') return !!settings.viberAuthToken;
    return false;
  }

  function getStatus(platform: Platform): string | null {
    if (platform === 'telegram') return isUsingPlatform('telegram') ? (isRTL ? 'عبر المنصة' : 'via Platform') : (settings.telegramBotUsername ? `@${settings.telegramBotUsername}` : null);
    if (platform === 'whatsapp_cloud') return null;
    if (platform === 'viber') return null;
    return null;
  }

  function platformAvailableFor(platform: Platform): boolean {
    if (platform === 'facebook') return !!settings.platformMessengerAvailable;
    if (platform === 'telegram') return !!settings.platformTelegramAvailable;
    return false;
  }

  const validPlatforms = PLATFORM_DEFS;
  const current = validPlatforms.find(p => p.value === activePlatform)!;
  const usingPlatform = isUsingPlatform(activePlatform);
  const platformAvailable = platformAvailableFor(activePlatform);
  const connected = isConnected(activePlatform);
  const status = getStatus(activePlatform);
  const plat = current;
  const ping = pingState[activePlatform];
  const isViber = activePlatform === 'viber';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          </div>
          <p className="text-sm font-medium text-slate-500">{isRTL ? 'جاري التحميل...' : 'Loading integrations...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 text-slate-900 dark:text-gray-100">
      <div className="space-y-5">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">{isRTL ? 'ربط المنصات' : 'Integrations'}</h1>
              <p className="text-sm text-muted-foreground">{isRTL ? 'اربط منصات التواصل الاجتماعي لاستقبال الطلبات' : 'Connect social platforms to receive orders'}</p>
            </div>
          </div>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>

        {/* ── Unsaved Changes Banner ── */}
        {hasUnsaved && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 animate-in slide-in-from-top-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex-1">
              {isRTL ? 'لديك تغييرات غير محفوظة — لا تنسَ الضغط على حفظ!' : 'You have unsaved changes — don\'t forget to save!'}
            </p>
            <Save className="h-4 w-4 text-amber-500" />
          </div>
        )}

        {/* ── Desktop Platform Cards ── */}
        <div className={surfaceCard + " p-5"}
        >
        <div className="grid grid-cols-5 gap-3">
          {validPlatforms.map(p => {
            const c = isConnected(p.value);
            const active = activePlatform === p.value;
            const isVib = p.value === 'viber';
            return (
              <button key={p.value} onClick={() => setActivePlatform(p.value)}
                className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                  active
                    ? 'border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800'
                    : c
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:border-slate-300'
                }`}
              >
                {c && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {isVib && !c && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-slate-400 text-white text-[8px] font-bold whitespace-nowrap">
                    {isRTL ? 'قريباً' : 'Soon'}
                  </div>
                )}
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: p.bgColor, opacity: isVib ? 0.6 : 1 }}>
                  <span className="text-white">{ICONS[p.value]()}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{p.label}</p>
                <p className={`text-[10px] mt-0.5 ${c ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : isVib ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isVib ? (isRTL ? 'قريباً' : 'Coming soon') : c ? (isRTL ? '● متصل' : '● Connected') : (isRTL ? 'غير متصل' : 'Not connected')}
                </p>
              </button>
            );
          })}
        </div></div>

        {/* ── Mobile Platform Tabs ── */}
        <div className="sm:hidden flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {validPlatforms.map(p => {
            const c = isConnected(p.value);
            const active = activePlatform === p.value;
            return (
              <button key={p.value} onClick={() => setActivePlatform(p.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all shrink-0 ${
                  active
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800'
                    : c
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                }`}>
                {c && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                <span className="text-slate-600 dark:text-slate-300">{ICONS[p.value]()}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active Platform Settings Panel ── */}
        <div className={surfaceCard + " overflow-hidden"}>
          {/* Platform header */}
          <div className="flex items-center gap-4 p-5 border-b border-slate-100 dark:border-slate-700/50">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 relative" style={{ backgroundColor: plat.bgColor, opacity: isViber ? 0.7 : 1 }}>
              <span className="text-white">{ICONS[plat.value]('#fff')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{plat.label}</h2>
                {isViber ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                    🚧 {isRTL ? 'قريباً' : 'Coming Soon'}
                  </span>
                ) : connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    {isRTL ? 'متصل' : 'Connected'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                    <WifiOff className="w-3 h-3" />
                    {isRTL ? 'غير متصل' : 'Not connected'}
                  </span>
                )}
                {/* Ping result badge */}
                {ping === 'ok' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> {isRTL ? 'يعمل!' : 'Working!'}
                  </span>
                )}
                {ping === 'fail' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-[10px] font-bold text-red-600">
                    <XCircle className="w-3 h-3" /> {isRTL ? 'لا يستجيب' : 'Not responding'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500">{plat.desc}{status ? ` — ${status}` : ''}</p>
                {lastSaved[activePlatform] && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    {isRTL ? `حُفظ الساعة ${lastSaved[activePlatform]}` : `Saved at ${lastSaved[activePlatform]}`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Test connection button */}
              {connected && !isViber && (
                <button onClick={() => pingPlatform(activePlatform)} disabled={ping === 'loading'}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1.5">
                  {ping === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  {isRTL ? 'اختبار' : 'Test'}
                </button>
              )}
              {connected && !isViber && (
                <button onClick={() => handleDisconnect(activePlatform)} disabled={saving === activePlatform}
                  className="h-8 px-4 rounded-lg text-xs font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30">
                  {saving === activePlatform ? <Loader2 className="h-3 w-3 animate-spin" /> : isRTL ? 'إلغاء الربط' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* ── Instagram (manual credentials only) ── */}
            {activePlatform === 'instagram' && (
              <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'بيانات إنستغرام' : 'Instagram Credentials'}</p>
                </div>
                <p className="text-xs text-slate-500">{isRTL ? 'أدخل معرّف حساب إنستغرام ورمز الوصول من Meta Developer Dashboard.' : 'Enter your Instagram Account ID and Access Token from Meta Developer Dashboard.'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isRTL ? 'معرّف الحساب' : 'Account ID'}</Label>
                    <Input className="h-10 rounded-lg" value={settings.instagramAccountId || ''} onChange={e => updateSetting('instagramAccountId', e.target.value)} placeholder="17841405822304914" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isRTL ? 'رمز الوصول' : 'Access Token'}</Label>
                    <Input className="h-10 rounded-lg" type="password" value={settings.instagramPageAccessToken || ''} onChange={e => updateSetting('instagramPageAccessToken', e.target.value)} placeholder="Paste access token" />
                    {settings.instagramTokenConfigured && !String(settings.instagramPageAccessToken || '').trim() && (
                      <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                    )}
                  </div>
                </div>
                <Button onClick={() => {
                  if (!settings.instagramAccountId?.trim() || !settings.instagramPageAccessToken?.trim()) { toast({ title: isRTL ? 'الرجاء إدخال البيانات' : 'Please enter credentials', variant: 'destructive' }); return; }
                  saveSettings({ instagramAccountId: settings.instagramAccountId, instagramPageAccessToken: settings.instagramPageAccessToken, usePlatformInstagram: false }, 'instagram');
                }} disabled={saving === 'instagram'} className="h-9 px-5 rounded-lg text-sm font-bold bg-pink-600 hover:bg-pink-700 text-white">
                  {saving === 'instagram' ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? 'حفظ' : 'Save'}
                </Button>
              </div>
            )}

            {/* ── Telegram / Facebook / WhatsApp / Viber ── */}
            {(activePlatform === 'telegram' || activePlatform === 'facebook' || activePlatform === 'whatsapp_cloud' || activePlatform === 'viber') && (
              <>
                {/* Platform / Custom mode toggle */}
                {platformAvailable && (activePlatform === 'telegram' || activePlatform === 'facebook') && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${usingPlatform ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                      {usingPlatform
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" fill="#059669"/><path d="M4.5 7l2 2 3-3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" fill="#d97706"/><path d="M7 4.5v5M4.5 7h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {usingPlatform ? (isRTL ? 'بوت المنصة (يديره EcoPro)' : 'Platform Bot (EcoPro-managed)') : (isRTL ? 'بوت مخصص' : 'Custom Bot')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {usingPlatform
                          ? (isRTL ? 'لا تحتاج إلى إعداد أي شيء، EcoPro يدير البوت تلقائياً' : 'No setup needed — EcoPro manages the bot for you')
                          : (isRTL ? 'أدخل بيانات البوت الخاص بك أدناه' : 'Enter your own bot credentials below')}
                      </p>
                    </div>
                    <button onClick={() => handleUseCustom(activePlatform, usingPlatform)} disabled={saving === activePlatform}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0">
                      {saving === activePlatform ? <Loader2 className="h-3 w-3 animate-spin" /> :
                        usingPlatform ? (isRTL ? 'استخدام بوتي الخاص' : 'Use My Own Bot') : (isRTL ? 'استخدام بوت المنصة' : 'Use Platform Bot')}
                    </button>
                  </div>
                )}

                {/* Custom credentials form */}
                {(!platformAvailable || !usingPlatform) && (
                  <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'بيانات الاعتماد' : 'Credentials'}</p>
                    </div>

                    {activePlatform === 'telegram' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.telegramBotToken')}</Label>
                          <Input className="h-10 rounded-lg" type="password" value={settings.telegramBotToken || ''} onChange={e => updateSetting('telegramBotToken', e.target.value)} placeholder="123456:ABCDEF..." />
                          {settings.telegramTokenConfigured && !String(settings.telegramBotToken || '').trim() && (
                            <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.telegramBotUsername')}</Label>
                          <Input className="h-10 rounded-lg" value={settings.telegramBotUsername || ''} onChange={e => updateSetting('telegramBotUsername', e.target.value)} placeholder="@YourBotUsername" />
                        </div>
                      </div>
                    )}

                    {activePlatform === 'facebook' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{isRTL ? 'معرّف الصفحة' : 'Page ID'}</Label>
                          <Input className="h-10 rounded-lg" value={settings.fbPageId || ''} onChange={e => updateSetting('fbPageId', e.target.value)} placeholder="123456789012345" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{isRTL ? 'رمز الوصول' : 'Access Token'}</Label>
                          <Input className="h-10 rounded-lg" type="password" value={settings.fbPageAccessToken || ''} onChange={e => updateSetting('fbPageAccessToken', e.target.value)} placeholder="Paste page access token" />
                          {settings.fbPageAccessTokenConfigured && !String(settings.fbPageAccessToken || '').trim() && (
                            <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activePlatform === 'whatsapp_cloud' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.whatsappPhoneId')}</Label>
                          <Input className="h-10 rounded-lg" value={settings.whatsappPhoneId || ''} onChange={e => updateSetting('whatsappPhoneId', e.target.value)} placeholder="123456789012345" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.whatsappAccessToken')}</Label>
                          <Input className="h-10 rounded-lg" type="password" value={settings.whatsappToken || ''} onChange={e => updateSetting('whatsappToken', e.target.value)} placeholder="Paste access token" />
                          {settings.whatsappTokenConfigured && !String(settings.whatsappToken || '').trim() && (
                            <p className="text-[10px] text-slate-500">{t('bot.tokenSavedHidden')}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activePlatform === 'viber' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.viberAuthToken')}</Label>
                          <Input className="h-10 rounded-lg" value={settings.viberAuthToken || ''} onChange={e => updateSetting('viberAuthToken', e.target.value)} placeholder="viber-auth-token" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{t('bot.viberSenderName')}</Label>
                          <Input className="h-10 rounded-lg" value={settings.viberSenderName || ''} onChange={e => updateSetting('viberSenderName', e.target.value)} placeholder="Sahla4Eco" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button onClick={() => handleSaveCustomCredentials(activePlatform)} disabled={saving === activePlatform}
                        className="h-9 px-5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                        {saving === activePlatform ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? 'حفظ البيانات' : 'Save Credentials'}
                      </Button>
                      {platformAvailable && (
                        <p className="text-[10px] text-slate-400">{isRTL ? 'أو استخدم زر التبديل أعلاه للعودة إلى بوت المنصة' : 'Or use the toggle above to switch back to Platform Bot'}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Delay & Expiry Settings (all platforms including Instagram) ── */}
            {(activePlatform === 'telegram' || activePlatform === 'facebook' || activePlatform === 'whatsapp_cloud' || activePlatform === 'viber' || activePlatform === 'instagram') && (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4v3.5L9.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'إعدادات إضافية' : 'Additional Settings'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'تأخير الرد (دقائق)' : 'Reply Delay (min)'}</Label>
                    <Input type="number" min={0} max={60}
                      value={activePlatform === 'telegram' ? settings.telegramDelayMinutes ?? 5 : activePlatform === 'facebook' ? settings.messengerDelayMinutes ?? 5 : activePlatform === 'whatsapp_cloud' ? (settings as any).whatsappDelayMinutes ?? 5 : activePlatform === 'viber' ? (settings as any).viberDelayMinutes ?? 5 : 5}
                      className="h-9 rounded-lg text-sm"
                      onChange={e => {
                        const key = activePlatform === 'telegram' ? 'telegramDelayMinutes' : activePlatform === 'facebook' ? 'messengerDelayMinutes' : activePlatform === 'whatsapp_cloud' ? 'whatsappDelayMinutes' : activePlatform === 'viber' ? 'viberDelayMinutes' : null;
                        if (key) updateSetting(key, parseInt(e.target.value, 10) || 5);
                      }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'انتهاء الطلب (ساعات)' : 'Order Expiry (h)'}</Label>
                    <Input type="number" min={1} max={72} value={settings.autoExpireHours ?? 24}
                      className="h-9 rounded-lg text-sm"
                      onChange={e => updateSetting('autoExpireHours', parseInt(e.target.value, 10) || 24)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold text-slate-500">{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</Label>
                    <Button onClick={() => {
                      const payload: any = {};
                      if (activePlatform === 'telegram') { payload.telegramDelayMinutes = settings.telegramDelayMinutes ?? 5; }
                      else if (activePlatform === 'facebook') { payload.messengerDelayMinutes = settings.messengerDelayMinutes ?? 5; }
                      else if (activePlatform === 'whatsapp_cloud') { payload.whatsappDelayMinutes = (settings as any).whatsappDelayMinutes ?? 5; }
                      else if (activePlatform === 'viber') { payload.viberDelayMinutes = (settings as any).viberDelayMinutes ?? 5; }
                      payload.autoExpireHours = settings.autoExpireHours ?? 24;
                      saveSettings(payload, 'delay');
                    }} disabled={saving === 'delay'}
                      className="h-9 w-full rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                      {saving === 'delay' ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : isRTL ? 'حفظ' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Platform Setup FAQs ── */}
        {activePlatform === 'whatsapp_cloud' && <WhatsAppFaq isRTL={isRTL} />}
        {activePlatform === 'facebook' && <FacebookFaq isRTL={isRTL} />}
        {activePlatform === 'instagram' && <InstagramFaq isRTL={isRTL} />}
        {activePlatform === 'telegram' && <TelegramFaq isRTL={isRTL} />}
      </div>
    </div>
  );
}

function FaqAccordion({ title, faqs }: { title: string; faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">❓</span>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
      </div>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors" onClick={() => setOpen(open === i ? null : i)}>
              <span className="text-right w-full">{faq.q}</span>
              <svg className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open === i ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {open === i && (
              <div className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">{faq.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FacebookFaq({ isRTL }: { isRTL: boolean }) {
  const faqs = isRTL ? [
    { q: 'كيف أنشئ تطبيق Messenger على Meta؟', a: 'اذهب إلى developers.facebook.com ← My Apps ← Create App ← اختر Business ← أضف منتج Messenger. ستحتاج إلى صفحة Facebook نشطة.' },
    { q: 'أين أجد الـ Page ID؟', a: 'اذهب إلى صفحتك على Facebook ← عن الصفحة (About) ← مرر للأسفل ستجد Page ID.' },
    { q: 'كيف أحصل على Access Token؟', a: 'في Meta Developers ← Messenger ← API Setup ← أضف صفحتك ← انقر Generate Token. احفظه لأنه لن يظهر مرة أخرى.' },
    { q: 'ما هو الـ Webhook الذي أضعه؟', a: 'Callback URL:\nhttps://www.sahla4eco.com/api/messenger/webhook\n\nVerify Token:\necopro_messenger_verify\n\nاشترك في: messages, messaging_postbacks' },
    { q: 'ما الأذونات المطلوبة؟', a: '• pages_messaging\n• pages_read_engagement\n• pages_manage_metadata\n\nأضفها من App Review ← Permissions.' },
  ] : [
    { q: 'How do I create a Messenger app on Meta?', a: 'Go to developers.facebook.com → My Apps → Create App → choose Business → add Messenger product. You\'ll need an active Facebook Page.' },
    { q: 'Where do I find the Page ID?', a: 'Go to your Facebook Page → About → scroll down to find Page ID.' },
    { q: 'How do I get the Access Token?', a: 'In Meta Developers → Messenger → API Setup → add your page → click Generate Token. Save it as it won\'t be shown again.' },
    { q: 'What Webhook URL do I use?', a: 'Callback URL:\nhttps://www.sahla4eco.com/api/messenger/webhook\n\nVerify Token:\necopro_messenger_verify\n\nSubscribe to: messages, messaging_postbacks' },
    { q: 'What permissions does my app need?', a: '• pages_messaging\n• pages_read_engagement\n• pages_manage_metadata\n\nAdd them from App Review → Permissions.' },
  ];
  return <FaqAccordion title={isRTL ? 'كيف أربط Facebook Messenger؟' : 'How to set up Facebook Messenger?'} faqs={faqs} />;
}

function InstagramFaq({ isRTL }: { isRTL: boolean }) {
  const faqs = isRTL ? [
    { q: 'ما المتطلبات لربط Instagram؟', a: '• حساب Instagram Business أو Creator\n• صفحة Facebook مرتبطة بحسابك\n• تطبيق Meta Developer مع منتج Instagram' },
    { q: 'كيف أنشئ التطبيق وأحصل على البيانات؟', a: 'اذهب إلى developers.facebook.com ← My Apps ← Create App ← أضف Instagram ← اربط صفحتك على Facebook ← احصل على Instagram Account ID و Access Token من صفحة API Setup.' },
    { q: 'أين أجد الـ Instagram Account ID؟', a: 'في Meta Developers ← Instagram ← API Setup ← ستجد Instagram Business Account ID بجانب اسم حسابك.' },
    { q: 'ما الأذونات المطلوبة؟', a: '• instagram_basic\n• instagram_manage_messages\n• pages_manage_metadata\n\nأضفها من App Review.' },
    { q: 'هل يمكنني الرد تلقائياً على DMs؟', a: 'نعم! بعد الربط، يقوم الذكاء الاصطناعي بالرد التلقائي على رسائل العملاء عبر Instagram DMs وتحويل الطلبات تلقائياً.' },
  ] : [
    { q: 'What are the requirements to connect Instagram?', a: '• Instagram Business or Creator account\n• Facebook Page linked to your account\n• Meta Developer app with Instagram product' },
    { q: 'How do I create the app and get credentials?', a: 'Go to developers.facebook.com → My Apps → Create App → add Instagram → link your Facebook Page → get Instagram Account ID and Access Token from API Setup page.' },
    { q: 'Where do I find the Instagram Account ID?', a: 'In Meta Developers → Instagram → API Setup → find the Instagram Business Account ID next to your account name.' },
    { q: 'What permissions does my app need?', a: '• instagram_basic\n• instagram_manage_messages\n• pages_manage_metadata\n\nAdd from App Review.' },
    { q: 'Can I auto-reply to DMs?', a: 'Yes! After connecting, the AI auto-replies to customer messages via Instagram DMs and automatically processes orders.' },
  ];
  return <FaqAccordion title={isRTL ? 'كيف أربط Instagram؟' : 'How to set up Instagram?'} faqs={faqs} />;
}

function TelegramFaq({ isRTL }: { isRTL: boolean }) {
  const faqs = isRTL ? [
    { q: 'كيف أنشئ بوت Telegram؟', a: 'افتح Telegram وابحث عن @BotFather ← أرسل /newbot ← اختر اسماً وusername للبوت ← ستحصل على Bot Token.' },
    { q: 'ما هو الـ Bot Token؟', a: 'هو رمز من @BotFather يبدو هكذا: 123456789:ABCdefGHI... الصقه في حقل Bot Token في الأعلى.' },
    { q: 'ما هو الـ Bot Username؟', a: 'هو اسم المستخدم للبوت الذي اخترته عند الإنشاء ويبدأ بـ @ مثل @MystoreBot.' },
    { q: 'هل يمكنني استخدام بوت المنصة بدلاً من إنشاء بوت خاص؟', a: 'نعم! إذا كان بوت المنصة متاحاً، انقر "استخدام بوت المنصة" وسيعمل تلقائياً بدون أي إعداد.' },
    { q: 'كيف أختبر البوت؟', a: 'بعد الحفظ، افتح بوتك في Telegram وأرسل /start. يجب أن يرد البوت تلقائياً. يمكنك أيضاً الضغط على زر "اختبار" في الأعلى.' },
  ] : [
    { q: 'How do I create a Telegram bot?', a: 'Open Telegram and search for @BotFather → send /newbot → choose a name and username → you\'ll receive a Bot Token.' },
    { q: 'What is the Bot Token?', a: 'It\'s a token from @BotFather that looks like: 123456789:ABCdefGHI... Paste it in the Bot Token field above.' },
    { q: 'What is the Bot Username?', a: 'It\'s the username you chose when creating the bot, starting with @ like @MystoreBot.' },
    { q: 'Can I use the Platform Bot instead of creating my own?', a: 'Yes! If the Platform Bot is available, click "Use Platform Bot" and it works automatically with no setup needed.' },
    { q: 'How do I test the bot?', a: 'After saving, open your bot in Telegram and send /start. It should reply automatically. You can also click the "Test" button above.' },
  ];
  return <FaqAccordion title={isRTL ? 'كيف أربط Telegram؟' : 'How to set up Telegram?'} faqs={faqs} />;
}

function WhatsAppFaq({ isRTL }: { isRTL: boolean }) {
  const faqs = isRTL ? [
    { q: 'كيف أنشئ تطبيق WhatsApp Business على Meta؟', a: 'اذهب إلى developers.facebook.com ← My Apps ← Create App ← اختر Business ← أضف منتج WhatsApp. ستجد Phone Number ID و Access Token في صفحة API Setup.' },
    { q: 'ما هو الـ Callback URL الذي أضعه في Meta؟', a: 'Callback URL:\nhttps://www.sahla4eco.com/api/whatsapp/webhook\n\nVerify Token:\necopro_whatsapp_verify\n\nاشترك في: messages' },
    { q: 'أين أجد الـ Phone Number ID؟', a: 'في Meta Developers ← تطبيقك ← WhatsApp ← API Setup ← ستجد Phone Number ID تحت قائمة From.' },
    { q: 'أين أجد الـ Access Token؟', a: 'في نفس الصفحة (API Setup) ستجد Temporary access token. لإنشاء توكن دائم اذهب إلى business.facebook.com ← Users ← System Users ← Generate Token.' },
    { q: 'ما الأذونات المطلوبة؟', a: '• whatsapp_business_messaging\n• whatsapp_business_management\n\nأضفها من App Review ← Permissions.' },
    { q: 'كيف أختبر أن البوت يعمل؟', a: 'بعد الحفظ اضغط زر "اختبار" في الأعلى. يمكنك أيضاً إرسال رسالة لرقمك التجاري وستصلك ردود تلقائية من الذكاء الاصطناعي.' },
  ] : [
    { q: 'How do I create a WhatsApp Business app on Meta?', a: 'Go to developers.facebook.com → My Apps → Create App → choose Business → add WhatsApp product. You\'ll find Phone Number ID and Access Token on the API Setup page.' },
    { q: 'What Callback URL do I paste into Meta?', a: 'Callback URL:\nhttps://www.sahla4eco.com/api/whatsapp/webhook\n\nVerify Token:\necopro_whatsapp_verify\n\nSubscribe to: messages' },
    { q: 'Where do I find the Phone Number ID?', a: 'In Meta Developers → Your App → WhatsApp → API Setup → find the Phone Number ID under the "From" dropdown.' },
    { q: 'Where do I find the Access Token?', a: 'On the same API Setup page you\'ll see a Temporary access token. For a permanent token go to business.facebook.com → Users → System Users → Generate Token.' },
    { q: 'What permissions does my app need?', a: '• whatsapp_business_messaging\n• whatsapp_business_management\n\nAdd them from App Review → Permissions.' },
    { q: 'How do I test that the bot is working?', a: 'After saving, click the "Test" button above. You can also send a message to your business number and you\'ll receive AI-powered auto-replies.' },
  ];
  return <FaqAccordion title={isRTL ? 'كيف أربط WhatsApp؟' : 'How to set up WhatsApp?'} faqs={faqs} />;
}
