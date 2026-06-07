import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { SummaryTab } from '@/components/marketing/SummaryTab';
import { CreativesTab } from '@/components/marketing/CreativesTab';
import { AudienceTab } from '@/components/marketing/AudienceTab';
import { ProductsTab } from '@/components/marketing/ProductsTab';

type OmniSnapshot = any;
type CustomerAnalytics = any;

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const [selectedDays, setSelectedDays] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: snapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<OmniSnapshot>({
    queryKey: ['omni-overview', selectedDays],
    queryFn: () => apiFetch<OmniSnapshot>(`/api/pixels/omni/overview?days=${selectedDays}`),
  });

  const { data: customerData, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['omni-customers', selectedDays],
    queryFn: () => apiFetch<CustomerAnalytics>(`/api/pixels/omni/customers?days=${selectedDays}`),
  });

  const { data: inputs } = useQuery<any>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<any>('/api/pixels/omni/inputs'),
  });

  const overview = snapshot?.overview;
  const creatives = snapshot?.creativeComparison || [];
  const funnel = snapshot?.funnel || [];
  const sources = snapshot?.sourceBreakdown || [];
  const clusters = snapshot?.frictionClusters || [];
  const recentSessions = snapshot?.recentSessions || [];
  const genderData = snapshot?.genderAnalytics;
  const productEconomics = inputs?.productEconomics || [];

  const tabs = [
    { value: 'overview', label: 'نظرة عامة' },
    { value: 'campaigns', label: 'الحملات' },
    { value: 'customers', label: 'العملاء' },
    { value: 'products', label: 'المنتجات' },
  ] as const;

  const isLoading = snapshotLoading || customersLoading;

  return (
    <div className={`space-y-3 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 shadow-md shadow-blue-500/20 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">لوحة التحليلات</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">تتبع الإيرادات والطلبات وأداء متجرك</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[110px] h-9 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 text-slate-900 dark:text-white text-[11px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">آخر 7 أيام</SelectItem>
                <SelectItem value="14">آخر 14 يوم</SelectItem>
                <SelectItem value="30">آخر 30 يوم</SelectItem>
                <SelectItem value="60">آخر 60 يوم</SelectItem>
                <SelectItem value="90">آخر 90 يوم</SelectItem>
              </SelectContent>
            </Select>
            <button
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              onClick={() => refetchSnapshot()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-1 gap-1 flex flex-nowrap overflow-x-auto shadow-sm">
          {tabs.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs font-bold gap-1.5 px-4 py-2.5 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:via-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/20 flex-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all min-w-0"
            >
              <span className="truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <span className="h-8 w-8 animate-spin text-blue-500 block border-[3px] border-blue-500 border-t-transparent rounded-full" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">جاري تحميل البيانات...</span>
              </div>
            </div>
          ) : !overview ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 mb-4">
                <svg className="h-8 w-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t('marketing.noData')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{t('marketing.noDataHint')}</p>
            </div>
          ) : (
            <SummaryTab
              overview={{
                sessions: overview.sessions,
                totalOrders: overview.totalOrders,
                deliveredOrders: overview.deliveredOrders,
                returnedOrders: overview.returnedOrders,
                realizedRevenue: overview.realizedRevenue,
                netProfit: overview.netProfit,
                adSpend: overview.adSpend,
                poas: overview.poas,
              }}
              wilayaBreakdown={customerData?.wilayaBreakdown}
              ordersByDay={customerData?.ordersByDay}
            />
          )}
        </TabsContent>

        {/* ── Campaigns Tab ── */}
        <TabsContent value="campaigns" className="mt-3">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <span className="h-8 w-8 animate-spin text-blue-500 block border-[3px] border-blue-500 border-t-transparent rounded-full" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">جاري تحميل البيانات...</span>
              </div>
            </div>
          ) : (
            <CreativesTab creatives={creatives} />
          )}
        </TabsContent>

        {/* ── Customers Tab ── */}
        <TabsContent value="customers" className="mt-3">
          {customersLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <span className="h-8 w-8 animate-spin text-blue-500 block border-[3px] border-blue-500 border-t-transparent rounded-full" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">جاري تحميل البيانات...</span>
              </div>
            </div>
          ) : (
            <AudienceTab
              customerData={customerData}
              genderData={genderData}
              clusters={clusters}
              sessions={recentSessions}
            />
          )}
        </TabsContent>

        {/* ── Products Tab ── */}
        <TabsContent value="products" className="mt-3">
          <ProductsTab products={productEconomics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
