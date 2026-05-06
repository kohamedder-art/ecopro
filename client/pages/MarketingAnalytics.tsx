import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, AreaChart, Area } from 'recharts';
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
  UserCheck,
  MapPin,
  Smartphone,
  Monitor,
  Tablet,
  Repeat,
  Crown,
  Facebook,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/components/ui/use-toast';
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
  product_id: number | null;
  product_title: string | null;
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

interface CustomerAnalytics {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  averageOrderValue: number;
  averageOrdersPerCustomer: number;
  totalRevenue: number;
  topCustomers: { name: string; phone: string; orders: number; totalSpent: number; lastOrder: string }[];
  wilayaBreakdown: { wilayaId: number; wilayaName: string; orders: number; revenue: number; customers: number }[];
  deviceBreakdown: { device: string; sessions: number; share: number }[];
  ordersByDay: { date: string; orders: number; revenue: number }[];
  newVsReturning: { newCustomers: number; returningCustomers: number; newRevenue: number; returningRevenue: number };
  conversionRate: number;
  cartAbandonmentRate: number;
}

interface GenderAnalytics {
  male: number;
  female: number;
  unknown: number;
  total: number;
  malePercent: number;
  femalePercent: number;
  unknownPercent: number;
  byProduct: { productId: number; productTitle: string; male: number; female: number; unknown: number }[];
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
  'bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg rounded-2xl p-1.5 overflow-x-auto overflow-y-hidden flex-nowrap w-full scroll-smooth snap-x snap-mandatory';
const inputClass =
  'h-10 rounded-xl bg-white/75 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 text-sm';

// ─── Component ──────────────────────────────────────────────────

export default function MarketingAnalytics() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const { data: aiSettings } = useAISettings();
  const isRTL = locale === 'ar';
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  const generateBroadcastMessage = async (segment: string, campaignType: string) => {
    if (!aiSettings?.broadcast_composer) return;
    
    try {
      const res = await fetch('/api/ai/whatsapp/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          segment,
          campaignType,
          storeInfo: {
            name: 'Your Store',
            description: 'Store description',
          },
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          toast({ 
            title: 'Broadcast Message Generated', 
            description: data.message,
            duration: 15000 
          });
        }
      }
    } catch (e) {
      toast({ 
        title: 'Error', 
        description: 'Failed to generate broadcast message',
        variant: 'destructive'
      });
    }
  };

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

  const { data: customerData, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['omni-customers', selectedDays],
    queryFn: () => apiFetch<CustomerAnalytics>(`/api/pixels/omni/customers?days=${selectedDays}`),
    enabled: activeTab === 'customers',
  });

  const { data: genderData, isLoading: genderLoading } = useQuery<GenderAnalytics>({
    queryKey: ['omni-gender', selectedDays],
    queryFn: () => apiFetch<GenderAnalytics>(`/api/pixels/omni/gender?days=${selectedDays}`),
    enabled: activeTab === 'customers',
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
    mutationFn: (payload: { entryDate: string; platform: string; productId?: number; campaignName: string; spend: number; impressions?: number; clicks?: number; notes?: string }) =>
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
  const [spendDraft, setSpendDraft] = useState({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', productId: 'all', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
  const [expandedCreative, setExpandedCreative] = useState<string | null>(null);

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

  const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff', '#818cf8'];
  const funnelChartData = useMemo(() => funnel.map(f => ({
    name: t(funnelLabelKey[f.label] || f.label),
    value: f.value,
    rate: f.rate,
  })), [funnel, t]);

  const sourceChartData = useMemo(() => sources.slice(0, 6).map((s, i) => ({
    name: s.source,
    sessions: s.sessions,
    purchases: s.purchases,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })), [sources]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 shadow-lg">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-blue-300/30 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Brain className="h-4.5 w-4.5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white">{t('marketing.title')}</h1>
              <p className="text-[11px] text-white/50 flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" />
                {t('marketing.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiSettings?.broadcast_composer && (
              <button
                onClick={() => generateBroadcastMessage('all', 'promotion')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" />
                {t('marketing.composeBroadcast') || 'Compose Broadcast'}
              </button>
            )}
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[120px] h-8 rounded-lg bg-white/10 backdrop-blur-sm border-white/15 text-white text-xs hover:bg-white/15 transition-colors [&>svg]:text-white/50">
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
            <Button size="sm" className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 text-white hover:bg-white/15 transition-colors p-0" onClick={() => refetchSnapshot()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg rounded-2xl overflow-hidden">
          <TabsList className="overflow-x-auto overflow-y-hidden w-full bg-transparent p-0 h-auto gap-0 scroll-smooth snap-x snap-mandatory flex justify-start">
            <TabsTrigger value="overview" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <BarChart3 className="h-3.5 w-3.5" /> {t('marketing.tab.overview')}
            </TabsTrigger>
            <TabsTrigger value="creatives" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <Megaphone className="h-3.5 w-3.5" /> {t('marketing.tab.creatives')}
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <Activity className="h-3.5 w-3.5" /> {t('marketing.tab.diagnostics')}
            </TabsTrigger>
            <TabsTrigger value="customers" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <UserCheck className="h-3.5 w-3.5" /> {t('marketing.tab.customers')}
            </TabsTrigger>
            <TabsTrigger value="inputs" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <FileSpreadsheet className="h-3.5 w-3.5" /> {t('marketing.tab.inputs')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none text-xs font-bold gap-1.5 px-4 py-3 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex-shrink-0 border-b-2 border-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-400">
              <Settings className="h-3.5 w-3.5" /> {t('marketing.tab.settings')}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════════════════ OVERVIEW ═══════════════════════════════ */}
        <TabsContent value="overview" className="space-y-3">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : !overview ? (
            <div className={`${surfaceCard} p-10 flex flex-col items-center justify-center text-center`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 mb-4">
                <BarChart3 className="h-7 w-7 text-violet-500" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.noDataHint') || 'Analytics data will appear here once your store starts receiving traffic and orders.'}</p>
            </div>
          ) : (
            <>
              {/* KPI cards — compact 2-row grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KPICard icon={<Users className="h-3.5 w-3.5 text-white" />} iconBg="from-blue-500 to-indigo-600" label={t('marketing.kpi.sessions')} value={fmtNum(overview.sessions)} sub={overview.partialSessions > 0 ? t('marketing.kpi.partial', { count: fmtNum(overview.partialSessions) }) : undefined} />
                <KPICard icon={<ShoppingCart className="h-3.5 w-3.5 text-white" />} iconBg="from-orange-500 to-amber-600" label={t('marketing.kpi.orders')} value={fmtNum(overview.totalOrders)} sub={overview.totalOrders > 0 ? t('marketing.kpi.deliveredPct', { pct: fmtPct((overview.deliveredOrders / overview.totalOrders) * 100) }) : undefined} />
                <KPICard icon={<CheckCircle className="h-3.5 w-3.5 text-white" />} iconBg="from-emerald-500 to-green-600" label={t('marketing.kpi.delivered')} value={fmtNum(overview.deliveredOrders)} sub={fmtCurrency(overview.realizedRevenue)} positive={overview.deliveredOrders > 0} />
                <KPICard icon={<DollarSign className="h-3.5 w-3.5 text-white" />} iconBg="from-teal-500 to-cyan-600" label={t('marketing.kpi.netProfit')} value={fmtCurrency(overview.netProfit)} sub={overview.poas !== null ? `POAS ${fmtPoas(overview.poas)}` : t('marketing.kpi.noSpend')} positive={overview.netProfit > 0} />
                <KPICard icon={<Package className="h-3.5 w-3.5 text-white" />} iconBg="from-rose-500 to-pink-600" label={t('marketing.kpi.returnRate')} value={overview.deliveredOrders + overview.returnedOrders > 0 ? fmtPct((overview.returnedOrders / (overview.deliveredOrders + overview.returnedOrders)) * 100) : '—'} sub={t('marketing.kpi.returned', { count: fmtNum(overview.returnedOrders) })} positive={false} />
              </div>

              {/* Revenue mini-stats inline */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <MiniStat label={t('marketing.mini.bookedRevenue')} value={fmtCurrency(overview.bookedRevenue)} />
                <MiniStat label={t('marketing.mini.realizedRevenue')} value={fmtCurrency(overview.realizedRevenue)} />
                <MiniStat label={t('marketing.mini.adSpend')} value={fmtCurrency(overview.adSpend)} />
                <MiniStat label={t('marketing.mini.grossProfit')} value={fmtCurrency(overview.grossProfit)} />
              </div>

              {/* Two-column: Funnel Chart + Source Pie */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Funnel bar chart */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                        <Target className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.funnel.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    {funnelChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={funnelChartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
                          <YAxis type="category" dataKey="name" width={isRTL ? 100 : 80} tick={{ fontSize: 10 }} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: number, _name: string, entry: any) => [`${fmtNum(value)} (${fmtPct(entry.payload.rate)})`, '']}
                          />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={32}>
                            {funnelChartData.map((_e, i) => (
                              <Cell key={i} fill={['#818cf8', '#a78bfa', '#fbbf24', '#34d399'][i] || '#818cf8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 mb-3">
                          <Target className="h-5 w-5 text-violet-400" />
                        </div>
                        <p className="text-xs font-medium">{t('marketing.noData')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Source breakdown pie */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-sm">
                        <Megaphone className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.sources.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    {sourceChartData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30 mb-3">
                          <Megaphone className="h-5 w-5 text-indigo-400" />
                        </div>
                        <p className="text-xs font-medium">{t('marketing.sources.noData')}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Source data appears once tracked traffic arrives.</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="50%" height={180}>
                          <PieChart>
                            <Pie data={sourceChartData} dataKey="sessions" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={2} stroke="var(--background)">
                              {sourceChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          {sourceChartData.map(src => (
                            <div key={src.name} className="flex items-center gap-2.5 text-xs">
                              <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: src.fill }} />
                              <span className="font-bold capitalize flex-1 truncate">{src.name}</span>
                              <span className="text-muted-foreground tabular-nums font-medium">{fmtNum(src.sessions)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Two-column: Recommendations + Order Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recommendations */}
                {recs.length > 0 && (
                  <Card className={surfaceCard}>
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
                          <Zap className="h-3.5 w-3.5 text-white" />
                        </span>
                        {t('marketing.recs.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 space-y-2.5">
                      {recs.map((rec, i) => {
                        const p = rec.params || {};
                        const strParams = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
                        return (
                          <div key={i} className={`rounded-xl border p-2.5 ${severityColor(rec.severity)}`}>
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <div className="space-y-0.5 min-w-0">
                                <p className="font-bold text-xs">{t(`marketing.rec.${rec.key}.title`, strParams)}</p>
                                <p className="text-xs opacity-80">{t(`marketing.rec.${rec.key}.detail`, strParams)}</p>
                                <p className="text-xs font-medium opacity-90">→ {t(`marketing.rec.${rec.key}.action`)}</p>
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
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                          <Package className="h-3.5 w-3.5 text-white" />
                        </span>
                        {t('marketing.status.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {statuses.map(st => (
                          <Badge key={st.status} variant="secondary" className="text-[11px] py-1 px-2.5 rounded-lg font-medium">
                            {t(`marketing.orderStatus.${st.status}`)}: {fmtNum(st.count)} ({fmtPct(st.share)})
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════ CREATIVES ═══════════════════════════════ */}
        <TabsContent value="creatives" className="space-y-3">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : creatives.length === 0 ? (
            <div className={`${surfaceCard} p-10 flex flex-col items-center justify-center text-center`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 mb-4">
                <Megaphone className="h-7 w-7 text-orange-500" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.creatives.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">Creative performance data will appear once campaigns are tracked through your pixel.</p>
            </div>
          ) : (
            <>
              {overview && overview.toxicCreativeCount > 0 && (
                <div className="rounded-2xl border border-red-300/50 dark:border-red-700/50 bg-red-50/80 dark:bg-red-900/20 p-2.5 flex items-center gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-800 dark:text-red-300 font-medium">
                    {t('marketing.creatives.toxicWarning', { count: String(overview.toxicCreativeCount) })}
                  </span>
                </div>
              )}

              {/* Condensed creative cards */}
              <div className="space-y-2">
                {creatives.map(c => {
                  const isOpen = expandedCreative === c.key;
                  return (
                    <div key={c.key} className={`${surfaceCard} overflow-hidden ${c.toxicSuccess ? 'ring-2 ring-red-400/40' : ''}`}>
                      {/* Summary row */}
                      <button
                        type="button"
                        onClick={() => setExpandedCreative(isOpen ? null : c.key)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate">{c.creativeName || c.campaignName || c.key}</span>
                            {c.platform && <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">{c.platform}</Badge>}
                            {c.toxicSuccess && <Badge variant="destructive" className="text-[10px] py-0 px-1.5">{t('marketing.creatives.toxic')}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs shrink-0">
                          <div className="text-center">
                            <p className="font-bold">{fmtNum(c.sessions)}</p>
                            <p className="text-[10px] text-muted-foreground">{t('marketing.creatives.col.sessions')}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold">{fmtNum(c.purchases)}</p>
                            <p className="text-[10px] text-muted-foreground">{t('marketing.creatives.col.orders')}</p>
                          </div>
                          <div className="text-center">
                            <p className={`font-bold ${c.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(c.netProfit)}</p>
                            <p className="text-[10px] text-muted-foreground">{t('marketing.creatives.col.netProfit')}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold">{fmtPoas(c.poas)}</p>
                            <p className="text-[10px] text-muted-foreground">POAS</p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isOpen && (
                        <div className="px-3 pb-3 pt-0 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2.5">
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.kpi.productViews')}</p>
                              <p className="text-xs font-bold mt-0.5">{fmtNum(c.productViews)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.creatives.col.delivered')}</p>
                              <p className="text-xs font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{fmtNum(c.deliveredOrders)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.creatives.col.revenue')}</p>
                              <p className="text-xs font-bold mt-0.5">{fmtCurrency(c.realizedRevenue)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.creatives.col.spend')}</p>
                              <p className="text-xs font-bold mt-0.5">{fmtCurrency(c.spend)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.mini.grossProfit')}</p>
                              <p className="text-xs font-bold mt-0.5">{fmtCurrency(c.grossProfit)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.creatives.col.returnPct')}</p>
                              <p className="text-xs font-bold mt-0.5">{fmtPct(c.returnRate)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('marketing.creatives.col.friction')}</p>
                              {c.topFriction ? (
                                <Badge className={`text-[10px] py-0 mt-0.5 ${frictionColor(c.topFriction)}`}>{t(`marketing.friction.${c.topFriction}`)}</Badge>
                              ) : (
                                <p className="text-xs mt-0.5">—</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 shadow-sm">
                      <Activity className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.diag.frictionTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('marketing.diag.frictionDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {clusters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <p className="text-xs font-medium">{t('marketing.diag.noData')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">No friction patterns detected — your store is running smoothly.</p>
                    </div>
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
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 shadow-sm">
                      <LayoutGrid className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.diag.recentTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/50 mb-3">
                        <Users className="h-5 w-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-medium">{t('marketing.diag.noSessions')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Session replays will appear as visitors browse your store.</p>
                    </div>
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

        {/* ═══════════════════════════════ CUSTOMERS ═══════════════════════════════ */}
        <TabsContent value="customers" className="space-y-4">
          {customersLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : !customerData ? (
            <div className={`${surfaceCard} p-10 flex flex-col items-center justify-center text-center`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 mb-4">
                <Users className="h-7 w-7 text-cyan-500" />
              </div>
              <p className="text-sm font-bold mb-1">{t('marketing.customers.noData')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('marketing.customers.noDataHint')}</p>
            </div>
          ) : (
            <>
              {/* Customer KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard icon={<Users className="h-3.5 w-3.5 text-white" />} iconBg="from-blue-500 to-indigo-600" label={t('marketing.customers.total')} value={fmtNum(customerData.totalCustomers)} />
                <KPICard icon={<Repeat className="h-3.5 w-3.5 text-white" />} iconBg="from-violet-500 to-purple-600" label={t('marketing.customers.repeat')} value={fmtNum(customerData.repeatCustomers)} sub={`${fmtPct(customerData.repeatRate)} ${t('marketing.customers.repeatRate')}`} positive={customerData.repeatRate > 15} />
                <KPICard icon={<DollarSign className="h-3.5 w-3.5 text-white" />} iconBg="from-emerald-500 to-green-600" label={t('marketing.customers.aov')} value={fmtCurrency(customerData.averageOrderValue)} />
                <KPICard icon={<ShoppingCart className="h-3.5 w-3.5 text-white" />} iconBg="from-amber-500 to-orange-600" label={t('marketing.customers.avgOrders')} value={customerData.averageOrdersPerCustomer.toFixed(1)} />
                <KPICard icon={<Target className="h-3.5 w-3.5 text-white" />} iconBg="from-rose-500 to-pink-600" label={t('marketing.customers.conversion')} value={fmtPct(customerData.conversionRate)} positive={customerData.conversionRate > 2} />
                <KPICard icon={<ShoppingCart className="h-3.5 w-3.5 text-white" />} iconBg="from-red-500 to-rose-600" label={t('marketing.customers.cartAbandonment')} value={fmtPct(customerData.cartAbandonmentRate)} positive={false} />
              </div>

              {/* New vs Returning + Device Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* New vs Returning */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                        <UserCheck className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.newVsReturning')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('marketing.customers.new')}</p>
                        <p className="text-xl font-extrabold mt-1">{fmtNum(customerData.newVsReturning.newCustomers)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtCurrency(customerData.newVsReturning.newRevenue)} {t('marketing.customers.revenue')}</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200/50 dark:border-violet-800/50 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">{t('marketing.customers.returning')}</p>
                        <p className="text-xl font-extrabold mt-1">{fmtNum(customerData.newVsReturning.returningCustomers)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtCurrency(customerData.newVsReturning.returningRevenue)} {t('marketing.customers.revenue')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Device Breakdown */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 shadow-sm">
                        <Smartphone className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.devices')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    {customerData.deviceBreakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">{t('marketing.customers.noDevices')}</p>
                    ) : (
                      <div className="space-y-2.5">
                        {customerData.deviceBreakdown.map(d => {
                          const DeviceIcon = d.device === 'mobile' ? Smartphone : d.device === 'tablet' ? Tablet : Monitor;
                          return (
                            <div key={d.device} className="flex items-center gap-3">
                              <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold capitalize">{d.device}</span>
                                  <span className="text-xs text-muted-foreground">{fmtNum(d.sessions)} ({fmtPct(d.share)})</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500"
                                    style={{ width: `${Math.min(d.share, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Gender Breakdown */}
              {!genderLoading && genderData && genderData.total > 0 && (
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 shadow-sm">
                        <Users className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.gender')}
                      <span className="ml-auto text-[10px] font-normal text-muted-foreground">{t('marketing.customers.gender.hint')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      {/* Donut Chart */}
                      <div className="flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: t('marketing.customers.gender.male'), value: genderData.male, color: '#3b82f6' },
                                { name: t('marketing.customers.gender.female'), value: genderData.female, color: '#ec4899' },
                                { name: t('marketing.customers.gender.unknown'), value: genderData.unknown, color: '#94a3b8' },
                              ].filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {[
                                { color: '#3b82f6' },
                                { color: '#ec4899' },
                                { color: '#94a3b8' },
                              ].map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)' }}
                              formatter={(value: number, name: string) => [`${value} (${genderData.total > 0 ? Math.round((value / genderData.total) * 100) : 0}%)`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="flex items-center gap-3 flex-wrap justify-center mt-1">
                          {[
                            { label: t('marketing.customers.gender.male'), count: genderData.male, pct: genderData.malePercent, color: 'bg-blue-500' },
                            { label: t('marketing.customers.gender.female'), count: genderData.female, pct: genderData.femalePercent, color: 'bg-pink-500' },
                            ...(genderData.unknown > 0 ? [{ label: t('marketing.customers.gender.unknown'), count: genderData.unknown, pct: genderData.unknownPercent, color: 'bg-slate-400' }] : []),
                          ].map(item => (
                            <div key={item.label} className="flex items-center gap-1.5">
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.color}`} />
                              <span className="text-xs font-semibold">{item.label}</span>
                              <span className="text-xs text-muted-foreground">{item.count} <span className="font-bold">({item.pct}%)</span></span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* By-Product Breakdown */}
                      {genderData.byProduct.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('marketing.customers.gender.byProduct')}</p>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {genderData.byProduct.map(p => {
                              const total = p.male + p.female + p.unknown;
                              const malePct = total > 0 ? Math.round((p.male / total) * 100) : 0;
                              const femalePct = total > 0 ? Math.round((p.female / total) * 100) : 0;
                              return (
                                <div key={p.productId} className="text-xs">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-semibold truncate max-w-[160px]">{p.productTitle}</span>
                                    <span className="text-muted-foreground shrink-0 ml-1">{total}</span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${malePct}%` }} title={`${t('marketing.customers.gender.male')}: ${malePct}%`} />
                                    <div className="h-full bg-pink-500 transition-all" style={{ width: `${femalePct}%` }} title={`${t('marketing.customers.gender.female')}: ${femalePct}%`} />
                                  </div>
                                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                    <span className="text-blue-500">♂ {malePct}%</span>
                                    <span className="text-pink-500">♀ {femalePct}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Orders Over Time Chart */}
              {customerData.ordersByDay.length > 0 && (
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
                        <TrendingUp className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.orderTrend')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={customerData.ordersByDay} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <RechartsTooltip
                          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(value: number, name: string) => [name === 'revenue' ? fmtCurrency(value) : fmtNum(value), name === 'revenue' ? t('marketing.customers.revenue') : t('marketing.customers.orderTrend')]}
                          labelFormatter={(d: string) => new Date(d).toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        />
                        <Area type="monotone" dataKey="orders" stroke="#818cf8" strokeWidth={2} fill="url(#ordersFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Wilaya Breakdown + Top Customers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Wilaya breakdown */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 shadow-sm">
                        <MapPin className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.geography')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    {customerData.wilayaBreakdown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <MapPin className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs text-muted-foreground">{t('marketing.customers.noGeo')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {customerData.wilayaBreakdown.slice(0, 15).map((w, i) => (
                          <div key={w.wilayaId} className="flex items-center gap-3 text-xs">
                            <span className="w-5 text-center font-bold text-muted-foreground">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold truncate">{w.wilayaName}</span>
                                <span className="text-muted-foreground shrink-0 ml-2">{fmtNum(w.orders)} {t('marketing.customers.orders')}</span>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-muted-foreground">{fmtNum(w.customers)} {t('marketing.customers.customers')}</span>
                                <span className="font-medium">{fmtCurrency(w.revenue)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Customers */}
                <Card className={surfaceCard}>
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 shadow-sm">
                        <Crown className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t('marketing.customers.topCustomers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-3">
                    {customerData.topCustomers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Crown className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs text-muted-foreground">{t('marketing.customers.noCustomers')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {customerData.topCustomers.map((c, i) => (
                          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${i < 3 ? 'bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30' : 'bg-slate-50/60 dark:bg-slate-800/20'}`}>
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold shrink-0 ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{c.orders} {t('marketing.customers.orders')} &middot; {t('marketing.customers.lastOrder')}: {new Date(c.lastOrder).toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'short', day: 'numeric' })}</p>
                            </div>
                            <span className="text-xs font-extrabold shrink-0">{fmtCurrency(c.totalSpent)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                      <Package className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.inputs.econTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.econDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {(!inputs?.products || inputs.products.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-3">
                        <Package className="h-5 w-5 text-blue-500" />
                      </div>
                      <p className="text-xs font-medium">{t('marketing.inputs.noProducts')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Add products to your store to start tracking economics.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs gap-1.5"
                          onClick={() => {
                            const products = inputs!.products;
                            const headers = [t('marketing.inputs.col.product'), t('marketing.inputs.col.sellPrice'), t('marketing.inputs.col.buyCost'), t('marketing.inputs.col.packaging'), t('marketing.inputs.col.handling'), t('marketing.inputs.col.shipping')];
                            const rows = products.map(p => [
                              `"${(p.title || '').replace(/"/g, '""')}"`,
                              p.price || 0,
                              p.buy_cost || 0,
                              p.packaging_cost || 0,
                              p.handling_cost || 0,
                              p.fallback_shipping_cost || 0,
                            ].join(','));
                            const bom = '\uFEFF';
                            const csv = bom + [headers.join(','), ...rows].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `product-costs-${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t('marketing.inputs.downloadCsv')}
                        </Button>
                      </div>
                      <div className="overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-lg">
                        <Table className="[&_th]:border [&_th]:border-slate-300 [&_th]:dark:border-slate-600 [&_td]:border [&_td]:border-slate-300 [&_td]:dark:border-slate-600 [&_tr]:border-b-0">
                        <TableHeader>
                          <TableRow className="text-xs uppercase tracking-wider bg-slate-100 dark:bg-slate-800/60">
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
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Ad Spend */}
              <Card className={surfaceCard}>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm">
                      <DollarSign className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.inputs.spendTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.spendDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {/* Add new entry */}
                  <div className={`${surfaceMuted} p-3 space-y-2`}>
                    <p className="text-xs font-bold">{t('marketing.inputs.addEntry')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.date')}</Label>
                        <Input type="date" className={inputClass} value={spendDraft.entryDate} onChange={e => setSpendDraft(d => ({ ...d, entryDate: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.product')}</Label>
                        <Select value={spendDraft.productId} onValueChange={v => setSpendDraft(d => ({ ...d, productId: v }))}>
                          <SelectTrigger className={inputClass}><SelectValue placeholder={t('marketing.inputs.allProducts')} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('marketing.inputs.allProducts')}</SelectItem>
                            {inputs?.products?.map((p: ProductEcon) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.platform')}</Label>
                        <Select value={spendDraft.platform} onValueChange={v => setSpendDraft(d => ({ ...d, platform: v }))}>
                          <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="snapchat">Snapchat</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
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
                        productId: spendDraft.productId !== 'all' ? parseInt(spendDraft.productId) : undefined,
                        campaignName: spendDraft.campaignName,
                        spend: parseFloat(spendDraft.spend) || 0,
                        impressions: parseInt(spendDraft.impressions) || undefined,
                        clicks: parseInt(spendDraft.clicks) || undefined,
                        notes: spendDraft.notes || undefined,
                      });
                      setSpendDraft({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', productId: 'all', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
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
                            <TableHead>{t('marketing.inputs.col.product')}</TableHead>
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
                              <TableCell className="text-xs truncate max-w-[120px]">{entry.product_title || t('marketing.inputs.allProducts')}</TableCell>
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
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-sm">
                      <Upload className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.inputs.backfillTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('marketing.inputs.backfillDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex items-center gap-3">
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
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-bold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-zinc-600 shadow-sm">
                      <Settings className="h-3.5 w-3.5 text-white" />
                    </span>
                    {t('marketing.settings.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('marketing.settings.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
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
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/55 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 p-4">
      {/* Subtle decorative gradient */}
      <div className={`absolute -top-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-br ${iconBg} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`} />
      <div className="relative">
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${iconBg}`}>
            {icon}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
        </div>
        <p className="text-xl md:text-2xl font-extrabold tracking-tight">{value}</p>
        {sub && (
          <p className={`text-[11px] mt-1 font-medium ${positive === true ? 'text-emerald-600 dark:text-emerald-400' : positive === false ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-900/40 dark:to-slate-800/40 backdrop-blur p-3">
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-extrabold mt-1 tracking-tight">{value}</p>
    </div>
  );
}
