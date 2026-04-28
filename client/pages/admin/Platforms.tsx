import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Unplug,
  Link2,
  MessageSquare,
  Instagram,
  Send,
  Phone,
  Smartphone,
  ChevronDown,
} from "lucide-react";

// ─── Design Tokens ──────────────────────────────────────────────
const surfaceCard =
  "rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40";

// ─── Types ──────────────────────────────────────────────────────

interface FbStatus {
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

type PlatformKey = "facebook" | "instagram" | "whatsapp" | "telegram" | "viber";

interface PlatformDef {
  key: PlatformKey;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgSelected: string;
  available: boolean;
  oauth: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export default function Platforms() {
  const { t, locale } = useTranslation();
  const isRTL = locale === "ar";
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  // Facebook status
  const [fbStatus, setFbStatus] = useState<FbStatus | null>(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbDisconnecting, setFbDisconnecting] = useState(false);

  // Page picker
  const [pages, setPages] = useState<FbPage[]>([]);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [savingPage, setSavingPage] = useState(false);

  // Bot settings status (for Telegram/WhatsApp/Viber)
  const [botStatus, setBotStatus] = useState<any>(null);

  // ── Load status ─────────────────────────────────────────────
  useEffect(() => {
    loadFbStatus();
    loadBotStatus();
  }, []);

  // Handle callback params
  useEffect(() => {
    const fb = params.get("fb");
    if (fb === "connected") {
      toast({
        title: t("platforms.facebook.connectedToast"),
        description: t("platforms.facebook.connectedDesc"),
      });
      loadFbStatus();
      params.delete("fb");
      setParams(params, { replace: true });
    } else if (fb === "select-page") {
      loadPages();
      params.delete("fb");
      setParams(params, { replace: true });
    } else if (fb === "error") {
      toast({
        title: t("platforms.facebook.errorToast"),
        variant: "destructive",
      });
      params.delete("fb");
      setParams(params, { replace: true });
    }
  }, [params]);

  async function loadFbStatus() {
    try {
      setFbLoading(true);
      const data = await apiFetch<FbStatus>("/api/facebook/status");
      setFbStatus(data);
    } catch {
      setFbStatus({ connected: false });
    } finally {
      setFbLoading(false);
    }
  }

  async function loadBotStatus() {
    try {
      const data = await apiFetch<any>("/api/bot/settings");
      setBotStatus(data);
    } catch {
      // optional
    }
  }

  async function loadPages() {
    try {
      const data = await apiFetch<{ pages: FbPage[] }>("/api/facebook/pages");
      if (data?.pages?.length) {
        setPages(data.pages);
        setShowPagePicker(true);
      }
    } catch {
      toast({ title: t("platforms.facebook.errorToast"), variant: "destructive" });
    }
  }

  async function connectFacebook() {
    try {
      setFbConnecting(true);
      const data = await apiFetch<{ url: string }>("/api/facebook/auth-url");
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: t("platforms.facebook.errorToast"), variant: "destructive" });
      setFbConnecting(false);
    }
  }

  async function disconnectFacebook() {
    try {
      setFbDisconnecting(true);
      await apiFetch("/api/facebook/disconnect", { method: "POST" });
      setFbStatus({ connected: false });
      toast({ title: t("platforms.facebook.disconnectedToast") });
    } catch {
      toast({ title: t("platforms.facebook.errorToast"), variant: "destructive" });
    } finally {
      setFbDisconnecting(false);
    }
  }

  async function selectPage() {
    if (!selectedPageId) return;
    try {
      setSavingPage(true);
      const data = await apiFetch<{ success: boolean; pageName: string; instagramConnected: boolean }>(
        "/api/facebook/select-page",
        {
          method: "POST",
          body: JSON.stringify({ pageId: selectedPageId }),
        }
      );
      if (data?.success) {
        setShowPagePicker(false);
        setPages([]);
        toast({
          title: t("platforms.facebook.connectedToast"),
          description: data.pageName,
        });
        loadFbStatus();
      }
    } catch {
      toast({ title: t("platforms.facebook.errorToast"), variant: "destructive" });
    } finally {
      setSavingPage(false);
    }
  }

  // ── Platform definitions ────────────────────────────────────
  const telegramConnected = !!(botStatus?.telegramTokenConfigured || botStatus?.telegramUsingPlatform);
  const whatsappConnected = !!botStatus?.whatsappTokenConfigured;
  const viberConnected = !!(botStatus?.viberAuthToken);

  const PLATFORMS: PlatformDef[] = [
    {
      key: "facebook",
      label: "Facebook",
      icon: <MessageSquare className="w-7 h-7" />,
      color: "text-blue-600",
      borderColor: "border-blue-500",
      bgSelected: "bg-blue-50 dark:bg-blue-950/30",
      available: true,
      oauth: true,
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: <Instagram className="w-7 h-7" />,
      color: "text-pink-600",
      borderColor: "border-pink-500",
      bgSelected: "bg-pink-50 dark:bg-pink-950/30",
      available: true,
      oauth: true, // comes with Facebook connect
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: <Phone className="w-7 h-7" />,
      color: "text-green-600",
      borderColor: "border-green-500",
      bgSelected: "bg-green-50 dark:bg-green-950/30",
      available: true,
      oauth: false,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: <Send className="w-7 h-7" />,
      color: "text-sky-600",
      borderColor: "border-sky-500",
      bgSelected: "bg-sky-50 dark:bg-sky-950/30",
      available: true,
      oauth: false,
    },
    {
      key: "viber",
      label: "Viber",
      icon: <Smartphone className="w-7 h-7" />,
      color: "text-purple-600",
      borderColor: "border-purple-500",
      bgSelected: "bg-purple-50 dark:bg-purple-950/30",
      available: true,
      oauth: false,
    },
  ];

  function isConnected(key: PlatformKey): boolean {
    if (key === "facebook") {
      return !!(
        fbStatus?.connected ||
        // Consider server-side bot settings: platform-shared page or configured token
        botStatus?.fbPageAccessTokenConfigured ||
        botStatus?.messengerUsingPlatform ||
        botStatus?.usePlatformMessenger
      );
    }
    if (key === "instagram") return !!fbStatus?.instagramConnected;
    if (key === "telegram") return telegramConnected;
    if (key === "whatsapp") return whatsappConnected;
    if (key === "viber") return viberConnected;
    return false;
  }

  function getStatusText(key: PlatformKey): string | null {
    if (key === "facebook") {
      if (fbStatus?.connected) return fbStatus.pageName || t("platforms.connected");
      // If the server is using a platform/shared Page or has a configured token,
      // show a generic "Connected" status (we don't expose the platform Page ID).
      if (botStatus?.fbPageAccessTokenConfigured || botStatus?.messengerUsingPlatform || botStatus?.usePlatformMessenger) return t("platforms.connected");
    }
    if (key === "instagram" && fbStatus?.instagramConnected) return fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : t("platforms.connected");
    if (key === "telegram" && telegramConnected) return botStatus?.telegramBotUsername ? `@${botStatus.telegramBotUsername}` : t("platforms.connected");
    if (key === "whatsapp" && whatsappConnected) return t("platforms.connected");
    if (key === "viber" && viberConnected) return t("platforms.connected");
    return null;
  }

  const connectedCount = PLATFORMS.filter((p) => isConnected(p.key)).length;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={`max-w-4xl mx-auto space-y-6 pb-8 ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Link2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{t("platforms.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("platforms.subtitle")}</p>
        </div>
      </div>

      {/* Platform Cards Grid */}
      <div className={surfaceCard + " p-6"}>
        <h2 className="text-base font-bold mb-1">{t("platforms.selectTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-5">{t("platforms.selectDesc")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLATFORMS.map((p) => {
            const connected = isConnected(p.key);
            const statusText = getStatusText(p.key);

            return (
              <div
                key={p.key}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-default ${
                  connected
                    ? `${p.borderColor} ${p.bgSelected} shadow-md`
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {/* Connected badge */}
                {connected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}

                <span className={p.color}>{p.icon}</span>
                <span className="text-sm font-bold">{p.label}</span>

                {statusText && (
                  <span className="text-xs text-muted-foreground truncate max-w-full">{statusText}</span>
                )}
              </div>
            );
          })}
        </div>

        {connectedCount > 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-4">
            {t("platforms.connectedCount", { n: connectedCount })}
          </p>
        )}
      </div>

      {/* Facebook / Instagram Connect Section */}
      <div className={surfaceCard + " overflow-hidden"}>
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-base font-extrabold">{t("platforms.facebook.title")}</p>
            <p className="text-sm text-muted-foreground">{t("platforms.facebook.desc")}</p>
          </div>
        </div>

        <div className="p-4">
          {fbLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          ) : fbStatus?.connected ? (
            /* Connected state */
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    {t("platforms.facebook.connectedTo")} <strong>{fbStatus.pageName}</strong>
                  </p>
                  {fbStatus.instagramConnected && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Instagram className="w-3.5 h-3.5" />
                      Instagram: {fbStatus.instagramUsername ? `@${fbStatus.instagramUsername}` : t("platforms.connected")}
                    </p>
                  )}
                  {fbStatus.tokenExpiresAt && (
                    <p className="text-xs text-muted-foreground">
                      {t("platforms.facebook.tokenExpires")}: {new Date(fbStatus.tokenExpiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                  onClick={disconnectFacebook}
                  disabled={fbDisconnecting}
                >
                  {fbDisconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="h-3.5 w-3.5" />
                  )}
                  <span className="mr-1 ml-1">{t("platforms.disconnect")}</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Disconnected state */
            <div className="text-center py-6 space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/30 mx-auto">
                <MessageSquare className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold mb-1">{t("platforms.facebook.notConnected")}</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {t("platforms.facebook.connectHint")}
                </p>
              </div>
              <Button
                className="h-11 px-8 rounded-xl font-bold text-white bg-[#1877F2] hover:bg-[#166FE5] shadow-md gap-2"
                onClick={connectFacebook}
                disabled={fbConnecting}
              >
                {fbConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t("platforms.facebook.connectBtn")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Page Picker Modal */}
      {showPagePicker && pages.length > 0 && (
        <div className={surfaceCard + " overflow-hidden border-2 border-blue-300 dark:border-blue-700"}>
          <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 bg-blue-50/50 dark:bg-blue-950/20">
            <p className="text-base font-extrabold">{t("platforms.facebook.selectPage")}</p>
            <p className="text-sm text-muted-foreground">{t("platforms.facebook.selectPageDesc")}</p>
          </div>
          <div className="p-4 space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${
                  selectedPageId === page.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedPageId === page.id
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{page.name}</p>
                  {page.hasInstagram && (
                    <p className="text-xs text-pink-600 flex items-center gap-1">
                      <Instagram className="w-3 h-3" /> Instagram {t("platforms.connected")}
                    </p>
                  )}
                </div>
                {selectedPageId === page.id && (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
              </button>
            ))}

            <Button
              className="w-full h-11 rounded-xl font-bold mt-3 bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2"
              disabled={!selectedPageId || savingPage}
              onClick={selectPage}
            >
              {savingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {t("platforms.facebook.confirmPage")}
            </Button>
          </div>
        </div>
      )}

      {/* Other Platforms Info Card */}
      <div className={surfaceCard + " overflow-hidden"}>
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
            <Send className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-base font-extrabold">{t("platforms.other.title")}</p>
            <p className="text-sm text-muted-foreground">{t("platforms.other.desc")}</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Telegram */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600">
              <Send className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Telegram</p>
              <p className="text-xs text-muted-foreground">
                {telegramConnected
                  ? `${t("platforms.connected")}${botStatus?.telegramBotUsername ? ` — @${botStatus.telegramBotUsername}` : ""}`
                  : t("platforms.other.configureInBot")}
              </p>
            </div>
            {telegramConnected ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <a href="/dashboard/bot-settings">
                <Button variant="outline" size="sm" className="rounded-xl text-xs">
                  {t("platforms.other.configure")}
                </Button>
              </a>
            )}
          </div>

          {/* WhatsApp */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-600">
              <Phone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                {whatsappConnected ? t("platforms.connected") : t("platforms.other.configureInBot")}
              </p>
            </div>
            {whatsappConnected ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <a href="/dashboard/bot-settings">
                <Button variant="outline" size="sm" className="rounded-xl text-xs">
                  {t("platforms.other.configure")}
                </Button>
              </a>
            )}
          </div>

          {/* Viber */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Viber</p>
              <p className="text-xs text-muted-foreground">
                {viberConnected ? t("platforms.connected") : t("platforms.other.configureInBot")}
              </p>
            </div>
            {viberConnected ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <a href="/dashboard/bot-settings">
                <Button variant="outline" size="sm" className="rounded-xl text-xs">
                  {t("platforms.other.configure")}
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
