import { useEffect, useState, useMemo } from 'react';
import {
  Users, Store, Lock, TrendingUp, ArrowUpRight, ArrowDownRight,
  Activity, Clock, Zap, BarChart3, Eye, Loader2, Sparkles
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface PlatformStats {
  totalUsers: number;
  totalClients: number;
  totalAdmins: number;
  lockedAccounts: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  totalCodes: number;
  redeemedCodes: number;
  pendingCodes: number;
  expiredCodes: number;
  newSignupsWeek: number;
  newSignupsMonth: number;
  totalProducts?: number;
}

interface GrowthMetrics {
  weeklySignups: { week: string; signups: number }[];
  weeklyPayments: { week: string; payments: number; revenue: number }[];
  weeklyPaidSubs: { week: string; new_paid: number }[];
  mrr: number;
  activeSubs: number;
  tempPaid: number;
  subscriptionPrice: number;
  storeHealth: {
    clientId: number;
    storeName: string;
    storeSlug: string;
    email: string;
    subscriptionStatus: string;
    orders30d: number;
    orders7d: number;
    productCount: number;
    lastOrderAt: string | null;
    healthScore: number;
  }[];
  recentActivity: { type: string; id: number; client_id: number; detail: string; created_at: string }[];
}

interface Props {
  stats: PlatformStats;
  onNavigate: (tab: string) => void;
}

const SPARKLINE_COLORS = {
  signups: { stroke: '#818cf8', fill: 'rgba(129,140,248,0.1)' },
  payments: { stroke: '#34d399', fill: 'rgba(52,211,153,0.1)' },
  revenue: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.1)' },
  newPaid: { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.1)' },
};

function MiniSparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: { stroke: string; fill: string } }) {
  if (!data?.length) return <div className="h-10 w-full" />;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color.stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color.stroke} fill={`url(#grad-${dataKey})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KPICard({ title, value, subtitle, icon: Icon, color, sparkData, sparkKey, sparkColor, trend, onClick }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color: string;
  sparkData?: any[];
  sparkKey?: string;
  sparkColor?: { stroke: string; fill: string };
  trend?: { value: number; label: string };
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-500/5 border-blue-500/30',
    emerald: 'from-emerald-600/20 to-emerald-500/5 border-emerald-500/30',
    amber: 'from-amber-600/20 to-amber-500/5 border-amber-500/30',
    red: 'from-red-600/20 to-red-500/5 border-red-500/30',
    purple: 'from-purple-600/20 to-purple-500/5 border-purple-500/30',
    cyan: 'from-cyan-600/20 to-cyan-500/5 border-cyan-500/30',
  };
  const textColor: Record<string, string> = {
    blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400',
    red: 'text-red-400', purple: 'text-purple-400', cyan: 'text-cyan-400',
  };

  return (
    <div
      className={`group relative bg-gradient-to-br ${colorMap[color]} backdrop-blur-xl rounded-2xl border p-4 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Glossy shine */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{title}</p>
          <h3 className={`text-2xl font-black ${textColor[color]} mt-0.5`}>{value}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-xl bg-white/5 ${textColor[color]} opacity-40 group-hover:opacity-70 transition-opacity`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkKey && sparkColor && (
        <div className="mt-1 -mx-1">
          <MiniSparkline data={sparkData} dataKey={sparkKey} color={sparkColor} />
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          {trend.value >= 0 ? (
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-red-400" />
          )}
          <span className={`text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-slate-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export default function OverviewTab({ stats, onNavigate }: Props) {
  const { t } = useTranslation();
  const [growth, setGrowth] = useState<GrowthMetrics | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/growth-metrics', { credentials: 'include' });
        if (res.ok) {
          setGrowth(await res.json());
        }
      } catch { /* ignore */ }
      setGrowthLoading(false);
    })();
  }, []);

  const subscriptionData = useMemo(() => [
    { name: t('platformAdmin.stores.active'), value: stats.activeSubscriptions, color: '#10b981' },
    { name: t('platformAdmin.stores.trial'), value: stats.trialSubscriptions, color: '#f59e0b' },
    { name: t('platformAdmin.stores.expired'), value: stats.expiredSubscriptions, color: '#ef4444' },
  ].filter(d => d.value > 0), [stats]);

  const topStores = growth?.storeHealth?.slice(0, 5) || [];
  const weakStores = growth?.storeHealth?.filter(s => s.healthScore < 30)?.slice(0, 5) || [];

  return (
    <div className="space-y-4">
      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('platformAdmin.overview.totalUsers')}
          value={stats.totalUsers}
          subtitle={`${stats.totalClients} ${t('platformAdmin.tabs.stores')}`}
          icon={Users}
          color="blue"
          sparkData={growth?.weeklySignups}
          sparkKey="signups"
          sparkColor={SPARKLINE_COLORS.signups}
          trend={{ value: stats.newSignupsWeek, label: t('platformAdmin.overview.thisWeek') }}
          onClick={() => onNavigate('users')}
        />
        <KPICard
          title={t('platformAdmin.overview.activeSubscriptions')}
          value={stats.activeSubscriptions}
          subtitle={`${stats.trialSubscriptions} ${t('platformAdmin.overview.trial')}`}
          icon={Zap}
          color="emerald"
          trend={{ value: stats.activeSubscriptions - stats.expiredSubscriptions, label: t('platformAdmin.overview.net') }}
          onClick={() => onNavigate('subscriptions')}
        />
        <KPICard
          title={t('platformAdmin.overview.trialAccounts')}
          value={stats.trialSubscriptions}
          subtitle={`${stats.totalClients > 0 ? Math.round((stats.trialSubscriptions / stats.totalClients) * 100) : 0}% ${t('platformAdmin.overview.ofStores')}`}
          icon={Clock}
          color="amber"
          onClick={() => onNavigate('subscriptions')}
        />
        <KPICard
          title={t('platformAdmin.overview.lockedAccounts')}
          value={stats.lockedAccounts}
          subtitle={t('platformAdmin.overview.needAttention')}
          icon={Lock}
          color="red"
          onClick={() => onNavigate('tools')}
        />
      </div>

      {/* Second Row: MRR, Subscription Revenue, Paid Subs, Codes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('platformAdmin.overview.mrr')}
          value={growth?.mrr != null ? `${Number(growth.mrr).toLocaleString()} دج` : '—'}
          subtitle={`${growth?.activeSubs ?? 0} ${t('platformAdmin.overview.active')} + ${growth?.tempPaid ?? 0} ${t('platformAdmin.overview.temp')}`}
          icon={TrendingUp}
          color="emerald"
          onClick={() => onNavigate('billing')}
        />
        <KPICard
          title={t('platformAdmin.overview.subscriptionRevenue')}
          value={growth?.weeklyPayments?.slice(-1)?.[0]?.revenue ? `${Number(growth.weeklyPayments.slice(-1)[0].revenue).toLocaleString()} دج` : '—'}
          subtitle={t('platformAdmin.overview.thisWeek')}
          icon={Zap}
          color="cyan"
          sparkData={growth?.weeklyPayments}
          sparkKey="revenue"
          sparkColor={SPARKLINE_COLORS.revenue}
        />
        <KPICard
          title={t('platformAdmin.overview.newPaidSubscribers')}
          value={growth?.weeklyPaidSubs?.slice(-1)?.[0]?.new_paid ?? '—'}
          subtitle={t('platformAdmin.overview.thisWeek')}
          icon={Users}
          color="purple"
          sparkData={growth?.weeklyPaidSubs}
          sparkKey="new_paid"
          sparkColor={SPARKLINE_COLORS.newPaid}
        />
        <KPICard
          title={t('platformAdmin.overview.activeCodes')}
          value={stats.pendingCodes}
          subtitle={`${stats.redeemedCodes} ${t('platformAdmin.codes.redeemed')}`}
          icon={BarChart3}
          color="amber"
          onClick={() => onNavigate('codes')}
        />
      </div>

      {/* Bento Section: Charts + Activity + Store Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Subscription Donut */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-purple-400" />
            {t('platformAdmin.overview.subscriptionMix')}
          </h3>
          {subscriptionData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={subscriptionData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">
                      {subscriptionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {subscriptionData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600 dark:text-slate-300">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-500 text-sm">{t('platformAdmin.overview.noData')}</p>
          )}
        </div>

        {/* Top Stores */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-emerald-400" />
            {t('platformAdmin.overview.topStores')}
          </h3>
          {growthLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          ) : topStores.length > 0 ? (
            <div className="space-y-2">
              {topStores.map((s, i) => (
                <div key={s.clientId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50/40 dark:bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
                  <span className={`text-xs font-bold w-5 text-center ${
                    i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-600 dark:text-slate-300' : i === 2 ? 'text-orange-400' : 'text-gray-500 dark:text-slate-500'
                  }`}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{s.storeName}</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-500">{s.orders30d} {t('platformAdmin.overview.orders')} · {s.productCount} {t('platformAdmin.overview.products')}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.healthScore >= 70 ? 'bg-emerald-500/20 text-emerald-300' :
                    s.healthScore >= 40 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {s.healthScore}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-500 text-sm py-4 text-center">{t('platformAdmin.overview.noStoreData')}</p>
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            {t('platformAdmin.overview.recentActivity')}
            <span className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-normal">{t('platformAdmin.overview.live')}</span>
            </span>
          </h3>
          {growthLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : (growth?.recentActivity?.length ?? 0) > 0 ? (
            <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin">
              {growth!.recentActivity.slice(0, 10).map((a, i) => (
                <div key={`${a.type}-${a.id}-${i}`} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-50/40 dark:bg-slate-900/40 transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    a.type === 'order' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
                  }`}>
                    {a.type === 'order' ? (
                      <Activity className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Users className="w-3 h-3 text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-600 dark:text-slate-300 truncate">
                      {a.type === 'order' ? `${t('platformAdmin.overview.order')} #${a.id}` : t('platformAdmin.overview.newSignup')}{' '}
                      <span className="text-gray-500 dark:text-slate-500">{a.detail}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-slate-500 flex-shrink-0">
                    {new Date(a.created_at).toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-500 text-sm py-4 text-center">{t('platformAdmin.overview.noRecentActivity')}</p>
          )}
        </div>
      </div>

      {/* At-Risk Stores Banner */}
      {weakStores.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl border border-red-500/30 p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-red-400" />
            {t('platformAdmin.overview.storesNeedingAttention')} ({weakStores.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakStores.map(s => (
              <Badge key={s.clientId} className="bg-red-500/20 text-red-200 border border-red-500/30 text-xs">
                {s.storeName} — {t('platformAdmin.overview.score')} {s.healthScore}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: t('platformAdmin.overview.manageUsers'), icon: Users, color: 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20', tab: 'users' },
          { label: t('platformAdmin.overview.viewStores'), icon: Store, color: 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20', tab: 'stores' },
          { label: t('platformAdmin.overview.checkErrors'), icon: Activity, color: 'text-red-400 bg-red-500/10 hover:bg-red-500/20', tab: 'errors' },
          { label: t('platformAdmin.overview.aiInsights'), icon: Sparkles, color: 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20', tab: 'ai' },
        ].map(a => (
          <button key={a.tab} onClick={() => onNavigate(a.tab)}
            className={`flex items-center gap-2 p-3 rounded-xl border border-slate-700/40 transition-all ${a.color}`}
          >
            <a.icon className="w-4 h-4" />
            <span className="text-xs font-medium text-gray-900 dark:text-white">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
