import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { EnhancedSidebar } from "@/components/admin/EnhancedSidebar";
import { MobileBottomBar } from "@/components/admin/MobileBottomBar";
import { useState, useEffect } from "react";
import { useTranslation } from "../../lib/i18n";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { Bell, Search, User, Sparkles, Shield, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useStaffPermissions } from "@/contexts/StaffPermissionContext";
import { PermissionGate } from "@/components/PermissionGate";
import Header from "@/components/layout/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import { GlobalAnnouncement } from "@/components/GlobalAnnouncement";


export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { locale, t } = useTranslation();
  const { toggle, theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = locale === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const { isStaff, staffUser, logout: staffLogout } = useStaffPermissions();

  useEffect(() => {
    // Check if user is logged in (either as client or staff)
    const user = getCurrentUser();
    const isStaffMember = localStorage.getItem('isStaff') === 'true';
    
    if (!user && !isStaffMember) {
      // Not logged in - redirect to login
      navigate("/login");
      return;
    }
    if (user?.role === "admin") {
      // Admins should not see the dashboard, redirect to admin panel
      navigate("/platform-control-x9k2m8p5q7w3");
      return;
    }
    // Clients and staff members can see the dashboard
  }, [navigate]);

  const handleStaffLogout = () => {
    staffLogout();
    navigate('/staff/login');
  };

  return (
    <div className={cn(
      "flex flex-col min-h-screen admin-no-break",
      isDark ? "bg-black" : "bg-gray-200"
    )}>
      {/* Platform Header */}
      <Header />

      {/* Global platform announcement (store owners + staff) */}
      <GlobalAnnouncement />

      {/* Main content area with sidebar */}
      <div className="flex flex-1">
        <EnhancedSidebar
          onCollapseChange={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />
        {/* Adjust margin based on sidebar state and language direction - only on lg screens */}
        <main 
          className={cn(
            "flex-1 overflow-auto transition-all duration-300",
            isDark ? "bg-black" : "bg-gray-200",
            // Add left/right margin on large screens to account for fixed sidebar
            isRTL 
              ? (sidebarCollapsed ? 'lg:mr-20' : 'lg:mr-[270px]')
              : (sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[270px]')
          )}
        >
        {/* Staff indicator banner */}
        {isStaff && staffUser && (
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t("layout.staffMode")} {staffUser.email} ({staffUser.role})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStaffLogout}
              className="text-white hover:bg-blue-700"
            >
              <LogOut className="w-4 h-4 mr-1" />
              {t("layout.logout")}
            </Button>
          </div>
        )}
        <div className="px-4 md:px-6 pt-4 pb-20 lg:pb-6">
          {/* Wrap outlet with PermissionGate - auto-detects permission from route */}
          <PermissionGate>
            <ErrorBoundary fallback={
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">عذراً، حدث خطأ غير متوقع</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">حاول إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصل مع الدعم الفني.</p>
                <Button onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4 ml-2" />
                  إعادة تحميل
                </Button>
              </div>
            }>
              <Outlet />
            </ErrorBoundary>
          </PermissionGate>
        </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileBottomBar onMenuClick={() => setMobileSidebarOpen(true)} />
    </div>
  );
}
