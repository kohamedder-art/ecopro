import { useMemo } from 'react';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, CreditCard, BarChart3, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from '@/lib/i18n';

interface BillingMetrics {
  mrr: number;
  active_subscriptions: number;
  unpaid_count: number;
  new_signups: number;
  total_codes_issued: number;
  codes_redeemed: number;
  codes_pending: number;
  codes_expired: number;
  churn_rate: string;
  monthly_redemptions: number;
  expired_count: number;
  trial_count: number;
}

interface Props {
  billingMetrics: BillingMetrics | null;
  stats: { totalUsers: number; totalClients: number };
}

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'];

export default function SubscriptionsTab({ billingMetrics, stats }: Props) {
  const { t } = useTranslation();
  const m = billingMetrics;
  const total = Math.max((m?.active_subscriptions || 0) + (m?.trial_count || 0) + (m?.expired_count || 0), 1);

  const donutData = useMemo(() => [
    { name: t('platformAdmin.subs.activePaid'), value: m?.active_subscriptions || 0, color: '#10b981' },
    { name: t('platformAdmin.subs.trialActive'), value: m?.trial_count || 0, color: '#3b82f6' },
    { name: t('platformAdmin.subs.expired'), value: m?.expired_count || 0, color: '#ef4444' },
    { name: t('platformAdmin.subs.unpaid'), value: m?.unpaid_count || 0, color: '#f59e0b' },
  ], [m]);

  const codeBarData = useMemo(() => [
    { name: t('platformAdmin.subs.issued'), value: m?.total_codes_issued || 0, fill: '#06b6d4' },
    { name: t('platformAdmin.subs.redeemed'), value: m?.codes_redeemed || 0, fill: '#10b981' },
    { name: t('platformAdmin.subs.pending'), value: m?.codes_pending || 0, fill: '#f59e0b' },
    { name: t('platformAdmin.subs.expired'), value: m?.codes_expired || 0, fill: '#ef4444' },
  ], [m]);

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('platformAdmin.subs.mrr'), value: `${Math.round(m?.mrr || 0)} دج`, icon: DollarSign, gradient: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', iconColor: 'text-emerald-500/40' },
          { label: t('platformAdmin.subs.activeSubs'), value: m?.active_subscriptions || 0, icon: CheckCircle, gradient: 'from-blue-500/15 to-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400', iconColor: 'text-blue-500/40' },
          { label: t('platformAdmin.subs.unpaidAccounts'), value: m?.unpaid_count || 0, icon: AlertCircle, gradient: 'from-orange-500/15 to-orange-500/5', border: 'border-orange-500/30', text: 'text-orange-400', iconColor: 'text-orange-500/40' },
          { label: t('platformAdmin.subs.newSignupsMonth'), value: m?.new_signups || 0, icon: TrendingUp, gradient: 'from-purple-500/15 to-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400', iconColor: 'text-purple-500/40' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpi.gradient} backdrop-blur-xl rounded-2xl border ${kpi.border} p-4 shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.text}`}>{kpi.value}</p>
              </div>
              <kpi.icon className={`w-7 h-7 ${kpi.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subscription Donut */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            {t('platformAdmin.subs.breakdown')}
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600 dark:text-slate-300">{d.name}</span>
                  </div>
                  <span className="text-gray-900 dark:text-white font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Code Stats Bar */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            {t('platformAdmin.subs.codeDistribution')}
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={codeBarData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {codeBarData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subscription Status Bars */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-5 shadow-lg">
        <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          Status Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: t('platformAdmin.subs.trialActive'), value: m?.trial_count || 0, color: 'blue' },
            { label: t('platformAdmin.subs.activePaid'), value: m?.active_subscriptions || 0, color: 'emerald' },
            { label: t('platformAdmin.subs.expired'), value: m?.expired_count || 0, color: 'red' },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-slate-300 text-sm">{item.label}</span>
                <span className={`text-xl font-bold text-${item.color}-400`}>{item.value}</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                <div
                  className={`bg-${item.color}-500 h-2.5 rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, (item.value / total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.subs.churnRate')}</p>
          <p className="text-2xl font-bold text-red-400">{m?.churn_rate || '0.0'}%</p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1">{t('platformAdmin.subs.expiredThisMonth')}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.subs.monthlyRedemptions')}</p>
          <p className="text-2xl font-bold text-blue-400">{m?.monthly_redemptions || 0}</p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1">{t('platformAdmin.subs.thisMonth')}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.subs.expiredSubs')}</p>
          <p className="text-2xl font-bold text-red-500">{m?.expired_count || 0}</p>
          <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1">{t('platformAdmin.subs.accountsLocked')}</p>
        </div>
      </div>
    </div>
  );
}
