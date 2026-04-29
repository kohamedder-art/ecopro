import React, { useState, useMemo, useEffect } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  Star,
  Truck,
  ShieldCheck,
  Package,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Phone,
  User,
  MapPin,
  Clock,
  ArrowRight,
  X,
  Check,
} ,
  Home, Building2
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function Bassem28Template({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
  onProductView,
  initialProductSlug,
}: TemplateProps) {
  // ── Settings Wiring ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#f39c12';
  const bgColor = settings?.template_bg_color || settings?.bassem28_bg_color || '#fafafa';
  const primaryColor = settings?.primary_color || '#0f172a';
  const currency = settings?.currency_code || 'د.ج';

  const heroTitle = settings?.template_hero_heading || 'Ignite Your Presence 🔥';
  const heroSubtitle = settings?.template_hero_subtitle || 'عطر مميز يجمع بين الفخامة والحضور';
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

  // ── Other products ──
  const otherProducts = useMemo(() => {
    if (!products) return [];
    return mainProduct ? products.filter(p => p.id !== mainProduct.id) : products;
  }, [products, mainProduct]);

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
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

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

  // ── Image / FAQ state ──
  const [selectedMainImage, setSelectedMainImage] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    setSelectedMainImage(0);
    setShowVideo(!!videoEmbed);
    setSelectedVariant(null);
  }, [mainProduct?.id]);

  // ── Order Submission ──
  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
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
      if (!res.ok) {
        alert(data.error || 'خطأ في الطلب');
        return;
      }
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
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
      link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // ── FAQ Data ──
  const faqs = [
    { q: settings?.bassem28_faq1_q || 'وصف المنتج بالتفصيل', a: settings?.bassem28_faq1_a || 'عطر مميز جداً يجمع بين الفخامة والحضور. نوتات عليا من الحليب والفواكه، قلب من الفانيليا الدافئة، وقاعدة من العود والمسك.' },
    { q: settings?.bassem28_faq2_q || 'سياسة التوصيل والاسترجاع', a: settings?.bassem28_faq2_a || 'توصيل سريع خلال 24 إلى 48 ساعة. الاسترجاع متاح في حال وجود أي خلل مصنعي أو عدم مطابقة للمواصفات.' },
    { q: settings?.bassem28_faq3_q || 'طريقة الاستخدام والنصائح', a: settings?.bassem28_faq3_a || 'يفضل رشه على مناطق النبض للحصول على أفضل ثبات وفواحان يدوم طويلاً.' },
  ];

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
          <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>تم تأكيد طلبك!</h2>
          <p className="mb-6" style={{ color: textMuted }}>سنتواصل معك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <button
            onClick={() => { setOrderSuccess(false); setCustomerName(''); setCustomerPhone(''); setSelectedWilayaId(null); }}
            className="mt-6 px-6 py-2 rounded-lg text-white"
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
          onBlur={handleTextEdit('bassem28_banner_text')}
        >
          {settings?.bassem28_banner_text || 'تخفيضات حصرية لفترة محدودة ⚡ شحن سريع لـ 58 ولاية'}
        </span>
      </div>

      {/* ── HEADER / NAV ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ backgroundColor: surfaceColor + 'cc', borderBottom: `1px solid ${surfaceBorderColor}` }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={storeName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accentColor }}>
                {storeName.charAt(0)}
              </div>
            )}
            <h1
              className="text-xl font-black tracking-tighter"
              style={{ color: surfaceTextColor }}
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

      {mainProduct && (
        <main className="max-w-6xl mx-auto px-4 py-4 lg:py-6">

          {/* ── SPLIT LAYOUT: Images LEFT, Form RIGHT ── */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

            {/* LEFT: Image Gallery */}
            <div className="w-full lg:w-[48%] flex flex-col gap-3 lg:self-stretch">
              {/* Main display: video or image */}
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/5] lg:aspect-auto lg:flex-1 min-h-[300px] lg:max-h-[70vh]" style={{ backgroundColor: surfaceMuted }}>
                {videoEmbed && showVideo ? (
                  <div className="relative w-full h-full" style={{ paddingTop: videoEmbed.type !== 'video' ? '0' : undefined }}>
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
              {/* Thumbnails: video first, then images */}
              {(videoEmbed || mainImages.length > 1) && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {videoEmbed && (
                    <button onClick={() => setShowVideo(true)} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ border: `2px solid ${showVideo ? accentColor : 'transparent'}`, backgroundColor: '#000' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                  )}
                  {mainImages.map((img, i) => (
                    <button key={i} onClick={() => { setShowVideo(false); setSelectedMainImage(i); }} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden" style={{ border: `2px solid ${!showVideo && selectedMainImage === i ? accentColor : 'transparent'}` }}>
                      <img src={img} className="w-full h-full object-cover" alt="" />
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

              {/* Variants */}
              {mainProduct.variants && mainProduct.variants.length > 0 && (
                <VariantSelector variants={mainProduct.variants} selected={selectedVariant} onSelect={setSelectedVariant} accentColor={accentColor} currency={currency} basePrice={mainProduct.price} />
              )}

              {/* Order Form */}
              <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
                <h3 className="text-sm font-black text-center pb-2" style={{ color: surfaceTextColor, borderBottom: `1px solid ${surfaceBorderColor}` }}>إستمارة الطلب</h3>

                {offers.length > 0 && (
                  <OfferSelector offers={offers} unitPrice={mainProduct?.price || 0} currency={currency} selectedOfferId={selectedOffer?.offer_id ?? null} onSelect={handleOfferSelect} accentColor={accentColor} textColor={surfaceTextColor} borderColor={surfaceBorderColor} />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                    <input type="text" placeholder="الاسم الكامل" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg py-2 pr-9 pl-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />
                  </div>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                    <input type="tel" placeholder="رقم الهاتف" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full rounded-lg py-2 pr-9 pl-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />
                  </div>
                </div>

                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2" size={14} style={{ color: surfaceTextMuted }} />
                  <select value={selectedWilayaId ?? ''} onChange={e => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full rounded-lg py-2 pr-9 pl-3 text-sm outline-none font-bold appearance-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }}>
                    <option value="">اختر الولاية</option>
                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                  </select>
                </div>

                {showAddress && <input type="text" placeholder="العنوان" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full rounded-lg py-2 px-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />}
                {showCommune && <input type="text" placeholder="البلدية" value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} className="w-full rounded-lg py-2 px-3 text-sm outline-none font-bold" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />}
                {showNotes && <textarea placeholder="ملاحظات" rows={2} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="w-full rounded-lg py-2 px-3 text-sm outline-none font-bold resize-none" style={{ backgroundColor: isHeaderDark ? 'rgba(255,255,255,0.08)' : surfaceMuted, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} />}

                {/* Receipt */}
                <div className="rounded-lg p-2.5 space-y-1.5 text-xs" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : surfaceMuted }}>
                  <div className="flex justify-between font-bold" style={{ color: surfaceTextColor }}>
                    <span>سعر المنتج</span><span>{Math.round(productPrice ?? 0).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between font-bold" style={{ color: surfaceTextColor }}>
                    <span>التوصيل</span><span>{selectedWilayaId ? `${deliveryFee} ${currency}` : '--'}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm pt-1" style={{ color: accentColor, borderTop: `1px solid ${surfaceBorderColor}` }}>
                    <span>المجموع</span><span>{selectedWilayaId ? `${total} ${currency}` : '--'}</span>
                  </div>
                </div>

                <button onClick={handleOrder} disabled={isSubmitting} className="w-full py-3 rounded-xl font-black text-base text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                  <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_button_text')}>{isSubmitting ? 'جاري المعالجة...' : buttonText}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════
              OTHER PRODUCTS GRID
              ═══════════════════════════════════ */}
          {otherProducts.length > 0 && (
            <section className="mt-16">
              <h3 className="text-2xl font-black mb-8" style={{ color: textColor }}>منتجات أخرى</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {otherProducts.map(product => {
                  const swapProduct = () => { setActiveMainProduct(product); setSelectedMainImage(0); onProductView?.(product); window.scrollTo({ top: 0, behavior: 'smooth' }); };
                  return (
                  <div key={product.id} className="rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
                    <div className="overflow-hidden cursor-pointer" style={{ aspectRatio: '4 / 5' }} onClick={swapProduct}>
                      <img
                        src={product.images?.[0] || '/placeholder.png'}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                      />
                    </div>
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

          {/* ═══════════════════════════════════
              FAQ ACCORDION
              ═══════════════════════════════════ */}
          <section className="mt-12 space-y-4">
            {faqs.map((item, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full p-6 flex items-center justify-between font-black"
                  style={{ color: surfaceTextColor }}
                >
                  <span>{item.q}</span>
                  {openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 leading-relaxed font-medium" style={{ color: surfaceTextMuted }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </section>
        </main>
      )}


      {/* ── FOOTER ── */}
      <footer className="py-12 mt-20" style={{ backgroundColor: surfaceColor, borderTop: `1px solid ${surfaceBorderColor}` }}>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black mb-4" style={{ color: surfaceTextColor }}>{storeName}</h2>
          <p className="text-sm font-bold mb-8" style={{ color: surfaceTextMuted }}>{heroTitle}</p>
          <div className="flex justify-center gap-6 mb-8">
            <Phone size={20} style={{ color: surfaceTextMuted }} />
            <ShoppingBag size={20} style={{ color: surfaceTextMuted }} />
          </div>
          <p className="text-xs font-bold" style={{ color: surfaceTextMuted }}>© {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
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
    </div>
  );
}
