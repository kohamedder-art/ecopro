import React, { useState, useMemo, useEffect } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  User,
  Phone,
  MapPin,
  Check,
  X,
  Zap,
  ChevronDown,
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function JewelHeartTemplate({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  onProductView,
  initialProductSlug,
}: TemplateProps) {
  // ── Settings Wiring ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#ef4444';
  const bgColor = settings?.template_bg_color || '#f0f9ff';
  const primaryColor = settings?.primary_color || '#0f172a';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'مرحباً بكم في متجرنا - عروض حصرية لفترة محدودة';
  const heroSubtitle = settings?.template_hero_subtitle || '';
  const buttonText = settings?.template_button_text || 'اشتري الآن';
  const storeName = settings?.store_name || 'المتجر';

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

  // Form border uses a tinted version of accent
  const formBorderColor = accentColor + '40';

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
    return mainProduct ? products.filter((p: any) => p.id !== mainProduct.id) : products;
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

  // ── Delivery System ──
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  // ── Variant & Pricing ──
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const productPrice = selectedVariant?.price ?? mainProduct?.price ?? 0;
  const total = productPrice + deliveryFee;

  // ── Image Gallery State ──
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

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
          delivery_type: 'desk',
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تأكيد طلبك!</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتواصل معك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <button onClick={() => { setOrderSuccess(false); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }} className="mt-6 px-6 py-2 rounded-xl text-white" style={{ backgroundColor: accentColor }}>تسوق مرة أخرى</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // MAIN TEMPLATE RENDER
  // ══════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">

      {/* ── PROMO BAR ── */}
      <div className="py-2 text-center text-sm font-bold flex items-center justify-center gap-2" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
        <Zap size={14} />
        <span
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('template_hero_heading')}
        >
          {heroTitle}
        </span>
      </div>

      {/* ── HEADER ── */}
      <header className="py-4 px-6 sticky top-0 z-50 shadow-sm" style={{ backgroundColor: surfaceColor }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShoppingBag size={20} style={{ color: surfaceTextMuted }} />
          </div>

          <div className="flex items-center gap-2">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="px-4 py-1 rounded italic font-bold text-lg text-white" style={{ backgroundColor: accentColor }}>
                <span
                  contentEditable={canManage}
                  suppressContentEditableWarning
                  onBlur={handleTextEdit('store_name')}
                >
                  {storeName}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2" style={{ color: surfaceTextMuted }}>
            <span className="text-sm font-medium">التصنيفات</span>
            <ChevronDown size={12} />
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
        <main className="max-w-6xl mx-auto p-4 md:p-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* ── RIGHT: Product Image ── */}
            <div className="w-full lg:w-1/2 flex flex-col gap-3 lg:self-stretch">
              <div className="p-2 rounded-3xl shadow-lg aspect-[4/5] lg:aspect-auto lg:flex-1 lg:max-h-[70vh] overflow-hidden" style={{ backgroundColor: surfaceColor }}>
                {videoEmbed && showVideo ? (
                  <div className="w-full h-full rounded-2xl overflow-hidden">
                    {videoEmbed.type === 'youtube' ? (
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                    ) : videoEmbed.type === 'video' ? (
                      <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                    ) : (
                      <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full cursor-pointer" onClick={() => setZoomImage(mainImages[selectedMainImage] || mainImages[0])}>
                    <img src={mainImages[selectedMainImage] || mainImages[0] || '/placeholder.png'} alt={mainProduct.title} className="w-full h-full rounded-2xl object-cover transition-transform hover:scale-105 duration-700" />
                  </div>
                )}
              </div>
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 mt-4 px-2 overflow-x-auto pb-1">
                  {videoEmbed && (
                    <button onClick={() => setShowVideo(true)} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${showVideo ? accentColor : surfaceBorderColor}`, backgroundColor: '#000' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                  )}
                  {mainImages.map((img, i) => (
                    <button key={i} onClick={() => { setShowVideo(false); setSelectedMainImage(i); }} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer" style={{ border: `2px solid ${!showVideo && i === selectedMainImage ? accentColor : surfaceBorderColor}` }}>
                      <img src={img} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 text-right px-2">
                <p className="leading-relaxed text-sm md:text-base" style={{ color: textMuted }}>
                  {mainProduct.description || heroSubtitle || 'منتج عالي الجودة بتصميم أنيق'}
                </p>
              </div>
            </div>

            {/* ── LEFT: Checkout Section ── */}
            <div className="w-full lg:w-1/2">
              <div className="text-right mb-6">
                <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: textColor }}>{mainProduct.title}</h1>
                {mainProduct.description && (
                  <p className="text-sm mb-4" style={{ color: textMuted }}>
                    {mainProduct.description.slice(0, 60)}
                  </p>
                )}
                <div className="text-3xl font-black" style={{ color: accentColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</div>
                {(mainProduct as any).old_price && (
                  <span className="text-lg line-through mr-2" style={{ color: textMuted }}>{Math.round(((mainProduct as any).old_price) ?? 0).toLocaleString()} {currency}</span>
                )}
              </div>

              {/* Variant selector */}
              {mainProduct?.variants?.length > 0 && (
                <div className="mb-4">
                  <VariantSelector variants={mainProduct.variants} selected={selectedVariant} onSelect={setSelectedVariant} accentColor={accentColor} />
                </div>
              )}

              {/* ── FORM CONTAINER ── */}
              <div className="p-6 md:p-8 rounded-[20px]" style={{ backgroundColor: surfaceColor, border: `2px solid ${formBorderColor}` }}>
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
                <div className="space-y-4">
                  {/* Name + Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                      <input
                        type="text"
                        placeholder="الاسم الكامل"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full py-3 pr-10 pl-4 rounded-xl text-right transition-all outline-none"
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
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                      <input
                        type="tel"
                        placeholder="رقم الهاتف"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full py-3 pr-10 pl-4 rounded-xl text-right transition-all outline-none"
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

                  {/* Wilaya */}
                  <div className="relative">
                    <MapPin className="absolute right-4 top-1/2 -translate-y-1/2" size={16} style={{ color: surfaceTextMuted }} />
                    <select
                      value={selectedWilayaId ?? ''}
                      onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
                      className="w-full py-3 pr-10 pl-4 rounded-xl text-right transition-all outline-none appearance-none"
                      style={{
                        backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff',
                        color: surfaceTextColor,
                        border: `1px solid ${surfaceBorderColor}`,
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                      onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                    >
                      <option value="">الولاية</option>
                      {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                    </select>
                  </div>
                  {showAddress && <input type="text" placeholder="العنوان" className="w-full py-3 px-4 rounded-xl text-right outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                  {showCommune && <input type="text" placeholder="البلدية" className="w-full py-3 px-4 rounded-xl text-right outline-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} />}
                  {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full py-3 px-4 rounded-xl text-right outline-none resize-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.06)' : '#fff', color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}

                  {/* Receipt */}
                  <div className="mt-4 rounded-2xl p-3 space-y-1.5 text-sm" style={{ backgroundColor: accentColor + '08', border: `1px solid ${accentColor}20` }}>
                    <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>سعر المنتج</span><span style={{ color: surfaceTextColor }}>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</span></div>
                    <div className="flex justify-between" style={{ color: surfaceTextMuted }}><span>التوصيل</span><span style={{ color: deliveryFee > 0 ? surfaceTextColor : accentColor }}>{deliveryFee > 0 ? `${deliveryFee} ${currency}` : 'اختر الولاية'}</span></div>
                    <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px solid ${accentColor}20`, color: surfaceTextColor }}><span>المجموع</span><span style={{ color: accentColor }}>{Math.round(total ?? 0).toLocaleString()} {currency}</span></div>
                  </div>

                  <button onClick={handleOrder} disabled={isSubmitting} className="w-full mt-4 py-4 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50" style={{ background: `linear-gradient(to left, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 8px 20px ${accentColor}30` }}>
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_button_text')}>{isSubmitting ? 'جاري المعالجة...' : buttonText}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── OTHER PRODUCTS ── */}
          {otherProducts.length > 0 && (
            <section className="mt-16">
              <h3 className="font-bold text-lg mb-6" style={{ color: textColor }}>منتجات أخرى</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {otherProducts.map((product: any) => {
                  const swap = () => { setActiveMainProduct(product); setSelectedMainImage(0); onProductView?.(product); window.scrollTo({ top: 0, behavior: 'smooth' }); };
                  return (
                    <div key={product.id} className="space-y-2 group">
                      <div className="rounded-2xl overflow-hidden shadow-sm cursor-pointer" style={{ backgroundColor: surfaceMuted, aspectRatio: '4 / 5' }} onClick={swap}>
                        <img src={product.images?.[0] || '/placeholder.png'} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <p className="text-xs font-medium truncate" style={{ color: textColor }}>{product.title}</p>
                      <p className="text-xs font-bold" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} {currency}</p>
                      <button onClick={swap} className="w-full py-1.5 rounded-xl text-white text-xs font-bold" style={{ backgroundColor: accentColor }}>اطلب →</button>
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
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-right">
          <div>
            <h4 className="font-bold mb-4" style={{ color: surfaceTextColor }}>عن المتجر</h4>
            <p className="text-sm leading-relaxed" style={{ color: surfaceTextMuted }}>نوفر لكم أرقى المنتجات بجودة عالية وأسعار تنافسية مع خدمة التوصيل السريع لجميع الولايات.</p>
          </div>
          <div>
            <h4 className="font-bold mb-4" style={{ color: surfaceTextColor }}>روابط سريعة</h4>
            <ul className="text-sm space-y-2" style={{ color: surfaceTextMuted }}>
              <li>سياسة الخصوصية</li>
              <li>شروط الاستخدام</li>
              <li>سياسة التوصيل</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4" style={{ color: surfaceTextColor }}>تواصل معنا</h4>
            <div className="flex justify-end gap-4" style={{ color: surfaceTextMuted }}>
              <Phone size={20} />
              <ShoppingBag size={20} />
            </div>
          </div>
        </div>
        <div className="text-center mt-8 text-xs" style={{ color: surfaceTextMuted }}>
          © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
        </div>
      </footer>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
            <X size={20} />
          </button>
          <img src={zoomImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
          {mainImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {mainImages.map((img, i) => (
                <div
                  key={i}
                  className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all"
                  style={{ border: zoomImage === img ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.3)', opacity: zoomImage === img ? 1 : 0.6 }}
                  onClick={(e) => { e.stopPropagation(); setZoomImage(img); }}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
