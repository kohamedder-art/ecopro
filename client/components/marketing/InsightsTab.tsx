import { useTranslation } from '@/lib/i18n';
import { surfaceCard, fmtNum, fmtCurrency, fmtPct } from './helpers';
import { MkrBulb, MkrPerson, MkrDollar, MkrTarget, MkrCheck, MkrTrend } from '@/components/icons/MarketingIcons';

interface Overview {
  sessions: number;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  realizedRevenue: number;
  netProfit: number;
  poas: number | null;
  grossProfit: number;
  adSpend: number;
}

interface InsightsTabProps {
  overview?: Overview;
  funnel: { label: string; value: number; rate: number }[];
}

export function InsightsTab({ overview, funnel }: InsightsTabProps) {
  const { t } = useTranslation();

  if (!overview) {
    return (
      <div className={`${surfaceCard} p-[13px] flex flex-col items-center justify-center py-16 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-[11px]">
          <MkrBulb className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.insights.noDataHint') || 'Insights will appear once your store has enough data to analyze.'}</p>
      </div>
    );
  }

  const convRate = overview.sessions > 0 ? (overview.totalOrders / overview.sessions) * 100 : 0;
  const deliveredRate = overview.totalOrders > 0 ? (overview.deliveredOrders / overview.totalOrders) * 100 : 0;

  return (
    <div className="space-y-[9px]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[9px]">
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrPerson className="h-[11px] w-[11px] text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.kpi.sessions')}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtNum(overview.sessions)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrDollar className="h-[11px] w-[11px] text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.kpi.netProfit')}</span>
          </div>
          <p className={`text-lg font-extrabold ${overview.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{fmtCurrency(overview.netProfit)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrTarget className="h-[11px] w-[11px] text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.insights.convRate') || 'Conversion'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtPct(convRate)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-[11px]">
          <div className="flex items-center gap-[7px] mb-[7px]">
            <MkrCheck className="h-[11px] w-[11px] text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.insights.deliveryRate') || 'Delivery'}</span>
          </div>
          <p className="text-lg font-extrabold">{fmtPct(deliveredRate)}</p>
        </div>
      </div>

      {funnel.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-[13px]">
          <div className="flex items-center gap-[7px] mb-[11px]">
            <MkrTrend className="h-[13px] w-[13px] text-primary" />
            <span className="text-[13px] font-bold">{t('marketing.insights.funnelSummary') || 'Funnel Summary'}</span>
          </div>
          <div className="space-y-[7px]">
            {funnel.map((f, i) => {
              const names = ['Sessions', 'Views', 'Orders', 'Delivered'];
              const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'];
              const total = funnel[0]?.value || 1;
              const pct = (f.value / total) * 100;
              return (
                <div key={i} className="flex items-center gap-[9px]">
                  <span className="text-[10px] font-bold w-[65px] text-right shrink-0">{names[i] || f.label}</span>
                  <div className="flex-1 h-[7px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${colors[i]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold w-[70px] text-right shrink-0 tabular-nums">{fmtNum(f.value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
