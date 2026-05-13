import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { 
  ShoppingBag, 
  User, 
  Phone, 
  MapPin, 
  Home, 
  Building2, 
  Check, 
  X, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  Maximize2,
  Play,
  Volume2,
  VolumeX
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function Dz3ShopTemplate({
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
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#c21d1d';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const primaryColor = settings?.primary_color || '#111827';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'مرحبا بك في متجرنا ❤️';
  const heroSubtitle = settings?.template_hero_subtitle || 'اكتشفوا أفضل المنتجات متوفرة لدينا 🔥';
  const buttonText = settings?.template_button_text || 'أطلب الآن';
  const storeName = settings?.store_name || 'المتجر';
  const [showBanner, setShowBanner] = useState(settings?.show_promotional_banner !== false);

  // ── Dark/Light detection ──
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);

  const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');

  const isHeaderDark = useMemo(() => {
    const hex = headerColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [headerColor]);

  const isLight = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
  };

  // Derived theme colors
  const textColor = isDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#6b7280';
  const surfaceColor = headerColor;
  const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';
  const borderColor = isDark ? '#334155' : '#f3f4f6';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#6b7280';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e5e7eb';

  // ── Page View State: catalog vs product detail ──
  const [viewMode, setViewMode] = useState<'catalog' | 'product'>('product');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) { setSelectedProductId(p.id); setViewMode('product'); } } }, [initialProductSlug, products]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ type: 'youtube' | 'video' | 'iframe'; url: string } | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarouselTo = (i: number) => carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * i, behavior: 'smooth' });

  // ── Main Product ──
  const mainProduct = useMemo(() => {
    if (initialProductSlug) {
      const bySlug = products?.find((p: any) => p.slug === initialProductSlug);
      if (bySlug) return bySlug;
    }
    const mainId = settings?.dzp_main_product_id;
    return mainId
      ? products?.find((p: any) => String(p.id) === String(mainId))
      : products?.[0];
  }, [products, settings?.dzp_main_product_id, initialProductSlug]);

  // Selected product for detail view (either clicked or main)
  const detailProduct = useMemo(() => {
    if (selectedProductId) {
      return products?.find(p => p.id === selectedProductId) || mainProduct;
    }
    return mainProduct;
  }, [selectedProductId, products, mainProduct]);

  const otherProducts = useMemo(() => {
    if (!products) return [];
    if (detailProduct) return products.filter(p => p.id !== detailProduct.id);
    return products;
  }, [products, detailProduct]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const detailImages = detailProduct?.images?.length ? detailProduct.images : ['/placeholder.png'];

  const videoUrl = (detailProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  const [showVideo, setShowVideo] = useState(true);

  // Navigate to product detail
  const openProduct = (productId: number) => {
    setSelectedProductId(productId);
    setViewMode('product');
    setActiveImageIndex(0);
    setShowVideo(!!videoEmbed);
    window.scrollTo(0, 0);
    const product = products?.find(p => p.id === productId);
    if (product) {
      onProductView?.(product);
      if (product.slug && navigate) navigate(`/store/${storeSlug}/${product.slug}`);
    }
  };

  const openCatalog = () => {
    setViewMode('catalog');
    window.scrollTo(0, 0);
    if (navigate) navigate(`/store/${storeSlug}`);
  };

  // ── Delivery System ──
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [deliveryType, setDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, deliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya
    ? (deliveryType === 'home' ? selectedWilaya.homePrice : selectedWilaya.deskPrice) ?? 0
    : 0;

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  // ── Pricing ──
  const variantPrice = (detailVariant?.price != null && detailVariant.price > 0) ? detailVariant.price : null;
  const detailPrice = variantPrice ?? detailProduct?.price ?? 0;
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : detailPrice * quantity;
  const total = productTotal + deliveryFee;

  // ── Order State ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  // ── Order Submission ──
  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId) { alert('يرجى ملء جميع الحقول'); return; }
    if (!detailProduct) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: detailProduct.id,
          ...(detailVariant?.id ? { variant_id: detailVariant.id } : {}),
          quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: productTotal,
          delivery_fee: deliveryFee,
          delivery_type: deliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_notes: customerNotes,
          customer_address: [selectedWilaya?.labelAR || '', customerAddress, customerCommune].filter(Boolean).join(' - '),
          shipping_wilaya_id: selectedWilayaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'خطأ في الطلب'); return; }
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setOrderSuccess(true);
    } catch { alert('خطأ في الطلب'); } finally { setIsSubmitting(false); }
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
    if (!document.getElementById('tajawal-font')) {
      const link = document.createElement('link');
      link.id = 'tajawal-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // ══════════════════════════════════════
  // ORDER SUCCESS SCREEN
  // ══════════════════════════════════════
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <Check size={32} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: surfaceMuted }}>
            <div className="flex justify-between text-sm">
              <span>{detailProduct.title} × {quantity}</span>
              <span className="font-bold">{Math.round(productTotal ?? 0).toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: textMuted }}>التوصيل</span>
              <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${currency}`}</span>
            </div>
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex justify-between font-black">
              <span>المجموع</span>
              <span style={{ color: accentColor }}>{Math.round(total).toLocaleString()} {currency}</span>
            </div>
          </div>
          <button onClick={() => { setOrderSuccess(false); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>تسوق مرة أخرى</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // PRODUCT CARD COMPONENT (Temu-style)
  // ══════════════════════════════════════
  const ProductCard = ({ product }: { product: any }) => {
    const discount = product.original_price 
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : 0;
    const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
    
    return (
      <div
        className="group cursor-pointer transition-transform hover:-translate-y-1"
        onClick={() => openProduct(product.id)}
      >
        {/* Image Container - fills card edge-to-edge like Temu */}
        <div className="relative overflow-hidden rounded-lg mb-2" style={{ aspectRatio: '4 / 5', backgroundColor: surfaceMuted }}>
          <img
            src={product.images?.[0] || '/placeholder.png'}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Top-left badges like Temu */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                -{discount}%
              </span>
            )}
            {isLowStock && (
              <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                ⚡ {product.stock_quantity} left
              </span>
            )}
          </div>
        </div>
        
        {/* Compact info below - like Temu */}
        <div className="px-0.5">
          {/* Title - single line truncated */}
          <h3 className="text-xs font-medium truncate mb-0.5 text-right" style={{ color: surfaceTextColor }}>
            {product.title}
          </h3>
          
          {/* Price row with original price strikethrough */}
          <div className="flex items-center gap-1.5 justify-end">
            <span className="font-bold text-sm" style={{ color: accentColor }}>
              {Math.round(product.price ?? 0).toLocaleString()} {currency}
            </span>
            {product.original_price && (
              <span className="text-[10px] line-through" style={{ color: textMuted }}>
                {Math.round(product.original_price).toLocaleString()}
              </span>
            )}
          </div>
          
          {/* Sales count like Temu */}
          {product.views > 0 && (
            <div className="text-[10px] mt-0.5 text-right" style={{ color: textMuted }}>
              <span className="text-orange-500">🔥</span>
              {product.views > 1000 ? `${Math.floor(product.views/1000)}K+ sold` : `${product.views}+ sold`}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════
  // MAIN TEMPLATE RENDER
  // ══════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">

      {/* ── HEADER ── */}
      <header className="py-3 px-4 md:px-8 sticky top-0 z-50" style={{ backgroundColor: surfaceColor, borderBottom: `1px solid ${borderColor}` }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4">
          {/* Logo row */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={openCatalog}
            >
              {settings?.store_logo ? (
                <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accentColor }}>
                  {(storeName).charAt(0)}
                </div>
              )}
              <span className="font-bold text-lg" style={{ color: surfaceTextColor }}>
                <span
                  contentEditable={canManage}
                  suppressContentEditableWarning
                  onBlur={handleTextEdit('store_name')}
                >
                  {storeName}
                </span>
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setViewMode('catalog'); }}
              className="w-full py-2 px-10 text-right outline-none"
              style={{
                backgroundColor: surfaceMuted,
                borderRadius: 25,
                color: textColor,
              }}
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2" size={16} style={{ color: textMuted }} />
          </div>

          {/* Desktop: home button */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={openCatalog} style={{ color: surfaceTextMuted }} title="الرئيسية">
              <Home size={20} />
            </button>
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

      <main className="max-w-6xl mx-auto p-4 md:p-8">

        {/* ══════════════════════════════════════
            CATALOG (ALL PRODUCTS)
            ══════════════════════════════════════ */}
        {viewMode === 'catalog' && (
          <div>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold flex items-center justify-center gap-2" style={{ color: textColor }}>
                <span
                  contentEditable={canManage}
                  suppressContentEditableWarning
                  onBlur={handleTextEdit('template_hero_heading')}
                >
                  {heroTitle}
                </span>
              </h2>
              {showBanner ? (
                <div className="relative border p-4 rounded-xl mb-4" style={{ backgroundColor: accentColor + '10', borderColor: accentColor + '30' }}>
                  {canManage && (
                    <button
                      onClick={() => setShowBanner(false)}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
                      style={{ color: accentColor }}
                      title="إزالة اللافتة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <p className="text-sm font-semibold" style={{ color: accentColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_subtitle')}>
                    {heroSubtitle}
                  </p>
                </div>
              ) : canManage && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowBanner(true)}
                    className="w-full border-2 border-dashed rounded-xl p-3 text-center hover:border-solid transition-colors"
                    style={{ borderColor: accentColor + '50', color: accentColor }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">🎯</span>
                      <span className="font-semibold text-sm">Add Promotional Banner</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {filteredProducts.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <Search size={40} className="mx-auto mb-3 opacity-30" style={{ color: textMuted }} />
                <p style={{ color: textMuted }}>لا توجد نتائج لـ "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            SINGLE PRODUCT DETAIL
            ══════════════════════════════════════ */}
        {viewMode === 'product' && detailProduct && (
          <div>
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
              {/* ── Product Image Column ── */}
              <div className="w-full lg:w-1/2 flex flex-col gap-3 lg:self-stretch">

                {/* Main display: video or image */}
                <div className="rounded-xl overflow-hidden shadow-sm relative aspect-[4/5] lg:aspect-auto lg:flex-1 lg:max-h-[70vh]" style={{ backgroundColor: surfaceColor }}>
                  <div ref={carouselRef} className="flex h-full" style={{ overflowX: 'scroll', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                    {videoEmbed && (
                      <div className="h-full shrink-0 relative group" style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}
                        onClick={() => {
                          if (videoEmbed.type === 'youtube') {
                            setVideoPreview({ type: 'youtube', url: `https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1` });
                          } else if (videoEmbed.type === 'video') {
                            setVideoPreview({ type: 'video', url: videoEmbed.url });
                          } else {
                            setVideoPreview({ type: 'iframe', url: videoEmbed.url });
                          }
                        }}
                      >
                        {videoEmbed.type === 'youtube' ? (
                          <img src={`https://img.youtube.com/vi/${videoEmbed.id}/0.jpg`} alt="Video thumbnail" className="w-full h-full object-cover cursor-pointer" />
                        ) : videoEmbed.type === 'video' ? (
                          <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 cursor-pointer">
                            <Play size={32} style={{ color: surfaceTextColor }} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Maximize2 size={32} className="text-white" />
                        </div>
                      </div>
                    )}
                    {detailImages.length > 0 ? detailImages.map((img, i) => (
                      <img key={i} src={img} alt={detailProduct.title}
                        className="w-full h-full object-cover shrink-0 cursor-pointer"
                        style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}
                        onClick={() => setZoomState({ images: detailImages, idx: i })}
                      />
                    )) : (
                      <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', color: surfaceTextMuted }}>
                        <ShoppingBag size={48} strokeWidth={1} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnails: video first */}
                {(videoEmbed || detailImages.length > 1) && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {videoEmbed && (
                      <button onClick={() => { setShowVideo(true); scrollCarouselTo(0); }} className="w-14 h-14 rounded overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${showVideo ? accentColor : surfaceBorderColor}`, backgroundColor: '#000' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </button>
                    )}
                    {detailImages.map((img, i) => (
                      <button key={i} onClick={() => { setShowVideo(false); setActiveImageIndex(i); scrollCarouselTo(videoEmbed ? i + 1 : i); }} className="w-14 h-14 rounded overflow-hidden flex-shrink-0" style={{ border: `2px solid ${!showVideo && i === activeImageIndex ? accentColor : surfaceBorderColor}` }}>
                        <img src={img} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                  </div>
                )}

              </div>

              {/* ── Checkout Column ── */}
              <div className="w-full lg:w-1/2">
                {/* Title + price */}
                <div className="mb-4 text-right">
                  <h1 className="text-2xl font-bold mb-1" style={{ color: textColor }}>{detailProduct.title}</h1>
                  {detailProduct.description && <p className="text-sm mb-3" style={{ color: textMuted }}>{detailProduct.description.slice(0, 80)}</p>}
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>
                    {Math.round(detailPrice ?? 0).toLocaleString()} {currency}
                    {(detailProduct as any).old_price && <span className="text-base line-through mr-3" style={{ color: textMuted }}>{Math.round(((detailProduct as any).old_price) ?? 0).toLocaleString()} {currency}</span>}
                  </div>
                </div>
                {detailProduct.variants?.length > 0 && (
                  <div className="mb-4">
                    <VariantSelector variants={detailProduct.variants} selected={detailVariant} onSelect={setDetailVariant} accentColor={accentColor} currency={currency} basePrice={detailProduct.price} />
                  </div>
                )}
                <div className="p-5 md:p-6" style={{ border: `1px solid ${accentColor}`, borderRadius: 12, backgroundColor: surfaceColor }}>
                  {offers.length > 0 && (
                    <OfferSelector
                      offers={offers}
                      unitPrice={mainProduct?.price || 0}
                      currency={currency}
                      selectedOfferId={selectedOffer?.offer_id ?? null}
                      onSelect={handleOfferSelect}
                      accentColor={accentColor}
                      textColor={surfaceTextColor}
                      borderColor={surfaceBorderColor}
                      className="mb-4"
                      hidePrice={true}
                    />
                  )}

                  <div className="space-y-4">
                    {/* Name + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                        <input
                          type="text"
                          placeholder="الإسم واللقب"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full py-2.5 pr-9 pl-3 rounded-lg text-right text-sm outline-none transition-all"
                          style={{
                            backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff',
                            color: surfaceTextColor,
                            border: `1px solid ${surfaceBorderColor}`,
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                          onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                        />
                      </div>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                        <input
                          type="tel"
                          placeholder="رقم الهاتف"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full py-2.5 pr-9 pl-3 rounded-lg text-right text-sm outline-none transition-all"
                          style={{
                            backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff',
                            color: surfaceTextColor,
                            border: `1px solid ${surfaceBorderColor}`,
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                          onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                        />
                      </div>
                    </div>

                    {/* Wilaya + Commune */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                        <select
                          value={selectedWilayaId ?? ''}
                          onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
                          className="w-full py-2.5 pr-9 pl-3 rounded-lg text-right text-sm outline-none appearance-none transition-all"
                          style={{
                            backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff',
                            color: surfaceTextColor,
                            border: `1px solid ${surfaceBorderColor}`,
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                          onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                        >
                          <option value="">اختر ولايتك</option>
                          {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                        </select>
                      </div>
                      {showCommune && (
                        <div className="relative">
                          <input type="text" placeholder="البلدية" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} />
                        </div>
                      )}
                    </div>
                    {showAddress && <div><input type="text" placeholder="العنوان" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} /></div>}
                    {showNotes && <div><textarea placeholder="ملاحظات" rows={2} className="w-full py-2.5 px-3 rounded-lg text-sm outline-none resize-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} /></div>}

                    {/* Quantity */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-bold" style={{ color: surfaceTextColor }}>الكمية</span>
                      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${surfaceBorderColor}` }}>
                        <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-1.5 text-lg font-bold hover:bg-black/5 transition-colors" style={{ color: surfaceTextMuted }}>−</button>
                        <span className="px-4 py-1.5 font-bold text-sm" style={{ color: surfaceTextColor, borderLeft: `1px solid ${surfaceBorderColor}`, borderRight: `1px solid ${surfaceBorderColor}` }}>{quantity}</span>
                        <button type="button" onClick={() => setQuantity(q => q + 1)} className="px-3 py-1.5 text-lg font-bold hover:bg-black/5 transition-colors" style={{ color: surfaceTextMuted }}>+</button>
                      </div>
                    </div>

                    {/* Delivery Type */}
                    <div className="py-2">
                      <div className="text-sm font-bold mb-2" style={{ color: surfaceTextColor }}>مكان التوصيل</div>
                      <div className="flex gap-6">
                        {showHomeDelivery && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: surfaceTextMuted }}>
                            <input type="radio" name="delivery" checked={deliveryType === 'home'} onChange={() => setDeliveryType('home')} style={{ accentColor }} />
                            <Home size={14} />
                            <span>للمنزل</span>
                          </label>
                        )}
                        {showDeskDelivery && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: surfaceTextMuted }}>
                            <input type="radio" name="delivery" checked={deliveryType === 'desk'} onChange={() => setDeliveryType('desk')} style={{ accentColor }} />
                            <Building2 size={14} />
                            <span>لمكتب التوصيل</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Receipt + Buy button */}
                    <div className="pt-4 space-y-3">
                      <div className="rounded-xl p-3 space-y-1.5 text-sm" style={{ backgroundColor: accentColor + '08', border: `1px solid ${accentColor}20` }}>
                        <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>سعر المنتج {selectedOffer ? `(${selectedOffer.quantity} قطعة)` : `(${quantity})`}</span><span style={{ color: surfaceTextColor }}>{Math.round(productTotal ?? 0).toLocaleString()} {currency}</span></div>
                        <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>التوصيل</span><span style={{ color: deliveryFee > 0 ? surfaceTextColor : accentColor }}>{deliveryFee > 0 ? `${deliveryFee} ${currency}` : 'اختر الولاية'}</span></div>
                        <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px solid ${accentColor}20`, color: surfaceTextColor }}><span>المجموع</span><span style={{ color: accentColor }}>{Math.round(productTotal + deliveryFee).toLocaleString()} {currency}</span></div>
                      </div>
                      <button onClick={handleOrder} disabled={isSubmitting} className="w-full h-12 text-white font-bold rounded-lg transition-opacity disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_button_text')}>{isSubmitting ? 'جاري المعالجة...' : buttonText}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── YOU MAY ALSO LIKE ── */}
            {otherProducts.length > 0 && (
              <section className="mt-20">
                <h3 className="text-xl font-bold text-center mb-8 flex items-center justify-center gap-2" style={{ color: textColor }}>
                  <Heart size={18} style={{ color: accentColor }} />
                  منتجات أخرى
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                  {otherProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>


      {/* ── FOOTER ── */}
      <footer className="mt-20 py-10 text-center" style={{ borderTop: `1px solid ${borderColor}` }}>
        <div className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: textMuted }}>Boutique</div>
        <div className="text-sm font-bold" style={{ color: textColor }}>حول المتجر</div>
        <div className="mt-6 flex justify-center cursor-pointer" onClick={openCatalog}>
          {settings?.store_logo ? (
            <img src={settings.store_logo} alt={storeName} className="w-10 h-10 rounded-full object-cover" style={{ border: `1px solid ${borderColor}` }} />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: accentColor }}>
              {(storeName).charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center mt-4 text-xs" style={{ color: textMuted }}>
          © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
        </div>
      </footer>

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setZoomState(null); }}>
            <X size={20} />
          </button>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded-2xl" />
          </div>
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pb-6 pt-2 overflow-x-auto justify-center" onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((img, i) => (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Preview Modal */}
      {videoPreview && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setVideoPreview(null)}>
          {/* Close button */}
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setVideoPreview(null); }}>
            <X size={20} />
          </button>
          {/* Mute/Unmute toggle */}
          <button 
            className="absolute top-4 left-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); setVideoMuted(!videoMuted); }}
          >
            {videoMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Full width video - removed max-w-4xl constraint */}
            <div className="w-full h-full max-h-[90vh] aspect-video rounded-2xl overflow-hidden">
              {videoPreview.type === 'youtube' ? (
                <iframe 
                  className="w-full h-full" 
                  src={`${videoPreview.url}&mute=${videoMuted ? 1 : 0}`} 
                  allow="autoplay; encrypted-media" 
                  allowFullScreen 
                />
              ) : videoPreview.type === 'video' ? (
                <video 
                  ref={videoRef}
                  className="w-full h-full" 
                  src={videoPreview.url} 
                  autoPlay 
                  muted={videoMuted}
                  loop 
                  playsInline
                  controls={false}
                />
              ) : (
                <iframe 
                  className="w-full h-full" 
                  src={videoPreview.url} 
                  allowFullScreen 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
