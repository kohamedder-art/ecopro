import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, Share2, ChevronLeft, Plus, Minus, Maximize2, MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import PixelScripts, { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { useTranslation } from '@/lib/i18n';
import { readStorefrontSettings, readStorefrontTemplate } from '@/lib/storefrontStorage';
import { safeJsonParse } from '@/utils/safeJson';

interface Product {
  id: number;
  slug?: string;
  title?: string;
  name?: string;
  price: number;
  stock_quantity: number;
  images?: string[];
  description?: string;
  category?: string;
  store_slug?: string;
  variants?: any[];
  [key: string]: any;
}

interface StoreSettings {
  template_accent_color?: string;
  template?: string;
  store_name?: string;
  [key: string]: any;
}

const TEMPLATE_STYLES: Record<string, Record<string, string>> = {
  electronics: {
    bg: 'bg-black',
    accent: '#38bdf8',
    text: 'text-gray-100',
    border: 'border-gray-700',
    button: 'bg-cyan-500 hover:bg-cyan-600 text-black',
  },
  fashion: {
    bg: 'bg-black',
    accent: '#f97316',
    text: 'text-gray-100',
    border: 'border-gray-700',
    button: 'bg-amber-500 hover:bg-amber-600 text-black',
  },
  fashion2: {
    bg: 'bg-white',
    accent: '#000000',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-black hover:bg-gray-900 text-white',
  },
  fashion3: {
    bg: 'bg-gray-900',
    accent: '#facc15',
    text: 'text-gray-100',
    border: 'border-gray-700',
    button: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold',
  },
  beauty: {
    bg: 'bg-white',
    accent: '#ec4899',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-pink-500 hover:bg-pink-600 text-white',
  },
  beaty: {
    bg: 'bg-white',
    accent: '#ec4899',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-pink-400 hover:bg-pink-500 text-white',
  },
  cafe: {
    bg: 'bg-amber-50',
    accent: '#d97706',
    text: 'text-gray-900',
    border: 'border-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  jewelry: {
    bg: 'bg-white',
    accent: '#d4af37',
    text: 'text-gray-900',
    border: 'border-gray-300',
    button: 'bg-yellow-700 hover:bg-yellow-800 text-white',
  },
  bags: {
    bg: 'bg-white',
    accent: '#111827',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-gray-900 hover:bg-gray-800 text-white',
  },
  baby: {
    bg: 'bg-amber-50',
    accent: '#fbbf24',
    text: 'text-gray-900',
    border: 'border-amber-100',
    button: 'bg-green-600 hover:bg-green-700 text-white',
  },
  furniture: {
    bg: 'bg-gray-50',
    accent: '#111827',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-gray-900 hover:bg-gray-800 text-white',
  },
  food: {
    bg: 'bg-white',
    accent: '#a3c76d',
    text: 'text-gray-900',
    border: 'border-gray-200',
    button: 'bg-green-700 hover:bg-green-800 text-white',
  },
  perfume: {
    bg: 'bg-black',
    accent: '#f59e0b',
    text: 'text-gray-100',
    border: 'border-gray-700',
    button: 'bg-amber-500 hover:bg-amber-600 text-black',
  },
};

export default function ProductDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [wishlist, setWishlist] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showFullImage, setShowFullImage] = useState<boolean>(false);

  // Get template and settings from session/props
  const template = readStorefrontTemplate('fashion');
  const settings: StoreSettings = readStorefrontSettings<StoreSettings>({} as StoreSettings);
  const style = TEMPLATE_STYLES[template] || TEMPLATE_STYLES.fashion;
  const accentColor = settings.template_accent_color || style.accent;

  const storeSlug = settings.store_slug || '';

  const pruneProductForCache = (p: any) => {
    if (!p || typeof p !== 'object') return p;
    const images = Array.isArray(p.images) ? p.images.slice(0, 6) : undefined;
    const variants = Array.isArray(p.variants) ? p.variants : undefined;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      name: p.name,
      price: p.price,
      original_price: p.original_price,
      images,
      description: p.description,
      category: p.category,
      material: p.material,
      realm: p.realm,
      stock_quantity: p.stock_quantity,
      store_slug: p.store_slug || storeSlug,
      variants,
    };
  };

  const safeSetProductCache = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // localStorage quota can be exceeded if images are base64; avoid breaking navigation.
      console.warn('Failed to write product cache:', e);
    }
  };

  const cacheProduct = (identifier: string, p: any) => {
    if (!identifier) return;
    const pruned = pruneProductForCache(p);
    safeSetProductCache(`product_${identifier}`, pruned);
    if (p?.id != null) safeSetProductCache(`product_${String(p.id)}`, pruned);
    if (p?.slug) safeSetProductCache(`product_${String(p.slug)}`, pruned);
  };

  const fetchFreshProduct = async (identifier: string, shouldTrackView: boolean) => {
    const isNumericId = identifier && /^\d+$/.test(identifier);
    const track = shouldTrackView ? 1 : 0;

    if (storeSlug) {
      // Prefer store-scoped endpoints that include variants.
      if (isNumericId) {
        const r = await fetch(`/api/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(identifier)}`);
        if (r.ok) return r.json();
      }
      const r = await fetch(`/api/store/${encodeURIComponent(storeSlug)}/${encodeURIComponent(identifier)}?track_view=${track}`);
      if (r.ok) {
        const data = await r.json();
        return data?.product || data;
      }
    }

    const r = await fetch(`/api/product/${encodeURIComponent(identifier)}`);
    if (!r.ok) throw new Error('Failed to fetch product');
    return r.json();
  };

  // Fetch product - first check database checkout session, then localStorage, then API
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id || slug],
    queryFn: async () => {
      // Get session ID from URL if available
      const sessionId = new URLSearchParams(window.location.search).get('session');
      
      // Try database checkout session first
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
      
      // Fallback to localStorage (for backward compatibility)
      const identifier = String(id || slug || '');
      const cachedProduct = identifier ? localStorage.getItem(`product_${identifier}`) : null;
      if (cachedProduct) {
        const parsed = safeJsonParse<any>(cachedProduct, null);
        if (parsed) {
          // UI-first: show cached immediately, refresh in background.
          if (identifier) {
            void (async () => {
              try {
                const fresh = await fetchFreshProduct(identifier, true);
                cacheProduct(identifier, fresh);
              } catch {
                // ignore
              }
            })();
          }
          return parsed;
        }
      }
      
      // Final fallback to API
      if (!identifier) throw new Error('Missing product identifier');
      const fresh = await fetchFreshProduct(identifier, true);
      cacheProduct(identifier, fresh);
      return fresh;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Track ViewContent event when product loads
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

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isLoading) {
    return (
      <div className={`min-h-screen ${style.bg} flex items-center justify-center`}>
        <div className={`text-center ${style.text}`}>{t('loading')}</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`min-h-screen ${style.bg} flex items-center justify-center`}>
        <div className={`text-center ${style.text}`}>{t('storefront.productNotFoundTitle')}</div>
      </div>
    );
  }

  const productImage = product.images?.[0] || 'https://via.placeholder.com/500';
  const productPrice = product.price || 0;
  const productName = product.title || product.name || t('storefront.productDefaultName');
  const productDesc = product.description || t('storefront.productDefaultDesc');

  return (
    <>
      {storeSlug && <PixelScripts storeSlug={storeSlug} />}
      <div className={`min-h-screen ${style.bg} ${style.text} transition-colors`}>
        {/* Header */}
        <div className={`border-b ${style.border} sticky top-0 z-40 bg-opacity-95 backdrop-blur`}>
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded hover:${style.bg === 'bg-black' ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold flex-1 text-center">{settings.store_name || t('productDetail.storeFallback')}</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
            {/* Image Section - allow taller sales images (no fixed square crop) */}
            <div className="flex items-center justify-center">
              <div className={`relative w-full rounded-lg border bg-gray-100`} style={{ borderColor: accentColor }}>
                <div style={{ maxHeight: isMobile ? '60vh' : '80vh', overflow: 'auto', cursor: 'pointer' }} onClick={() => setShowFullImage(true)}>
                  <img
                    src={productImage}
                    alt={productName}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>

                {/* Mobile: wishlist button */}
                <button
                  onClick={() => setWishlist(!wishlist)}
                  className={`absolute top-4 right-4 p-2 rounded-full ${
                    wishlist ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${wishlist ? 'fill-current' : ''}`} />
                </button>

                {/* Mobile: quick view */}
                {isMobile && (
                  <button
                    onClick={() => setShowFullImage(true)}
                    className="absolute left-4 bottom-4 bg-white/90 text-gray-900 px-3 py-2 rounded-lg font-semibold shadow"
                  >
                    {t('productDetail.viewFullImage') || 'View full'}
                  </button>
                )}

                {/* Desktop/mobile: always show expand control (stays visible)") */}
                <button
                  onClick={() => setShowFullImage(true)}
                  className="absolute right-4 bottom-4 bg-black text-white px-3 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 hover:opacity-95"
                  title={t('productDetail.viewFullImage') || 'View full'}
                >
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('productDetail.expand') || 'Expand'}</span>
                </button>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-3 md:space-y-4">
              {/* Product Info */}
              <div>
                <div
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3"
                  style={{ backgroundColor: accentColor, color: style.bg === 'bg-black' ? '#000' : '#fff' }}
                >
                  {product.category || t('storefront.productDefaultName')}
                </div>
                <h1 className="text-2xl md:text-xl md:text-2xl font-bold mb-2">{productName}</h1>
                <p className="text-gray-500 text-lg mb-4">{product.material || product.realm || product.category || t('productDetail.premium')}</p>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} style={{ color: accentColor }}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">{t('productDetail.reviewsCount', { count: 128 })}</span>
                </div>

                {/* Product Statistics */}
                <div className={`grid grid-cols-3 gap-3 p-4 rounded-lg mb-4 border ${style.border}`}
                     style={{ backgroundColor: accentColor + '10', borderColor: accentColor + '50' }}>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t('productDetail.stats.views')}</div>
                    <div className="text-2xl font-bold" style={{ color: accentColor }}>
                      {Math.floor(Math.random() * 5000) + 100}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t('productDetail.stats.sold')}</div>
                    <div className="text-2xl font-bold" style={{ color: accentColor }}>
                      {Math.floor(Math.random() * 500) + 10}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t('productDetail.stats.popularity')}</div>
                    <div className="text-2xl font-bold" style={{ color: accentColor }}>
                      {(Math.random() * 40 + 60).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Section */}
              <div className="border-t border-b border-gray-300 py-6" style={{ borderColor: accentColor, borderWidth: '1px' }}>
                <div className="text-xl md:text-2xl font-bold" style={{ color: accentColor }}>
                  {productPrice} DZD
                </div>
                <p className="text-sm text-gray-500 mt-2">{t('productDetail.inclusiveTaxes')}</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t('productDetail.descriptionTitle')}</h3>
                <p className="text-gray-600 leading-relaxed">{productDesc}</p>
              </div>

              {/* Stock Status */}
              {product && (
                <div className="space-y-2">
                  {product.stock_quantity > 0 ? (
                    <p className="text-green-600 font-semibold">{t('productDetail.inStock', { count: product.stock_quantity })}</p>
                  ) : (
                    <p className="text-red-600 font-semibold">{t('productDetail.outOfStock')}</p>
                  )}
                </div>
              )}

              {/* Quantity Selector */}
              {product && product.stock_quantity > 0 && (
                <div className="space-y-3">
                  <label className="block font-semibold">{t('productDetail.quantity')}</label>
                  <div className="flex items-center gap-4 w-max">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className={`p-2 rounded border ${style.border}`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      className={`p-2 rounded border ${style.border}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => {
                    const identifier = String(id || slug || '');
                    if (identifier && product) {
                      cacheProduct(identifier, product);
                      void (async () => {
                        try {
                          const fresh = await fetchFreshProduct(identifier, false);
                          cacheProduct(identifier, fresh);
                        } catch {
                          // ignore
                        }
                      })();
                    }
                    navigate(`/checkout/${id || slug}?quantity=${quantity}`);
                  }}
                  disabled={!product || product.stock_quantity === 0}
                  className={`w-full py-4 rounded-lg font-bold text-lg ${
                    product && product.stock_quantity > 0
                      ? style.button
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  } transition-colors`}
                >
                  {product && product.stock_quantity === 0 ? t('productDetail.outOfStock') : t('productDetail.buyNow')}
                </button>
              </div>

              {/* Share */}
              <button
                className="flex items-center gap-2 w-full justify-center py-2 rounded-lg hover:bg-gray-100"
                style={{ color: accentColor }}
              >
                <Share2 className="w-4 h-4" />
                {t('productDetail.shareProduct')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen image viewer (mobile) */}
      {showFullImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-2 right-2 bg-white/90 text-gray-900 rounded-full p-2 z-60"
            >
              ✕
            </button>
            <img src={productImage} alt={productName} style={{ maxWidth: '100%', maxHeight: '100vh', display: 'block' }} />
          </div>
        </div>
      )}

      {/* Fixed Expand button (guaranteed visible) */}
      <button
        onClick={() => setShowFullImage(true)}
        className="fixed left-6 bottom-6 bg-blue-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition"
        title={t('productDetail.expand') || 'Expand'}
        style={{ zIndex: 9999 }}
      >
        <Maximize2 className="w-5 h-5" />
      </button>

      {/* AI Product Assistant Bubble */}
      <AIProductBubble product={product} style={style} />

    </>
  );
}

// ─── AI Product Q&A Bubble ────────────────────────────────────────────────────
function AIProductBubble({ product, style }: { product: any; style: any }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'ai', text: `I can answer questions about "${product.title || product.name}". Ask me anything!` }]);
    }
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length]);

  const safeProduct = {
    title: product.title || product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    variants: Array.isArray(product.variants)
      ? product.variants.map((v: any) => ({ name: v.name, price: v.price }))
      : [],
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const r = await fetch('/api/ai/storefront/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, product: safeProduct }),
      });
      const data = await r.json();
      setMessages((prev) => [...prev, { role: 'ai', text: data?.answer || 'Sorry, I could not get an answer right now.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Unable to connect. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-6 bottom-6 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
        style={{ background: style.accent || '#6366f1', zIndex: 9998 }}
        title="Ask AI about this product"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed right-6 bottom-24 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden border"
          style={{ zIndex: 9997, maxHeight: '400px', background: style.bg === 'bg-black' ? '#1e1e2e' : '#fff', borderColor: style.border?.replace('border-', '') || '#e2e8f0' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: style.accent || '#6366f1' }}>
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">AI Product Assistant</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '270px' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] text-sm px-3 py-2 rounded-xl leading-relaxed`}
                  style={
                    m.role === 'user'
                      ? { background: style.accent || '#6366f1', color: '#fff' }
                      : { background: style.bg === 'bg-black' ? '#2d2d3f' : '#f1f5f9', color: style.bg === 'bg-black' ? '#e2e8f0' : '#1e293b' }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl" style={{ background: style.bg === 'bg-black' ? '#2d2d3f' : '#f1f5f9' }}>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex items-center gap-2 p-2 border-t" style={{ borderColor: style.bg === 'bg-black' ? '#2d2d3f' : '#e2e8f0' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none border disabled:opacity-50"
              style={{
                background: style.bg === 'bg-black' ? '#2d2d3f' : '#f8fafc',
                color: style.bg === 'bg-black' ? '#e2e8f0' : '#1e293b',
                borderColor: style.bg === 'bg-black' ? '#3d3d5f' : '#e2e8f0',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-1.5 rounded-lg disabled:opacity-40 transition"
              style={{ background: style.accent || '#6366f1' }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

