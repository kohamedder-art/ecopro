import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, Phone, ShieldCheck, User, MapPin, Truck, ShoppingBag, Building2 } from 'lucide-react';
import LazyVideo from '@/components/storefront/LazyVideo';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { useABTestVariant, useABTestIdFromUrl } from '@/hooks/useABTest';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';

export default function ZenithTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, initialProductSlug, navigate, onProductView }: TemplateProps) {
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#22c55e';
  const bgColor = settings?.template_bg_color || '#b0b8c9';
  const rawBgImage = settings?.template_bg_image || '';
  const bgImageCss = rawBgImage
    ? (rawBgImage.startsWith('linear') || rawBgImage.startsWith('radial') || rawBgImage.startsWith('url(')
      ? rawBgImage
      : `url(${rawBgImage})`)
    : '';
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#334155';
  const borderColor = isDark ? '#334155' : '#cbd5e1';
  const inputBorderColor = isDark ? '#64748b' : '#cbd5e1';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const surfaceMuted = isDark ? '#1e293b' : '#ffffff';
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
      const found = products?.find((p: any) => p.slug === currentSlug || String(p.id) === currentSlug);
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
    } else if (product?.id) {
      setCurrentSlug(String(product.id));
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
  const formTitle = settings?.zenith_form_title || 'اطلب الان';
  const submitText = settings?.zenith_submit_text || 'تأكيد الطلب';

  // Smart image classification: prefers tall images for landing strips
  const { getSlotImages, loading: classifyingImages } = useImageClassifier(productImages, 'zenith');
  const classifiedLanding = getSlotImages('landing');

  // A/B test: swap hero image if variant assigned
  const abTestId = useABTestIdFromUrl();
  const { variant: abVariant, imageUrl: abImageUrl, trackClick: abTrackClick } = useABTestVariant(abTestId);

  // Landing images (stacked Canva slices)
  const landingImages: string[] = (() => {
    const base = (() => {
      if (settings?.zenith_landing_images && Array.isArray(settings.zenith_landing_images) && settings.zenith_landing_images.length > 0) {
        return settings.zenith_landing_images;
      }
      // During classification, fall back to raw productImages to avoid showing stale old images
      return !classifyingImages && classifiedLanding.length > 0 ? classifiedLanding : productImages;
    })();
    // A/B test: replace first image with variant image
    if (abImageUrl && base.length > 0) {
      return [abImageUrl, ...base.slice(1)];
    }
    return base;
  })();

  const displayPrice = (n: number) => Math.round(n);
  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : productPrice * quantity;
  const totalCost = productTotal + deliveryFee;

  // Preload first landing image to cut LCP resource load delay
  useEffect(() => {
    const url = landingImages[0];
    if (!url) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [landingImages[0]]);

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
    abTrackClick();
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
          quantity: quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: productTotal,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          customer_notes: customerNotes,
          shipping_wilaya_id: selectedWilayaId,
          shipping_commune_id: Number(communeId) || undefined,
          product_name: mainProduct.title || mainProduct.name || '',
          ...getFraudData(),
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
        let errMsg: string;
        if (data.fields) {
          const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
          errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
        } else {
          errMsg = data.error || 'حدث خطأ أثناء إرسال الطلب';
        }
        setOrderError(errMsg);
      }
    } catch {
      setOrderError('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── STORE GRID VIEW (multi-product, no product selected) ──
  const showStoreGrid = !currentSlug && (products?.length || 0) > 1;
  const [gridImageIndex, setGridImageIndex] = useState<Record<number, number>>({});

  // Scroll direction detection for hiding header
  const gridLastScrollYRef = useRef(0);
  const [gridHeaderVisible, setGridHeaderVisible] = useState(true);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          if (currentY <= 0) {
            setGridHeaderVisible(true);
          } else if (currentY > gridLastScrollYRef.current) {
            setGridHeaderVisible(false);
          } else {
            setGridHeaderVisible(true);
          }
          gridLastScrollYRef.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Inject Google Fonts (Tajawal)
  useEffect(() => {
    const doc = document;
    if (!doc.getElementById('tajawal-font')) {
      const link = doc.createElement('link');
      link.id = 'tajawal-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap';
      link.rel = 'stylesheet';
      doc.head.appendChild(link);
    }
  }, []);

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', color: textColor, fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
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

  if (showStoreGrid) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', fontFamily: "'Tajawal', sans-serif" }} dir="rtl">
        {/* Header */}
        <div
          className="sticky top-0 z-50 px-6 py-2 flex items-center justify-between gap-4"
          style={{
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            transform: gridHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.3s ease-in-out',
          }}
        >
          <div className="flex items-center gap-2 shrink-0">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" decoding="async" width="36" height="36" />}
            <div className="font-bold text-lg" style={{ color: textColor }}>
              {storeName}
            </div>
          </div>
          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 px-4 py-2.5 rounded-full" style={{ backgroundColor: surfaceMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <span className="text-sm" style={{ color: textMuted }}>ابحث في المنتجات...</span>
          </div>
          <span className="text-sm shrink-0" style={{ color: textMuted }}>{products?.length} منتج</span>
        </div>

        {/* Product Grid — Leroi style */}
        <div className="max-w-7xl mx-auto px-2 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4" style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}>
            {products?.map((product: any, index: number) => {
              const thumb = product.images?.[gridImageIndex[product.id] || 0] || product.images?.[0] || '';
              const price = product.price || 0;
              const hasVideo = product.metadata?.video_url;
              const discount = product.original_price && product.original_price > price
                ? Math.round(((product.original_price - price) / product.original_price) * 100)
                : 0;
              const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

              return (
                <div
                  key={product.id}
                  className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
                  onClick={() => goToProduct(product)}
                >
                  {/* Image */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: '5 / 7', backgroundColor: surfaceMuted }}>
                    {hasVideo && (gridImageIndex[product.id] || 0) === 0 && hasVideo?.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                      <LazyVideo src={hasVideo} poster={thumb}
                        onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                        className="w-full h-full object-cover" />
                    ) : hasVideo && (gridImageIndex[product.id] || 0) === 0 && hasVideo?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/) ? (
                      <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${hasVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${hasVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                    ) : thumb ? (
                      <img
                        src={thumb}
                        alt={product.title || ''}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        width="600"
                        height="600"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: surfaceMuted }}>
                        📦
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {discount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                          -{discount}%
                        </span>
                      )}
                      {isLowStock && (
                        <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                          ⚡ {product.stock_quantity} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-xs font-semibold leading-snug mb-2 line-clamp-2 text-right" style={{ color: textColor }}>
                      {product.title || product.name || 'منتج'}
                    </h3>
                    {product.original_price && product.original_price > price && (
                      <div className="text-[10px] line-through text-right mb-0.5" style={{ color: textMuted }}>
                        {Math.round(product.original_price).toLocaleString()} {currency}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-base" style={{ color: accentColor }}>
                        {Math.round(price ?? 0).toLocaleString()} <span className="text-xs font-semibold">{currency}</span>
                      </span>
                      {product.views > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: textMuted }}>
                          🔥 {product.views > 1000 ? `${Math.floor(product.views/1000)}K+` : `${product.views}+`} sold
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Tajawal', sans-serif", backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', color: textColor }} dir="rtl">

      {/* Mobile Container */}
      <div className={`${settings?.template_desktop_layout ? 'max-w-7xl mx-auto' : 'max-w-3xl mx-auto'} min-h-screen relative shadow-2xl`}>

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-50 backdrop-blur-md px-3 py-2.5 flex items-center justify-between transition-transform duration-300" style={{ backgroundColor: cardBg, borderBottom: `1px solid ${borderColor}`, transform: gridHeaderVisible ? 'translateY(0)' : 'translateY(-100%)' }}>
          <button onClick={goToStore} className="flex items-center gap-1.5">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover" />}
            <div
              className="font-black text-2xl tracking-wider"
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
        <div className="w-full flex flex-col pt-1.5">
          {videoUrl && (
            <LazyVideo
              src={videoUrl}
              poster={landingImages[0] || ''}
              className="w-full h-auto"
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
                fetchpriority={index === 0 ? 'high' : 'low'}
                decoding="async"
                width="1200"
                height="675"
              />
            ))
          ) : !videoUrl ? (
            <div className="w-full aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 flex items-center justify-center">
              <p className="text-sm" style={{ color: textMuted }}>أضف صور المنتج من لوحة التحكم</p>
            </div>
          ) : null}
        </div>
        
        {/* ── ORDER FORM ── */}
        <div ref={formRef} className="px-3 py-5 pb-24" id="checkout-form">
            <div className="rounded-[28px] px-4 py-6 shadow-xl relative overflow-hidden" style={{ backgroundColor: cardBg, border: `1.5px solid ${accentColor}30`, boxShadow: `0 20px 50px -12px ${accentColor}22, 0 8px 20px rgba(0,0,0,0.06)` }}>
            <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />
            <div className="absolute -top-3 right-6 text-white px-5 py-1.5 rounded-full text-xs font-black tracking-wide shadow-md flex items-center gap-1.5" style={{ backgroundColor: accentColor }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> أكمل البيانات للطلب
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

            <form onSubmit={handleOrder} noValidate className="space-y-3">
              {orderError && (
                <div className="text-sm font-semibold rounded-xl px-4 py-3 whitespace-pre-line text-start" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                    {orderError}
                  </div>
              )}

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
                  borderColor={inputBorderColor} 
                  bgColor={cardBg}
                />
              )}

              {/* Name input with icon */}
              <div className="relative group">
                <input 
                  name="name" 
                  type="text" 
                  required 
                  className="w-full pl-4 pr-12 py-4 rounded-2xl transition-all outline-none text-[15px] font-medium"
                  style={{ border: `1.5px solid ${inputBorderColor}`, backgroundColor: surfaceMuted, color: textColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.backgroundColor = cardBg; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}14`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = inputBorderColor; e.currentTarget.style.backgroundColor = surfaceMuted; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                  placeholder="الاسم الكامل"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '14', color: accentColor }}>
                  <User size={16} />
                </div>
              </div>

              {/* Phone input with icon */}
              <div className="relative group">
                <input 
                  name="phone" 
                  type="tel" 
                  required 
                  dir="ltr"
                  maxLength={10}
                  className="w-full pl-4 pr-12 py-4 rounded-2xl transition-all outline-none text-[15px] font-medium"
                  style={{ border: `1px solid ${phoneError ? '#ef444422' : inputBorderColor}`, backgroundColor: phoneError ? '#fef2f2' : surfaceMuted, color: textColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = phoneError ? '#ef4444' : accentColor; e.currentTarget.style.boxShadow = `0 0 0 4px ${phoneError ? '#ef444414' : accentColor + '14'}`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = phoneError ? '#ef444422' : inputBorderColor; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                  placeholder="رقم الهاتف"
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
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: phoneError ? '#fecaca' : accentColor + '14', color: phoneError ? '#ef4444' : accentColor }}>
                  <Phone size={16} />
                </div>
                {phoneError && <p className="text-xs font-bold mt-1.5 mr-1" style={{ color: '#ef4444' }}>{phoneError}</p>}
              </div>

              {/* Wilaya select with icon */}
              <div className="relative group">
                <select 
                  value={selectedWilayaId || ''} 
                  onChange={e => setSelectedWilayaId(Number(e.target.value))}
                  required
                  className="w-full pl-10 pr-12 py-4 rounded-2xl transition-all appearance-none outline-none text-[15px] font-medium"
                  style={{ border: `1.5px solid ${inputBorderColor}`, backgroundColor: surfaceMuted, color: selectedWilayaId ? textColor : textMuted, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}14`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = inputBorderColor; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                >
                  <option value="">اختر الولاية</option>
                  {wilayas.map(w => (
                    <option key={w.id} value={w.id}>{w.labelAR}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '14', color: accentColor }}>
                  <MapPin size={16} />
                </div>
                <ChevronDown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
              </div>

              {/* Commune select with icon */}
              {showCommune && (
                <div className="relative group">
                  <select 
                    name="commune"
                    required 
                    disabled={!selectedWilayaId}
                    value={communeId}
                    onChange={e => setCommuneId(e.target.value)}
                    className="w-full pl-10 pr-12 py-4 rounded-2xl transition-all appearance-none outline-none text-[15px] font-medium disabled:opacity-50"
                    style={{ border: `1.5px solid ${inputBorderColor}`, backgroundColor: surfaceMuted, color: textColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}14`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = inputBorderColor; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                  >
                    <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                    {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '14', color: accentColor }}>
                    <Building2 size={16} />
                  </div>
                  <ChevronDown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
                </div>
              )}

              {/* Address input with icon */}
              {showAddress && (
                <div className="relative group">
                  <input 
                    name="address" 
                    type="text" 
                    className="w-full pl-4 pr-12 py-4 rounded-2xl transition-all outline-none text-[15px] font-medium"
                    style={{ border: `1.5px solid ${inputBorderColor}`, backgroundColor: surfaceMuted, color: textColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.backgroundColor = cardBg; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}14`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = inputBorderColor; e.currentTarget.style.backgroundColor = surfaceMuted; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                    placeholder="عنوان التوصيل"
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '14', color: accentColor }}>
                    <Building2 size={16} />
                  </div>
                </div>
              )}

              {/* Notes */}
              {showNotes && (
                <div className="relative">
                  <textarea 
                    name="notes" 
                    rows={2}
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    className="w-full px-4 py-4 rounded-2xl transition-all resize-none outline-none text-[15px]"
                    style={{ border: `1.5px solid ${inputBorderColor}`, backgroundColor: surfaceMuted, color: textColor, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 4px ${accentColor}14`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = inputBorderColor; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)'; }}
                    placeholder="ملاحظات إضافية (اختياري)"
                  />
                </div>
              )}

              {/* Delivery Type Toggle */}
              {(showHomeDelivery || showDeskDelivery) && (
                <div className="grid grid-cols-2 gap-2.5">
                  {showHomeDelivery && (
                    <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border transition-all text-sm font-black" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : inputBorderColor, backgroundColor: selectedDeliveryType === 'home' ? accentColor : surfaceMuted, color: selectedDeliveryType === 'home' ? '#fff' : textColor, boxShadow: selectedDeliveryType === 'home' ? `0 4px 12px ${accentColor}30` : 'none' }}>
                      <Truck size={16} />
                      <span>توصيل للمنزل</span>
                    </button>
                  )}
                  {showDeskDelivery && (
                    <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border transition-all text-sm font-black" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : inputBorderColor, backgroundColor: selectedDeliveryType === 'desk' ? accentColor : surfaceMuted, color: selectedDeliveryType === 'desk' ? '#fff' : textColor, boxShadow: selectedDeliveryType === 'desk' ? `0 4px 12px ${accentColor}30` : 'none' }}>
                      <Building2 size={16} />
                      <span>استلام من المكتب</span>
                    </button>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: surfaceMuted, border: `1px solid ${inputBorderColor}18` }}>
                <span className="text-sm font-black flex items-center gap-2" style={{ color: textColor }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} /> الكمية</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-full font-black text-lg flex items-center justify-center transition-all active:scale-95" style={{ backgroundColor: quantity > 1 ? accentColor : cardBg, color: quantity > 1 ? '#fff' : textMuted, border: `1px solid ${quantity > 1 ? accentColor : inputBorderColor}22`, boxShadow: quantity > 1 ? `0 2px 8px ${accentColor}30` : 'none' }}>−</button>
                  <span className="font-black text-lg min-w-[2.5rem] text-center rounded-xl py-1" style={{ color: textColor, backgroundColor: cardBg, border: `1px solid ${inputBorderColor}18` }}>{String(quantity).padStart(2, '0')}</span>
                  <button type="button" onClick={() => setQuantity(Math.min((safeProduct?.stock_quantity != null && safeProduct.stock_quantity > 0) ? safeProduct.stock_quantity : 999, quantity + 1))} className="w-10 h-10 rounded-full font-black text-lg flex items-center justify-center transition-all active:scale-95" style={{ backgroundColor: accentColor, color: '#fff', boxShadow: `0 2px 8px ${accentColor}30` }}>+</button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-2xl text-sm space-y-2.5 overflow-hidden relative" style={{ backgroundColor: cardBg, border: `1px solid ${inputBorderColor}14`, boxShadow: `0 2px 12px rgba(0,0,0,0.04)` }}>
                <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}22, transparent)` }} />
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium" style={{ color: textMuted }}>سعر المنتج</span>
                  <span className="font-bold">{displayPrice(productPrice * quantity)} {currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium" style={{ color: textMuted }}>اجمالى التوصيل</span>
                  <span className="font-bold px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: deliveryFee === 0 ? '#dcfce7' : accentColor + '14', color: deliveryFee === 0 ? '#16a34a' : accentColor }}>{deliveryFee === 0 ? 'مجاني ✓' : `${displayPrice(deliveryFee)} ${currency}`}</span>
                </div>
                <div className="flex justify-between items-center pt-3 font-black" style={{ borderTop: `1px dashed ${inputBorderColor}22` }}>
                  <span className="text-[13px]" style={{ color: textColor }}>المجموع</span>
                  <span className="text-base px-3 py-1.5 rounded-full" style={{ backgroundColor: accentColor, color: '#fff', boxShadow: `0 2px 8px ${accentColor}30` }}>{displayPrice(totalCost)} {currency}</span>
                </div>
              </div>

              {/* CTA Button */}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-black text-[15px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`, color: '#ffffff', boxShadow: `0 8px 20px ${accentColor}35, 0 2px 8px ${accentColor}20` }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <ShoppingBag size={20} />
                    <span
                      contentEditable={canManage}
                      suppressContentEditableWarning
                      onBlur={handleTextEdit('zenith_submit_text')}
                    >{submitText}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1 mt-2 text-xs font-bold" style={{ color: textMuted }}>
                <ShieldCheck size={14} className="text-green-600" />
                الدفع يكون بعد استلام المنتج
              </div>
            </form>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="py-6 text-center text-xs" style={{ color: textMuted, borderTop: `1px solid ${borderColor}` }}>
          © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
        </footer>

      </div>
    </div>
  );
}
