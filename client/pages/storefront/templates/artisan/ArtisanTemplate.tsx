import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, type SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  Heart,
  Truck,
  ShieldCheck,
  Star,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

/* ------------------------------------------------------------------ */
/*  Artisan — Earthy multi-product storefront with cart & checkout     */
/* ------------------------------------------------------------------ */

// Standalone gallery component to avoid stale closure / remount reset
function ArtisanImageGallery({ imgs, accentColor, surfaceMuted, surfaceTextMuted, onZoom, videoUrl = '' }: {
  imgs: string[]; accentColor: string; surfaceMuted: string; surfaceTextMuted: string; onZoom: (src: string) => void; videoUrl?: string;
}) {
  const [idx, setIdx] = React.useState(0);
  const [showVideo, setShowVideo] = React.useState(true);
  const tsRef = React.useRef<number | null>(null);
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  React.useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [videoUrl]);
  return (
    <div className="artisan-gallery-wrap flex flex-col h-full">
      <div className="artisan-gallery-img relative w-full aspect-square overflow-hidden shrink-0 select-none" style={{ backgroundColor: surfaceMuted }}
        onTouchStart={e => { e.stopPropagation(); tsRef.current = e.touches[0].clientX; }}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => {
          e.stopPropagation();
          if (videoEmbed && showVideo) return;
          if (tsRef.current === null || imgs.length <= 1) return;
          const d = tsRef.current - e.changedTouches[0].clientX;
          tsRef.current = null;
          if (Math.abs(d) < 40) { onZoom(imgs[idx]); return; }
          setIdx(i => d > 0 ? Math.min(i + 1, imgs.length - 1) : Math.max(i - 1, 0));
        }}
        onClick={() => { if (videoEmbed && showVideo) return; imgs[idx] && onZoom(imgs[idx]); }}
      >
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
        ) : imgs.length > 0 ? (
          <img src={imgs[idx] || imgs[0]} alt="" className="w-full h-full object-cover transition-all duration-300 pointer-events-none" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: surfaceTextMuted }}><ShoppingBag size={48} strokeWidth={1} /></div>
        )}
        {(videoEmbed || imgs.length > 1) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
            {videoEmbed && <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.4)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
            {imgs.map((_, i) => <button key={i} onClick={e => { e.stopPropagation(); setShowVideo(false); setIdx(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === idx ? accentColor : 'rgba(255,255,255,0.5)', transform: !showVideo && i === idx ? 'scale(1.3)' : 'scale(1)' }} />)}
          </div>
        )}
      </div>
      {(videoEmbed || imgs.length > 1) && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0">
          {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
          {imgs.map((img, i) => (
            <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArtisanTemplate(props: TemplateProps) {
  const {
    storeSlug,
    products = [],
    settings = {} as any,
    formatPrice,
    canManage,
    primaryColor: propPrimaryColor,
    onProductView,
    initialProductSlug,
  } = props;

  /* ---------- settings with defaults ---------- */
  const brandName      = (settings as any)?.artisan_brand_name      ?? settings?.store_name ?? 'نـسـيـج';
  const tagline        = (settings as any)?.artisan_tagline          ?? 'صنع بحب، ليدوم طويلاً';
  const story          = (settings as any)?.artisan_story            ?? settings?.store_description ?? 'في نسيج، نؤمن أن الملابس ليست مجرد أقمشة، بل هي ذكريات نرتديها.';
  const accentColor    = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || (settings as any)?.artisan_theme_color || '#7c4a32';
  const bgColor        = settings?.template_bg_color ?? (settings as any)?.artisan_bg_color ?? '#fdfaf6';
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
  const heroBadge      = (settings as any)?.artisan_hero_badge       ?? 'صناعة يدوية جزائرية';
  const heroTitle      = (settings as any)?.artisan_hero_title       ?? settings?.template_hero_heading ?? 'قطع كلاسيكية';
  const heroSubtitle   = (settings as any)?.artisan_hero_subtitle    ?? settings?.template_hero_subtitle ?? 'تعيش معك للأبد';
  const trustTitle     = (settings as any)?.artisan_trust_title      ?? 'لماذا يختارنا الجزائريون؟';
  const currency       = (settings as any)?.currency_code            ?? 'د.ج';

  /* ---------- delivery prices from API ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);

  /* ---------- cart ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '', commune: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  // Set default wilaya once loaded
  useEffect(() => {
    if (wilayas.length > 0 && !formData.wilaya) {
      setFormData(prev => ({ ...prev, wilaya: String(wilayas[0].id) }));
    }
  }, [wilayas]);

  // Lock body scroll when modal/drawer open
  useEffect(() => {
    if (showCheckout || detailProduct || zoomImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCheckout, detailProduct, zoomImage]);

  /* ---------- social-proof toast ---------- */
  const [recentSale, setRecentSale] = useState<string | null>(null);
  useEffect(() => {
    const names = ['أحمد من وهران', 'مريم من العاصمة', 'ياسين من سطيف', 'ليلى من قسنطينة'];
    const interval = setInterval(() => {
      const randomName = names[Math.floor(Math.random() * names.length)];
      setRecentSale(randomName);
      setTimeout(() => setRecentSale(null), 5000);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Product Image Gallery for detail modal — now using standalone ArtisanImageGallery

  /* ---------- cart helpers ---------- */
  const addToCart = (product: any, variant?: SelectedVariant | null) => {
    onProductView?.(product);
    const cartProduct = variant ? { ...product, price: variant.price ?? product.price, variant_id: variant.id, variant_name: variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / ') } : product;
    if (!cart.find(i => i.id === cartProduct.id && (i as any).variant_id === cartProduct.variant_id)) {
      setCart(prev => [...prev, cartProduct]);
    }
    setShowCheckout(true);
  };

  const removeFromCart = (id: number, vid?: number) => {
    setCart(prev => prev.filter(i => !(i.id === id && (i as any).variant_id === vid)));
  };

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const baseShipping = selectedWilaya?.homePrice ?? 0;

  /* ---------- offers ---------- */
  const mainProduct = products[0];
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer>(null);
  const handleOfferSelect = (offer: SelectedOffer) => setSelectedOffer(offer);
  const shipping = resolveDeliveryFee(mainProduct, selectedOffer, baseShipping);

  const subtotal = cart.reduce((acc, i) => acc + (i.price ?? 0), 0);
  const total = subtotal + shipping;

  /* ---------- contentEditable helper ---------- */
  const handleTextEdit = useCallback((key: string) => {
    if (!canManage) return undefined;
    return (e: React.FormEvent<HTMLElement>) => {
      const value = (e.target as HTMLElement).innerText;
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value }, '*');
    };
  }, [canManage]);

  /* ---------- submit order ---------- */
  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || cart.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of cart) {
        const isOfferItem = selectedOffer && item.id === mainProduct?.id;
        await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            quantity: isOfferItem ? selectedOffer.quantity : 1,
            total_price: isOfferItem ? selectedOffer.bundle_price + shipping : item.price + shipping,
            delivery_fee: shipping,
            delivery_type: 'desk',
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_address: [formData.address, formData.commune, formData.notes].filter(Boolean).join(' - ') || selectedWilaya?.labelAR || '',
            shipping_wilaya_id: formData.wilaya ? Number(formData.wilaya) : null,
            ...(isOfferItem ? { offer_id: selectedOffer.offer_id, offer_quantity: selectedOffer.quantity, offer_bundle_price: selectedOffer.bundle_price } : {}),
          }),
        });
      }
      setOrderSuccess(true);
      setCart([]);
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- price display ---------- */
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${Math.round(p).toLocaleString()} ${currency}`);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: bgColor, fontFamily: "'Noto Sans Arabic', sans-serif", color: textColor }} dir="rtl">

      {/* ── HEADER ── */}
      <header className="p-6 flex justify-between items-center backdrop-blur-sm sticky top-0 z-40 border-b" style={{ backgroundColor: surfaceColor + 'cc', borderColor: surfaceBorderColor }}>
        <div className="flex items-center gap-2">
          {settings?.store_logo ? <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white italic font-serif text-xl" style={{ backgroundColor: accentColor }}>ن</div>}
          <h1
            className="text-2xl font-black tracking-tighter"
            style={{ color: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('artisan_brand_name')}
          >
            {brandName}
          </h1>
        </div>
        <button onClick={() => setShowCheckout(true)} className="relative p-2 rounded-full shadow-sm" style={{ backgroundColor: surfaceColor }}>
          <ShoppingBag size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white font-bold" style={{ backgroundColor: accentColor }}>
              {cart.length}
            </span>
          )}
        </button>
      </header>

      {/* ── HERO ── */}
      <section className="px-6 py-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
          <Sparkles size={14} />
          <span
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('artisan_hero_badge')}
          >
            {heroBadge}
          </span>
        </div>
        <h2 className="text-4xl font-serif mb-4 leading-snug">
          <span
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('artisan_hero_title')}
          >
            {heroTitle}
          </span>
          <br />
          <span
            className="italic opacity-70"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('artisan_hero_subtitle')}
          >
            {heroSubtitle}
          </span>
        </h2>
        <p
          className="text-sm max-w-xs mx-auto leading-relaxed"
          style={{ color: textMuted }}
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('artisan_story')}
        >
          {story}
        </p>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="px-6 space-y-12 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 md:gap-5 py-6">
        {products.map((product, idx) => (
          <div key={product.id} className="group">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem]" style={{ backgroundColor: surfaceMuted }}>
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.name || product.title}
                  className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 cursor-pointer"
                  onClick={() => { setDetailProduct(product); onProductView?.(product); }}
                />
              )}
              {idx === 0 && (
                <div className="absolute top-4 right-4 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: surfaceColor + 'e6', color: surfaceTextColor }}>
                  الأكثر طلباً
                </div>
              )}
              <button
                onClick={() => { setDetailProduct(product); onProductView?.(product); }}
                className="absolute bottom-6 inset-x-6 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"
                style={{ backgroundColor: accentColor }}
              >
                عرض المنتج <ArrowRight size={16} />
              </button>
            </div>
            <div className="mt-3 px-2">
              <div className="flex justify-between items-start">
                <h3 className="text-base font-bold">{product.name || product.title}</h3>
                <div className="flex items-center gap-1" style={{ color: accentColor }}>
                  <Star size={12} fill="currentColor" />
                  <span className="text-xs font-bold">4.9</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-black" style={{ color: accentColor }}>{fmtPrice(product.price ?? 0)}</span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-xs line-through" style={{ color: textMuted }}>{fmtPrice(product.original_price)}</span>
                )}
              </div>
              {product.description && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: textMuted }}>{product.description}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="m-6 p-8 rounded-[2.5rem]" style={{ backgroundColor: accentColor, color: isLight(accentColor) ? '#1e293b' : '#ffffff' }}>
        <h4
          className="text-xl font-serif mb-6 text-center"
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('artisan_trust_title')}
        >
          {trustTitle}
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><Truck size={24} /></div>
            <p className="text-xs font-bold">شحن سريع لكل الولايات</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><ShieldCheck size={24} /></div>
            <p className="text-xs font-bold">ضمان الاستبدال مجاناً</p>
          </div>
        </div>
      </section>

      {/* ── CHECKOUT DRAWER ── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end" onTouchMove={e => e.preventDefault()} style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative w-full max-h-[90dvh] rounded-t-[3rem] overflow-y-auto p-6 artisan-slide-up" style={{ backgroundColor: bgColor, touchAction: 'auto' }}>
            <div className="w-12 h-1.5 rounded-full mx-auto mb-8" style={{ backgroundColor: borderColor }} />

            {orderSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-2xl font-serif">تم تأكيد طلبك بنجاح!</h3>
                <p className="text-sm" style={{ color: textMuted }}>سنتواصل معك قريباً</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={formData.phone} />
                <button
                  onClick={() => { setShowCheckout(false); setOrderSuccess(false); }}
                  className="mt-4 px-6 py-3 rounded-2xl text-white font-bold"
                  style={{ backgroundColor: accentColor }}
                >
                  متابعة التسوق
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-serif mb-6">تفاصيل طلبك</h3>

                {cart.length === 0 ? (
                  <div className="text-center py-10" style={{ color: textMuted }}>سلتك فارغة حالياً</div>
                ) : (
                  <div className="space-y-6">
                    {cart.map(item => (
                      <div key={`${item.id}-${(item as any).variant_id ?? 'nv'}`} className="flex gap-4 items-center">
                        {item.images?.[0] && <img src={item.images[0]} className="w-16 h-16 rounded-xl object-cover" alt="" />}
                        <div className="flex-1">
                          <p className="font-bold">{item.name}</p>
                          {(item as any).variant_name && <p className="text-xs" style={{ color: accentColor }}>{(item as any).variant_name}</p>}
                          <p className="text-sm" style={{ color: textMuted }}>{fmtPrice(item.price ?? 0)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.id, (item as any).variant_id)} style={{ color: textMuted }}><X size={18} /></button>
                      </div>
                    ))}

                    <div className="border-t pt-6 space-y-4" style={{ borderColor }}>
                      {mainProduct && offers.length > 0 && (
                        <OfferSelector
                          offers={offers}
                          unitPrice={mainProduct.price}
                          selectedOfferId={selectedOffer?.offer_id ?? null}
                          onSelect={handleOfferSelect}
                          currency={currency}
                          accentColor={accentColor}
                        />
                      )}
                      <input
                        type="text"
                        placeholder="الاسم الكامل"
                        className="w-full rounded-2xl p-4 text-sm border"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                      <input
                        type="tel"
                        placeholder="رقم الهاتف (ضروري)"
                        className="w-full rounded-2xl p-4 text-sm text-right border"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                      {showAddress && <input
                        type="text"
                        placeholder="العنوان (اختياري)"
                        className="w-full rounded-2xl p-4 text-sm border"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                      />}
                      {showCommune && <input
                        type="text"
                        placeholder="البلدية"
                        className="w-full rounded-2xl p-4 text-sm border"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.commune}
                        onChange={e => setFormData({ ...formData, commune: e.target.value })}
                      />}
                      {showNotes && <textarea
                        placeholder="ملاحظات"
                        rows={2}
                        className="w-full rounded-2xl p-4 text-sm border resize-none"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      />}
                      <select
                        className="w-full rounded-2xl p-4 text-sm border"
                        style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }}
                        value={formData.wilaya}
                        onChange={e => setFormData({ ...formData, wilaya: e.target.value })}
                      >
                        {wilayas.map(w => (
                          <option key={w.id} value={String(w.id)}>{w.labelAR} — {fmtPrice(w.homePrice)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-6 rounded-3xl space-y-2" style={{ backgroundColor: surfaceMuted }}>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: textMuted }}>سعر المنتجات:</span>
                        <span className="font-bold">{fmtPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: textMuted }}>توصيل:</span>
                        <span className="font-bold">{fmtPrice(shipping)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-black pt-2 border-t" style={{ borderColor }}>
                        <span>المجموع:</span>
                        <span>{fmtPrice(total)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !formData.name || !formData.phone}
                      className="w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                      style={{ backgroundColor: accentColor }}
                    >
                      {submitting ? 'جاري الإرسال...' : 'تأكيد الشراء الآن'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SOCIAL PROOF TOAST ── */}
      {recentSale && (
        <div className="fixed bottom-24 right-4 left-4 z-50 artisan-bounce-in">
          <div className="backdrop-blur shadow-xl border p-3 rounded-2xl flex items-center gap-3 max-w-xs mx-auto" style={{ backgroundColor: surfaceColor + 'e6', borderColor: surfaceBorderColor }}>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <ShoppingBag size={18} />
            </div>
            <p className="text-[11px] font-bold">اشترى للتو: {recentSale}</p>
          </div>
        </div>
      )}

      {/* ── ANIMATIONS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes artisan-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes artisan-bounce-in {
          0% { transform: scale(0.9); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .artisan-slide-up { animation: artisan-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .artisan-bounce-in { animation: artisan-bounce-in 0.5s ease-out; }
      `}} />

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .artisan-gallery-img { max-height: 50dvh !important; }
        }
        @media (min-width: 768px) {
          .artisan-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .artisan-gallery-wrap { height: 100%; }
          .artisan-gallery-img { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${surfaceBorderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {brandName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Product Detail Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="artisan-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
            <div className="h-full">
            <ArtisanImageGallery
              imgs={detailProduct.images?.filter(Boolean) || []}
              accentColor={accentColor}
              surfaceMuted={surfaceMuted}
              surfaceTextMuted={surfaceTextMuted}
              onZoom={setZoomImage}
              videoUrl={detailProduct?.metadata?.video_url || ''}
            />
            </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-xl font-bold leading-tight" style={{ color: surfaceTextColor }}>{detailProduct.name || detailProduct.title}</h3>
                <p className="text-xl font-bold shrink-0" style={{ color: accentColor }}>{fmtPrice(detailProduct.price ?? 0)}</p>
              </div>
              {detailProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: surfaceTextMuted }}>{detailProduct.description}</p>}
              {detailProduct.category && <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: surfaceBorderColor, color: surfaceTextMuted }}>{detailProduct.category}</span>}
              {detailProduct.variants && detailProduct.variants.length > 0 && (
                <VariantSelector
                  variants={detailProduct.variants}
                  selected={detailVariant}
                  onSelect={setDetailVariant}
                  accentColor={accentColor}
                  currency={currency}
                  basePrice={detailProduct.price}
                />
              )}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
              <button onClick={() => { addToCart(detailProduct, detailVariant); setDetailProduct(null); setDetailVariant(null); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold tracking-wide text-white transition-all active:scale-95" style={{ backgroundColor: accentColor }}>
                <ShoppingBag size={18} /> أضف للسلة
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
            <X size={20} />
          </button>
          <img src={zoomImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
