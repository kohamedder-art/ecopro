export const surfaceCard =
  'rounded-xl bg-white/95 dark:bg-slate-900/45 border border-slate-200/80 dark:border-slate-700/70';
export const surfaceMuted =
  'rounded-xl bg-white/75 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60';
export const inputClass =
  'h-10 rounded-xl bg-white/75 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-sm';
export const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff', '#818cf8'];
export function fmtNum(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString();
}
export function fmtCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '0 DZD';
  return `${Number(amount).toLocaleString()} DZD`;
}
export function fmtPct(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0%';
  return `${Number(num).toFixed(1)}%`;
}
export function fmtPoas(poas: number | null | undefined): string {
  if (poas === null || poas === undefined) return '—';
  return `${poas.toFixed(2)}x`;
}
export function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
export function severityColor(s: string) {
  if (s === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200/50 dark:border-red-700/50';
  if (s === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-700/50';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50 dark:border-blue-700/50';
}
export function frictionColor(label: string) {
  if (label === 'converted') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (label === 'shipping_friction') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  if (label === 'price_trust_friction') return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400';
  if (label === 'ad_mismatch') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300';
}
export const funnelLabelKey: Record<string, string> = {
  sessions: 'marketing.funnel.sessions',
  views: 'marketing.funnel.views',
  orders: 'marketing.funnel.orders',
  delivered: 'marketing.funnel.delivered',
};
