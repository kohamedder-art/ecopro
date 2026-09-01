import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation, Locale } from "@/lib/i18n";
import { 
  Zap, 
  Sparkles, 
  Menu, 
  X, 
  LogOut, 
  LayoutDashboard, 
  ShoppingBag, 
  Crown, 
  PlusCircle, 
  ChevronDown, 
  MessageCircle,
  Sun,
  Moon,
  User as UserIcon,
  Headset,
  Info,
  CreditCard,
  Bell,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { authApi } from "@/lib/auth";
import { safeJsonParse } from "@/utils/safeJson";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useNotifications } from "@/contexts/NotificationContext";
import { useStore } from "@/contexts/StoreContext";

export default function Header() {
  const { toggle, theme } = useTheme();
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userStr ? safeJsonParse(userStr, null as any) : null;
  const isAdmin = user?.role === "admin";
  const isSeller = user?.role === "seller";
  const isClient = user?.user_type === "client" || user?.role === "admin";
  
  const { storeSlug } = useStoreSettings({ enabled: Boolean(user && isClient) });

  let totalAlerts = 0;
  try {
    const notifCtx = useNotifications();
    totalAlerts = notifCtx.totalAlerts;
  } catch {
    // NotificationProvider might not be mounted (landing pages)
  }

  const handleLogout = async () => {
    try {
      const wasAdmin = user?.role === 'admin';
      void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
      localStorage.removeItem("user");
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("isStaff");
      if (wasAdmin) {
        window.location.href = '/login?logged_out=1';
      } else {
        navigate("/");
        window.location.reload();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navLinks = [
    { name: t("menu.pricing") || "الأسعار", href: "/pricing", icon: CreditCard },
    { name: t("menu.about") || "حولنا", href: "/about", icon: Info },
    { name: t("features.support") || "الدعم", href: "/chat", icon: Headset },
  ];

  const getDashboardLink = () => {
    if (isAdmin) return "/platform-admin";
    return "/dashboard";
  };

  const isDark = theme === "dark" || document.documentElement.classList.contains("dark");

  const changeLang = (l: Locale) => {
    setLocale(l);
    setLangMenuOpen(false);
  };

  // --- Garage-door collapsible header for dashboard pages ---
  const isDashboardPage = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/platform-admin');
  const headerNavRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [headerOpen, setHeaderOpen] = useState(false);

  // Collapse on route change
  useEffect(() => {
    setHeaderOpen(false);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setLangMenuOpen(false);
  }, [location.pathname]);

  // Click outside to close
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (!headerOpen) return;
    const navEl = headerNavRef.current;
    const triggerEl = triggerRef.current;
    if (!navEl) return;
    if (navEl.contains(e.target as Node)) return;
    if (triggerEl?.contains(e.target as Node)) return;
    setHeaderOpen(false);
  }, [headerOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Escape key to close
  useEffect(() => {
    if (!headerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [headerOpen]);

  // --- End garage-door logic ---

  const navContent = (
    <>
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Right side: Logo */}
        <div className="flex items-center space-x-6 space-x-reverse z-10">
          <Link to="/" className="flex items-center space-x-2 space-x-reverse group">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-105 transition-transform duration-300 p-1.5">
              <img src="/brand/logo.png" alt="Sahla4Eco" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-slate-900 dark:text-white hidden sm:inline-block">Sahla<span className="text-blue-500">4</span>Eco</span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-sm font-bold text-slate-600 dark:text-slate-300">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {link.name}
            </Link>
          ))}
        </div>

        {/* Left side: Auth & Actions */}
        <div className="flex items-center space-x-3 space-x-reverse">
          {/* Controls: Theme & Lang */}
          <div className="flex items-center space-x-2 space-x-reverse mr-2">
            {isClient && (
              <Link to="/dashboard/alerts" className="relative p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                {totalAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/30">
                    {totalAlerts > 9 ? '9+' : totalAlerts}
                  </span>
                )}
              </Link>
            )}
            <div className="relative">
              <button 
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-lg leading-none">{locale === 'fr' ? '🇫🇷' : locale === 'en' ? '🇬🇧' : '🇩🇿'}</span>
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
              {langMenuOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-50 min-w-32">
                  <div onClick={() => changeLang('ar')} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium flex items-center gap-2 dark:text-slate-200">
                    <span className="text-base leading-none">🇩🇿</span> العربية
                  </div>
                  <div onClick={() => changeLang('en')} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium flex items-center gap-2 dark:text-slate-200">
                    <span className="text-base leading-none">🇬🇧</span> English
                  </div>
                  <div onClick={() => changeLang('fr')} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium flex items-center gap-2 dark:text-slate-200">
                    <span className="text-base leading-none">🇫🇷</span> Français
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={toggle}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-yellow-500"
            >
              {theme === "dark" || isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>

          {user ? (
            <div className="relative">
              <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 hidden sm:block max-w-[100px] truncate">{user.name || user.username || t("auth.user")}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              
              {userMenuOpen && (
                <div className="absolute top-12 left-0 w-56 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 overflow-hidden">
                  {/* Store Switcher */}
                  {isClient && <StoreSwitcher />}
                  <Link to={getDashboardLink()} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                    {t("nav.dashboard") || "لوحة التحكم"}
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:text-red-400 text-sm font-medium text-slate-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("auth.logout") || "تسجيل الخروج"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {t('auth.login')}
              </Link>
              <Link to="/signup" className="flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl bg-[#0ea5e9] text-white text-sm font-bold hover:bg-[#0284c7] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                <Sparkles className="w-4 h-4" />
                <span>{t('auth.createAccount')}</span>
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl py-4 px-6 flex flex-col space-y-4">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              to={link.href} 
              className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 p-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <link.icon className="w-5 h-5 text-indigo-400" />
              {link.name}
            </Link>
          ))}
          {!user && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col space-y-3">
              <Link to="/login" className="w-full text-center py-2 font-bold text-slate-700 dark:text-slate-300" onClick={() => setMobileMenuOpen(false)}>
                {t('auth.login')}
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );

  // --- Dashboard mode: thin trigger bar + slide-down header ---
  if (isDashboardPage) {
    return (
      <>
        {/* Triangle trigger — always visible on dashboard */}
        <div
          ref={triggerRef}
          onClick={() => setHeaderOpen(prev => !prev)}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[101] flex items-center justify-center cursor-pointer group"
        >
          {/* Rounded-bottom triangle shape */}
          <svg width="60" height="20" viewBox="0 0 40 16" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="transition-all duration-300 group-hover:scale-110"
          >
            <path
              d="M0 0 H40 L25 11 Q20 15 15 11 L0 0Z"
              fill="#6366f1"
            />
          </svg>
          <ChevronDown
            size={14}
            className="absolute transition-all duration-300"
            style={{
              color: '#ffffff',
              top: 3,
              transform: headerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {/* Slide-down header */}
        <nav
          ref={headerNavRef}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="fixed top-[20px] left-0 right-0 z-[100] h-[64px] px-4 md:px-6 flex items-center border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md font-['Noto_Sans_Arabic'] transition-all duration-300 ease-in-out"
          style={{
            transform: headerOpen ? 'translateY(0)' : 'translateY(calc(-100% - 20px))',
            pointerEvents: headerOpen ? 'auto' : 'none',
          }}
        >
          {navContent}
        </nav>

        {/* Backdrop overlay when header is open */}
        {headerOpen && (
          <div
            className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setHeaderOpen(false)}
          />
        )}
      </>
    );
  }

  // --- Public mode: normal sticky header ---
  return (
    <nav dir={locale === 'ar' ? 'rtl' : 'ltr'} className="sticky top-0 w-full z-[100] h-[64px] px-4 md:px-6 flex items-center border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md font-['Noto_Sans_Arabic'] transition-colors duration-300">
      {navContent}
    </nav>
  );
}

// Store Switcher component (inside header dropdown)
function StoreSwitcher() {
  const { stores, activeStore, setActiveStore, createStore } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newStoreName.trim()) return;
    setCreating(true);
    const store = await createStore(newStoreName.trim(), activeStore?.id);
    setCreating(false);
    if (store) {
      setNewStoreName('');
      setShowCreate(false);
    }
  };

  if (stores.length === 0 && !showCreate) return null;

  return (
    <div className="border-b border-slate-100 dark:border-slate-700 mb-1">
      <div className="px-4 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          المتجر النشط
        </div>
        {stores.map(store => (
          <button
            key={store.id}
            onClick={() => setActiveStore(store)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
              activeStore?.id === store.id
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: store.primary_color || '#a0876a' }} />
              {store.store_name}
            </span>
          </button>
        ))}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            + متجر جديد
          </button>
        ) : (
          <div className="px-3 py-2">
            <input
              type="text"
              value={newStoreName}
              onChange={e => setNewStoreName(e.target.value)}
              placeholder="اسم المتجر الجديد"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm mb-2"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newStoreName.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 disabled:opacity-50"
              >
                {creating ? '...' : 'إنشاء'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewStoreName(''); }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
