import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
    <div
      className={cn(
        "px-4 py-3 flex items-start gap-3 border-b text-sm",
        isRed
          ? isDark
            ? "bg-red-950/40 border-red-800 text-red-200"
            : "bg-red-50 border-red-200 text-red-800"
          : isDark
            ? "bg-blue-950/40 border-blue-800 text-blue-200"
            : "bg-blue-50 border-blue-200 text-blue-800"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-bold">{announcement.title}</p>
        <div className="mt-1 whitespace-pre-wrap leading-relaxed">{announcement.body}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {announcement.allow_never_show_again && (
          <button
            onClick={handleNeverShow}
            className="text-xs underline opacity-70 hover:opacity-100 whitespace-nowrap"
          >
            لا تظهر مجدداً
          </button>
        )}
        {announcement.allow_dismiss && canDismiss && (
          <button
            onClick={handleDismiss}
            aria-label="إغلاق"
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
