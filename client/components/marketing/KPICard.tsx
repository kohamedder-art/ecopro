import type { ReactNode } from 'react';

interface KPICardProps {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

export function KPICard({ icon, iconBg, label, value, sub, positive }: KPICardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/55 p-[11px]">
      <div className="flex items-center gap-[7px] mb-[7px]">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-extrabold tracking-tight">{value}</p>
      {sub && (
        <p className={`text-[11px] mt-[3px] font-medium ${positive === true ? 'text-emerald-600 dark:text-emerald-400' : positive === false ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}
