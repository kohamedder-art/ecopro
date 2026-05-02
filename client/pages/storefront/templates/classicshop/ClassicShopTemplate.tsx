import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  Search,
  User,
  Phone,
  Truck,
  Check,
  X,
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function ClassicShopTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  onProductView,
  initialProductSlug,
}: TemplateProps) {
  // ── Settings Wiring ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#000000';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const primaryColor = settings?.primary_color || '#0f172a';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'Welcome to our store';
  const heroSubtitle = settings?.template_hero_subtitle || 'استمارة الطلب';
  const buttonText = settings?.template_button_text || 'إشتري الآن';
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
  const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
  const surfaceColor = headerColor;
  const surfaceMuted = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e2e8f0';

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

  const otherProducts = useMemo(() => {
    if (!products) return [];
    return mainProduct ? products.filter(p => p.id !== mainProduct.id) : products;
  }, [products, mainProduct]);

  const mainImages = mainProduct?.images?.length ? mainProduct.images : ['/placeholder.png'];
  const [isLandingPageMode, setIsLandingPageMode] = useState(false);

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  useEffect(() => {
    setIsLandingPageMode(false);
    const url = mainImages[0];
    if (!url || url === '/placeholder.png') return;
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      console.log('[ClassicShop] image ratio:', ratio, 'url:', url);
      setIsLandingPageMode(ratio < 0.6);
    };
    img.onerror = () => console.log('[ClassicShop] image failed to load:', url);
    img.src = url;
  }, [mainImages[0]]);

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

  // ── Image Zoom ──
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);

  // ── Variant & pricing ──
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const productPrice = selectedVariant?.price ?? mainProduct?.price ?? 0;
  const total = productPrice + deliveryFee;

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
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);

  useEffect(() => { setSelectedMainImage(0); setShowVideo(!!videoEmbed); setSelectedVariant(null); }, [mainProduct?.id]);

  // ── Order Submission ──
  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId) { alert('يرجى ملء جميع الحقول'); return; }
    if (!mainProduct) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant?.id ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity ?? 1,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: selectedOffer ? selectedOffer.bundle_price : total,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: [selectedWilaya?.labelAR || '', customerAddress, customerCommune, customerNotes].filter(Boolean).join(' - '),
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
    if (!document.getElementById('inter-font')) {
      const link = document.createElement('link');
      link.id = 'inter-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // ══════════════════════════════════════
  // ORDER SUCCESS SCREEN
  // ══════════════════════════════════════
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Inter', sans-serif" }} dir="rtl">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <Check size={32} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تأكيد طلبك!</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتواصل معك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <button onClick={() => { setOrderSuccess(false); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }} className="mt-6 px-6 py-2 rounded text-white" style={{ backgroundColor: accentColor }}>تسوق مرة أخرى</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // MAIN TEMPLATE RENDER
  // ══════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Inter', sans-serif" }} dir="rtl">

      {/* ── PROMO BAR ── */}
      <div className="py-1.5 text-center text-[10px] uppercase tracking-widest font-medium" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
        <span
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('template_hero_heading')}
        >
          {heroTitle}
        </span>
      </div>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: surfaceColor, borderBottom: `1px solid ${surfaceBorderColor}` }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-full object-cover" />
            ) : null}
            <h1
              className="text-xl font-bold italic tracking-tighter"
              style={{ color: surfaceTextColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('store_name')}
            >
              {storeName}
            </h1>
            <nav className="hidden md:flex gap-6 text-sm font-medium" style={{ color: surfaceTextMuted }}>
              <a href="#" className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = surfaceTextMuted)}>الرئيسية</a>
              <a href="#" className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = surfaceTextMuted)}>الكتالوج</a>
              <a href="#" className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)} onMouseLeave={(e) => (e.currentTarget.style.color = surfaceTextMuted)}>اتصل بنا</a>
            </nav>
          </div>
          <div className="flex items-center gap-5" style={{ color: surfaceTextMuted }}>
            <button><Search size={16} /></button>
            <button><User size={16} /></button>
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

      {mainProduct && (
        <main className="max-w-6xl mx-auto px-4 py-4 lg:py-6">

          {/* ── SPLIT LAYOUT ── */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

            {/* LEFT: Image Gallery */}
            <div className="w-full lg:w-[48%] flex flex-col gap-3 lg:self-stretch">
              <div className="rounded-lg overflow-hidden aspect-[4/5] lg:aspect-auto lg:flex-1 lg:max-h-[70vh]" style={{ backgroundColor: surfaceMuted }}>
                {videoEmbed && showVideo ? (
                  <div className="w-full h-full">
                    {videoEmbed.type === 'youtube' ? (
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                    ) : videoEmbed.type === 'video' ? (
                      <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                    ) : (
                      <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full cursor-pointer" onClick={() => setZoomState({ images: mainImages, idx: selectedMainImage })}>
                    <img src={mainImages[selectedMainImage] || '/placeholder.png'} alt={mainProduct.title} className="w-full h-full object-cover transition-transform hover:scale-105 duration-700" />
                  </div>
                )}
              </div>
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {videoEmbed && (
                    <button onClick={() => setShowVideo(true)} className="flex-shrink-0 w-16 h-16 rounded overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${showVideo ? accentColor : 'transparent'}`, backgroundColor: '#000' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                  )}
                  {mainImages.map((img, i) => (
                    <button key={i} onClick={() => { setShowVideo(false); setSelectedMainImage(i); }} className="flex-shrink-0 w-16 h-16 rounded overflow-hidden" style={{ border: `2px solid ${!showVideo && selectedMainImage === i ? accentColor : 'transparent'}`, opacity: !showVideo && selectedMainImage === i ? 1 : 0.6 }}>
                      <img src={img} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Product info + Order Form */}
            <div className="w-full lg:w-[52%]">
              {/* Product header */}
              <div className="mb-4">
                <h2 className="text-2xl font-bold mb-1" style={{ color: textColor }}>{mainProduct.title}</h2>
                <p className="text-2xl font-black" style={{ color: accentColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</p>
              </div>

              {/* Variant selector */}
              {mainProduct?.variants?.length > 0 && (
                <div className="mb-4">
                  <VariantSelector
                    variants={mainProduct.variants}
                    selected={selectedVariant}
                    onSelect={setSelectedVariant}
                    accentColor={accentColor}
                  />
                </div>
              )}

          {/* ── ORDER FORM CARD ── */}
          <div className="rounded-lg p-5 shadow-sm mb-8" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
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
                <h2
                  className="text-center font-bold text-lg"
                  style={{ color: accentColor }}
                  contentEditable={canManage}
                  suppressContentEditableWarning
                  onBlur={handleTextEdit('template_hero_subtitle')}
                >
                  {heroSubtitle}
                </h2>
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

            <div className="space-y-4">
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
                />
              )}
              <div className="text-right">
                <label className="text-sm font-semibold block mb-1" style={{ color: surfaceTextColor }}>
                  الاسم الكامل <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="الاسم الكامل"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full py-3 pr-10 pl-4 rounded text-right transition-colors outline-none"
                    style={{
                      backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted,
                      color: surfaceTextColor,
                      border: `1px solid ${surfaceBorderColor}`,
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              <div className="text-right">
                <label className="text-sm font-semibold block mb-1" style={{ color: surfaceTextColor }}>
                  الهاتف <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="رقم الهاتف"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full py-3 pr-10 pl-4 rounded text-right transition-colors outline-none"
                    style={{
                      backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted,
                      color: surfaceTextColor,
                      border: `1px solid ${surfaceBorderColor}`,
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              <div className="text-right">
                <label className="text-sm font-semibold block mb-1" style={{ color: surfaceTextColor }}>
                  الولاية <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedWilayaId ?? ''}
                    onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
                    className="w-full py-3 pr-10 pl-4 rounded text-right transition-colors outline-none appearance-none"
                    style={{
                      backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted,
                      color: surfaceTextColor,
                      border: `1px solid ${surfaceBorderColor}`,
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                  >
                    <option value="">اختر الولاية</option>
                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                  </select>
                  <Truck className="absolute right-3 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                </div>
              </div>
              {(showHomeDelivery && showDeskDelivery) && (
                <div className="text-right">
                  <label className="text-sm font-semibold block mb-1" style={{ color: surfaceTextColor }}>نوع التوصيل</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('home')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'home' ? accentColor : (isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted),
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'home' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <span>التوصيل للمنزل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('desk')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'desk' ? accentColor : (isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted),
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'desk' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <span>الاستلام من المكتب</span>
                    </button>
                  </div>
                </div>
              )}
              {showAddress && <div><label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>العنوان</label><input type="text" placeholder="العنوان" className="w-full py-2.5 px-4 rounded transition-colors outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} /></div>}
              {showCommune && <div><label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>البلدية</label><input type="text" placeholder="البلدية" className="w-full py-2.5 px-4 rounded transition-colors outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} /></div>}
              {showNotes && <div><label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>ملاحظات</label><textarea placeholder="ملاحظات" rows={2} className="w-full py-2.5 px-4 rounded transition-colors outline-none resize-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} /></div>}

              {/* Receipt */}
              <div className="rounded p-3 space-y-1.5 text-sm" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.05)' : surfaceMuted }}>
                <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>سعر المنتج</span><span style={{ color: surfaceTextColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</span></div>
                <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>التوصيل</span><span style={{ color: deliveryFee > 0 ? surfaceTextColor : accentColor }}>{deliveryFee > 0 ? `${deliveryFee} ${currency}` : 'اختر الولاية'}</span></div>
                <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}><span>المجموع</span><span style={{ color: accentColor }}>{Math.round(total ?? 0).toLocaleString()} {currency}</span></div>
              </div>

              <button onClick={handleOrder} disabled={isSubmitting} className="w-full py-3 rounded font-bold transition-all flex items-center justify-center gap-3 text-white disabled:opacity-50 active:scale-[0.98]" style={{ backgroundColor: accentColor }}>
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_button_text')}>{isSubmitting ? 'جاري المعالجة...' : buttonText}</span>
              </button>
            </div>
          </div>
            </div>
          </div>

          {/* ── OTHER PRODUCTS ── */}
          {otherProducts.length > 0 && (
            <section className="mt-12">
              <h3 className="font-bold text-lg mb-6" style={{ color: textColor }}>قد يعجبك أيضاً</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {otherProducts.map(product => {
                  const swap = () => { setActiveMainProduct(product); setSelectedMainImage(0); onProductView?.(product); window.scrollTo({ top: 0, behavior: 'smooth' }); };
                  return (
                    <div key={product.id} className="space-y-2 group">
                      <div className="rounded overflow-hidden cursor-pointer" style={{ backgroundColor: surfaceMuted, aspectRatio: '4 / 5' }} onClick={swap}>
                        <img src={product.images?.[0] || '/placeholder.png'} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <p className="text-xs font-medium truncate" style={{ color: textColor }}>{product.title}</p>
                      <p className="text-xs font-bold" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} {currency}</p>
                      <button onClick={swap} className="w-full py-1.5 rounded text-white text-xs font-bold" style={{ backgroundColor: accentColor }}>اطلب →</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      )}

      {/* ── FOOTER ── */}
      <footer className="py-8 mt-12 text-center text-xs" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
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
          {mainImages.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pb-6 pt-2 overflow-x-auto justify-center" onClick={(e) => e.stopPropagation()}>
              {mainImages.map((img, i) => (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
