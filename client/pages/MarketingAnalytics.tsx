import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Eye,
  MousePointer,
  BarChart3,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Activity,
  DollarSign,
  Users,
  Target,
  Plus,
  Trash2,
  Zap,
  AlertTriangle,
  Package,
  Save,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Megaphone,
  Percent,
  Clock,
  Scroll,
  LayoutGrid,
  FileSpreadsheet,
  Upload,
  X,
  Facebook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import TikTokIcon from '@/components/icons/TikTokIcon';

// ─── Types ──────────────────────────────────────────────────────

interface OmniOverview {
  sessions: number;
  partialSessions: number;
  productViews: number;
  addToCart: number;
  checkout: number;
  purchases: number;
  totalOrders: number;
  bookedRevenue: number;
  realizedRevenue: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  poas: number | null;
  deliveredOrders: number;
  returnedOrders: number;
  toxicCreativeCount: number;
  avgActiveTimeSeconds: number;
  avgScrollDepth: number;
  unattributedOrders: number;
  missingEconomicsProducts: number;
}

interface FunnelStep {
  label: string;
  value: number;
  rate: number;
}

interface FrictionCluster {
  label: string;
  sessions: number;
  share: number;
  avgScrollDepth: number;
  avgActiveTimeSeconds: number;
  topExitPage: string | null;
  topProductTitle: string | null;
  topSource: string | null;
  reason: string;
}

interface CreativeRow {
  key: string;
  platform: string | null;
  campaignName: string | null;
  adsetName: string | null;
  creativeName: string | null;
  landingPage: string | null;
  promiseAngle: string | null;
  sessions: number;
  productViews: number;
  addToCart: number;
  checkout: number;
  purchases: number;
  bookedRevenue: number;
  realizedRevenue: number;
  spend: number;
  grossProfit: number;
  netProfit: number;
  poas: number | null;
  deliveredOrders: number;
  returnedOrders: number;
  deliveredRate: number;
  returnRate: number;
  toxicSuccess: boolean;
  topFriction: string | null;
}

interface RecentSession {
  id: string;
  startedAt: string;
  source: string | null;
  productTitle: string | null;
  diagnosticLabel: string | null;
  activeTimeSeconds: number;
  maxScrollDepth: number;
  converted: boolean;
  partial: boolean;
}

interface SourceRow {
  source: string;
  sessions: number;
  purchases: number;
  share: number;
}

interface StatusRow {
  status: string;
  count: number;
  share: number;
}

interface OmniRecommendation {
  key: string;
  severity: 'high' | 'medium' | 'low';
  params?: Record<string, string | number>;
}

interface OmniSnapshot {
  periodDays: number;
  overview: OmniOverview;
  funnel: FunnelStep[];
  frictionClusters: FrictionCluster[];
  creativeComparison: CreativeRow[];
  recentSessions: RecentSession[];
  sourceBreakdown: SourceRow[];
  statusBreakdown: StatusRow[];
  recommendations: OmniRecommendation[];
}

interface ProductEcon {
  id: number;
  title: string;
  price: number;
  category: string | null;
  buy_cost: number;
  packaging_cost: number;
  handling_cost: number;
  fallback_shipping_cost: number;
  notes: string | null;
}

interface SpendEntry {
  id: number;
  entry_date: string;
  platform: string;
  campaign_name: string | null;
  adset_name: string | null;
  creative_name: string | null;
  creative_key: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  notes: string | null;
  created_at: string;
}

interface OmniInputs {
  products: ProductEcon[];
  creativeCatalog: any[];
  spendEntries: SpendEntry[];
  importJobs: any[];
}

interface PixelSettings {
  pixels?: any[];
  is_facebook_enabled?: boolean;
  is_tiktok_enabled?: boolean;
  facebook_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
}

interface PixelItem {
  id: string;
  type: 'facebook' | 'tiktok';
  pixel_id: string;
  access_token?: string;
  enabled: boolean;
  name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtNum(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString();
}

function fmtCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '0 DZD';
  return `${Number(amount).toLocaleString()} DZD`;
}

function fmtPoas(poas: number | null | undefined): string {
  if (poas === null || poas === undefined) return '—';
  return `${poas.toFixed(2)}x`;
}

function fmtPct(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0%';
  return `${Number(num).toFixed(1)}%`;
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function severityColor(s: string) {
  if (s === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200/50 dark:border-red-700/50';
  if (s === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-700/50';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50 dark:border-blue-700/50';
}

function frictionColor(label: string) {
  if (label === 'converted') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (label === 'shipping_friction') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  if (label === 'price_trust_friction') return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400';
  if (label === 'ad_mismatch') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300';
}

// Design tokens
const surfaceCard =
  'rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40 transition-shadow hover:shadow-xl';
const surfaceMuted =
  'rounded-2xl bg-white/75 dark:bg-slate-900/35 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-md';
const tabsSurface =
  'bg-white/75 dark:bg-slate-900/35 backdrop-blur border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg rounded-2xl p-1';
const inputClass =
  'h-10 rounded-xl bg-white/75 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-sm';

// ─── Component ──────────────────────────────────────────────────

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  // ─── Queries ─────────────────────────────────────────────

  const { data: snapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<OmniSnapshot>({
    queryKey: ['omni-overview', selectedDays],
    queryFn: () => apiFetch<OmniSnapshot>(`/api/pixels/omni/overview?days=${selectedDays}`),
  });

  const { data: inputs, isLoading: inputsLoading, refetch: refetchInputs } = useQuery<OmniInputs>({
    queryKey: ['omni-inputs'],
    queryFn: () => apiFetch<OmniInputs>('/api/pixels/omni/inputs'),
    enabled: activeTab === 'inputs',
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<PixelSettings>({
    queryKey: ['pixel-settings'],
    queryFn: () => apiFetch<PixelSettings>('/api/pixels/settings'),
    enabled: activeTab === 'settings',
  });

  // ─── Mutations ─────────────────────────────────────────────

  const saveEconomics = useMutation({
    mutationFn: (payload: { productId: number; buyCost: number; packagingCost: number; handlingCost: number; fallbackShippingCost: number; notes?: string }) =>
      apiFetch('/api/pixels/omni/product-economics', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omni-inputs'] });
      queryClient.invalidateQueries({ queryKey: ['omni-overview'] });
      toast({ title: t('marketing.toast.saved'), description: t('marketing.toast.economicsUpdated') });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.economicsFailed'), variant: 'destructive' }),
  });

  const saveSpend = useMutation({
    mutationFn: (payload: { entryDate: string; platform: string; campaignName: string; spend: number; impressions?: number; clicks?: number; notes?: string }) =>
      apiFetch('/api/pixels/omni/creative-spend', { method: 'POST', body: JSON.stringify(payload) }),
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

  // ─── Local state for input forms ──────────────────────────

  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [econDraft, setEconDraft] = useState<Record<string, string>>({});
  const [spendDraft, setSpendDraft] = useState({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });

  // Pixel settings
  const [pixels, setPixels] = useState<PixelItem[]>([]);
  const [newPixel, setNewPixel] = useState<Partial<PixelItem>>({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });
  const [settingsObj, setSettingsObj] = useState<PixelSettings>({});

  useEffect(() => {
    if (settings) {
      setSettingsObj(settings);
      const loaded: PixelItem[] = [];
      if (settings.facebook_pixel_id) {
        loaded.push({ id: 'fb-main', type: 'facebook', pixel_id: settings.facebook_pixel_id, access_token: (settings as any).facebook_access_token || '', enabled: settings.is_facebook_enabled || false, name: t('pixels.mainFacebookPixel') });
      }
      if (settings.tiktok_pixel_id) {
        loaded.push({ id: 'tt-main', type: 'tiktok', pixel_id: settings.tiktok_pixel_id, access_token: (settings as any).tiktok_access_token || '', enabled: settings.is_tiktok_enabled || false, name: t('pixels.mainTiktokPixel') });
      }
      if ((settings as any).additional_pixels) loaded.push(...(settings as any).additional_pixels);
      setPixels(loaded);
    }
  }, [settings, t]);

  // ─── Derived data ──────────────────────────────────────────

  const overview = snapshot?.overview;
  const funnel = snapshot?.funnel || [];
  const clusters = snapshot?.frictionClusters || [];
  const creatives = snapshot?.creativeComparison || [];
  const sessions = snapshot?.recentSessions || [];
  const sources = snapshot?.sourceBreakdown || [];
  const statuses = snapshot?.statusBreakdown || [];
  const recs = snapshot?.recommendations || [];
  const maxFunnel = Math.max(1, ...funnel.map(f => f.value));
  const funnelLabelKey: Record<string, string> = { sessions: 'marketing.funnel.sessions', views: 'marketing.funnel.views', orders: 'marketing.funnel.orders', delivered: 'marketing.funnel.delivered' };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{t('marketing.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('marketing.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDays} onValueChange={setSelectedDays}>
            <SelectTrigger className={`w-[130px] ${inputClass}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('marketing.last7')}</SelectItem>
              <SelectItem value="14">{t('marketing.last14')}</SelectItem>
              <SelectItem value="30">{t('marketing.last30')}</SelectItem>
              <SelectItem value="60">{t('marketing.last60')}</SelectItem>
              <SelectItem value="90">{t('marketing.last90')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => refetchSnapshot()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={tabsSurface}>
          <TabsTrigger value="overview" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <BarChart3 className="h-3.5 w-3.5" /> {t('marketing.tab.overview')}
          </TabsTrigger>
          <TabsTrigger value="creatives" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <Megaphone className="h-3.5 w-3.5" /> {t('marketing.tab.creatives')}
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <Activity className="h-3.5 w-3.5" /> {t('marketing.tab.diagnostics')}
          </TabsTrigger>
          <TabsTrigger value="inputs" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t('marketing.tab.inputs')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
            <Settings className="h-3.5 w-3.5" /> {t('marketing.tab.settings')}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════ OVERVIEW ═══════════════════════════════ */}
        <TabsContent value="overview" className="space-y-4">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : !overview ? (
            <div className={`${surfaceMuted} p-8 text-center text-sm text-muted-foreground`}>
              {t('marketing.noData')}
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3">
                <KPICard icon={<Users className="h-3.5 w-3.5 text-white" />} iconBg="from-blue-500 to-indigo-600" label={t('marketing.kpi.sessions')} value={fmtNum(overview.sessions)} sub={overview.partialSessions > 0 ? t('marketing.kpi.partial', { count: fmtNum(overview.partialSessions) }) : undefined} />
                <KPICard icon={<Eye className="h-3.5 w-3.5 text-white" />} iconBg="from-violet-500 to-purple-600" label={t('marketing.kpi.productViews')} value={fmtNum(overview.productViews)} />
                <KPICard icon={<ShoppingCart className="h-3.5 w-3.5 text-white" />} iconBg="from-orange-500 to-amber-600" label={t('marketing.kpi.orders')} value={fmtNum(overview.totalOrders)} sub={overview.totalOrders > 0 ? t('marketing.kpi.deliveredPct', { pct: fmtPct((overview.deliveredOrders / overview.totalOrders) * 100) }) : undefined} />
                <KPICard icon={<CheckCircle className="h-3.5 w-3.5 text-white" />} iconBg="from-emerald-500 to-green-600" label={t('marketing.kpi.delivered')} value={fmtNum(overview.deliveredOrders)} sub={overview.deliveredOrders > 0 ? fmtCurrency(overview.realizedRevenue) : undefined} positive={overview.deliveredOrders > 0} />
                <KPICard icon={<DollarSign className="h-3.5 w-3.5 text-white" />} iconBg="from-teal-500 to-cyan-600" label={t('marketing.kpi.netProfit')} value={fmtCurrency(overview.netProfit)} sub={overview.poas !== null ? `POAS ${fmtPoas(overview.poas)}` : t('marketing.kpi.noSpend')} positive={overview.netProfit > 0} />
                <KPICard icon={<Package className="h-3.5 w-3.5 text-white" />} iconBg="from-rose-500 to-pink-600" label={t('marketing.kpi.returnRate')} value={overview.deliveredOrders + overview.returnedOrders > 0 ? fmtPct((overview.returnedOrders / (overview.deliveredOrders + overview.returnedOrders)) * 100) : '—'} sub={t('marketing.kpi.returned', { count: fmtNum(overview.returnedOrders) })} positive={false} />
              </div>

              {/* Revenue breakdown mini-row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label={t('marketing.mini.bookedRevenue')} value={fmtCurrency(overview.bookedRevenue)} />
                <MiniStat label={t('marketing.mini.realizedRevenue')} value={fmtCurrency(overview.realizedRevenue)} />
                <MiniStat label={t('marketing.mini.adSpend')} value={fmtCurrency(overview.adSpend)} />
                <MiniStat label={t('marketing.mini.grossProfit')} value={fmtCurrency(overview.grossProfit)} />
              </div>

              {/* Funnel + Sources */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Funnel */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-3 md:p-4">
                    <CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" /> {t('marketing.funnel.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-2">
                    {funnel.map((step, idx) => (
                      <div key={step.label} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{t(funnelLabelKey[step.label] || step.label)}</span>
                          <span className="text-muted-foreground">{fmtNum(step.value)} ({fmtPct(step.rate)})</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                            style={{ width: `${Math.max(2, (step.value / maxFunnel) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Source breakdown */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-3 md:p-4">
                    <CardTitle className="flex items-center gap-2 text-sm"><Megaphone className="h-4 w-4" /> {t('marketing.sources.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0">
                    {sources.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('marketing.sources.noData')}</p>
                    ) : (
                      <div className="space-y-2">
                        {sources.map(src => (
                          <div key={src.source} className="flex items-center gap-2 text-xs">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="font-semibold capitalize">{src.source}</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${src.share}%` }} />
                              </div>
                            </div>
                            <span className="text-muted-foreground w-16 text-right">{fmtNum(src.sessions)} {t('marketing.sources.sessions')}</span>
                            <span className="text-muted-foreground w-12 text-right">{fmtNum(src.purchases)} {t('marketing.sources.orders')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {recs.length > 0 && (
                <Card className={surfaceCard}>
                  <CardHeader className="p-3 md:p-4">
                    <CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-amber-500" /> {t('marketing.recs.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0 space-y-2">
                    {recs.map((rec, i) => {
                      const p = rec.params || {};
                      const strParams = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
                      return (
                        <div key={i} className={`rounded-xl border p-3 ${severityColor(rec.severity)}`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <div className="space-y-0.5">
                              <p className="font-bold text-xs">{t(`marketing.rec.${rec.key}.title`, strParams)}</p>
                              <p className="text-sm opacity-80">{t(`marketing.rec.${rec.key}.detail`, strParams)}</p>
                              <p className="text-sm font-medium opacity-90">→ {t(`marketing.rec.${rec.key}.action`)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Order status breakdown */}
              {statuses.length > 0 && (
                <Card className={surfaceCard}>
                  <CardHeader className="p-3 md:p-4">
                    <CardTitle className="flex items-center gap-2 text-sm"><Package className="h-4 w-4" /> {t('marketing.status.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      {statuses.map(st => (
                        <Badge key={st.status} variant="secondary" className="text-xs py-1 px-2.5 rounded-lg">
                          {t(`marketing.orderStatus.${st.status}`)}: {fmtNum(st.count)} ({fmtPct(st.share)})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════ CREATIVES ═══════════════════════════════ */}
        <TabsContent value="creatives" className="space-y-4">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : creatives.length === 0 ? (
            <div className={`${surfaceMuted} p-8 text-center text-sm text-muted-foreground`}>
              {t('marketing.creatives.noData')}
            </div>
          ) : (
            <>
              {overview && overview.toxicCreativeCount > 0 && (
                <div className="rounded-2xl border border-red-300/50 dark:border-red-700/50 bg-red-50/80 dark:bg-red-900/20 p-3 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-800 dark:text-red-300 font-medium">
                    {t('marketing.creatives.toxicWarning', { count: String(overview.toxicCreativeCount) })}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs uppercase tracking-wider">
                      <TableHead className="w-[180px]">{t('marketing.creatives.col.creative')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.sessions')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.orders')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.delivered')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.revenue')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.spend')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.netProfit')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.poas')}</TableHead>
                      <TableHead className="text-right">{t('marketing.creatives.col.returnPct')}</TableHead>
                      <TableHead>{t('marketing.creatives.col.friction')}</TableHead>
                      <TableHead className="w-[60px]">{t('marketing.creatives.col.flag')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatives.map(c => (
                      <TableRow key={c.key} className={c.toxicSuccess ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                        <TableCell className="text-xs">
                          <div className="max-w-[180px] truncate font-medium">{c.creativeName || c.campaignName || c.key}</div>
                          {c.platform && <span className="text-xs text-muted-foreground capitalize">{c.platform}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(c.sessions)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(c.purchases)}</TableCell>
                        <TableCell className="text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">{fmtNum(c.deliveredOrders)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtCurrency(c.realizedRevenue)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtCurrency(c.spend)}</TableCell>
                        <TableCell className={`text-right text-xs font-bold ${c.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(c.netProfit)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmtPoas(c.poas)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtPct(c.returnRate)}</TableCell>
                        <TableCell className="text-xs">
                          {c.topFriction && <Badge variant="secondary" className="text-xs py-0.5">{t(`marketing.friction.${c.topFriction}`)}</Badge>}
                        </TableCell>
                        <TableCell>
                          {c.toxicSuccess && (
                            <Badge variant="destructive" className="text-xs py-0 px-1.5">{t('marketing.creatives.toxic')}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════ DIAGNOSTICS ═══════════════════════════════ */}
        <TabsContent value="diagnostics" className="space-y-4">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : (
            <>
              {/* Friction clusters */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> {t('marketing.diag.frictionTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('marketing.diag.frictionDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0 space-y-3">
                  {clusters.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('marketing.diag.noData')}</p>
                  ) : (
                    clusters.map((cl, idx) => (
                      <div key={idx} className={`rounded-xl border p-3 ${surfaceMuted}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`text-xs py-0.5 rounded-lg ${frictionColor(cl.label)}`}>{t(`marketing.friction.${cl.label}`)}</Badge>
                          <span className="text-xs font-bold">{fmtNum(cl.sessions)} {t('marketing.diag.sessions')} ({fmtPct(cl.share)})</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{t(`marketing.frictionReason.${cl.reason}`)}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Scroll className="h-3 w-3" /> {t('marketing.diag.scroll')}: {Math.round(cl.avgScrollDepth)}%</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t('marketing.diag.time')}: {fmtSeconds(cl.avgActiveTimeSeconds)}</span>
                          {cl.topExitPage && <span className="flex items-center gap-1">{t('marketing.diag.exit')}: {cl.topExitPage}</span>}
                          {cl.topSource && <span className="flex items-center gap-1">{t('marketing.diag.source')}: {cl.topSource}</span>}
                          {cl.topProductTitle && <span className="flex items-center gap-1">{t('marketing.diag.product')}: {cl.topProductTitle}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Recent sessions */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><LayoutGrid className="h-4 w-4" /> {t('marketing.diag.recentTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('marketing.diag.noSessions')}</p>
                  ) : (
                    <div className="overflow-x-auto">
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
                              <TableCell>
                                {s.diagnosticLabel ? (
                                  <Badge className={`text-xs py-0.5 rounded-lg ${frictionColor(s.diagnosticLabel)}`}>{t(`marketing.friction.${s.diagnosticLabel}`)}</Badge>
                                ) : '—'}
                              </TableCell>
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
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════ INPUTS ═══════════════════════════════ */}
        <TabsContent value="inputs" className="space-y-4">
          {inputsLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : (
            <>
              {/* Product Economics */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><Package className="h-4 w-4" /> {t('marketing.inputs.econTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.econDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  {(!inputs?.products || inputs.products.length === 0) ? (
                    <p className="text-xs text-muted-foreground">{t('marketing.inputs.noProducts')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs uppercase tracking-wider">
                            <TableHead>{t('marketing.inputs.col.product')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.sellPrice')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.buyCost')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.packaging')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.handling')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.shipping')}</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs!.products.map(p => {
                            const isEditing = editingProduct === p.id;
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs font-medium max-w-[160px] truncate">{p.title}</TableCell>
                                <TableCell className="text-right text-xs">{fmtCurrency(p.price)}</TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.buy_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, buy_cost: e.target.value }))} />
                                  ) : (
                                    <span className="text-xs">{fmtCurrency(p.buy_cost)}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.packaging_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, packaging_cost: e.target.value }))} />
                                  ) : (
                                    <span className="text-xs">{fmtCurrency(p.packaging_cost)}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.handling_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, handling_cost: e.target.value }))} />
                                  ) : (
                                    <span className="text-xs">{fmtCurrency(p.handling_cost)}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.fallback_shipping_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, fallback_shipping_cost: e.target.value }))} />
                                  ) : (
                                    <span className="text-xs">{fmtCurrency(p.fallback_shipping_cost)}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => {
                                        saveEconomics.mutate({
                                          productId: p.id,
                                          buyCost: parseFloat(econDraft.buy_cost) || 0,
                                          packagingCost: parseFloat(econDraft.packaging_cost) || 0,
                                          handlingCost: parseFloat(econDraft.handling_cost) || 0,
                                          fallbackShippingCost: parseFloat(econDraft.fallback_shipping_cost) || 0,
                                        });
                                        setEditingProduct(null);
                                      }}>
                                        <Save className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setEditingProduct(null)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => {
                                      setEditingProduct(p.id);
                                      setEconDraft({
                                        buy_cost: String(p.buy_cost || ''),
                                        packaging_cost: String(p.packaging_cost || ''),
                                        handling_cost: String(p.handling_cost || ''),
                                        fallback_shipping_cost: String(p.fallback_shipping_cost || ''),
                                      });
                                    }}>
                                      {t('edit')}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ad Spend */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> {t('marketing.inputs.spendTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.spendDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0 space-y-3">
                  {/* Add new entry */}
                  <div className={`${surfaceMuted} p-3 space-y-2`}>
                    <p className="text-xs font-bold">{t('marketing.inputs.addEntry')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.date')}</Label>
                        <Input type="date" className={inputClass} value={spendDraft.entryDate} onChange={e => setSpendDraft(d => ({ ...d, entryDate: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.platform')}</Label>
                        <Select value={spendDraft.platform} onValueChange={v => setSpendDraft(d => ({ ...d, platform: v }))}>
                          <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="other">{t('marketing.platform.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.campaign')}</Label>
                        <Input className={inputClass} placeholder={t('marketing.inputs.campaignPlaceholder')} value={spendDraft.campaignName} onChange={e => setSpendDraft(d => ({ ...d, campaignName: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.spend')} (DZD)</Label>
                        <Input className={inputClass} type="number" placeholder="0" value={spendDraft.spend} onChange={e => setSpendDraft(d => ({ ...d, spend: e.target.value }))} />
                      </div>
                    </div>
                    <Button size="sm" className="h-9 rounded-xl text-xs" disabled={saveSpend.isPending} onClick={() => {
                      if (!spendDraft.entryDate || !spendDraft.spend) return;
                      saveSpend.mutate({
                        entryDate: spendDraft.entryDate,
                        platform: spendDraft.platform,
                        campaignName: spendDraft.campaignName,
                        spend: parseFloat(spendDraft.spend) || 0,
                        impressions: parseInt(spendDraft.impressions) || undefined,
                        clicks: parseInt(spendDraft.clicks) || undefined,
                        notes: spendDraft.notes || undefined,
                      });
                      setSpendDraft({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
                    }}>
                      {saveSpend.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                      {t('marketing.inputs.addEntry')}
                    </Button>
                  </div>

                  {/* Spend entries list */}
                  {inputs?.spendEntries && inputs.spendEntries.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs uppercase tracking-wider">
                            <TableHead>{t('marketing.inputs.col.date')}</TableHead>
                            <TableHead>{t('marketing.inputs.col.platform')}</TableHead>
                            <TableHead>{t('marketing.inputs.col.campaign')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.spend')}</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs.spendEntries.map(entry => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs">{entry.entry_date}</TableCell>
                              <TableCell className="text-xs capitalize">{entry.platform}</TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]">{entry.campaign_name || '—'}</TableCell>
                              <TableCell className="text-right text-xs font-medium">{fmtCurrency(entry.spend)}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteSpend.mutate(entry.id)}>
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historical backfill */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" /> {t('marketing.inputs.backfillTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.backfillDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0 flex items-center gap-3">
                  <Button size="sm" className="h-9 rounded-xl text-xs" disabled={runBackfill.isPending} onClick={() => runBackfill.mutate(90)}>
                    {runBackfill.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    {t('marketing.inputs.backfillBtn')}
                  </Button>
                  {inputs?.importJobs && inputs.importJobs.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t('marketing.inputs.lastImport', { status: inputs.importJobs[0].status, rows: String(inputs.importJobs[0].processed_rows ?? 0) })}
                    </span>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════ SETTINGS ═══════════════════════════════ */}
        <TabsContent value="settings" className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : (
            <>
              {/* Existing pixel management */}
              <Card className={surfaceCard}>
                <CardHeader className="p-3 md:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm"><Settings className="h-4 w-4" /> {t('marketing.settings.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('marketing.settings.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0 space-y-4">
                  {/* Current pixels */}
                  {pixels.length > 0 && (
                    <div className="space-y-2">
                      {pixels.map(px => (
                        <div key={px.id} className={`${surfaceMuted} p-3 flex items-center gap-3`}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm flex-shrink-0" style={{ background: px.type === 'facebook' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
                            {px.type === 'facebook' ? <Facebook className="h-3.5 w-3.5 text-white" /> : <TikTokIcon className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{px.name || `${px.type} Pixel`}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{px.pixel_id}</p>
                          </div>
                          <Switch checked={px.enabled} onCheckedChange={v => {
                            setPixels(prev => prev.map(p => p.id === px.id ? { ...p, enabled: v } : p));
                          }} />
                          {!px.id.endsWith('-main') && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPixels(prev => prev.filter(p => p.id !== px.id))}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add pixel */}
                  <div className={`${surfaceMuted} p-3 space-y-2`}>
                    <p className="text-xs font-bold">{t('marketing.settings.addPixel')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Select value={newPixel.type || 'facebook'} onValueChange={v => setNewPixel(d => ({ ...d, type: v as 'facebook' | 'tiktok' }))}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className={inputClass} placeholder={t('marketing.settings.pixelId')} value={newPixel.pixel_id || ''} onChange={e => setNewPixel(d => ({ ...d, pixel_id: e.target.value }))} />
                      <Input className={inputClass} placeholder={t('marketing.settings.accessToken')} value={newPixel.access_token || ''} onChange={e => setNewPixel(d => ({ ...d, access_token: e.target.value }))} />
                      <Input className={inputClass} placeholder={t('marketing.settings.pixelName')} value={newPixel.name || ''} onChange={e => setNewPixel(d => ({ ...d, name: e.target.value }))} />
                    </div>
                    <Button size="sm" className="h-9 rounded-xl text-xs" onClick={() => {
                      if (!newPixel.pixel_id?.trim()) {
                        toast({ title: t('marketing.toast.error'), description: t('marketing.toast.enterPixelId'), variant: 'destructive' });
                        return;
                      }
                      setPixels(prev => [...prev, {
                        id: `${newPixel.type}-${Date.now()}`,
                        type: (newPixel.type || 'facebook') as 'facebook' | 'tiktok',
                        pixel_id: newPixel.pixel_id!.trim(),
                        access_token: newPixel.access_token?.trim() || '',
                        enabled: true,
                        name: newPixel.name?.trim() || `${newPixel.type === 'tiktok' ? 'TikTok' : 'Facebook'} Pixel ${pixels.filter(p => p.type === newPixel.type).length + 1}`,
                      }]);
                      setNewPixel({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });
                    }}>
                      <Plus className="h-3 w-3 mr-1" /> {t('marketing.settings.addPixel')}
                    </Button>
                  </div>

                  {/* Save */}
                  <Button
                    className="h-10 rounded-xl w-full text-sm"
                    disabled={updatePixelSettings.isPending}
                    onClick={() => {
                      const fb = pixels.find(p => p.type === 'facebook' && p.id === 'fb-main');
                      const tt = pixels.find(p => p.type === 'tiktok' && p.id === 'tt-main');
                      const additional = pixels.filter(p => !p.id.endsWith('-main'));
                      updatePixelSettings.mutate({
                        facebook_pixel_id: fb?.pixel_id || null,
                        facebook_access_token: fb?.access_token || null,
                        is_facebook_enabled: fb?.enabled ?? false,
                        tiktok_pixel_id: tt?.pixel_id || null,
                        tiktok_access_token: tt?.access_token || null,
                        is_tiktok_enabled: tt?.enabled ?? false,
                        additional_pixels: additional,
                      });
                    }}
                  >
                    {updatePixelSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {t('marketing.settings.save')}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function KPICard({ icon, iconBg, label, value, sub, positive }: { icon: React.ReactNode; iconBg: string; label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl shadow-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${iconBg}`}>
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-extrabold">{value}</p>
      {sub && (
        <p className={`text-[11px] mt-0.5 ${positive === true ? 'text-emerald-600 dark:text-emerald-400' : positive === false ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/75 dark:bg-slate-900/35 backdrop-blur p-2.5">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}
