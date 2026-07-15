import { useEffect, useState } from "react";
import { X, Bell, AlertTriangle } from "lucide-react";
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

  if (!announcement || dismissed) return null;

  const isRed = announcement.variant === "red";
  const Icon = isRed ? AlertTriangle : Bell;

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
    <div className="px-4 md:px-6 pt-4">
      <div
        className={cn(
          "relative flex items-start gap-3 rounded-xl border p-4 shadow-sm",
          isRed
            ? isDark
              ? "bg-red-950/50 border-red-800 text-red-200"
              : "bg-red-50 border-red-200 text-red-800"
            : isDark
              ? "bg-blue-950/50 border-blue-800 text-blue-200"
              : "bg-blue-50 border-blue-200 text-blue-800"
        )}
      >
        <div
          className={cn(
            "shrink-0 flex items-center justify-center w-9 h-9 rounded-full",
            isRed
              ? isDark
                ? "bg-red-900/60 text-red-300"
                : "bg-red-100 text-red-600"
              : isDark
                ? "bg-blue-900/60 text-blue-300"
                : "bg-blue-100 text-blue-600"
          )}
        >
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm md:text-base">{announcement.title}</p>
          <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
            {announcement.body}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {announcement.allow_dismiss && canDismiss && (
            <button
              onClick={handleDismiss}
              aria-label="إغلاق"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {announcement.allow_never_show_again && (
            <button
              onClick={handleNeverShow}
              className="text-xs underline opacity-70 hover:opacity-100 whitespace-nowrap"
            >
              لا تظهر مجدداً
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
