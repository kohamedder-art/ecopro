import { Link, useLocation } from "react-router-dom";
import { 
  Home, Eye, Store, ShoppingCart, Tag, FileText,
  Truck, Megaphone, Star, Percent, Globe, BarChart3, 
  Users, Shield, Ban, Puzzle, CreditCard, Settings,
  ChevronDown, ChevronRight, Menu, X, Package, Bot,
    Divide, Palette, User, Lock, Image, Brain, MapPin, MessageSquare,
  Receipt, Bell, DollarSign
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import { useStaffPermissions } from "@/contexts/StaffPermissionContext";
import { safeJsonParse } from "@/utils/safeJson";
import { useNotifications } from "@/contexts/NotificationContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";

interface MenuItem {
  titleKey: string;
  path: string;
  icon: React.ReactNode;
  badgeKey?: string;
  children?: MenuItem[];
  permission?: string; // Staff permission required for this menu item
}

interface EnhancedSidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

// Professional color themes for sidebar - 4 light + 4 dark
const SIDEBAR_THEMES = {
  // Light themes
  slate:    { bg: '#f8fafc', text: '#1e293b', accent: '#2563eb', border: '#e2e8f0' },
  steel:    { bg: '#f0f6ff', text: '#1e3a5f', accent: '#0284c7', border: '#bfdbfe' },
  pearl:    { bg: '#ffffff', text: '#1e293b', accent: '#6366f1', border: '#e2e8f0' },
  warm:     { bg: '#fafaf9', text: '#292524', accent: '#d97706', border: '#e7e5e4' },

  // Dark themes
  navy:     { bg: '#0f172a', text: '#e2e8f0', accent: '#60a5fa', border: '#1e293b' },
  carbon:   { bg: '#111827', text: '#f3f4f6', accent: '#818cf8', border: '#1f2937' },
  midnight: { bg: '#020617', text: '#cbd5e1', accent: '#38bdf8', border: '#0f172a' },
  graphite: { bg: '#18181b', text: '#e4e4e7', accent: '#a78bfa', border: '#27272a' },
};

// Professional category colors
const CATEGORY_COLORS: { [key: string]: string } = {
  home: '#3b82f6',      // Blue
  store: '#10b981',     // Green
  stock: '#f59e0b',     // Amber
  images: '#0ea5e9',    // Sky Blue
  orders: '#ef4444',    // Red
  delivery: '#8b5cf6',  // Purple
  analytics: '#6366f1', // Indigo
  billing: '#14b8a6',   // Teal
  settings: '#6b7280',  // Gray
};

const buildMenuItems = (storeSlug: string | null, subdomain: string | null): MenuItem[] => {
  const storefrontPath = subdomain
    ? `https://${subdomain}.sahla4eco.com`
    : storeSlug ? `/store/${encodeURIComponent(storeSlug)}` : "/my-store";

  return [
    { titleKey: "sidebar.home", path: "/dashboard", icon: <Home className="w-[18px] h-[18px]" />, permission: "view_dashboard" },
    { titleKey: "sidebar.profile", path: "/dashboard/profile", icon: <User className="w-[18px] h-[18px]" />, permission: "view_settings" },
    {
      titleKey: "sidebar.store",
      path: "/dashboard/preview",
      icon: <Eye className="w-[18px] h-[18px]" />,
      permission: "view_products_list",
      children: [
        { titleKey: "store.management", path: "/dashboard/preview", icon: <Eye className="w-3.5 h-3.5" />, permission: "view_products_list" },
        { titleKey: "store.templateEditor", path: "/template-editor", icon: <Palette className="w-3.5 h-3.5" />, permission: "view_products_list" },
        { titleKey: "store.viewStorefront", path: storefrontPath, icon: <Store className="w-3.5 h-3.5" />, permission: "view_products_list" },
      ],
    },
    { titleKey: "sidebar.stock", path: "/dashboard/stock", icon: <Package className="w-[18px] h-[18px]" />, permission: "view_inventory" },
    { titleKey: "sidebar.images", path: "/dashboard/images", icon: <Image className="w-[18px] h-[18px]" />, permission: "view_settings" },
    { titleKey: "sidebar.orders", path: "/dashboard/orders", icon: <ShoppingCart className="w-[18px] h-[18px]" />, permission: "view_orders_list" },
    { titleKey: "sidebar.tracking", path: "/dashboard/tracking", icon: <MapPin className="w-[18px] h-[18px]" />, permission: "view_orders_list" },
    { titleKey: "sidebar.chatOrders", path: "/dashboard/orders/chat", icon: <MessageSquare className="w-[18px] h-[18px]" />, permission: "view_orders_list" },
    {
      titleKey: "sidebar.delivery",
      path: "/dashboard/delivery/companies",
      icon: <Truck className="w-[18px] h-[18px]" />,
      permission: "edit_delivery_settings",
      children: [
        { titleKey: "sidebar.deliveryCompanies", path: "/dashboard/delivery/companies", icon: <Truck className="w-3.5 h-3.5" />, permission: "edit_delivery_settings" },
        { titleKey: "sidebar.deliveryPricing", path: "/dashboard/delivery/pricing", icon: <Tag className="w-3.5 h-3.5" />, permission: "edit_delivery_settings" }
      ]
    },
    {
      titleKey: "sidebar.marketing",
      path: "/dashboard/marketing-analytics",
      icon: <BarChart3 className="w-[18px] h-[18px]" />,
      permission: "view_settings",
      children: [
        { titleKey: "sidebar.marketingAnalytics", path: "/dashboard/marketing-analytics", icon: <BarChart3 className="w-3.5 h-3.5" />, permission: "view_settings" },
        { titleKey: "sidebar.pricingCalculator", path: "/dashboard/marketing/pricing", icon: <DollarSign className="w-3.5 h-3.5" />, permission: "view_settings" },
      ]
    },
    {
      titleKey: "sidebar.pixels",
      path: "/dashboard/pixel-settings",
      icon: <Settings className="w-[18px] h-[18px]" />,
      permission: "view_settings"
    },
    {
      titleKey: "sidebar.bot",
      path: "/dashboard/bot-settings",
      icon: <Bot className="w-[18px] h-[18px]" />,
      permission: "manage_bot_settings"
    },
    {
      titleKey: "sidebar.integrations",
      path: "/dashboard/integrations",
      icon: <Puzzle className="w-[18px] h-[18px]" />,
      permission: "manage_bot_settings"
    },
    {
      titleKey: "sidebar.aiSettings",
      path: "/dashboard/ai-settings",
      icon: <Brain className="w-[18px] h-[18px]" />,
      permission: "view_settings"
    },
    { titleKey: "sidebar.staff", path: "/dashboard/staff", icon: <Users className="w-[18px] h-[18px]" />, permission: "view_staff" },
    { titleKey: "sidebar.billing", path: "/dashboard/billing", icon: <CreditCard className="w-[18px] h-[18px]" />, permission: "view_settings" },
    { titleKey: "sidebar.alerts", path: "/dashboard/alerts", icon: <Bell className="w-[18px] h-[18px]" />, permission: "view_dashboard" },
  ];
};

export function EnhancedSidebar({ onCollapseChange, mobileOpen: controlledMobileOpen, onMobileOpenChange }: EnhancedSidebarProps = {}) {
  const { t, locale } = useTranslation();
  const { theme: platformTheme } = useTheme();
  const { isStaff, hasPermission } = useStaffPermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = controlledMobileOpen !== undefined ? controlledMobileOpen : internalMobileOpen;
  const setMobileOpen = onMobileOpenChange || setInternalMobileOpen;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  
  // Load theme state from localStorage
  const [themeCustomizationEnabled, setThemeCustomizationEnabled] = useState(() => {
    const saved = localStorage.getItem('sidebarThemeCustomizationEnabled');
    return safeJsonParse(saved, true);
  });
  
  const [sidebarTheme, setSidebarTheme] = useState<keyof typeof SIDEBAR_THEMES>(() => {
    const saved = localStorage.getItem('sidebarTheme');
    const parsed = safeJsonParse(saved, 'slate');
    return (parsed in SIDEBAR_THEMES ? (parsed as keyof typeof SIDEBAR_THEMES) : 'slate');
  });
  
  const location = useLocation();
  const { newOrdersCount, totalAlerts } = useNotifications();

  // Swipe to close mobile sidebar
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 80;
    if (isRTL) {
      if (dx > threshold) setMobileOpen(false);
    } else {
      if (dx < -threshold) setMobileOpen(false);
    }
  };

  const { storeSlug, storeSettings } = useStoreSettings({ enabled: true });
  const subdomain = (storeSettings as any)?.subdomain || null;

  const menuItems = useMemo(() => buildMenuItems(storeSlug, subdomain), [storeSlug, subdomain]);
  
  // Save theme state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarThemeCustomizationEnabled', JSON.stringify(themeCustomizationEnabled));
  }, [themeCustomizationEnabled]);
  
  useEffect(() => {
    localStorage.setItem('sidebarTheme', JSON.stringify(sidebarTheme));
  }, [sidebarTheme]);
  
  const isRTL = locale === "ar";

  // Determine active theme based on customization toggle and platform theme
  const getActiveTheme = (): keyof typeof SIDEBAR_THEMES => {
    if (themeCustomizationEnabled) {
      return sidebarTheme; // Use user's selected custom theme
    }
    // When customization is OFF, sync with platform theme
    return platformTheme === 'dark' ? 'navy' : 'slate';
  };

  const activeTheme = getActiveTheme();

  const handleCollapse = (newCollapsed: boolean) => {
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const toggleExpand = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: MenuItem) => 
    item.children?.some(child => location.pathname === child.path);

  // Preload JS chunk for a route on hover so navigation is instant
  const handlePrefetch = useCallback((path: string) => {
    try {
      switch (path) {
        case '/dashboard': import('@/pages/dashboard/Dashboard'); break;
        case '/dashboard/profile': import('@/pages/dashboard/Profile'); break;
        case '/dashboard/preview': import('@/pages/dashboard/Store'); break;
        case '/dashboard/stock': import('@/pages/dashboard/StockManagement'); break;
        case '/dashboard/images': import('@/pages/dashboard/ImageManager'); break;
        case '/dashboard/alerts': import('@/pages/dashboard/Alerts'); break;
        case '/dashboard/orders': import('@/pages/dashboard/Orders'); break;
        case '/dashboard/orders/chat': import('@/pages/dashboard/orders/ChatOrders'); break;
        case '/dashboard/tracking': import('@/pages/dashboard/OrderTracking'); break;
        case '/dashboard/delivery/companies': import('@/pages/dashboard/delivery/DeliveryCompanies'); break;
        case '/dashboard/delivery/pricing': import('@/pages/dashboard/delivery/DeliveryPricing'); break;
        case '/dashboard/staff': import('@/pages/dashboard/StaffManagement'); break;
        case '/dashboard/bot-settings': import('@/pages/dashboard/BotSettings'); break;
        case '/dashboard/integrations': import('@/pages/dashboard/Integrations'); break;
        case '/dashboard/ai-settings': import('@/pages/dashboard/AISettings'); break;
        case '/dashboard/marketing-analytics': import('@/pages/dashboard/MarketingAnalytics'); break;
        case '/dashboard/marketing/pricing': import('@/pages/dashboard/CODPricingCalculator'); break;
        case '/dashboard/pixel-settings': import('@/pages/dashboard/PixelSettings'); break;
        case '/dashboard/billing': import('@/pages/dashboard/Billing'); break;
        case '/template-editor': import('@/pages/GoldTemplateEditor'); break;
      }
    } catch {}
  }, []);

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.path);
    const active = isActive(item.path) || isParentActive(item);
    
    // Check staff permission
    const hasAccess = !isStaff || !item.permission || hasPermission(item.permission);
    
    // Get category color based on menu item
    const categoryKey = item.titleKey.split('.')[1] || 'home';
    const categoryColor = CATEGORY_COLORS[categoryKey] || CATEGORY_COLORS.home;
    const theme = SIDEBAR_THEMES[activeTheme];

    const badgeCount =
      item.titleKey === 'sidebar.orders' ? newOrdersCount :
      item.titleKey === 'sidebar.alerts' ? totalAlerts :
      0;

    return (
      <div key={item.path}>
        <Link
          to={hasChildren || !hasAccess ? "#" : item.path}
          target={item.path.startsWith('/store/') ? '_blank' : undefined}
          rel={item.path.startsWith('/store/') ? 'noopener noreferrer' : undefined}
          onMouseEnter={() => hasAccess && !hasChildren && handlePrefetch(item.path)}
          onClick={(e) => {
            if (!hasAccess) {
              e.preventDefault();
              return;
            }
            if (hasChildren) {
              e.preventDefault();
              toggleExpand(item.path);
            } else if (!item.path.startsWith('/store/')) {
              setMobileOpen(false);
            }
          }}
          className={cn(
            "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200",
            level > 0 && (isRTL ? "mr-3" : "ml-3"),
            active 
              ? "shadow-sm font-medium"
              : "hover:bg-white hover:bg-opacity-50 text-muted-foreground hover:text-foreground",
            collapsed && level === 0 && "justify-center",
            !hasAccess && "opacity-50"
          )}
          style={{
            backgroundColor: active ? `${categoryColor}20` : 'transparent',
            color: active ? categoryColor : theme.text,
            borderLeft: active && !isRTL ? `3px solid ${categoryColor}` : 'none',
            borderRight: active && isRTL ? `3px solid ${categoryColor}` : 'none',
          }}
          title={!hasAccess ? 'No permission' : undefined}
        >
          {/* Icon with category color */}
          <div className="flex-shrink-0 transition-colors rounded-md p-1" 
            style={{
              backgroundColor: `${categoryColor}20`,
              color: hasAccess ? categoryColor : '#9ca3af',
            }}>
            {hasAccess ? item.icon : <Lock className="w-[18px] h-[18px]" />}
          </div>
          
          {!collapsed && (
            <>
              <span className="flex-1 font-semibold text-[14px] leading-tight min-w-0">{t(item.titleKey)}</span>

              {badgeCount > 0 && (
                <span
                  className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5"
                  title={badgeCount === 1 ? '1 new item' : `${badgeCount} new items`}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
              
              {!hasAccess && (
                <Lock className="w-3 h-3 text-gray-400" />
              )}
              
              {item.badgeKey && hasAccess && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full text-white shadow-sm"
                  style={{ backgroundColor: categoryColor }}>
                  {t(item.badgeKey)}
                </span>
              )}
              
              {hasChildren && (
                <ChevronRight className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              )}
            </>
          )}
        </Link>

        {hasChildren && isExpanded && !collapsed && (
          <div className={cn(
            "mt-1 space-y-1",
            isRTL ? "mr-2" : "ml-2"
          )}>
            {item.children?.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full pt-0 transition-all duration-300"
      style={{
        backgroundColor: SIDEBAR_THEMES[activeTheme].bg,
        color: SIDEBAR_THEMES[activeTheme].text,
        borderColor: SIDEBAR_THEMES[activeTheme].border,
      }}>
      {/* Header with unique design */}
      <div className="p-1.5 border-b flex items-center justify-between transition-all duration-300"
        style={{
          backgroundColor: SIDEBAR_THEMES[activeTheme].bg,
          borderColor: SIDEBAR_THEMES[activeTheme].border,
          lineHeight: '1.2',
        }}>
        <div className="flex items-center gap-2">
          <img
            src="/brand/logo.png"
            alt="Sahla4Eco"
            className="rounded-md"
            style={{ width: collapsed ? '24px' : '30px', height: collapsed ? '24px' : '30px', objectFit: 'contain' }}
          />
          {!collapsed && (
            <div>
              <span className="font-bold block transition-colors duration-200" 
                style={{ color: SIDEBAR_THEMES[activeTheme].accent, fontSize: '12px' }}>
                {t('sidebar.brand')}
              </span>
              <span className="transition-colors duration-200" 
                style={{ color: SIDEBAR_THEMES[activeTheme].text, fontSize: '14px' }}>
                {t("sidebar.controlPanel")}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Theme toggle button */}
          {!collapsed && (
            <button
              onClick={() => setThemeCustomizationEnabled(!themeCustomizationEnabled)}
              className={cn(
                "relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0",
                themeCustomizationEnabled 
                  ? "bg-green-500 shadow-md shadow-green-500/50" 
                  : "bg-gray-500"
              )}
              title={themeCustomizationEnabled ? "Disable theme" : "Enable theme"}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                  themeCustomizationEnabled && "translate-x-4"
                )}
              />
            </button>
          )}
          
          {/* Toggle button for desktop (collapse/expand) */}
          <button
            onClick={() => handleCollapse(!collapsed)}
            className="hidden lg:flex items-center justify-center p-2.5 rounded-lg transition-all border duration-200"
            style={{
              borderColor: SIDEBAR_THEMES[activeTheme].border,
              color: SIDEBAR_THEMES[activeTheme].accent,
              backgroundColor: `${SIDEBAR_THEMES[activeTheme].accent}10`,
            }}
            title={collapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Close button for mobile drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg transition-all"
            style={{ color: SIDEBAR_THEMES[activeTheme].accent }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 min-w-0">
        {menuItems.map(item => renderMenuItem(item))}
      </nav>

      {/* Color Picker and User Section */}
      {!collapsed && (
        <div className="p-4 border-t space-y-3 transition-all duration-300"
          style={{
            borderColor: SIDEBAR_THEMES[activeTheme].border,
          }}>
          
          {/* Color Picker Button - Only visible when enabled */}
          {themeCustomizationEnabled && (
            <div className="relative">
              <button
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-200 font-medium text-sm"
                style={{
                  backgroundColor: `${SIDEBAR_THEMES[activeTheme].accent}10`,
                  borderColor: SIDEBAR_THEMES[activeTheme].accent,
                  color: SIDEBAR_THEMES[activeTheme].accent,
                }}
              >
                <Palette className="w-4 h-4" />
                {t("sidebar.selectTheme") || "Select Theme"}
              </button>
              
              {/* Color Picker Dropdown */}
              {colorPickerOpen && (
                <div className="absolute bottom-full mb-2 left-0 right-0 rounded-lg p-2 shadow-lg border z-50 backdrop-blur"
                  style={{
                    backgroundColor: SIDEBAR_THEMES[activeTheme].bg,
                    borderColor: SIDEBAR_THEMES[activeTheme].border,
                  }}>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(SIDEBAR_THEMES).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSidebarTheme(key as keyof typeof SIDEBAR_THEMES);
                          setColorPickerOpen(false);
                        }}
                        className="w-full h-12 rounded-lg border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: sidebarTheme === key ? theme.accent : theme.border,
                          borderWidth: sidebarTheme === key ? '3px' : '2px',
                        }}
                        title={key.charAt(0).toUpperCase() + key.slice(1)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:block fixed top-[64px] h-[calc(100vh-64px)] transition-all duration-300 z-40 desktop-sidebar",
        isRTL ? "right-0 border-l shadow-2xl" : "left-0 border-r shadow-2xl",
        collapsed ? "w-20" : "w-[270px]"
      )}
      style={{
        backgroundColor: SIDEBAR_THEMES[activeTheme].bg,
        borderColor: SIDEBAR_THEMES[activeTheme].border,
        boxShadow: isRTL 
          ? '-8px 0 32px rgba(0, 0, 0, 0.15)' 
          : '8px 0 32px rgba(0, 0, 0, 0.15)',
      }}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[105] transition-colors duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
            "lg:hidden fixed top-0 h-screen w-[270px] max-w-[85vw] z-[110] border-r transition-all duration-300 overflow-x-hidden",
            isRTL ? "right-0" : "left-0"
          )}
          style={{
            backgroundColor: SIDEBAR_THEMES[activeTheme].bg,
            borderColor: SIDEBAR_THEMES[activeTheme].border,
            boxShadow: isRTL 
              ? '-8px 0 32px rgba(0, 0, 0, 0.2)' 
              : '8px 0 32px rgba(0, 0, 0, 0.2)',
          }}>
            {sidebarContent}
          </aside>
        </>
      )}


    </>
  );
}
