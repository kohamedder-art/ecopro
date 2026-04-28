import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ShoppingBag, Maximize2, Ruler, ShieldCheck, Truck,
  CheckCircle2, X, CreditCard, ChevronDown, ChevronLeft, Phone
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  variant_id?: number;
  variant_name?: string;
}

export default function SculptorTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);

  const [activeImage, setActiveImage] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.sculptor_accent_color || '#D4AF37';
  const bgColor = settings?.template_bg_color || settings?.sculptor_bg_color || '#0A0A0A';
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
  const textColor = isDark ? (isLight(accentColor) ? accentColor : '#f1f5f9') : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';
  const surfaceColor = headerColor;
  const surfaceTextColor = isHeaderDark ? '#f1f5f9' : '#1e293b';
  const surfaceTextMuted = isHeaderDark ? '#94a3b8' : '#64748b';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e2e8f0';
  const inputBg = isHeaderDark ? 'rgba(255,255,255,0.06)' : '#ffffff';

  // Editable text
  const brandName = settings?.sculptor_brand_name || settings?.store_name || 'SCULPTOR';
  const brandTagline = settings?.sculptor_tagline || 'ملابس حرفية فاخرة';

  // Main product (single-product detail view)
  const mainProduct = useMemo(() => {
    if (initialProductSlug) {
      const bySlug = products?.find((p: any) => p.slug === initialProductSlug);
      if (bySlug) return bySlug;
    }
    const mainId = settings?.dzp_main_product_id;
    const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
    return found || products?.[0] || null;
  }, [products, settings?.dzp_main_product_id, initialProductSlug]);

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);

  // Body scroll lock
  useEffect(() => {
    if (showCart || zoomImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCart, zoomImage]);

  const productImages = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [];
  const productPrice = mainProduct?.price ?? 0;
  const originalPrice = (mainProduct as any)?.original_price ?? null;

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  useEffect(() => { setActiveImage(videoEmbed ? -1 : 0); }, [mainProduct?.id]);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollPosition = el.scrollLeft;
    const itemWidth = el.offsetWidth;
    const index = Math.abs(Math.round(scrollPosition / itemWidth));
    setActiveImage(index);
  };

  const handleAddToCart = () => {
    if (!mainProduct) return;
    onProductView?.(mainProduct);
    setIsAdding(true);
    const variant = selectedVariant;
    setTimeout(() => {
      setCart(prev => [...prev, {
        id: mainProduct.id,
        name: mainProduct.title || 'منتج',
        price: variant?.price ?? productPrice,
        image: productImages[0] || '',
        variant_id: variant?.id,
        variant_name: variant ? (variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / ')) : undefined,
      }]);
      setIsAdding(false);
      setShowCart(true);
    }, 800);
  };

  const subtotal = useMemo(() => cart.reduce((acc, i) => acc + i.price, 0), [cart]);
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0);

  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId || cart.length === 0) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = [selectedWilaya?.labelAR || '', customerAddress, customerCommune, customerNotes].filter(Boolean).join(' - ');

      for (const item of cart) {
        const isOfferItem = selectedOffer && item.id === mainProduct?.id;
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            quantity: isOfferItem ? selectedOffer.quantity : 1,
            ...(isOfferItem ? { offer_id: selectedOffer.offer_id } : {}),
            total_price: isOfferItem ? selectedOffer.bundle_price : item.price,
            delivery_fee: deliveryFee,
            delivery_type: 'desk',
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: address,
            shipping_wilaya_id: selectedWilayaId,
          }),
        });

        const data = await res.json();
          setLastOrderId(data.order?.id || null);
          setLastTelegramUrl(data.telegramStartUrl || null);
        if (!res.ok) {
          alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
          return;
        }
      }

      setOrderSuccess(true);
    } catch {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">
        <div className="max-w-md w-full rounded-[2rem] p-8 text-center border" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '30' }}>
            <CheckCircle2 size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: surfaceTextColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-sm mb-6" style={{ color: surfaceTextMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right border" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span style={{ color: surfaceTextMuted }}>{item.name}</span>
                <span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(item.price ?? 0).toLocaleString()} {currency}</span>
              </div>
            ))}
            <div className="h-px my-1" style={{ backgroundColor: surfaceBorderColor }} />
            <div className="flex justify-between"><span style={{ color: surfaceTextMuted }}>التوصيل</span><span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} {currency}</span></div>
            <div className="flex justify-between"><span className="font-black" style={{ color: surfaceTextColor }}>المجموع</span><span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(total ?? 0).toLocaleString()} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 h-16 z-50 flex items-center justify-between px-6 backdrop-blur-xl border-b" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)', borderColor: borderColor }}>
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <span className="w-10" />
        <div className="flex flex-col items-center">
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover mb-1 border" style={{ borderColor: borderColor }} />}
          <h1
            className="text-xl font-black tracking-[0.3em]"
            style={{ color: textColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('sculptor_brand_name')}
          >
            {brandName}
          </h1>
          <span
            className="text-[8px] font-bold tracking-widest uppercase"
            style={{ color: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('sculptor_tagline')}
          >
            {brandTagline}
          </span>
        </div>
        <button onClick={() => setShowCart(true)} className="relative w-10 h-10 flex items-center justify-center rounded-full border" style={{ backgroundColor: inputBg, borderColor: borderColor }}>
          <ShoppingBag size={20} />
          {cart.length > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 text-black text-[9px] font-black rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              {cart.length}
            </span>
          )}
        </button>
        </div>
      </nav>

      <main className="pt-24 pb-32 max-w-6xl mx-auto px-0 md:px-6">
        <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start">

        {/* HORIZONTAL IMAGE GALLERY */}
        {(productImages.length > 0 || videoEmbed) ? (
          <div className="relative group">
            {/* Video display (when active == -1) */}
            {videoEmbed && activeImage === -1 && (
              <div className="px-6 pb-2">
                <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl">
                  {videoEmbed.type === 'youtube' ? (
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                  ) : videoEmbed.type === 'video' ? (
                    <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                  ) : (
                    <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                  )}
                </div>
              </div>
            )}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className={`flex overflow-x-auto snap-x snap-mandatory gap-3 px-6 pb-2 ${videoEmbed && activeImage === -1 ? 'hidden' : ''}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {productImages.map((img, i) => (
                <div key={i} className="min-w-full snap-center">
                  <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                    <img
                      src={img}
                      className="w-full h-full object-cover cursor-pointer"
                      alt={`Product view ${i + 1}`}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      onClick={() => setZoomImage(img)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                  </div>
                </div>
              ))}
            </div>

            {/* Indicators */}
            {(videoEmbed || productImages.length > 1) && (
              <div className="flex justify-center gap-2 mt-3 px-6">
                {videoEmbed && (
                  <button onClick={() => setActiveImage(-1)} className="w-10 h-6 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: activeImage === -1 ? '#000' : 'rgba(0,0,0,0.3)', border: activeImage === -1 ? `2px solid ${accentColor}` : '2px solid transparent' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                  </button>
                )}
                {productImages.map((_, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${activeImage === i ? 'w-8' : 'w-2'}`}
                    style={activeImage === i ? { backgroundColor: accentColor } : { backgroundColor: textMuted }}
                  />
                ))}
              </div>
            )}

            {/* Swipe Hint */}
            {productImages.length > 1 && (
              <div className="absolute left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
                <div className="w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center border" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)', borderColor: borderColor }}>
                  <ChevronLeft size={20} style={{ color: accentColor }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-6 aspect-[4/5] rounded-[2.5rem] flex items-center justify-center border" style={{ backgroundColor: inputBg, borderColor: borderColor }}>
            <p className="text-sm" style={{ color: textMuted }}>أضف صور المنتج من لوحة التحكم</p>
          </div>
        )}

        {/* PRODUCT INFO */}
        {mainProduct && (
          <div className="px-6 mt-8 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                {mainProduct.category && (
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textMuted }}>{mainProduct.category}</span>
                )}
                <h2 className="text-3xl font-black mt-1 leading-tight" style={{ color: textColor }}>{mainProduct.title}</h2>
              </div>
              <div className="text-left">
                <p className="text-2xl font-black" style={{ color: accentColor }}>
                  {productPrice} <span className="text-xs">{currency}</span>
                </p>
                {originalPrice && originalPrice > productPrice && (
                  <span className="text-sm line-through block" style={{ color: textMuted }}>{Math.round(originalPrice ?? 0).toLocaleString()} {currency}</span>
                )}
              </div>
            </div>

            {mainProduct.description && (
              <p className="text-sm leading-relaxed max-w-[90%]" style={{ color: textMuted }}>{mainProduct.description}</p>
            )}

            {mainProduct.variants && mainProduct.variants.length > 0 && (
              <VariantSelector
                variants={mainProduct.variants}
                selected={selectedVariant}
                onSelect={setSelectedVariant}
                accentColor={accentColor}
                currency={currency}
                basePrice={mainProduct.price}
              />
            )}
          </div>
        )}

        {/* ADD TO CART */}
        <div className="px-6 mt-10 space-y-4">
          <button
            onClick={handleAddToCart}
            disabled={isAdding || !mainProduct}
            className="w-full rounded-[1.8rem] font-black text-lg transition-all flex items-center justify-center gap-4 py-5 active:scale-[0.97]"
            style={isAdding
              ? { backgroundColor: accentColor, color: '#000' }
              : { backgroundColor: '#fff', color: '#000' }
            }
          >
            {isAdding ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>جاري التجهيز...</span>
              </div>
            ) : (
              <>إضافة إلى الحقيبة <ShoppingBag size={22} /></>
            )}
          </button>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2 py-4">
            {[
              { icon: Truck, text: 'توصيل سريع' },
              { icon: ShieldCheck, text: 'أصلي 100%' },
              { icon: CreditCard, text: 'عند الاستلام' },
            ].map((badge, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 hover:opacity-100 transition-opacity" style={{ color: textMuted }}>
                <badge.icon size={18} />
                <span className="text-[9px] font-black uppercase tracking-widest">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* No product placeholder */}
        {!mainProduct && (
          <div className="px-6 py-20 text-center">
            <ShoppingBag size={48} className="mx-auto mb-4" style={{ color: borderColor }} />
            <p className="font-bold" style={{ color: textMuted }}>أضف منتجات من لوحة التحكم</p>
          </div>
        )}
        </div>{/* end desktop grid */}
      </main>

      {/* CHECKOUT DRAWER */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center md:justify-center md:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCart(false)} />
          <div
            className="relative w-full md:max-w-lg md:rounded-[3rem] border-x border-t md:border flex flex-col shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
            style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor, height: '100dvh', maxHeight: '100dvh' }}
          >
            <div className="w-full flex justify-center py-4">
              <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: surfaceBorderColor }} />
            </div>

            <div className="p-8 flex-1 overflow-y-auto pt-0" style={{ scrollbarWidth: 'none' }}>
              <div className="flex justify-between items-center mb-8 sticky top-0 py-2 z-10 backdrop-blur-sm" style={{ backgroundColor: surfaceColor + 'E6' }}>
                <h3 className="text-2xl font-black" style={{ color: surfaceTextColor }}>الحقيبة</h3>
                <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: inputBg, color: surfaceTextMuted }}>
                  <X size={20} />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-24 text-center space-y-6">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto border" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
                    <ShoppingBag size={40} style={{ color: surfaceBorderColor }} />
                  </div>
                  <p className="font-black tracking-widest uppercase" style={{ color: surfaceTextMuted }}>حقيبتك فارغة</p>
                </div>
              ) : (
                <div className="space-y-8 pb-10">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex gap-5">
                      {item.image && (
                        <img src={item.image} className="w-28 h-32 rounded-3xl object-cover border" style={{ borderColor: surfaceBorderColor }} alt={item.name} />
                      )}
                      <div className="flex-1 flex flex-col justify-between py-2">
                        <h4 className="font-black text-xl leading-tight" style={{ color: surfaceTextColor }}>{item.name}</h4>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-black" style={{ color: surfaceTextColor }}>{Math.round(item.price ?? 0).toLocaleString()} {currency}</p>
                          <button
                            type="button"
                            onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500/60 hover:text-red-500 text-[10px] font-black uppercase underline"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Shipping Form */}
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
                  <div className="space-y-4 pt-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>معلومات الشحن</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="الاسم الكامل"
                        className="w-full h-16 border rounded-2xl px-6 outline-none transition-all font-bold placeholder:opacity-40"
                        style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }}
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          placeholder="05 55 55 55 55"
                          className="w-full h-16 border rounded-2xl px-6 outline-none transition-all text-right font-bold placeholder:opacity-40"
                          style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }}
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                        />
                        <Phone size={16} className="absolute left-6 top-5" style={{ color: surfaceTextMuted }} />
                      </div>
                      <div className="relative">
                        <select
                          required
                          className="w-full h-16 border rounded-2xl px-6 outline-none appearance-none font-bold"
                          style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }}
                          value={selectedWilayaId ?? ''}
                          onChange={e => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="" style={{ backgroundColor: surfaceColor }}>اختر الولاية</option>
                          {wilayas.map((w) => (
                            <option key={w.id} value={w.id} style={{ backgroundColor: surfaceColor }}>
                              {String(w.id).padStart(2, '0')} - {w.labelAR}
                              {w.homePrice ? ` (${w.homePrice} ${currency})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none" size={20} style={{ color: surfaceTextMuted }} />
                      </div>
                      {showAddress && <input type="text" placeholder="العنوان" className="w-full h-16 border rounded-2xl px-6 outline-none font-bold" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                      {showCommune && <input type="text" placeholder="البلدية" className="w-full h-16 border rounded-2xl px-6 outline-none font-bold" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} />}
                      {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full border rounded-2xl px-6 py-4 outline-none font-bold resize-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 pb-10 bg-black border-t border-white/5 rounded-t-[3rem] space-y-5">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-white/40 text-xs font-bold uppercase">
                    <span>قيمة المشتريات</span>
                    <span>{Math.round(subtotal ?? 0).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center text-white/40 text-xs font-bold uppercase pb-3 border-b border-white/5">
                    <span>تكلفة التوصيل</span>
                    <span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">المبلغ الإجمالي</p>
                      <p className="text-4xl font-black" style={{ color: accentColor }}>
                        {total} <span className="text-sm font-bold">{currency}</span>
                      </p>
                    </div>
                    <div className="text-[9px] text-white/20 font-bold mb-2 uppercase">الدفع نقداً عند الاستلام</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOrder}
                  disabled={isSubmitting}
                  className="w-full rounded-[1.8rem] font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all py-5 disabled:opacity-60"
                  style={{ backgroundColor: accentColor, color: '#000', boxShadow: `0 15px 30px ${accentColor}33` }}
                >
                  {isSubmitting ? 'جاري الإرسال...' : <><span>تأكيد الطلب</span> <CheckCircle2 size={24} /></>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} {brandName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
            <X size={20} />
          </button>
          <img src={zoomImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
          {productImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {productImages.map((img, i) => (
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
