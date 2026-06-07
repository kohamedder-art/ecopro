import type { ReactNode } from 'react';

interface KPICardProps {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  positive?: boolean;
  large?: boolean;
}

export function KPICard({ icon, iconBg, label, value, sub, trend, positive, large }: KPICardProps) {
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 p-4 transition-all duration-200 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-600/80 ${large ? 'sm:col-span-2' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-800/30 dark:to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
              {icon}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              trendUp ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
              trendDown ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
              'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {trendUp ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 17l9.2-9.2M17 17V7H7" /></svg>
              ) : trendDown ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 7l-9.2 9.2M7 7v10h10" /></svg>
              ) : null}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${large ? 'text-2xl' : 'text-xl'}`}>{value}</p>
        {sub && (
          <p className={`text-[11px] mt-1 font-medium ${
            positive === true ? 'text-emerald-600 dark:text-emerald-400' :
            positive === false ? 'text-red-500 dark:text-red-400' :
            'text-slate-500 dark:text-slate-400'
          }`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
