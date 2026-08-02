import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Bell, Calendar, ChevronDown, TrendingUp, TrendingDown,
  Package, Clock, Truck, ShoppingBag, ArrowUpRight, ArrowDownRight, Star
} from 'lucide-react';
import { useTranslation } from "@/lib/i18n";
import { useToast } from '@/components/ui/use-toast';
import { getCurrentUser } from '@/lib/auth';
import { OnboardingWizard } from '@/components/admin/OnboardingWizard';

interface DashboardStats {
  products: number;
  orders: number;
  revenue: number;
  pendingOrders: number;
  completedOrders: number;
  visitors: number;
  adSpend: number;
}

interface Analytics {
  dailyRevenue: { date: string; orders: number; revenue: number; total_value: number }[];
  dailyViews: { date: string; views: number }[];
  customStatuses: { key?: string; name: string; color: string; icon: string }[];
  topProducts: any[];
  recentOrders: { id: number; customer_name: string; customer_phone: string; total_price: number; status: string; created_at: string; product_title: string }[];
  statusBreakdown: { status: string; count: number; revenue: number }[];
  comparisons: {
    today: { orders: number; revenue: number; ordersGrowth: number; revenueGrowth: number };
    thisWeek: { orders: number; revenue: number; ordersGrowth: number; revenueGrowth: number };
    thisMonth: { orders: number; revenue: number; ordersGrowth: number; revenueGrowth: number };
    allTime: { orders: number; revenue: number; ordersGrowth: number; revenueGrowth: number };
  };
}

export default function Dashboard() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const user = getCurrentUser();
  const userName = user?.name || 'User';
  const [stats, setStats] = useState<DashboardStats>({
    products: 0, orders: 0, revenue: 0, pendingOrders: 0, completedOrders: 0, visitors: 0, adSpend: 0
  });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dayRange, setDayRange] = useState(30);
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

  useEffect(() => {
    loadNewOrderCount();
    const interval = setInterval(loadNewOrderCount, 60000);
    return () => clearInterval(interval);
  }, [lastSeenAt]);

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
    } catch (error) { console.error(error); }
  };

  const loadNewOrderCount = async () => {
    try {
      const res = await fetch(`/api/orders/new-count?since=${encodeURIComponent(lastSeenAt)}`);
      if (res.ok) { const data = await res.json(); setNewOrderCount(data.count || 0); }
    } catch (e) { console.error(e); }
  };

  const openNotifications = async () => {
    if (newOrderCount > 0) {
      try {
        const res = await fetch(`/api/dashboard/analytics?days=1`);
        if (res.ok) { const data = await res.json(); setNewOrders(data.recentOrders || []); }
      } catch (e) { console.error(e); }
    }
    setShowNotif(!showNotif);
    if (newOrderCount > 0) {
      setNewOrderCount(0);
      setLastSeenAt(new Date().toISOString());
      localStorage.setItem('dashboard_last_seen', new Date().toISOString());
    }
  };

  const chartData = analytics?.dailyRevenue ?? [];
  const recentOrders = analytics?.recentOrders ?? [];
  const topProducts = analytics?.topProducts ?? [];
  const statusBreakdown = analytics?.statusBreakdown ?? [];
  const comparisons = analytics?.comparisons;

  const maxRevenue = Math.max(...chartData.map(d => Number(d.revenue) || 0), 1);
  const maxOrders = Math.max(...chartData.map(d => Number(d.orders) || 0), 1);
  const points = chartData.length > 1
    ? chartData.map((d, i) => {
        const x = (i / (chartData.length - 1)) * 100;
        const y = 100 - ((Number(d.revenue) || 0) / maxRevenue) * 100;
        return `${x},${y}`;
      }).join(' ')
    : '0,50 100,50';
  const ordersPoints = chartData.length > 1
    ? chartData.map((d, i) => {
        const x = (i / (chartData.length - 1)) * 100;
        const y = 100 - ((Number(d.orders) || 0) / maxOrders) * 100;
        return `${x},${y}`;
      }).join(' ')
    : '0,50 100,50';

  const totalRevenuePeriod = chartData.reduce((s, d) => s + (Number(d.revenue) || 0), 0);
  const totalOrdersPeriod = chartData.reduce((s, d) => s + (Number(d.orders) || 0), 0);
  const dayOptions = [7, 14, 30, 60, 90];

  const getStatusDisplay = (statusKey: string) => {
    // Built-in statuses — ALWAYS use translation (never DB name)
    const defaults: Record<string, { name: string; color: string; icon: string }> = {
      pending:            { name: t('orders.status.pending'),            color: '#f59e0b', icon: '⏳' },
      confirmed:          { name: t('orders.status.confirmed'),          color: '#3b82f6', icon: '✓' },
      processing:         { name: t('orders.status.processing'),         color: '#8b5cf6', icon: '⚙' },
      shipped:            { name: t('orders.status.shipped'),            color: '#06b6d4', icon: '📦' },
      in_delivery:        { name: t('orders.status.in_delivery'),        color: '#f97316', icon: '🚚' },
      at_delivery:        { name: t('orders.status.in_delivery'),        color: '#f97316', icon: '🚚' },
      out_for_delivery:   { name: t('orders.status.in_delivery'),        color: '#f97316', icon: '🚚' },
      delivered:          { name: t('orders.status.delivered'),          color: '#22c55e', icon: '✅' },
      completed:          { name: t('orders.status.completed'),          color: '#10b981', icon: '✅' },
      cancelled:          { name: t('orders.status.cancelled'),          color: '#ef4444', icon: '✕' },
      declined:           { name: t('orders.status.declined'),           color: '#ef4444', icon: '✕' },
      returned:           { name: t('orders.status.returned'),           color: '#ef4444', icon: '↩' },
      failed:             { name: t('orders.status.failed'),             color: '#ef4444', icon: '⚠' },
      fake:               { name: t('orders.status.fake'),               color: '#ef4444', icon: '🚫' },
      duplicate:          { name: t('orders.status.duplicate'),          color: '#f97316', icon: '📋' },
      no_answer_1:        { name: t('orders.status.no_answer_1'),        color: '#f59e0b', icon: '📞' },
      no_answer_2:        { name: t('orders.status.no_answer_2'),        color: '#f59e0b', icon: '📞' },
      no_answer_3:        { name: t('orders.status.no_answer_3'),        color: '#f59e0b', icon: '📞' },
      waiting_callback:   { name: t('orders.status.waiting_callback'),   color: '#8b5cf6', icon: '📞' },
      postponed:          { name: t('orders.status.postponed'),          color: '#6366f1', icon: '📅' },
      line_closed:        { name: t('orders.status.line_closed'),        color: '#ef4444', icon: '📵' },
      didnt_pickup:       { name: t('orders.status.didnt_pickup'),       color: '#ef4444', icon: '📦' },
      delivery_failed:    { name: t('orders.status.delivery_failed'),    color: '#ef4444', icon: '🚚' },
      followup:           { name: t('orders.status.followup'),           color: '#06b6d4', icon: '🔄' },
      refunded:           { name: t('orders.status.refunded'),           color: '#ef4444', icon: '💰' },
      archived:           { name: t('orders.status.archived'),           color: '#6b7280', icon: '📁' },
      assigned:           { name: t('orders.status.shipped'),            color: '#06b6d4', icon: '👤' },
      picked_up:          { name: t('orders.status.shipped'),            color: '#06b6d4', icon: '📦' },
      ready_for_pickup:   { name: t('orders.status.in_delivery'),        color: '#f97316', icon: '📦' },
      at_hub:             { name: t('orders.status.in_delivery'),        color: '#f97316', icon: '🏢' },
    };
    if (defaults[statusKey]) return defaults[statusKey];

    // Custom statuses — use DB name (user-defined, already translated by user)
    const found = analytics?.customStatuses?.find(s => s.key === statusKey || s.name === statusKey);
    if (found) return { name: found.name, color: found.color, icon: found.icon };

    return { name: statusKey.replace(/_/g, ' '), color: '#6b7280', icon: '•' };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('dashboard.goodNight');
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const actionCount = statusBreakdown.filter(s => ['pending', 'processing', 'confirmed'].includes(s.status)).reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#0a0a0a] flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-[52px] bg-white dark:bg-[#111] border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-md">
              {(userName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#111]"></div>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-800 dark:text-white">{getGreeting()} {userName}</p>
            <p className="text-[10px] text-slate-400 font-semibold">{t('dashboard.owner')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={dayPickerRef}>
            <button onClick={() => setShowDayPicker(!showDayPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Calendar className="w-3.5 h-3.5" />
              {dayRange} {t('dashboard.days')}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showDayPicker && (
              <div className="absolute end-0 mt-1 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 min-w-[100px]">
                {dayOptions.map(d => (
                  <button key={d} onClick={() => { setDayRange(d); setShowDayPicker(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                      ${d === dayRange ? 'bg-indigo-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {d} {t('dashboard.days')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={notifRef}>
            <button onClick={openNotifications}
              className="relative w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Bell className="w-4 h-4" />
              {newOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center animate-bounce">
                  {newOrderCount > 9 ? '9+' : newOrderCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute end-0 mt-1 w-72 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{t('dashboard.notifications')}</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {newOrders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">{t('dashboard.noNewOrders')}</div>
                  ) : newOrders.slice(0, 5).map((order, i) => (
                    <div key={i} className="px-3 py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">{order.customer_name}</span>
                        <span className="text-[10px] font-bold text-indigo-500">{Math.round(Number(order.total_price) || 0)} DZD</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{order.product_title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <OnboardingWizard />

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-3 max-w-[1400px] mx-auto w-full">

        {/* ═══ ROW 1: Today's Pulse ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Today Revenue */}
          <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-emerald-200 dark:border-emerald-900/40">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">💰</span>
              <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">{t('dashboard.todayRevenue')}</span>
            </div>
            <div className="bg-white dark:bg-[#111] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {(comparisons?.today?.revenue ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">DZD</span>
                </h3>
                {(comparisons?.today?.revenueGrowth ?? 0) !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${(comparisons?.today?.revenueGrowth ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {(comparisons?.today?.revenueGrowth ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(comparisons?.today?.revenueGrowth ?? 0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Today Orders */}
          <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-blue-200 dark:border-blue-900/40">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">{t('dashboard.todayOrders')}</span>
            </div>
            <div className="bg-white dark:bg-[#111] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {comparisons?.today?.orders ?? 0}
                </h3>
                {(comparisons?.today?.ordersGrowth ?? 0) !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${(comparisons?.today?.ordersGrowth ?? 0) >= 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {(comparisons?.today?.ordersGrowth ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(comparisons?.today?.ordersGrowth ?? 0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* This Week */}
          <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-violet-200 dark:border-violet-900/40">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">📈</span>
              <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">{t('dashboard.weekRevenue')}</span>
            </div>
            <div className="bg-white dark:bg-[#111] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {(comparisons?.thisWeek?.revenue ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">DZD</span>
                </h3>
                {(comparisons?.thisWeek?.revenueGrowth ?? 0) !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${(comparisons?.thisWeek?.revenueGrowth ?? 0) >= 0 ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {(comparisons?.thisWeek?.revenueGrowth ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(comparisons?.thisWeek?.revenueGrowth ?? 0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-amber-200 dark:border-amber-900/40">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">{t('dashboard.pendingOrders')}</span>
            </div>
            <div className="bg-white dark:bg-[#111] px-3 py-2.5">
              <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.pendingOrders}
              </h3>
            </div>
          </div>
        </div>

        {/* ═══ ROW 2: Action Required + Revenue Chart ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">

          {/* Action Required */}
          <div className="lg:col-span-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-800 dark:from-amber-700 dark:via-slate-800 dark:to-black px-3 py-2.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">{t('dashboard.actionRequired')}</h3>
              {actionCount > 0 && (
                <span className="ml-auto bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {actionCount}
                </span>
              )}
            </div>
            <div className="bg-white dark:bg-[#111] divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto">
              {recentOrders.filter(o => ['pending', 'processing', 'confirmed'].includes(o.status)).length === 0 ? (
                <div className="p-6 text-center">
                  <span className="text-2xl">✅</span>
                  <p className="text-xs font-bold text-slate-400 mt-2">{t('dashboard.allCaughtUp')}</p>
                </div>
              ) : (
                recentOrders.filter(o => ['pending', 'processing', 'confirmed'].includes(o.status)).slice(0, 5).map((order, i) => {
                  const s = getStatusDisplay(order.status);
                  return (
                    <div key={i} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: `${s.color}20` }}>
                            {s.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{order.customer_name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{order.product_title}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-black text-slate-800 dark:text-white">{Math.round(Number(order.total_price) || 0)} DZD</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                            {s.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Revenue & Orders Chart */}
          <div className="lg:col-span-8 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-slate-800 dark:from-blue-700 dark:via-slate-800 dark:to-black px-3 py-2.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">{totalRevenuePeriod.toLocaleString()}</span>
                  <span className="text-xs font-bold text-white/60">DZD</span>
                  <span className="text-xs font-bold text-white/30">|</span>
                  <span className="text-xs font-bold text-white/80">{totalOrdersPeriod} {t('dashboard.ordersLabel')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                  <span>{t('dashboard.revenueLabel')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70">
                  <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
                  <span>{t('dashboard.ordersLabel')}</span>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-[#111] p-3">
              <div className="flex w-full min-h-[130px]">
                <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold items-start pr-2 hidden sm:flex">
                  <span>{maxRevenue.toLocaleString()}</span>
                  <span>{Math.round(maxRevenue * 0.5).toLocaleString()}</span>
                  <span>0</span>
                </div>
                <div className="flex-1 flex flex-col min-h-[130px]">
                  <div className="relative flex-1 w-full min-h-[130px]">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full rounded-md overflow-hidden">
                      <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4379EE" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#4379EE" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[25, 50, 75].map(y => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeWidth="0.5" strokeDasharray="2,2" />
                      ))}
                      <polygon points={`0,100 ${ordersPoints} 100,100`} fill="url(#ordersGrad)" />
                      <polyline points={ordersPoints} fill="none" stroke="#10B981" strokeWidth="1" strokeDasharray="4,3" />
                      <polygon points={`0,100 ${points} 100,100`} fill="url(#chartFill)" />
                      <polyline points={points} fill="none" stroke="#4379EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mt-1.5 uppercase" dir="ltr">
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
          </div>
        </div>

        {/* ═══ ROW 3: Pipeline + Top Products ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">

          {/* Pipeline */}
          <div className="lg:col-span-7 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 dark:from-teal-700 dark:via-slate-800 dark:to-black px-3 py-2.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-white" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">{t('dashboard.pipeline')}</h3>
            </div>
            <div className="bg-white dark:bg-[#111] p-3">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {statusBreakdown.slice(0, 5).map((s, i) => {
                  const display = getStatusDisplay(s.status);
                  const maxCount = Math.max(...statusBreakdown.map(x => x.count), 1);
                  const barWidth = Math.max((s.count / maxCount) * 100, 10);
                  return (
                    <div key={i} className="text-center p-2.5 rounded-lg border-2 transition-colors hover:shadow-sm"
                      style={{ borderColor: `${display.color}30`, background: `${display.color}08` }}>
                      <span className="text-xl">{display.icon}</span>
                      <div className="text-xl font-black tabular-nums mt-1" style={{ color: display.color }}>{s.count}</div>
                      <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-tight">{display.name}</div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: display.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="lg:col-span-5 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-slate-800 dark:from-amber-600 dark:via-slate-800 dark:to-black px-3 py-2.5 flex items-center gap-2">
              <Star className="w-4 h-4 text-white" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">{t('dashboard.topSeller')}</h3>
            </div>
            <div className="bg-white dark:bg-[#111] divide-y divide-slate-100 dark:divide-slate-800">
              {topProducts.length === 0 ? (
                <div className="p-6 text-center">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400 mt-2">{t('dashboard.noData')}</p>
                </div>
              ) : topProducts.slice(0, 4).map((p, i) => (
                <div key={i} className="px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{String(p.title).substring(0, 20)}</p>
                    <p className="text-[10px] text-slate-400">{p.total_orders || 0} {t('dashboard.ordersLabel')}</p>
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-white shrink-0">{Math.round(p.total_revenue || 0).toLocaleString()} <span className="text-[9px] font-bold text-slate-400">DZD</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ ROW 4: Recent Orders ═══ */}
        <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-800 dark:from-indigo-700 dark:via-slate-800 dark:to-black px-3 py-2.5 flex items-center gap-2">
            <Package className="w-4 h-4 text-white" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">{t('dashboard.recentOrders')}</h3>
            <span className="text-[10px] font-bold text-white/50">{t('dashboard.lastNDays', { n: dayRange })}</span>
          </div>
          <div className="bg-white dark:bg-[#111] overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="px-3 py-2 font-semibold">{t('dashboard.table.profile')}</th>
                  <th className="px-3 py-2 font-semibold">{t('orders.product')}</th>
                  <th className="px-3 py-2 font-semibold">{t('orders.status')}</th>
                  <th className="px-3 py-2 font-semibold text-right">{t('orders.amount')}</th>
                  <th className="px-3 py-2 font-semibold">{t('orders.time')}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400 font-semibold">{t('dashboard.noData')}</td></tr>
                ) : recentOrders.slice(0, 7).map((order, i) => {
                  const s = getStatusDisplay(order.status);
                  const timeDiff = Date.now() - new Date(order.created_at).getTime();
                  const mins = Math.floor(timeDiff / 60000);
                  let timeStr = mins < 1 ? 'الآن' : mins < 60 ? `${mins} ${locale === 'ar' ? 'د' : 'm'}` : `${Math.floor(mins/60)} ${locale === 'ar' ? 'س' : 'h'}`;
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                            {(order.customer_name || '?').charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[100px]">{order.customer_name}</p>
                            <p className="text-[10px] text-slate-400">{order.customer_phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{order.product_title}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                          {s.icon} {s.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs font-black text-slate-800 dark:text-white text-right">{Math.round(Number(order.total_price) || 0).toLocaleString()} DZD</td>
                      <td className="px-3 py-2 text-[10px] font-bold text-slate-400">{timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="h-20 lg:hidden"></div>
    </div>
  );
}
