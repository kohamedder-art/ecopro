import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Eye, Copy, ExternalLink, Edit, Trash2, 
  Star, Package, DollarSign, Image as ImageIcon, Settings,
  Link as LinkIcon, Check, Share2, Grid, List, Store as StoreIcon,
  Sparkles, Loader2, Layers, Palette, Hash, AlertTriangle,
  ChevronDown, X, Wand2, ShoppingBag, Ruler, Shirt, Footprints,
  Tag, Gift, Percent, Truck, Zap, Flame, TicketPercent
} from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TemplatesTab } from '@/components/TemplatesTab';
import { generateStoreUrl, storeNameToSlug } from '@/utils/storeUrl';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStoreProducts } from '@/hooks/useStoreProducts';
import { markOnboardingStepComplete } from '@/lib/onboarding';
import { formatPriceForInput } from '@/lib/formatPrice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StoreProduct {
  id: number;
  title: string;
  name?: string; // From inventory API
  description?: string;
  price: number;
  unit_price?: number; // From inventory API
  original_price?: number;
  images?: string[];
  category?: string;
  stock_quantity: number;
  status: 'active' | 'draft' | 'archived';
  is_featured: boolean;
  metadata?: {
    shipping?: {
      mode?: 'delivery_pricing' | 'flat' | 'free';
      flat_fee?: number | null;
    };
    notes?: string | null;
    [key: string]: any;
  };
  slug: string;
  views: number;
  created_at: string;
}

type ProductShippingMode = 'delivery_pricing' | 'flat' | 'free';

type StoreProductFormData = Partial<StoreProduct> & {
  shipping_mode?: ProductShippingMode;
  shipping_flat_fee?: number | null;
  notes?: string;
  video_url?: string;
};

const DEFAULT_PRODUCT_FORM: StoreProductFormData = {
  status: 'active',
  is_featured: false,
  stock_quantity: 1,
  shipping_mode: 'delivery_pricing',
  shipping_flat_fee: null,
  notes: '',
  video_url: '',
};

// ─── AI Helper Components (store owner only, never shown to customers) ───────

function AIGenerateDescription({
  title,
  category,
  onGenerate,
}: {
  title: string;
  category: string;
  onGenerate: (desc: string) => void;
}) {
  const { call, loading } = useAI('/api/ai/product/description');
  const handleClick = async () => {
    if (!title.trim()) return;
    const data = await call({ title, category });
    if (data?.description) onGenerate(data.description);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !title.trim()}
      className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
      title="Generate description with AI"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      AI Generate
    </button>
  );
}

function AISuggestTitles({
  currentTitle,
  category,
  onSelect,
}: {
  currentTitle: string;
  category: string;
  onSelect: (title: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const { call, loading } = useAI('/api/ai/product/title');

  const handleClick = async () => {
    if (!currentTitle.trim()) return;
    const data = await call({ currentTitle, category });
    if (data?.suggestions?.length) {
      setSuggestions(data.suggestions);
      setOpen(true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !currentTitle.trim()}
        className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
        title="Suggest better titles with AI"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        AI Suggest
      </button>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 w-[260px]">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 pb-1">Pick a title</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-right text-sm px-2 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-700 dark:text-slate-200 transition-colors"
            >
              {s}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="w-full text-xs text-slate-400 mt-1 hover:text-slate-600 text-center">Cancel</button>
        </div>
      )}
    </div>
  );
}

/** AI Vision — analyze uploaded product image to auto-fill title, description, category, price */
function AIVisionSuggest({
  imageUrl,
  onApply,
  locale = 'ar',
}: {
  imageUrl: string;
  locale?: string;
  onApply: (data: { title?: string; description?: string; category?: string; price?: number }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const handleAnalyze = async () => {
    if (!imageUrl || loading) return;
    setLoading(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const res = await fetch('/api/ai/vision/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ imageUrl, language: locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setOpen(true);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading || !imageUrl}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-fuchsia-500/20 border border-purple-200 dark:border-purple-800 disabled:opacity-40 transition-all"
        title="AI will analyze the image and suggest product details"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        AI Auto-Fill from Image
      </button>
      {open && result && (
        <div className="absolute left-0 top-full mt-2 z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 w-[320px]">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1">AI Suggestions</p>
          <div className="space-y-2 text-xs">
            {result.title && (
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <span className="text-slate-500 dark:text-slate-400">Title:</span>
                  <span className="ml-1 text-slate-800 dark:text-slate-200">{result.title}</span>
                </div>
              </div>
            )}
            {result.description && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Description:</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-3">{result.description}</p>
              </div>
            )}
            {result.category && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Category:</span>
                <span className="ml-1 text-slate-800 dark:text-slate-200">{result.category}</span>
              </div>
            )}
            {result.estimated_price_dzd && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Est. Price:</span>
                <span className="ml-1 font-semibold text-emerald-600">{result.estimated_price_dzd} DZD</span>
              </div>
            )}
            {result.quality_score !== undefined && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Image Quality:</span>
                <span className={`ml-1 font-semibold ${result.quality_score >= 7 ? 'text-green-600' : result.quality_score >= 4 ? 'text-amber-600' : 'text-red-600'}`}>
                  {result.quality_score}/10
                </span>
                {result.quality_issues?.length > 0 && (
                  <span className="ml-1 text-amber-500">({result.quality_issues.join(', ')})</span>
                )}
              </div>
            )}
            {result.brand_detected && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Brand:</span>
                <span className="ml-1 text-slate-800 dark:text-slate-200">{result.brand_detected}</span>
              </div>
            )}
            {result.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {result.tags.slice(0, 5).map((tag: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px]">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                onApply({
                  title: result.title || result.title_ar,
                  description: result.description || result.description_ar,
                  category: result.category,
                  price: result.estimated_price_dzd,
                });
                setOpen(false);
              }}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Apply All
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PROMO_PLATFORMS = [
  { id: 'facebook', emoji: '📘', medium: 'social', color: 'bg-[#1877F2]' },
  { id: 'instagram', emoji: '📸', medium: 'social', color: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]' },
  { id: 'tiktok', emoji: '🎵', medium: 'social', color: 'bg-[#010101]' },
  { id: 'youtube', emoji: '▶️', medium: 'video', color: 'bg-[#FF0000]' },
  { id: 'snapchat', emoji: '👻', medium: 'social', color: 'bg-[#FFFC00] text-black' },
  { id: 'whatsapp', emoji: '💬', medium: 'messaging', color: 'bg-[#25D366]' },
  { id: 'telegram', emoji: '✈️', medium: 'messaging', color: 'bg-[#0088cc]' },
  { id: 'other', emoji: '🔗', medium: 'referral', color: 'bg-gray-500' },
] as const;

function buildUtmLink(base: string, source: string, medium: string) {
  try {
    const url = new URL(base);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', medium);
    url.searchParams.set('utm_campaign', 'product_promo');
    return url.toString();
  } catch {
    return `${base}${base.includes('?') ? '&' : '?'}utm_source=${source}&utm_medium=${medium}&utm_campaign=product_promo`;
  }
}

export default function Store() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();
  // Products Management was duplicated with Overview; keep a single Store page.

  const { data: storeSettingsData } = useStoreSettings({
    onUnauthorized: () => navigate('/login'),
  });

  const { data: storeProductsData } = useStoreProducts({
    onUnauthorized: () => navigate('/login'),
  });

  const applyFilters = (
    list: StoreProduct[],
    q: string,
    status: string
  ): StoreProduct[] => {
    let out = Array.isArray(list) ? [...list] : [];
    const query = String(q || '').trim().toLowerCase();

    if (status && status !== 'all') {
      out = out.filter((p) => p.status === status);
    }
    if (query) {
      out = out.filter((p) => {
        const title = String(p.title || '').toLowerCase();
        const desc = String(p.description || '').toLowerCase();
        const slug = String(p.slug || '').toLowerCase();
        return title.includes(query) || desc.includes(query) || slug.includes(query);
      });
    }
    return out;
  };

  const getStorefrontPath = (settings: any) => {
    const slug = settings?.store_slug;
    if (slug) return `/store/${encodeURIComponent(slug)}`;
    const name = settings?.store_name;
    if (name) return generateStoreUrl(name, false);
    return '';
  };

  const getStorefrontFullUrl = (settings: any) => {
    const p = getStorefrontPath(settings);
    if (!p) return '';
    return `${window.location.origin}${p}`;
  };

  // Copy store link to clipboard
  // This must be above all JSX usage
  let storeSettingsRef: any = null;
  let setStoreLinkCopiedRef: any = null;
  const copyStoreLink = () => {
    const storeUrl = getStorefrontFullUrl(storeSettingsRef);
    if (!storeUrl) return;
    navigator.clipboard.writeText(storeUrl);
    setStoreLinkCopiedRef(true);
    setTimeout(() => setStoreLinkCopiedRef(false), 2000);
    markOnboardingStepComplete('store_link_copied');
  };

  // Fetch remaining store data on mount (settings/products come from cached hooks)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in PARALLEL for faster loading
        const [inventoryRes, statsRes] = await Promise.all([
          fetch('/api/client/stock', { credentials: 'include' }),
          fetch('/api/client/store/stats', { credentials: 'include' }),
        ]);
        
        // Process inventory
        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json();
          setInventoryProducts(inventoryData);
        }
        
        // Process stats
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStatsServer(statsData);
        }
      } catch (err) {
        console.error('Failed to fetch store data', err);
      }
    };
    fetchData();
  }, []);
  // Product action states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [creatingSampleProducts, setCreatingSampleProducts] = useState(false);

  type ProductVariantDraft = {
    id?: number;
    color?: string;
    size?: string;
    variant_name?: string;
    price?: number;
    stock_quantity: number;
    is_active?: boolean;
    sort_order?: number;
  };

  const [variantsDraft, setVariantsDraft] = useState<ProductVariantDraft[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [inventoryImageErrors, setInventoryImageErrors] = useState<Record<string, boolean>>({});

  type ProductOfferDraft = {
    id?: number;
    quantity: number;
    bundle_price: number;
    compare_price?: number;
    free_delivery: boolean;
    sort_order?: number;
    image_url?: string;
    label?: string;
  };

  const [offersDraft, setOffersDraft] = useState<ProductOfferDraft[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersDirty, setOffersDirty] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const loadProductOffers = async (productId: number) => {
    setLoadingOffers(true);
    try {
      const res = await fetch(`/api/client/store/products/${productId}/offers`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      const offers = Array.isArray(data?.offers) ? data.offers : [];
      setOffersDraft(offers.map((o: any, idx: number) => ({
        id: o.id,
        quantity: Number(o.quantity),
        bundle_price: Number(o.bundle_price),
        compare_price: o.compare_price == null ? undefined : Number(o.compare_price),
        free_delivery: Boolean(o.free_delivery),
        sort_order: o.sort_order == null ? idx : Number(o.sort_order),
        image_url: o.image_url || undefined,
        label: o.label || undefined,
        is_active: o.is_active !== false, // Default to true if not explicitly false
      })));
      setOffersLoaded(true);
      setOffersDirty(false);
    } catch {
      setOffersDraft([]);
      setOffersLoaded(true);
    } finally {
      setLoadingOffers(false);
    }
  };

  const saveProductOffers = async (productId: number) => {
    await fetch(`/api/client/store/products/${productId}/offers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offers: offersDraft.map((o, idx) => ({
          ...(o.id ? { id: o.id } : {}),
          quantity: Number(o.quantity),
          bundle_price: Number(o.bundle_price),
          compare_price: o.compare_price === undefined ? undefined : Number(o.compare_price),
          free_delivery: o.free_delivery,
          sort_order: o.sort_order == null ? idx : Number(o.sort_order),
          image_url: o.image_url || undefined,
          label: o.label || undefined,
          is_active: o.is_active !== false,
        })),
      }),
    });
  };

  const loadProductVariants = async (productId: number) => {
    setLoadingVariants(true);
    try {
      const res = await fetch(`/api/client/store/products/${productId}/variants`);
      if (!res.ok) throw new Error('Failed to load variants');
      const data = await res.json();
      const variants = Array.isArray(data?.variants) ? data.variants : [];
      setVariantsDraft(
        variants.map((v: any, idx: number) => ({
          id: v.id,
          color: v.color ?? '',
          size: v.size ?? '',
          variant_name: v.variant_name ?? '',
          price: v.price == null ? undefined : Number(v.price),
          stock_quantity: Number(v.stock_quantity ?? 0),
          is_active: v.is_active == null ? true : Boolean(v.is_active),
          sort_order: v.sort_order == null ? idx : Number(v.sort_order),
        }))
      );
      setVariantsLoaded(true);
      setVariantsDirty(false);
    } catch (e) {
      console.error('Failed to load variants', e);
      setVariantsDraft([]);
      setVariantsLoaded(true);
      setVariantsDirty(false);
    } finally {
      setLoadingVariants(false);
    }
  };

  const saveProductVariants = async (productId: number) => {
    const res = await fetch(`/api/client/store/products/${productId}/variants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variants: variantsDraft.map((v, idx) => ({
          ...(v.id ? { id: v.id } : {}),
          color: (v.color || '').trim() || undefined,
          size: (v.size || '').trim() || undefined,
          variant_name: (v.variant_name || '').trim() || undefined,
          price: v.price === undefined || v.price === null || Number.isNaN(Number(v.price)) ? undefined : Number(v.price),
          stock_quantity: Number(v.stock_quantity ?? 0),
          is_active: v.is_active ?? true,
          sort_order: v.sort_order == null ? idx : Number(v.sort_order),
        })),
      }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error?.error || 'Failed to save variants');
    }
  };

          // Product action handlers
          // Helper to reload products
          const reloadProducts = async () => {
            try {
              const productsRes = await fetch('/api/client/store/products');
              if (productsRes.ok) {
                const productsData = await productsRes.json();
                setProducts(productsData);
                setFilteredProducts(productsData);
              }
            } catch (err) {
              console.error('Failed to reload products', err);
            }
          };

          const createSampleProducts = async () => {
            try {
              setCreatingSampleProducts(true);
              const samples = [
                { title: t('store.sampleProduct1') || 'منتج تجريبي 1', price: 1200 },
                { title: t('store.sampleProduct2') || 'منتج تجريبي 2', price: 2500 },
                { title: t('store.sampleProduct3') || 'منتج تجريبي 3', price: 3900 },
              ];

              for (const s of samples) {
                const res = await fetch('/api/client/store/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: s.title,
                    description: t('store.sampleProductDesc') || 'هذا منتج تجريبي لمساعدتك على فهم شكل المتجر.',
                    price: s.price,
                    stock_quantity: 10,
                    status: 'draft',
                    is_featured: false,
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({} as any));
                  throw new Error(String((err as any)?.error || `Failed to create sample product (${res.status})`));
                }
              }

              await reloadProducts();
              markOnboardingStepComplete('product_created');
              toast({
                title: t('store.sampleProductsCreatedTitle') || 'Sample products created',
                description: t('store.sampleProductsCreatedDesc') || 'We added 3 draft products. Edit them or delete them anytime.',
              });
            } catch (e) {
              console.error('Failed to create sample products', e);
              toast({
                variant: 'destructive',
                title: t('store.sampleProductsFailedTitle') || 'Failed to create sample products',
                description: String((e as any)?.message || 'Please try again.'),
              });
            } finally {
              setCreatingSampleProducts(false);
            }
          };

          const handleCreateProduct = async () => {
            if (savingProduct) return; // Prevent duplicate submissions
            try {
              setSavingProduct(true);
              setProductFormSubmitAttempted(true);
              setProductFormServerError(null);
              if (!canSubmitProduct) {
                toast({
                  variant: 'destructive',
                  title: 'Missing required fields',
                  description: 'Please enter a product title and a valid price.',
                });
                return;
              }
              const baseMetadata = (formData.metadata && typeof formData.metadata === 'object') ? formData.metadata : {};
              const shippingMode = (formData.shipping_mode || 'delivery_pricing') as ProductShippingMode;
              const metadata = {
                ...baseMetadata,
                shipping: {
                  mode: shippingMode,
                  flat_fee: shippingMode === 'flat' ? Number(formData.shipping_flat_fee ?? 0) : null,
                },
                notes: (formData.notes || '').trim() || null,
                video_url: (formData.video_url || '').trim() || null,
              };
              const { shipping_mode, shipping_flat_fee, notes, video_url: _vu1, ...restFormData } = formData;
              const payload = { ...restFormData, metadata };

              const res = await fetch('/api/client/store/products', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
              });
              if (res.ok) {
                const created = await res.json().catch(() => null);
                const createdId = Number(created?.id);
                if (createdId && variantsDraft.length > 0) {
                  await saveProductVariants(createdId);
                }
                if (createdId && offersDraft.length > 0) {
                  await saveProductOffers(createdId);
                }
                // reload products
                await reloadProducts();
                setShowAddModal(false);
                setFormData({ ...DEFAULT_PRODUCT_FORM });
                setVariantsDraft([]);
                setVariantsLoaded(false);
                setVariantsDirty(false);
                setOffersDraft([]);
                setOffersLoaded(false);
                setOffersDirty(false);
                setProductFormSubmitAttempted(false);
                setProductFormServerError(null);
                toast({ title: 'Product created', description: 'Your product is now in your store.' });
                markOnboardingStepComplete('product_created');
              } else {
                const error = await res.json().catch(() => ({} as any));
                const msg = String((error as any)?.error || 'Failed to create product');
                setProductFormServerError(msg);
                toast({ variant: 'destructive', title: 'Create failed', description: msg });
              }
            } catch (error) {
              console.error('Create product error:', error);
              const msg = error instanceof Error ? error.message : 'Failed to create product';
              setProductFormServerError(msg);
              toast({ variant: 'destructive', title: 'Create failed', description: msg });
            } finally {
              setSavingProduct(false);
            }
          };
          const handleUpdateProduct = async () => {
            if (!selectedProduct) return;
            try {
              setProductFormSubmitAttempted(true);
              setProductFormServerError(null);
              if (!canSubmitProduct) {
                toast({
                  variant: 'destructive',
                  title: 'Missing required fields',
                  description: 'Please enter a product title and a valid price.',
                });
                return;
              }
              const baseMetadata = (formData.metadata && typeof formData.metadata === 'object') ? formData.metadata : {};
              const shippingMode = (formData.shipping_mode || 'delivery_pricing') as ProductShippingMode;
              const metadata = {
                ...baseMetadata,
                shipping: {
                  mode: shippingMode,
                  flat_fee: shippingMode === 'flat' ? Number(formData.shipping_flat_fee ?? 0) : null,
                },
                notes: (formData.notes || '').trim() || null,
                video_url: (formData.video_url || '').trim() || null,
              };
              const { shipping_mode, shipping_flat_fee, notes, video_url: _vu2, ...restFormData } = formData;
              const payload = { ...restFormData, metadata };

              const res = await fetch(`/api/client/store/products/${selectedProduct.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
              });
              if (res.ok) {
                if (variantsDirty) {
                  await saveProductVariants(Number(selectedProduct.id));
                }
                if (offersDirty) {
                  await saveProductOffers(Number(selectedProduct.id));
                }
                // reload products
                await reloadProducts();
                setShowEditModal(false);
                setSelectedProduct(null);
                setFormData({ ...DEFAULT_PRODUCT_FORM });
                setVariantsDraft([]);
                setVariantsLoaded(false);
                setVariantsDirty(false);
                setOffersDraft([]);
                setOffersLoaded(false);
                setOffersDirty(false);
                setProductFormSubmitAttempted(false);
                setProductFormServerError(null);
                toast({ title: t('store.toast.savedTitle'), description: t('store.toast.productUpdatedDesc') });
              } else {
                const error = await res.json().catch(() => ({} as any));
                const msg = String((error as any)?.error || 'Failed to update product');
                setProductFormServerError(msg);
                toast({ variant: 'destructive', title: 'Save failed', description: msg });
              }
            } catch (error) {
              console.error('Update product error:', error);
              const msg = error instanceof Error ? error.message : 'Failed to update product';
              setProductFormServerError(msg);
              toast({ variant: 'destructive', title: 'Save failed', description: msg });
            }
          };
          const handleDeleteProduct = async () => {
            if (!selectedProduct) return;
            try {
              const res = await fetch(`/api/client/store/products/${selectedProduct.id}`, {
                method: 'DELETE',
              });
              if (res.ok) {
                // reload products
                await reloadProducts();
                setShowDeleteDialog(false);
                setSelectedProduct(null);
                toast({ title: 'Deleted', description: 'Product removed.' });
              } else {
                const error = await res.json().catch(() => ({} as any));
                const msg = String((error as any)?.error || 'Failed to delete product');
                toast({ variant: 'destructive', title: 'Delete failed', description: msg });
              }
            } catch (error) {
              console.error('Delete product error:', error);
              const msg = error instanceof Error ? error.message : 'Failed to delete product';
              toast({ variant: 'destructive', title: 'Delete failed', description: msg });
            }
          };
          const handleGetShareLink = async (product: StoreProduct) => {
            try {
              const res = await fetch(`/api/client/store/products/${product.id}/share-link`);
              if (res.ok) {
                const data = await res.json();
                const link = `${window.location.origin}/store/${data.store_slug}/${data.slug}`;
                setShareLink(link);
                setSelectedProduct(product);
                setShowShareModal(true);
                setLinkCopied(false);
                setSelectedPlatform(null);
              }
            } catch (error) {
              console.error('Get share link error:', error);
            }
          };
  // Product form state
  const [formData, setFormData] = useState<StoreProductFormData>({
    ...DEFAULT_PRODUCT_FORM,
  });
  const [productFormSubmitAttempted, setProductFormSubmitAttempted] = useState(false);
  const [productFormServerError, setProductFormServerError] = useState<string | null>(null);
  const titleIsValid = String(formData.title || '').trim().length > 0;
  const priceValue = formData.price;
  const priceIsValid = Number(priceValue) > 0;
  const canSubmitProduct = titleIsValid && priceIsValid;
  const isActiveWithoutStock =
    (formData.status || 'active') === 'active' &&
    Number(formData.stock_quantity ?? 0) <= 0 &&
    variantsDraft.filter((v) => v.is_active ?? true).length === 0;
  // Product modal state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Product logic
  const [savingSettings, setSavingSettings] = useState(false);
  const [statsServer, setStatsServer] = useState<{total_products:number;active_products:number;draft_products:number;total_views:number;page_views?:number;total_product_views?:number}|null>(null);
  // Handler for saving store settings
  const saveStoreSettings = async () => {
          try {
            setSavingSettings(true);
            const res = await fetch('/api/client/store/settings', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
                body: JSON.stringify({
                  store_name: storeSettings.store_name || null,
                  // Prefer explicit owner_name/owner_email fields. These are per-client and scoped to your account.
                  owner_name: storeSettings.owner_name || storeSettings.seller_name || null,
                  owner_email: storeSettings.owner_email || storeSettings.seller_email || null,
                  // Keep seller_* for backward compatibility but server will scope updates to your account only
                  seller_name: storeSettings.seller_name || null,
                  seller_email: storeSettings.seller_email || null,
                  store_description: storeSettings.store_description || null,
                  store_logo: storeSettings.store_logo || null,
                  template: storeSettings.template || 'pro',
                  banner_url: storeSettings.banner_url || null,
                  // hero_main_url removed
                  hero_tile1_url: storeSettings.hero_tile1_url || null,
                  hero_tile2_url: storeSettings.hero_tile2_url || null,
                  currency_code: storeSettings.currency_code || 'DZD',
                  // Template customization settings
                  template_hero_heading: storeSettings.template_hero_heading || null,
                  template_hero_subtitle: storeSettings.template_hero_subtitle || null,
                  template_button_text: storeSettings.template_button_text || null,
                  template_accent_color: storeSettings.template_accent_color || null,
                }),
            });
            if (!res.ok) {
              // try to surface server error message
              const err = await res.json().catch(() => ({}));
              const errorMsg = err.details ? `${err.error}: ${err.details}` : (err.error || 'Save failed');
              throw new Error(errorMsg);
            }
            // Server may return the updated row; still re-fetch to ensure canonical persisted state
            const saved = await res.json().catch(() => null);
            try {
              const settingsRes = await fetch('/api/client/store/settings', {
              });
              if (settingsRes.ok) {
                const fresh = await settingsRes.json();
                setStoreSettings(fresh);
              } else if (saved) {
                setStoreSettings(saved);
              }
            } catch (e) {
              if (saved) setStoreSettings(saved);
            }
            // Invalidate react-query cache so Dashboard/OnboardingGuide sees updated state
            queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
            markOnboardingStepComplete('store_branding_saved');
            toast({ title: t('store.toast.savedTitle'), description: t('store.toast.settingsUpdatedDesc') });
          } catch (e) {
            console.error('Failed to save store settings', e);
            toast({
              variant: 'destructive',
              title: t('store.toast.saveFailedTitle'),
              description: String((e as any)?.message || t('store.toast.saveFailedDesc')),
            });
          } finally {
            setSavingSettings(false);
          }
        };
      // Product states
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<StoreProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeSettingsData) {
      setStoreSettings(storeSettingsData);
    }
  }, [storeSettingsData]);

  useEffect(() => {
    if (Array.isArray(storeProductsData)) {
      setProducts(storeProductsData);
    }
  }, [storeProductsData]);

  useEffect(() => {
    setFilteredProducts(applyFilters(products, searchQuery, statusFilter));
  }, [products, searchQuery, statusFilter]);

  useEffect(() => {
    // Consider the page "ready" once core settings/products are present; inventory/stats can load in background.
    if (storeSettingsData && Array.isArray(storeProductsData)) {
      setLoading(false);
    }
  }, [storeSettingsData, storeProductsData]);
  // Product modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [showSelectInventory, setShowSelectInventory] = useState(false);
  const [productFormSection, setProductFormSection] = useState<
    'product' | 'price' | 'variants' | 'offers' | 'status' | 'shipping' | 'images' | 'video' | 'notes'
  >('product');
  // Selected product
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  // Available products from shared inventory for private store
  const [inventoryProducts, setInventoryProducts] = useState<StoreProduct[]>([]);
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState<StoreProduct | null>(null);
  const [inventoryStockQuantity, setInventoryStockQuantity] = useState<number>(1);

  type StockVariant = {
    id: number;
    color?: string;
    size?: string;
    variant_name?: string;
    price?: number;
    stock_quantity: number;
    is_active?: boolean;
    sort_order?: number;
  };

  const [inventoryVariants, setInventoryVariants] = useState<StockVariant[]>([]);
  const [inventoryVariantsLoading, setInventoryVariantsLoading] = useState(false);
  const [selectedInventoryVariantIds, setSelectedInventoryVariantIds] = useState<number[]>([]);

  const loadInventoryVariants = async (stockId: number) => {
    setInventoryVariantsLoading(true);
    try {
      const res = await fetch(`/api/client/stock/${stockId}/variants`);
      if (!res.ok) throw new Error('Failed to load stock variants');
      const data = await res.json();
      const variants = Array.isArray(data?.variants) ? data.variants : [];
      setInventoryVariants(variants);
      const activeIds = variants
        .filter((v: any) => v && (v.is_active == null ? true : Boolean(v.is_active)))
        .map((v: any) => Number(v.id))
        .filter((n: any) => Number.isInteger(n) && n > 0);
      setSelectedInventoryVariantIds(activeIds);
    } catch (e) {
      console.error('Failed to load inventory variants', e);
      setInventoryVariants([]);
      setSelectedInventoryVariantIds([]);
    } finally {
      setInventoryVariantsLoading(false);
    }
  };
  // Modal and tab states
  const [showStoreSettingsModal, setShowStoreSettingsModal] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>({
    store_slug: '',
    store_name: '',
    seller_name: '',
    seller_email: '',
    store_description: '',
    store_logo: '',
    template: 'books',
    banner_url: '',
    // hero_main_url removed
    hero_tile1_url: '',
    hero_tile2_url: '',
    currency_code: 'DZD',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [storeLinkCopied, setStoreLinkCopied] = useState(false);
  // Set refs for copyStoreLink
  storeSettingsRef = storeSettings;
  setStoreLinkCopiedRef = setStoreLinkCopied;

  // Onboarding deep-links (from Dashboard checklist)
  useEffect(() => {
    const qs = new URLSearchParams(location.search || '');
    const hasOnboardingFlag = qs.get('onboarding') === '1';
    const openSettings = qs.get('openSettings') === '1';
    const tab = (qs.get('tab') || '').trim();
    const action = (qs.get('action') || '').trim();

    if (!hasOnboardingFlag && !openSettings && !tab && !action) return;

    if (openSettings || tab) {
      setShowStoreSettingsModal(true);
      markOnboardingStepComplete('store_settings_opened');
    }

    if (action === 'create-product' || action === 'add-product' || action === 'createProduct') {
      setSelectedProduct(null);
      setFormData({ ...DEFAULT_PRODUCT_FORM });
      setVariantsDraft([]);
      setVariantsLoaded(true);
      setVariantsDirty(false);
      setProductFormSubmitAttempted(false);
      setProductFormServerError(null);
      setShowAddModal(true);
    }

    // Remove query params after applying actions (prevents retrigger on refresh)
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Mark template step once user opens the settings/templates modal.
  useEffect(() => {
    if (showStoreSettingsModal) {
      markOnboardingStepComplete('templates_opened');
    }
  }, [showStoreSettingsModal]);
    // Handlers for uploads and removals
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        // Persist the uploaded logo immediately
        setStoreSettings((s: any) => ({ ...s, store_logo: data.url }));
        try {
          const saveRes = await fetch('/api/client/store/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ store_logo: data.url }),
          });
          if (saveRes.ok) {
            const updated = await saveRes.json();
            setStoreSettings(updated);
          }
        } catch (e) {
          console.error('Failed to persist uploaded logo', e);
        }
      } catch (error) {
        console.error('Failed to upload logo:', error);
        toast({
          variant: 'destructive',
          title: t('store.toast.uploadFailedTitle'),
          description: t('store.toast.uploadFailedDesc'),
        });
      } finally {
        setUploadingLogo(false);
      }
    };
    const removeLogo = async () => {
      // Optimistically remove locally
      setStoreSettings((s: any) => ({ ...s, store_logo: '' }));
      try {
        const res = await fetch('/api/client/store/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ store_logo: null }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Failed to persist removeLogo', err);
          toast({
            variant: 'destructive',
            title: t('store.toast.removeFailedTitle'),
            description: t('store.toast.removeFailedDesc'),
          });
          return;
        }
        const updated = await res.json();
        setStoreSettings(updated);
      } catch (error) {
        console.error('removeLogo error:', error);
        toast({
          variant: 'destructive',
          title: t('store.toast.removeFailedTitle'),
          description: t('store.toast.removeFailedDesc'),
        });
      }
    };
    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setUploadingBanner(true);
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        // Persist the uploaded banner immediately
        setStoreSettings((s: any) => ({ ...s, banner_url: data.url }));
        try {
          const saveRes = await fetch('/api/client/store/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ banner_url: data.url }),
          });
          if (saveRes.ok) {
            const updated = await saveRes.json();
            setStoreSettings(updated);
          }
        } catch (e) {
          console.error('Failed to persist uploaded banner', e);
        }
      } catch (error) {
        console.error('Failed to upload banner:', error);
        toast({
          variant: 'destructive',
          title: t('store.toast.uploadFailedTitle'),
          description: t('store.toast.uploadFailedDesc'),
        });
      } finally {
        setUploadingBanner(false);
      }
    };
    const removeBanner = async () => {
      setStoreSettings((s: any) => ({ ...s, banner_url: '' }));
      try {
        const res = await fetch('/api/client/store/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ banner_url: null }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Failed to persist removeBanner', err);
          toast({
            variant: 'destructive',
            title: t('store.toast.removeFailedTitle'),
            description: t('store.toast.removeFailedDesc'),
          });
          return;
        }
        const updated = await res.json();
        setStoreSettings(updated);
      } catch (error) {
        console.error('removeBanner error:', error);
        toast({
          variant: 'destructive',
          title: t('store.toast.removeFailedTitle'),
          description: t('store.toast.removeFailedDesc'),
        });
      }
    };
    const handleFieldUpload = async (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        // Persist the uploaded field immediately
        setStoreSettings((s: any) => ({ ...s, [field]: data.url }));
        try {
          const saveRes = await fetch('/api/client/store/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ [field]: data.url }),
          });
          if (saveRes.ok) {
            const updated = await saveRes.json();
            setStoreSettings(updated);
          }
        } catch (e) {
          console.error('Failed to persist uploaded field', e);
        }
      } catch (err) {
        console.error('Field upload error', err);
        toast({
          variant: 'destructive',
          title: t('store.toast.uploadFailedTitle'),
          description: t('store.toast.uploadFailedDesc'),
        });
      } finally {
        if (e && (e.target as HTMLInputElement)) (e.target as HTMLInputElement).value = '';
      }
    };
    const removeField = async (field: string) => {
      // Clear locally
      setStoreSettings((s: any) => ({ ...s, [field]: '' }));
      try {
        const body: any = {};
        body[field] = null;
        const res = await fetch('/api/client/store/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Failed to persist removeField', err);
          toast({
            variant: 'destructive',
            title: t('store.toast.removeFailedTitle'),
            description: t('store.toast.removeFailedDesc'),
          });
          return;
        }
        const updated = await res.json();
        setStoreSettings(updated);
      } catch (error) {
        console.error('removeField error:', error);
        toast({
          variant: 'destructive',
          title: t('store.toast.removeFailedTitle'),
          description: t('store.toast.removeFailedDesc'),
        });
      }
    };
    // store images handlers removed (not used)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_IMAGES = 10;
    const existing = Array.isArray(formData.images) ? formData.images : [];
    const remaining = Math.max(0, MAX_IMAGES - existing.length);

    if (remaining <= 0) {
      toast({
        variant: 'destructive',
        title: 'Max images reached',
        description: `You can upload up to ${MAX_IMAGES} images.`,
      });
      e.target.value = '';
      return;
    }

    const toUpload = files.slice(0, remaining);

    // Validate upfront (10MB max)
    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Upload failed', description: 'Each image must be less than 10MB.' });
        e.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Upload failed', description: 'Please select image files only.' });
        e.target.value = '';
        return;
      }
    }

    const uploadOne = async (file: File): Promise<string> => {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const responseText = await res.text();
      if (!res.ok) {
        try {
          const error = JSON.parse(responseText);
          throw new Error(error?.error || 'Upload failed');
        } catch {
          throw new Error(`Upload failed: ${res.statusText}`);
        }
      }

      if (!responseText) throw new Error('Upload succeeded but server returned empty response');
      const data = JSON.parse(responseText);
      const url = String((data as any)?.url || '').trim();
      if (!url) throw new Error('Upload succeeded but server returned invalid url');
      return url;
    };

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of toUpload) {
        const url = await uploadOne(file);
        uploadedUrls.push(url);
      }

      setFormData((prev) => {
        const base = Array.isArray(prev.images) ? prev.images : [];
        return { ...prev, images: [...base, ...uploadedUrls].slice(0, MAX_IMAGES) };
      });
      toast({
        title: 'Uploaded',
        description:
          uploadedUrls.length === 1
            ? 'Product image uploaded successfully.'
            : `${uploadedUrls.length} images uploaded successfully.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openEditModal = (product: StoreProduct) => {
    const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
    const shippingMeta = metadata?.shipping && typeof metadata.shipping === 'object' ? metadata.shipping : {};
    setSelectedProduct(product);
    setFormData({
      ...product,
      shipping_mode: (shippingMeta.mode as ProductShippingMode) || 'delivery_pricing',
      shipping_flat_fee: shippingMeta.flat_fee == null ? null : Number(shippingMeta.flat_fee),
      notes: typeof metadata.notes === 'string' ? metadata.notes : '',
      video_url: typeof metadata.video_url === 'string' ? metadata.video_url : '',
    });
    setShowEditModal(true);
    setVariantsDraft([]);
    setVariantsLoaded(false);
    setVariantsDirty(false);
    loadProductVariants(Number(product.id));
    setOffersDraft([]);
    setOffersLoaded(false);
    setOffersDirty(false);
    loadProductOffers(Number(product.id));
  };

  const openDeleteDialog = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowDeleteDialog(true);
  };

  const stats = statsServer ? {
    total: statsServer.total_products,
    active: statsServer.active_products,
    draft: statsServer.draft_products,
    // Storefront (store) views
    totalViews: (statsServer.page_views ?? statsServer.total_views ?? 0) as number,
  } : {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    draft: products.filter(p => p.status === 'draft').length,
    totalViews: 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 md:p-4 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {t('store.privateStore')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              {t('store.manageExclusive')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                const url = getStorefrontPath(storeSettings);
                if (url) {
                  window.open(url, '_blank');
                }
              }}
              disabled={!getStorefrontPath(storeSettings)}
              className="h-9 px-2 md:px-3 text-xs md:text-sm"
            >
              <StoreIcon className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('store.viewStorefront')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/template-editor')}
              className="h-9 px-2 md:px-3 text-xs md:text-sm"
            >
              <Settings className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('store.templateEditor')}</span>
            </Button>
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setFormData({ ...DEFAULT_PRODUCT_FORM });
                setVariantsDraft([]);
                setVariantsLoaded(true);
                setVariantsDirty(false);
                setProductFormSubmitAttempted(false);
                setProductFormServerError(null);
                setShowAddModal(true);
              }}
              className="bg-gradient-to-r from-primary to-purple-600 h-9 px-2 md:px-3 text-xs md:text-sm"
            >
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden sm:inline">{t('store.createProduct')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSelectInventory(true);
                setSelectedInventoryProduct(null);
                setInventoryStockQuantity(1);
              }}
              className="h-9 px-2 md:px-3 text-xs md:text-sm"
            >
              <Package className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('store.selectFromInventory')}</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-2 md:p-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm opacity-90">{t('store.totalProducts')}</p>
                <p className="text-lg md:text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <Package className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-2 md:p-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm opacity-90">{t('store.active')}</p>
                <p className="text-lg md:text-2xl font-bold mt-1">{stats.active}</p>
              </div>
              <Check className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-2 md:p-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm opacity-90">{t('store.drafts')}</p>
                <p className="text-lg md:text-2xl font-bold mt-1">{stats.draft}</p>
              </div>
              <Edit className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-2 md:p-3 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm opacity-90">{t('store.totalViews')}</p>
                <p className="text-lg md:text-2xl font-bold mt-1">{stats.totalViews}</p>
              </div>
              <Eye className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
            </div>
          </div>
        </div>

        {/* Store Overview */}
            {/* Store Preview: Store URL, compact badges, and How-to guide (hidden here; rendered at bottom) */}
            {false && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Your Store URL</Label>
                <p className="text-xs text-muted-foreground">Share this with customers to browse your storefront</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = getStorefrontPath(storeSettings);
                    if (url) {
                      window.open(url, '_blank');
                    }
                  }}
                  disabled={!getStorefrontPath(storeSettings)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Store
                </Button>
              </div>
            </div>

            <div className="mt-3 flex gap-2 items-center">
              <Input
                value={getStorefrontFullUrl(storeSettings)}
                readOnly
                className="font-mono text-sm flex-1"
              />
              <Button onClick={copyStoreLink} variant="outline" disabled={!getStorefrontPath(storeSettings)}>
                {storeLinkCopied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 flex gap-3">
              <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">Share Your Store</div>
                <p className="text-blue-700 dark:text-blue-300">Share this link so customers can browse all your products in one place. Use social channels, WhatsApp, or direct messages.</p>
              </div>
            </div>
          </div>

          {/** summary panel moved down below filters */}
        </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl border p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('store.searchProducts')}
                  value={searchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchQuery(next);
                    setFilteredProducts(applyFilters(products, next, statusFilter));
                  }}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setFilteredProducts(applyFilters(products, searchQuery, v));
              }}
            >
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder={t('store.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('store.allStatus')}</SelectItem>
                <SelectItem value="active">{t('store.active')}</SelectItem>
                <SelectItem value="draft">{t('store.drafts')}</SelectItem>
                <SelectItem value="archived">{t('store.archived')}</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Products Grid/List */}
        {/* Store Summary will render at bottom of page */}
        {filteredProducts.length === 0 ? (
          <div className="bg-card rounded-xl border p-4 md:p-4 text-center">
            <Package className="w-10 md:w-14 h-10 md:h-14 mx-auto text-muted-foreground opacity-20 mb-2" />
            <h3 className="text-base md:text-lg font-semibold mb-2">{t('store.noProductsYet')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('store.createFirstProduct')}
            </p>

            <div className="mx-auto mb-4 max-w-xl rounded-lg border bg-muted/30 p-3 text-left">
              <div className="text-sm font-medium">
                {t('onboarding.subtitle') || 'Complete these steps to launch your store'}
              </div>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>• {t('onboarding.addProducts') || 'Add Your Products'}</li>
                <li>• {t('onboarding.chooseTemplate') || 'Choose a Template'}</li>
                <li>• {t('onboarding.shareStore') || 'Share Your Store'}</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => {
                  setSelectedProduct(null);
                  setFormData({ ...DEFAULT_PRODUCT_FORM });
                  setVariantsDraft([]);
                  setVariantsLoaded(true);
                  setVariantsDirty(false);
                  setProductFormSubmitAttempted(false);
                  setProductFormServerError(null);
                  setShowAddModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('store.createProduct')}
              </Button>

              <Button
                variant="secondary"
                disabled={creatingSampleProducts}
                onClick={() => {
                  void createSampleProducts();
                }}
              >
                {creatingSampleProducts ? (t('store.creatingSampleProducts') || 'Creating samples...') : (t('store.addSampleProducts') || 'Add sample products')}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setShowStoreSettingsModal(true);
                  markOnboardingStepComplete('store_settings_opened');
                }}
              >
                <Settings className="w-4 h-4 mr-2" />
                {t('onboarding.chooseTemplate') || 'Choose a Template'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  const url = getStorefrontFullUrl(storeSettings);
                  if (url) {
                    navigator.clipboard.writeText(url);
                    toast({ title: 'URL Copied!', description: 'Store URL copied to clipboard' });
                  }
                }}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                {t('store.copyLink') || 'Copy Link'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setShowSelectInventory(true);
                  setSelectedInventoryProduct(null);
                  setInventoryStockQuantity(1);
                }}
              >
                <Package className="w-4 h-4 mr-2" />
                {t('store.selectFromInventory')}
              </Button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-card rounded-lg border overflow-hidden hover:shadow-lg transition-all"
              >
                {/* Image */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0.5 bg-background/70 backdrop-blur border border-border/60 text-foreground"
                      title={t('store.views')}
                    >
                      <Eye className="w-2.5 h-2.5 mr-0.5 text-foreground" />
                      {product.views ?? 0}
                    </Badge>
                    {product.is_featured && (
                      <Badge className="bg-yellow-500 text-[10px] px-1.5 py-0.5">
                        <Star className="w-2.5 h-2.5 mr-0.5" />
                        Featured
                      </Badge>
                    )}
                  </div>
                  <Badge className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5" variant={
                    product.status === 'active' ? 'default' :
                    product.status === 'draft' ? 'secondary' : 'outline'
                  }>
                    {product.status === 'active' ? t('store.active') : 
                     product.status === 'draft' ? t('store.drafts') : 
                     t('store.archived')}
                  </Badge>
                  {/* Hover action tray */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                    <button onClick={() => handleGetShareLink(product)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur text-white hover:bg-white/30 transition-colors"><Share2 className="w-3 h-3" /></button>
                    <button onClick={() => openEditModal(product)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/80 backdrop-blur text-white hover:bg-primary transition-colors"><Edit className="w-3 h-3" /></button>
                    <button onClick={() => openDeleteDialog(product)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/80 backdrop-blur text-white hover:bg-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>

                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">
                      {Math.round(Number(product.price) || 0)} دج
                    </span>
                    {product.original_price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {Math.round(Number(product.original_price) || 0)} دج
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border divide-y">
            {filteredProducts.map((product) => (
              <div key={product.id} className="group p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground opacity-20" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{product.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {product.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          product.status === 'active' ? 'default' :
                          product.status === 'draft' ? 'secondary' : 'outline'
                        }>
                          {product.status}
                        </Badge>
                        {product.is_featured && (
                          <Badge className="bg-yellow-500">
                            <Star className="w-3 h-3" />
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-lg font-bold text-primary">
                        {Math.round(Number(product.price) || 0)} دج
                      </span>
                      <Badge variant="outline" className="text-xs text-foreground">
                        <Eye className="w-3 h-3 mr-1 text-foreground" />
                        {product.views} views
                      </Badge>
                      <Badge variant="outline" className="text-xs text-foreground">
                        Stock: {product.stock_quantity}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGetShareLink(product)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDeleteDialog(product)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Select Product from Inventory Modal */}
      <Dialog open={showSelectInventory} onOpenChange={(open) => {
        if (!open) {
          setShowSelectInventory(false);
          setSelectedInventoryProduct(null);
          setInventoryStockQuantity(1);
          setInventoryVariants([]);
          setSelectedInventoryVariantIds([]);
        }
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product from Stock</DialogTitle>
            <DialogDescription className="text-sm">
              Select an existing product from your inventory to add to your store
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {inventoryProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                <p className="text-muted-foreground">No products in your inventory yet</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/stock')}>
                  Go to Stock Management
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
                  {inventoryProducts.map((product: any) => {
                    const imageUrl = product.images?.[0] 
                      ? (product.images[0].startsWith('http') ? product.images[0] : product.images[0])
                      : null;
                    const stockQty = product.quantity ?? product.stock_quantity ?? 0;
                    const price = product.unit_price ?? product.price ?? 0;
                    const name = product.name || product.title || 'Unnamed Product';
                    
                    const imageKey = `inventory:${product.id}`;
                    const imageErrored = !!inventoryImageErrors[imageKey];

                    return (
                      <div
                        key={product.id}
                        onClick={async () => {
                          setSelectedInventoryProduct(product);
                          setInventoryStockQuantity(1);
                          setInventoryVariants([]);
                          setSelectedInventoryVariantIds([]);
                          await loadInventoryVariants(Number(product.id));
                        }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                          selectedInventoryProduct?.id === product.id
                            ? 'border-primary bg-primary/10 shadow'
                            : 'border-border/50 hover:border-primary/50 bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {imageUrl && !imageErrored ? (
                            <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                              <img
                                src={imageUrl}
                                alt={name}
                                className="w-full h-full object-cover"
                                onError={() =>
                                  setInventoryImageErrors((prev) => ({
                                    ...prev,
                                    [imageKey]: true,
                                  }))
                                }
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted/50 flex items-center justify-center text-xl">
                              📦
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {Number(price) > 0 && (
                                <span className="font-semibold text-primary text-sm">{Math.round(Number(price))} DA</span>
                              )}
                              <Badge variant={stockQty > 0 ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0">
                                {stockQty > 0 ? `${stockQty} in stock` : 'Out of stock'}
                              </Badge>
                            </div>
                          </div>
                          {selectedInventoryProduct?.id === product.id && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedInventoryProduct && (
                  <div className="space-y-3 border-t pt-3 bg-muted/30 rounded-lg p-3 -mx-1">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {(selectedInventoryProduct as any).images?.[0] ? (
                          <img src={(selectedInventoryProduct as any).images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-base">📦</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{(selectedInventoryProduct as any).name || (selectedInventoryProduct as any).title}</p>
                        <p className="text-xs text-muted-foreground">Selected</p>
                      </div>
                    </div>
                    {inventoryVariantsLoading ? (
                      <div className="text-xs text-muted-foreground">Loading variants…</div>
                    ) : inventoryVariants.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs">Choose Variants to Include</Label>
                        <div className="max-h-40 overflow-y-auto rounded border bg-background/60">
                          {inventoryVariants
                            .slice()
                            .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                            .map((v: any) => {
                              const id = Number(v.id);
                              const label = String(v.variant_name || '').trim() || [v.color, v.size].filter(Boolean).join(' / ') || 'Variant';
                              const checked = selectedInventoryVariantIds.includes(id);
                              return (
                                <label key={id} className="flex items-center justify-between gap-2 px-2 py-1.5 border-b last:border-b-0 cursor-pointer">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked;
                                        setSelectedInventoryVariantIds((prev) => {
                                          if (next) return Array.from(new Set([...prev, id]));
                                          return prev.filter((x) => x !== id);
                                        });
                                      }}
                                    />
                                    <span className="text-sm truncate">{label}</span>
                                    {(v.is_active === false) && (
                                      <Badge variant="outline" className="text-[10px]">Off</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {Number(v.stock_quantity ?? 0)}
                                    </Badge>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Selected stock: {inventoryVariants
                            .filter((v: any) => selectedInventoryVariantIds.includes(Number(v.id)))
                            .reduce((sum: number, v: any) => sum + Number(v.stock_quantity ?? 0), 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Quantity to Add</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => setInventoryStockQuantity(Math.max(1, inventoryStockQuantity - 1))}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={(selectedInventoryProduct as any).quantity ?? (selectedInventoryProduct as any).stock_quantity ?? 999}
                            value={inventoryStockQuantity}
                            onChange={(e) => setInventoryStockQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 h-8 text-center text-sm font-semibold"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => {
                              const maxQty = (selectedInventoryProduct as any).quantity ?? (selectedInventoryProduct as any).stock_quantity ?? 999;
                              setInventoryStockQuantity(Math.min(maxQty, inventoryStockQuantity + 1));
                            }}
                          >
                            +
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            / {(selectedInventoryProduct as any).quantity ?? (selectedInventoryProduct as any).stock_quantity ?? 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectInventory(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedInventoryProduct) return;
                const inv = selectedInventoryProduct as any;
                try {
                  const shouldImportVariants = inventoryVariants.length > 0 && selectedInventoryVariantIds.length > 0;
                  const res = await fetch('/api/client/store/products', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      title: inv.name || inv.title,
                      description: inv.description,
                      price: inv.unit_price || inv.price,
                      original_price: inv.original_price,
                      images: inv.images,
                      category: inv.category,
                      ...(shouldImportVariants
                        ? {
                            source_stock_id: inv.id,
                            stock_variant_ids: selectedInventoryVariantIds,
                          }
                        : {}),
                      metadata: {
                        shipping: {
                          mode: inv.shipping_mode || 'delivery_pricing',
                          flat_fee: inv.shipping_flat_fee ?? null,
                        },
                      },
                      stock_quantity: shouldImportVariants ? 0 : inventoryStockQuantity,
                      status: 'active',
                      is_featured: false
                    })
                  });
                  if (res.ok) {
                    setShowSelectInventory(false);
                    setSelectedInventoryProduct(null);
                    setInventoryStockQuantity(1);
                    setInventoryVariants([]);
                    setSelectedInventoryVariantIds([]);
                    // Reload products
                    const productsRes = await fetch('/api/client/store/products', {
                    });
                    if (productsRes.ok) {
                      const productsData = await productsRes.json();
                      setProducts(productsData);
                      setFilteredProducts(productsData);
                    }
                  } else {
                    const error = await res.json();
                    toast({
                      variant: 'destructive',
                      title: t('store.toast.addProductFailedTitle'),
                      description: error?.error || t('store.toast.addProductFailedDesc'),
                    });
                  }
                } catch (error) {
                  console.error('Add product error:', error);
                  toast({
                    variant: 'destructive',
                    title: t('store.toast.addProductFailedTitle'),
                    description: t('store.toast.addProductFailedDesc'),
                  });
                }
              }}
              disabled={!selectedInventoryProduct || (inventoryVariants.length > 0 && selectedInventoryVariantIds.length === 0)}
            >
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setShowEditModal(false);
          setSavingProduct(false);
          setFormData({ ...DEFAULT_PRODUCT_FORM });
          setSelectedProduct(null);
          setProductFormSection('product');
          setVariantsDraft([]);
          setVariantsLoaded(false);
          setVariantsDirty(false);
          setProductFormSubmitAttempted(false);
          setProductFormServerError(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 dark:from-slate-950 dark:to-slate-900/30 p-3 md:p-4">
          <DialogHeader className="space-y-1 pb-2 md:pb-3 border-b border-border/50">
            <DialogTitle className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {showAddModal ? t('store.createProduct') : t('store.updateProduct')}
            </DialogTitle>
            <DialogDescription className="text-base font-semibold">
              {showAddModal ? t('store.createFirstProduct') : t('store.updateProduct')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 md:gap-3 py-2 md:py-3">
            {productFormServerError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {productFormServerError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'product', label: t('store.productForm.sections.product') },
                  { key: 'price', label: t('store.productForm.sections.price') },
                  { key: 'variants', label: t('store.productForm.sections.variants') },
                  { key: 'offers', label: t('store.productForm.offersTitle') },
                  { key: 'status', label: t('store.productForm.sections.status') },
                  { key: 'shipping', label: t('store.productForm.sections.shipping') },
                  { key: 'images', label: t('store.productForm.sections.images') },
                  { key: 'video', label: '🎬 فيديو' },
                  { key: 'notes', label: t('store.productForm.sections.notes') },
                ] as const
              ).map((sec) => (
                <Button
                  key={sec.key}
                  type="button"
                  variant={productFormSection === sec.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProductFormSection(sec.key)}
                  className={productFormSection === sec.key ? 'bg-gradient-to-r from-primary to-purple-600 text-white' : 'border-primary/30 hover:bg-primary/10'}
                >
                  {sec.label}
                </Button>
              ))}
            </div>

            {productFormSection === 'product' && (
              <div className="space-y-2 bg-primary/5 dark:bg-slate-800/30 p-2 md:p-3 rounded border border-primary/20">
                <h3 className="text-lg font-bold text-primary">{t('store.productForm.basicInfo')}</h3>

                {(formData.images?.length || 0) > 0 && (
                  <AIVisionSuggest
                    imageUrl={formData.images![0]}
                    locale={locale}
                    onApply={(data) => setFormData(prev => ({
                      ...prev,
                      ...(data.title ? { title: data.title } : {}),
                      ...(data.description ? { description: data.description } : {}),
                      ...(data.category ? { category: data.category } : {}),
                      ...(data.price ? { price: data.price } : {}),
                    }))}
                  />
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="title" className="text-base font-bold">{t('store.productForm.title')} *</Label>
                    <AISuggestTitles
                      currentTitle={formData.title || ''}
                      category={formData.category || ''}
                      onSelect={(title) => setFormData({ ...formData, title })}
                    />
                  </div>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('store.productForm.titlePlaceholder')}
                    className="border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                  />
                  {productFormSubmitAttempted && !titleIsValid && (
                    <p className="text-xs text-destructive">{t('store.productForm.titleRequired')}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description" className="text-base font-bold">{t('store.productForm.description')}</Label>
                    <AIGenerateDescription
                      title={formData.title || ''}
                      category={formData.category || ''}
                      onGenerate={(desc) => setFormData({ ...formData, description: desc })}
                    />
                  </div>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('store.productForm.descriptionPlaceholder')}
                    rows={3}
                    className="border-primary/30 focus:border-primary/60 transition-colors resize-none text-base"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="category" className="text-base font-bold">{t('store.productForm.category')}</Label>
                  <Input
                    id="category"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={t('store.productForm.categoryPlaceholder')}
                    className="border-primary/30 focus:border-primary/60 transition-colors h-9 text-base"
                  />
                </div>
              </div>
            )}

            {productFormSection === 'price' && (
              <div className="space-y-2 bg-emerald-500/5 dark:bg-emerald-900/10 p-2 md:p-3 rounded border border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{t('store.productForm.pricingStock')}</h3>

                {isActiveWithoutStock && (
                  <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                    {t('store.productForm.activeNoStockWarning')}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="price" className="text-base font-bold">{t('store.productForm.price')} *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formatPriceForInput(formData.price)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? undefined : Number(raw);
                        const next = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
                        setFormData({ ...formData, price: next });
                      }}
                      placeholder="0"
                      className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                    />
                    {productFormSubmitAttempted && !priceIsValid && (
                      <p className="text-xs text-destructive">{t('store.productForm.priceRequired')}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="original_price" className="text-base font-bold">{t('store.productForm.originalPrice')}</Label>
                    <Input
                      id="original_price"
                      type="number"
                      step="0.01"
                      value={formatPriceForInput(formData.original_price)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? undefined : Number(raw);
                        setFormData({ ...formData, original_price: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined });
                      }}
                      placeholder="0"
                      className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="stock_quantity" className="text-base font-bold">{t('store.productForm.stockQuantity')}</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    value={formData.stock_quantity ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parsed = raw === '' ? undefined : Number(raw);
                      setFormData({ ...formData, stock_quantity: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined });
                    }}
                    min="0"
                    className="border-emerald-500/30 focus:border-emerald-500/60 transition-colors h-9 text-base"
                  />
                  <p className="text-xs text-muted-foreground">{t('store.productForm.stockHint')}</p>
                </div>
              </div>
            )}

            {productFormSection === 'variants' && (() => {
              const COLORS = [
                { name: 'أحمر', tw: 'bg-red-500', ring: 'ring-red-400' },
                { name: 'أزرق', tw: 'bg-blue-500', ring: 'ring-blue-400' },
                { name: 'أسود', tw: 'bg-slate-900', ring: 'ring-slate-700' },
                { name: 'أبيض', tw: 'bg-white border border-slate-300', ring: 'ring-slate-300' },
                { name: 'أخضر', tw: 'bg-emerald-500', ring: 'ring-emerald-400' },
                { name: 'أصفر', tw: 'bg-yellow-400', ring: 'ring-yellow-300' },
                { name: 'رمادي', tw: 'bg-gray-400', ring: 'ring-gray-300' },
                { name: 'بني', tw: 'bg-amber-700', ring: 'ring-amber-600' },
                { name: 'برتقالي', tw: 'bg-orange-500', ring: 'ring-orange-400' },
                { name: 'وردي', tw: 'bg-pink-400', ring: 'ring-pink-300' },
                { name: 'بنفسجي', tw: 'bg-purple-500', ring: 'ring-purple-400' },
                { name: 'كحلي', tw: 'bg-blue-900', ring: 'ring-blue-800' },
                { name: 'بيج', tw: 'bg-amber-100 border border-amber-300', ring: 'ring-amber-200' },
              ];
              const CLOTHING = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
              const SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

              // Derive selected colors & sizes from existing draft
              const existingColors = [...new Set(variantsDraft.map(v => (v.color || '').trim()).filter(Boolean))];
              const existingSizes = [...new Set(variantsDraft.map(v => (v.size || '').trim()).filter(Boolean))];

              // Helper: generate all combos from selected colors × sizes
              const generateCombos = (colors: string[], sizes: string[]) => {
                const newVariants: typeof variantsDraft = [];
                const existingKeys = new Set(variantsDraft.map(v => `${(v.color||'').trim()}|${(v.size||'').trim()}`));
                for (const c of colors) {
                  for (const s of sizes) {
                    if (!existingKeys.has(`${c}|${s}`)) {
                      newVariants.push({
                        color: c,
                        size: s,
                        variant_name: '',
                        stock_quantity: 0,
                        is_active: true,
                        sort_order: variantsDraft.length + newVariants.length,
                      });
                    }
                  }
                }
                return newVariants;
              };

              // Toggle color: add/remove all variants of that color
              const toggleColor = (colorName: string) => {
                const has = existingColors.includes(colorName);
                if (has) {
                  // Remove all variants with this color
                  setVariantsDraft(prev => prev.filter(v => (v.color || '').trim() !== colorName));
                } else {
                  // Add variants for this color × all existing sizes
                  const sizesToUse = existingSizes.length > 0 ? existingSizes : [''];
                  const newOnes = generateCombos([colorName], sizesToUse);
                  if (newOnes.length > 0) {
                    setVariantsDraft(prev => [...prev, ...newOnes]);
                  } else {
                    // No sizes yet, add one empty
                    setVariantsDraft(prev => [...prev, {
                      color: colorName, size: '', variant_name: '', stock_quantity: 0, is_active: true, sort_order: prev.length,
                    }]);
                  }
                }
                setVariantsDirty(true);
                setVariantsLoaded(true);
              };

              // Toggle size: add/remove all variants of that size
              const toggleSize = (sizeName: string) => {
                const has = existingSizes.includes(sizeName);
                if (has) {
                  setVariantsDraft(prev => prev.filter(v => (v.size || '').trim() !== sizeName));
                } else {
                  const colorsToUse = existingColors.length > 0 ? existingColors : [''];
                  const newOnes = generateCombos(colorsToUse, [sizeName]);
                  if (newOnes.length > 0) {
                    setVariantsDraft(prev => [...prev, ...newOnes]);
                  } else {
                    setVariantsDraft(prev => [...prev, {
                      color: '', size: sizeName, variant_name: '', stock_quantity: 0, is_active: true, sort_order: prev.length,
                    }]);
                  }
                }
                setVariantsDirty(true);
                setVariantsLoaded(true);
              };

              // Group variants by color for the table view
              const colorGroups: { [color: string]: (typeof variantsDraft[0] & { originalIndex: number })[] } = {};
              variantsDraft.forEach((v, idx) => {
                const color = (v.color || '').trim() || '—';
                if (!colorGroups[color]) colorGroups[color] = [];
                colorGroups[color].push({ ...v, originalIndex: idx });
              });

              return (
              <div className="space-y-4">
                {/* ─── HEADER ─── */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Layers className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('store.productForm.variantsTitle')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('store.productForm.variantsDesc')}</p>
                  </div>
                </div>

                {loadingVariants && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  </div>
                )}

                {!loadingVariants && (
                <>
                {/* ═══ STEP 1: Pick Colors ═══ */}
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <Palette className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">① اختر الألوان المتوفرة</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">اضغط على كل لون متوفر لديك</span>
                    </div>
                    {existingColors.length > 0 && (
                      <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                        {existingColors.length} لون
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2.5">
                      {COLORS.map((c) => {
                        const selected = existingColors.includes(c.name);
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => toggleColor(c.name)}
                            className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                              selected
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/10'
                                : 'bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full ${c.tw} flex-shrink-0 ${selected ? `ring-2 ${c.ring} ring-offset-2` : ''}`} />
                            <span className="text-slate-700 dark:text-slate-200">{c.name}</span>
                            {selected && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {/* Custom color */}
                      <div className="flex items-center gap-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5">
                        <Plus className="h-4 w-4 text-slate-400" />
                        <Input
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !existingColors.includes(val)) {
                                toggleColor(val);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          placeholder="لون آخر + Enter"
                          className="h-7 w-24 border-0 p-0 text-sm bg-transparent focus-visible:ring-0 shadow-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ STEP 2: Pick Sizes ═══ */}
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                      <Ruler className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">② اختر المقاسات المتوفرة</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">اضغط على كل مقاس متوفر لديك</span>
                    </div>
                    {existingSizes.length > 0 && (
                      <span className="text-xs font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 px-2.5 py-1 rounded-full">
                        {existingSizes.length} مقاس
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Clothing */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shirt className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ملابس</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CLOTHING.map((s) => {
                          const selected = existingSizes.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSize(s)}
                              className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                selected
                                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25 scale-105'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Shoes */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Footprints className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">أحذية</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SHOES.map((s) => {
                          const selected = existingSizes.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSize(s)}
                              className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                                selected
                                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25 scale-105'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Custom size */}
                    <div className="flex items-center gap-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 w-fit">
                      <Plus className="h-4 w-4 text-slate-400" />
                      <Input
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && !existingSizes.includes(val)) {
                              toggleSize(val);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        placeholder="مقاس آخر + Enter"
                        className="h-7 w-28 border-0 p-0 text-sm bg-transparent focus-visible:ring-0 shadow-none"
                      />
                    </div>
                  </div>
                </div>

                {/* ═══ STEP 3: Generated Variants Table ═══ */}
                {variantsDraft.length > 0 && (
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Package className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">③ المخزون لكل نوع</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">أدخل الكمية المتوفرة لكل نوع</span>
                    </div>
                    <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                      {variantsDraft.length} نوع
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {Object.entries(colorGroups).map(([color, variants]) => (
                      <div key={color}>
                        {/* Color group header */}
                        {color !== '—' && (
                          <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-2">
                            {(() => {
                              const colorDef = COLORS.find(c => c.name === color);
                              return colorDef ? (
                                <span className={`w-4 h-4 rounded-full ${colorDef.tw}`} />
                              ) : (
                                <Palette className="h-4 w-4 text-slate-400" />
                              );
                            })()}
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{color}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                              {variants.length}
                            </span>
                          </div>
                        )}
                        {/* Individual variants */}
                        {variants.map((v) => (
                          <div key={v.originalIndex} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                            {/* Size badge */}
                            <span className={`min-w-[42px] text-center px-2 py-1 rounded-lg text-xs font-bold ${
                              v.size ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}>
                              {v.size || '—'}
                            </span>

                            {/* Stock input */}
                            <div className="flex items-center gap-1.5 flex-1">
                              <span className="text-xs text-slate-400">الكمية:</span>
                              <Input
                                type="number"
                                min={0}
                                value={v.stock_quantity ?? ''}
                                onChange={(e) => {
                                  const next = Number(e.target.value || 0);
                                  const idx = v.originalIndex;
                                  setVariantsDraft(prev =>
                                    prev.map((row, i) => (i === idx ? { ...row, stock_quantity: next } : row))
                                  );
                                  setVariantsDirty(true);
                                }}
                                className="h-8 w-20 text-sm text-center"
                                placeholder="0"
                              />
                            </div>

                            {/* Price (optional) */}
                            <div className="hidden sm:flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formatPriceForInput(v.price)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const next = raw === '' ? undefined : Number(raw);
                                  const idx = v.originalIndex;
                                  setVariantsDraft(prev =>
                                    prev.map((row, i) => (i === idx ? { ...row, price: next } : row))
                                  );
                                  setVariantsDirty(true);
                                }}
                                placeholder="السعر"
                                className="h-8 w-20 text-sm text-center"
                              />
                              <span className="text-[10px] text-slate-400">دج</span>
                            </div>

                            {/* Toggle + Delete */}
                            <div className="flex items-center gap-2">
                              <span dir="ltr">
                                <Switch
                                  checked={v.is_active ?? true}
                                  onCheckedChange={(checked) => {
                                    const idx = v.originalIndex;
                                    setVariantsDraft(prev =>
                                      prev.map((row, i) => (i === idx ? { ...row, is_active: checked } : row))
                                    );
                                    setVariantsDirty(true);
                                  }}
                                />
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const idx = v.originalIndex;
                                  setVariantsDraft(prev => prev.filter((_, i) => i !== idx));
                                  setVariantsDirty(true);
                                  setVariantsLoaded(true);
                                }}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Bulk add button */}
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVariantsDraft((prev) => [
                          ...prev,
                          { color: '', size: '', variant_name: '', stock_quantity: 0, is_active: true, sort_order: prev.length },
                        ]);
                        setVariantsDirty(true);
                        setVariantsLoaded(true);
                      }}
                      className="w-full border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      إضافة نوع يدوي
                    </Button>
                  </div>
                </div>
                )}

                {/* Empty state */}
                {variantsLoaded && variantsDraft.length === 0 && (
                  <div className="text-center py-6 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 flex items-center justify-center mx-auto mb-3">
                      <ShoppingBag className="h-7 w-7 text-indigo-400 dark:text-indigo-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">ابدأ بإضافة الأنواع</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                      اختر الألوان والمقاسات من الأعلى وسيتم إنشاء جميع الأنواع تلقائياً
                    </p>
                  </div>
                )}
                </>
                )}
              </div>
              );
            })()}

            {productFormSection === 'offers' && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <TicketPercent className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('store.productForm.offersTitle')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('store.productForm.offersDesc')}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOffersDraft((prev) => [
                        ...prev,
                        {
                          quantity: prev.length + 2,
                          bundle_price: (Number(formData.price) ?? 0) * (prev.length + 2),
                          free_delivery: false,
                          sort_order: prev.length,
                        },
                      ]);
                      setOffersDirty(true);
                      setOffersLoaded(true);
                    }}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md shadow-orange-500/20"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('store.productForm.addOffer')}
                  </Button>
                </div>

                {loadingOffers && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  </div>
                )}

                {!loadingOffers && offersLoaded && offersDraft.length === 0 && (
                  <div className="text-center py-8 bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center mx-auto mb-3">
                      <Gift className="h-7 w-7 text-orange-400 dark:text-orange-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">لا يوجد عروض بعد</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                      أنشئ عروض خاصة مثل: اشترِ 2 بسعر 2700 دج بدل 3000 دج
                    </p>
                  </div>
                )}

                {!loadingOffers && offersDraft.length > 0 && (
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {offersDraft.map((o, idx) => {
                      const unitPrice = Number(formData.price) ?? 0;
                      const totalRegular = unitPrice * Number(o.quantity);
                      const bundlePrice = Number(o.bundle_price) ?? 0;
                      const savings = totalRegular > bundlePrice ? totalRegular - bundlePrice : 0;
                      const discountPercent = totalRegular > 0 ? Math.round((savings / totalRegular) * 100) : 0;

                      return (
                      <div key={o.id ?? idx} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center gap-3">
                          {/* Offer image thumbnail */}
                          <label className="flex-shrink-0 cursor-pointer group">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const fd = new FormData();
                                  fd.append('image', file);
                                  const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                  if (!res.ok) throw new Error('Upload failed');
                                  const data = await res.json();
                                  setOffersDraft((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, image_url: data.url } : row))
                                  );
                                  setOffersDirty(true);
                                } catch { /* silent */ }
                              }}
                            />
                            {o.image_url ? (
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                                <img src={o.image_url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <Edit className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-orange-400 transition-colors">
                                <ImageIcon className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-orange-400 transition-colors" />
                              </div>
                            )}
                          </label>

                          {/* Number badge */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                            idx === 0 ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                            idx === 1 ? 'bg-gradient-to-br from-violet-500 to-purple-600' :
                            'bg-gradient-to-br from-emerald-500 to-teal-600'
                          }`}>
                            {idx + 1}
                          </div>

                          {/* Single editable offer text input */}
                          <div className="flex-1">
                            <Input
                              type="text"
                              value={o.label || ''}
                              onChange={(e) => {
                                setOffersDraft((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, label: e.target.value || undefined } : row))
                                );
                                setOffersDirty(true);
                              }}
                              placeholder={`${o.quantity} منتج 💚${o.free_delivery ? ' + توصيل مجاني ✅' : ''}`}
                              className="h-8 text-sm font-bold"
                              dir="auto"
                            />
                          </div>

                          {/* Compare Price */}
                          <div className="hidden sm:flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={formatPriceForInput(o.compare_price)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const next = raw === '' ? undefined : Number(raw);
                                setOffersDraft((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, compare_price: next } : row))
                                );
                                setOffersDirty(true);
                              }}
                              placeholder="—"
                              className="h-8 w-24 text-center text-sm text-slate-400 line-through"
                            />
                          </div>

                          {/* Free delivery chip */}
                          <button
                            type="button"
                            onClick={() => {
                              setOffersDraft((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, free_delivery: !row.free_delivery } : row))
                              );
                              setOffersDirty(true);
                            }}
                            className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                              o.free_delivery
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 border border-transparent hover:border-slate-300'
                            }`}
                          >
                            <Truck className="h-3 w-3" />
                            {o.free_delivery ? '✓' : 'مجاني'}
                          </button>

                          {/* Discount badge */}
                          {discountPercent > 0 && (
                            <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                              -{discountPercent}%
                            </span>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              setOffersDraft((prev) => prev.filter((_, i) => i !== idx));
                              setOffersDirty(true);
                              setOffersLoaded(true);
                            }}
                            className="flex-shrink-0 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {productFormSection === 'status' && (
              <div className="space-y-2 bg-amber-500/5 dark:bg-amber-900/10 p-2 md:p-3 rounded border border-amber-500/20">
                <h3 className="text-lg font-bold text-amber-700 dark:text-amber-300">{t('store.productForm.statusTitle')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="status" className="text-base font-bold">{t('store.productForm.status')}</Label>
                    <Select
                      value={formData.status || 'active'}
                      onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('store.productForm.statusActive')}</SelectItem>
                        <SelectItem value="draft">{t('store.productForm.statusDraft')}</SelectItem>
                        <SelectItem value="archived">{t('store.productForm.statusArchived')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-base font-bold">{t('store.productForm.featured')}</Label>
                    <div className="flex items-center space-x-2 h-9">
                      <input
                        type="checkbox"
                        id="is_featured"
                        checked={formData.is_featured || false}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is_featured" className="text-sm">
                        {t('store.productForm.featuredHint')}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {productFormSection === 'shipping' && (
              <div className="space-y-2 bg-indigo-500/5 dark:bg-indigo-900/10 p-2 md:p-3 rounded border border-indigo-500/20">
                <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{t('store.productForm.shippingTitle')}</h3>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-base font-bold">{t('store.productForm.shippingMode')}</Label>
                    <Select
                      value={(formData.shipping_mode as ProductShippingMode) || 'delivery_pricing'}
                      onValueChange={(value: ProductShippingMode) =>
                        setFormData((prev) => ({
                          ...prev,
                          shipping_mode: value,
                          shipping_flat_fee: value === 'flat' ? (prev.shipping_flat_fee ?? 0) : null,
                        }))
                      }
                    >
                      <SelectTrigger className="border-indigo-500/30 focus:border-indigo-500/60 h-9 text-base font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery_pricing">{t('store.productForm.shippingMode.delivery_pricing')}</SelectItem>
                        <SelectItem value="flat">{t('store.productForm.shippingMode.flat')}</SelectItem>
                        <SelectItem value="free">{t('store.productForm.shippingMode.free')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {((formData.shipping_mode as ProductShippingMode) || 'delivery_pricing') === 'flat' && (
                    <div className="space-y-1">
                      <Label className="text-base font-bold">{t('store.productForm.shippingFlatFee')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.shipping_flat_fee ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === '' ? undefined : Number(raw);
                          setFormData((prev) => ({
                            ...prev,
                            shipping_flat_fee: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined,
                          }))
                        }}
                        className="border-indigo-500/30 focus:border-indigo-500/60 h-9 text-base"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {productFormSection === 'images' && (
              <div className="space-y-2 bg-sky-500/5 dark:bg-sky-900/10 p-2 md:p-3 rounded border border-sky-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-sky-700 dark:text-sky-300">{t('store.productForm.imagesTitle')}</h3>
                  {(formData.images?.length || 0) > 0 && (
                    <AIVisionSuggest
                      imageUrl={formData.images![0]}
                      locale={locale}
                      onApply={(data) => setFormData(prev => ({
                        ...prev,
                        ...(data.title ? { title: data.title } : {}),
                        ...(data.description ? { description: data.description } : {}),
                        ...(data.category ? { category: data.category } : {}),
                        ...(data.price ? { price: data.price } : {}),
                      }))}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {(formData.images?.length || 0) > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {(formData.images || []).slice(0, 10).map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative w-full h-28 border rounded-lg overflow-hidden">
                          <img
                            src={url}
                            alt="Product"
                            className="w-full h-full object-cover"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-1 right-1 h-7 px-2"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                images: (prev.images || []).filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            {t('store.productForm.removeImage')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        disabled={uploading || ((formData.images?.length || 0) >= 10)}
                        className="cursor-pointer"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading || ((formData.images?.length || 0) >= 10)}
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        {uploading ? t('store.productForm.uploading') : t('store.productForm.upload')}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t('store.productForm.imageUrlHint')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Upload up to 10 images. Each image must be &lt; 10MB.
                    </p>
                    <Input
                      id="images"
                      value={formData.images?.[0] || ''}
                      onChange={(e) =>
                        setFormData((prev) => {
                          const nextFirst = e.target.value;
                          const rest = Array.isArray(prev.images) ? prev.images.slice(1) : [];
                          const next = nextFirst ? [nextFirst, ...rest] : rest;
                          return { ...prev, images: next };
                        })
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </div>
            )}

            {productFormSection === 'video' && (
              <div className="space-y-3 bg-rose-500/5 dark:bg-rose-900/10 p-2 md:p-3 rounded border border-rose-500/20">
                <div>
                  <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">🎬 فيديو المنتج</h3>
                  <p className="text-sm text-muted-foreground">الفيديو يظهر أولاً في معرض الصور — العميل يرى الفيديو ثم يتنقل للصور</p>
                </div>
                {/* Upload video file directly */}
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer text-sm transition-colors ${uploadingVideo ? 'opacity-50 pointer-events-none' : 'hover:bg-rose-500/10 border-rose-400/40'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    {uploadingVideo ? 'جارٍ الرفع...' : 'رفع فيديو من جهازك (mp4)'}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      className="hidden"
                      disabled={uploadingVideo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('video/')) {
                          toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار ملف فيديو (mp4, webm...)' });
                          return;
                        }
                        if (file.size > 100 * 1024 * 1024) {
                          toast({ variant: 'destructive', title: 'الملف كبير جداً', description: 'الحد الأقصى لحجم الفيديو هو 100MB' });
                          e.target.value = '';
                          return;
                        }
                        setUploadingVideo(true);
                        try {
                          const fd = new FormData();
                          fd.append('image', file);
                          const res = await fetch('/api/upload', { method: 'POST', body: fd });
                          if (!res.ok) throw new Error('فشل الرفع');
                          const data = await res.json();
                          setFormData((prev) => ({ ...prev, video_url: data.url }));
                          toast({ title: 'تم رفع الفيديو ✓' });
                        } catch {
                          toast({ variant: 'destructive', title: 'فشل رفع الفيديو', description: 'حاول مرة أخرى' });
                        } finally {
                          setUploadingVideo(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">أو الصق رابطاً أدناه</span>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="video_url" className="text-base font-bold">رابط الفيديو</Label>
                  <input
                    id="video_url"
                    type="url"
                    dir="ltr"
                    value={formData.video_url || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, video_url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=... أو رابط mp4"
                    className={`w-full px-3 py-2 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-rose-500/40 ${/tiktok\.com|instagram\.com/i.test(formData.video_url || '') ? 'border-destructive' : 'border-input'}`}
                  />
                  <p className="text-xs text-muted-foreground">يدعم: YouTube، Vimeo، أو رابط مباشر لملف mp4/webm</p>
                </div>
                {/* TikTok / Instagram blocked warning */}
                {/tiktok\.com|instagram\.com/i.test(formData.video_url || '') && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 space-y-1">
                    <p className="text-sm font-bold text-destructive">⛔ TikTok و Instagram لا يسمحان بتضمين الفيديو في المتاجر</p>
                    <p className="text-xs text-muted-foreground">الحلول المتاحة:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                      <li>حمّل الفيديو من TikTok ثم ارفعه على متجرك كملف <strong>mp4</strong></li>
                      <li>انشر الفيديو على <strong>YouTube</strong> والصق رابطه هنا</li>
                    </ul>
                  </div>
                )}
                {/* Preview — only if not blocked */}
                {formData.video_url && !/tiktok\.com|instagram\.com/i.test(formData.video_url) && (
                  <div className="rounded-lg overflow-hidden border" style={{ aspectRatio: '16/9' }}>
                    {/youtube\.com|youtu\.be/.test(formData.video_url) ? (
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${formData.video_url.match(/(?:watch\?v=|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?mute=1`}
                        allowFullScreen
                      />
                    ) : /\.(mp4|webm|ogg)/i.test(formData.video_url) || /cloudinary\.com\/.*\/video\/upload\//i.test(formData.video_url) ? (
                      <video className="w-full h-full object-cover" src={formData.video_url} controls muted autoPlay loop />
                    ) : (
                      <iframe className="w-full h-full" src={formData.video_url} allowFullScreen />
                    )}
                  </div>
                )}
              </div>
            )}

            {productFormSection === 'notes' && (
              <div className="space-y-2 bg-slate-500/5 dark:bg-slate-900/10 p-2 md:p-3 rounded border border-slate-500/20">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{t('store.productForm.notesTitle')}</h3>
                <div className="space-y-1">
                  <Label htmlFor="product_notes" className="text-base font-bold">{t('store.productForm.notesLabel')}</Label>
                  <Textarea
                    id="product_notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('store.productForm.notesPlaceholder')}
                    rows={4}
                    className="border-slate-500/30 focus:border-slate-500/60 transition-colors resize-none text-base"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              setFormData({ ...DEFAULT_PRODUCT_FORM });
              setProductFormSection('product');
              setVariantsDraft([]);
              setVariantsLoaded(false);
              setVariantsDirty(false);
              setProductFormSubmitAttempted(false);
              setProductFormServerError(null);
            }}>
              {t('cancel')}
            </Button>
            <Button
              onClick={showAddModal ? handleCreateProduct : handleUpdateProduct}
              disabled={!canSubmitProduct || savingProduct}
            >
              {savingProduct ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
              ) : showAddModal ? (
                t('store.createProduct')
              ) : (
                t('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Link Modal — Platform Picker with UTM */}
      <Dialog open={showShareModal} onOpenChange={(open) => {
        setShowShareModal(open);
        if (!open) setSelectedPlatform(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('store.shareProduct')}</DialogTitle>
            <DialogDescription>
              {t('store.shareModal.choosePlatform')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Platform grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROMO_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setLinkCopied(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    selectedPlatform === p.id
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                      : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${p.color}`}>
                    {p.emoji}
                  </span>
                  <span className="text-xs font-medium">{t(`store.shareModal.platform.${p.id}`)}</span>
                </button>
              ))}
            </div>

            {/* Generated UTM link */}
            {selectedPlatform && (() => {
              const platform = PROMO_PLATFORMS.find((p) => p.id === selectedPlatform)!;
              const utmLink = buildUtmLink(shareLink, platform.id, platform.medium);
              return (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <Label className="text-sm font-medium">
                    {t('store.shareModal.yourLink')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={utmLink}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(utmLink);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                    >
                      {linkCopied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {linkCopied && (
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      {t('store.linkCopied')}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* UTM tracking tip */}
            <div className="bg-muted rounded-lg p-3 space-y-1.5">
              <p className="text-sm font-medium">{t('store.shareModal.tipTitle')}</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t('store.shareModal.tip.utmExplain')}</li>
                <li>{t('store.shareModal.tip.track')}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              {t('store.shareModal.close')}
            </Button>
            {selectedPlatform && (
              <Button onClick={() => {
                const platform = PROMO_PLATFORMS.find((p) => p.id === selectedPlatform)!;
                window.open(buildUtmLink(shareLink, platform.id, platform.medium), '_blank');
              }}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('store.shareModal.openLink')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('store.deleteProduct')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('store.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-red-600 hover:bg-red-700">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Store Summary (moved here) */}
      <div className="max-w-7xl mx-auto mt-4 md:mt-6">
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">{t('store.storeSummary')}</Label>
          </div>
        

          <div>
            <Label className="text-sm font-semibold">{t('store.howToUse')}</Label>
            <ol className="mt-2 text-sm space-y-1.5">
              <li className="flex gap-1.5 items-start"><div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div><div><span className="font-medium">{t('store.howToUse.step1.title')}</span><div className="text-muted-foreground">{t('store.howToUse.step1.desc')}</div></div></li>
              <li className="flex gap-1.5 items-start"><div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</div><div><span className="font-medium">{t('store.howToUse.step2.title')}</span><div className="text-muted-foreground">{t('store.howToUse.step2.desc')}</div></div></li>
              <li className="flex gap-1.5 items-start"><div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</div><div><span className="font-medium">{t('store.howToUse.step3.title')}</span><div className="text-muted-foreground">{t('store.howToUse.step3.desc')}</div></div></li>
              <li className="flex gap-1.5 items-start"><div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">4</div><div><span className="font-medium">{t('store.howToUse.step4.title')}</span><div className="text-muted-foreground">{t('store.howToUse.step4.desc')}</div></div></li>
            </ol>
          </div>
        </div>
      </div>

      {/* Store Settings Modal — Template Chooser Only */}
      <Dialog
        open={showStoreSettingsModal}
        onOpenChange={(open) => {
          setShowStoreSettingsModal(open);
          if (open) markOnboardingStepComplete('store_settings_opened');
        }}
      >
        <DialogContent className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-2xl font-bold">{t('store.settingsModal.tabs.templates')}</DialogTitle>
            <DialogDescription className="text-base">
              {t('templates.chooseTemplateDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <TemplatesTab 
              storeSettings={storeSettings}
              setStoreSettings={setStoreSettings}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStoreSettingsModal(false)}>
              Close
            </Button>
            <Button onClick={saveStoreSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
