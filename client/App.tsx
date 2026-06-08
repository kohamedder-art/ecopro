// Seller pages removed
import { Toaster } from "@/components/ui/toaster";

import "./global.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, removeAuthToken, syncAuthState, startAutoRefresh } from "@/lib/auth";
import Layout from "@/components/layout/Layout";
import React, { Suspense, lazy } from "react";
import { isSubdomainStore } from "@/lib/resolvedStore";

// Lazy load ALL pages — keep main bundle minimal
// ── Landing ──
const Index = lazy(() => import("./pages/landing/Index"));
const NotFound = lazy(() => import("./pages/landing/NotFound"));
const About = lazy(() => import("./pages/landing/About"));
const Contact = lazy(() => import("./pages/landing/Contact"));
const Privacy = lazy(() => import("./pages/landing/Privacy"));
const Pricing = lazy(() => import("./pages/landing/Pricing"));
const SubscriptionTiers = lazy(() => import("./pages/landing/SubscriptionTiers"));

// ── Auth ──
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const AccountLocked = lazy(() => import("./pages/auth/AccountLocked"));

// ── Platform Admin ──
const PlatformAdminLogin = lazy(() => import("./pages/platform-admin/PlatformAdminLogin"));
const PlatformAdmin = lazy(() => import("./pages/platform-admin/PlatformAdmin"));
const AdminChats = lazy(() => import("./pages/platform-admin/Chats"));
const AdminChat = lazy(() => import("./pages/platform-admin/Chat"));
const Kernel = lazy(() => import("./pages/Kernel"));

// ── Dashboard (store owner) ──
const AdminLayout = lazy(() => import("./pages/dashboard/Layout"));
const AdminDashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const EnhancedDashboard = lazy(() => import("./pages/dashboard/EnhancedDashboard"));
const AdminOrders = lazy(() => import("./pages/dashboard/Orders"));
const AdminCalls = lazy(() => import("./pages/dashboard/Calls"));
const AdminBotSettings = lazy(() => import("./pages/dashboard/BotSettings"));
const AdminIntegrations = lazy(() => import("./pages/dashboard/Integrations"));
const AdminAISettings = lazy(() => import("./pages/dashboard/AISettings"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Billing = lazy(() => import("./pages/dashboard/Billing"));
const ChatPage = lazy(() => import("./pages/dashboard/ChatPage"));
const CustomerBot = lazy(() => import("./pages/dashboard/CustomerBot"));
const MarketingAnalytics = lazy(() => import("./pages/dashboard/MarketingAnalytics"));
const CODPricingCalculator = lazy(() => import("./pages/dashboard/CODPricingCalculator"));
const PixelSettings = lazy(() => import("./pages/dashboard/PixelSettings"));
const LogoDemo = lazy(() => import("./pages/dashboard/LogoDemo"));
const DataMigration = lazy(() => import("./pages/dashboard/DataMigration"));
const StockManagement = lazy(() => import("./pages/dashboard/StockManagement"));
const Store = lazy(() => import("./pages/dashboard/Store"));
const ImageManager = lazy(() => import("./pages/dashboard/ImageManager"));
const OrderTracking = lazy(() => import("./pages/dashboard/OrderTracking"));
const AlertsPage = lazy(() => import("./pages/dashboard/Alerts"));
const StaffManagement = lazy(() => import("./pages/dashboard/StaffManagement"));

// ── Dashboard sub-pages ──
const ChatOrders = lazy(() => import("./pages/dashboard/orders/ChatOrders"));
const DeliveryCompanies = lazy(() => import("./pages/dashboard/delivery/DeliveryCompanies"));
const DeliveryPricing = lazy(() => import("./pages/dashboard/delivery/DeliveryPricing"));

// ── Storefront ──
const Storefront = lazy(() => import("./pages/Storefront"));
const StoreLayout = lazy(() => import("./pages/StoreLayout"));
const BuildPage = lazy(() => import("./pages/storefront/BuildPage"));
const ProductDetail = lazy(() => import("./pages/storefront/ProductDetail"));
const ProductCheckout = lazy(() => import("./pages/storefront/ProductCheckout"));
const StorefrontCheckout = lazy(() => import("./pages/storefront/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/storefront/OrderConfirmation"));

// ── My Store ──
const MyStore = lazy(() => import("./pages/MyStore"));
const MyStoreIndex = lazy(() => import("./pages/my-store/Index"));
const MyStoreTemplateEditor = lazy(() => import("./pages/my-store/TemplateEditor"));
const MyStoreStorefront = lazy(() => import("./pages/my-store/StorefrontPreview"));
const GoldTemplateEditor = lazy(() => import("./pages/GoldTemplateEditor"));

function SubdomainProductRoute() {
  // Reads :productSlug from the URL and renders the storefront with that product pre-selected.
  return <Storefront />;
}

function SubdomainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Storefront />} />
      <Route path="/checkout/:productSlug" element={<ProductCheckout />} />
      <Route path="/order/:orderId/confirm" element={<OrderConfirmation />} />
      <Route path="/:productSlug" element={<SubdomainProductRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ── Staff ──
const StaffLogin = lazy(() => import("./pages/staff/StaffLogin"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const StaffOrders = lazy(() => import("./pages/staff/StaffOrders"));

// ── Affiliate ──
const AffiliateLogin = lazy(() => import("./pages/affiliate/AffiliateLogin"));
const AffiliateDashboard = lazy(() => import("./pages/affiliate/AffiliateDashboard"));

// ── Billing ──
const BillingSuccess = lazy(() => import("./pages/billing/BillingSuccess"));
const BillingCancelled = lazy(() => import("./pages/billing/BillingCancelled"));
const RenewSubscription = lazy(() => import("./pages/billing/RenewSubscription"));
import SubscriptionPageLock from "./components/SubscriptionPageLock";

import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "@/lib/i18n";
import { CartProvider } from "@/state/CartContext";
import { PermissionProvider } from "@/context/PermissionContext";
import { StaffPermissionProvider } from "@/contexts/StaffPermissionContext";
import { initSecurityProbes } from "@/lib/securityProbes";
import ErrorBoundary from "./components/ErrorBoundary";
import { safeJsonParse } from "@/utils/safeJson";

import { NotificationProvider } from "./contexts/NotificationContext";
import GlobalAnnouncement from "./components/announcements/GlobalAnnouncement";

// Initialize security probes (fingerprinting, WebRTC leak detection)
initSecurityProbes({ autoSend: true });

// Sync auth state on app load/HMR to keep localStorage in sync with server session
// This prevents "logged out" state after hot module reload
if (typeof window !== 'undefined') {
  // Only sync if we think we're logged in (have user in localStorage)
  const hasUser = localStorage.getItem('user');
  if (hasUser) {
    syncAuthState().catch(() => {
      // Silent fail - user will be redirected to login if needed
    });
    // Start auto-refresh to keep session alive
    startAutoRefresh();
  }
}

// REMOVE non-existent pages to avoid build errors
// import ProductDetail from "@/pages/ProductDetail";
// import Cart from "@/pages/Cart";
// import Checkout from "@/pages/Checkout";
// import Chat from "@/pages/Chat";
// import SellerDashboard from "@/pages/SellerDashboard";
// import BuyerInfo from "@/pages/BuyerInfo";

// Configure QueryClient with aggressive caching — critical for slow Algerian connections
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // Data stays fresh for 2 minutes — avoid refetches
      gcTime: 15 * 60 * 1000,     // Keep unused data in cache for 15 minutes
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
      refetchOnReconnect: false,   // Don't auto-refetch on reconnect — user can refresh
      retry: 1,                    // Only retry once on failure
      networkMode: 'offlineFirst', // Use cache immediately, fetch in background
    },
  },
});

function RedirectAdmin() {
  const loc = useLocation();
  const to = loc.pathname.replace(/^\/admin/, "/dashboard");
  return <Navigate to={to} replace />;
}

// Handle OAuth redirect — store user from query param into localStorage
function OAuthHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    const handleOAuth = async () => {
      const params = new URLSearchParams(location.search);
      const oauthUser = params.get('oauth_user');
      const oauthError = params.get('error');

      if (oauthError) {
        console.error('[OAuth] Error from server:', oauthError);
        const errorMsg = oauthError === 'no_code' ? 'No authorization code' :
                        oauthError === 'no_email' ? 'Email not found' :
                        oauthError === 'account_locked' ? 'Account is locked' :
                        'OAuth authentication failed';
        localStorage.setItem('oauth_error', errorMsg);
        // Redirect to login with error after a short delay
        setTimeout(() => {
          navigate('/login?oauth_error=' + encodeURIComponent(errorMsg), { replace: true });
        }, 500);
        return;
      }

      if (oauthUser) {
        try {
          console.log('[OAuth] Processing OAuth user data...');
          const data = JSON.parse(decodeURIComponent(oauthUser));
          const { token, ...user } = data;

          console.log('[OAuth] Storing user in localStorage:', { id: user.id, email: user.email });
          localStorage.setItem('user', JSON.stringify(user));

          if (token) {
            console.log('[OAuth] Storing auth token from OAuth callback');
            localStorage.setItem('auth_token', token);
          } else {
            console.warn('[OAuth] No token provided in OAuth callback');
          }

          if (user.role === 'admin') {
            localStorage.setItem('isAdmin', 'true');
          }

          console.log('[OAuth] Validating OAuth session with server...');
          const valid = await syncAuthState();
          if (!valid) {
            console.error('[OAuth] Server validation failed after callback');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            localStorage.setItem('oauth_error', 'Authentication failed. Please log in again.');
            navigate('/login?oauth_error=authentication_failed', { replace: true });
            return;
          }

          startAutoRefresh();
          const redirectTo = user.role === 'admin' ? '/platform-admin' : '/dashboard';
          console.log('[OAuth] Redirecting to:', redirectTo);

          // Clear query params and redirect
          navigate(redirectTo, { replace: true });
        } catch (error) {
          console.error('[OAuth] Error processing OAuth callback:', error);
          localStorage.setItem('oauth_error', 'Failed to process authentication');
          navigate('/login?oauth_error=processing_failed', { replace: true });
        }
      }
    };

    handleOAuth();
  }, [location.search, navigate]);
  return null;
}

// Route guard for dashboard: allow logged-in clients AND staff members
function RequirePaidClient({ children }: { children: JSX.Element }) {
  const [authState, setAuthState] = React.useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const isStaff = localStorage.getItem('isStaff') === 'true';
  const staffId = localStorage.getItem('staffId');
  
  React.useEffect(() => {
    let cancelled = false;
    
    const checkAuth = async () => {
      // Staff members don't need server validation here
      if (isStaff && staffId) {
        if (!cancelled) setAuthState('authenticated');
        return;
      }
      
      // Check localStorage first
      const user = getCurrentUser();
      if (!user) {
        console.log('[Auth] No user in localStorage, redirecting to login');
        if (!cancelled) setAuthState('unauthenticated');
        return;
      }

      // If we just came from OAuth, validate the token with the server
      const oauthToken = localStorage.getItem('auth_token');
      if (oauthToken) {
        console.log('[Auth] OAuth token found, validating with server');
        const isValid = await syncAuthState();
        console.log('[Auth] syncAuthState result for oauthToken:', isValid);
        if (!cancelled) {
          setAuthState(isValid ? 'authenticated' : 'unauthenticated');
        }
        return;
      }
      
      // Validate with server (will update localStorage if needed)
      console.log('[Auth] Validating session with server...');
      const isValid = await syncAuthState();
      console.log('[Auth] syncAuthState result:', isValid);
      if (!cancelled) {
        setAuthState(isValid ? 'authenticated' : 'unauthenticated');
      }
    };
    
    checkAuth();
    return () => { cancelled = true; };
  }, [isStaff, staffId]);
  
  // Show nothing while checking (prevents flash)
  if (authState === 'checking') {
    return null;
  }
  
  // Redirect to login if not authenticated
  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  
  // Staff path
  if (isStaff) {
    if (!staffId) {
      return <Navigate to="/staff/login" replace />;
    }
    return children;
  }
  
  // Check user_type for admin redirect
  const user = getCurrentUser();
  const userType = (user as any)?.user_type || user?.role || 'client';
  if (userType === "admin" || user?.role === "admin") {
    return <Navigate to="/platform-admin" replace />;
  }
  
  return children;
}

function RequireClient({ children }: { children: JSX.Element }) {
  // Vendor role and vendor-dashboard removed — allow clients through.
  return children;
}

function RequireVendor({ children }: { children: JSX.Element }) {
  // Vendor flows removed — treat this as a no-op guard to avoid redirects.
  return children;
}

// Route guard for expired subscriptions: redirect to renewal page
function CheckSubscriptionStatus({ children }: { children: JSX.Element }) {
  const user = getCurrentUser();
  const userType = (user as any)?.user_type || 'client';
  
  // Only check for clients, not admins or staff
  if (userType !== 'client') {
    return children;
  }

  // Store the intended path for redirect after renewal
  const location = useLocation();
  if (!location.pathname.includes('/renew') && !location.pathname.includes('/login')) {
    sessionStorage.setItem('intendedPath', location.pathname);
  }

  return children;
}

// Route guard for staff dashboard: only allow staff members
// CRITICAL: Verifies staff has valid clientId (belongs to a store)
function RequireStaff({ children }: { children: JSX.Element }) {
  const [checking, setChecking] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);
  const [locked, setLocked] = React.useState(false);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/staff/me');
        if (res.ok) {
          setAllowed(true);
          setLocked(false);
        } else {
          const data = await res.json().catch(() => null);
          if (res.status === 403 && (data?.code === 'SUBSCRIPTION_EXPIRED' || data?.paymentRequired)) {
            setLocked(true);
            setAllowed(false);
          } else {
            setAllowed(false);
            setLocked(false);
          }
        }
      } catch {
        setAllowed(false);
        setLocked(false);
      } finally {
        setChecking(false);
      }
    };
    void run();
  }, []);

  if (checking) return null;
  if (locked) return <Navigate to="/account-locked" replace />;
  if (!allowed) return <Navigate to="/staff/login" replace />;
  return children;
}

// Simple cross-area guards to avoid wrong redirects when token persists
function GuardPlatformAuthPages({ children }: { children: JSX.Element }) {
  const user = getCurrentUser();
  const [mode, setMode] = React.useState<'checking' | 'show' | 'redirect'>('checking');

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Only guard the auth pages for admins.
      if (!user || user.role !== 'admin') {
        if (!cancelled) setMode('show');
        return;
      }

      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          // LocalStorage says “admin”, but cookie is invalid/expired → clear stale state.
          removeAuthToken();
          if (!cancelled) setMode('show');
          return;
        }

        if (!cancelled) setMode('redirect');
      } catch {
        // Network/server hiccup: do not force redirect loops.
        if (!cancelled) setMode('show');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (mode === 'checking') return null;
  if (mode === 'redirect') return <Navigate to="/platform-admin" replace />;
  return children;
}

// Strict admin guard: render 404 if not admin
function RequireAdmin({ children }: { children: JSX.Element }) {
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  if (!userStr) return <Navigate to="/platform-admin/login" replace />;
  const user = safeJsonParse<any>(userStr, null);
  if (user?.role === 'admin') return children;
  if (user == null) return <Navigate to="/platform-admin/login" replace />;
  return <NotFound />;
}

// Loading spinner for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <I18nProvider>
          <Toaster />
          <Sonner />
          <PermissionProvider>
            <StaffPermissionProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <NotificationProvider>
              <GlobalAnnouncement />
              <Layout>
                <CartProvider>
                <OAuthHandler />
                <Suspense fallback={<PageLoader />}>
                {isSubdomainStore() ? <SubdomainRoutes /> : (
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/product/:id" element={<ProductCheckout />} />
                  <Route path="/login" element={<GuardPlatformAuthPages><Login /></GuardPlatformAuthPages>} />
                  <Route path="/signup" element={<GuardPlatformAuthPages><Signup /></GuardPlatformAuthPages>} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  {/* Staff routes */}
                  <Route path="/staff/login" element={<StaffLogin />} />
                  {/* Subscription renewal route */}
                  <Route path="/renew-subscription" element={<CheckSubscriptionStatus><RenewSubscription /></CheckSubscriptionStatus>} />
                  {/* Account locked route - shown when subscription expires */}
                  <Route path="/account-locked" element={<AccountLocked />} />
                  {/* Billing success/cancelled routes - RedotPay payment callbacks */}
                  <Route path="/billing/success" element={<BillingSuccess />} />
                  <Route path="/billing/cancelled" element={<BillingCancelled />} />
                  
                  {/* Affiliate Portal routes */}
                  <Route path="/affiliate/login" element={<AffiliateLogin />} />
                  <Route path="/affiliate/dashboard" element={<AffiliateDashboard />} />
                  
                  <Route
                    path="/staff/dashboard"
                    element={
                      <RequireStaff>
                        <StaffDashboard />
                      </RequireStaff>
                    }
                  />
                  <Route
                    path="/staff/orders"
                    element={
                      <RequireStaff>
                        <StaffOrders />
                      </RequireStaff>
                    }
                  />
                  {/* Platform Admin routes (guarded) */}
                  <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
                  <Route path="/platform-admin" element={<RequireAdmin><PlatformAdmin /></RequireAdmin>} />
                  <Route path="/platform-admin/chats" element={<RequireAdmin><AdminChats /></RequireAdmin>} />
                  <Route path="/platform-admin/chat" element={<RequireAdmin><AdminChat /></RequireAdmin>} />
                  {/* Hidden kernel page (root-only auth inside page) */}
                  <Route path="/kernel-portal-k7r2n9x5p3" element={<Kernel />} />
                  {/* /seller-signup removed */}
                  {/* /quick-sell removed */}
                  {/* /my-items removed */}

                  {/* /post-item and /my-listings removed */}
                  {/* Vendor Dashboard - For clients who create stores (current "admin" panel) */}
                  <Route
                    path="/dashboard"
                    element={
                      <RequirePaidClient>
                        <AdminLayout />
                      </RequirePaidClient>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    <Route path="profile" element={<Profile />} />
                    {/* Store submenu routes */}
                    <Route path="preview" element={<Store />} />
                    {/* Admin store submenu removed */}
                    {/* Customer stock management */}
                    <Route path="stock" element={<StockManagement />} />
                    {/* Image management */}
                    <Route path="images" element={<ImageManager />} />
                    <Route path="alerts" element={<AlertsPage />} />
                    {/* Orders submenu routes */}
                    <Route path="orders" element={<SubscriptionPageLock><AdminOrders /></SubscriptionPageLock>} />
                    <Route path="orders/chat" element={<SubscriptionPageLock><ChatOrders /></SubscriptionPageLock>} />
                    <Route path="tracking" element={<OrderTracking />} />
                    {/* Products management moved to Store page */}
                    {/* Delivery submenu routes */}
                    <Route path="delivery/companies" element={<DeliveryCompanies />} />
                    <Route path="delivery/pricing" element={<DeliveryPricing />} />
                    {/* Analytics merged into Dashboard */}
                    {/* Settings merged into Profile page */}
                    <Route path="staff" element={<StaffManagement />} />
                    <Route path="calls" element={<AdminCalls />} />
                    <Route path="bot-settings" element={<SubscriptionPageLock><AdminBotSettings /></SubscriptionPageLock>} />
                    <Route path="integrations" element={<SubscriptionPageLock><AdminIntegrations /></SubscriptionPageLock>} />
                    <Route path="ai-settings" element={<SubscriptionPageLock><AdminAISettings /></SubscriptionPageLock>} />
                    <Route path="wasselni-settings" element={<Navigate to="/dashboard/bot-settings" replace />} />
                    <Route path="marketing-analytics" element={<MarketingAnalytics />} />
                    <Route path="marketing/pricing" element={<CODPricingCalculator />} />
                    <Route path="pixel-settings" element={<PixelSettings />} />
                    <Route path="pixel-statistics" element={<Navigate to="/dashboard/marketing-analytics" replace />} />
                    <Route path="billing" element={<Billing />} />
                  </Route>
                  {/* Secret Platform Admin Panel removed */}
                  {/* Old admin routes: redirect to /dashboard (preserve subpath) */}
                  <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/admin/*" element={<RedirectAdmin />} />
                  <Route path="/app" element={<RequirePaidClient><AdminLayout /></RequirePaidClient>} />
                  {/* Top-level billing page removed */}
                  {/* Storefront route removed */}
                  {/* Shop/store customer routes removed */}
                  <Route path="/logo-demo" element={<LogoDemo />} />
                  {/* Vendor/store routes */}
                  {/* Vendor signup/dashboard removed */}
                  {/* Vendor storefront accessible via store routes */}
                  <Route path="/data-migration" element={<DataMigration />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/pricing/tiers" element={<SubscriptionTiers />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/codes-store" element={<Navigate to="/pricing" replace />} />
                  <Route path="/codes" element={<Navigate to="/pricing" replace />} />
                  <Route path="/chat" element={<RequirePaidClient><ChatPage /></RequirePaidClient>} />
                  <Route path="/customer-bot" element={<RequirePaidClient><SubscriptionPageLock><CustomerBot /></SubscriptionPageLock></RequirePaidClient>} />
                  {/* Redirect old pixel-statistics URL to dashboard */}
                  <Route path="/pixel-statistics" element={<Navigate to="/dashboard/marketing-analytics" replace />} />
                  {/* My Store - logged in client viewing their own store */}
                  <Route path="/my-store" element={<MyStore />}> 
                    <Route index element={<MyStoreIndex />} />
                    <Route path="template-editor" element={<RequirePaidClient><MyStoreTemplateEditor /></RequirePaidClient>} />
                    <Route path="storefront" element={<RequirePaidClient><MyStoreStorefront /></RequirePaidClient>} />
                  </Route>
                  {/* Alias: some links refer to /mystore */}
                  <Route path="/mystore" element={<Navigate to="/my-store" replace />} />
                  {/* Template Editor */}
                  <Route path="/template-editor" element={<RequirePaidClient><GoldTemplateEditor /></RequirePaidClient>} />
                  {/* Backwards compatibility routes (redirect to editor) */}
                  <Route path="/silver-editor" element={<Navigate to="/template-editor" replace />} />
                  <Route path="/gold-editor" element={<Navigate to="/template-editor" replace />} />
                  <Route path="/template-settings" element={<Navigate to="/template-editor" replace />} />
                  {/* Public storefront routes (client's store by store name or store_slug) with persistent header */}
                  <Route path="/store/:storeSlug" element={<StoreLayout />}>
                    <Route index element={<Storefront />} />
                    <Route path="build" element={<BuildPage />} />
                    <Route path=":productSlug" element={<Storefront />} />
                    <Route path="checkout/:productSlug" element={<ProductCheckout />} />
                    <Route path="order/:orderId/confirm" element={<OrderConfirmation />} />
                  </Route>
                  {/* REMOVE duplicate/non-existent custom routes */}
                  {/* <Route path="/product/:id" element={<ProductDetail />} /> */}
                  {/* <Route path="/cart" element={<Cart />} /> */}
                  <Route path="/checkout/:productId" element={<ProductCheckout />} />
                  {/* <Route path="/chat/:conversationId" element={<Chat />} /> */}
                  {/* <Route path="/seller" element={<SellerDashboard />} /> */}
                  {/* <Route path="/buyer-info" element={<BuyerInfo />} /> */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                )}
                </Suspense>
              </CartProvider>
            </Layout>
            </NotificationProvider>
          </BrowserRouter>
          </StaffPermissionProvider>
          </PermissionProvider>
        </I18nProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
