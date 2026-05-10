import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  MkrBrain, MkrMegaphone, MkrRefresh, MkrDashboard, MkrBulb,
  MkrAudience, MkrConfigure,
} from '@/components/icons/MarketingIcons';
import { OverviewTab } from '@/components/marketing/OverviewTab';
import { InsightsTab } from '@/components/marketing/InsightsTab';
import { CreativesTab } from '@/components/marketing/CreativesTab';
import { AudienceTab } from '@/components/marketing/AudienceTab';
import { ConfigureTab } from '@/components/marketing/ConfigureTab';

type OmniSnapshot = any;
type OmniInputs = any;
type PixelSettings = any;
type CustomerAnalytics = any;
type GenderAnalytics = any;

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const isRTL = locale === 'ar';
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState('30');
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: snapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<OmniSnapshot>({
    queryKey: ['omni-overview', selectedDays],
    queryFn: () => apiFetch<OmniSnapshot>(`/api/pixels/omni/overview?days=${selectedDays}`),
  });

  const { data: inputs, isLoading: inputsLoading } = useQuery<OmniInputs>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<OmniInputs>('/api/pixels/omni/inputs'),
    enabled: activeTab === 'configure',
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<PixelSettings>({
    queryKey: ['pixel-settings'],
    queryFn: () => apiFetch<PixelSettings>('/api/pixels/settings'),
    enabled: activeTab === 'configure',
  });

  const { data: customerData, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['omni-customers', selectedDays],
    queryFn: () => apiFetch<CustomerAnalytics>(`/api/pixels/omni/customers?days=${selectedDays}`),
    enabled: activeTab === 'audience',
  });

  const { data: genderData, isLoading: genderLoading } = useQuery<GenderAnalytics>({
    queryKey: ['omni-gender', selectedDays],
    queryFn: () => apiFetch<GenderAnalytics>(`/api/pixels/omni/gender?days=${selectedDays}`),
    enabled: activeTab === 'audience',
  });

  const saveEconomics = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/product-economics', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      queryClient.invalidateQueries({ queryKey: ['omni-overview'] });
      toast({ title: t('marketing.toast.saved'), description: t('marketing.toast.economicsUpdated') });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.economicsFailed'), variant: 'destructive' }),
  });

  const saveSpend = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/omni/creative-spend', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      queryClient.invalidateQueries({ queryKey: ['omni-overview'] });
      toast({ title: t('marketing.toast.saved'), description: t('marketing.toast.spendSaved') });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.spendFailed'), variant: 'destructive' }),
  });

  const deleteSpend = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/pixels/omni/creative-spend/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      queryClient.invalidateQueries({ queryKey: ['omni-overview'] });
    },
  });

  const runBackfill = useMutation({
    mutationFn: (days: number) => apiFetch<any>('/api/pixels/omni/import-historical-sessions', { method: 'POST', body: JSON.stringify({ days }) }),
    onSuccess: (data: any) => {
      toast({ title: t('marketing.toast.backfillDone'), description: t('marketing.toast.backfillProcessed', { count: String(data.processedRows ?? 0) }) });
      queryClient.invalidateQueries({ queryKey: ['omni-overview'] });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.backfillFailed'), variant: 'destructive' }),
  });

  const updatePixelSettings = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixel-settings'] });
      toast({ title: t('marketing.toast.settingsSaved') });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.settingsFailed'), variant: 'destructive' }),
  });

  const overview = snapshot?.overview;
  const funnel = snapshot?.funnel || [];
  const clusters = snapshot?.frictionClusters || [];
  const creatives = snapshot?.creativeComparison || [];
  const sessions = snapshot?.recentSessions || [];
  const sources = snapshot?.sourceBreakdown || [];
  const statuses = snapshot?.statusBreakdown || [];

  const tabs = [
    { value: 'dashboard', icon: MkrDashboard, labelKey: 'marketing.tab.overview' },
    { value: 'insights', icon: MkrBulb, labelKey: 'marketing.tab.insights' },
    { value: 'campaigns', icon: MkrMegaphone, labelKey: 'marketing.tab.creatives' },
    { value: 'audience', icon: MkrAudience, labelKey: 'marketing.tab.audience' },
    { value: 'configure', icon: MkrConfigure, labelKey: 'marketing.tab.configure' },
  ] as const;

  return (
    <div className={`space-y-[9px] pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-card border border-border rounded-xl p-[13px]">
        <div className="flex items-start justify-between gap-[13px]">
          <div className="relative">
            <div className="flex items-center gap-[9px]">
              <MkrBrain className="w-[18px] h-[18px] text-primary" />
              <div>
                <h1 className="text-[15px] font-extrabold tracking-tight text-foreground">{t('marketing.title')}</h1>
                <p className="text-[11px] text-muted-foreground font-medium">{t('marketing.subtitle')}</p>
              </div>
            </div>
            <div className="w-[27px] h-[3px] rounded-full mt-[7px] bg-primary" />
          </div>
          <div className="flex items-center gap-[7px] flex-shrink-0">
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[110px] h-[31px] rounded-lg bg-muted border-border text-foreground text-[11px] font-bold">
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
            <button className="flex items-center justify-center w-[31px] h-[31px] rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors" onClick={() => refetchSnapshot()}>
              <MkrRefresh className="w-[13px] h-[13px]" />
            </button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-muted/60 border border-border rounded-xl p-1 gap-1 flex flex-nowrap overflow-x-auto">
          {tabs.map(({ value, icon: Icon, labelKey }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs font-bold gap-[5px] px-3 py-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1 text-muted-foreground hover:text-foreground transition-all min-w-0"
            >
              <Icon className="h-[13px] w-[13px] shrink-0" /> <span className="truncate">{t(labelKey)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-[9px] space-y-[9px]">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : !overview ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl p-[13px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-[11px]">
                <MkrDashboard className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.noDataHint') || 'Analytics data will appear here once your store starts receiving traffic and orders.'}</p>
            </div>
          ) : (
            <OverviewTab overview={overview} funnel={funnel} sources={sources} statuses={statuses} />
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-[9px] space-y-[9px]">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <InsightsTab overview={overview} funnel={funnel} />
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-[9px]">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <CreativesTab creatives={creatives} toxicCreativeCount={overview?.toxicCreativeCount ?? 0} />
          )}
        </TabsContent>

        <TabsContent value="audience" className="mt-[9px]">
          {customersLoading || genderLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <AudienceTab customerData={customerData} genderData={genderData} clusters={clusters} sessions={sessions} />
          )}
        </TabsContent>

        <TabsContent value="configure" className="mt-[9px]">
          {inputsLoading || settingsLoading ? (
            <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin text-primary block border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <ConfigureTab
              inputs={inputs}
              settings={settings}
              onSaveEconomics={(payload) => saveEconomics.mutate(payload)}
              onSaveSpend={(payload) => saveSpend.mutate(payload)}
              onDeleteSpend={(id) => deleteSpend.mutate(id)}
              onRunBackfill={(days) => runBackfill.mutate(days)}
              onSaveSettings={(payload) => updatePixelSettings.mutate(payload)}
              savingSpend={saveSpend.isPending}
              runningBackfill={runBackfill.isPending}
              savingSettings={updatePixelSettings.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
