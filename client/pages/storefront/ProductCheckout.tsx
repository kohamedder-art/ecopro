import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Heart, Share2, ChevronLeft, Plus, Minus, Maximize2, ShoppingBag, Truck, 
  Shield, Clock, Star, Check, MapPin, Phone, Mail, User, 
  CreditCard, Package, Sparkles, ArrowRight, X, ChevronRight,
  Copy, MessageCircle, Zap, Gift, Send, CheckCircle2
} from 'lucide-react';
import {
  formatWilayaLabel,
  getAlgeriaCommuneById,
  getAlgeriaCommunesByWilayaId,
  getAlgeriaWilayaById,
  getAlgeriaWilayas,
} from '@/lib/algeriaGeo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PixelScripts, { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { readStorefrontSettings, readStorefrontTemplate } from '@/lib/storefrontStorage';

interface Product {
  id: number;
  slug?: string;
  title?: string;
  name?: string;
  price: number;
  images?: string[];
  description?: string;
  category?: string;
  stock_quantity?: number;
  variants?: Array<{
    id: number;
    color?: string | null;
    size?: string | null;
    variant_name?: string | null;
    price?: number | null;
    stock_quantity: number;
    images?: string[] | null;
    sort_order?: number | null;
  }>;
  [key: string]: any;
}

interface StoreSettings {
  template_accent_color?: string;
  template?: string;
  store_name?: string;
  logo_url?: string;
  [key: string]: any;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = String(hex || '').trim();
  if (!raw.startsWith('#')) return null;
  const h = raw.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export default function ProductCheckout() {
  const { id, slug, productSlug, storeSlug, productId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();

  // Force Arabic-only checkout UI on this page
  useEffect(() => {
    const prev = locale;
    if (prev !== 'ar') setLocale('ar');
    return () => {
      if (prev !== 'ar') setLocale(prev);
    };
  }, [locale, setLocale]);
  
  // Get the product identifier from any of the possible params
  const productIdentifier = id || slug || productSlug || productId;

  const resolvedStoreSlug =
    storeSlug ||
    (localStorage.getItem('currentStoreSlug') || '').trim();

  const storefrontHomePath = resolvedStoreSlug ? `/store/${encodeURIComponent(resolvedStoreSlug)}` : '/';
  
  // States
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [wishlist, setWishlist] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showFullImage, setShowFullImage] = useState<boolean>(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [telegramUrls, setTelegramUrls] = useState<string[]>([]);

  // If the public product payload doesn't include variants (or is stale),
  // try to load variants via the authenticated client endpoint (store owner only).
  const [variantOverride, setVariantOverride] = useState<any[] | null>(null);
  
  // Delivery pricing states
  const [deliveryType, setDeliveryType] = useState<'home' | 'desk'>('home');
  const [deliveryPriceHome, setDeliveryPriceHome] = useState<number | null>(null);
  const [deliveryPriceDesk, setDeliveryPriceDesk] = useState<number | null>(null);
  const [deliveryPrice, setDeliveryPrice] = useState<number | null>(null);
  const [loadingDeliveryPrice, setLoadingDeliveryPrice] = useState(false);
  
  // Telegram pre-connect states
  const [telegramBotInfo, setTelegramBotInfo] = useState<{
    enabled: boolean;
    botUrl?: string;
    botUsername?: string;
    storeName?: string;
  } | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [waitingForTelegramConnection, setWaitingForTelegramConnection] = useState(false);

  // Messenger pre-connect states
  const [messengerInfo, setMessengerInfo] = useState<{
    enabled: boolean;
    pageId?: string;
    url?: string;
    storeName?: string;
  } | null>(null);
  const [messengerConnected, setMessengerConnected] = useState(false);
  const [waitingForMessengerConnection, setWaitingForMessengerConnection] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    city: '',
    wilayaId: '',
    communeId: '',
    address: '',
    notes: '',
  });
  const [haiSuggestions, setHaiSuggestions] = useState<string[]>([]);
  const [haiSuggestionsSupported, setHaiSuggestionsSupported] = useState(true);

  // Get template and settings — prefer store_template from API, fall back to localStorage
  const dzWilayas = getAlgeriaWilayas();
  const dzCommunes = getAlgeriaCommunesByWilayaId(formData.wilayaId);

  useEffect(() => {
    let stopped = false;
    const loadHaiSuggestions = async () => {
      const slug = storeSlug || localStorage.getItem('currentStoreSlug');
      if (!haiSuggestionsSupported || !slug || !formData.communeId) {
        setHaiSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/storefront/${encodeURIComponent(String(slug))}/address/hai-suggestions?communeId=${encodeURIComponent(formData.communeId)}`
        );
        if (res.status === 404) {
          if (!stopped) {
            setHaiSuggestions([]);
            setHaiSuggestionsSupported(false);
          }
          return;
        }
        if (!res.ok) {
          if (!stopped) setHaiSuggestions([]);
          return;
        }
        const data = await res.json();
        const values = Array.isArray(data?.suggestions)
          ? data.suggestions
              .map((s: any) => String(s?.value || '').trim())
              .filter((v: string) => v.length > 0)
          : [];
        if (!stopped) setHaiSuggestions(values);
      } catch {
        if (!stopped) setHaiSuggestions([]);
      }
    };
    loadHaiSuggestions();
    return () => {
      stopped = true;
    };
  }, [haiSuggestionsSupported, storeSlug, formData.communeId]);

  // Fetch product
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productIdentifier],
    queryFn: async () => {
      const sessionId = searchParams.get('session');

      // Public product page view tracking (counts views)
      // Only applies when visiting via /store/:storeSlug/:productSlug
      if (storeSlug && productSlug) {
        const res = await fetch(
          `/api/store/${encodeURIComponent(String(storeSlug))}/${encodeURIComponent(String(productSlug))}?track_view=1`
        );
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem(`product_${productIdentifier}`, JSON.stringify(data));
          return data;
        }
      }
      
      if (sessionId) {
        try {
          const response = await fetch(`/api/checkout/get-product/${encodeURIComponent(sessionId)}`);
          if (response.ok) {
            const data = await response.json();
            return data.product;
          }
        } catch (error) {
          console.error('Failed to retrieve from checkout session:', error);
        }
      }
      
      const cachedProduct = localStorage.getItem(`product_${productIdentifier}`);
      if (cachedProduct) {
        const parsed = JSON.parse(cachedProduct);
        if (
          parsed.store_slug &&
          typeof parsed.stock_quantity === 'number' &&
          Array.isArray(parsed.variants)
        ) {
          return parsed;
        }
      }
      
      let response = await fetch(`/api/product-info/${productIdentifier}`);
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(`product_${productIdentifier}`, JSON.stringify(data));
        return data;
      }
      
      response = await fetch(`/api/product/${productIdentifier}`);
      if (response.ok) return response.json();
      
      response = await fetch(`/api/client/store/products/${productIdentifier}`);
      if (response.ok) return response.json();
      
      throw new Error('Failed to fetch product');
    },
  });

  // Fetch fresh settings directly from API (bypass localStorage cache)
  const { data: liveSettings } = useQuery({
    queryKey: ['storefront-settings', storeSlug],
    queryFn: async () => {
      if (!storeSlug) throw new Error('No store slug');
      const res = await fetch(`/api/storefront/${encodeURIComponent(storeSlug)}/settings?_t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      return (data?.settings || data || {}) as StoreSettings;
    },
    enabled: !!storeSlug,
    staleTime: 5000,
    retry: 1,
  });

  const template = (product as any)?.store_template || liveSettings?.template || readStorefrontTemplate('books');
  const settings: StoreSettings = liveSettings || readStorefrontSettings<StoreSettings>({} as StoreSettings);
  const accentColor = settings.template_accent_color || settings.primary_color || (product as any)?.primary_color || '#3b82f6';
  const primaryColor = settings.primary_color || (product as any)?.primary_color || accentColor;
  const secondaryColor = settings.secondary_color || (product as any)?.secondary_color || '#a855f7';

  const checkoutBgStyle: React.CSSProperties = {
    backgroundImage: [
      `radial-gradient(900px 500px at 10% -10%, ${withAlpha(primaryColor, 0.28)} 0%, transparent 60%)`,
      `radial-gradient(700px 450px at 110% 15%, ${withAlpha(secondaryColor, 0.22)} 0%, transparent 60%)`,
      `radial-gradient(700px 450px at 50% 115%, ${withAlpha(primaryColor, 0.14)} 0%, transparent 55%)`,
      'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    ].join(', '),
  };

  // Track ViewContent when product loads
  useEffect(() => {
    if (product) {
      trackAllPixels(PixelEvents.VIEW_CONTENT, {
        content_name: product.title || product.name,
        content_ids: [product.id],
        content_type: 'product',
        value: product.price,
        currency: settings.currency_code || 'DZD'
      });
    }
  }, [product?.id]);

  // Initialize default variant selection (when variants exist)
  useEffect(() => {
    const variants =
      Array.isArray(variantOverride) && variantOverride.length > 0
        ? variantOverride
        : (Array.isArray((product as any)?.variants) ? ((product as any).variants as any[]) : []);
    if (!variants.length) return;
    if (selectedVariantId != null) return;

    // If there are multiple variants, force the customer to explicitly choose.
    // Auto-select only when there's exactly one variant.
    if (variants.length !== 1) return;

    const first = variants[0];
    if (!first) return;
    setSelectedVariantId(Number(first.id));
    setSelectedColor(String(first.color || ''));
    setSelectedSize(String(first.size || ''));
  }, [product, selectedVariantId, variantOverride]);

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      if (variantOverride) return;
      const baseVariants = Array.isArray((product as any)?.variants) ? ((product as any).variants as any[]) : [];
      if (baseVariants.length > 0) return;
      const productId = Number((product as any)?.id);
      if (!Number.isFinite(productId) || productId <= 0) return;
      try {
        const r = await fetch(`/api/client/store/products/${productId}/variants`);
        if (!r.ok) return;
        const data = await r.json().catch(() => null);
        const variants = Array.isArray(data?.variants) ? data.variants : [];
        if (!stopped && variants.length > 0) {
          setVariantOverride(variants);
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => {
      stopped = true;
    };
  }, [product?.id, variantOverride]);

  // Clamp quantity when variant changes
  useEffect(() => {
    const variants =
      Array.isArray(variantOverride) && variantOverride.length > 0
        ? variantOverride
        : (Array.isArray((product as any)?.variants) ? ((product as any).variants as any[]) : []);
    if (!variants.length) return;

    const selected = variants.find((v) => Number(v.id) === Number(selectedVariantId));
    const stock = Number(selected?.stock_quantity ?? 0);
    if (!Number.isFinite(stock) || stock <= 0) {
      setQuantity(1);
      return;
    }
    setQuantity((q) => Math.min(q, stock));
  }, [product, selectedVariantId, variantOverride]);

  // Auto-scroll to checkout when opened & track InitiateCheckout
  useEffect(() => {
    if (showCheckout) {
      document.getElementById('checkout-section')?.scrollIntoView({ behavior: 'smooth' });
      // Track InitiateCheckout event
      if (product) {
        trackAllPixels(PixelEvents.INITIATE_CHECKOUT, {
          content_name: product.title || product.name,
          content_ids: [product.id],
          content_type: 'product',
          value: product.price * quantity,
          currency: settings.currency_code || 'DZD',
          num_items: quantity
        });
      }
    }
  }, [showCheckout]);

  // Fetch Telegram bot info for this store
  useEffect(() => {
    const fetchTelegramInfo = async () => {
      // Get store slug from multiple sources
      const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
      if (!slug) return;
      
      try {
        const res = await fetch(`/api/telegram/bot-link/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setTelegramBotInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch Telegram info:', error);
      }
    };
    fetchTelegramInfo();
  }, [storeSlug, product?.store_slug]);

  // Fetch Messenger info for this store
  useEffect(() => {
    const fetchMessengerInfo = async () => {
      const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
      if (!slug) return;
      
      try {
        const res = await fetch(`/api/messenger/page-link/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setMessengerInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch Messenger info:', error);
      }
    };
    fetchMessengerInfo();
  }, [storeSlug, product?.store_slug]);

  // Check Telegram connection when phone changes
  useEffect(() => {
    const checkConnection = async () => {
      const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
      if (!slug || !formData.phone || formData.phone.replace(/\D/g, '').length < 9) {
        setTelegramConnected(false);
        return;
      }
      
      setCheckingConnection(true);
      try {
        const normalizedPhone = formData.phone.replace(/\D/g, '');
        const res = await fetch(`/api/telegram/check-connection/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          setTelegramConnected(data.connected);
        }
      } catch (error) {
        console.error('Failed to check Telegram connection:', error);
      } finally {
        setCheckingConnection(false);
      }
    };
    
    // Debounce the check
    const timeout = setTimeout(checkConnection, 500);
    return () => clearTimeout(timeout);
  }, [storeSlug, product?.store_slug, formData.phone]);

  // Check Messenger connection when phone changes
  useEffect(() => {
    const checkConnection = async () => {
      const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
      if (!slug || !formData.phone || formData.phone.replace(/\D/g, '').length < 9) {
        setMessengerConnected(false);
        return;
      }
      
      try {
        const normalizedPhone = formData.phone.replace(/\D/g, '');
        const res = await fetch(`/api/messenger/check-connection/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          setMessengerConnected(data.connected);
        }
      } catch (error) {
        console.error('Failed to check Messenger connection:', error);
      }
    };
    
    const timeout = setTimeout(checkConnection, 500);
    return () => clearTimeout(timeout);
  }, [storeSlug, product?.store_slug, formData.phone]);

  // After placing an order, poll briefly for Telegram connection so UI updates automatically.
  useEffect(() => {
    if (!orderSuccess) return;

    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');

    if (!slug) return;
    if (telegramConnected) return;
    if (!telegramBotInfo?.enabled) return;
    if (normalizedPhone.length < 9) return;

    let stopped = false;
    let tries = 0;

    const tick = async () => {
      if (stopped) return;
      tries++;
      try {
        const res = await fetch(`/api/telegram/check-connection/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setTelegramConnected(true);
            stopped = true;
            return;
          }
        }
      } catch {
        // ignore
      }

      if (tries >= 15) {
        stopped = true;
      }
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [orderSuccess, storeSlug, product?.store_slug, formData.phone, telegramConnected, telegramBotInfo?.enabled]);

  // After placing an order, poll briefly for Messenger connection so UI updates automatically.
  useEffect(() => {
    if (!orderSuccess) return;

    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');

    if (!slug) return;
    if (messengerConnected) return;
    if (!messengerInfo?.enabled) return;
    if (normalizedPhone.length < 9) return;

    let stopped = false;
    let tries = 0;

    const tick = async () => {
      if (stopped) return;
      tries++;
      try {
        const res = await fetch(`/api/messenger/check-connection/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setMessengerConnected(true);
            setWaitingForMessengerConnection(false);
            stopped = true;
          }
        }
      } catch {
        // non-fatal
      }

      if (!stopped && tries < 20) {
        setTimeout(tick, 1000);
      }
    };

    setTimeout(tick, 1000);
    return () => {
      stopped = true;
    };
  }, [orderSuccess, storeSlug, product?.store_slug, formData.phone, messengerConnected, messengerInfo?.enabled]);

  // Poll for Telegram connection after clicking Connect button
  useEffect(() => {
    if (!waitingForTelegramConnection) return;
    if (telegramConnected) {
      setWaitingForTelegramConnection(false);
      return;
    }

    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');

    if (!slug || normalizedPhone.length < 9) return;

    let stopped = false;
    let tries = 0;

    const tick = async () => {
      if (stopped) return;
      tries++;
      try {
        const res = await fetch(`/api/telegram/check-connection/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setTelegramConnected(true);
            setWaitingForTelegramConnection(false);
            stopped = true;
            return;
          }
        }
      } catch {
        // ignore
      }

      // Stop after 60 attempts (2 min)
      if (tries >= 60) {
        setWaitingForTelegramConnection(false);
        stopped = true;
      }
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [waitingForTelegramConnection, telegramConnected, storeSlug, product?.store_slug, formData.phone]);

  // Generate Telegram connect URL with phone
  const getTelegramConnectUrl = () => {
    if (!telegramBotInfo?.enabled || !telegramBotInfo?.botUsername) return null;
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 9) {
      return `https://t.me/${telegramBotInfo.botUsername}`;
    }
    // Re-fetch with phone to get personalized link
    const normalizedPhone = formData.phone.replace(/\D/g, '');
    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    if (!slug) return `https://t.me/${telegramBotInfo.botUsername}`;
    return `/api/telegram/bot-link/${slug}?phone=${normalizedPhone}`;
  };

  // Open Telegram with proper link
  const handleConnectTelegram = async () => {
    if (!telegramBotInfo?.enabled || !telegramBotInfo?.botUsername) return;

    // If an order was already placed, prefer the order-scoped Telegram deep-link.
    // This makes the bot treat the connection as linking to the existing order (not a new preconnect).
    if (orderSuccess && telegramUrls.length > 0) {
      setWaitingForTelegramConnection(true);
      window.open(telegramUrls[0], '_blank');
      return;
    }
    
    let url = `https://t.me/${telegramBotInfo.botUsername}`;
    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    
    if (slug && formData.phone && formData.phone.replace(/\D/g, '').length >= 9) {
      try {
        const normalizedPhone = formData.phone.replace(/\D/g, '');
        const res = await fetch(`/api/telegram/bot-link/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          if (data.botUrl) url = data.botUrl;
        }
      } catch (error) {
        console.error('Failed to get Telegram link:', error);
      }
    }
    
    // Start polling for connection
    setWaitingForTelegramConnection(true);
    window.open(url, '_blank');
  };

  // Open Messenger with proper link
  const handleConnectMessenger = async () => {
    if (!messengerInfo?.enabled || !messengerInfo?.pageId) return;
    
    let url = messengerInfo.url || `https://m.me/${messengerInfo.pageId}`;
    const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    
    if (slug && formData.phone && formData.phone.replace(/\D/g, '').length >= 9) {
      try {
        const normalizedPhone = formData.phone.replace(/\D/g, '');
        const res = await fetch(`/api/messenger/page-link/${slug}?phone=${normalizedPhone}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) url = data.url;
        }
      } catch (error) {
        console.error('Failed to get Messenger link:', error);
      }
    }
    
    // Start polling for connection
    setWaitingForMessengerConnection(true);
    window.open(url, '_blank');
    
    // Poll for connection
    const slug2 = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
    const normalizedPhone = (formData.phone || '').replace(/\D/g, '');
    if (slug2 && normalizedPhone.length >= 9) {
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        if (tries > 60) {
          clearInterval(poll);
          setWaitingForMessengerConnection(false);
          return;
        }
        try {
          const res = await fetch(`/api/messenger/check-connection/${slug2}?phone=${normalizedPhone}`);
          if (res.ok) {
            const data = await res.json();
            if (data.connected) {
              setMessengerConnected(true);
              setWaitingForMessengerConnection(false);
              clearInterval(poll);
            }
          }
        } catch {}
      }, 2000);
    }
  };

  // Fetch delivery price when wilaya changes
  useEffect(() => {
    const fetchDeliveryPrice = async () => {
      const shippingMeta: any = (product as any)?.metadata?.shipping || null;
      const shippingMode = shippingMeta?.mode || shippingMeta?.shipping_mode || null;
      if (shippingMode === 'free') {
        setDeliveryPriceHome(0);
        setDeliveryPriceDesk(0);
        setLoadingDeliveryPrice(false);
        return;
      }
      if (shippingMode === 'flat') {
        const fee = Number(
          shippingMeta?.flat_fee ??
          shippingMeta?.flatFee ??
          shippingMeta?.shipping_flat_fee ??
          0
        );
        const safeFee = Number.isFinite(fee) && fee >= 0 ? fee : 0;
        setDeliveryPriceHome(safeFee);
        setDeliveryPriceDesk(safeFee);
        setLoadingDeliveryPrice(false);
        return;
      }

      const slug = storeSlug || product?.store_slug || localStorage.getItem('currentStoreSlug');
      if (!slug || !formData.wilayaId) {
        setDeliveryPriceHome(null);
        setDeliveryPriceDesk(null);
        return;
      }
      setLoadingDeliveryPrice(true);
      try {
        const res = await fetch(`/api/storefront/${encodeURIComponent(slug)}/delivery-prices?wilaya_id=${formData.wilayaId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.price?.home_delivery_price != null) {
            const home = Number(data.price.home_delivery_price);
            const desk = data.price.desk_delivery_price == null ? null : Number(data.price.desk_delivery_price);
            setDeliveryPriceHome(Number.isFinite(home) ? home : 0);
            setDeliveryPriceDesk(Number.isFinite(desk as any) ? (desk as any) : null);
          } else if (data.default_price != null) {
            const fallback = Number(data.default_price);
            setDeliveryPriceHome(Number.isFinite(fallback) ? fallback : 0);
            setDeliveryPriceDesk(Number.isFinite(fallback) ? fallback : 0);
          } else {
            setDeliveryPriceHome(null);
            setDeliveryPriceDesk(null);
          }
        } else {
          setDeliveryPriceHome(null);
          setDeliveryPriceDesk(null);
        }
      } catch (error) {
        setDeliveryPriceHome(null);
        setDeliveryPriceDesk(null);
      } finally {
        setLoadingDeliveryPrice(false);
      }
    };
    fetchDeliveryPrice();
  }, [storeSlug, product?.store_slug, formData.wilayaId]);

  // Pick effective delivery fee based on delivery type.
  useEffect(() => {
    const chosen =
      deliveryType === 'desk'
        ? (deliveryPriceDesk != null ? deliveryPriceDesk : deliveryPriceHome)
        : deliveryPriceHome;
    setDeliveryPrice(chosen == null ? null : chosen);
  }, [deliveryType, deliveryPriceHome, deliveryPriceDesk]);

  const handleSubmitOrder = async () => {
    const variants =
      Array.isArray(variantOverride) && variantOverride.length > 0
        ? variantOverride
        : (Array.isArray((product as any)?.variants) ? ((product as any).variants as any[]) : []);
    const hasVariants = variants.length > 0;
    const selectedVariant = hasVariants
      ? (variants.find((v) => Number(v.id) === Number(selectedVariantId)) || null)
      : null;
    const currentStock = hasVariants ? Number(selectedVariant?.stock_quantity ?? 0) : Number(product?.stock_quantity ?? 0);
    if (Number.isFinite(currentStock) && currentStock <= 0) {
      toast({ variant: 'destructive', title: t('checkout.error.outOfStockTitle'), description: t('checkout.error.outOfStockDesc') });
      return;
    }
    if (Number.isFinite(currentStock) && quantity > currentStock) {
      toast({ variant: 'destructive', title: t('checkout.error.insufficientStockTitle'), description: t('checkout.error.insufficientStockDesc') });
      return;
    }

    if (hasVariants && !selectedVariantId) {
      toast({ variant: 'destructive', title: t('checkout.error.selectVariantTitle'), description: t('checkout.error.selectVariantDesc') });
      return;
    }
    const requiresHomeAddress = deliveryType === 'home';
    if (!formData.fullName || !formData.phone || !formData.wilayaId || !formData.communeId || (requiresHomeAddress && !formData.address)) {
      toast({ variant: 'destructive', title: t('checkout.error.requiredFieldsTitle'), description: t('checkout.error.requiredFieldsDesc') });
      return;
    }

    if (!product?.id) {
      toast({ variant: 'destructive', title: t('checkout.error.productTitle'), description: t('checkout.error.productDesc') });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const selectedWilaya = getAlgeriaWilayaById(formData.wilayaId);
      const selectedCommune = getAlgeriaCommuneById(formData.communeId);

      // Build order data matching the API expectations
      const effectiveUnitPrice = hasVariants
        ? Number(selectedVariant?.price ?? product.price ?? 0)
        : Number(product.price ?? 0);

      const orderData: any = {
        product_id: product.id,
        ...(hasVariants && selectedVariantId ? { variant_id: selectedVariantId } : {}),
        quantity: quantity,
        total_price: (effectiveUnitPrice * quantity) + (deliveryPrice || 0),
        delivery_fee: deliveryPrice || 0,
        delivery_type: deliveryType,
        customer_name: formData.fullName,
        customer_phone: formData.phone,
        shipping_wilaya_id: formData.wilayaId ? Number(formData.wilayaId) : null,
        shipping_commune_id: formData.communeId ? Number(formData.communeId) : null,
        customer_address:
          [selectedCommune?.name || formData.city, selectedWilaya?.name ? selectedWilaya.name : '']
            .filter(Boolean)
            .join(', ') +
          (deliveryType === 'home'
            ? ` - ${formData.address}${formData.notes ? ` (${formData.notes})` : ''}`
            : `${formData.notes ? ` (${formData.notes})` : ''}`),
      };

      console.log('Submitting order:', orderData);

      const postJson = async (body: any) => {
        const resp = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const rawText = await resp.text();
        let json: any = null;
        try {
          json = rawText ? JSON.parse(rawText) : null;
        } catch {
          json = null;
        }
        return { resp, rawText, json };
      };

      let { resp: response, rawText: raw, json: result } = await postJson(orderData);

      // Backward-compat: older servers reject unknown shipping_* fields (Zod .strict())
      if (!response.ok && response.status === 400) {
        const formErrors: string[] = result?.details?.formErrors || [];
        const unrecognized = formErrors.some((e) => String(e).includes('Unrecognized key'));
        if (unrecognized) {
          const { shipping_wilaya_id, shipping_commune_id, shipping_hai, ...fallback } = orderData as any;
          ({ resp: response, rawText: raw, json: result } = await postJson(fallback));
        }
      }
      
      if (response.ok) {
        console.log('Order created:', result);
        setOrderId(result.orderId || result.id);
        if (result.telegramUrls) setTelegramUrls(result.telegramUrls);
        setOrderSuccess(true);
        
        // Track Purchase event
        trackAllPixels(PixelEvents.PURCHASE, {
          content_name: product.title || product.name,
          content_ids: [product.id],
          content_type: 'product',
          value: (hasVariants ? Number(selectedVariant?.price ?? product.price ?? 0) : Number(product.price ?? 0)) * quantity,
          currency: settings.currency_code || 'DZD',
          num_items: quantity,
          order_id: result.orderId || result.id
        });
      } else {
        console.error('Order failed:', result);
        const msg = result?.error || result?.message || raw || `HTTP ${response.status}`;
        throw new Error(msg);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: t('checkout.error.orderFailedTitle'),
        description: `${t('checkout.error.orderFailedDesc')}: ${msg}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const productImage = (product as any)?.images?.[0] || 'https://via.placeholder.com/500';
  const productImages =
    Array.isArray((product as any)?.images) && (product as any).images.length > 0
      ? ((product as any).images as string[])
      : [productImage];

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  // Auto-rotate gallery images (kept subtle to feel effortless).
  useEffect(() => {
    if (!productImages || productImages.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % productImages.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [product?.id, productImages.length]);

  // Track whether viewport is mobile (used to decide max height of image viewer)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={checkoutBgStyle}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={checkoutBgStyle}>
        <div className="text-center text-slate-900">
          <Package className="w-16 h-16 mx-auto mb-4" style={{ color: withAlpha(primaryColor, 0.35) }} />
          <h2 className="text-xl font-bold mb-2">{t('storefront.productNotFoundTitle')}</h2>
          <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline">
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  const variantsRaw =
    Array.isArray(variantOverride) && variantOverride.length > 0
      ? variantOverride
      : (Array.isArray((product as any)?.variants) ? ((product as any).variants as any[]) : []);
  const variants = variantsRaw;
  const activeVariants = variantsRaw.filter((v) => v?.is_active !== false);
  const hasVariants = variants.length > 0;
  const hasActiveVariants = activeVariants.length > 0;
  const colors = Array.from(
    new Set(
      activeVariants
        .map((v) => String(v?.color || '').trim())
        .filter((v) => v.length > 0)
    )
  );
  const sizes = Array.from(
    new Set(
      activeVariants
        .map((v) => String(v?.size || '').trim())
        .filter((v) => v.length > 0)
    )
  );
  const filteredByColor = selectedColor
    ? activeVariants.filter((v) => String(v?.color || '').trim() === selectedColor)
    : activeVariants;
  const sizesForSelectedColor = Array.from(
    new Set(
      filteredByColor
        .map((v) => String(v?.size || '').trim())
        .filter((v) => v.length > 0)
    )
  );

  const resolvedVariant = hasVariants
    ? (activeVariants.find((v) => Number(v.id) === Number(selectedVariantId)) ||
        activeVariants.find((v) => {
          const c = String(v?.color || '').trim();
          const s = String(v?.size || '').trim();
          if (selectedColor && c !== selectedColor) return false;
          if (selectedSize && s !== selectedSize) return false;
          return true;
        }) ||
        null)
    : null;

  const productPrice = hasVariants ? Number(resolvedVariant?.price ?? product.price ?? 0) : (product.price || 0);
  const productName = product.title || product.name || t('storefront.productDefaultName');
  const productDesc = product.description || t('storefront.productDefaultDesc');
  const availableStock = hasVariants ? Number(resolvedVariant?.stock_quantity ?? 0) : Number(product.stock_quantity ?? 0);
  const inStock = Number.isFinite(availableStock) && availableStock > 0;
  const subtotalPrice = productPrice * quantity;
  const totalPrice = subtotalPrice + (deliveryPrice || 0);

  // Success Screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={checkoutBgStyle}>
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-24 -left-28 h-72 w-72 rounded-full blur-3xl opacity-25"
            style={{ backgroundColor: withAlpha(primaryColor, 0.55) }}
          />
          <div
            className="absolute top-20 -right-28 h-64 w-64 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: withAlpha(secondaryColor, 0.5) }}
          />
        </div>

        <div className="max-w-md w-full relative">
          <div className="bg-white/85 backdrop-blur rounded-2xl p-6 text-center border border-slate-300 shadow-sm">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: `linear-gradient(135deg, ${withAlpha(primaryColor, 0.95)} 0%, ${withAlpha(secondaryColor, 0.95)} 100%)` }}
            >
              <Check className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('checkout.success')}</h1>
            <p className="text-slate-600 mb-5">{t('checkout.successDesc')}</p>
            
            {orderId && (
              <div className="bg-white rounded-xl p-4 mb-5 border border-slate-300">
                <p className="text-slate-500 text-sm mb-1">{t('checkout.orderNumber')}</p>
                <p className="text-2xl font-bold text-slate-900">#{orderId}</p>
              </div>
            )}

            <div className="bg-white rounded-xl p-4 mb-5 text-right border border-slate-300">
              <div className="flex justify-between text-slate-700 mb-2">
                <span className="truncate">{productName}</span>
                <span className="shrink-0">×{quantity}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('checkout.subtotal')}</span>
                <span>{subtotalPrice.toLocaleString()} دج</span>
              </div>
              {deliveryPrice !== null && (
                <div className="flex justify-between text-slate-600 text-sm">
                  <span>{t('checkout.deliveryFee')}</span>
                  <span>{deliveryPrice.toLocaleString()} دج</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                <span>{t('checkout.total')}</span>
                <span className="text-red-600">{totalPrice.toLocaleString()} دج</span>
              </div>
            </div>

            {telegramBotInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-700" />
                    <div>
                      <p className="text-slate-900 font-bold text-sm">{t('checkout.confirmation.telegramTitle')}</p>
                      <p className="text-slate-600 text-xs">
                        {telegramConnected 
                          ? t('checkout.confirmation.connected') 
                          : waitingForTelegramConnection 
                            ? t('checkout.confirmation.waiting') 
                            : telegramBotInfo.enabled
                              ? t('checkout.confirmation.notConnectedYet')
                              : t('checkout.confirmation.unavailable')}
                      </p>
                    </div>
                  </div>

                  {!telegramConnected ? (
                    <button
                      onClick={handleConnectTelegram}
                      disabled={
                        !telegramBotInfo.enabled ||
                        !formData.phone ||
                        formData.phone.replace(/\D/g, '').length < 9 ||
                        waitingForTelegramConnection
                      }
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {waitingForTelegramConnection ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          {t('checkout.confirmation.waitingShort')}
                        </>
                      ) : (
                        telegramBotInfo.enabled ? t('checkout.confirmation.connect') : t('checkout.confirmation.unavailable')
                      )}
                    </button>
                  ) : (
                    <span className="text-emerald-700 text-xs font-bold">{t('checkout.confirmation.ready')}</span>
                  )}
                </div>

                <div className="text-slate-700 text-xs leading-relaxed">
                  <p className="mb-1 font-semibold text-slate-800">{t('checkout.confirmation.youWillReceive')}</p>
                  <p>{t('checkout.confirmation.orderReceived')}</p>
                  <p>{t('checkout.confirmation.pinInstructions')}</p>
                  <p>{t('checkout.confirmation.confirmButtons')}</p>
                </div>

                {telegramUrls.length > 0 && (
                  <a
                    href={telegramUrls[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                  >
                    <Send className="w-4 h-4" />
                    {t('checkout.confirmation.openTelegram')}
                  </a>
                )}
              </div>
            )}

            {messengerInfo && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 text-left">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-indigo-700" />
                    <div>
                      <p className="text-slate-900 font-bold text-sm">{t('checkout.confirmation.messengerTitle')}</p>
                      <p className="text-slate-600 text-xs">
                        {messengerConnected
                          ? t('checkout.confirmation.connected')
                          : waitingForMessengerConnection
                            ? t('checkout.confirmation.waiting')
                            : messengerInfo.enabled
                              ? t('checkout.confirmation.notConnectedYet')
                              : t('checkout.confirmation.notAvailable')}
                      </p>
                    </div>
                  </div>

                  {!messengerConnected ? (
                    <button
                      onClick={handleConnectMessenger}
                      disabled={
                        !messengerInfo.enabled ||
                        !formData.phone ||
                        formData.phone.replace(/\D/g, '').length < 9 ||
                        waitingForMessengerConnection
                      }
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {waitingForMessengerConnection ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          {t('checkout.confirmation.waitingShort')}
                        </>
                      ) : messengerInfo.enabled ? (
                        t('checkout.confirmation.connect')
                      ) : (
                        t('checkout.confirmation.unavailable')
                      )}
                    </button>
                  ) : (
                    <span className="text-emerald-700 text-xs font-bold">{t('checkout.confirmation.ready')}</span>
                  )}
                </div>

                <div className="text-slate-700 text-xs leading-relaxed">
                  {messengerInfo.enabled ? (
                    <>
                      <p className="mb-1 font-semibold text-slate-800">{t('checkout.confirmation.youWillReceive')}</p>
                      <p>{t('checkout.confirmation.orderReceived')}</p>
                      <p>{t('checkout.confirmation.messengerConfirmButtons')}</p>
                    </>
                  ) : (
                    <p>{t('checkout.confirmation.messengerDisabled')}</p>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate(storefrontHomePath)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-bold transition-all border border-slate-900"
            >
              {t('checkout.returnToStore')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get store slug for pixel tracking
  const pixelStoreSlug = storeSlug || product?.store_slug || settings.store_slug || resolvedStoreSlug || '';

  const storeLogoUrl = (settings as any).store_logo || settings.logo_url || '';

  return (
    <>
      {pixelStoreSlug && <PixelScripts storeSlug={pixelStoreSlug} />}
      <div className="min-h-screen relative overflow-hidden" style={checkoutBgStyle}>
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-24 -left-28 h-72 w-72 rounded-full blur-3xl opacity-25"
            style={{ backgroundColor: withAlpha(primaryColor, 0.55) }}
          />
          <div
            className="absolute top-20 -right-28 h-64 w-64 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: withAlpha(secondaryColor, 0.5) }}
          />
          <div
            className="absolute -bottom-24 left-1/2 -translate-x-1/2 h-[22rem] w-[22rem] rounded-full blur-3xl opacity-[0.14]"
            style={{ backgroundColor: withAlpha(primaryColor, 0.4) }}
          />
        </div>

        {/* Simple Header */}
        <div
          className="sticky top-0 z-50 backdrop-blur border-b"
          style={{
            background: `linear-gradient(90deg, ${withAlpha(primaryColor, 0.10)} 0%, rgba(255,255,255,0.86) 40%, ${withAlpha(secondaryColor, 0.10)} 100%)`,
            borderColor: 'rgba(148, 163, 184, 0.45)',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg border text-slate-700 transition"
              style={{
                borderColor: withAlpha(primaryColor, 0.18),
                background: 'rgba(255,255,255,0.7)',
              }}
              aria-label="رجوع"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              {storeLogoUrl ? (
                <img src={storeLogoUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : null}
              <span className="font-semibold text-slate-900 truncate">{settings.store_name || 'متجر'}</span>
            </div>

            <button
              onClick={() => setWishlist(!wishlist)}
              className={`p-2 rounded-lg border transition ${
                wishlist
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              aria-label="المفضلة"
            >
              <Heart className={`w-5 h-5 ${wishlist ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Form (left on desktop) */}
            <div className="order-2 lg:order-1">
              <div
                className="rounded-2xl border p-4 sm:p-5 shadow-sm"
                style={{
                  borderColor: 'rgba(148, 163, 184, 0.55)',
                  background: 'rgba(255,255,255,0.82)',
                  boxShadow: `0 12px 40px ${withAlpha(primaryColor, 0.08)}, 0 0 0 1px rgba(15,23,42,0.06)`,
                }}
              >
                {/* Product info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{productName}</h1>
                    {productDesc ? (
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{productDesc}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-extrabold" style={{ color: '#ef4444' }}>
                      {productPrice.toLocaleString()} دج
                    </p>
                    <p
                      className={`mt-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        inStock
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {inStock ? 'متوفر' : 'غير متوفر'}
                    </p>
                  </div>
                </div>

                {/* Variants (simple chip UI) */}
                {hasVariants && (
                  <div className="mt-4 space-y-3">
                    {colors.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">اللون</div>
                        <div className="flex flex-wrap gap-2">
                          {colors.map((c) => {
                            const isActive = String(selectedColor).trim() === String(c).trim();
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const nextColor = c;
                                  setSelectedColor(nextColor);
                                  const candidates = activeVariants.filter(
                                    (v) => String(v?.color || '').trim() === String(nextColor).trim()
                                  );

                                  const candidateSizes = Array.from(
                                    new Set(
                                      candidates
                                        .map((v) => String(v?.size || '').trim())
                                        .filter((v) => v.length > 0)
                                    )
                                  );

                                  let nextSize = selectedSize;
                                  if (candidateSizes.length > 0 && !candidateSizes.includes(nextSize)) {
                                    nextSize = candidateSizes[0];
                                  }
                                  setSelectedSize(nextSize);

                                  const picked =
                                    candidates.find(
                                      (v) => !nextSize || String(v?.size || '').trim() === String(nextSize).trim()
                                    ) || candidates[0];
                                  setSelectedVariantId(picked ? Number(picked.id) : null);
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                  isActive
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                                aria-pressed={isActive}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(sizesForSelectedColor.length > 0 || (sizes.length > 0 && colors.length === 0)) && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">الحجم / النوع</div>
                        <div className="flex flex-wrap gap-2">
                          {(colors.length > 0 ? sizesForSelectedColor : sizes).map((s) => {
                            const isActive = String(selectedSize).trim() === String(s).trim();
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const nextSize = s;
                                  setSelectedSize(nextSize);
                                  const candidates = activeVariants.filter((v) => {
                                    const c = String(v?.color || '').trim();
                                    const ss = String(v?.size || '').trim();
                                    if (selectedColor && c !== String(selectedColor).trim()) return false;
                                    return ss === String(nextSize).trim();
                                  });
                                  const picked = candidates[0] || null;
                                  setSelectedVariantId(picked ? Number(picked.id) : null);
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                  isActive
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                                aria-pressed={isActive}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {colors.length === 0 && sizes.length === 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">الخيارات</div>
                        <div className="flex flex-wrap gap-2">
                          {activeVariants.map((v) => {
                            const id = Number(v.id);
                            const out = Number(v?.stock_quantity ?? 0) <= 0;
                            const label =
                              String(v?.variant_name || '').trim() ||
                              [String(v?.color || '').trim(), String(v?.size || '').trim()]
                                .filter(Boolean)
                                .join(' / ') ||
                              `خيار رقم ${v.id}`;
                            const isActive = Number(selectedVariantId) === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  if (out) return;
                                  setSelectedVariantId(id);
                                  setSelectedColor(String(v?.color || ''));
                                  setSelectedSize(String(v?.size || ''));
                                }}
                                disabled={out}
                                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                  isActive
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                } ${out ? 'opacity-50 cursor-not-allowed' : ''}`}
                                aria-pressed={isActive}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity + price summary */}
                <div className="mt-4 rounded-xl border border-slate-300 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">الكمية</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold text-slate-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!Number.isFinite(availableStock) || availableStock <= 0) return;
                          setQuantity((q) => Math.min(availableStock, q + 1));
                        }}
                        disabled={!inStock || (Number.isFinite(availableStock) && quantity >= availableStock)}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-700 font-semibold">المنتج: {subtotalPrice.toLocaleString()} دج</div>
                      <div className="text-xs text-slate-600">
                        التوصيل:{' '}
                        {loadingDeliveryPrice ? (
                          <span>{t('checkout.loading')}</span>
                        ) : deliveryPrice != null ? (
                          <span className="font-semibold" style={{ color: '#2563eb' }}>
                            {deliveryPrice.toLocaleString()} دج
                          </span>
                        ) : (
                          <span>{t('checkout.selectWilaya')}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          مهم
                        </span>
                        <span className="text-base font-extrabold" style={{ color: '#ef4444' }}>
                          الإجمالي: {totalPrice.toLocaleString()} دج
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer form */}
                <div
                  className="mt-4 grid grid-cols-2 gap-2"
                  style={
                    {
                      ['--accentRing' as any]: withAlpha('#2563eb', 0.20),
                      ['--accentBorder' as any]: withAlpha('#2563eb', 0.55),
                    } as React.CSSProperties
                  }
                >
                  <input
                    type="text"
                    placeholder={`${t('checkout.fullName')} *`}
                    value={formData.fullName}
                    onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                    className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accentRing)] focus:border-[var(--accentBorder)]"
                  />
                  <input
                    type="tel"
                    placeholder={`${t('checkout.phone')} *`}
                    value={formData.phone}
                    onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                    className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accentRing)] focus:border-[var(--accentBorder)]"
                    dir="ltr"
                  />

                  <Select
                    value={formData.wilayaId}
                    onValueChange={(nextId) => {
                      setFormData((f) => ({ ...f, wilayaId: nextId, communeId: '', city: '' }));
                    }}
                  >
                    <SelectTrigger className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm h-auto focus:ring-2 focus:ring-[var(--accentRing)] focus:border-[var(--accentBorder)]">
                      <SelectValue placeholder={`${t('checkout.wilaya')} *`} />
                    </SelectTrigger>
                    <SelectContent>
                      {dzWilayas.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {formatWilayaLabel(w)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={formData.communeId}
                    disabled={!formData.wilayaId}
                    onValueChange={(nextId) => {
                      const c = getAlgeriaCommuneById(nextId);
                      setFormData((f) => ({ ...f, communeId: nextId, city: c?.name || '' }));
                    }}
                  >
                    <SelectTrigger className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm disabled:opacity-60 h-auto focus:ring-2 focus:ring-[var(--accentRing)] focus:border-[var(--accentBorder)]">
                      <SelectValue placeholder={formData.wilayaId ? `${t('checkout.commune')} *` : t('checkout.selectWilayaFirst')} />
                    </SelectTrigger>
                    <SelectContent>
                      {dzCommunes.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {deliveryType === 'home' && (
                    <input
                      type="text"
                      placeholder={`${t('checkout.address')} *`}
                      value={formData.address}
                      onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                      className="col-span-2 px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accentRing)] focus:border-[var(--accentBorder)]"
                    />
                  )}
                </div>

                {/* Delivery type */}
                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-800">{t('checkout.deliveryType')}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType('desk');
                        setFormData((f) => ({ ...f, address: '' }));
                      }}
                      disabled={deliveryPriceDesk == null && deliveryPriceHome != null}
                      className={`rounded-xl border-2 px-3 py-2 text-sm text-left transition ${
                        deliveryType === 'desk'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      } ${(deliveryPriceDesk == null && deliveryPriceHome != null) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-semibold">{t('checkout.deliveryTypeDesk')}</div>
                      <div className={`text-xs ${deliveryType === 'desk' ? 'text-white/80' : 'text-slate-500'}`}>
                        {loadingDeliveryPrice
                          ? t('checkout.loading')
                          : deliveryPriceDesk != null
                            ? `${deliveryPriceDesk.toLocaleString()} دج`
                            : t('checkout.notAvailable')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('home')}
                      className={`rounded-xl border-2 px-3 py-2 text-sm text-left transition ${
                        deliveryType === 'home'
                          ? 'text-white shadow-sm'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                      style={
                        deliveryType === 'home'
                          ? {
                              backgroundColor: '#2563eb',
                              borderColor: withAlpha('#2563eb', 0.75),
                            }
                          : undefined
                      }
                    >
                      <div className="font-semibold">{t('checkout.deliveryTypeHome')}</div>
                      <div className={`text-xs ${deliveryType === 'home' ? 'text-white/80' : 'text-slate-500'}`}>
                        {loadingDeliveryPrice
                          ? t('checkout.loading')
                          : deliveryPriceHome != null
                            ? `${deliveryPriceHome.toLocaleString()} دج`
                            : t('checkout.selectWilaya')}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Telegram/Messenger (kept optional) */}
                {(telegramBotInfo || messengerInfo) && (
                  <div className="mt-4 space-y-2">
                    {telegramBotInfo && (
                      <div
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{
                          borderColor: withAlpha(primaryColor, 0.14),
                          background: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-slate-700" />
                          <span className="text-slate-900 text-sm">{t('checkout.confirmation.telegramTitle')}</span>
                          {telegramConnected && <span className="text-emerald-600 text-xs">✓</span>}
                          {!telegramBotInfo.enabled && <span className="text-slate-400 text-xs">({t('checkout.confirmation.notAvailable')})</span>}
                        </div>
                        {!telegramConnected && (
                          <button
                            onClick={handleConnectTelegram}
                            disabled={
                              !telegramBotInfo.enabled ||
                              !formData.phone ||
                              formData.phone.replace(/\D/g, '').length < 9
                            }
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#2563eb' }}
                          >
                            {telegramBotInfo.enabled ? t('checkout.confirmation.connect') : t('checkout.confirmation.unavailable')}
                          </button>
                        )}
                      </div>
                    )}

                    {messengerInfo && (
                      <div
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{
                          borderColor: withAlpha(primaryColor, 0.14),
                          background: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-slate-700" />
                          <span className="text-slate-900 text-sm">{t('checkout.confirmation.messengerTitle')}</span>
                          {messengerConnected && <span className="text-emerald-600 text-xs">✓</span>}
                          {!messengerInfo.enabled && <span className="text-slate-400 text-xs">({t('checkout.confirmation.notAvailable')})</span>}
                        </div>
                        {!messengerConnected && (
                          <button
                            onClick={handleConnectMessenger}
                            disabled={
                              !messengerInfo.enabled ||
                              !formData.phone ||
                              formData.phone.replace(/\D/g, '').length < 9 ||
                              waitingForMessengerConnection
                            }
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                            style={{ backgroundColor: '#2563eb' }}
                          >
                            {waitingForMessengerConnection
                              ? t('checkout.confirmation.waitingShort')
                              : messengerInfo.enabled
                                ? t('checkout.confirmation.connect')
                                : t('checkout.confirmation.unavailable')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting || !inStock}
                  className="mt-4 w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-95 active:opacity-90"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      {t('checkout.placeOrder')} • {totalPrice.toLocaleString()} دج
                    </>
                  )}
                </button>

                {/* Full description (simple, no clutter) */}
                {product.description ? (
                  <div className="mt-5 pt-4 border-t border-slate-200">
                    <div className="text-sm font-semibold text-slate-900 mb-2">الوصف</div>
                    <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{product.description}</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Gallery (right on desktop) */}
            <div className="order-1 lg:order-2">
              <div
                className="rounded-2xl border overflow-hidden shadow-sm"
                style={{
                  borderColor: 'rgba(148, 163, 184, 0.55)',
                  background: 'rgba(255,255,255,0.82)',
                  boxShadow: `0 12px 40px ${withAlpha(primaryColor, 0.08)}, 0 0 0 1px rgba(15,23,42,0.06)`,
                }}
              >
                <div
                  className="relative"
                  style={{
                    background: `linear-gradient(180deg, ${withAlpha(primaryColor, 0.08)} 0%, rgba(255,255,255,0) 70%)`,
                  }}
                >
                  <div
                    style={{ maxHeight: isMobile ? '60vh' : '80vh', overflow: 'auto', cursor: 'pointer' }}
                    onClick={() => setShowFullImage(true)}
                    aria-hidden
                  >
                    <img
                      src={productImages[activeImageIndex]}
                      alt={productName}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Expand button (visible and fixed to image card) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowFullImage(true); }}
                    title={t('productDetail.viewFullImage') || 'View full'}
                    className="absolute left-4 bottom-4 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black text-white border border-transparent shadow-md hover:opacity-95"
                    aria-label={t('productDetail.expand') || 'Expand'}
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('productDetail.expand') || 'Expand'}</span>
                  </button>

                  {productImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => (i > 0 ? i - 1 : productImages.length - 1)); }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white border border-slate-200 text-slate-800 z-30"
                        aria-label="الصورة السابقة"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => (i < productImages.length - 1 ? i + 1 : 0)); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white border border-slate-200 text-slate-800 z-30"
                        aria-label="الصورة التالية"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {productImages.length > 1 && (
                  <div className="p-3 border-t" style={{ borderColor: withAlpha(primaryColor, 0.14) }}>
                    <div className="flex gap-2 overflow-x-auto">
                      {productImages.map((src, idx) => {
                        const selected = idx === activeImageIndex;
                        return (
                          <button
                            key={`${src}-${idx}`}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border transition ${
                              selected ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300'
                            }`}
                            aria-label={`Image ${idx + 1}`}
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Slightly wider modal viewer (keeps default card size unchanged) */}
      {showFullImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-start justify-center pt-12 pb-6 px-4" onClick={() => setShowFullImage(false)}>
          <div
            className="relative mx-auto"
            style={isMobile
              ? { maxWidth: '100vw', width: '100%', maxHeight: '100vh', overflowY: 'auto', padding: '0 12px', WebkitOverflowScrolling: 'touch' }
              : { maxWidth: 'calc(100vw - 48px)', width: '100%', maxHeight: '98vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="absolute right-3 top-3 z-50 p-2 rounded-full bg-white/90 shadow" onClick={() => setShowFullImage(false)} aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-white/90 shadow" onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => (i > 0 ? i - 1 : productImages.length - 1)); }} aria-label="Prev">
              <ChevronLeft className="w-6 h-6" />
            </button>

            <img
              src={productImages[activeImageIndex]}
              alt={productName}
              className="mx-auto z-40"
              style={isMobile
                ? { width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }
                : { width: 'auto', maxWidth: '100%', maxHeight: '94vh', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }
              }
            />

            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-white/90 shadow" onClick={(e) => { e.stopPropagation(); setActiveImageIndex((i) => (i < productImages.length - 1 ? i + 1 : 0)); }} aria-label="Next">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
