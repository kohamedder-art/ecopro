import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, Calendar, Star, TrendingUp, MoreHorizontal, ChevronDown, Package, X, Sparkles, Loader2
} from 'lucide-react';
import { useTranslation } from "@/lib/i18n";
import { useAI } from '@/hooks/useAI';
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
  customStatuses: { key?: string; name: string; color: string; icon: string }[];
  topProducts: any[];
  recentOrders: { id: number; customer_name: string; customer_phone: string; total_price: number; status: string; created_at: string; product_title: string }[];
  statusBreakdown: { status: string; count: number; revenue: number }[];
  cityBreakdown: { city: string; count: number; revenue: number }[];
}

export default function Dashboard() {
  const { t } = useTranslation();
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
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (error) {
      console.error(error);
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

  const chartData = analytics?.dailyRevenue && analytics.dailyRevenue.length > 0
    ? analytics.dailyRevenue.slice(-10)
    : [];

  const maxRevenue = Math.max(...chartData.map(d => Number(d.revenue) || Number((d as any).total_value) || 1), 1);

  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - ((Number(d.revenue) || Number((d as any).total_value) || 0) / maxRevenue) * 100;
    return `${x},${y}`;
  }).join(' ');

  const visitorsPoints = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - ((Number(d.orders) || 0) / Math.max(...chartData.map(o => Number(o.orders) || 1), 1)) * 100;
    return `${x},${y}`;
  }).join(' ');

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

  const recentTasks = analytics?.recentOrders && analytics.recentOrders.length > 0
    ? analytics.recentOrders.slice(0, 4)
    : [];

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const md = Math.floor((Date.now() - d.getTime()) / 60000);
    if (md < 60) return t('dashboard.minutesAgo', { n: md });
    if (md < 1440) return t('dashboard.hoursAgo', { n: Math.floor(md / 60) });
    return t('dashboard.daysAgo', { n: Math.floor(md / 1440) });
  };

  return (
    <div className="flex flex-col bg-[#F8F9FB] dark:bg-black font-sans text-slate-900 dark:text-slate-100 p-2 sm:p-4 -mx-4 -mt-2 md:-mx-6 md:-mt-3">

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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

          {/* Goal Completion Chart */}
          <div className="lg:col-span-6 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.goalCompletion')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{stats.revenue > 0 ? `${stats.revenue} DZD` : t('dashboard.goalCompletionDesc')}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold bg-[#F8F9FB] dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                {t('dashboard.lastNDays', { n: dayRange })}
              </div>
            </div>

            <div className="flex w-full">
              <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold items-start pr-2 z-10 hidden sm:flex" style={{height:'90px'}}>
                <span>{maxRevenue}</span>
                <span>{Math.round(maxRevenue * 0.75)}</span>
                <span>{Math.round(maxRevenue * 0.5)}</span>
                <span>{Math.round(maxRevenue * 0.25)}</span>
                <span>0</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="relative h-[100px] w-full">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-md overflow-hidden">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4379EE" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4379EE" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map(y => (
                      <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeWidth="0.5" strokeDasharray="2,2" />
                    ))}
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#chartFill)" />
                    <polyline points={points} fill="none" stroke="#4379EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {points.split(' ').map((p, i) => {
                      const [x, y] = p.split(',');
                      return (i % 3 === 0) ? <circle key={i} cx={x} cy={y} r="1.5" fill="#fff" stroke="#4379EE" strokeWidth="1" /> : null;
                    })}
                  </svg>
                </div>
                <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1.5 uppercase">
                  {(() => {
                    // Pick ~6 evenly-spaced labels from the actual chart data
                    const step = Math.max(1, Math.floor((chartData.length - 1) / 5));
                    const indices = [0, step, step*2, step*3, step*4, chartData.length - 1].filter((v, i, a) => a.indexOf(v) === i && v < chartData.length);
                    return indices.map(idx => {
                      const raw = chartData[idx]?.date || '';
                      // Format: if it's a full ISO date, show short form
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
                  return (
                    <div key={i} className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colors[i]}`}></div>
                        <span className="text-slate-500 capitalize">{s.status.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-slate-800 dark:text-white">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Customer Reviews */}
          <div className="lg:col-span-3 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.customerReviews')}</h3>
              <MoreHorizontal className="text-slate-300 w-5 h-5" />
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <div className="flex text-[#FFAB00]">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={16} fill="transparent" stroke="#cbd5e1" strokeWidth="1.5" />
                ))}
              </div>
              <span className="text-lg font-black text-slate-800 dark:text-white">0</span>
            </div>
            <p className="text-[9px] text-slate-400 mb-2 font-semibold">{t('dashboard.overallRating')}</p>

            <div className="flex-1 space-y-1.5">
              {[
                { label: t('dashboard.rating.excellent'), val: 0, color: 'bg-emerald-500' },
                { label: t('dashboard.rating.good'), val: 0, color: 'bg-teal-400' },
                { label: t('dashboard.rating.average'), val: 0, color: 'bg-yellow-400' },
                { label: t('dashboard.rating.avgBelow'), val: 0, color: 'bg-orange-400' },
                { label: t('dashboard.rating.poor'), val: 0, color: 'bg-red-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-slate-500 font-semibold">{r.label}</span>
                  <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.val * 2}%` }}></div>
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-slate-800 dark:text-white">{r.val}</span>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <button className="w-full py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[#4379EE] text-xs font-bold border border-blue-100 dark:border-blue-900 hover:bg-[#4379EE] hover:text-white transition-colors">
                {t('dashboard.seeAllReviews')}
              </button>
            </div>
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

          {/* Store Impressions Chart */}
          <div className="lg:col-span-5 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.storeImpressions')}</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#4379EE]"></div><span className="text-slate-500">{t('dashboard.chart.new')}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8CAEFF]"></div><span className="text-slate-500">{t('dashboard.chart.returning')}</span></div>
              </div>
            </div>

            <div className="flex w-full">
              <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold items-start pr-2 z-10 hidden sm:flex" style={{height:'90px'}}>
                <span>20k</span>
                <span>15k</span>
                <span>10k</span>
                <span>5k</span>
                <span>0k</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="relative h-[100px] w-full">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-md overflow-hidden">
                    <defs>
                      <linearGradient id="chartFill2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4379EE" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#4379EE" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="chartFill3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8CAEFF" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#8CAEFF" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map(y => (
                      <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeWidth="0.5" strokeDasharray="2,2" />
                    ))}
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#chartFill3)" />
                    <polyline points={points} fill="none" stroke="#8CAEFF" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points={`0,100 ${visitorsPoints} 100,100`} fill="url(#chartFill2)" />
                    <polyline points={visitorsPoints} fill="none" stroke="#4379EE" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 font-bold mt-1.5 capitalize">
                  {chartData.length > 0
                    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 7) === 0 || i === chartData.length - 1).map((d, i) => <span key={i}>{d.date}</span>)
                    : <span className="text-slate-400 text-xs w-full text-center">{t('dashboard.noData') || 'No data yet'}</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Task Last Month */}
          <div className="lg:col-span-3 bg-white dark:bg-[#111] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('dashboard.taskLastMonth')}</h3>
              <MoreHorizontal className="text-slate-300 w-5 h-5" />
            </div>

            <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 text-xs font-bold text-slate-400">
              <span className="text-[#4379EE] border-b-2 border-[#4379EE] pb-2 cursor-pointer -mb-[9px] relative z-10">{t('dashboard.tab.all')}</span>
              <span className="cursor-pointer hover:text-slate-600 transition">{t('dashboard.tab.complete')}</span>
              <span className="cursor-pointer hover:text-slate-600 transition">{t('dashboard.tab.order')}</span>
            </div>

            <div className="flex-1 space-y-0 relative pl-4 border-l border-slate-100 dark:border-slate-800">
              {recentTasks.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">{t('dashboard.noData') || 'No data yet'}</div>
              ) : recentTasks.map((task, i) => (
                <div key={i} className="relative py-1">
                  <div className={`absolute -left-[21px] top-[18px] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111] shadow-sm ${i === 0 ? 'bg-[#10B981]' : i === 1 ? 'bg-[#FFAB00]' : 'bg-slate-300'}`}></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug">{task.customer_name || t('dashboard.systemNotification')}</span>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[10px] text-slate-400 font-medium">#{task.id} - {t('dashboard.system')}</span>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{timeAgo(task.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* AI Insights Row */}
      <AIInsightsCard stats={stats} analytics={analytics} dayRange={dayRange} />

    </div>
  );
}

// ─── AI Insights Card ────────────────────────────────────────────────────────
function AIInsightsCard({ stats, analytics, dayRange }: { stats: any; analytics: any; dayRange: number }) {
  const { t } = useTranslation();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { call: callNarrate, loading: loadingNarrate } = useAI('/api/ai/analytics/narrate');
  const { call: callForecast, loading: loadingForecast } = useAI('/api/ai/analytics/forecast');
  const [forecast, setForecast] = useState<any[]>([]);

  const generate = async () => {
    if (!stats) return;
    const [narrateData, forecastData] = await Promise.all([
      callNarrate({ stats, analytics, days: dayRange }),
      callForecast({}),
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
          body: JSON.stringify({ revenueHistory: analytics.dailyRevenue }),
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
          Click "Analyze with AI" to get a plain-language summary of your store performance, demand forecasts, and trend warnings.
        </p>
      )}
    </div>
  );
}
