import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, Phone, ShoppingCart, ShieldCheck } from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import { isValidAlgerianPhone } from '@/lib/utils';
import { buildStoreUrl } from '@/lib/resolvedStore';

export default function ZenithTemplate({ settings, products, canManage, storeSlug, initialProductSlug, navigate, onProductView }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#000000';
  const bgColor = settings?.template_bg_color || '#f3f4f6';
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);
  const textColor = isDark ? '#f1f5f9' : '#1f2937';
  const textMuted = isDark ? '#94a3b8' : '#6b7280';
  const borderColor = isDark ? '#334155' : '#e5e7eb';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const surfaceMuted = isDark ? '#0f172a' : '#f9fafb';
  const formRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);

  // Clear commune when wilaya changes
  useEffect(() => { setCommuneId(''); }, [selectedWilayaId]);

  // Main product — supports initialProductSlug for direct URL access
  const [currentSlug, setCurrentSlug] = useState<string | null>(initialProductSlug || null);

  const mainProduct = useMemo(() => {
    // 1. If URL has a product slug, find it
    if (currentSlug) {
      const found = products?.find((p: any) => p.slug === currentSlug);
      if (found) return found;
    }
    // 2. If settings has a main product ID, find it
    if (settings?.dzp_main_product_id) {
      const found = products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id));
      if (found) return found;
    }
    // 3. Fallback to first product
    return products?.[0] || null;
  }, [currentSlug, products, settings?.dzp_main_product_id]);

  // Fire product view tracking when mainProduct changes
  useEffect(() => { if (mainProduct && onProductView) onProductView(mainProduct); }, [mainProduct?.id, onProductView]);

  // Navigate to a product
  const goToProduct = useCallback((product: any) => {
    if (product?.slug && navigate) {
      navigate(buildStoreUrl(storeSlug, product.slug));
    }
  }, [storeSlug, navigate]);

  // Go to full store page
  const goToStore = useCallback(() => {
    if (navigate) {
      navigate(buildStoreUrl(storeSlug, '/'));
    }
  }, [storeSlug, navigate]);

  // Sync with initialProductSlug changes (bidirectional — clears when navigating back to store)
  useEffect(() => {
    const next = initialProductSlug || null;
    if (next !== currentSlug) {
      setCurrentSlug(next);
    }
  }, [initialProductSlug]);

  // Variant and Offer support
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };

  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const baseDeliveryFee = selectedWilaya
    ? (selectedDeliveryType === 'desk' ? (selectedWilaya.deskPrice ?? selectedWilaya.homePrice ?? 0) : (selectedWilaya.homePrice ?? 0))
    : 0;
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Safe fallbacks after mainProduct declaration
  const safeProduct = mainProduct || { id: 0, title: 'منتج مميز', price: 3900, original_price: 6500, images: [], variants: [] };
  const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
  const productPrice = variantPrice ?? safeProduct.price ?? 3900;
  const productImages = safeProduct.images && safeProduct.images.length > 0 ? safeProduct.images : [];
  const currency = settings?.currency_code || 'د.ج';

  // Editable text fields
  const storeName = settings?.zenith_store_name || settings?.store_name || 'STORE';
  const ctaText = settings?.zenith_cta_text || settings?.template_button_text || 'اطلب الان';
  const formTitle = settings?.zenith_form_title || 'معلومات الطلب';
  const submitText = settings?.zenith_submit_text || 'تأكيد الطلب';

  // Smart image classification: prefers tall images for landing strips
  const { getSlotImages } = useImageClassifier(productImages, 'zenith');
  const classifiedLanding = getSlotImages('landing');

  // Landing images (stacked Canva slices)
  const landingImages: string[] = (() => {
    if (settings?.zenith_landing_images && Array.isArray(settings.zenith_landing_images) && settings.zenith_landing_images.length > 0) {
      return settings.zenith_landing_images;
    }
    return classifiedLanding.length > 0 ? classifiedLanding : productImages;
  })();

  const displayPrice = (n: number) => Math.round(n);
  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : productPrice * quantity;
  const totalCost = productTotal + deliveryFee;

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.setAttribute('data-setting-key', key);
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId || !mainProduct?.id) {
      setOrderError('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    if (!isValidAlgerianPhone(customerPhone)) {
      setPhoneError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      setOrderError('الرجاء تأكد من رقم الهاتف');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = `${selectedWilaya?.labelAR || ''} - ${communeDisplayName(getAlgeriaCommuneById(communeId)!) || ''}${customerAddress ? ` - ${customerAddress}` : ''}`;

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity || quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: productTotal,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          customer_notes: customerNotes,
          product_name: mainProduct.title || mainProduct.name || '',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastOrderId(data.order?.id || null);
        setLastTelegramUrl(data.telegramStartUrl || null);
        setOrderSuccess(true);
        trackAllPixels(PixelEvents.PURCHASE, {
          content_name: mainProduct?.title || mainProduct?.name || '',
          content_ids: mainProduct?.id ? [mainProduct.id] : [],
          content_type: 'product',
          value: productTotal,
          currency: settings?.currency_code || 'DZD',
          num_items: selectedOffer?.quantity || quantity,
          order_id: data?.order?.id || null,
        });
      } else {
        setOrderError(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
    } catch {
      setOrderError('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bgColor, color: textColor, fontFamily: "'Cairo', sans-serif" }} dir="rtl">
        <div className="max-w-md mx-auto rounded-2xl p-8 shadow-xl text-center w-full" style={{ backgroundColor: cardBg }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <ShieldCheck size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: textColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-sm mb-6" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right mb-4" style={{ backgroundColor: surfaceMuted }}>
            <div className="flex justify-between"><span style={{ color: textMuted }}>المنتج</span><span className="font-bold" style={{ color: textColor }}>{mainProduct.title}</span></div>
            <div className="flex justify-between"><span style={{ color: textMuted }}>الكمية</span><span className="font-bold" style={{ color: textColor }}>{quantity}</span></div>
            <div className="flex justify-between"><span style={{ color: textMuted }}>التوصيل</span><span className="font-bold" style={{ color: textColor }}>{displayPrice(deliveryFee)} {currency}</span></div>
            <div className="h-px my-1" style={{ backgroundColor: borderColor }} />
            <div className="flex justify-between"><span className="font-black" style={{ color: textColor }}>المجموع</span><span className="font-black text-lg" style={{ color: textColor }}>{displayPrice(totalCost)} {currency}</span></div>
          </div>
          <button onClick={() => setOrderSuccess(false)} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>
            تسوق مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  // ── STORE GRID VIEW (multi-product, no product selected) ──
  const showStoreGrid = !currentSlug && (products?.length || 0) > 1;

  if (showStoreGrid) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: surfaceMuted, color: textColor }} dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: cardBg, borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 shrink-0">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-7 h-7 rounded-full object-cover" />}
            <div className="font-bold text-base" style={{ color: textColor }}>
              {storeName}
            </div>
          </div>
          {/* Search bar (desktop) */}
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 px-3 py-2 rounded-full" style={{ backgroundColor: surfaceMuted }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <span className="text-sm" style={{ color: textMuted }}>ابحث في المنتجات...</span>
          </div>
          <span className="text-xs shrink-0" style={{ color: textMuted }}>{products?.length} منتج</span>
        </div>

        {/* Temu-style Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2">
          {products?.map((product: any, index: number) => {
            const thumb = product.images?.[0] || '';
            const price = product.price || 0;
            const hasVideo = product.metadata?.video_url;
            const discount = product.original_price && product.original_price > price
              ? Math.round(((product.original_price - price) / product.original_price) * 100)
              : 0;
            const salesCount = product.views || 0;
            const salesLabel = salesCount >= 1000 ? `${(salesCount / 1000).toFixed(1)}K+` : salesCount > 0 ? `${salesCount}+` : '';

            return (
              <button
                key={product.id}
                onClick={() => goToProduct(product)}
                className="w-full text-right overflow-hidden"
                style={{ backgroundColor: cardBg }}
              >
                {/* Image / Video */}
                <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                  {hasVideo?.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                    <video src={hasVideo} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                  ) : hasVideo?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/) ? (
                    <iframe className="absolute inset-0 w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${hasVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${hasVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                  ) : thumb ? (
                    <img
                      src={thumb}
                      alt={product.title || ''}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ backgroundColor: surfaceMuted }}>
                      📦
                    </div>
                  )}
                  {/* Discount badge */}
                  {discount > 0 && (
                    <div className="absolute top-0 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: accentColor }}>
                      {discount}% OFF
                    </div>
                  )}
                  {/* Add to cart button */}
                  <div className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: accentColor }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="m1 1 4 0 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <h3 className="text-xs font-medium leading-tight mb-1 line-clamp-2" style={{ color: textColor, minHeight: '2.5em' }}>
                    {product.title || product.name || 'منتج'}
                  </h3>
                  {/* Stars */}
                  <div className="flex items-center gap-0.5 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= 4 ? accentColor : borderColor}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                    {salesLabel && (
                      <span className="text-[9px] mr-0.5" style={{ color: textMuted }}>({salesLabel})</span>
                    )}
                  </div>
                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black" style={{ color: textColor }}>
                      {displayPrice(price).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: textColor }}>{currency}</span>
                  </div>
                  {/* Original price + sales */}
                  <div className="flex items-center gap-1 mt-0.5">
                    {product.original_price && product.original_price > price && (
                      <span className="text-[10px] line-through" style={{ color: textMuted }}>
                        {displayPrice(product.original_price).toLocaleString()}
                      </span>
                    )}
                    {salesLabel && (
                      <span className="text-[9px]" style={{ color: textMuted }}>{salesLabel} sold</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">

      {/* Mobile Container */}
      <div className={`${settings?.template_desktop_layout ? 'max-w-7xl mx-auto' : 'max-w-md mx-auto'} min-h-screen relative shadow-2xl`} style={{ backgroundColor: bgColor }}>

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-50 backdrop-blur-md px-4 py-3 flex items-center justify-between" style={{ backgroundColor: cardBg, borderBottom: `1px solid ${borderColor}` }}>
          <button onClick={goToStore} className="flex items-center gap-2">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <div
              className="font-black text-xl tracking-wider"
              style={{ color: textColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_store_name')}
            >
              {storeName}
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="text-left flex flex-col">
              <span className="text-xs font-bold" style={{ color: textMuted }}>السعر</span>
              <span className="font-black text-lg leading-none" dir="ltr">
                {displayPrice(productPrice)} {currency}
              </span>
            </div>
            <button
              onClick={scrollToForm}
              className="text-white px-5 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: accentColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_cta_text')}
            >
              {ctaText}
            </button>
          </div>
        </div>

        {/* ── LONG IMAGE STACK ── */}
        <div className="w-full flex flex-col">
          {videoUrl && (
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-auto block"
              poster={landingImages[0]}
            />
          )}
          {landingImages.length > 0 ? (
            landingImages.map((imgUrl, index) => (
              <img
                key={index}
                src={imgUrl}
                alt={`Landing slice ${index + 1}`}
                className="w-full h-auto block"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))
          ) : (
            <div className="w-full aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 flex items-center justify-center">
              <p className="text-sm" style={{ color: textMuted }}>أضف صور المنتج من لوحة التحكم</p>
            </div>
          )}
        </div>
        
        {/* ── ORDER FORM ── */}
        <div ref={formRef} className="p-5 pb-24" id="checkout-form">
          <div className="rounded-2xl p-5 shadow-sm relative" style={{ backgroundColor: cardBg, border: `2px solid ${accentColor}` }}>
            <div className="absolute -top-3 right-6 text-white px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: accentColor }}>
              أكمل البيانات للطلب
            </div>
            <h2
              className="text-xl font-black text-center mb-6 mt-2"
              style={{ color: textColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_form_title')}
            >
              {formTitle}
            </h2>

            <form onSubmit={handleOrder} noValidate className="space-y-4">
              {/* Variants */}
              {safeProduct.variants && safeProduct.variants.length > 0 && (
                <VariantSelector 
                  variants={safeProduct.variants} 
                  selected={selectedVariant} 
                  onSelect={setSelectedVariant} 
                  accentColor={accentColor} 
                  currency={currency} 
                  basePrice={safeProduct.price} 
                />
              )}

              {/* Offers */}
              {offers.length > 0 && (
                <OfferSelector 
                  offers={offers} 
                  unitPrice={mainProduct?.price || 0} 
                  currency={currency} 
                  selectedOfferId={selectedOffer?.offer_id ?? null} 
                  onSelect={handleOfferSelect} 
                  accentColor={accentColor} 
                  textColor={textColor} 
                  borderColor={borderColor} 
                  bgColor={cardBg}
                />
              )}

              {/* 2-Column: Name | Phone */}
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>الاسم واللقب</label>
                  <input
                    type="text"
                    required
                    placeholder="أدخل اسمك الكامل"
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:ring-2 outline-none transition-all"
                    style={{ backgroundColor: surfaceMuted, borderColor: borderColor, color: textColor }}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="05 55 55 55 55"
                      maxLength={10}
                      className="w-full border rounded-lg px-4 pl-10 py-3 text-right text-sm focus:ring-2 outline-none transition-all"
                      style={{
                        backgroundColor: surfaceMuted,
                        borderColor: phoneError ? '#ef4444' : borderColor,
                        color: textColor,
                      }}
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        setCustomerPhone(val);
                        if (val.length === 10) {
                          setPhoneError(isValidAlgerianPhone(val) ? '' : 'رقم الهاتف غير صحيح');
                        } else {
                          setPhoneError('');
                        }
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = phoneError ? '#ef4444' : borderColor}
                    />
                    <Phone size={18} className="absolute left-3 top-3.5" style={{ color: textMuted }} />
                  </div>
                  {phoneError && <p className="text-xs text-red-500 mt-1 font-bold">{phoneError}</p>}
                </div>
              </div>

              {/* 2-Column: Wilaya | Commune */}
              <div className="grid grid-cols-2 gap-4">
                {/* Wilaya */}
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>الولاية</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full border rounded-lg px-4 py-3 text-sm appearance-none focus:ring-2 outline-none transition-all"
                      style={{ backgroundColor: surfaceMuted, borderColor: borderColor, color: textColor }}
                      value={selectedWilayaId ?? ''}
                      onChange={(e) => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = borderColor}
                    >
                      <option value="">اختر الولاية</option>
                      {wilayas.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.labelAR}
                          {w.homePrice ? ` (${displayPrice(w.homePrice)} ${currency})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute left-3 top-3.5 pointer-events-none" style={{ color: textMuted }} />
                  </div>
                </div>

                {/* Commune (when enabled) */}
                {showCommune && (
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>البلدية</label>
                    <div className="relative">
                      <select
                        required
                        disabled={!selectedWilayaId}
                        className="w-full border rounded-lg px-4 py-3 text-sm appearance-none focus:ring-2 outline-none transition-all disabled:opacity-50"
                        style={{ backgroundColor: surfaceMuted, borderColor: borderColor, color: textColor }}
                        value={communeId}
                        onChange={(e) => setCommuneId(e.target.value)}
                        onFocus={e => e.currentTarget.style.borderColor = accentColor}
                        onBlur={e => e.currentTarget.style.borderColor = borderColor}
                      >
                        <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                        {communes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {communeDisplayName(c)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute left-3 top-3.5 pointer-events-none" style={{ color: textMuted }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Address (when enabled) */}
              {showAddress && (
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>العنوان</label>
                  <input
                    type="text"
                    placeholder="أدخل عنوانك"
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:ring-2 outline-none transition-all"
                    style={{ backgroundColor: surfaceMuted, borderColor: borderColor, color: textColor }}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                  />
                </div>
              )}
              <div className="pt-2">
                <label className="block text-sm font-bold mb-1.5" style={{ color: textColor }}>الكمية</label>
                <div className="flex items-center justify-between border rounded-lg p-1" style={{ backgroundColor: surfaceMuted, borderColor: borderColor }}>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 border rounded-md font-bold text-xl flex items-center justify-center"
                    style={{ backgroundColor: cardBg, borderColor: borderColor, color: textMuted }}
                  >-</button>
                  <span className="font-black text-lg" style={{ color: textColor }}>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(safeProduct?.stock_quantity ?? 999, quantity + 1))}
                    className="w-10 h-10 border rounded-md font-bold text-xl flex items-center justify-center"
                    style={{ backgroundColor: cardBg, borderColor: borderColor, color: textMuted }}
                  >+</button>
                </div>
              </div>

              {/* Delivery Type Buttons */}
              {(showHomeDelivery || showDeskDelivery) && (
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: textColor }}>نوع التوصيل</label>
                  <div className="grid grid-cols-2 gap-3">
                    {showHomeDelivery && (
                      <button
                        type="button"
                        onClick={() => setSelectedDeliveryType('home')}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: selectedDeliveryType === 'home' ? accentColor : borderColor,
                          backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : cardBg,
                          color: selectedDeliveryType === 'home' ? accentColor : textColor,
                        }}
                      >
                        <span className="text-sm font-bold">التوصيل للمنزل</span>
                      </button>
                    )}
                    {showDeskDelivery && (
                      <button
                        type="button"
                        onClick={() => setSelectedDeliveryType('desk')}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: selectedDeliveryType === 'desk' ? accentColor : borderColor,
                          backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : cardBg,
                          color: selectedDeliveryType === 'desk' ? accentColor : textColor,
                        }}
                      >
                        <span className="text-sm font-bold">الاستلام من المكتب</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Notes (when enabled) */}
              {showNotes && (
                <div>
                  <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>ملاحظات</label>
                  <textarea
                    placeholder="ملاحظات إضافية"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all text-sm"
                    style={{ backgroundColor: surfaceMuted, borderColor: borderColor, color: textColor }}
                    rows={3}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                  />
                </div>
              )}

              {/* Order Summary */}
              <div className="mt-6 border rounded-xl p-4" style={{ backgroundColor: surfaceMuted, borderColor: borderColor }}>
                <div className="flex justify-between text-sm mb-2" style={{ color: textColor }}>
                  <span>سعر المنتج ({quantity})</span>
                  <span className="font-bold" dir="ltr">{displayPrice(productPrice * quantity)} {currency}</span>
                </div>
                <div className="flex justify-between text-sm mb-3" style={{ color: textColor }}>
                  <span>سعر التوصيل</span>
                  <span className="font-bold" dir="ltr">{displayPrice(deliveryFee)} {currency}</span>
                </div>
                <div className="h-px w-full mb-3" style={{ backgroundColor: borderColor }} />
                <div className="flex justify-between items-center">
                  <span className="font-black text-lg" style={{ color: textColor }}>المجموع:</span>
                  <span className="font-black text-xl" dir="ltr" style={{ color: textColor }}>
                    {displayPrice(totalCost)} {currency}
                  </span>
                </div>
              </div>

              {orderError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center">
                  {orderError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 text-white text-lg font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? 'جاري الإرسال...' : (
                  <>
                    <span
                      contentEditable={canManage}
                      suppressContentEditableWarning
                      onBlur={handleTextEdit('zenith_submit_text')}
                    >{submitText}</span>
                    <ShoppingCart size={20} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1 mt-3 text-xs font-bold" style={{ color: textMuted }}>
                <ShieldCheck size={14} className="text-green-600" />
                الدفع يكون بعد استلام المنتج
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
