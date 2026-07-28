import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingCart, Bot, Store, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";

interface MobileBottomBarProps {
  onMenuClick: () => void;
}

const ITEM_COLORS_LIGHT = {
  home: { active: "#2563eb", glow: "#2563eb25" },
  orders: { active: "#16a34a", glow: "#16a34a25" },
  store: { active: "#9333ea", glow: "#9333ea25" },
  bot: { active: "#ea580c", glow: "#ea580c25" },
  menu: { active: "#64748b", glow: "#64748b25" },
};

const ITEM_COLORS_DARK = {
  home: { active: "#60a5fa", glow: "#60a5fa30" },
  orders: { active: "#4ade80", glow: "#4ade8030" },
  store: { active: "#c084fc", glow: "#c084fc30" },
  bot: { active: "#fb923c", glow: "#fb923c30" },
  menu: { active: "#94a3b8", glow: "#94a3b830" },
};

const ITEM_KEYS = ["home", "orders", "store", "bot", "menu"] as const;

export function MobileBottomBar({ onMenuClick }: MobileBottomBarProps) {
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const { newOrdersCount } = useNotifications();
  const isRTL = locale === "ar";
  const isDark = theme === "dark";

  const colors = isDark ? ITEM_COLORS_DARK : ITEM_COLORS_LIGHT;

  const items = [
    { icon: Home, label: t("sidebar.home"), path: "/dashboard" },
    {
      icon: ShoppingCart,
      label: t("sidebar.orders"),
      path: "/dashboard/orders",
      badge: newOrdersCount,
    },
    { icon: Store, label: t("sidebar.store"), path: "/dashboard/preview" },
    { icon: Bot, label: t("sidebar.bot"), path: "/dashboard/bot-settings" },
    { icon: Menu, label: t("sidebar.expandMenu"), action: onMenuClick },
  ];

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-50",
        "safe-area-bottom"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="mx-2 mb-2 rounded-2xl overflow-hidden"
        style={
          isDark
            ? {
                background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                boxShadow:
                  "0 -2px 20px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
              }
            : {
                background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                boxShadow:
                  "0 -2px 16px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
                border: "1px solid #e2e8f0",
              }
        }
      >
        <div className="flex items-center justify-around h-16 px-1">
          {items.map((item, i) => {
            const isActive =
              "path" in item && location.pathname.startsWith(item.path);
            const Icon = item.icon;
            const colorKey = ITEM_KEYS[i];
            const itemColor = colors[colorKey];

            const content = (
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5",
                  "min-w-0 flex-1 py-1.5 relative",
                  "transition-all duration-200"
                )}
              >
                {/* Active pill background */}
                {isActive && (
                  <div
                    className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-8 rounded-xl transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${itemColor.active}, ${itemColor.active}cc)`,
                      boxShadow: `0 2px 8px ${itemColor.glow}, 0 0 16px ${itemColor.glow}`,
                    }}
                  />
                )}

                <div className="relative z-10">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200",
                      isActive ? "scale-110" : "scale-100"
                    )}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(135deg, ${itemColor.active}, ${itemColor.active}bb)`,
                            boxShadow: `0 2px 6px ${itemColor.glow}`,
                          }
                        : {}
                    }
                  >
                    <Icon
                      className="w-4.5 h-4.5 transition-colors duration-200"
                      style={{
                        color: isActive
                          ? "#ffffff"
                          : isDark
                            ? "#94a3b8"
                            : "#64748b",
                        filter: isActive
                          ? "drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
                          : "none",
                      }}
                    />
                  </div>
                  {"badge" in item && item.badge && item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5"
                      style={{
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        boxShadow: "0 1px 4px rgba(239,68,68,0.5)",
                      }}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    "text-[9px] font-semibold truncate max-w-full relative z-10 transition-colors duration-200",
                    isActive
                      ? "text-white"
                      : isDark
                        ? "text-slate-500"
                        : "text-slate-400"
                  )}
                  style={
                    isActive
                      ? { textShadow: `0 1px 4px ${itemColor.glow}` }
                      : {}
                  }
                >
                  {item.label}
                </span>
              </div>
            );

            if ("action" in item) {
              return (
                <button
                  key="menu"
                  onClick={item.action}
                  className="flex-1 flex justify-center active:scale-95 transition-transform"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex justify-center no-underline active:scale-95 transition-transform"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
