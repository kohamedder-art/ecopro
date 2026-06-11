import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import ProductCostsSection from '@/components/ProductCostsSection';
import { Save, TrendingUp, TrendingDown, DollarSign, Package, Percent, BarChart3, Truck, RotateCcw, Smartphone, CreditCard, RefreshCw } from 'lucide-react';

const fmtNum = (n: number | null | undefined) => n != null ? String(Math.round(n)) : '0';
const fmtCurr = (n: number | null | undefined) => n != null ? `${Math.round(n)} دج` : '0 دج';
const fmtPct = (n: number | null | undefined) => n != null ? `${Math.round(n)}%` : '—';

export default function CODPricingCalculator() {
  const qc = useQueryClient();
  const [dailySpend, setDailySpend] = useState<number>(0);

  const { data: config, isLoading: loadingConfig } = useQuery<any>({
    queryKey: ['pricing-config'],
    queryFn: () => apiFetch<any>('/api/pixels/omni/pricing-config'),
  });

  const { data: codData, isLoading: loadingCod, refetch: refetchCod } = useQuery<any>({
    queryKey: ['cod-pricing', dailySpend],
    queryFn: () => apiFetch<any>(`/api/pixels/omni/cod-pricing`),
  });

  useEffect(() => {
    if (config?.daily_ad_spend != null) {
      setDailySpend(Number(config.daily_ad_spend));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (val: number) => apiFetch<any>('/api/pixels/omni/pricing-config', {
      method: 'PUT',
      body: JSON.stringify({ daily_ad_spend: val }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-config'] });
      qc.invalidateQueries({ queryKey: ['cod-pricing'] });
    },
  });

  const stats = [
    { label: 'إجمالي الطلبات', value: fmtNum(codData?.totalOrders), icon: Package, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20' },
    { label: 'الطلبات الموصلة', value: fmtNum(codData?.deliveredOrders), icon: Truck, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/20' },
    { label: 'نسبة التوصيل', value: fmtPct(codData?.deliveryRate), icon: Percent, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    { label: 'نسبة الإرجاع', value: fmtPct(codData?.returnRate), icon: RotateCcw, color: 'from-red-500 to-red-600', shadow: 'shadow-red-500/20' },
    { label: 'تكلفة الإعلان/طلب', value: fmtCurr(codData?.adCostPerOrder), icon: TrendingDown, color: 'from-violet-500 to-violet-600', shadow: 'shadow-violet-500/20' },
  ];

  const loading = loadingConfig || loadingCod;

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <span className="text-white text-lg">🧮</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              حاسبة الأسعار COD
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">احسب أرباحك الحقيقية بعد كل التكاليف</p>
          </div>
        </div>
        <button onClick={() => refetchCod()}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-muted-foreground transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          تحديث
        </button>
      </div>

      {/* Daily Ad Spend Input */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
          <span className="text-sm font-bold text-foreground">الميزانية اليومية للإعلانات</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <input type="number" value={dailySpend}
              onChange={e => setDailySpend(parseFloat(e.target.value) || 0)}
              className="w-full h-10 bg-background border border-border rounded-xl px-4 text-lg font-bold text-foreground tabular-nums text-left"
              placeholder="0"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">دج</span>
          </div>
          <button onClick={() => saveMutation.mutate(dailySpend)}
            disabled={saveMutation.isPending}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-amber-500/25">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">أدخل المبلغ الذي تنفقه يومياً على الإعلانات لحساب تكلفة الإعلان لكل طلب</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shadow ${s.shadow}`}>
                <s.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{s.label}</span>
            </div>
            <p className="text-lg font-black tabular-nums leading-none text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
          <span className="text-sm font-bold text-foreground">حساب الربح لكل منتج</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-right py-2.5 px-2 font-bold text-muted-foreground">المنتج</th>
                  <th className="text-right py-2.5 px-2 font-bold text-muted-foreground">سعر البيع</th>
                  <th className="text-right py-2.5 px-2 font-bold text-muted-foreground">الشراء</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground bg-amber-50/50 dark:bg-amber-950/20">إعلان</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground bg-emerald-50/50 dark:bg-emerald-950/20">التكلفة</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground bg-emerald-50/50 dark:bg-emerald-950/20">الربح/طلب</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground">الكمية</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground">الربح الكلي</th>
                  <th className="text-right py-2.5 px-2 font-bold text-foreground">ROI</th>
                </tr>
              </thead>
              <tbody>
                {codData?.products?.length > 0 ? codData.products.map((p: any, i: number) => {
                  const cost = p.buyCost + p.packagingCost + p.handlingCost + p.shippingCost + p.callCenterCost + p.otherCosts + p.adCostPerOrder;
                  return (
                    <tr key={p.productId} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-2 font-bold text-foreground max-w-[140px] truncate">{p.title}</td>
                      <td className="py-2.5 px-2 font-bold text-foreground tabular-nums">{fmtCurr(p.sellingPrice)}</td>
                      <td className="py-2.5 px-2 text-muted-foreground tabular-nums">{fmtCurr(p.buyCost)}</td>
                      <td className="py-2.5 px-2 font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 tabular-nums">{fmtCurr(p.adCostPerOrder)}</td>
                      <td className="py-2.5 px-2 font-bold text-muted-foreground bg-emerald-50/50 dark:bg-emerald-950/20 tabular-nums">{fmtCurr(cost)}</td>
                      <td className="py-2.5 px-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <span className={`font-bold tabular-nums ${p.netProfitPerOrder >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {fmtCurr(p.netProfitPerOrder)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground tabular-nums">{p.deliveredCount}</td>
                      <td className="py-2.5 px-2">
                        <span className={`font-bold tabular-nums ${p.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {fmtCurr(p.totalProfit)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.roi >= 50 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : p.roi >= 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>{fmtPct(p.roi)}</span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-xs text-muted-foreground">
                      لا توجد منتجات أو بيانات كافية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span>تكلفة الطلب = شراء + تغليف + مناولة + توصيل + مركز اتصال + أخرى + إعلانات</span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">الإعلان = الميزانية اليومية ÷ إجمالي الطلبات الموصلة</span>
        </div>
      </div>

      {/* Product Economics Editor */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
          <span className="text-sm font-bold text-foreground">تعديل تكاليف المنتجات</span>
        </div>
        <ProductCostsSection onSave={() => qc.invalidateQueries({ queryKey: ['cod-pricing'] })} />
      </div>
    </div>
  );
}
