import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import {
  ShoppingBag,
  Star,
  Truck,
  ShieldCheck,
  Package,
  CheckCircle2,
  Phone,
  User,
  MapPin,
  Clock,
  ArrowRight,
  X,
  Check,
  Home,
  Building2,
  ChevronDown
} from 'lucide-react';
import LazyVideo from '@/components/storefront/LazyVideo';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function PrimoTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  onProductView,
  initialProductSlug,
  navigate,
}: TemplateProps) {
  // ── Settings Wiring ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#f39c12';
  const bgColor = settings?.template_bg_color || settings?.primo_bg_color || '#fafafa';
  const primaryColor = settings?.primary_color || '#0f172a';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'تسوق منتجاتنا';
  const heroSubtitle = settings?.template_hero_subtitle || 'أفضل المنتجات بأسعار تنافسية';
  const buttonText = settings?.template_button_text || 'تأكيد الطلب الآن';
  const storeName = settings?.store_name || 'المتجر';

  // ── Dark/Light detection from bgColor ──
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);

  // Header / surface color from dedicated setting
  const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');

  const isHeaderDark = useMemo(() => {
    const hex = headerColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [headerColor]);

  // Helper: check if a color is light enough to read on dark backgrounds
  const isLight = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
  };

  // Derived theme colors — primaryColor is used on dark bg only if it's light enough to be readable
  const textColor = isDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
  const surfaceColor = headerColor;
  const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e2e8f0';

  // ── Main Product ──
  const [activeMainProduct, setActiveMainProduct] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'catalog' | 'product'>('catalog');
  const [cardImageIdx, setCardImageIdx] = useState<Record<number, number>>({});
  const baseMainProduct = useMemo(() => {
    if (initialProductSlug) {
      const bySlug = products?.find((p: any) => p.slug === initialProductSlug);
      if (bySlug) return bySlug;
    }
    const mainId = settings?.dzp_main_product_id;
    return mainId
      ? products?.find((p: any) => String(p.id) === String(mainId))
      : products?.[0];
  }, [products, settings?.dzp_main_product_id, initialProductSlug]);
  const mainProduct = activeMainProduct ?? baseMainProduct;

  // Sync viewMode with URL — reset to catalog when product slug is removed
  useEffect(() => {
    if (initialProductSlug) { setViewMode('product'); }
    else { setViewMode('catalog'); setActiveMainProduct(null); }
  }, [initialProductSlug]);

  // ── Other products ──
  const otherProducts = useMemo(() => {
    if (!products) return [];
    return mainProduct ? products.filter(p => p.id !== mainProduct.id) : products;
  }, [products, mainProduct]);

const openProduct = (product: any) => {
  setActiveMainProduct(product);
  setViewMode('product');
  setSelectedMainImage(0);
  onProductView?.(product);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (product?.slug && navigate) navigate(buildStoreUrl(storeSlug, product.slug));
};

const goBackToCatalog = () => {
  setViewMode('catalog');
  setActiveMainProduct(null);
  setSelectedMainImage(0);
  if (navigate) navigate(buildStoreUrl(storeSlug));
};

  const mainImages = mainProduct?.images?.length ? mainProduct.images : ['/placeholder.png'];

  // ── Video ──
  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  // ── Delivery System ──
  const { wilayas, defaultPrice } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? (selectedWilaya.homePrice || defaultPrice) : ((selectedWilaya.deskPrice ?? selectedWilaya.homePrice) || defaultPrice)) : 0;

  // Offers system
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  // ── Variant & pricing ──
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
  const productPrice = variantPrice ?? mainProduct?.price ?? 0;
  const [quantity, setQuantity] = useState(1);
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : productPrice * quantity;
  const total = productTotal + deliveryFee;

  // ── Order State ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  // ── Image / FAQ state ──
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarouselTo = (i: number) => {
    const container = carouselRef.current;
    if (!container) return;
    const target = container.children[i] as HTMLElement | undefined;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const childWidth = el.children[0]?.getBoundingClientRect().width || 1;
    const idx = Math.round(el.scrollLeft / childWidth);
    if (videoEmbed) {
      if (idx === 0) { setShowVideo(true); setSelectedMainImage(0); }
      else { setShowVideo(false); setSelectedMainImage(idx - 1); }
    } else {
      setSelectedMainImage(idx);
    }
  };
  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.setAttribute('data-setting-key', key);
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // ── Scroll-aware Header ──
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      const sy = window.scrollY;
      const dy = sy - lastScrollY.current;
      if (Math.abs(dy) > 10) {
        setShowHeader(dy < 0);
        lastScrollY.current = sy;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId || !mainProduct) {
      setOrderError('يرجى ملء جميع الحقول');
      return;
    }
    if (!isValidAlgerianPhone(customerPhone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      return;
    }
    setIsSubmitting(true);
    try {
      const address = [selectedWilaya?.labelAR || '', communeDisplayName(getAlgeriaCommuneById(customerCommune)!) || customerCommune, customerAddress].filter(Boolean).join(' - ');
      const isOfferItem = selectedOffer && mainProduct.id === mainProduct.id;
      const itemPrice = selectedVariant?.price ?? mainProduct.price;
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant?.id ? { variant_id: selectedVariant.id } : {}),
          quantity: quantity,
          ...(isOfferItem ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: isOfferItem ? selectedOffer.bundle_price : itemPrice * quantity,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          customer_notes: customerNotes,
          shipping_wilaya_id: selectedWilayaId,
          shipping_commune_id: Number(customerCommune) || undefined,
          product_name: mainProduct.title || mainProduct.name || '',
          ...getFraudData(),
        }),
      });
      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      if (!res.ok) {
        let errMsg: string;
        if (data.fields) {
          const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
          errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
        } else {
          errMsg = data.error || 'حدث خطأ أثناء إرسال الطلب';
        }
        setOrderError(errMsg);
        setIsSubmitting(false);
        return;
      }
      setOrderSuccess(true);
      trackAllPixels(PixelEvents.PURCHASE, {
        content_name: mainProduct?.title || mainProduct?.name || '',
        content_ids: mainProduct?.id ? [mainProduct.id] : [],
        content_type: 'product',
        value: productTotal,
        currency: settings?.currency_code || 'DZD',
        num_items: isOfferItem ? selectedOffer.quantity : quantity,
        order_id: data?.order?.id || null,
      });
    } catch {
      if (!orderError) setOrderError('حدث خطأ في الاتصال. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // ── Google Font ──
  useEffect(() => {
    if (!document.getElementById('cairo-font')) {
      const link = document.createElement('link');
      link.id = 'cairo-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // ══════════════════════════════════════
  // ORDER SUCCESS SCREEN
  // ══════════════════════════════════════
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Cairo', sans-serif" }} dir="rtl">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <Check size={32} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: surfaceMuted }}>
            <div className="flex justify-between text-sm">
              <span>{mainProduct.title} × {quantity}</span>
              <span className="font-bold">{Math.round(productTotal).toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: textMuted }}>التوصيل</span>
              <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${currency}`}</span>
            </div>
            <div style={{ height: '1px', backgroundColor: surfaceBorderColor }} />
            <div className="flex justify-between font-black">
              <span>المجموع</span>
              <span style={{ color: accentColor }}>{Math.round(total).toLocaleString()} {currency}</span>
            </div>
          </div>
          <button
            onClick={() => { setOrderSuccess(false); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }}
            className="px-6 py-2 rounded-lg text-white font-bold"
            style={{ backgroundColor: accentColor }}
          >
            تسوق مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // MAIN TEMPLATE RENDER
  // ══════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Cairo', sans-serif" }} dir="rtl">

      {/* ── TOP BANNER ── */}
      <div className="py-2 text-center text-xs font-bold tracking-widest" style={{ backgroundColor: isDark ? '#000000' : '#111111', color: '#ffffff' }}>
        <span
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('primo_banner_text')}
        >
          {settings?.primo_banner_text || 'شحن سريع لجميع الولايات - الدفع عند الاستلام'}
        </span>
      </div>

      {/* ── HEADER / NAV ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md transition-transform duration-300" style={{ backgroundColor: surfaceColor + 'cc', borderBottom: `1px solid ${surfaceBorderColor}`, transform: showHeader ? 'translateY(0)' : 'translateY(-100%)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {viewMode === 'product' && (
              <button
                onClick={goBackToCatalog}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                style={{ color: surfaceTextColor }}
                aria-label="عودة إلى المتجر"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15,18 9,12 15,6" />
                </svg>
              </button>
            )}
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-full object-cover" loading="lazy" decoding="async" width="32" height="32" style={{ contentVisibility: 'auto' }} />
            ) : (
              <div onClick={goBackToCatalog} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer" style={{ backgroundColor: accentColor }}>
                {storeName.charAt(0)}
              </div>
            )}
            <h1
              className="text-xl font-black tracking-tighter cursor-pointer"
              style={{ color: surfaceTextColor }}
              onClick={goBackToCatalog}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('store_name')}
            >
              {storeName}
            </h1>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-bold" style={{ color: surfaceTextMuted }}>
            <a href="#" className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = surfaceTextMuted)}>الرئيسية</a>
            <a href="#" className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = surfaceTextMuted)}>منتجاتنا</a>
          </div>
          <div className="flex items-center gap-4">
          </div>
        </div>
      </header>

      {/* ── canManage: empty products placeholder ── */}
      {canManage && (!products || products.length === 0) && (
        <div className="py-20 text-center opacity-50">
          <ShoppingBag className="mx-auto mb-4" size={48} style={{ color: textMuted }} />
          <p style={{ color: textMuted }} className="text-lg">أضف منتجات من لوحة التحكم لعرضها هنا</p>
        </div>
      )}

      {/* ══════════════════════════════════════
          CATALOG VIEW
          ══════════════════════════════════════ */}
      {viewMode === 'catalog' && products && products.length > 0 && (
        <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg md:text-xl font-bold" style={{ color: textColor }}>
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>{heroTitle}</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>{products.length} منتج متوفر</p>
            </div>
          </div>

          {/* Best Sellers Horizontal Scroll */}
          {products.filter(p => p.views > 100).length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: textColor }}>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
                الأكثر طلباً
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {products.filter(p => p.views > 100).slice(0, 8).map(product => {
                  const discount = product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
                  return (
                    <div key={product.id} className="flex-shrink-0 w-40 cursor-pointer rounded-xl overflow-hidden transition-all hover:shadow-lg" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }} onClick={() => openProduct(product)}>
                  <div className="relative" style={{ aspectRatio: '10 / 17', backgroundColor: surfaceMuted }}>
                        <img src={product.images?.[0] || '/placeholder.png'} alt={product.title} loading="lazy" decoding="async" className="w-full h-full object-contain" style={{ backgroundColor: '#fff' }} />
                        {discount > 0 && (
                          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
                            -{discount}%
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-semibold truncate" style={{ color: surfaceTextColor }}>{product.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-extrabold" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()}</span>
                          <span className="text-[10px]" style={{ color: textMuted }}>{currency}</span>
                          {discount > 0 && <span className="text-[9px] line-through mr-auto" style={{ color: textMuted }}>{Math.round(product.original_price).toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map(product => {
              const discount = product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
              const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
              return (
                <div
                  key={product.id}
                  className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                  style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}
                  onClick={() => openProduct(product)}
                >
                  {(() => {
                    const currentIdx = cardImageIdx[product.id] ?? 0;
                    const imgCount = product.images?.length || 0;
                    return (
                      <div className="relative" style={{ aspectRatio: '10 / 17', backgroundColor: surfaceMuted }}>
                    {(product as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                      ? <LazyVideo src={(product as any).metadata.video_url} poster={product.images?.[currentIdx] || '/placeholder.png'}
                          onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                          className="w-full h-full object-cover" />
                      : (product as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                        ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                        : <img key={currentIdx} src={product.images?.[currentIdx] || '/placeholder.png'} alt={product.title} loading="lazy" className="w-full h-full object-contain" style={{ backgroundColor: '#fff', animation: 'swipeIn 0.6s ease' }} />
                    }
                    {discount > 0 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
                        -{discount}%
                      </span>
                    )}
                    {isLowStock && (
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#dc2626cc', color: '#fff' }}>
                        {product.stock_quantity} قطع متبقية
                      </span>
                    )}
                    {imgCount > 1 && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setCardImageIdx(prev => ({ ...prev, [product.id]: (currentIdx - 1 + imgCount) % imgCount })); }} className="absolute left-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"/>
                          </svg>
                        </button>
                        <button onClick={e => { e.stopPropagation(); setCardImageIdx(prev => ({ ...prev, [product.id]: (currentIdx + 1) % imgCount })); }} className="absolute right-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                    );
                  })()}
                  <div className="p-2.5">
                    <h3 className="text-xs font-semibold leading-snug mb-1.5 line-clamp-2 text-right" style={{ color: surfaceTextColor }}>
                      {product.title}
                    </h3>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm" style={{ color: accentColor }}>
                          {Math.round(product.price ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[10px]" style={{ color: textMuted }}>{currency}</span>
                        {discount > 0 && (
                          <span className="text-[10px] line-through mr-auto" style={{ color: textMuted }}>
                            {Math.round(product.original_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {viewMode === 'product' && mainProduct && (
        <main className="max-w-7xl mx-auto px-4 py-4 lg:py-6 pb-24 md:pb-6">

          {/* ── SPLIT LAYOUT: Images LEFT, Form RIGHT ── */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

            {/* LEFT: Image Gallery */}
            <div className="w-full lg:w-[48%] flex flex-col gap-3 lg:self-stretch">
              {/* Main display: video or image */}
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/5] lg:aspect-auto lg:flex-1 min-h-[300px] lg:max-h-[70vh]" style={{ backgroundColor: surfaceMuted }}>
                <div ref={carouselRef} className="flex h-full" style={{ overflowX: 'scroll', scrollSnapType: 'x mandatory' }} onScroll={handleCarouselScroll}>
                  {videoEmbed && (
                    <div className="h-full shrink-0" style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}>
                      {videoEmbed.type === 'youtube' ? (
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                      ) : videoEmbed.type === 'video' ? (
                        <video className="w-full h-full object-contain" src={videoEmbed.url} autoPlay muted loop playsInline preload="metadata" />
                      ) : (
                        <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                      )}
                    </div>
                  )}
                  {mainImages.length > 0 ? mainImages.map((img, i) => (
                    <img key={i} src={img} alt={mainProduct.title}
                      className="w-full h-full object-contain shrink-0 cursor-pointer"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}
                      onClick={() => setZoomState({ images: mainImages, idx: i })}
                    />
                  )) : (
                    <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', color: textMuted }}>
                      <ShoppingBag size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>
                {mainImages.length > 1 && (
                  <>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnails: video first, then images */}
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {videoEmbed && (
                    <button onClick={() => { setShowVideo(true); scrollCarouselTo(0); }} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${showVideo ? accentColor : 'transparent'}`, backgroundColor: '#000' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                  )}
                  {mainImages.map((img, i) => (
                    <button key={i} onClick={() => { setShowVideo(false); setSelectedMainImage(i); scrollCarouselTo(videoEmbed ? i + 1 : i); }} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden" style={{ border: `2px solid ${!showVideo && selectedMainImage === i ? accentColor : 'transparent'}` }}>
                      <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" style={{ contentVisibility: 'auto' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Info + Order Form */}
            <div className="w-full lg:w-[52%] flex flex-col gap-3">
              {/* Product Info */}
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2" style={{ backgroundColor: accentColor + '15', color: accentColor }}>
                  <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>{heroTitle}</span>
                </span>
                <h2 className="text-2xl font-black mb-1" style={{ color: textColor }}>{mainProduct.title}</h2>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex" style={{ color: accentColor }}>{[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                  <span className="text-xs font-bold" style={{ color: textMuted }}>(156 تقييم)</span>
                </div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-black" style={{ color: accentColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</span>
                  {(mainProduct as any).original_price && <span className="text-base line-through font-bold" style={{ color: textMuted }}>{Math.round((mainProduct as any).original_price ?? 0).toLocaleString()} {currency}</span>}
                </div>
                {mainProduct.description && <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{mainProduct.description}</p>}
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-2">
                {[{ icon: <Truck size={16}/>, label: 'توصيل سريع' }, { icon: <ShieldCheck size={16}/>, label: 'ضمان أصلي' }, { icon: <Package size={16}/>, label: 'الدفع عند الاستلام' }].map((b, i) => (
                  <div key={i} className="text-center p-2 rounded-xl" style={{ backgroundColor: surfaceMuted }}>
                    <span className="mx-auto mb-0.5 flex justify-center" style={{ color: accentColor }}>{b.icon}</span>
                    <p className="text-[9px] font-bold" style={{ color: textColor }}>{b.label}</p>
                  </div>
                ))}
              </div>

              {/* Order Form */}
              <form id="primo-order-form" className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }} onSubmit={handleOrder} noValidate>
                <h3 className="text-sm font-black text-center pb-2" style={{ color: surfaceTextColor, borderBottom: `1px solid ${surfaceBorderColor}` }}>إستمارة الطلب</h3>

                {orderError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center whitespace-pre-line text-start">
                    {orderError}
                  </div>
                )}

                {/* Variants */}
                {mainProduct.variants && mainProduct.variants.length > 0 && (
                  <VariantSelector variants={mainProduct.variants} selected={selectedVariant} onSelect={setSelectedVariant} accentColor={accentColor} currency={currency} basePrice={mainProduct.price} />
                )}

                {offers.length > 0 && (
                  <OfferSelector offers={offers} unitPrice={mainProduct?.price || 0} currency={currency} selectedOfferId={selectedOffer?.offer_id ?? null} onSelect={handleOfferSelect} accentColor={accentColor} textColor={surfaceTextColor} borderColor={surfaceBorderColor} bgColor={surfaceMuted} />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                    <input type="text" placeholder="الاسم الكامل" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg py-2.5 pr-9 pl-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />
                  </div>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                    <input type="tel" placeholder="رقم الهاتف" maxLength={10} value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} className="w-full rounded-lg py-2.5 pr-9 pl-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                    <select value={selectedWilayaId ?? ''} onChange={e => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full rounded-lg py-2.5 pr-9 pl-3 text-sm outline-none font-bold appearance-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }}>
                      <option value="">اختر الولاية</option>
                      {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                    </select>
                  </div>
                  {showCommune && (
                    <div className="relative">
                      <select required disabled={!selectedWilayaId} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} className="w-full rounded-lg py-2.5 pr-9 pl-3 text-sm outline-none font-bold appearance-none disabled:opacity-50" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }}>
                        <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                        {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: surfaceTextMuted }} />
                    </div>
                  )}
                </div>

                {showAddress && <input type="text" placeholder="العنوان" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full rounded-lg py-2.5 px-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />}
                {showNotes && <textarea placeholder="ملاحظات" rows={2} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="w-full rounded-lg py-2.5 px-3 text-sm outline-none font-bold resize-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />}

                {/* Quantity */}
                <div className="pt-2">
                  <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>الكمية</label>
                  <div className="flex items-center justify-between rounded-lg p-1" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, border: `1px solid ${surfaceBorderColor}` }}>
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-md font-bold text-xl flex items-center justify-center" style={{ color: textColor, border: `1px solid ${surfaceBorderColor}`, backgroundColor: surfaceColor }}>−</button>
                    <span className="font-black text-lg" style={{ color: surfaceTextColor }}>{quantity}</span>
                    <button type="button" onClick={() => setQuantity(Math.min(mainProduct?.stock_quantity ?? 999, quantity + 1))} className="w-10 h-10 rounded-md font-bold text-xl flex items-center justify-center" style={{ color: textColor, border: `1px solid ${surfaceBorderColor}`, backgroundColor: surfaceColor }}>+</button>
                  </div>
                </div>

                {/* Delivery Type Buttons */}
                {(showHomeDelivery || showDeskDelivery) && (
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: surfaceTextMuted }}>نوع التوصيل</label>
                    <div className="grid grid-cols-2 gap-3">
                      {showHomeDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : surfaceBorderColor, backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : surfaceColor, color: selectedDeliveryType === 'home' ? accentColor : surfaceTextColor }}>
                          <Home size={16} />
                          <span>التوصيل للمنزل</span>
                        </button>
                      )}
                      {showDeskDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : surfaceBorderColor, backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : surfaceColor, color: selectedDeliveryType === 'desk' ? accentColor : surfaceTextColor }}>
                          <Building2 size={16} />
                          <span>الاستلام من المكتب</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Receipt */}
                <div className="rounded-lg p-2.5 space-y-1.5 text-xs" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : surfaceMuted }}>
                  <div className="flex justify-between font-bold" style={{ color: surfaceTextColor }}>
                    <span>سعر المنتج{selectedOffer ? ` (${selectedOffer.quantity} قطعة)` : ` (${quantity})`}</span>
                    <span>{Math.round(productTotal).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between font-bold" style={{ color: surfaceTextColor }}>
                    <span>التوصيل</span><span>{selectedWilayaId ? `${deliveryFee} ${currency}` : '--'}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm pt-1" style={{ color: accentColor, borderTop: `1px solid ${surfaceBorderColor}` }}>
                    <span>المجموع</span><span>{selectedWilayaId ? `${Math.round(total).toLocaleString()} ${currency}` : '--'}</span>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl font-black text-base text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                  <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_button_text')}>{isSubmitting ? 'جاري المعالجة...' : buttonText}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* ═══════════════════════════════════
              OTHER PRODUCTS GRID
              ═══════════════════════════════════ */}
          {otherProducts.length > 0 && (
            <section className="mt-16">
              <h3 className="text-2xl font-black mb-8" style={{ color: textColor }}>{otherProducts.length} منتجات أخرى</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {otherProducts.map(product => {
                  const swapProduct = () => { setActiveMainProduct(product); setSelectedMainImage(0); setViewMode('product'); onProductView?.(product); window.scrollTo({ top: 0, behavior: 'smooth' }); if (product?.slug && navigate) navigate(buildStoreUrl(storeSlug, product.slug)); };
                  return (
                  <div key={product.id} className="rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
                    {(() => {
                      const otherIdx = cardImageIdx[product.id] ?? 0;
                      const otherImgCount = product.images?.length || 0;
                      return (
                    <div className="overflow-hidden cursor-pointer relative" style={{ aspectRatio: '10 / 17', backgroundColor: '#fff' }} onClick={swapProduct}>
                      <img key={otherIdx}
                        src={product.images?.[otherIdx] || '/placeholder.png'}
                        alt={product.title}
                        loading="lazy"
                        className="w-full h-full object-contain"
                        style={{ backgroundColor: '#fff', animation: 'swipeIn 0.6s ease' }}
                      />
                      {otherImgCount > 1 && (
                        <>
                          <button onClick={e => { e.stopPropagation(); setCardImageIdx(prev => ({ ...prev, [product.id]: (otherIdx - 1 + otherImgCount) % otherImgCount })); }} className="absolute left-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 18 9 12 15 6"/>
                            </svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setCardImageIdx(prev => ({ ...prev, [product.id]: (otherIdx + 1) % otherImgCount })); }} className="absolute right-2 top-1/2 -translate-y-1/2 drop-shadow-md z-10">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                      );
                    })()}
                    <div className="p-3">
                      <h4 className="font-bold mb-1 text-sm line-clamp-1" style={{ color: surfaceTextColor }}>{product.title}</h4>
                      <p className="font-black mb-2" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} {currency}</p>
                      <button
                        onClick={swapProduct}
                        className="w-full py-2 rounded-xl text-white text-xs font-bold transition-all active:scale-95"
                        style={{ backgroundColor: accentColor }}
                      >
                        اطلب هذا المنتج →
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          )}

        </main>
      )}


      {/* ── FOOTER ── */}
      <footer className="py-12 mt-20" style={{ backgroundColor: surfaceColor, borderTop: `1px solid ${surfaceBorderColor}` }}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black mb-4" style={{ color: surfaceTextColor }}>{storeName}</h2>
          <p className="text-sm font-bold mb-8" style={{ color: surfaceTextMuted }}>{heroTitle}</p>
          <div className="flex justify-center gap-6 mb-8">
            <Phone size={20} style={{ color: surfaceTextMuted }} />
            <ShoppingBag size={20} style={{ color: surfaceTextMuted }} />
          </div>
          <p className="text-xs font-bold" style={{ color: surfaceTextMuted }}>© {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
        </div>
      </footer>

      {/* ── Scroll to Top ── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-sm font-bold opacity-70 hover:opacity-100 transition-opacity md:hidden"
        style={{ backgroundColor: accentColor, color: '#fff' }}
      >
        ↑
      </button>

      {/* ── Sticky Mobile Checkout Bar ── */}
      {viewMode === 'product' && !orderSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-3 border-t flex items-center gap-3" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
          <div className="flex-1">
            <p className="font-black text-lg" style={{ color: accentColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</p>
            <p className="text-[10px]" style={{ color: surfaceTextMuted }}>الدفع عند الاستلام</p>
          </div>
          <button
            onClick={() => document.getElementById('primo-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="text-white font-bold px-8 py-3 rounded-xl text-base shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            اطلب الآن
          </button>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setZoomState(null); }}>
            <X size={20} />
          </button>
          {zoomState.images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); const n = (zoomState.idx - 1 + zoomState.images.length) % zoomState.images.length; setZoomState({ ...zoomState, idx: n }); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-bold">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); const n = (zoomState.idx + 1) % zoomState.images.length; setZoomState({ ...zoomState, idx: n }); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-bold">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6" /></svg>
              </button>
            </>
          )}
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}
            onTouchStart={e => { (e.currentTarget as any)._zx = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (!zoomState || zoomState.images.length <= 1) return;
              const dx = (e.currentTarget as any)._zx - e.changedTouches[0].clientX;
              if (Math.abs(dx) < 50) return;
              const n = dx > 0
                ? (zoomState.idx + 1) % zoomState.images.length
                : (zoomState.idx - 1 + zoomState.images.length) % zoomState.images.length;
              setZoomState({ ...zoomState, idx: n });
            }}
          >
            <img key={zoomState.idx} src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded-2xl" />
          </div>
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pt-2 overflow-x-auto justify-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((img, i) => (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110 ring-2 ring-white/30' : 'border-white/20 opacity-50 hover:opacity-80'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" width="56" height="56" style={{ contentVisibility: 'auto' }} />
                </button>
              ))}
            </div>
          )}
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex justify-center gap-1.5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === zoomState.idx ? 20 : 6, height: 6, backgroundColor: i === zoomState.idx ? '#fff' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {zoomState && (
        <style>{`[data-storefront-contact="true"] { display: none !important; }`}</style>
      )}
    </div>
  );
}
