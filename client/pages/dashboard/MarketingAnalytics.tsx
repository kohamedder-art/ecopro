import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import {
  MkrBrain, MkrMegaphone, MkrRefresh, MkrDashboard,
} from '@/components/icons/MarketingIcons';
import { SummaryTab } from '@/components/marketing/SummaryTab';
import { CreativesTab } from '@/components/marketing/CreativesTab';

type OmniSnapshot = any;
type CustomerAnalytics = any;

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const [selectedDays, setSelectedDays] = useState('30');
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: snapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<OmniSnapshot>({
    queryKey: ['omni-overview', selectedDays],
    queryFn: () => apiFetch<OmniSnapshot>(`/api/pixels/omni/overview?days=${selectedDays}`),
  });

  const { data: customerData, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['omni-customers', selectedDays],
    queryFn: () => apiFetch<CustomerAnalytics>(`/api/pixels/omni/customers?days=${selectedDays}`),
  });

  const overview = snapshot?.overview;
  const creatives = snapshot?.creativeComparison || [];

  const tabs = [
    { value: 'dashboard', icon: MkrDashboard, labelKey: 'marketing.tab.overview' },
    { value: 'campaigns', icon: MkrMegaphone, labelKey: 'marketing.tab.creatives' },
  ] as const;

  return (
    <div className={`space-y-[9px] pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="rounded-xl bg-card border border-border p-[13px] shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm shrink-0">
              <MkrBrain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-foreground">{t('marketing.title')}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('marketing.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[100px] h-8 rounded-lg bg-background/80 border-border text-foreground text-[11px] font-bold backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('marketing.last7')}</SelectItem>
                <SelectItem value="14">{t('marketing.last14')}</SelectItem>
                <SelectItem value="30">{t('marketing.last30')}</SelectItem>
                <SelectItem value="60">{t('marketing.last60')}</SelectItem>
                <SelectItem value="90">{t('marketing.last90')}</SelectItem>
              </SelectContent>
            </Select>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-background/80 border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-all backdrop-blur-sm shadow-sm"
              onClick={() => refetchSnapshot()}
            >
              <MkrRefresh className="w-[13px] h-[13px]" />
            </button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-card border border-border rounded-xl p-1 gap-1 flex flex-nowrap overflow-x-auto shadow-sm">
          {tabs.map(({ value, icon: Icon, labelKey }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs font-bold gap-1.5 px-3 py-2 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md flex-1 text-muted-foreground hover:text-foreground transition-all min-w-0"
            >
              <Icon className="h-[13px] w-[13px] shrink-0" /> <span className="truncate">{t(labelKey)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-[9px]">
          {snapshotLoading || customersLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : !overview ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl p-[13px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-[11px]">
                <MkrDashboard className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.noDataHint')}</p>
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
              }}
              wilayaBreakdown={customerData?.wilayaBreakdown}
              ordersByDay={customerData?.ordersByDay}
            />
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-[9px]">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <CreativesTab creatives={creatives} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
