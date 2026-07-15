import { useEffect, useState } from "react";
import { X, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface Announcement {
  id: number;
  title: string;
  body: string;
  variant: "blue" | "red";
  allow_dismiss: boolean;
  allow_never_show_again: boolean;
  min_view_ms: number;
}

export function GlobalAnnouncement() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [canDismiss, setCanDismiss] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    let active = true;
    fetch("/api/announcements/active", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (active && data.announcement) {
          setAnnouncement(data.announcement);
          const ms = Number(data.announcement.min_view_ms) || 0;
          const seconds = ms > 0 ? Math.ceil(ms / 1000) : 10;
          setCountdown(seconds);
          if (ms > 0) {
            setCanDismiss(false);
            setTimeout(() => setCanDismiss(true), ms);
          } else {
            setCanDismiss(true);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dismissed || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setDismissed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [dismissed, countdown]);

  if (!announcement || dismissed) return null;

  const isRed = announcement.variant === "red";
  const Icon = isRed ? AlertTriangle : Info;

  const handleDismiss = () => setDismissed(true);

  const handleNeverShow = async () => {
    try {
      await fetch(`/api/announcements/${announcement.id}/never-show-again`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="absolute top-[64px] left-0 right-0 z-50 animate-announcement-in px-4 sm:px-6 lg:px-8 pt-3">
      <div
        className={cn(
          "relative mx-auto w-full max-w-xl rounded-xl border shadow-lg overflow-hidden",
          isRed
            ? isDark
              ? "bg-red-950/70 border-red-800/60"
              : "bg-red-50 border-red-200"
            : isDark
              ? "bg-blue-950/70 border-blue-800/60"
              : "bg-blue-50 border-blue-200"
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 right-0 w-1",
            isRed
              ? isDark ? "bg-red-500" : "bg-red-400"
              : isDark ? "bg-blue-500" : "bg-blue-400"
          )}
        />

        <div className="flex items-start gap-3 p-3.5 pl-4">
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-7 h-7 rounded-md mt-0.5",
              isRed
                ? isDark
                  ? "bg-red-900/70 text-red-300"
                  : "bg-red-100 text-red-600"
                : isDark
                  ? "bg-blue-900/70 text-blue-300"
                  : "bg-blue-100 text-blue-600"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "font-semibold text-sm",
                isRed
                  ? isDark ? "text-red-200" : "text-red-900"
                  : isDark ? "text-blue-200" : "text-blue-900"
              )}
            >
              {announcement.title}
            </div>
            <div
              className={cn(
                "mt-1 text-sm leading-relaxed",
                isRed
                  ? isDark ? "text-red-300/80" : "text-red-700"
                  : isDark ? "text-blue-300/80" : "text-blue-700"
              )}
            >
              {announcement.body}
            </div>
            <div
              className={cn(
                "mt-2 text-xs font-medium",
                isRed
                  ? isDark ? "text-red-400/60" : "text-red-400"
                  : isDark ? "text-blue-400/60" : "text-blue-400"
              )}
            >
              سيختفي خلال {countdown} ثانية
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {announcement.allow_never_show_again && (
              <button
                onClick={handleNeverShow}
                className={cn(
                  "text-xs underline underline-offset-2 whitespace-nowrap transition-colors px-1.5 py-1 rounded",
                  isRed
                    ? isDark
                      ? "text-red-400 hover:text-red-300"
                      : "text-red-600 hover:text-red-700"
                    : isDark
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-blue-600 hover:text-blue-700"
                )}
              >
                لا تظهر مجدداً
              </button>
            )}
            {announcement.allow_dismiss && canDismiss && (
              <button
                onClick={handleDismiss}
                aria-label="إغلاق"
                className={cn(
                  "transition-colors p-1 rounded",
                  isRed
                    ? isDark
                      ? "text-red-400 hover:text-red-300 hover:bg-red-900/40"
                      : "text-red-500 hover:text-red-700 hover:bg-red-100"
                    : isDark
                      ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/40"
                      : "text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
