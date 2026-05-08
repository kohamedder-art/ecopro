import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabShell } from './TabShell';
import { SectionHeader } from './SectionHeader';
import { surfaceCard, fmtNum, fmtCurrency, fmtPct } from './helpers';
import { MkrPackage, MkrDollar, MkrCart, MkrTarget } from '@/components/icons/MarketingIcons';

interface ProductEcon {
  id: number; title: string; price: number; category: string | null;
  buy_cost: number; packaging_cost: number; handling_cost: number;
  fallback_shipping_cost: number; notes: string | null;
}

interface ProductsTabProps {
  products: ProductEcon[];
}

export function ProductsTab({ products }: ProductsTabProps) {
  const { t } = useTranslation();

  const enriched = useMemo(() => {
    return products.map(p => {
      const totalCost = (p.buy_cost || 0) + (p.packaging_cost || 0) + (p.handling_cost || 0) + (p.fallback_shipping_cost || 0);
      const profit = (p.price || 0) - totalCost;
      const margin = p.price > 0 ? (profit / p.price) * 100 : 0;
      return { ...p, totalCost, profit, margin };
    }).sort((a, b) => b.margin - a.margin);
  }, [products]);

  const summary = useMemo(() => {
    if (enriched.length === 0) return null;
    const avgMargin = enriched.reduce((s, p) => s + p.margin, 0) / enriched.length;
    const profitable = enriched.filter(p => p.profit > 0).length;
    const totalProfit = enriched.reduce((s, p) => s + Math.max(p.profit, 0), 0);
    const totalLoss = enriched.reduce((s, p) => s + Math.min(p.profit, 0), 0);
    return { avgMargin, profitable, totalProfit, totalLoss, totalProducts: enriched.length };
  }, [enriched]);

  return (
    <TabShell
      isEmpty={products.length === 0}
      emptyIcon={<MkrPackage className="h-7 w-7 text-primary" />}
      emptyGradient="from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
      emptyTitle={t('marketing.inputs.noProducts')}
      emptyHint="Add products to your store to see profitability analytics."
    >
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[9px]">
          <div className="rounded-xl bg-card border border-border p-[11px]">
            <div className="flex items-center gap-[7px] mb-[7px]">
              <MkrPackage className="h-[11px] w-[11px] text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.products.count') || 'Products'}</span>
            </div>
            <p className="text-lg font-extrabold">{summary.totalProducts}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-[11px]">
            <div className="flex items-center gap-[7px] mb-[7px]">
              <MkrTarget className="h-[11px] w-[11px] text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.products.avgMargin') || 'Avg Margin'}</span>
            </div>
            <p className={`text-lg font-extrabold ${summary.avgMargin >= 20 ? 'text-emerald-600' : summary.avgMargin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>{fmtPct(summary.avgMargin)}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-[11px]">
            <div className="flex items-center gap-[7px] mb-[7px]">
              <MkrCart className="h-[11px] w-[11px] text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.products.profitable') || 'Profitable'}</span>
            </div>
            <p className="text-lg font-extrabold text-emerald-600">{summary.profitable}/{summary.totalProducts}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-[11px]">
            <div className="flex items-center gap-[7px] mb-[7px]">
              <MkrDollar className="h-[11px] w-[11px] text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('marketing.products.netProfit') || 'Net Profit'}</span>
            </div>
            <p className={`text-lg font-extrabold ${summary.totalProfit + summary.totalLoss >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtCurrency(summary.totalProfit + summary.totalLoss)}</p>
          </div>
        </div>
      )}

      <div className="space-y-[7px]">
        {enriched.map(p => (
          <div key={p.id} className={`${surfaceCard} p-[11px]`}>
            <div className="flex items-start justify-between gap-[9px]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-[7px]">
                  <p className="text-xs font-bold truncate">{p.title}</p>
                  {p.category && <Badge variant="secondary" className="text-[10px] py-0 px-[5px]">{p.category}</Badge>}
                </div>
                <div className="flex items-center gap-[11px] mt-[7px] text-xs text-muted-foreground">
                  <span>{t('marketing.inputs.col.sellPrice') || 'Price'}: <span className="font-bold text-foreground">{fmtCurrency(p.price)}</span></span>
                  <span>{t('marketing.inputs.col.buyCost') || 'Cost'}: <span className="font-bold text-foreground">{fmtCurrency(p.totalCost)}</span></span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-extrabold ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{fmtCurrency(p.profit)}</p>
                <Badge className={`text-[10px] mt-[3px] ${p.margin >= 20 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : p.margin >= 10 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {fmtPct(p.margin)}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </TabShell>
  );
}
