import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Truck, ShieldCheck, Star,
  Phone, Trash2, CheckCircle2, ArrowRight, ShoppingBag,
  Building2, ChevronDown, User, MapPin, ChevronLeft, ChevronRight
} from 'lucide-react';
import LazyVideo from '@/components/storefront/LazyVideo';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  qty: number;
  variant_id?: number;
  variant_name?: string;
}

function BoutiqueImageGallery({ product, surfaceMuted, accentColor, surfaceTextMuted, surfaceBorderColor, onZoom }: {
  product: any; surfaceMuted: string; accentColor: string; surfaceTextMuted: string; surfaceBorderColor: string; onZoom: (src: string) => void;
}) {
  const [idx, setIdx] = React.useState(0);
  const [showVideo, setShowVideo] = React.useState(true);
  const imgs: string[] = product.images?.filter(Boolean) || [];
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const videoUrl = product?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  React.useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [product?.id]);
  const total = imgs.length + (videoEmbed ? 1 : 0);
  const currentIdx = showVideo ? 0 : (videoEmbed ? idx + 1 : idx);
  const goTo = (n: number) => {
    const t = total;
    if (n < 0) n = t - 1;
    if (n >= t) n = 0;
    if (n === 0 && videoEmbed) { setShowVideo(true); setIdx(0); }
    else { setShowVideo(false); setIdx(videoEmbed ? n - 1 : n); }
  };
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="relative w-full overflow-hidden shrink-0 boutique-gallery-fill" style={{ backgroundColor: surfaceMuted, aspectRatio: '1/1' }}>
        <div ref={galleryRef} className="flex h-full will-change-transform" style={{ transform: `translateX(-${currentIdx * 100}%)`, transition: 'transform 0.25s ease-out' }}
          onTouchStart={e => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={e => {
            const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
            const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (total <= 1) return;
            goTo(currentIdx + (dx > 0 ? 1 : -1));
          }}
        >
          {videoEmbed && (
            <div className="h-full shrink-0" style={{ flex: '0 0 100%' }}>
              {videoEmbed.type === 'youtube' ? (
                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
              ) : videoEmbed.type === 'video' ? (
                <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline preload="metadata" />
              ) : (
                <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
              )}
            </div>
          )}
          {imgs.length > 0 ? imgs.map((img, i) => (
            <img key={i} src={img} alt=""
              className="w-full h-full object-contain shrink-0 cursor-pointer"
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ flex: '0 0 100%', contentVisibility: i === 0 ? 'visible' : 'auto' }}
              onClick={() => onZoom(img)}
            />
          )) : (
            <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', color: surfaceTextMuted }}>
              <ShoppingBag size={48} strokeWidth={1} />
            </div>
          )}
        </div>
        {total > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); goTo(currentIdx - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronLeft size={18} /></button>
            <button onClick={e => { e.stopPropagation(); goTo(currentIdx + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronRight size={18} /></button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {[...Array(total)].map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className="rounded-full transition-all duration-300"
                  style={{ width: i === currentIdx ? 20 : 6, height: 6, backgroundColor: i === currentIdx ? accentColor : 'rgba(255,255,255,0.5)' }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {/* Thumbnails */}
      {total > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 justify-center" style={{ backgroundColor: surfaceMuted }}>
          {videoEmbed && (
            <button onClick={() => goTo(0)}
              className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all"
              style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            </button>
          )}
          {imgs.map((img, i) => {
            const imgIdx = videoEmbed ? i + 1 : i;
            return (
              <button key={i} onClick={() => goTo(imgIdx)}
                className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 transition-all"
                style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}>
                <img 
  src={img} 
  alt="" 
  className="w-full h-full object-cover" 
  loading="lazy"
  decoding="async"
  style={{ contentVisibility: 'auto' }}
/>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BoutiqueTemplate({ settings, products, categories, searchQuery, setSearchQuery, categoryFilter, setCategoryFilter, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug, navigate, bannerUrl: propBannerUrl }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [communeId, setCommuneId] = useState('');
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCommuneId(''); }, [selectedWilayaId]);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  const [orderProduct, setOrderProduct] = useState<any>(null);
  const [orderVariant, setOrderVariant] = useState<SelectedVariant | null>(null);
  const [orderQty, setOrderQty] = useState(1);
  useEffect(() => {
    if (!initialProductSlug) { setDetailProduct(null); return; }
    if (products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug || String(x.id) === initialProductSlug); if (p) setDetailProduct(p); }
  }, [initialProductSlug, products]);

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || '#f59e0b'; // Accent — prices, stars, badges, highlights
  const themeColor = settings?.primary_color || '#0f172a'; // Primary — CTA buttons, submit button
  const bgColor = settings?.template_bg_color || '#ffffff';
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
  const surfaceColor = bgColor; // Use page background, not header
  const surfaceTextColor = isHeaderDark ? '#f1f5f9' : '#1e293b';
  const surfaceTextMuted = isHeaderDark ? '#94a3b8' : '#64748b';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e2e8f0';
  const inputBg = isHeaderDark ? 'rgba(255,255,255,0.06)' : '#ffffff';

  // Editable text fields
  const brandName = settings?.boutique_brand_name || settings?.store_name || 'BOUTIQUE';
  const categoryName = settings?.boutique_category_name || settings?.template_featured_title || 'مجموعة المنتجات';
  const footerText = settings?.boutique_footer_text || settings?.store_description || 'صنع بشغف لزبائننا في الجزائر';

  // Configurable header colors — use existing dashboard settings
  const promoBg = settings?.boutique_promo_bg || '#dc2626';
  const promoTextColor = settings?.boutique_promo_text_color || '#ffffff';
  const headerBg = headerColor; // from iyco_header_color in dashboard
  const categoryBarBg = settings?.boutique_category_bg || headerBg;
  const searchBarBg = settings?.boutique_search_bg || (isLight(headerBg) ? '#f5f5f5' : '#222222');
  const headerTextColor = isHeaderDark ? '#ffffff' : '#111111';

   // Hero product = first product (or dzp_main_product_id)
   const heroProduct = useMemo(() => {
     if (initialProductSlug) {
       const bySlug = products?.find((p: any) => p.slug === initialProductSlug || String(p.id) === initialProductSlug);
       if (bySlug) return bySlug;
     }
     const mainId = settings?.dzp_main_product_id;
     const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
     return found || products?.[0] || null;
   }, [products, settings?.dzp_main_product_id, initialProductSlug]);

   // Optional custom hero banner (set via store settings banner_url) — replaces the product hero
   const heroBannerUrl = propBannerUrl || settings?.banner_url || null;
   const hasHeroBanner = !!heroBannerUrl;

   // Preload hero image to cut LCP resource load delay
   useEffect(() => {
     const url = heroBannerUrl || heroProduct?.images?.[0];
     if (!url) return;
     const link = document.createElement('link');
     link.rel = 'preload';
     link.as = 'image';
     link.href = url;
     document.head.appendChild(link);
     return () => { document.head.removeChild(link); };
   }, [heroBannerUrl, heroProduct?.images?.[0]]);

   // Offers system
   const { offers, loading: offersLoading } = useProductOffers(storeSlug, heroProduct?.id);
   const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
   const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
   const deliveryFee = resolveDeliveryFee(orderProduct, selectedOffer, baseDeliveryFee);

   // Collection = all products when a custom banner is used, otherwise all except the hero product
   const collectionProducts = useMemo(() => {
     if (!products || products.length === 0) return [];
     if (hasHeroBanner) return products;
     return products.filter(p => p.id !== heroProduct?.id);
   }, [products, heroProduct?.id, hasHeroBanner]);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.setAttribute('data-setting-key', key);
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // Body scroll lock
  useEffect(() => {
    if (orderProduct || detailProduct || zoomState) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [orderProduct, detailProduct, zoomState]);

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

  // Cart logic
  const addToCart = (product: { id: number; title?: string; name?: string; price: number; images?: string[] }, variant?: SelectedVariant | null) => {
    onProductView?.(product as any);
    const variantPrice = variant?.price ?? product.price;
    const cartKey = variant ? `${product.id}-${variant.id}` : `${product.id}`;
    const item: CartItem = {
      id: product.id,
      name: product.title || product.name || 'منتج',
      price: variantPrice,
      image: variant?.images?.[0] || product.images?.[0] || '',
      qty: 1,
      variant_id: variant?.id,
      variant_name: variant?.variant_name || [variant?.color, variant?.size, variant?.size2].filter(Boolean).join(' / ') || undefined,
    };
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id && i.variant_id === item.variant_id);
      if (exists) return prev.map(i => (i.id === item.id && i.variant_id === item.variant_id) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, item];
    });
    setIsCartOpen(true);
    trackAllPixels(PixelEvents.ADD_TO_CART, {
      content_ids: [product.id],
      content_name: product.title || product.name || 'منتج',
      value: variantPrice,
      currency: 'DZD',
      content_type: 'product',
    });
  };

  const updateQty = (id: number, delta: number, vid?: number) => {
    setCart(prev => prev.map(item =>
      (item.id === id && item.variant_id === vid) ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const removeFromCart = (id: number, vid?: number) => setCart(prev => prev.filter(item => !(item.id === id && item.variant_id === vid)));

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId || !orderProduct) {
      setOrderError('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    if (!isValidAlgerianPhone(customerPhone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = [selectedWilaya?.labelAR || '', communeDisplayName(getAlgeriaCommuneById(communeId)!) || '', customerAddress].filter(Boolean).join(' - ');
      const isOfferItem = selectedOffer && orderProduct.id === heroProduct?.id;
      const itemPrice = orderVariant?.price ?? orderProduct.price;

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: orderProduct.id,
          ...(orderVariant?.id ? { variant_id: orderVariant.id } : {}),
          quantity: isOfferItem ? selectedOffer.quantity : orderQty,
          ...(isOfferItem ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: isOfferItem ? selectedOffer.bundle_price : itemPrice * orderQty,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          customer_notes: customerNotes,
          shipping_wilaya_id: selectedWilayaId,
          shipping_commune_id: Number(communeId) || undefined,
          product_name: orderProduct.title || orderProduct.name || '',
          ...getFraudData(),
        }),
      });

      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      if (!res.ok) {
        let errMsg: string;
        if (data.fields) {
          const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
          errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
        } else {
          errMsg = data.error || 'حدث خطأ أثناء إرسال الطلب';
        }
        setOrderError(errMsg);
        return;
      }

      setOrderSuccess(true);
      trackAllPixels(PixelEvents.PURCHASE, {
        content_name: orderProduct?.title || orderProduct?.name || '',
        content_ids: orderProduct?.id ? [orderProduct.id] : [],
        content_type: 'product',
        value: isOfferItem ? selectedOffer.bundle_price : itemPrice * orderQty,
        currency: settings?.currency_code || 'DZD',
        num_items: isOfferItem ? selectedOffer.quantity : orderQty,
        order_id: lastOrderId || data?.order?.id || null,
      });
    } catch {
      setOrderError('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} dir="rtl">
        <div className="max-w-md mx-auto rounded-2xl p-8 text-center w-full" style={{ backgroundColor: surfaceColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <CheckCircle2 size={36} style={{ color: accentColor }} />
          </div>
           <h2 className="text-2xl font-black mb-2" style={{ color: '#111' }}>تم تسجيل طلبك بنجاح! 🎉</h2>
           <p className="text-sm mb-6" style={{ color: '#666' }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right" style={{ backgroundColor: '#f9fafb' }}>
            {orderProduct && (
              <div className="flex justify-between">
                <span style={{ color: '#666' }}>{orderProduct.title} × {orderQty}</span>
                <span className="font-bold" style={{ color: '#111' }}>{Math.round((orderVariant?.price ?? orderProduct.price) * orderQty).toLocaleString()} {currency}</span>
              </div>
            )}
            <div className="h-px my-1" style={{ backgroundColor: '#e5e7eb' }} />
            <div className="flex justify-between"><span style={{ color: '#666' }}>التوصيل</span><span className="font-bold" style={{ color: '#111' }}>{Math.round(deliveryFee ?? 0).toLocaleString()} {currency}</span></div>
            <div className="flex justify-between"><span className="font-black" style={{ color: '#111' }}>المجموع</span><span className="font-black text-lg" style={{ color: '#111' }}>{Math.round(orderProduct ? (orderVariant?.price ?? orderProduct.price) * orderQty + deliveryFee : 0).toLocaleString()} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Tajawal', sans-serif", backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: textColor }} dir="rtl">

      {/* ── PROMO BANNER — energy bar ── */}
      <div className="overflow-hidden" style={{ backgroundColor: promoBg }}>
        <div className="flex items-center justify-center gap-3 py-2 px-4">
          <span className="font-black text-xs md:text-sm uppercase tracking-wider animate-pulse" style={{ color: promoTextColor }}>⚡</span>
          <span
            className="font-black text-xs md:text-sm uppercase tracking-wider"
            style={{ color: promoTextColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('boutique_promo_text')}
          >
            {settings?.boutique_promo_text || 'عروض محدودة — خصم يصل إلى 50%'}
          </span>
          <span className="font-black text-xs md:text-sm uppercase tracking-wider animate-pulse" style={{ color: promoTextColor }}>⚡</span>
        </div>
      </div>

      {/* ── MAIN HEADER — scrolls with content ── */}
      <header style={{ backgroundColor: headerBg, borderBottom: `3px solid ${themeColor}` }}>
        {/* Top row — logo + tagline + actions */}
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 py-2.5">
          {/* Left — logo + store name */}
          <div className="flex items-center gap-3">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={brandName} className="h-8 md:h-9 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center font-black text-sm" style={{ backgroundColor: themeColor, color: isLight(themeColor) ? '#111' : '#fff' }}>
                  {brandName.charAt(0)}
                </div>
                <span className="text-sm md:text-base font-black uppercase tracking-wider" style={{ color: headerTextColor }}>{brandName}</span>
              </div>
            )}
          </div>

          {/* Center — tagline (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: themeColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('store_description')}
            >
              {settings?.store_description || 'تسوّق بأفضل الأسعار'}
            </span>
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/10" style={{ color: headerTextColor, border: `1px solid ${themeColor}` }}>
              <User size={15} />
              <span className="hidden md:inline">حسابي</span>
            </button>
            <button onClick={() => setIsCartOpen(true)} className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/10" style={{ color: headerTextColor, border: `1px solid ${themeColor}` }}>
              <ShoppingCart size={15} />
              <span className="hidden md:inline">السلة</span>
              {cart.length > 0 && (
                <span className="absolute -top-2 -left-2 min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-black text-white px-1" style={{ backgroundColor: '#e11d48' }}>
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="px-4 pb-2.5">
          <div className="max-w-[1400px] mx-auto relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full h-10 pr-10 pl-4 text-sm font-bold outline-none"
              style={{ backgroundColor: searchBarBg, border: `2px solid ${isLight(searchBarBg) ? '#ccc' : '#444'}`, color: isLight(searchBarBg) ? '#111' : '#fff' }}
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isLight(searchBarBg) ? '#666' : '#888'} strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>

        {/* Category nav */}
        {categories.length > 0 && (
          <div className="flex items-center overflow-x-auto scrollbar-hide" style={{ backgroundColor: categoryBarBg, borderTop: `1px solid ${isLight(categoryBarBg) ? '#ccc' : '#333'}` }}>
            <button
              onClick={() => setCategoryFilter('')}
              className="shrink-0 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors"
              style={{ backgroundColor: !categoryFilter ? themeColor : 'transparent', color: !categoryFilter ? (isLight(themeColor) ? '#111' : '#fff') : (isLight(categoryBarBg) ? '#666' : '#888'), borderBottom: !categoryFilter ? `3px solid ${headerTextColor}` : '3px solid transparent' }}
            >
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="shrink-0 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors"
                style={{ backgroundColor: categoryFilter === cat ? themeColor : 'transparent', color: categoryFilter === cat ? (isLight(themeColor) ? '#111' : '#fff') : (isLight(categoryBarBg) ? '#666' : '#888'), borderBottom: categoryFilter === cat ? `3px solid ${headerTextColor}` : '3px solid transparent' }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="max-w-[1400px] mx-auto px-1 md:px-2 pb-20 md:pb-0">

        {/* COLLECTION GRID — Temu Style */}
        {collectionProducts.length > 0 && (
          <section className="px-1 md:px-2 pt-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3
                className="text-base font-black"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('boutique_category_name')}
              >
                {categoryName}
              </h3>
              <span className="text-[11px] font-bold" style={{ color: textMuted }}>{collectionProducts.length} منتج</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}>
              {collectionProducts.map(product => {
                const p = product as any;
                const stock = p.stock_quantity ?? null;
                const isOnlyLeft = stock !== null && stock > 0 && stock <= 5;
                const discount = p.original_price && p.original_price > p.price
                  ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
                  : 0;
                const ratingVal = p.rating != null && p.rating > 0 ? p.rating : null;
                const reviewCount = p.review_count ?? p.rating_count ?? null;
                const category = p.category || '';
                const isBestSeller = p.is_featured || discount > 20;
                const soldCount = p.sold_count ?? p.sales_count ?? null;

                // Label logic — Temu style
                const isNewArrival = p.is_new || (p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000);
                const labelType = isBestSeller ? 'bestseller' : isNewArrival ? 'new' : ratingVal && ratingVal >= 4.5 ? 'toprated' : null;

                return (
                  <div key={product.id} className="group cursor-pointer bg-white" onClick={() => { setDetailProduct(product); onProductView?.(product); if (navigate) navigate(buildStoreUrl(storeSlug, product?.slug || String(product.id))); }}>
                    {/* Image */}
                    <div className="relative overflow-hidden" style={{ aspectRatio: '3 / 4', backgroundColor: '#f5f5f5' }}>
                      {(product as any)?.metadata?.video_url?.match(/\.(mp4|webm|ogg)(\?|$)/i)
                        ? <LazyVideo src={(product as any).metadata.video_url} poster={product.images?.[0] || ''}
                            onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                            className="w-full h-full" />
                        : (product as any)?.metadata?.video_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
                          ? <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}?autoplay=1&mute=1&loop=1&playlist=${(product as any).metadata.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}&controls=0`} allow="autoplay; encrypted-media" />
                          : <img
                              src={product.images?.[0] || ''}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              width="600"
                              height="800"
                            />
                      }
                    </div>

                    {/* Info */}
                    <div className="px-2 py-2.5" style={{ color: '#1e293b' }}>
                      {/* Title */}
                      <h4 className="text-xs font-bold leading-snug line-clamp-1" style={{ color: '#1e293b' }}>{product.title}</h4>

                      {/* Price + sold + cart row */}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black" style={{ color: accentColor }} dir="ltr">
                            {Math.round(product.price ?? 0).toLocaleString()}
                          </span>
                          {p.original_price && p.original_price > product.price && (
                            <span className="text-[10px] line-through" style={{ color: '#94a3b8' }} dir="ltr">
                              {Math.round(p.original_price ?? 0).toLocaleString()}
                            </span>
                          )}
                          {soldCount !== null && (
                            <span className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>
                              🔥 {soldCount >= 1000 ? `${(soldCount / 1000).toFixed(1)}K+` : `${soldCount}+`} sold
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setDetailProduct(product); onProductView?.(product); if (navigate) navigate(buildStoreUrl(storeSlug, product?.slug || String(product.id))); }}
                          className="w-8 h-8 flex items-center justify-center shrink-0 transition-transform active:scale-90"
                          style={{ border: `2px solid ${themeColor}`, color: themeColor, borderRadius: '50%' }}
                        >
                          <ShoppingCart size={14} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Badges row */}
                      {(discount > 0 || isOnlyLeft) && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {discount > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 text-white" style={{ backgroundColor: '#e11d48' }}>
                              🔥 SAVINGS
                            </span>
                          )}
                          {isOnlyLeft && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-500 text-white">
                              Only {stock} left
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rating */}
                      {ratingVal != null && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="flex items-center">
                            {[1,2,3,4,5].map(star => (
                              <svg key={star} className="w-2.5 h-2.5" style={{ color: star <= Math.round(ratingVal) ? '#f59e0b' : '#ddd' }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            ))}
                          </div>
                          {reviewCount != null && (
                            <span className="text-[10px]" style={{ color: '#94a3b8' }}>{reviewCount.toLocaleString()}</span>
                          )}
                        </div>
                      )}

                      {/* Label */}
                      {labelType && category && (
                        <div className="text-[10px] font-bold mt-1.5" style={{ color: labelType === 'bestseller' ? '#e11d48' : labelType === 'new' ? '#16a34a' : '#7c3aed' }}>
                          {labelType === 'bestseller' && '★ Best-Selling in '}
                          {labelType === 'new' && '✦ New Arrival in '}
                          {labelType === 'toprated' && '★ Top Rated in '}
                          <span style={{ color: '#94a3b8' }}>{category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* No products placeholder */}
        {!heroProduct && collectionProducts.length === 0 && (
          <div className="p-10 text-center" style={{ color: textMuted }}>
            <ShoppingCart size={48} className="mx-auto mb-4" style={{ color: borderColor }} />
            <p className="font-bold">أضف منتجات من لوحة التحكم</p>
          </div>
        )}

        {/* FOOTER */}
        <footer className="p-8 text-center mt-10 pb-24 md:pb-8" style={{ backgroundColor: surfaceMuted, color: textMuted }}>
          <p className="text-xs uppercase tracking-widest font-bold">{brandName}</p>
          <p
            className="text-[10px] mt-2 italic"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('boutique_footer_text')}
          >
            {footerText}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <span className="text-[10px]">📞 {settings?.store_phone || 'اتصل بنا'}</span>
            <span className="text-[10px]">📍 توصيل لـ 58 ولاية</span>
          </div>
          <p className="text-[10px] mt-4 opacity-50">صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
        </footer>
      </div>

      {/* ── SIDE CART & CHECKOUT DRAWER ── */}
      {orderProduct && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }} onClick={() => { setOrderProduct(null); setOrderQty(1); }} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md shadow-2xl flex flex-col" style={{ backgroundColor: '#ffffff' }}>

              {/* Drawer Header */}
              <div className="px-3 py-3 border-b flex justify-between items-center" style={{ borderColor: '#e5e7eb' }}>
                <button onClick={() => { setOrderProduct(null); setOrderQty(1); }} className="p-1.5" style={{ color: '#111' }}><X size={20} /></button>
                <h2 className="text-sm font-black" style={{ color: '#111' }}>تأكيد الطلب</h2>
                <span className="w-8" />
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                  {/* Product Summary */}
                  <div className="flex gap-2.5 p-2.5 rounded-xl border" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                    {orderProduct.images?.[0] && (
  <img 
    src={orderProduct.images[0]} 
    className="w-16 h-16 object-cover rounded-lg shrink-0" 
    alt={orderProduct.title}
    loading="lazy"
    decoding="async"
    width="64"
    height="64"
    style={{ contentVisibility: 'auto' }}
  />
)}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate" style={{ color: '#111' }}>{orderProduct.title}</h4>
                      {orderVariant?.variant_name && <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>{orderVariant.variant_name}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center border rounded-lg overflow-hidden" style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}>
                          <button type="button" onClick={() => setOrderQty(q => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center active:scale-90 transition-transform" style={{ color: '#666' }}><Minus size={12} /></button>
                          <span className="w-8 text-center font-black text-xs tabular-nums" style={{ color: '#111' }}>{orderQty}</span>
                          <button type="button" onClick={() => setOrderQty(q => Math.min(99, q + 1))} className="w-7 h-7 flex items-center justify-center active:scale-90 transition-transform" style={{ color: accentColor }}><Plus size={12} /></button>
                        </div>
                        <p className="font-black text-sm" style={{ color: accentColor }}>
                          {Math.round((orderVariant?.price ?? orderProduct.price ?? 0) * orderQty).toLocaleString()} {currency}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* COD FORM */}
                  <div className="border-t pt-3" style={{ borderColor: '#e5e7eb' }}>
                      {orderProduct.variants && orderProduct.variants.length > 0 && (
                        <div className="mb-3">
                          <VariantSelector variants={orderProduct.variants} selected={orderVariant} onSelect={setOrderVariant} accentColor={accentColor} currency={currency} basePrice={orderProduct.price} />
                        </div>
                      )}
                      {offers.length > 0 && orderProduct.id === heroProduct?.id && (
                          <div className="mb-4">
                          <OfferSelector
                            offers={offers}
                            unitPrice={heroProduct?.price || 0}
                            currency={currency}
                            selectedOfferId={selectedOffer?.offer_id ?? null}
                            onSelect={handleOfferSelect}
                            accentColor={accentColor}
                            textColor="#111"
                            borderColor="#e5e7eb"
                            bgColor="#f9fafb"
                          />
                          </div>
                        )}
                        <form id="orderForm" onSubmit={handleOrder} noValidate className="space-y-2.5">
                          {/* Name input with icon */}
                          <div className="relative">
                            <input 
                              name="name" 
                              type="text" 
                              required 
                              className="w-full pl-4 pr-10 py-2.5 rounded-lg transition-all text-sm"
                              style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                              placeholder="الاسم الكامل"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                              <User size={16} />
                            </div>
                          </div>

                          {/* Phone input with icon */}
                          <div className="relative">
                            <input 
                              name="phone" 
                              type="tel" 
                              required 
                              dir="ltr"
                              maxLength={10}
                              className="w-full pl-4 pr-10 py-2.5 rounded-lg transition-all text-sm"
                              style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                              placeholder="رقم الهاتف"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                              <Phone size={16} />
                            </div>
                          </div>

                          {/* Wilaya select with icon */}
                          <div className="relative">
                            <select 
                              value={selectedWilayaId || ''} 
                              onChange={e => setSelectedWilayaId(Number(e.target.value))}
                              required
                              className="w-full pl-10 pr-10 py-2.5 rounded-lg transition-all appearance-none text-sm"
                              style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                            >
                              <option value="">اختر الولاية</option>
                              {wilayas.map(w => (
                                <option key={w.id} value={w.id}>{w.labelAR}</option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                              <MapPin size={20} />
                            </div>
                            <ChevronDown size={18} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#111', opacity: 0.4 }} />
                          </div>

                           {/* Commune select with icon */}
                          {showCommune && (
                            <div className="relative">
                              <select 
                                name="commune"
                                required 
                                disabled={!selectedWilayaId}
                                value={communeId}
                                onChange={e => setCommuneId(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 rounded-lg transition-all appearance-none disabled:opacity-50 text-sm"
                                style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                              >
                                <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                                {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                                <Building2 size={16} />
                              </div>
                              <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#111', opacity: 0.4 }} />
                            </div>
                          )}

                          {/* Address input with icon */}
                          {showAddress && (
                            <div className="relative">
                              <input 
                                name="address" 
                                type="text" 
                                className="w-full pl-4 pr-10 py-2.5 rounded-lg transition-all text-sm"
                                style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                                placeholder="عنوان التوصيل"
                                value={customerAddress}
                                onChange={e => setCustomerAddress(e.target.value)}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                                <Building2 size={16} />
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {showNotes && (
                            <div>
                              <textarea 
                                name="notes" 
                                rows={2}
                                value={customerNotes}
                                onChange={e => setCustomerNotes(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg transition-all resize-none text-sm"
                                style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#111' }}
                                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                                placeholder="ملاحظات إضافية (اختياري)"
                              />
                            </div>
                          )}

                          {/* Delivery Type Toggle */}
                          {(showHomeDelivery || showDeskDelivery) && (
                            <div className="grid grid-cols-2 gap-2">
                              {showHomeDelivery && (
                                <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 transition-all text-xs font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : '#fff', color: selectedDeliveryType === 'home' ? accentColor : '#111' }}>
                                  <Truck size={14} />
                                  <span>توصيل للمنزل</span>
                                </button>
                              )}
                              {showDeskDelivery && (
                                <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 transition-all text-xs font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : '#fff', color: selectedDeliveryType === 'desk' ? accentColor : '#111' }}>
                                  <Building2 size={14} />
                                  <span>استلام من المكتب</span>
                                </button>
                              )}
                            </div>
                          )}
                      </form>
                  </div>

                  {/* Order Summary — scrolls with content */}
                  <div className="border-t pt-3 space-y-2" style={{ borderColor: '#e5e7eb' }}>
                    <div className="space-y-1.5 text-sm" style={{ color: '#666' }}>
                      <div className="flex justify-between">
                        <span>{Math.round(orderVariant?.price ?? orderProduct.price ?? 0).toLocaleString()} {currency} × {orderQty}</span>
                        <span className="font-bold" style={{ color: '#111' }}>{Math.round((orderVariant?.price ?? orderProduct.price ?? 0) * orderQty).toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>التوصيل</span>
                        <span className="font-bold" style={{ color: '#111' }}>{deliveryFee === 0 ? 'مجاني ✅' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                      </div>
                      <div className="h-px" style={{ backgroundColor: '#e5e7eb' }} />
                      <div className="flex justify-between font-black text-base" style={{ color: '#111' }}>
                        <span>المجموع</span>
                        <span style={{ color: accentColor }}>{Math.round(((orderVariant?.price ?? orderProduct.price ?? 0) * orderQty) + deliveryFee).toLocaleString()} {currency}</span>
                      </div>
                    </div>
                    {orderError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center whitespace-pre-line text-start">
                        {orderError}
                      </div>
                    )}
                    <button
                      type="submit"
                      form="orderForm"
                      disabled={isSubmitting}
                      className="w-full text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 text-sm"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isSubmitting ? 'جاري الإرسال...' : (
                        <><ShoppingBag size={20} /> تأكيد الطلب (الدفع عند الاستلام)</>
                      )}
                    </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{ __html: `
        .dz-description { font-size: 1.125rem; line-height: 1.8; }
        .dz-description * { font-family: inherit; }
        .dz-description img { max-width: 100%; height: auto; border-radius: 0.75rem; }
        @media (max-width: 767px) {
          .boutique-gallery-img { max-height: 50dvh !important; }
          .boutique-gallery-fill { aspect-ratio: unset !important; height: 70dvh !important; }
          .boutique-gallery-fill img,
          .boutique-gallery-fill video { object-fit: contain !important; }
        }
        @media (min-width: 768px) {
          .boutique-modal-card { height: 98vh !important; max-height: 98vh !important; contain: layout style; }
          .boutique-gallery-fill { aspect-ratio: unset !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Product Detail Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setDetailProduct(null); if (navigate) navigate(buildStoreUrl(storeSlug, '/')); }} />
          <div className="boutique-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto overflow-y-auto md:overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: '#ffffff', color: '#1e293b', height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => { setDetailProduct(null); if (navigate) navigate(buildStoreUrl(storeSlug, '/')); }} className="fixed top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center md:absolute" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}><X size={18} /></button>

            {/* Left — Image gallery */}
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full">
              <BoutiqueImageGallery product={detailProduct} surfaceMuted={surfaceMuted} accentColor={accentColor} surfaceTextMuted={surfaceTextMuted} surfaceBorderColor={surfaceBorderColor} onZoom={(src) => { const imgs = detailProduct?.images?.filter(Boolean) || []; const idx = imgs.indexOf(src); setZoomState({ images: imgs.length ? imgs : [src], idx: idx >= 0 ? idx : 0 }); }} />
            </div>

            {/* Right — Product info (Temu style) */}
            <div className="w-full md:flex-1 md:flex md:flex-col md:overflow-hidden" dir="rtl">
              <div className="px-6 pt-8 pb-4 md:flex-1 md:overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>

                {/* Title */}
                <h3 className="text-lg font-bold leading-snug" style={{ color: '#111' }}>{detailProduct.title}</h3>

                {/* Sold count + rating row */}
                <div className="flex items-center gap-3 text-sm mt-2" style={{ color: '#666' }}>
                  {((detailProduct as any).sold_count ?? (detailProduct as any)?.sales_count) && (
                    <span>{(detailProduct as any).sold_count ?? (detailProduct as any).sales_count}+ sold</span>
                  )}
                  {detailProduct.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={12} fill={s <= Math.round(detailProduct.rating) ? '#f59e0b' : 'none'} stroke={s <= Math.round(detailProduct.rating) ? '#f59e0b' : '#ccc'} />
                        ))}
                      </div>
                      <span>{detailProduct.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Best seller badge */}
                {(detailProduct as any).is_featured && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[11px] font-black px-2 py-1 text-white" style={{ backgroundColor: '#e11d48' }}>#1 Best-Selling</span>
                    {detailProduct.category && <span className="text-[11px]" style={{ color: '#666' }}>in {detailProduct.category}</span>}
                  </div>
                )}

                {/* Price row */}
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-2xl font-black" style={{ color: '#111' }} dir="ltr">
                    {Math.round(detailVariant?.price ?? detailProduct.price ?? 0).toLocaleString()}
                  </span>
                  <span className="text-base font-bold" style={{ color: '#666' }}>{currency}</span>
                  {(detailProduct as any).original_price && (detailProduct as any).original_price > (detailVariant?.price ?? detailProduct.price) && (
                    <>
                      <span className="text-sm line-through" style={{ color: '#999' }} dir="ltr">
                        {Math.round((detailProduct as any).original_price).toLocaleString()} {currency}
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 text-white" style={{ backgroundColor: '#e11d48' }}>
                        -{Math.round((((detailProduct as any).original_price - (detailVariant?.price ?? detailProduct.price)) / (detailProduct as any).original_price) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                {/* Variants — Colors & Sizes */}
                {detailProduct.variants && detailProduct.variants.length > 0 && (
                  <div className="mt-5">
                    <VariantSelector
                      variants={detailProduct.variants}
                      selected={detailVariant}
                      onSelect={setDetailVariant}
                      accentColor={accentColor}
                      currency={currency}
                      basePrice={detailProduct.price}
                    />
                  </div>
                )}

                {/* Service section */}
                {settings?.free_delivery_threshold && (
                  <div className="mt-5">
                    <span className="text-sm font-semibold" style={{ color: '#111' }}>Service</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs font-bold px-3 py-1.5 border" style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                        ✓ توصيل مجاني
                      </span>
                      <span className="text-xs font-bold px-3 py-1.5 border" style={{ borderColor: '#2563eb', color: '#2563eb' }}>
                        ✓ الدفع عند الاستلام
                      </span>
                    </div>
                  </div>
                )}

                {/* Qty selector */}
                <div className="flex items-center justify-between mt-5">
                  <span className="text-sm font-semibold" style={{ color: '#111' }}>Qty</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                      className="w-8 h-8 flex items-center justify-center border text-lg font-bold"
                      style={{ borderColor: '#ddd', color: '#111' }}
                    >
                      −
                    </button>
                    <span className="text-base font-bold min-w-[24px] text-center" style={{ color: '#111' }}>{orderQty}</span>
                    <button
                      onClick={() => setOrderQty(orderQty + 1)}
                      className="w-8 h-8 flex items-center justify-center border text-lg font-bold"
                      style={{ borderColor: '#ddd', color: '#111' }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Description */}
                {detailProduct.description && (
                  <div className="mt-5 text-sm whitespace-pre-line" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: detailProduct.description }} />
                )}

                {/* Category */}
                {detailProduct.category && (
                  <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 border mt-5" style={{ borderColor: '#ddd', color: '#666' }}>
                    {detailProduct.category}
                  </span>
                )}
              </div>

              {/* Bottom CTA */}
              <div className="shrink-0 px-6 pb-6 pt-3" style={{ borderTop: '1px solid #eee' }}>
                <button
                  onClick={() => { setOrderProduct(detailProduct); setOrderVariant(detailVariant); setDetailProduct(null); }}
                  className="w-full py-4 font-bold tracking-wide transition-all active:scale-95"
                  style={{
                    backgroundColor: detailVariant || (!detailProduct.variants || detailProduct.variants.length === 0) ? themeColor : '#e5e7eb',
                    color: detailVariant || (!detailProduct.variants || detailProduct.variants.length === 0) ? (isLight(themeColor) ? '#1e293b' : '#fff') : '#9ca3af'
                  }}
                >
                  {detailVariant || (!detailProduct.variants || detailProduct.variants.length === 0) ? 'اطلب الآن' : 'اختر المقاس أولاً'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setZoomState(null); }}>
            <X size={20} />
          </button>
          {zoomState.images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); const n = (zoomState.idx - 1 + zoomState.images.length) % zoomState.images.length; setZoomState({ ...zoomState, idx: n }); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronLeft size={24} /></button>
              <button onClick={e => { e.stopPropagation(); const n = (zoomState.idx + 1) % zoomState.images.length; setZoomState({ ...zoomState, idx: n }); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white/70 hover:text-white w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronRight size={24} /></button>
            </>
          )}
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}
            onTouchStart={e => { (e.currentTarget as any)._zx = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (!zoomState || zoomState.images.length <= 1) return;
              const dx = (e.currentTarget as any)._zx - e.changedTouches[0].clientX;
              if (Math.abs(dx) < 50) return;
              const n = dx > 0
                ? (zoomState.idx + 1) % zoomState.images.length
                : (zoomState.idx - 1 + zoomState.images.length) % zoomState.images.length;
              setZoomState({ ...zoomState, idx: n });
            }}
          >
            <img 
  key={zoomState.idx} 
  src={zoomState.images[zoomState.idx]} 
  alt="Preview" 
  className="max-w-full max-h-[95vh] object-contain rounded-2xl" 
  decoding="async"
  style={{ contentVisibility: 'auto' }}
/>
          </div>
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pt-2 overflow-x-auto justify-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((img, i) => (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110 ring-2 ring-white/30' : 'border-white/20 opacity-50 hover:opacity-80'}`}>
                  <img 
  src={img} 
  alt="" 
  className="w-full h-full object-cover" 
  loading="lazy"
  decoding="async"
  width="56"
  height="56"
  style={{ contentVisibility: 'auto' }}
/>
                </button>
              ))}
            </div>
          )}
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex justify-center gap-1.5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === zoomState.idx ? 20 : 6, height: 6, backgroundColor: i === zoomState.idx ? '#fff' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Mobile Checkout Bar */}
      {heroProduct && !orderProduct && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 border-t flex items-center gap-3" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
          <div className="flex-1">
            <p className="font-black text-lg" style={{ color: accentColor }}>{Math.round(heroProduct.price ?? 0).toLocaleString()} {currency}</p>
            <p className="text-[10px]" style={{ color: '#666' }}>الدفع عند الاستلام</p>
          </div>
          <button
            onClick={() => { setDetailProduct(heroProduct); onProductView?.(heroProduct); if (heroProduct?.slug && navigate) navigate(buildStoreUrl(storeSlug, heroProduct.slug)); }}
            className="text-white font-bold px-8 py-3 rounded-xl text-base shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            اطلب الآن
          </button>
        </div>
      )}
      {(detailProduct || orderProduct || zoomState) && (
        <style>{`[data-storefront-contact="true"] { display: none !important; }`}</style>
      )}
    </div>
  );
}
