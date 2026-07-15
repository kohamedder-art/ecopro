import { useEffect, useState } from "react";
import { X, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

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
    <div className="px-4 md:px-6 pt-4 animate-announcement-in">
      <div
        className={cn(
          "relative rounded-xl border shadow-sm overflow-hidden",
          isRed
            ? isDark
              ? "bg-red-950/40 border-red-800/60"
              : "bg-red-50 border-red-200"
            : isDark
              ? "bg-blue-950/40 border-blue-800/60"
              : "bg-blue-50 border-blue-200"
        )}
      >
        {/* Left accent stripe */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            isRed
              ? isDark ? "bg-red-500" : "bg-red-400"
              : isDark ? "bg-blue-500" : "bg-blue-400"
          )}
        />

        <div className="flex items-start gap-3 p-4 pl-5">
          {/* Icon badge */}
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-8 h-8 rounded-lg mt-0.5",
              isRed
                ? isDark
                  ? "bg-red-900/70 text-red-300"
                  : "bg-red-100 text-red-600"
                : isDark
                  ? "bg-blue-900/70 text-blue-300"
                  : "bg-blue-100 text-blue-600"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "font-semibold text-sm",
                isRed
                  ? isDark ? "text-red-200" : "text-red-900"
                  : isDark ? "text-blue-200" : "text-blue-900"
              )}
            >
              {announcement.title}
            </h4>
            <div
              className={cn(
                "mt-1.5 text-sm leading-relaxed whitespace-pre-wrap",
                isRed
                  ? isDark ? "text-red-300/80" : "text-red-700"
                  : isDark ? "text-blue-300/80" : "text-blue-700"
              )}
            >
              {announcement.body}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {announcement.allow_never_show_again && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNeverShow}
                className={cn(
                  "text-xs h-7 px-2",
                  isRed
                    ? isDark
                      ? "text-red-400 hover:text-red-300 hover:bg-red-900/40"
                      : "text-red-600 hover:text-red-700 hover:bg-red-100"
                    : isDark
                      ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/40"
                      : "text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                )}
              >
                لا تظهر مجدداً
              </Button>
            )}
            {announcement.allow_dismiss && canDismiss && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                aria-label="إغلاق"
                className={cn(
                  "h-7 w-7",
                  isRed
                    ? isDark
                      ? "text-red-400 hover:text-red-300 hover:bg-red-900/40"
                      : "text-red-500 hover:text-red-700 hover:bg-red-100"
                    : isDark
                      ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/40"
                      : "text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                )}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
