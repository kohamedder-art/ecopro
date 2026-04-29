import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ChevronDown, Phone, ShoppingCart, ShieldCheck, Home, Building2 } from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function ZenithTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#000000';
  const bgColor = settings?.template_bg_color || '#f3f4f6';
  const primaryColor = settings?.primary_color || '#111827';

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

  const textColor = isDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#6b7280';
  const borderColor = isDark ? '#334155' : '#e5e7eb';
  const surfaceMuted = isDark ? '#0f172a' : '#f3f4f6';
  const surfaceColor = headerColor;
  const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
  const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#6b7280';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e5e7eb';
  const inputBg = isHeaderDark ? 'rgba(255,255,255,0.06)' : '#ffffff';

  const formRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState({ h: 1, m: 59, s: 59 });
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(prev => {
      if (prev.s > 0) return { ...prev, s: prev.s - 1 };
      if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
      if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
      return prev;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [commune, setCommune] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null)
    || (settings?.dzp_main_product_id
    ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id))
    : null) || products?.[0] || {
    id: 0,
    title: 'منتج مميز',
    price: 3900,
    original_price: 6500,
    images: [],
  };

  useEffect(() => { if (mainProduct?.id && onProductView) onProductView(mainProduct as any); }, [mainProduct?.id]);

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); setQuantity(f.quantity); } }, [offers]);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); if (o) setQuantity(o.quantity); else setQuantity(1); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  const productPrice = mainProduct?.price ?? 3900;
  const productImages = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [];

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  const currency = settings?.currency_code || 'د.ج';

  const storeName = settings?.zenith_store_name || settings?.store_name || 'STORE';
  const ctaText = settings?.zenith_cta_text || settings?.template_button_text || 'اطلب الان';
  const formTitle = settings?.zenith_form_title || 'معلومات الطلب';
  const submitText = settings?.zenith_submit_text || 'تأكيد الطلب';

  const { getSlotImages } = useImageClassifier(productImages, 'zenith');
  const classifiedLanding = getSlotImages('landing');

  const landingImages: string[] = (() => {
    if (settings?.zenith_landing_images && Array.isArray(settings.zenith_landing_images) && settings.zenith_landing_images.length > 0) {
      return settings.zenith_landing_images;
    }
    return classifiedLanding.length > 0 ? classifiedLanding : productImages;
  })();

  const totalCost = (productPrice * quantity) + deliveryFee;

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId || !mainProduct?.id) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = [selectedWilaya?.labelAR || '', commune, customerAddress, customerNotes].filter(Boolean).join(' - ');

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity || quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: selectedOffer ? selectedOffer.bundle_price : productPrice * quantity,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          shipping_wilaya_id: selectedWilayaId,
        }),
      });

      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      if (res.ok) {
        setOrderSuccess(true);
      } else {
        alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
    } catch {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: surfaceMuted, color: textColor }} dir="rtl">
        <div className="max-w-md mx-auto rounded-2xl p-8 shadow-xl text-center w-full" style={{ backgroundColor: surfaceColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '15' }}>
            <ShieldCheck size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: surfaceTextColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-sm mb-6" style={{ color: surfaceTextMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right" style={{ backgroundColor: surfaceMuted }}>
            <div className="flex justify-between"><span style={{ color: textMuted }}>المنتج</span><span className="font-bold" style={{ color: textColor }}>{mainProduct.title}</span></div>
            <div className="flex justify-between"><span style={{ color: textMuted }}>الكمية</span><span className="font-bold" style={{ color: textColor }}>{quantity}</span></div>
            <div className="flex justify-between"><span style={{ color: textMuted }}>التوصيل</span><span className="font-bold" style={{ color: textColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} {currency}</span></div>
            <div className="h-px my-1" style={{ backgroundColor: borderColor }} />
            <div className="flex justify-between"><span className="font-black" style={{ color: textColor }}>المجموع</span><span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(totalCost ?? 0).toLocaleString()} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">
      <div className="w-full lg:max-w-6xl lg:mx-auto lg:grid lg:grid-cols-2 lg:shadow-2xl min-h-screen relative" style={{ backgroundColor: surfaceColor }}>

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-50 backdrop-blur-md px-4 py-3 flex items-center justify-between lg:col-span-2" style={{ backgroundColor: surfaceColor + 'f2', borderBottom: `1px solid ${surfaceBorderColor}` }}>
          <div className="flex items-center gap-2">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <div className="font-black text-xl tracking-wider" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('zenith_store_name')}>
              {storeName}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left flex flex-col">
              <span className="text-xs font-bold" style={{ color: surfaceTextMuted }}>السعر</span>
              <span className="font-black text-lg leading-none" style={{ color: surfaceTextColor }} dir="ltr">{Math.round(productPrice ?? 0).toLocaleString()} {currency}</span>
            </div>
            <button onClick={scrollToForm} className="text-white px-5 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition-transform" style={{ backgroundColor: accentColor }}>
              {ctaText}
            </button>
          </div>
        </div>

        {/* ── LEFT COL: images ── */}
        <div className="lg:sticky lg:top-12 lg:h-[calc(100vh-48px)] lg:overflow-y-auto">
          {/* Discount badge */}
          <div className="relative">
            {(mainProduct as any)?.original_price && (mainProduct as any).original_price > productPrice && (
              <div className="absolute top-3 right-3 z-10 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg" style={{ backgroundColor: accentColor }}>
                وفّر {Math.round((1 - productPrice / (mainProduct as any).original_price) * 100)}%
              </div>
            )}
            <div className="w-full flex flex-col">
              {videoEmbed && (
                <div className="w-full aspect-video">
                  {videoEmbed.type === 'youtube' ? (
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                  ) : videoEmbed.type === 'video' ? (
                    <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                  ) : (
                    <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                  )}
                </div>
              )}
              {landingImages.length > 0 ? (
                landingImages.map((imgUrl, index) => (
                  <img key={index} src={imgUrl} alt={`Landing slice ${index + 1}`} className="w-full h-auto block cursor-pointer" loading={index === 0 ? 'eager' : 'lazy'} onClick={() => setZoomState({ images: landingImages, idx: index })} />
                ))
              ) : (
                <div className="w-full aspect-[3/4] flex items-center justify-center" style={{ background: `linear-gradient(to bottom, ${borderColor}, ${surfaceMuted})` }}>
                  <p className="text-sm" style={{ color: textMuted }}>أضف صور المنتج من لوحة التحكم</p>
                </div>
              )}
            </div>
          </div>

          {/* Social proof */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
            <div className="flex -space-x-1.5 rtl:space-x-reverse">
              {['#f97316','#e11d48','#8b5cf6','#0ea5e9'].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: c, borderColor: surfaceColor }}>
                  {['أ','م','ي','س'][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className="text-xs" style={{ color: '#fbbf24' }}>★</span>)}</div>
              <p className="text-xs font-bold" style={{ color: surfaceTextMuted }}>+240 عميل سعيد هذا الشهر</p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 px-4 py-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
            {[{icon: '📦', text: 'توصيل 58 ولاية'}, {icon: '💳', text: 'دفع عند الاستلام'}, {icon: '✅', text: 'ضمان الجودة'}].map((b, i) => (
              <div key={i} className="text-center p-2 rounded-xl" style={{ backgroundColor: surfaceMuted }}>
                <div className="text-xl mb-1">{b.icon}</div>
                <p className="text-[10px] font-bold" style={{ color: surfaceTextMuted }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COL: form ── */}
        <div className="lg:overflow-y-auto lg:h-[calc(100vh-48px)]">

        {/* ── ORDER FORM ── */}
        <div ref={formRef} className="p-5 pb-24 lg:pb-6" style={{ backgroundColor: surfaceMuted }} id="checkout-form">

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: accentColor + '15', border: `1px solid ${accentColor}30` }}>
            <span className="text-xs font-bold" style={{ color: accentColor }}>ينتهي العرض خلال:</span>
            {[{ v: timeLeft.h, l: 'سا' }, { v: timeLeft.m, l: 'د' }, { v: timeLeft.s, l: 'ث' }].map(({ v, l }) => (
              <div key={l} className="flex items-center gap-0.5">
                <span className="text-white text-sm font-black w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                  {String(v).padStart(2, '0')}
                </span>
                <span className="text-xs font-bold" style={{ color: accentColor }}>{l}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
            <h2 className="text-xl font-black text-center mb-6" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('zenith_form_title')}>
              {formTitle}
            </h2>

            <form onSubmit={handleOrder} className="space-y-4">
              {(mainProduct as any)?.variants && (mainProduct as any).variants.length > 0 && (
                <VariantSelector
                  variants={(mainProduct as any).variants}
                  selected={selectedVariant}
                  onSelect={setSelectedVariant}
                  accentColor={accentColor}
                  currency={currency}
                  basePrice={mainProduct.price}
                />
              )}
              {offers.length > 0 && (
                <OfferSelector
                  offers={offers}
                  unitPrice={productPrice}
                  currency={currency}
                  selectedOfferId={selectedOffer?.offer_id ?? null}
                  onSelect={handleOfferSelect}
                  accentColor={accentColor}
                  textColor={surfaceTextColor}
                  borderColor={surfaceBorderColor}
                />
              )}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>الاسم و اللقب</label>
                <input type="text" required placeholder="أدخل اسمك الكامل"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                  style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}
                  onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                  value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>رقم الهاتف</label>
                <div className="relative">
                  <input type="tel" required dir="ltr" placeholder="05 55 55 55 55"
                    className="w-full rounded-lg px-4 py-3 text-right text-sm outline-none transition-all"
                    style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}
                    onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                    value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <Phone size={18} className="absolute left-3 top-3.5" style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>الولاية</label>
                <div className="relative">
                  <select required
                    className="w-full rounded-lg px-4 py-3 text-sm appearance-none outline-none transition-all"
                    style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}
                    onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                    value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">اختر الولاية</option>
                    {wilayas.map((w) => (
                      <option key={w.id} value={w.id}>{String(w.id).padStart(2, '0')} - {w.labelAR}{w.homePrice ? ` (${w.homePrice} ${currency})` : ''}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute left-3 top-3.5 pointer-events-none" style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              {showCommune && <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>البلدية</label>
                <input type="text" placeholder="أدخل بلديتك"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                  style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}
                  onFocus={(e) => e.currentTarget.style.borderColor = accentColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = surfaceBorderColor}
                  value={commune} onChange={(e) => setCommune(e.target.value)} />
              </div>}
              {showAddress && <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>العنوان</label>
                <input type="text" placeholder="عنوان التوصيل" className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all" style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>}
              {showNotes && <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>ملاحظات</label>
                <textarea placeholder="ملاحظات إضافية" rows={2} className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all resize-none" style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />
              </div>}
              {(showHomeDelivery && showDeskDelivery) && (
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>نوع التوصيل</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('home')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'home' ? accentColor : inputBg,
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'home' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <Home size={16} />
                      <span className="text-sm font-bold">التوصيل للمنزل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('desk')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'desk' ? accentColor : inputBg,
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'desk' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <Building2 size={16} />
                      <span className="text-sm font-bold">الاستلام من المكتب</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <label className="block text-sm font-bold mb-1.5" style={{ color: surfaceTextMuted }}>الكمية</label>
                <div className="flex items-center justify-between rounded-lg p-1" style={{ backgroundColor: surfaceMuted, border: `1px solid ${surfaceBorderColor}` }}>
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-md font-bold text-xl flex items-center justify-center active:opacity-70"
                    style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}>-</button>
                  <span className="font-black text-lg" style={{ color: surfaceTextColor }}>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-md font-bold text-xl flex items-center justify-center active:opacity-70"
                    style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}`, color: surfaceTextColor }}>+</button>
                </div>
              </div>

              <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: surfaceMuted, border: `1px solid ${surfaceBorderColor}` }}>
                <div className="flex justify-between text-sm mb-2" style={{ color: textMuted }}>
                  <span>سعر المنتج ({quantity})</span>
                  <span className="font-bold" style={{ color: textColor }} dir="ltr">{Math.round(productPrice * quantity).toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between text-sm mb-3" style={{ color: textMuted }}>
                  <span>سعر التوصيل</span>
                  <span className="font-bold" style={{ color: textColor }} dir="ltr">{Math.round(deliveryFee ?? 0).toLocaleString()} {currency}</span>
                </div>
                <div className="h-px w-full mb-3" style={{ backgroundColor: borderColor }} />
                <div className="flex justify-between items-center">
                  <span className="font-black text-lg" style={{ color: textColor }}>المجموع:</span>
                  <span className="font-black text-xl" style={{ color: accentColor }} dir="ltr">{Math.round(totalCost ?? 0).toLocaleString()} {currency}</span>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full mt-2 text-white text-lg font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: accentColor }}>
                {isSubmitting ? 'جاري الإرسال...' : (
                  <>
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('zenith_submit_text')}>{submitText}</span>
                    <ShoppingCart size={20} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1 mt-3 text-xs font-bold" style={{ color: textMuted }}>
                <ShieldCheck size={14} style={{ color: accentColor }} />
                الدفع يكون بعد استلام المنتج
              </div>
            </form>
          </div>
        </div>

        {/* Platform Footer */}
        <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
          © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
        </footer>
        </div>{/* end right col */}
      </div>

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
