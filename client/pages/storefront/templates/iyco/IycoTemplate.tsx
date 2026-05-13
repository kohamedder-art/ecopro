import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  Search,
  User,
  ShoppingBag,
  Star,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
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
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function IycoTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  bannerUrl,
  onProductView,
  initialProductSlug,
}: TemplateProps) {
  // ── Settings Wiring (correct priority) ──
  // propPrimaryColor is computed by the editor from raw settings (survives template preview override)
  // settings?.primary_color also survives because it's not in TEMPLATE_SETTING_KEYS
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#16a34a';
  const bgColor = settings?.template_bg_color || settings?.iyco_bg_color || '#ffffff';
  const primaryColor = settings?.primary_color || '#0f172a';
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
  const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';

  // ── Main Product ──
  const [activeMainProduct, setActiveMainProduct] = useState<any>(null);
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

  // ── Delivery System ──
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;


  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
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
        variant_name: variant ? (variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / ')) : undefined,
      }];
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
  const total = subtotal + deliveryFee;

  // ── Order Form State ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // ── Product Detail State ──
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarouselTo = (i: number) => carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * i, behavior: 'smooth' });
  const [selectedSize, setSelectedSize] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Reset main image when mainProduct changes
  useEffect(() => {
    setSelectedMainImage(0);
    setShowVideo(!!videoEmbed);
  }, [mainProduct?.id]);

  // Auto-add main product to cart when form submitted if cart is empty
  const ensureMainProductInCart = () => {
    if (cart.length === 0 && mainProduct) {
      addToCart(mainProduct);
    }
  };

  // ── Order Submission ──
  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId) {
      alert('يرجى ملء جميع الحقول');
      return;
    }

    if (!mainProduct) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    const orderCart = [{
      id: mainProduct.id,
      price: ((selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null) ?? mainProduct.price,
      qty: selectedOffer?.quantity ?? quantity,
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
            quantity: isOfferItem ? selectedOffer.quantity : item.qty,
            ...(isOfferItem ? { offer_id: selectedOffer.offer_id } : {}),
            total_price: isOfferItem ? selectedOffer.bundle_price : item.price * item.qty,
            delivery_fee: deliveryFee,
            delivery_type: selectedDeliveryType,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: [selectedWilaya?.labelAR || '', customerAddress, customerCommune].filter(Boolean).join(' - '),
            customer_notes: customerNotes,
            shipping_wilaya_id: selectedWilayaId,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setLastOrderId(data.order?.id || null);
          setLastTelegramUrl(data.telegramStartUrl || null);
          alert(data.error || 'خطأ في الطلب');
          return;
        }
      }
      setOrderSuccess(true);
    } catch {
      alert('خطأ في الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── ContentEditable ──
  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // ── Google Font ──
  useEffect(() => {
    if (!document.getElementById('cairo-font')) {
      const link = document.createElement('link');
      link.id = 'cairo-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // ── FAQ Data ──
  const faqs = [
    { q: settings?.iyco_faq1_q || 'هل مقاسات مضبوطة (صحيحة)؟', a: settings?.iyco_faq1_a || 'نعم، مقاساتنا قياسية وتتوافق مع المقاسات العالمية.' },
    { q: settings?.iyco_faq2_q || 'هل التوصيل سريع؟', a: settings?.iyco_faq2_a || 'نوفر توصيل سريع يتراوح بين 24 إلى 72 ساعة كأقصى تقدير لجميع الولايات.' },
    { q: settings?.iyco_faq3_q || 'هل يوجد ضمان (استبدال مقاس)؟', a: settings?.iyco_faq3_a || 'نعم، نضمن لك استبدال المقاس مجاناً إذا لم يكن مناسباً لك.' },
  ];

  // ── Other products (everything except main) ──
  const otherProducts = useMemo(() => {
    if (!products) return [];
    return mainProduct ? products.filter(p => p.id !== mainProduct.id) : products;
  }, [products, mainProduct]);

  const mainImages = mainProduct?.images?.length ? mainProduct.images : ['/placeholder.png'];

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

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
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Cairo', sans-serif" }} dir="rtl">

      {/* ── TOP NAVIGATION ── */}
      <nav className="sticky top-0 z-50" style={{ backgroundColor: surfaceColor, borderBottom: `1px solid ${borderColor}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accentColor }}>
                {storeName.charAt(0)}
              </div>
            )}
            <span
              className="text-2xl font-black tracking-tighter"
              style={{ color: surfaceTextColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('store_name')}
            >
              {storeName}
            </span>
          </div>
          <div className="flex items-center gap-5" style={{ color: surfaceTextMuted }}>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">

        {/* ── canManage: empty products placeholder ── */}
        {canManage && (!products || products.length === 0) && (
          <div className="py-20 text-center opacity-50">
            <ShoppingBag className="mx-auto mb-4" size={48} style={{ color: textMuted }} />
            <p style={{ color: textMuted }} className="text-lg">أضف منتجات من لوحة التحكم لعرضها هنا</p>
          </div>
        )}

        {/* ── PRODUCT SECTION (SPLIT LAYOUT) ── */}
        {mainProduct && (
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

            {/* LEFT: Image Gallery */}
            <div className="w-full lg:w-[55%] flex flex-col gap-4">
              <div className="w-full rounded-xl overflow-hidden relative aspect-[4/5] lg:aspect-auto lg:h-[65vh]" style={{ backgroundColor: surfaceMuted }}>
                <div ref={carouselRef} className="flex h-full" style={{ overflowX: 'scroll', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                  {videoEmbed && (
                    <div className="h-full shrink-0" style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}>
                      {videoEmbed.type === 'youtube' ? (
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                      ) : videoEmbed.type === 'video' ? (
                        <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                      ) : (
                        <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                      )}
                    </div>
                  )}
                  {mainImages.length > 0 ? mainImages.map((img, i) => (
                    <img key={i} src={img} alt={mainProduct.title}
                      className="w-full h-full object-cover shrink-0 cursor-pointer"
                      loading="lazy"
                      style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}
                      onClick={() => setZoomState({ images: mainImages, idx: i })}
                    />
                  )) : (
                    <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', color: textMuted }}>
                      <ShoppingBag size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>
              </div>
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {videoEmbed && (
                    <button onClick={() => { setShowVideo(true); scrollCarouselTo(0); }} className="w-20 h-24 shrink-0 rounded-lg overflow-hidden border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                  )}
                  {mainImages.map((img, idx) => (
                    <button key={idx} onClick={() => { setShowVideo(false); setSelectedMainImage(idx); scrollCarouselTo(videoEmbed ? idx + 1 : idx); }} className="w-20 h-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all" style={{ borderColor: !showVideo && selectedMainImage === idx ? accentColor : 'transparent', opacity: !showVideo && selectedMainImage === idx ? 1 : 0.6 }}>
                      <img src={img} className="w-full h-full object-cover" alt="thumb" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Product Details & Checkout Form */}
            <div className="w-full lg:w-[45%] flex flex-col">

              {/* Title & Badge */}
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-black mb-2" style={{ color: textColor }}>{mainProduct.title}</h1>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span
                    className="text-white text-[11px] font-bold px-3 py-1 rounded-sm shadow-sm"
                    style={{ backgroundColor: accentColor }}
                    contentEditable={canManage}
                    suppressContentEditableWarning
                    onBlur={handleTextEdit('template_hero_heading')}
                  >
                    {heroTitle}
                  </span>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                  </div>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black" style={{ color: accentColor }}>
                    {Math.round(mainProduct.price ?? 0).toLocaleString()} {currency}
                  </span>
                  {mainProduct.original_price && (
                    <span className="text-lg line-through font-bold" style={{ color: textMuted }}>
                      {Math.round(mainProduct.original_price).toLocaleString()} {currency}
                    </span>
                  )}
                </div>
                {mainProduct.stock_quantity > 0 && (
                  <div className="flex items-center gap-1 text-xs font-bold mt-2" style={{ color: accentColor }}>
                    <CheckCircle2 size={12} /> <span>متوفر</span>
                  </div>
                )}
              </div>

              {/* ── THE ORDER FORM ── */}
              <div className="rounded-xl p-3 shadow-sm mb-4" style={{ backgroundColor: surfaceColor, border: `1px solid ${borderColor}` }}>
                <h3 className="font-black text-center text-sm mb-3 pb-2" style={{ color: surfaceTextColor, borderBottom: `1px solid ${borderColor}` }}>إستمارة الطلب</h3>
                {offers.length > 0 && (
                  <OfferSelector
                    offers={offers}
                    unitPrice={mainProduct?.price || 0}
                    currency={currency}
                    selectedOfferId={selectedOffer?.offer_id ?? null}
                    onSelect={handleOfferSelect}
                    accentColor={accentColor}
                    textColor={surfaceTextColor}
                    borderColor={borderColor}
                    hidePrice={true}
                  />
                )}

                {mainProduct?.variants && mainProduct.variants.length > 0 && (
                  <div className="mb-3">
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

                <div className="space-y-2">
                  {/* Name + Phone */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        required
                        type="text"
                        placeholder="أدخل الإسم الكامل"
                        className="w-full pl-4 pr-10 py-2 rounded-md text-sm outline-none transition-all"
                        style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${customerName ? accentColor : borderColor}` }}
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center rounded-r-md" style={{ backgroundColor: surfaceMuted, borderLeft: `1px solid ${borderColor}`, color: surfaceTextMuted }}>
                        <User size={16} />
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        required
                        type="tel"
                        placeholder="أدخل رقم الهاتف..."
                        className="w-full pl-4 pr-10 py-2 rounded-md text-sm outline-none transition-all text-right"
                        style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${customerPhone ? accentColor : borderColor}` }}
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center rounded-r-md" style={{ backgroundColor: surfaceMuted, borderLeft: `1px solid ${borderColor}`, color: surfaceTextMuted }}>
                        <Phone size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Wilaya + Commune */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <select
                        required
                        className="w-full pl-4 pr-10 py-2 rounded-md text-sm outline-none transition-all appearance-none cursor-pointer"
                        style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${selectedWilayaId ? accentColor : borderColor}` }}
                        value={selectedWilayaId ?? ''}
                        onChange={e => setSelectedWilayaId(Number(e.target.value) || null)}
                      >
                        <option value="">إختر الولاية</option>
                        {wilayas.map(w => (
                          <option key={w.id} value={w.id}>{w.labelAR}</option>
                        ))}
                      </select>
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center rounded-r-md pointer-events-none" style={{ backgroundColor: surfaceMuted, borderLeft: `1px solid ${borderColor}`, color: surfaceTextMuted }}>
                        <MapPin size={16} />
                      </div>
                    </div>
                    {showCommune && <div className="relative">
                      <input type="text" placeholder="البلدية" className="w-full pl-4 pr-4 py-2.5 rounded-md text-sm outline-none" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${borderColor}` }} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} />
                    </div>}
                  </div>

                  {showAddress && <input type="text" placeholder="العنوان" className="w-full pl-4 pr-4 py-2.5 rounded-md text-sm outline-none" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${borderColor}` }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                  {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full pl-4 pr-4 py-2.5 rounded-md text-sm outline-none resize-none" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, border: `1px solid ${borderColor}` }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}

                  {/* Quantity */}
                  <div className="pt-2">
                    <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>الكمية</label>
                    <div className="flex items-center justify-between rounded-lg p-1" style={{ backgroundColor: surfaceMuted, border: `1px solid ${borderColor}` }}>
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 bg-white border rounded-md font-bold text-xl" style={{ color: textColor, borderColor: borderColor }}>−</button>
                      <span className="font-black text-lg" style={{ color: surfaceTextColor }}>{quantity}</span>
                      <button type="button" onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 bg-white border rounded-md font-bold text-xl" style={{ color: textColor, borderColor: borderColor }}>+</button>
                    </div>
                  </div>

                  {/* Delivery Type Buttons */}
                  {(showHomeDelivery || showDeskDelivery) && (
                    <div>
                      <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>نوع التوصيل</label>
                      <div className="grid grid-cols-2 gap-3">
                        {showHomeDelivery && (
                          <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : surfaceColor, color: selectedDeliveryType === 'home' ? accentColor : surfaceTextColor }}>
                            <Home size={16} />
                            <span>التوصيل للمنزل</span>
                          </button>
                        )}
                        {showDeskDelivery && (
                          <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : surfaceColor, color: selectedDeliveryType === 'desk' ? accentColor : surfaceTextColor }}>
                            <Building2 size={16} />
                            <span>الاستلام من المكتب</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Receipt Box */}
                  <div className="p-2.5 rounded-md mt-2 space-y-1.5" style={{ backgroundColor: surfaceMuted, border: `1px solid ${borderColor}` }}>
                    <div className="flex justify-between items-center text-xs font-bold" style={{ color: surfaceTextColor }}>
                      <span className="flex items-center gap-1.5"><ShoppingCart size={13} /> سعر المنتج{selectedOffer ? ` (${selectedOffer.quantity} قطعة)` : ` (${quantity})`}</span>
                      <span dir="ltr">{Math.round(selectedOffer ? selectedOffer.bundle_price * quantity : ((selectedVariant?.price != null && selectedVariant.price > 0 ? selectedVariant.price : null) ?? mainProduct.price) * quantity).toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold pb-1.5" style={{ color: surfaceTextColor, borderBottom: `1px solid ${borderColor}` }}>
                      <span className="flex items-center gap-1.5"><Truck size={13} /> التوصيل</span>
                      <span dir="ltr">{!selectedWilayaId ? '--' : `${deliveryFee} ${currency}`}</span>
                    </div>
                    <div className="flex justify-between items-center font-black text-sm" style={{ color: surfaceTextColor }}>
                      <span className="flex items-center gap-1.5"><Calculator size={13} /> المجموع</span>
                      <span dir="ltr" style={{ color: accentColor }}>
                        {!selectedWilayaId ? '--' : `${Math.round((selectedOffer ? selectedOffer.bundle_price * quantity : ((selectedVariant?.price != null && selectedVariant.price > 0 ? selectedVariant.price : null) ?? mainProduct.price) * quantity) + deliveryFee).toLocaleString()} ${currency}`}
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleOrder}
                    disabled={isSubmitting}
                    className="w-full mt-1 py-3 text-white rounded-md font-black text-base shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSubmitting ? 'جاري المعالجة...' : buttonText}
                    {!isSubmitting && <ShoppingCart size={20} fill="currentColor" className="mt-0.5" />}
                  </button>
                </div>
              </div>

              <p
                className="text-center text-xs font-bold mb-6"
                style={{ color: textMuted }}
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('template_hero_subtitle')}
              >
                {heroSubtitle}
              </p>

              {/* FAQs Accordion */}
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
                {faqs.map((faq, idx) => (
                  <div key={idx} style={{ borderBottom: idx < faqs.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-4 transition-colors text-right"
                      style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}
                    >
                      <span className="font-bold text-sm">{faq.q}</span>
                      {openFaq === idx ? <ChevronUp size={16} style={{ color: surfaceTextMuted }} /> : <ChevronDown size={16} style={{ color: surfaceTextMuted }} />}
                    </button>
                    {openFaq === idx && (
                      <div className="p-4 text-sm" style={{ backgroundColor: surfaceMuted, color: textMuted, borderTop: `1px solid ${borderColor}` }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RELATED PRODUCTS GRID ── */}
        {otherProducts.length > 0 && (
          <section className="mt-16 lg:mt-24">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-black tracking-tight" style={{ color: textColor }}>{storeName}</h2>
              <div className="h-px flex-1 mt-2" style={{ backgroundColor: borderColor }}></div>
              <span className="text-sm font-bold whitespace-nowrap" style={{ color: textMuted }}>المزيد من المنتجات :</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {otherProducts.map(prod => (
                <button
                  key={prod.id}
                  className="group block text-right"
                  onClick={() => { setActiveMainProduct(prod); setSelectedMainImage(0); onProductView?.(prod); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-3" style={{ backgroundColor: surfaceMuted }}>
                    <img
                      src={prod.images?.[0] || '/placeholder.png'}
                      alt={prod.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {prod.original_price && (
                      <div className="absolute top-2 right-2 backdrop-blur-sm text-[10px] font-bold px-2 py-1 rounded shadow-sm" style={{ backgroundColor: surfaceColor + 'e6', color: textColor }}>
                        تخفيض
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <span className="text-white text-xs font-bold flex items-center justify-center gap-1">
                        عرض المنتج →
                      </span>
                    </div>
                  </div>
                  <div className="px-1">
                    <h3 className="text-sm font-bold mb-1 truncate" style={{ color: textColor }}>{prod.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: accentColor }}>{Math.round(prod.price ?? 0).toLocaleString()} {currency}</span>
                      {prod.original_price && (
                        <span className="text-xs font-bold line-through" style={{ color: textMuted }}>{Math.round(prod.original_price).toLocaleString()} {currency}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-8 mt-12 text-center" style={{ backgroundColor: surfaceMuted, borderTop: `1px solid ${borderColor}` }}>
        <p className="text-sm font-bold" style={{ color: textMuted }}>© {new Date().getFullYear()} {storeName}</p>
      </footer>

      {false && showCart && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: surfaceColor, color: textColor }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black" style={{ color: textColor }}>السلة ({cart.reduce((s, i) => s + i.qty, 0)})</h3>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-full" style={{ color: textMuted }}>
                <X size={20} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center" style={{ color: textMuted }}>
                <ShoppingBag className="mx-auto mb-3" size={40} />
                <p>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: surfaceMuted }}>
                    <img src={item.image} alt="" className="w-16 h-16 rounded-lg object-cover" loading="lazy" />
                    <div className="flex-1">
                      <p className="font-bold text-sm truncate" style={{ color: textColor }}>{item.title}</p>
                      <p className="text-sm" style={{ color: accentColor }}>{Math.round(item.price ?? 0).toLocaleString()} {currency}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: borderColor, color: textColor }}><Minus size={12} /></button>
                        <span className="text-sm font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded flex items-center justify-center text-white" style={{ backgroundColor: accentColor }}><Plus size={12} /></button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="self-start" style={{ color: '#ef4444' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between font-black text-lg" style={{ borderColor }}>
                  <span>المجموع</span>
                  <span style={{ color: accentColor }}>{Math.round(subtotal ?? 0).toLocaleString()} {currency}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomState(null)}>
            <X size={20} />
          </button>
          <img src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
          {zoomState.images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {zoomState.images.map((img, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setZoomState({ ...zoomState, idx: i }); }}
                  className="w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0"
                  style={{ borderColor: i === zoomState.idx ? accentColor : 'rgba(255,255,255,0.3)', opacity: i === zoomState.idx ? 1 : 0.6 }}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
