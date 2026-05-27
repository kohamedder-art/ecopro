import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingCart, Bot, Store, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useNotifications } from "@/contexts/NotificationContext";

interface MobileBottomBarProps {
  onMenuClick: () => void;
}

export function MobileBottomBar({ onMenuClick }: MobileBottomBarProps) {
  const { t, locale } = useTranslation();
  const location = useLocation();
  const { newOrdersCount } = useNotifications();
  const isRTL = locale === "ar";

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
        "border-t bg-white dark:bg-neutral-900 dark:border-neutral-800",
        "safe-area-bottom"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = "path" in item && location.pathname.startsWith(item.path);
          const Icon = item.icon;

          const content = (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                "min-w-0 flex-1 py-1.5",
                "transition-colors duration-150",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-neutral-500 dark:text-neutral-400"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {"badge" in item && item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate max-w-full">
                {item.label}
              </span>
            </div>
          );

          if ("action" in item) {
            return (
              <button
                key="menu"
                onClick={item.action}
                className="flex-1 flex justify-center"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 flex justify-center no-underline"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
