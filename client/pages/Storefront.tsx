import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Grid, List
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';
import { RenderStorefront } from './storefront/templates';
import UniversalStyleInjector from '@/components/storefront/UniversalStyleInjector';
import PixelScripts, { trackAllPixels, PixelEvents, setStoreCurrency } from '@/components/storefront/PixelScripts';
import StorefrontChatBubble from '@/components/storefront/StorefrontChatBubble';
import { setWindowTemplateSettings } from '@/lib/templateWindow';
import { formatMoney } from '@/utils/money';
import { STOREFRONT_SETTINGS_KEY, STOREFRONT_TEMPLATE_KEY } from '@/lib/storefrontStorage';
import { getResolvedStoreSlug, buildStoreUrl, isSubdomainStore } from '@/lib/resolvedStore';

interface StoreProduct {
  id: number;
  title: string;
  description?: string;
  price: number;
  original_price?: number;
  images?: string[];
  category?: string;
  stock_quantity: number;
  is_featured: boolean;
  slug: string;
  views: number;
}

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_logo?: string;
  primary_color?: string;
  secondary_color?: string;
  template?: string;
  banner_url?: string;
  currency_code?: string;
}

export default function Storefront() {
  const { t } = useTranslation();
  // Support both new (:storeSlug) and legacy (:clientId) route params
  const params = useParams();
  const storeSlug = (params as any).storeSlug || (params as any).clientId || getResolvedStoreSlug() || '';
  const initialProductSlug = (params as any).productSlug;
  const navigate = useNavigate();
  const location = useLocation();
  const trackedViewRef = useRef<string | null>(null);
  
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<StoreProduct[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    template: 'books',
    primary_color: '#16a34a',
    secondary_color: '#0ea5e9',
    currency_code: 'DZD',
    store_name: '',
    store_description: '',
    store_logo: '',
    banner_url: ''
  });
  const [categories, setCategories] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sorting option for templates that support sorting
  const [sortOption, setSortOption] = useState<'newest' | 'price-asc' | 'price-desc' | 'featured' | 'views-desc'>('newest');



  // Derived visual tokens from store settings
  const template = storeSettings.template || 'books';
  const primaryColor = storeSettings.primary_color || '#16a34a';
  const secondaryColor = storeSettings.secondary_color || '#0ea5e9';
  const bannerUrl = storeSettings.banner_url || '';

  // Price formatter based on store currency (DZD has no cents)
  const formatPrice = (n: number) => formatMoney(n, storeSettings.currency_code || 'DZD');

  // Recompute filtered products when query/category/sort changes
  useEffect(() => {
    let next = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      next = next.filter(p => (
        p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      ));
    }
    // Categories are intentionally not used for storefront UX.
    switch (sortOption) {
      case 'price-asc':
        next.sort((a,b) => Number(a.price) - Number(b.price));
        break;
      case 'price-desc':
        next.sort((a,b) => Number(b.price) - Number(a.price));
        break;
      case 'featured':
        next.sort((a,b) => Number(b.is_featured) - Number(a.is_featured));
        break;
      case 'views-desc':
        next.sort((a,b) => Number(b.views) - Number(a.views));
        break;
      case 'newest':
      default:
        // Assume server returns newest first; keep order
        break;
    }
    setFilteredProducts(next);
  }, [products, searchQuery, categoryFilter, sortOption]);

  // Fetch store settings and products by slug (with timeout guard)
  useEffect(() => {
    // Clear any corrupted localStorage on mount
    try {
      const stored = localStorage.getItem(STOREFRONT_SETTINGS_KEY) || localStorage.getItem('storeSettings');
      if (stored && stored.length > 500000) {
        // Data too large, clear it
        localStorage.removeItem(STOREFRONT_SETTINGS_KEY);
        // legacy
        localStorage.removeItem('storeSettings');
      }
    } catch {
      localStorage.removeItem(STOREFRONT_SETTINGS_KEY);
      // legacy
      localStorage.removeItem('storeSettings');
    }
    
    let isMounted = true;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const fetchWithTimeout = async (
      url: string,
      timeoutMs: number,
      options?: RequestInit,
      retries = 1
    ): Promise<Response> => {
      let lastErr: any;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { ...options, signal: controller.signal });
          return res;
        } catch (err: any) {
          const isAbort = err?.name === 'AbortError';
          lastErr = isAbort ? new Error('Request timed out') : err;

          // Retry only on abort/timeouts and generic network failures
          const msg = String(err?.message || '').toLowerCase();
          const isNetwork = msg.includes('failed to fetch') || msg.includes('network');
          if (attempt < retries && (isAbort || isNetwork)) {
            await sleep(250 * (attempt + 1));
            continue;
          }
          throw lastErr;
        } finally {
          window.clearTimeout(timer);
        }
      }
      throw lastErr;
    };

    async function fetchAll() {
      if (!storeSlug) {
        if (isMounted) {
          setError('Missing store slug');
          setLoading(false);
        }
        return;
      }

      // Use server-injected data if available — skip both API calls and loading state
      const injectedSettings = (window as any).__STORE_SETTINGS;
      const injectedProducts = (window as any).__STORE_PRODUCTS;
      const hasInjected = injectedSettings && String(injectedSettings.store_slug) === storeSlug;
      const hasProducts = Array.isArray(injectedProducts) && injectedProducts.length > 0;

      if (hasInjected && hasProducts) {
        setStoreSettings(injectedSettings);
        setProducts(injectedProducts.map((p: any) => ({ ...p, category: undefined })));
        setCategories([]);
        setLoading(false);
        (window as any).__STORE_SETTINGS = null;
        (window as any).__STORE_PRODUCTS = null;
        return;
      }

      try {
        setLoading(true);
        setError('');

        if (hasInjected) {
          setStoreSettings(injectedSettings);
          (window as any).__STORE_SETTINGS = null;
        }

        if (hasProducts) {
          (window as any).__STORE_PRODUCTS = null;
        }

        const slug = String(storeSlug);
        const encodedSlug = encodeURIComponent(slug);

        let settingsData: any = null;
        let productsData: any = null;

        if (hasInjected) {
          settingsData = { settings: injectedSettings };
        } else if (hasProducts) {
          settingsData = await fetchWithTimeout(`/api/storefront/${encodedSlug}/settings`, 25000, { cache: 'no-store' }, 1).then(async r => {
            if (!r.ok) {
              if (r.status === 404) throw new Error(t('storefront.notAvailable'));
              const body = await r.text().catch(() => '');
              throw new Error(body || 'Failed to load store');
            }
            return r.json();
          });
          productsData = injectedProducts;
        } else {
          const [sRes, pRes] = await Promise.all([
            fetchWithTimeout(`/api/storefront/${encodedSlug}/settings`, 25000, { cache: 'no-store' }, 1),
            fetchWithTimeout(`/api/storefront/${encodedSlug}/products`, 35000, { cache: 'no-store' }, 1),
          ]);
          if (!sRes.ok) {
            if (sRes.status === 404) throw new Error(t('storefront.notAvailable'));
            const body = await sRes.text().catch(() => '');
            throw new Error(body || 'Failed to load store');
          }
          settingsData = await sRes.json();
          if (pRes.ok) productsData = await pRes.json();
          if (!productsData) {
            const refetchRes = await fetchWithTimeout(
              `/api/storefront/${encodeURIComponent(settingsData?.settings?.store_slug || slug)}/products`,
              35000, { cache: 'no-store' }, 1
            );
            if (refetchRes.ok) productsData = await refetchRes.json();
            else throw new Error(t('storefront.notAvailable'));
          }
        }
        if (!isMounted) return;
        const incomingSettings = settingsData?.settings || settingsData || {};
        const newSettings = {
          primary_color: '#16a34a',
          secondary_color: '#0ea5e9',
          currency_code: 'DZD',
          store_name: '',
          store_description: '',
          store_logo: '',
          banner_url: '',
          ...incomingSettings,
          template: incomingSettings?.template || 'pro',
          store_slug: incomingSettings?.store_slug || storeSlug,
        };
        setStoreSettings(newSettings);

        const canonical = String(newSettings.store_slug || storeSlug);
        if (canonical && canonical !== slug && location.pathname === `/store/${slug}`) {
          navigate(`/store/${canonical}${location.search}`, { replace: true });
          return;
        }

        // Track storefront page view once per canonical slug.
        if (canonical && trackedViewRef.current !== canonical) {
          trackedViewRef.current = canonical;
          fetch(`/api/storefront/${encodeURIComponent(canonical)}/track-view`, { method: 'POST' }).catch(() => {
            // non-critical
          });
        }
        
        // Save template and settings to localStorage for product pages
        // Exclude large base64 images to avoid quota exceeded errors
        localStorage.setItem(STOREFRONT_TEMPLATE_KEY, newSettings.template);
        // legacy: keep writing template for older pages until they migrate
        localStorage.setItem('template', newSettings.template);
        try {
          // Create a lightweight version without large base64 data
          const lightSettings = { ...newSettings };
          // If logo/banner are base64 (data:), replace with empty to save space
          if (lightSettings.store_logo?.startsWith('data:')) {
            lightSettings.store_logo = '';
          }
          if (lightSettings.banner_url?.startsWith('data:')) {
            lightSettings.banner_url = '';
          }
          localStorage.setItem(STOREFRONT_SETTINGS_KEY, JSON.stringify(lightSettings));
          // legacy: keep writing until all storefront pages migrate
          localStorage.setItem('storeSettings', JSON.stringify(lightSettings));
        } catch (e) {
          // Quota exceeded - clear and try again with minimal data
          console.warn('localStorage quota exceeded, storing minimal settings');
          localStorage.removeItem(STOREFRONT_SETTINGS_KEY);
          // legacy
          localStorage.removeItem('storeSettings');

          const minimal = {
            template: newSettings.template,
            store_slug: newSettings.store_slug,
            store_name: newSettings.store_name,
            currency_code: newSettings.currency_code,
            primary_color: newSettings.primary_color,
            secondary_color: newSettings.secondary_color,
          };
          localStorage.setItem(STOREFRONT_SETTINGS_KEY, JSON.stringify(minimal));
          // legacy
          localStorage.setItem('storeSettings', JSON.stringify(minimal));
        }
        
        const items = (productsData?.products || productsData || []) as StoreProduct[];
        // Strip categories from products for all storefront templates.
        const withoutCategories = items.map((p) => ({ ...p, category: undefined }));
        setProducts(withoutCategories);
        setCategories([]);
        setLoading(false);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Store Not Available');
        setLoading(false);
      }
    }
    fetchAll();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug]);

  // Keep window.TEMPLATE_SETTINGS in sync so templates using hooks reflect current settings.
  useEffect(() => {
    setWindowTemplateSettings(storeSettings);
    if (storeSettings?.currency_code) setStoreCurrency(storeSettings.currency_code);
  }, [storeSettings]);

  const handleProductView = useCallback((product: any) => {
    if (!product) return;
    trackAllPixels(PixelEvents.VIEW_CONTENT, {
      content_ids: [product.id],
      content_name: product.title || product.name || '',
      content_type: 'product',
      value: product.price,
      currency: storeSettings.currency_code || 'DZD',
    });
  }, [storeSettings.currency_code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-secondary/30 border-b-secondary rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{t('storefront.loading')}</p>
            <p className="text-white/60 text-sm mt-1">Connecting to store...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // Clear localStorage to help recovery from quota errors
    const handleRetry = () => {
      localStorage.removeItem('storeSettings');
      localStorage.removeItem('template');
      window.location.reload();
    };
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 p-6 max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-10a9 9 0 110 18 9 9 0 010-18z"/></svg>
          </div>
          <h2 className="text-2xl font-bold">{t('storefront.notAvailable')}</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-muted-foreground text-xs">The store link may be incorrect or the store is temporarily unavailable.</p>
          <div className="flex gap-2 pt-4">
            <button onClick={handleRetry} className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition">🔄 Retry</button>
            <a href="/" className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:opacity-90 transition">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <UniversalStyleInjector />
      <PixelScripts storeSlug={storeSlug!} />
      <div className="ecopro-storefront">
        {RenderStorefront(template as any, {
            storeSlug: storeSlug!,
            products,
            filtered: filteredProducts,
            settings: storeSettings,
            categories,
            searchQuery,
            setSearchQuery,
            categoryFilter,
            setCategoryFilter,
            sortOption,
            setSortOption,
            viewMode,
            setViewMode,
            formatPrice: (n: number) => formatPrice(n),
            primaryColor,
            secondaryColor,
            bannerUrl: bannerUrl || null,
            navigate: (to: any) => navigate(to),
            canManage: false,
            onProductView: handleProductView,
            initialProductSlug: initialProductSlug || undefined,
          })}
      </div>
      <StorefrontChatBubble storeSlug={storeSlug!} enabled={(storeSettings as any).chat_bubble_enabled !== false} />
    </>
  );
}