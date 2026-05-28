import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  MkrBrain, MkrMegaphone, MkrRefresh, MkrDashboard, MkrAudience, MkrConfigure,
} from '@/components/icons/MarketingIcons';
import { OverviewTab } from '@/components/marketing/OverviewTab';
import { CreativesTab } from '@/components/marketing/CreativesTab';
import { ConfigureTab } from '@/components/marketing/ConfigureTab';

type OmniSnapshot = any;
type CustomerAnalytics = any;
type GenderAnalytics = any;

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: genderData, isLoading: genderLoading } = useQuery<GenderAnalytics>({
    queryKey: ['omni-gender', selectedDays],
    queryFn: () => apiFetch<GenderAnalytics>(`/api/pixels/omni/gender?days=${selectedDays}`),
  });

  const { data: inputs, isLoading: inputsLoading } = useQuery<any>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<any>('/api/pixels/omni/inputs'),
  });

  const { data: pixelSettings } = useQuery<any>({
    queryKey: ['pixel-settings'],
    queryFn: () => apiFetch<any>('/api/pixels/settings'),
  });

  const saveEconomicsMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/product-economics', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['omni-inputs'] }); toast({ title: t('marketing.toast.saved') || 'تم الحفظ' }); },
    onError: () => { toast({ title: t('marketing.toast.error') || 'خطأ', variant: 'destructive' }); },
  });

  const saveSpendMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/creative-spend', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['omni-inputs'] }); toast({ title: t('marketing.toast.saved') || 'تم الحفظ' }); },
    onError: () => { toast({ title: t('marketing.toast.error') || 'خطأ', variant: 'destructive' }); },
  });

  const deleteSpendMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/pixels/omni/creative-spend/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['omni-inputs'] }); },
  });

  const savePixelSettingsMutation = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pixel-settings'] }); toast({ title: t('marketing.toast.saved') || 'تم الحفظ' }); },
    onError: () => { toast({ title: t('marketing.toast.error') || 'خطأ', variant: 'destructive' }); },
  });

  const backfillMutation = useMutation({
    mutationFn: (days: number) => apiFetch('/api/pixels/omni/import-historical-sessions', { method: 'POST', body: JSON.stringify({ days }) }),
    onSuccess: () => { toast({ title: t('marketing.toast.saved') || 'تم الحفظ' }); },
  });

  const overview = snapshot?.overview;
  const funnel = snapshot?.funnel || [];
  const creatives = snapshot?.creativeComparison || [];
  const sessions = snapshot?.recentSessions || [];
  const sources = snapshot?.sourceBreakdown || [];
  const clusters = snapshot?.frictionClusters || [];

  const tabs = [
    { value: 'dashboard', icon: MkrDashboard, labelKey: 'marketing.tab.overview' },
    { value: 'campaigns', icon: MkrMegaphone, labelKey: 'marketing.tab.creatives' },
    { value: 'configure', icon: MkrConfigure, labelKey: 'marketing.tab.configure' || 'التكاليف والإعلانات' },
  ] as const;

  return (
    <div className={`space-y-[9px] pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-[18px] shadow-sm">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 shrink-0">
              <MkrBrain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-foreground">{t('marketing.title')}</h1>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{t('marketing.subtitle')}</p>
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

        {/* Live stat pills */}
        {overview && (
          <div className="relative flex flex-wrap gap-2 mt-4">
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full px-3 py-1 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {overview.sessions?.toLocaleString() ?? 0} {t('marketing.kpi.sessions')}
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full px-3 py-1 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {overview.totalOrders?.toLocaleString() ?? 0} {t('marketing.kpi.orders')}
            </div>
            <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 rounded-full px-3 py-1 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              {overview.netProfit > 0 ? `+${overview.netProfit.toLocaleString()} DA` : `${overview.netProfit.toLocaleString()} DA`}
            </div>
          </div>
        )}
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

        <TabsContent value="dashboard" className="mt-[9px] space-y-[9px]">
          {snapshotLoading || customersLoading || genderLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : !overview ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl p-[13px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-[11px]">
                <MkrAudience className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.noDataHint') || 'Analytics data will appear here once your store starts receiving traffic and orders.'}</p>
            </div>
          ) : (
            <OverviewTab
              overview={overview}
              funnel={funnel}
              sources={sources}
              customerData={customerData}
              genderData={genderData}
              clusters={clusters}
              sessions={sessions}
            />
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-[9px]">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <CreativesTab creatives={creatives} toxicCreativeCount={overview?.toxicCreativeCount ?? 0} sessions={sessions} />
          )}
        </TabsContent>

        <TabsContent value="configure" className="mt-[9px]">
          {inputsLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <ConfigureTab
              inputs={inputs}
              settings={pixelSettings}
              onSaveEconomics={(p) => saveEconomicsMutation.mutate(p)}
              onSaveSpend={(p) => saveSpendMutation.mutate(p)}
              onDeleteSpend={(id) => deleteSpendMutation.mutate(id)}
              onRunBackfill={(days) => backfillMutation.mutate(days)}
              onSaveSettings={(p) => savePixelSettingsMutation.mutate(p)}
              savingSpend={saveSpendMutation.isPending}
              runningBackfill={backfillMutation.isPending}
              savingSettings={savePixelSettingsMutation.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
