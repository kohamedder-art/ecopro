import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, Calendar, Star, TrendingUp, MoreHorizontal, ChevronDown, Package, X, Sparkles, Loader2, MapPin, AlertTriangle, Brain
} from 'lucide-react';
import { useTranslation } from "@/lib/i18n";
import { useAI } from '@/hooks/useAI';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentUser } from '@/lib/auth';

interface DashboardStats {
  products: number;
  orders: number;
  revenue: number;
  pendingOrders: number;
  completedOrders: number;
  visitors: number;
}

interface Analytics {
  dailyRevenue: { date: string; orders: number; revenue: number; total_value: number }[];
  dailyViews: { date: string; views: number }[];
  customStatuses: { key?: string; name: string; color: string; icon: string }[];
  topProducts: any[];
  recentOrders: { id: number; customer_name: string; customer_phone: string; total_price: number; status: string; created_at: string; product_title: string }[];
  statusBreakdown: { status: string; count: number; revenue: number }[];
  cityBreakdown: { city: string; count: number; revenue: number }[];
}

export default function Dashboard() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const { data: aiSettings } = useAISettings();
  const user = getCurrentUser();
  const userName = user?.name || 'User';
  const [stats, setStats] = useState<DashboardStats>({
    products: 0, orders: 0, revenue: 0, pendingOrders: 0, completedOrders: 0, visitors: 0
  });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dayRange, setDayRange] = useState(7);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [newOrders, setNewOrders] = useState<Analytics['recentOrders']>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string>(() => {
    return localStorage.getItem('dashboard_last_seen') || new Date(Date.now() - 86400000).toISOString();
  });
  const notifRef = useRef<HTMLDivElement>(null);
  const dayPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [dayRange]);

  // Poll new order count every 60s
  useEffect(() => {
    loadNewOrderCount();
    const interval = setInterval(loadNewOrderCount, 60000);
    return () => clearInterval(interval);
  }, [lastSeenAt]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (dayPickerRef.current && !dayPickerRef.current.contains(e.target as Node)) setShowDayPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?days=${dayRange}`),
        fetch(`/api/dashboard/analytics?days=${dayRange}`)
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const generateAINarration = async () => {
    if (!aiSettings?.analytics_narration || !analytics) return;
    try {
      const res = await fetch('/api/ai/analytics/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stats, analytics, days: dayRange }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.narration) toast({ title: 'AI Summary', description: data.narration });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkChurnWarning = async () => {
    if (!aiSettings?.churn_warning || !analytics?.dailyRevenue) return;
    try {
      const revenueHistory = analytics.dailyRevenue.map((d: any) => ({
        date: d.date,
        revenue: d.revenue,
      }));
      const res = await fetch('/api/ai/analytics/churn-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ revenueHistory }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warning) {
          toast({ 
            title: 'Churn Warning', 
            description: data.warning,
            variant: 'destructive'
          });
        } else {
          toast({ title: 'Revenue Trend', description: 'No significant decline detected' });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateInventoryForecast = async () => {
    if (!aiSettings?.inventory_forecast) return;
    try {
      const res = await fetch('/api/ai/analytics/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.forecast) {
          toast({ 
            title: 'Inventory Forecast', 
            description: data.forecast,
            duration: 15000 
          });
        }
      }
    } catch (e) {
      toast({ 
        title: 'Error', 
        description: 'Failed to generate forecast',
        variant: 'destructive'
      });
    }
  };

  const analyzeOmniBehavior = async () => {
    if (!aiSettings?.omni_intelligence) return;
    try {
      const res = await fetch('/api/ai/analyze-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days: 30, locale }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          toast({ 
            title: t('dashboard.omniIntelligence') || 'Omni Intelligence', 
            description: data.summary,
            duration: 20000 
          });
        }
      }
    } catch (e) {
      toast({ 
        title: 'Error', 
        description: 'Failed to analyze behavior',
        variant: 'destructive'
      });
    }
  };

  const loadNewOrderCount = async () => {
    try {
      const res = await fetch(`/api/orders/new-count?since=${encodeURIComponent(lastSeenAt)}`);
      if (res.ok) {
        const data = await res.json();
        setNewOrderCount(data.count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openNotifications = async () => {
    setShowNotif(v => !v);
    if (!showNotif) {
      // Load the actual new orders to show in dropdown
      try {
        const res = await fetch(`/api/orders/new-count?since=${encodeURIComponent(lastSeenAt)}`);
        // Re-use recent orders from analytics for the dropdown list
        const recentRes = await fetch('/api/dashboard/analytics?days=1');
        if (recentRes.ok) {
          const data = await recentRes.json();
          setNewOrders((data.recentOrders || []).slice(0, 6));
        }
      } catch (e) {}
    }
  };

  const markAllSeen = () => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    localStorage.setItem('dashboard_last_seen', now);
    setNewOrderCount(0);
    setShowNotif(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const currentHourGreeting = getGreeting();

  // Detect RTL for proper chart direction
  const isRTL = t('direction') === 'rtl' || document.dir === 'rtl' || ['ar', 'he', 'ur'].includes(t('locale'));

  const rawChartData = analytics?.dailyRevenue && analytics.dailyRevenue.length > 0
    ? analytics.dailyRevenue.slice(-10)
    : [];

  // Sort chronologically (oldest date first) so chart flows left-to-right
  const chartData = [...rawChartData].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  const maxRevenue = Math.max(...chartData.map(d => Number(d.revenue) || 0), 1);
  const maxOrders = Math.max(...chartData.map(d => Number(d.orders) || 1), 1);

  const points = chartData.map((d, i) => {
    const x = (i / Math.max(chartData.length - 1, 1)) * 100;
    const y = 100 - ((Number(d.revenue) || 0) / maxRevenue) * 100;
    return `${x},${y}`;
  }).join(' ');

  const ordersPoints = chartData.map((d, i) => {
    const x = (i / Math.max(chartData.length - 1, 1)) * 100;
    const y = 100 - ((Number(d.orders) || 0) / maxOrders) * 100;
    return `${x},${y}`;
  }).join(' ');

  const totalRevenuePeriod = chartData.reduce((s, d) => s + (Number(d.revenue) || 0), 0);
  const totalOrdersPeriod = chartData.reduce((s, d) => s + (Number(d.orders) || 0), 0);

  const visitorsPoints = (() => {
    const rawViewsData = analytics?.dailyViews && analytics.dailyViews.length > 0 ? analytics.dailyViews : [];
    // Sort chronologically (oldest date first)
    const viewsData = [...rawViewsData].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
    if (viewsData.length === 0) return chartData.map((d, i) => {
      const x = (i / Math.max(chartData.length - 1, 1)) * 100;
      return `${x},50`;
    }).join(' ');
    const maxViews = Math.max(...viewsData.map((d: any) => Number(d.views) || 0), 1);
    return viewsData.map((d: any, i: number) => {
      const x = (i / Math.max(viewsData.length - 1, 1)) * 100;
      const y = 100 - ((Number(d.views) || 0) / maxViews) * 100;
      return `${x},${y}`;
    }).join(' ');
  })();

  const cityData = analytics?.cityBreakdown && analytics.cityBreakdown.length > 0
    ? analytics.cityBreakdown.slice(0, 6)
    : [];
  const maxCityCount = Math.max(...cityData.map(c => c.count), 1);

  const statuses: { status: string; count: number; revenue?: number }[] = analytics?.statusBreakdown || [];

  const totalBreakdown = statuses.reduce((sum: number, s) => sum + s.count, 0) || 1;

  let currentAngle = 0;
  const gradientSlices = statuses.slice(0, 3).map((s, i) => {
    const colors = ['#10B981', '#F59E0B', '#EF4444'];
    const percentage = (s.count / totalBreakdown) * 100;
    const slice = `${colors[i]} ${currentAngle}% ${currentAngle + percentage}%`;
    currentAngle += percentage;
    return slice;
  }).join(', ');

  const finalConicStr = gradientSlices || '#10B981 0% 100%';

  const topSellers = analytics?.topProducts && analytics.topProducts.length > 0
    ? analytics.topProducts.slice(0, 4)
    : [];

  const totalOrders = stats.orders || 0;
  const completedOrders = stats.completedOrders || 0;
  const conversionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';
  const revenueGrowth = analytics?.dailyRevenue && analytics.dailyRevenue.length >= 2
    ? (() => {
        const recent = analytics.dailyRevenue.slice(-7).reduce((s, d) => s + (Number(d.revenue) || 0), 0);
        const prev = analytics.dailyRevenue.slice(-14, -7).reduce((s, d) => s + (Number(d.revenue) || 0), 0);
        return prev > 0 ? `${recent >= prev ? '+' : ''}${((recent - prev) / prev * 100).toFixed(0)}%` : recent > 0 ? '+100%' : '0%';
      })()
    : '0%';
  const grossMargin = stats.revenue > 0 ? ((stats.revenue - (stats.revenue * 0.6)) / stats.revenue * 100).toFixed(1) : '0';

  const topCards = [
    { label: t('dashboard.kpi.earnMonth'), val: stats.revenue > 0 ? stats.revenue.toLocaleString() : '0', bg: 'bg-[#4379EE]', shadow: 'shadow-[#4379EE]/30', icon: '💰' },
    { label: t('dashboard.kpi.earnGrowth'), val: revenueGrowth, bg: 'bg-[#FF5A5F]', shadow: 'shadow-[#FF5A5F]/30', icon: '📈' },
    { label: t('dashboard.conversionRate'), val: `${conversionRate}%`, bg: 'bg-[#FFAB00]', shadow: 'shadow-[#FFAB00]/30', icon: '🛒' },
    { label: t('dashboard.kpi.grossProfit'), val: `${grossMargin}%`, bg: 'bg-[#FF8A00]', shadow: 'shadow-[#FF8A00]/30', icon: '⚖️' }
  ];

  return (
    <div className="flex flex-col bg-transparent font-sans text-slate-900 dark:text-slate-100 p-2 sm:p-4 -mx-4 -mt-2 md:-mx-6 md:-mt-3">

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 bg-white dark:bg-[#111] p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mb-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 dark:text-white">
            {currentHourGreeting} {userName}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">{t('dashboard.welcomeDashboard')}</p>
        </div>

        <div className="flex flex-1 items-center max-w-xl mx-auto lg:mx-4 relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 w-4 h-4" />
          <input
            type="text"
            placeholder={t('dashboard.searchPlaceholder')}
            className="w-full pl-11 pr-4 py-2 bg-[#F8F9FB] dark:bg-slate-800 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all dark:text-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-2 lg:mt-0">
          {/* AI Narration */}
          {aiSettings?.analytics_narration && (
            <button
              onClick={generateAINarration}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('dashboard.aiSummary') || 'AI Summary'}
            </button>
          )}

          {/* Churn Warning */}
          {aiSettings?.churn_warning && (
            <button
              onClick={checkChurnWarning}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('dashboard.churnCheck') || 'Churn Check'}
            </button>
          )}

          {/* Inventory Forecast */}
          {aiSettings?.inventory_forecast && (
            <button
              onClick={generateInventoryForecast}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              {t('dashboard.inventoryForecast') || 'Forecast'}
            </button>
          )}

          {/* Omni Intelligence */}
          {aiSettings?.omni_intelligence && (
            <button
              onClick={analyzeOmniBehavior}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              {t('dashboard.omniIntelligence') || 'Omni AI'}
            </button>
          )}

          {/* Day range picker */}
          <div className="relative hidden sm:block" ref={dayPickerRef}>
            <button
              onClick={() => setShowDayPicker(v => !v)}
              className="flex items-center gap-2 bg-[#F8F9FB] dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('dashboard.days', { n: dayRange })}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showDayPicker ? 'rotate-180' : ''}`} />
            </button>
            {showDayPicker && (
              <div className="absolute ltr:right-0 rtl:left-0 top-full mt-1 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 min-w-[110px]">
                {[7, 14, 30, 60, 90].map(d => (
                  <button key={d} onClick={() => { setDayRange(d); setShowDayPicker(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${
                      dayRange === d ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}>
                    {t('dashboard.days', { n: d })}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={openNotifications} className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              {newOrderCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                  {newOrderCount > 99 ? '99+' : newOrderCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute ltr:right-0 rtl:left-0 top-full mt-2 w-80 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.newOrders')}</span>
                    {newOrderCount > 0 && (
                      <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{newOrderCount}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {newOrderCount > 0 && (
                      <button onClick={markAllSeen} className="text-[11px] text-blue-500 hover:text-blue-600 font-semibold">{t('dashboard.markAllSeen')}</button>
                    )}
                    <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {newOrders.length === 0 ? (
                    <div className="py-8 text-center">
                      <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 font-semibold">{t('dashboard.noNewOrders')}</p>
                      <p className="text-xs text-slate-300 mt-0.5">{t('dashboard.allCaughtUp')}</p>
                    </div>
                  ) : (
                    newOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{order.customer_name}</p>
                          <p className="text-xs text-slate-400 truncate">{order.product_title} &bull; {order.total_price?.toLocaleString()} DZD</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500'
                        }`}>{order.status}</span>
                      </div>
                    ))
                  )}
                </div>
                {newOrders.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
                    <a href="/dashboard/orders" className="text-sm text-blue-500 hover:text-blue-600 font-semibold">{t('dashboard.viewAllOrders')}</a>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`} className="w-7 h-7 rounded-full bg-slate-200" alt="avatar" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">{t('dashboard.owner')} <ChevronDown className="w-3 h-3" /></p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-2 w-full max-w-[1400px] mx-auto">

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {topCards.map((card, i) => (
            <div key={i} className="bg-white dark:bg-[#111] py-3 px-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center hover:shadow-md transition-all">
              <div className={`w-8 h-8 ${card.bg} ${card.shadow} rounded-2xl flex items-center justify-center text-white text-xl shadow-lg mb-1.5 hover:scale-105 transition-transform`}>
                {card.icon}
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight leading-tight">{card.val}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">

          {/* Revenue & Orders Chart */}
          <div className="lg:col-span-6 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.goalCompletion')}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-lg font-black text-slate-800 dark:text-white">{totalRevenuePeriod.toLocaleString()} <span className="text-xs font-bold text-slate-400">DZD</span></span>
                  <span className="text-xs font-bold text-slate-400">|</span>
                  <span className="text-sm font-bold text-slate-500">{totalOrdersPeriod} {t('dashboard.ordersLabel')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#4379EE]"></div><span className="text-slate-500">{t('dashboard.revenueLabel')}</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10B981]"></div><span className="text-slate-500">{t('dashboard.ordersLabel')}</span></div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold bg-[#F8F9FB] dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  {t('dashboard.lastNDays', { n: dayRange })}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-1">
              <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold items-start pr-2 z-10 hidden sm:flex">
                <span>{maxRevenue.toLocaleString()}</span>
                <span>{Math.round(maxRevenue * 0.75).toLocaleString()}</span>
                <span>{Math.round(maxRevenue * 0.5).toLocaleString()}</span>
                <span>{Math.round(maxRevenue * 0.25).toLocaleString()}</span>
                <span>0</span>
              </div>
              <div className="flex-1 flex flex-col min-h-[120px] sm:min-h-[100px]">
                <div className="relative flex-1 w-full min-h-[120px] sm:min-h-[100px]">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-md overflow-hidden">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4379EE" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4379EE" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map(y => (
                      <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeWidth="0.5" strokeDasharray="2,2" />
                    ))}
                    {/* Orders area + line (behind) */}
                    <polygon points={`0,100 ${ordersPoints} 100,100`} fill="url(#ordersGrad)" />
                    <polyline points={ordersPoints} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
                    {/* Revenue area + line (front) */}
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#chartFill)" />
                    <polyline points={points} fill="none" stroke="#4379EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {points.split(' ').map((p, i) => {
                      const [x, y] = p.split(',');
                      return (i % 3 === 0) ? <circle key={i} cx={x} cy={y} r="1.5" fill="#fff" stroke="#4379EE" strokeWidth="1" /> : null;
                    })}
                  </svg>
                </div>
                <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1.5 uppercase" dir="ltr">
                  {(() => {
                    const step = Math.max(1, Math.floor((chartData.length - 1) / 5));
                    const indices = [0, step, step*2, step*3, step*4, chartData.length - 1].filter((v, i, a) => a.indexOf(v) === i && v < chartData.length);
                    return indices.map(idx => {
                      const raw = chartData[idx]?.date || '';
                      try {
                        const d = new Date(raw);
                        if (!isNaN(d.getTime())) return <span key={idx}>{d.toLocaleDateString('en', { day: '2-digit', month: 'short' })}</span>;
                      } catch {}
                      return <span key={idx}>{raw}</span>;
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Order Status Donut */}
          <div className="lg:col-span-3 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.orderStatus')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.earningsUpThisMonth')}</p>
              </div>
              <MoreHorizontal className="text-slate-300 w-5 h-5 cursor-pointer" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div
                className="w-20 h-20 rounded-full relative shadow-sm"
                style={{ background: `conic-gradient(${finalConicStr})` }}
              >
                <div className="absolute inset-[8px] bg-white dark:bg-[#111] rounded-full flex items-center justify-center shadow-inner">
                  <span className="text-base font-black text-slate-800 dark:text-white">{statuses.length > 0 ? `${Math.round((statuses.find(s => s.status === 'completed')?.count || 0) / totalBreakdown * 100)}%` : '0%'}</span>
                </div>
              </div>

              <div className="flex flex-col w-full px-2 gap-2">
                {statuses.slice(0, 3).map((s, i) => {
                  const colors = ['bg-[#10B981]', 'bg-[#F59E0B]', 'bg-[#EF4444]'];
                  const percent = Math.round((s.count / totalBreakdown) * 100);
                  const statusLabel = t(`orders.status.${s.status}`) || s.status.replace(/_/g, ' ');
                  return (
                    <div key={i} className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colors[i]}`}></div>
                        <span className="text-slate-500 capitalize">{statusLabel}</span>
                      </div>
                      <span className="text-slate-800 dark:text-white">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Store Performance Rating */}
          <div className="lg:col-span-3 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">تقييم المتجر</h3>
              <MoreHorizontal className="text-slate-300 w-5 h-5" />
            </div>

            {(() => {
              const visitors = stats.visitors || 0;
              const orders = stats.orders || 0;
              // orders per 100 visitors
              const ordersPerHundred = visitors > 0 ? (orders / visitors) * 100 : 0;
              const rounded = Math.round(ordersPerHundred * 10) / 10;

              let tier: { label: string; color: string; bg: string; stars: number; tip: string };
              if (rounded >= 4) {
                tier = { label: 'ممتاز', color: 'text-emerald-500', bg: 'bg-emerald-500', stars: 5, tip: 'تسويقك مثالي — الآن وقت زيادة ميزانية الإعلانات!' };
              } else if (rounded >= 3) {
                tier = { label: 'جيد', color: 'text-teal-500', bg: 'bg-teal-400', stars: 4, tip: 'متجر ناجح — معظم المتاجر الاحترافية هنا.' };
              } else if (rounded >= 2) {
                tier = { label: 'متوسط', color: 'text-yellow-500', bg: 'bg-yellow-400', stars: 3, tip: 'معيار الصناعة — حسّن وصف المنتجات أو تصميم المتجر.' };
              } else if (rounded >= 1) {
                tier = { label: 'أقل من المتوسط', color: 'text-orange-500', bg: 'bg-orange-400', stars: 2, tip: 'مبيعات موجودة — لكن تكلفة الإعلانات مرتفعة مقارنة بالعائد.' };
              } else if (visitors === 0) {
                tier = { label: 'لا يوجد بيانات', color: 'text-slate-400', bg: 'bg-slate-300', stars: 0, tip: 'لم يتم تسجيل زيارات بعد.' };
              } else {
                tier = { label: 'ضعيف', color: 'text-red-500', bg: 'bg-red-400', stars: 1, tip: 'شيء معطوب — تحقّق من زر الطلب والسعر وثقة الزوار.' };
              }

              const tiers = [
                { label: 'ممتاز (4-5)', range: '4–5 طلبات', color: 'bg-emerald-500', active: rounded >= 4 },
                { label: 'جيد (3)', range: '3 طلبات', color: 'bg-teal-400', active: rounded >= 3 && rounded < 4 },
                { label: 'متوسط (2)', range: '2 طلبات', color: 'bg-yellow-400', active: rounded >= 2 && rounded < 3 },
                { label: 'أقل (1)', range: '1 طلب', color: 'bg-orange-400', active: rounded >= 1 && rounded < 2 },
                { label: 'ضعيف (0)', range: '0 طلبات', color: 'bg-red-400', active: rounded < 1 && visitors > 0 },
              ];

              // bar width: map 0-5 orders/100 to 0-100%
              const barWidths = [100, 80, 60, 40, 20];

              return (
                <>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex text-[#FFAB00]">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={14}
                          fill={s <= tier.stars ? '#FFAB00' : 'transparent'}
                          stroke={s <= tier.stars ? '#FFAB00' : '#cbd5e1'}
                          strokeWidth="1.5"
                        />
                      ))}
                    </div>
                    <span className={`text-lg font-black ${tier.color}`}>{tier.label}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mb-2 font-semibold">
                    {visitors > 0 ? `${rounded} طلب لكل 100 زائر` : 'لا توجد بيانات كافية'}
                  </p>

                  <div className="flex-1 space-y-1.5">
                    {tiers.map((r, i) => (
                      <div key={r.label} className="flex items-center gap-2">
                        <span className={`w-16 text-[10px] font-semibold truncate ${r.active ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{r.label}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${r.color} ${r.active ? 'opacity-100' : 'opacity-30'}`}
                            style={{ width: `${barWidths[i]}%` }}
                          />
                        </div>
                        <span className={`w-6 text-right text-[10px] font-bold ${r.active ? 'text-slate-800 dark:text-white' : 'text-slate-300'}`}>
                          {r.active ? '◄' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">{tier.tip}</p>
                </>
              );
            })()}
          </div>

        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">

          {/* Top Seller */}
          <div className="lg:col-span-4 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">{t('dashboard.topSeller')}</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 font-semibold">{t('dashboard.table.profile')}</th>
                  <th className="pb-2 font-semibold">{t('dashboard.table.cityGeo')}</th>
                  <th className="pb-2 text-right font-semibold">{t('dashboard.table.sales')}</th>
                </tr>
              </thead>
              <tbody>
                {topSellers.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-xs text-slate-400">{t('dashboard.noData') || 'No data yet'}</td></tr>
                ) : topSellers.map((seller, i) => (
                  <tr key={i} className="group cursor-pointer">
                    <td className="py-1 border-b border-slate-50 dark:border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <img src={seller.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.title}`} className="w-8 h-8 rounded-full bg-slate-100" alt="avatar" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{String(seller.title).substring(0, 15)}</span>
                      </div>
                    </td>
                    <td className="py-1 border-b border-slate-50 dark:border-slate-800/50">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <div className="w-4 h-3 bg-slate-200 rounded shrink-0 shadow-sm border border-slate-300"></div>
                        {seller.total_orders || 'Local'}
                      </span>
                    </td>
                    <td className="py-1 border-b border-slate-50 dark:border-slate-800/50 text-right">
                      <span className="text-xs font-black text-slate-800 dark:text-white">{seller.price || seller.total_revenue || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Store Visitors Chart */}
          <div className="lg:col-span-5 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.storeImpressions')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{stats.visitors > 0 ? `${stats.visitors.toLocaleString()} ${t('dashboard.lastNDays', { n: dayRange })}` : t('dashboard.goalCompletionDesc')}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <div className="w-2 h-2 rounded-full bg-[#06B6D4]"></div>
                <span className="text-slate-500">{t('dashboard.visitors') || 'زوار'}</span>
              </div>
            </div>
            {(() => {
              const rawViewsData: {date: string; views: number}[] = analytics?.dailyViews ?? [];
              // Sort chronologically (oldest first)
              const viewsData = [...rawViewsData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              const cumulativeViews = viewsData.reduce((acc, item) => {
                const last = acc.length > 0 ? acc[acc.length - 1].views : 0;
                acc.push({ date: item.date, views: last + (Number(item.views) || 0) });
                return acc;
              }, [] as {date: string; views: number}[]);

              const maxViews = Math.max(stats.visitors || 0, ...cumulativeViews.map(d => Number(d.views) || 0), 1);
              const vPoints = cumulativeViews.length > 1
                ? cumulativeViews.map((d, i) => {
                    const x = (i / (cumulativeViews.length - 1)) * 100;
                    const y = 100 - ((Number(d.views) || 0) / maxViews) * 100;
                    return `${x},${y}`;
                  }).join(' ')
                : cumulativeViews.length === 1 ? `0,${100 - ((Number(cumulativeViews[0].views) || 0) / maxViews) * 100} 100,${100 - ((Number(cumulativeViews[0].views) || 0) / maxViews) * 100}` : '0,50 100,50';

              const yAxisLabels = cumulativeViews.length > 0
                ? [maxViews, Math.ceil(maxViews * 0.75), Math.ceil(maxViews * 0.5), Math.ceil(maxViews * 0.25), 0]
                : [0, 0, 0, 0, 0];
              const xLabels = cumulativeViews.length === 0
                ? []
                : (() => {
                    const step = Math.max(1, Math.floor((cumulativeViews.length - 1) / 5));
                    return [0, step, step*2, step*3, step*4, cumulativeViews.length - 1]
                      .filter((v, i, a) => a.indexOf(v) === i && v < cumulativeViews.length);
                  })();

              return (
                <div className="flex w-full flex-1">
                  <div className="flex flex-col text-[10px] text-slate-400 font-bold items-start pr-2 z-10 sm:flex">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-2">{t('dashboard.visitors') || 'Visitors'}</span>
                    <div className="flex-1 flex flex-col justify-between h-full">
                      {yAxisLabels.map((label, idx) => (
                        <span key={idx}>{label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col min-h-[120px] sm:min-h-[100px]">
                    <div className="relative flex-1 w-full min-h-[120px] sm:min-h-[100px]">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-md overflow-hidden">
                        <defs>
                          <linearGradient id="chartFillVisitors" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        {[20, 40, 60, 80].map(y => (
                          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeWidth="0.5" strokeDasharray="2,2" />
                        ))}
                        <polygon points={`0,100 ${vPoints} 100,100`} fill="url(#chartFillVisitors)" />
                        <polyline points={vPoints} fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1.5 uppercase overflow-hidden" dir="ltr">
                      {viewsData.length === 0
                        ? <span className="text-slate-400 text-xs w-full text-center">{t('dashboard.noData') || 'No data yet'}</span>
                        : xLabels.map(idx => {
                            const raw = viewsData[idx]?.date || '';
                            try {
                              const d = new Date(raw);
                              if (!isNaN(d.getTime())) return <span key={idx}>{d.toLocaleDateString('en', { day: '2-digit', month: 'short' })}</span>;
                            } catch {}
                            return <span key={idx}>{raw}</span>;
                          })
                      }
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Orders by Wilaya */}
          <div className="lg:col-span-3 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#4379EE]" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.ordersByWilaya')}</h3>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {cityData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6">
                  <p className="text-xs text-slate-400 font-semibold">{t('dashboard.noOrdersYet')}</p>
                </div>
              ) : cityData.map((city, i) => {
                const barWidth = Math.max((city.count / maxCityCount) * 100, 8);
                const colors = ['bg-[#4379EE]', 'bg-[#10B981]', 'bg-[#F59E0B]', 'bg-[#8B5CF6]', 'bg-[#EC4899]', 'bg-[#06B6D4]'];
                const displayCity = city.city === 'Not specified' ? t('dashboard.notSpecified') : city.city;
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{displayCity}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500">{city.count}</span>
                        <span className="text-[9px] text-slate-400">{city.revenue?.toLocaleString()} DZD</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${barWidth}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* AI Insights Row */}
      <AIInsightsCard stats={stats} analytics={analytics} dayRange={dayRange} />

      {/* Mobile spacing for sidebar button */}
      <div className="h-20 lg:hidden"></div>

    </div>
  );
}

// ─── AI Insights Card ────────────────────────────────────────────────────────
function AIInsightsCard({ stats, analytics, dayRange }: { stats: any; analytics: any; dayRange: number }) {
  const { t, locale } = useTranslation();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { call: callNarrate, loading: loadingNarrate } = useAI('/api/ai/analytics/narrate');
  const { call: callForecast, loading: loadingForecast } = useAI('/api/ai/analytics/forecast');
  const [forecast, setForecast] = useState<any[]>([]);

  const generate = async () => {
    if (!stats) return;
    const [narrateData, forecastData] = await Promise.all([
      callNarrate({ stats, analytics, days: dayRange, locale }),
      callForecast({ locale }),
    ]);
    if (narrateData?.narrative) setNarrative(narrateData.narrative);
    if (forecastData?.forecast) setForecast(forecastData.forecast.slice(0, 3));

    // Check for churn warning
    if (analytics?.dailyRevenue?.length >= 3) {
      const csrf = document.cookie.match(/ecopro_csrf=([^;]+)/)?.[1] || '';
      try {
        const r = await fetch('/api/ai/analytics/churn-warning', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf) },
          body: JSON.stringify({ revenueHistory: analytics.dailyRevenue, locale }),
        });
        if (r.ok) { const d = await r.json(); if (d?.warning) setWarning(d.warning); }
      } catch { /* non-critical */ }
    }
  };

  const loading = loadingNarrate || loadingForecast;

  return (
    <div className="bg-white dark:bg-[#111] rounded-xl border border-slate-100 dark:border-slate-800 p-3 shadow-sm mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.aiInsights')}</h3>
        </div>
        {!narrative && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {t('dashboard.analyzeWithAI')}
          </button>
        )}
        {narrative && (
          <button
            onClick={() => { setNarrative(null); setForecast([]); setWarning(null); }}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
          >
            {t('dashboard.aiRefresh')}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          <span>{t('dashboard.aiAnalyzing')}</span>
        </div>
      )}

      {!loading && narrative && (
        <div className="space-y-2">
          {warning && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2">
              <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">{warning}</p>
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{narrative}</p>
          {forecast.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t('dashboard.restockForecast')}</p>
              <div className="flex flex-col gap-1">
                {forecast.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[60%]">{f.title}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        f.expectedDemand === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : f.expectedDemand === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-500'
                      }`}>{f.expectedDemand}</span>
                      <span className="text-slate-400 text-[10px] truncate max-w-[120px]">{f.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !narrative && (
        <p className="text-xs text-slate-400 text-center py-3">
          {t('dashboard.aiEmptyHint')}
        </p>
      )}
    </div>
  );
}
