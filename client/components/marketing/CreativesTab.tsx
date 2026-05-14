import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TabShell } from './TabShell';
import { surfaceCard, fmtNum, fmtCurrency, fmtPoas, fmtPct, fmtSeconds, frictionColor } from './helpers';
import { useTranslation } from '@/lib/i18n';
import { MkrMegaphone, MkrAlert, MkrChevron, MkrDollar, MkrTrend, MkrGrid } from '@/components/icons/MarketingIcons';

interface CreativeRow {
  key: string; platform: string | null; campaignName: string | null; creativeName: string | null;
  sessions: number; productViews: number; purchases: number; deliveredOrders: number;
  realizedRevenue: number; netProfit: number; grossProfit: number; spend: number;
  poas: number | null; returnRate: number; deliveredRate: number;
  topFriction: string | null; toxicSuccess: boolean;
}

interface RecentSession {
  id: string; startedAt: string; source: string | null; productTitle: string | null;
  diagnosticLabel: string | null; activeTimeSeconds: number; maxScrollDepth: number; converted: boolean; partial: boolean;
}

interface CreativesTabProps {
  creatives: CreativeRow[];
  toxicCreativeCount: number;
  sessions: RecentSession[];
}

export function CreativesTab({ creatives, toxicCreativeCount, sessions }: CreativesTabProps) {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const [expandedCreative, setExpandedCreative] = useState<string | null>(null);

  return (
    <TabShell
      isEmpty={creatives.length === 0 && sessions.length === 0}
      emptyIcon={<MkrMegaphone className="h-7 w-7 text-orange-500" />}
      emptyGradient="from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30"
      emptyTitle={t('marketing.creatives.noData')}
      emptyHint="Creative performance data will appear once campaigns are tracked through your pixel."
    >
      <div className="space-y-[9px]">
        {toxicCreativeCount > 0 && (
          <div className="rounded-xl border border-red-300/50 dark:border-red-700/50 bg-red-50/80 dark:bg-red-900/20 p-[9px] flex items-center gap-[7px]">
            <MkrAlert className="h-[11px] w-[11px] text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-800 dark:text-red-300 font-medium">
              {t('marketing.creatives.toxicWarning', { count: String(toxicCreativeCount) })}
            </span>
          </div>
        )}

        {creatives.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[9px]">
            {creatives.map(c => {
              const isOpen = expandedCreative === c.key;
              return (
                <div key={c.key} className={`${surfaceCard} ${c.toxicSuccess ? 'ring-2 ring-red-400/40' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedCreative(isOpen ? null : c.key)}
                    className="w-full text-left p-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-[7px]">
                      <div className="flex items-center gap-[7px] min-w-0 flex-1">
                        <span className="text-xs font-bold truncate">{c.creativeName || c.campaignName || c.key}</span>
                        {c.platform && <Badge variant="secondary" className="text-[10px] py-0 px-[5px] capitalize">{c.platform}</Badge>}
                      </div>
                      {c.toxicSuccess && <Badge variant="destructive" className="text-[10px] py-0 px-[5px] shrink-0">{t('marketing.creatives.toxic')}</Badge>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[7px]">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.sessions')}</p>
                        <p className="text-xs font-bold mt-[3px]">{fmtNum(c.sessions)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.orders')}</p>
                        <p className="text-xs font-bold mt-[3px]">{fmtNum(c.purchases)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">{t('marketing.creatives.col.netProfit')}</p>
                        <p className={`text-xs font-bold mt-[3px] ${c.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(c.netProfit)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-[7px] text-center">
                        <p className="text-[10px] text-muted-foreground font-medium">POAS</p>
                        <p className={`text-xs font-bold mt-[3px] ${c.poas !== null && c.poas >= 1 ? 'text-emerald-600' : c.poas !== null && c.poas >= 0.5 ? 'text-amber-600' : 'text-slate-500'}`}>{fmtPoas(c.poas)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-[7px]">
                      <div className="flex items-center gap-[7px]">
                        <MkrDollar className="h-[11px] w-[11px] text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{t('marketing.creatives.col.spend')}: {fmtCurrency(c.spend)}</span>
                      </div>
                      <MkrChevron className={`h-[13px] w-[13px] text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-[11px] pb-[11px] pt-0 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-[7px] pt-[9px]">
                        {[
                          { label: t('marketing.kpi.productViews'), value: fmtNum(c.productViews) },
                          { label: t('marketing.creatives.col.delivered'), value: fmtNum(c.deliveredOrders), color: 'text-emerald-600' },
                          { label: t('marketing.creatives.col.revenue'), value: fmtCurrency(c.realizedRevenue) },
                          { label: t('marketing.mini.grossProfit'), value: fmtCurrency(c.grossProfit) },
                          { label: t('marketing.creatives.col.returnPct'), value: fmtPct(c.returnRate) },
                          { label: t('marketing.creatives.col.friction'), value: c.topFriction ? null : '—', badge: c.topFriction ? { text: t(`marketing.friction.${c.topFriction}`), color: frictionColor(c.topFriction) } : undefined },
                        ].map((item, i) => (
                          <div key={i} className="text-center p-[7px] rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                            {item.badge ? (
                              <Badge className={`text-[10px] py-0 mt-[3px] ${item.badge.color}`}>{item.badge.text}</Badge>
                            ) : (
                              <p className={`text-xs font-bold mt-[3px] ${item.color || ''}`}>{item.value}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className={`${surfaceCard}`}>
            <div className="flex items-center gap-[7px] px-[13px] pt-[13px] pb-[9px]">
              <MkrGrid className="h-[11px] w-[11px] text-primary" />
              <span className="text-[13px] font-bold">{t('marketing.diag.recentTitle')}</span>
            </div>
            <div className="p-[13px] pt-[9px] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wider">
                    <TableHead>{t('marketing.diag.col.time')}</TableHead>
                    <TableHead>{t('marketing.diag.col.source')}</TableHead>
                    <TableHead>{t('marketing.diag.col.product')}</TableHead>
                    <TableHead>{t('marketing.diag.col.friction')}</TableHead>
                    <TableHead className="text-right">{t('marketing.diag.col.scroll')}</TableHead>
                    <TableHead className="text-right">{t('marketing.diag.col.duration')}</TableHead>
                    <TableHead>{t('marketing.diag.col.outcome')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{s.source || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{s.productTitle || '—'}</TableCell>
                      <TableCell>{s.diagnosticLabel ? <Badge className={`text-xs py-0.5 rounded-lg ${frictionColor(s.diagnosticLabel)}`}>{t(`marketing.friction.${s.diagnosticLabel}`)}</Badge> : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{Math.round(s.maxScrollDepth)}%</TableCell>
                      <TableCell className="text-right text-xs">{fmtSeconds(s.activeTimeSeconds)}</TableCell>
                      <TableCell>
                        {s.converted ? (
                          <Badge className="text-xs py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{t('marketing.diag.converted')}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs py-0">{t('marketing.diag.dropped')}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </TabShell>
  );
}
