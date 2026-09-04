import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import {
  Search,
  User,
  ShoppingBag,
  Phone,
  MapPin,
  ChevronDown,
  ShoppingCart,
  CheckCircle2,
  Truck,
  Calculator,
  X,
  Check,
  Plus,
  Minus,
  Trash2,
  Home,
  Building2
} from 'lucide-react';
import LazyVideo from '@/components/storefront/LazyVideo';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';

export default function IycoTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  bannerUrl,
  onProductView,
  initialProductSlug,
  navigate,
}: TemplateProps) {
  // ── Settings Wiring (correct priority) ──
  // propPrimaryColor is computed by the editor from raw settings (survives template preview override)
  // settings?.primary_color also survives because it's not in TEMPLATE_SETTING_KEYS
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#16a34a';
  const bgColor = settings?.template_bg_color || settings?.iyco_bg_color || '#ffffff';
  const primaryColor = settings?.primary_color || '#0f172a';
  const rawBgImage = settings?.template_bg_image || '';
  const bgImageCss = rawBgImage
    ? (rawBgImage.startsWith('linear') || rawBgImage.startsWith('radial') || rawBgImage.startsWith('url(')
      ? rawBgImage
      : `url(${rawBgImage})`)
    : '';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'أحسن جودة في السوق مع ضمان بعد الشراء';
  const heroSubtitle = settings?.template_hero_subtitle || 'التسليم ما بين 24 ساعة إلى يومين ! سيتم مكالمة لتأكيد الطلب! الدفع عند الاستلام';
  const buttonText = settings?.template_button_text || 'إشتري الآن';

  const storeName = settings?.store_name || 'المتجر';

  // ── Dark/Light mode detection from bgColor ──
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);

  // Header / surface color from dedicated setting
  const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');

  // Detect if header is dark to adapt text on it
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
  const surfaceMuted = isDark ? '#0f172a' : '#f5f5f5';
  const borderColor = isDark ? '#475569' : '#e5e7eb';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';

  // ── Main Product ──
  const [activeMainProduct, setActiveMainProduct] = useState<any>(null);
  const baseMainProduct = useMemo(() => {
    if (initialProductSlug) {
      const bySlug = products?.find((p: any) => p.slug === initialProductSlug || String(p.id) === initialProductSlug);
      if (bySlug) return bySlug;
    }
    if (activeMainProduct) return activeMainProduct;
    return null;
  }, [products, initialProductSlug, activeMainProduct]);
  // Clear activeMainProduct when navigating back to store grid
  useEffect(() => { if (!initialProductSlug) setActiveMainProduct(null); }, [initialProductSlug]);
  const mainProduct = activeMainProduct ?? baseMainProduct;

  // ── Delivery System ──
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>(
    settings?.delivery_type_home !== false ? 'home' : 'desk'
  );
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;


  // Offers system
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  // ── Cart System ──
  const [cart, setCart] = useState<{ id: number; title: string; price: number; image: string; qty: number; variant_id?: number; variant_name?: string }[]>([]);

  const addToCart = (product: any, variant?: SelectedVariant | null) => {
    onProductView?.(product);
    const vid = variant?.id;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.variant_id === vid);
      if (existing) return prev.map(item =>
        (item.id === product.id && item.variant_id === vid) ? { ...item, qty: item.qty + 1 } : item
      );
      return [...prev, {
        id: product.id,
        title: product.title || product.name || '',
        price: variant?.price ?? product.price,
        image: product.images?.[0] || '/placeholder.png',
        qty: 1,
        variant_id: vid,
        variant_name: variant ? (variant.variant_name || [variant.color, variant.size, variant.size2].filter(Boolean).join(' / ')) : undefined,
      }];
    });
    trackAllPixels(PixelEvents.ADD_TO_CART, {
      content_ids: [product.id],
      content_name: product.title || product.name || 'منتج',
      value: variant?.price ?? product.price,
      currency: 'DZD',
      content_type: 'product',
    });
  };

  const removeFromCart = (productId: number, vid?: number) => {
    setCart(prev => prev.filter(item => !(item.id === productId && item.variant_id === vid)));
  };

  const updateQty = (productId: number, delta: number, vid?: number) => {
    setCart(prev => prev.map(item => {
      if (!(item.id === productId && item.variant_id === vid)) return item;
      const newQty = item.qty + delta;
      return newQty < 1 ? item : { ...item, qty: newQty };
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // ── Order Form State ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const effectiveSubtotal = selectedOffer ? selectedOffer.bundle_price * quantity : subtotal;
  const total = effectiveSubtotal + deliveryFee;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState<Record<number, boolean>>({});
  const [thumbLoaded, setThumbLoaded] = useState<Record<number, boolean>>({});

  const optImg = (url: string, size: 'small' | 'medium' | 'large' = 'medium') => {
    if (!url || !url.includes('cloudinary.com') || url.includes('?tr=')) return url;
    const w = size === 'small' ? 100 : size === 'large' ? 800 : 400;
    return `${url}?tr=w_${w},q_auto,f_auto,c_limit`;
  };

  // ── Scroll-aware Header ── (removed — header always sticky)

  // ── Product Detail State ──
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [selectedSize, setSelectedSize] = useState('');

  const mainImages = mainProduct?.images?.length ? mainProduct.images : ['/placeholder.png'];
  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  const totalSlides = (videoEmbed ? 1 : 0) + mainImages.length;
  const activeSlide = showVideo ? 0 : (videoEmbed ? selectedMainImage + 1 : selectedMainImage);

  const goToSlide = (slideIdx: number) => {
    const idx = (slideIdx + totalSlides) % totalSlides;
    if (!carouselRef.current) return;
    const child = carouselRef.current.children[idx] as HTMLElement | undefined;
    if (child) {
      carouselRef.current.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
    }
    if (videoEmbed && idx === 0) {
      setShowVideo(true);
      setSelectedMainImage(0);
    } else {
      setShowVideo(false);
      setSelectedMainImage(videoEmbed ? idx - 1 : idx);
    }
  };

  // Sync state from native scroll position
  const handleScroll = () => {
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

  // Reset main image when mainProduct changes
  useEffect(() => {
    setSelectedMainImage(0);
    setShowVideo(!!videoEmbed);
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [mainProduct?.id]);

  // Inject Google Fonts (Tajawal + Poppins + Open Sans)
  useEffect(() => {
    const doc = document;
    if (!doc.getElementById('tajawal-font')) {
      const link = doc.createElement('link');
      link.id = 'tajawal-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap';
      link.rel = 'stylesheet';
      doc.head.appendChild(link);
    }
    if (!doc.getElementById('poppins-font')) {
      const link2 = doc.createElement('link');
      link2.id = 'poppins-font';
      link2.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
      link2.rel = 'stylesheet';
      doc.head.appendChild(link2);
    }
    if (!doc.getElementById('opensans-font')) {
      const link3 = doc.createElement('link');
      link3.id = 'opensans-font';
      link3.href = 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap';
      link3.rel = 'stylesheet';
      doc.head.appendChild(link3);
    }
  }, []);

  // Preload first product image to cut LCP resource load delay
  useEffect(() => {
    const url = mainImages?.[0];
    if (!url || url === '/placeholder.png') return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [mainImages?.[0]]);

  // Auto-add main product to cart when form submitted if cart is empty
  const ensureMainProductInCart = () => {
    if (cart.length === 0 && mainProduct) {
      addToCart(mainProduct);
    }
  };

  // ── Order Submission ──
  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId) {
      setOrderError('يرجى ملء جميع الحقول');
      return;
    }
    if (!isValidAlgerianPhone(customerPhone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      return;
    }

    if (!mainProduct) {
      setOrderError('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    const orderCart = [{
      id: mainProduct.id,
      price: ((selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null) ?? mainProduct.price,
      qty: quantity,
      variant_id: selectedVariant?.id ?? null,
    }];

    try {
      setIsSubmitting(true);
      for (const item of orderCart as any[]) {
        const isOfferItem = selectedOffer && item.id === mainProduct?.id;
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            quantity: item.qty,
            ...(isOfferItem ? { offer_id: selectedOffer.offer_id } : {}),
            total_price: isOfferItem ? selectedOffer.bundle_price * item.qty : item.price * item.qty,
            delivery_fee: deliveryFee,
            delivery_type: selectedDeliveryType,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: [selectedWilaya?.labelAR || '', communeDisplayName(getAlgeriaCommuneById(customerCommune)!) || customerCommune, customerAddress].filter(Boolean).join(' - '),
            customer_notes: customerNotes,
            shipping_wilaya_id: selectedWilayaId,
            shipping_commune_id: Number(customerCommune) || undefined,
            product_name: item.name || item.title || mainProduct?.title || mainProduct?.name || '',
            ...getFraudData(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setLastOrderId(data.order?.id || null);
          setLastTelegramUrl(data.telegramStartUrl || null);
          let errMsg: string;
          if (data.fields) {
            const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
            errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
          } else {
            errMsg = data.error || 'خطأ في الطلب';
          }
          setOrderError(errMsg);
          return;
        }
        const data = await res.json();
        setLastOrderId(data.order?.id || null);
        setLastTelegramUrl(data.telegramStartUrl || null);
      }
      setOrderSuccess(true);
      const totalQty = (orderCart as any[]).reduce((sum: number, i: any) => sum + (i.qty || 1), 0);
      const totalValue = (orderCart as any[]).reduce((sum: number, i: any) => sum + (i.price || 0) * (i.qty || 1), 0);
      trackAllPixels(PixelEvents.PURCHASE, {
        content_name: mainProduct?.title || mainProduct?.name || '',
        content_ids: mainProduct?.id ? [mainProduct.id] : [],
        content_type: 'product',
        value: totalValue,
        currency: settings?.currency_code || 'DZD',
        num_items: totalQty,
        order_id: lastOrderId || null,
      });
    } catch {
      setOrderError('خطأ في الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── ContentEditable ──
  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.setAttribute('data-setting-key', key);
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // ── Other products (everything except main) ──
  const otherProducts = useMemo(() => {
    if (!products) return [];
    return mainProduct ? products.filter(p => p.id !== mainProduct.id) : products;
  }, [products, mainProduct]);

  // ══════════════════════════════════════
  // ORDER SUCCESS SCREEN
  // ══════════════════════════════════════
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <Check size={32} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: surfaceMuted }}>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between" style={{ color: textColor }}>
                <span>{item.title} × {item.qty}</span>
                <span>{Math.round((item.price ?? 0) * (item.qty ?? 1)).toLocaleString()} {currency}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm" style={{ color: textMuted }}>
              <span>التوصيل</span>
              <span>{Math.round(deliveryFee).toLocaleString()} {currency}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold" style={{ borderColor, color: textColor }}>
              <span>المجموع</span>
              <span style={{ color: accentColor }}>{Math.round(total).toLocaleString()} {currency}</span>
            </div>
          </div>
          <button
            onClick={() => { setOrderSuccess(false); setCart([]); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }}
            className="px-6 py-2 rounded-lg text-white"
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
    <div className="min-h-screen" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">

      {/* ── TOP NAVIGATION ── */}
      <nav className="z-50" style={{ backgroundColor: bgImageCss ? 'transparent' : surfaceColor, backdropFilter: bgImageCss ? 'blur(12px)' : 'none', WebkitBackdropFilter: bgImageCss ? 'blur(12px)' : 'none', borderBottom: `1px solid ${borderColor}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-center relative">
          {/* Center: Logo / Store Name */}
          <div
            className="flex items-center justify-center cursor-pointer"
            onClick={() => { setActiveMainProduct(null); window.scrollTo({ top: 0, behavior: 'smooth' }); if (navigate) navigate(buildStoreUrl(storeSlug)); }}
          >
            {settings?.store_logo ? (
              <img
                src={settings.store_logo.includes('cloudinary.com') && !settings.store_logo.includes('?tr=') ? `${settings.store_logo}?tr=w_400,q_auto,f_auto,c_limit` : settings.store_logo}
                alt={storeName}
                className="h-[66px] w-auto object-contain"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                width="145"
                height="66"
                style={{ filter: imgLoaded['-1'] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
                onLoad={() => setImgLoaded(prev => ({...prev, '-1': true}))}
              />
            ) : (
              <span
                className="font-bold tracking-wide"
                style={{ color: surfaceTextColor, fontSize: '20px', fontFamily: "'Poppins', sans-serif" }}
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('store_name')}
              >
                {storeName}
              </span>
            )}
          </div>
          {/* Right: Home */}
          <div className="absolute right-4 flex items-center" style={{ color: surfaceTextMuted }}>
            <Home size={20} className="cursor-pointer hover:opacity-70 transition-opacity" onClick={() => { setActiveMainProduct(null); window.scrollTo({ top: 0, behavior: 'smooth' }); if (navigate) navigate(buildStoreUrl(storeSlug)); }} />
          </div>
          {/* Left: Cart */}
          <div className="absolute left-4 flex items-center" style={{ color: surfaceTextMuted }}>
            <ShoppingBag size={20} className="cursor-pointer hover:opacity-70 transition-opacity" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4">

        {/* ── canManage: empty products placeholder ── */}
        {canManage && (!products || products.length === 0) && (
          <div className="py-20 text-center opacity-50">
            <ShoppingBag className="mx-auto mb-4" size={48} style={{ color: textMuted }} />
            <p style={{ color: textMuted }} className="text-lg">أضف منتجات من لوحة التحكم لعرضها هنا</p>
          </div>
        )}

        {/* ── PRODUCT SECTION (SPLIT LAYOUT) ── */}
        {mainProduct && (
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-8 pt-2 lg:pt-6">

            {/* LEFT: Image Gallery */}
            <div className="w-full lg:w-[55%] flex flex-col gap-4 lg:mt-3" key={`gallery-${mainProduct?.id || 'none'}`}>
              <div className="w-full overflow-hidden relative aspect-[3/4.3] lg:aspect-auto lg:h-[95vh]" style={{ backgroundColor: '#ffffff' }}>
                <div ref={carouselRef} className="flex h-full" style={{ overflowX: 'scroll', scrollSnapType: 'x mandatory', direction: 'ltr' }} onScroll={handleScroll}>
                  {videoEmbed && (
                    <div key="video" className="h-full shrink-0" style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                      {videoEmbed.type === 'youtube' ? (
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                      ) : videoEmbed.type === 'video' ? (
                        <video className="w-full h-full object-contain" src={videoEmbed.url} autoPlay muted loop playsInline preload="metadata" poster={mainImages?.[0] || ''} />
                      ) : (
                        <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                      )}
                    </div>
                  )}
                  {mainImages.length > 0 ? mainImages.map((img, i) => {
                    const srcUrl = img.includes('cloudinary.com') && !img.includes('?tr=') ? `${img}?tr=w_800,q_auto,f_auto,c_limit` : img;
                    return (
                    <img key={`${mainProduct?.id}-${i}`} src={srcUrl} alt={mainProduct.title}
                      className="w-full h-full object-contain shrink-0 cursor-pointer"
                      loading={i < 2 ? 'eager' : 'lazy'}
                      fetchpriority={i < 2 ? 'high' : 'low'}
                      decoding="async"
                      width="600"
                      height="600"
                      style={{ flex: '0 0 100%', scrollSnapAlign: 'start', filter: imgLoaded[i] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
                      onLoad={() => setImgLoaded(prev => ({...prev, [i]: true}))}
                      onClick={() => setZoomState({ images: mainImages, idx: i })}
                    />);
                  }) : (
                    <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', color: textMuted }}>
                      <ShoppingBag size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>
                {mainImages.length > 1 && (
                  <>
                    <button onClick={e => { e.stopPropagation(); goToSlide(activeSlide - 1); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold z-10 opacity-70 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}>›</button>
                    <button onClick={e => { e.stopPropagation(); goToSlide(activeSlide + 1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold z-10 opacity-70 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}>‹</button>
                  </>
                )}
              </div>
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 overflow-x-auto justify-center" style={{ scrollbarWidth: 'none' }}>
                  {videoEmbed && (
                    <div onClick={() => goToSlide(0)} className="w-[100px] h-[100px] shrink-0 rounded-lg overflow-hidden border-2 flex items-center justify-center transition-all cursor-pointer" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </div>
                  )}
                  {mainImages.map((img, idx) => {
                    const srcUrl = img.includes('cloudinary.com') && !img.includes('?tr=') ? `${img}?tr=w_100,q_auto,f_auto,c_limit` : img;
                    return (
                    <button key={idx} onClick={() => goToSlide(videoEmbed ? idx + 1 : idx)} className="w-[100px] h-[100px] shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer" style={{ borderColor: !showVideo && selectedMainImage === idx ? accentColor : 'transparent', opacity: !showVideo && selectedMainImage === idx ? 1 : 0.6 }}>
                      <img 
  src={srcUrl} 
  className="w-full h-full object-cover" 
  alt="thumb" 
  loading="lazy"
  decoding="async"
  width="100"
  height="100"
  style={{ contentVisibility: 'auto', filter: thumbLoaded[idx] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
  onLoad={() => setThumbLoaded(prev => ({...prev, [idx]: true}))}
/>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Product Details */}
            <div className="w-full lg:w-[45%] flex flex-col">

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-black mb-3" style={{ color: '#111' }}>{mainProduct.title}</h1>

              {/* Description */}
              {mainProduct.description && (
                <div className="text-lg leading-relaxed mb-4" style={{ color: '#555' }} dangerouslySetInnerHTML={{ __html: mainProduct.description }} />
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-black" style={{ color: '#111' }}>
                  DZD {Math.round(mainProduct.price ?? 0).toLocaleString()}
                </span>
                {mainProduct.original_price && (
                  <span className="text-base line-through" style={{ color: '#999' }}>
                    DZD {Math.round(mainProduct.original_price).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="border-t" style={{ borderColor }}></div>

              {/* Variants */}
              {mainProduct?.variants && mainProduct.variants.length > 0 && (
                <div className="mt-4">
                  <VariantSelector
                    variants={mainProduct.variants}
                    selected={selectedVariant}
                    onSelect={setSelectedVariant}
                    accentColor={accentColor}
                    currency={currency}
                    basePrice={mainProduct.price}
                  />
                </div>
              )}

              {/* Offers */}
              {offers.length > 0 && (
                <div className="mt-4">
                  <OfferSelector
                    offers={offers}
                    unitPrice={mainProduct?.price || 0}
                    currency={currency}
                    selectedOfferId={selectedOffer?.offer_id ?? null}
                    onSelect={handleOfferSelect}
                    accentColor={accentColor}
                    textColor={surfaceTextColor}
                    borderColor={borderColor}
                    bgColor={surfaceMuted}
                    className="space-y-3"
                  />
                </div>
              )}

              {/* Quantity */}
              <div className="mt-4">
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#555' }}>الكمية:</label>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}`, width: 'fit-content' }}>
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center font-bold text-lg" style={{ color: '#555', borderRight: `1px solid ${borderColor}` }}>−</button>
                  <span className="w-12 text-center font-bold text-base" style={{ color: '#111' }}>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min((mainProduct?.stock_quantity != null && mainProduct.stock_quantity > 0) ? mainProduct.stock_quantity : 999, quantity + 1))} className="w-10 h-10 flex items-center justify-center font-bold text-lg" style={{ color: '#555', borderLeft: `1px solid ${borderColor}` }}>+</button>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#333', color: '#fff' }}
                  onClick={() => { addToCart(mainProduct, selectedVariant); setShowCart(true); }}
                >
                  أضف للسلة
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-all active:scale-[0.98]"
                  style={{ borderColor: '#333', backgroundColor: '#fff', color: '#333' }}
                  onClick={() => setShowOrderForm(true)}
                >
                  اطلب الآن
                </button>
              </div>

              {/* Order Form — hidden until clicked */}
              {showOrderForm && (
              <form id="orderForm" className="rounded-2xl p-5 mt-6" style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} onSubmit={handleOrder} noValidate>
                <h3 className="font-bold text-center text-base mb-5 pb-3" style={{ color: '#111', borderBottom: '1px solid #e5e7eb' }}>إستمارة الطلب</h3>

                <div className="space-y-4">
                  {/* Name + Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <input required type="text" placeholder="الاسم الكامل"
                      className="w-full px-5 py-3.5 text-base rounded-xl outline-none transition-all"
                      style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }}
                      value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    <input required type="tel" placeholder="رقم الهاتف" maxLength={10}
                      className="w-full px-5 py-3.5 text-base rounded-xl outline-none transition-all"
                      style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }}
                      value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} />
                  </div>

                  {/* Wilaya + Commune */}
                  <div className="grid grid-cols-2 gap-3">
                    <select required
                      className="w-full px-5 py-3.5 text-base rounded-xl outline-none appearance-none cursor-pointer"
                      style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }}
                      value={selectedWilayaId ?? ''} onChange={e => setSelectedWilayaId(Number(e.target.value) || null)}>
                      <option value="">إختر الولاية</option>
                      {wilayas.map(w => (<option key={w.id} value={w.id}>{w.labelAR}</option>))}
                    </select>
                    {showCommune && (
                      <select required disabled={!selectedWilayaId}
                        className="w-full px-5 py-3.5 text-base rounded-xl outline-none appearance-none disabled:opacity-50"
                        style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }}
                        value={customerCommune} onChange={e => setCustomerCommune(e.target.value)}>
                        <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                        {communes.map((c) => (<option key={c.id} value={c.id}>{communeDisplayName(c)}</option>))}
                      </select>
                    )}
                  </div>

                  {showAddress && <input type="text" placeholder="العنوان" className="w-full px-4 py-3.5 text-base rounded-xl outline-none" style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                  {showNotes && <textarea placeholder="ملاحظات" rows={3} className="w-full px-4 py-3.5 text-base rounded-xl outline-none resize-none" style={{ backgroundColor: '#f9fafb', color: '#111', border: '1px solid #e5e7eb' }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: '#333' }}>الكمية</label>
                    <div className="flex items-center gap-0 rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', width: 'fit-content' }}>
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 flex items-center justify-center font-bold text-lg transition-colors" style={{ color: '#555', backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' }}>−</button>
                      <span className="w-12 text-center font-bold text-base" style={{ color: '#111' }}>{quantity}</span>
                      <button type="button" onClick={() => setQuantity(Math.min((mainProduct?.stock_quantity != null && mainProduct.stock_quantity > 0) ? mainProduct.stock_quantity : 999, quantity + 1))} className="w-11 h-11 flex items-center justify-center font-bold text-lg transition-colors" style={{ color: '#555', backgroundColor: '#f9fafb', borderLeft: '1px solid #e5e7eb' }}>+</button>
                    </div>
                  </div>

                  {/* Delivery Type */}
                  {(showHomeDelivery || showDeskDelivery) && (
                    <div className={`grid gap-3 ${showHomeDelivery && showDeskDelivery ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {showHomeDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : '#f9fafb', color: selectedDeliveryType === 'home' ? accentColor : '#555' }}>
                          <Home size={16} /><span>التوصيل للمنزل</span>
                        </button>
                      )}
                      {showDeskDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : '#f9fafb', color: selectedDeliveryType === 'desk' ? accentColor : '#555' }}>
                          <Building2 size={16} /><span>الاستلام من المكتب</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Receipt */}
                  <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="flex justify-between items-center text-sm" style={{ color: '#333' }}>
                      <span>سعر المنتج ({quantity})</span>
                      <span className="font-bold">DZD {Math.round((selectedVariant?.price ?? mainProduct.price) * quantity).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pb-2" style={{ color: '#333', borderBottom: '1px solid #e5e7eb' }}>
                      <span>التوصيل</span>
                      <span className="font-bold">{!selectedWilayaId ? '--' : `DZD ${deliveryFee}`}</span>
                    </div>
                    {selectedWilaya?.days && (
                      <div className="flex justify-between items-center text-xs" style={{ color: '#888' }}>
                        <span>وقت التوصيل المقدر</span>
                        <span>{selectedWilaya.days} أيام</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-bold text-base pt-1" style={{ color: '#111' }}>
                      <span>المجموع</span>
                      <span style={{ color: accentColor }}>{!selectedWilayaId ? '--' : `DZD ${Math.round(((selectedVariant?.price ?? mainProduct.price) * quantity) + deliveryFee).toLocaleString()}`}</span>
                    </div>
                  </div>

                  {orderError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center whitespace-pre-line text-start">
                      {orderError}
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <button type="button" disabled={isSubmitting}
                      onClick={() => { addToCart(mainProduct, selectedVariant); setShowCart(true); }}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{ backgroundColor: '#111', color: '#fff' }}>
                      {isSubmitting ? 'جاري المعالجة...' : 'إضافة للسلة'}
                    </button>
                    <button type="submit" disabled={isSubmitting} form="orderForm"
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm border-2 transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{ borderColor: '#111', backgroundColor: '#fff', color: '#111' }}>
                      {isSubmitting ? 'جاري المعالجة...' : 'اطلب الآن'}
                    </button>
                  </div>
                </div>
              </form>
              )}

              {/* Product Metadata */}
              {(mainProduct.category || mainProduct.tags || (mainProduct as any).brand) && (
                <div className="mt-6 space-y-2">
                  {mainProduct.category && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                      <span className="font-semibold" style={{ color: '#0f172a' }}>الفئة</span>
                      <span className="flex-1 border-b" style={{ borderColor: '#e5e7eb' }}></span>
                      <span>{mainProduct.category}</span>
                    </div>
                  )}
                  {mainProduct.tags && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                      <span className="font-semibold" style={{ color: '#0f172a' }}>الوسوم</span>
                      <span className="flex-1 border-b" style={{ borderColor: '#e5e7eb' }}></span>
                      <span>{Array.isArray(mainProduct.tags) ? mainProduct.tags.join(', ') : mainProduct.tags}</span>
                    </div>
                  )}
                  {(mainProduct as any).brand && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                      <span className="font-semibold" style={{ color: '#0f172a' }}>الماركة</span>
                      <span className="flex-1 border-b" style={{ borderColor: '#e5e7eb' }}></span>
                      <span>{(mainProduct as any).brand}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {mainProduct.description && (
                <div className="mt-8">
                  <h3 className="text-base font-bold mb-4 text-center tracking-wide" style={{ color: '#0f172a', borderBottom: `1px solid ${borderColor}`, paddingBottom: '0.75rem' }}>DESCRIPTION</h3>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: '#4b5563' }}
                    dangerouslySetInnerHTML={{ __html: mainProduct.description }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RELATED PRODUCTS GRID ── */}
        {otherProducts.length > 0 && (
          <section style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <div className="relative mb-8" style={{ position: 'relative', minHeight: '31px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '2px', backgroundColor: '#232323', zIndex: 1, transform: 'translateY(-50%)' }}></div>
              <h2
                className="relative z-10 text-center"
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '22px',
                  letterSpacing: 0,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  background: 'white',
                  display: 'inline-block',
                  margin: 0,
                  padding: '0 10%',
                  color: '#232323',
                }}
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('template_grid_title')}
              >
                {settings?.template_grid_title || 'New Arivage'}
              </h2>
            </div>

            {/* Desktop: grid */}
            <div className="hidden md:grid grid-cols-5" style={{ gap: '10px', contentVisibility: 'auto', containIntrinsicSize: '600px' }}>
              {otherProducts.map(prod => {
                const thumb = prod.images?.[0] || '/placeholder.png';
                const price = Number(prod.price ?? 0);
                const origPrice = prod.original_price ? Number(prod.original_price) : 0;
                const disc = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
                const soldCount = (prod as any).views || 0;
                return (
                  <div
                    key={prod.id}
                    className="group block text-left relative"
                    onMouseEnter={() => setHoveredProduct(prod.id)}
                    onMouseLeave={() => setHoveredProduct(null)}
                  >
                    <div
                      className="relative overflow-hidden bg-white cursor-pointer"
                      onClick={() => { setActiveMainProduct(prod); setSelectedMainImage(0); onProductView?.(prod); window.scrollTo({ top: 0, behavior: 'smooth' }); if (navigate) navigate(buildStoreUrl(storeSlug, prod?.slug || String(prod.id))); }}
                    >
                      <div className="relative" style={{ aspectRatio: '3 / 4' }}>
                        {(prod as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                          ? <LazyVideo src={(prod as any).metadata.video_url} poster={thumb || ''}
                              loadDelay={2000}
                              className="w-full h-full object-cover" />
                          : (prod as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                            ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(prod as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(prod as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                            : <img
                                src={optImg(hoveredProduct === prod.id && prod.images?.[1] ? prod.images[1] : thumb)}
                                alt={prod.title}
                                loading="lazy"
                                decoding="async"
                                width="400"
                                height="533"
                                className="w-full h-full object-cover transition-opacity duration-300"
                                style={{ filter: imgLoaded[prod.id] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
                                onLoad={() => setImgLoaded(prev => ({...prev, [prod.id]: true}))}
                              />
                        }
                        {/* Badges */}
                        {(disc > 0 || (prod as any)?.metadata?.promo_label) && (
                          <div className="absolute top-0 left-0 z-10">
                            <span className="inline-block bg-[#ff4d4f] text-white text-[11px] font-bold px-1.5 py-0.5 leading-tight">
                              {disc > 0 ? `-${disc}%` : (prod as any).metadata.promo_label}
                            </span>
                          </div>
                        )}
                        {/* SAVINGS label */}
                        {disc > 0 && (
                          <div className="absolute top-0 left-0 mt-5 z-10">
                            <span className="inline-block bg-[#ff4d4f] text-white text-[9px] font-bold px-1.5 py-0.5 leading-tight">
                              SAVINGS
                            </span>
                          </div>
                        )}
                        {/* Add to cart button */}
                        <button
                          className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          onClick={(e) => { e.stopPropagation(); addToCart(prod); }}
                          title="أضف إلى السلة"
                        >
                          <ShoppingCart size={14} style={{ color: '#333' }} />
                        </button>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="px-0.5 pt-1.5 pb-1">
                      <h3 className="text-xs font-normal truncate leading-tight" style={{ color: '#333', margin: 0 }}>{prod.title}</h3>
                      <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#222' }}>{price.toLocaleString()} DA</span>
                        {origPrice > price && (
                          <span className="text-[10px] line-through" style={{ color: '#999' }}>{origPrice.toLocaleString()} DA</span>
                        )}
                      </div>
                      {disc > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: '#ff4d4f' }}>Last day {price.toLocaleString()} DA</span>
                      )}
                      {soldCount > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px]" style={{ color: '#999' }}>🔥 {soldCount >= 1000 ? `${(soldCount / 1000).toFixed(1)}K+` : `${soldCount}+`} sold</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Mobile: 2-column grid */}
            <div className="md:hidden grid grid-cols-1" style={{ gap: '8px' }}>
              {otherProducts.map(prod => {
                const thumb = prod.images?.[0] || '/placeholder.png';
                const price = Number(prod.price ?? 0);
                const origPrice = prod.original_price ? Number(prod.original_price) : 0;
                const disc = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
                const soldCount = (prod as any).views || 0;
                return (
                  <div
                    key={prod.id}
                    className="group block text-left relative"
                    onMouseEnter={() => setHoveredProduct(prod.id)}
                    onMouseLeave={() => setHoveredProduct(null)}
                  >
                    <div
                      className="relative overflow-hidden bg-white cursor-pointer"
                      onClick={() => { setActiveMainProduct(prod); setSelectedMainImage(0); onProductView?.(prod); window.scrollTo({ top: 0, behavior: 'smooth' }); if (navigate) navigate(buildStoreUrl(storeSlug, prod?.slug || String(prod.id))); }}
                    >
                      <div className="relative" style={{ aspectRatio: '3 / 4' }}>
                        {(prod as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                          ? <LazyVideo src={(prod as any).metadata.video_url} poster={thumb || ''}
                              loadDelay={2000}
                              className="w-full h-full object-cover" />
                          : (prod as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                            ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(prod as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(prod as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                            : <img
                                src={optImg(hoveredProduct === prod.id && prod.images?.[1] ? prod.images[1] : thumb)}
                                alt={prod.title}
                                loading="lazy"
                                decoding="async"
                                width="400"
                                height="533"
                                className="w-full h-full object-cover transition-opacity duration-300"
                                style={{ filter: imgLoaded[prod.id] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
                                onLoad={() => setImgLoaded(prev => ({...prev, [prod.id]: true}))}
                              />
                        }
                      </div>
                        )}
                        {disc > 0 && (
                          <div className="absolute top-0 left-0 mt-4 z-10">
                            <span className="inline-block bg-[#ff4d4f] text-white text-[8px] font-bold px-1.5 py-0.5 leading-tight">
                              SAVINGS
                            </span>
                          </div>
                        )}
                        <button
                          className="absolute bottom-2 right-2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center"
                          onClick={(e) => { e.stopPropagation(); addToCart(prod); }}
                          title="أضف إلى السلة"
                        >
                          <ShoppingCart size={12} style={{ color: '#333' }} />
                        </button>
                      </div>
                    </div>
                    <div className="px-1 pt-1.5 pb-1">
                      <h3 className="text-sm font-normal leading-tight" style={{ color: '#333', margin: 0 }}>{prod.title}</h3>
                      <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#222' }}>{price.toLocaleString()} DA</span>
                        {origPrice > price && (
                          <span className="text-xs line-through" style={{ color: '#999' }}>{origPrice.toLocaleString()} DA</span>
                        )}
                      </div>
                      {disc > 0 && (
                        <span className="text-[11px] font-semibold" style={{ color: '#ff4d4f' }}>Last day {price.toLocaleString()} DA</span>
                      )}
                      {soldCount > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[11px]" style={{ color: '#999' }}>🔥 {soldCount >= 1000 ? `${(soldCount / 1000).toFixed(1)}K+` : `${soldCount}+`} sold</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-1.5 mt-6">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#6b7280' }}></span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#d1d5db' }}></span>
            </div>
          </section>
        )}
      </main>

      {/* ── Scroll to Top ── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-sm font-bold opacity-70 hover:opacity-100 transition-opacity md:hidden"
        style={{ backgroundColor: accentColor, color: '#fff' }}
      >
        ↑
      </button>

      {/* ── Footer ── */}
      <footer className="py-8 mt-12 text-center pb-24 md:pb-8" style={{ backgroundColor: surfaceMuted, borderTop: `1px solid ${borderColor}` }}>
        <p className="text-sm font-bold" style={{ color: textMuted }}>© {new Date().getFullYear()} {storeName}</p>
        <div className="flex justify-center gap-4 mt-3">
          <span className="text-xs" style={{ color: textMuted }}>📞 {settings?.store_phone || 'اتصل بنا'}</span>
          <span className="text-xs" style={{ color: textMuted }}>📍 توصيل لـ 58 ولاية</span>
        </div>
      </footer>

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
        <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Sticky Mobile Checkout Bar */}
      {mainProduct && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 border-t flex items-center gap-3" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
          <div className="flex-1">
            <p className="font-black text-lg" style={{ color: accentColor }}>{Math.round(mainProduct.price ?? 0).toLocaleString()} {currency}</p>
            <p className="text-[10px]" style={{ color: surfaceTextMuted }}>الدفع عند الاستلام</p>
          </div>
          <button
            onClick={() => { const el = document.querySelector('#orderForm'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="text-white font-bold px-8 py-3 rounded-xl text-base shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            اطلب الآن
          </button>
        </div>
      )}

      {/* Hide chat bubble when modals are open */}
      {zoomState && (
        <style>{`[data-storefront-contact="true"] { display: none !important; }`}</style>
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
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-bold">›</button>
              <button onClick={e => { e.stopPropagation(); const n = (zoomState.idx + 1) % zoomState.images.length; setZoomState({ ...zoomState, idx: n }); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-bold">‹</button>
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
            <img 
  key={zoomState.idx} 
  src={zoomState.images[zoomState.idx].includes('cloudinary.com') && !zoomState.images[zoomState.idx].includes('?tr=') ? `${zoomState.images[zoomState.idx]}?tr=w_800,q_auto,f_auto,c_limit` : zoomState.images[zoomState.idx]} 
  alt="Preview" 
  className="max-w-full max-h-[95vh] object-contain rounded-2xl" 
  decoding="async"
  style={{ contentVisibility: 'auto', filter: imgLoaded[-2] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
  onLoad={() => setImgLoaded(prev => ({...prev, '-2': true}))}
/>
          </div>
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pt-2 overflow-x-auto justify-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((img, i) => {
                const srcUrl = img.includes('cloudinary.com') && !img.includes('?tr=') ? `${img}?tr=w_100,q_auto,f_auto,c_limit` : img;
                return (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110 ring-2 ring-white/30' : 'border-white/20 opacity-50 hover:opacity-80'}`}>
                  <img 
  src={srcUrl} 
  alt="" 
  className="w-full h-full object-cover" 
  loading="lazy"
  decoding="async"
  width="56"
  height="56"
  style={{ contentVisibility: 'auto', filter: thumbLoaded[i] ? 'none' : 'blur(10px)', transition: 'filter 0.5s' }}
  onLoad={() => setThumbLoaded(prev => ({...prev, [i]: true}))}
/>
                </button>
                );
              })}
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
    </div>
  );
}
