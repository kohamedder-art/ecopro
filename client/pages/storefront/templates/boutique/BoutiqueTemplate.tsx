import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Truck, ShieldCheck, Star,
  Phone, Trash2, CheckCircle2, ArrowRight, ShoppingBag,
  Home, Building2
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
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarouselTo = (i: number) => carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * i, behavior: 'smooth' });
  const videoUrl = product?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  React.useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [product?.id]);
  return (
    <div className="boutique-gallery-wrap flex flex-col h-full">
      <div className="boutique-gallery-img relative w-full aspect-square overflow-hidden shrink-0" style={{ backgroundColor: surfaceMuted }}>
        <div ref={carouselRef} className="flex h-full" style={{ overflowX: 'scroll', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {videoEmbed && (
            <div className="h-full shrink-0" style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}>
              {videoEmbed.type === 'youtube' ? (
                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
              ) : videoEmbed.type === 'video' ? (
                <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
              ) : (
                <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
              )}
            </div>
          )}
          {imgs.length > 0 ? imgs.map((img, i) => (
            <img key={i} src={img} alt=""
              className="w-full h-full object-cover shrink-0 cursor-pointer"
              loading="lazy"
              style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }}
              onClick={() => onZoom(img)}
            />
          )) : (
            <div className="w-full h-full flex items-center justify-center shrink-0" style={{ flex: '0 0 100%', color: surfaceTextMuted }}>
              <ShoppingBag size={48} strokeWidth={1} />
            </div>
          )}
        </div>
      </div>
      {(videoEmbed || imgs.length > 1) && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${surfaceBorderColor}` }}>
          {videoEmbed && <button onClick={() => { setShowVideo(true); scrollCarouselTo(0); }} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
          {imgs.map((img, i) => (
            <button key={i} onClick={() => { setShowVideo(false); setIdx(i); scrollCarouselTo(videoEmbed ? i + 1 : i); }} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}>
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoutiqueTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [commune, setCommune] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  const [orderProduct, setOrderProduct] = useState<any>(null);
  const [orderVariant, setOrderVariant] = useState<SelectedVariant | null>(null);
  const [orderQty, setOrderQty] = useState(1);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || propPrimaryColor || '#f59e0b'; // amber-500
  const themeColor = settings?.boutique_theme_color || settings?.primary_color || '#0f172a'; // slate-900
  const bgColor = settings?.template_bg_color || '#ffffff';
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

  // Editable text fields
  const brandName = settings?.boutique_brand_name || settings?.store_name || 'BOUTIQUE';
  const categoryName = settings?.boutique_category_name || settings?.template_featured_title || 'مجموعة المنتجات';
  const footerText = settings?.boutique_footer_text || settings?.store_description || 'صنع بشغف لزبائننا في الجزائر';

  // Hero product = first product (or dzp_main_product_id)
  const heroProduct = useMemo(() => {
    if (initialProductSlug) {
      const bySlug = products?.find((p: any) => p.slug === initialProductSlug);
      if (bySlug) return bySlug;
    }
    const mainId = settings?.dzp_main_product_id;
    const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
    return found || products?.[0] || null;
  }, [products, settings?.dzp_main_product_id, initialProductSlug]);

  // Offers system
  const { offers } = useProductOffers(storeSlug, heroProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(heroProduct, selectedOffer, baseDeliveryFee);

  // Collection = rest of products (excluding the hero)
  const collectionProducts = useMemo(() => {
    if (!products || products.length <= 1) return [];
    return products.filter(p => p.id !== heroProduct?.id);
  }, [products, heroProduct?.id]);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
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
      variant_name: variant?.variant_name || [variant?.color, variant?.size].filter(Boolean).join(' / ') || undefined,
    };
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id && i.variant_id === item.variant_id);
      if (exists) return prev.map(i => (i.id === item.id && i.variant_id === item.variant_id) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, item];
    });
    setIsCartOpen(true);
  };

  const updateQty = (id: number, delta: number, vid?: number) => {
    setCart(prev => prev.map(item =>
      (item.id === id && item.variant_id === vid) ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const removeFromCart = (id: number, vid?: number) => setCart(prev => prev.filter(item => !(item.id === id && item.variant_id === vid)));

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0);

  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId || !orderProduct) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = [selectedWilaya?.labelAR || '', commune, customerAddress].filter(Boolean).join(' - ');
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
        }),
      });

      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      if (!res.ok) {
        alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
        return;
      }

      setOrderSuccess(true);
    } catch {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="max-w-md mx-auto rounded-2xl p-8 text-center w-full" style={{ backgroundColor: surfaceColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <CheckCircle2 size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: surfaceTextColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-sm mb-6" style={{ color: surfaceTextMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right" style={{ backgroundColor: surfaceMuted }}>
            {orderProduct && (
              <div className="flex justify-between">
                <span style={{ color: surfaceTextMuted }}>{orderProduct.title} × {orderQty}</span>
                <span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round((orderVariant?.price ?? orderProduct.price) * orderQty).toLocaleString()} {currency}</span>
              </div>
            )}
            <div className="h-px my-1" style={{ backgroundColor: surfaceBorderColor }} />
            <div className="flex justify-between"><span style={{ color: surfaceTextMuted }}>التوصيل</span><span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} {currency}</span></div>
            <div className="flex justify-between"><span className="font-black" style={{ color: surfaceTextColor }}>المجموع</span><span className="font-black text-lg" style={{ color: surfaceTextColor }}>{Math.round(orderProduct ? (orderVariant?.price ?? orderProduct.price) * orderQty + deliveryFee : 0).toLocaleString()} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">

      {/* HEADER */}
      <header className="sticky top-0 z-40 text-white px-4 py-3 shadow-md" style={{ backgroundColor: themeColor }}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />}
            <h1
              className="text-xl font-black tracking-tighter italic"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('boutique_brand_name')}
            >
              {brandName}
            </h1>
          </div>
        </div>
      </header>

      {/* HERO SECTION - full width */}
      {heroProduct && (
        <section className="relative overflow-hidden" style={{ height: '420px' }}>
          <img
            src={heroProduct.images?.[0] || ''}
            alt={heroProduct.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent, transparent)' }} />
          <div className="absolute bottom-0 p-6 text-white max-w-6xl mx-auto w-full left-0 right-0">
              <span
                className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest text-white"
                style={{ backgroundColor: accentColor }}
              >
                الأكثر طلباً
              </span>
              <h2 className="text-3xl font-black mt-2">{heroProduct.title}</h2>
              {heroProduct.description && (
                <p className="text-sm mt-2 line-clamp-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{heroProduct.description}</p>
              )}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-2xl font-black" style={{ color: accentColor }}>
                  {Math.round(heroProduct.price ?? 0).toLocaleString()} {currency}
                </span>
                {(heroProduct as any).original_price && (heroProduct as any).original_price > heroProduct.price && (
                  <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.5)' }} dir="ltr">
                    {Math.round(((heroProduct as any).original_price) ?? 0).toLocaleString()} {currency}
                  </span>
                )}
                <button
                  onClick={() => { setDetailProduct(heroProduct); onProductView?.(heroProduct); }}
                  className="font-bold px-6 py-2 rounded-full text-sm hover:opacity-90 transition-colors active:scale-95"
                  style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}
                >
                  اطلب الآن
                </button>
              </div>
          </div>
        </section>
      )}

      <div className="max-w-6xl mx-auto">

        {/* TRUST MINI-BAR */}
        <div className="flex justify-around py-4 border-b text-[10px] font-bold" style={{ borderColor, backgroundColor: surfaceMuted, color: textMuted }}>
          <div className="flex items-center gap-1"><Truck size={14} /> توصيل 58 ولاية</div>
          <div className="flex items-center gap-1"><ShieldCheck size={14} /> الدفع عند الاستلام</div>
          <div className="flex items-center gap-1"><Star size={14} fill="currentColor" /> جودة مضمونة</div>
        </div>

        {/* COLLECTION GRID */}
        {collectionProducts.length > 0 && (
          <section className="p-4">
            <h3
              className="text-lg font-black mb-4 pr-3"
              style={{ borderRight: `4px solid ${accentColor}` }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('boutique_category_name')}
            >
              {categoryName}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {collectionProducts.map(product => (
                <div key={product.id} className="group cursor-pointer rounded-2xl overflow-hidden" style={{ backgroundColor: surfaceColor }} onClick={() => { setDetailProduct(product); onProductView?.(product); }}>
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      src={product.images?.[0] || ''}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    {(product as any).original_price && (product as any).original_price > product.price && (
                      <div className="absolute top-2 right-2 text-white text-[9px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor }}>
                        -{Math.round((1 - product.price / (product as any).original_price) * 100)}%
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailProduct(product); onProductView?.(product); }}
                      className="absolute bottom-2 left-2 right-2 backdrop-blur text-xs font-bold py-2 rounded-lg opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all"
                      style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: surfaceTextColor }}
                    >
                      اطلب الآن
                    </button>
                  </div>
                  <div className="p-2">
                    <h4 className="font-bold text-xs line-clamp-1" style={{ color: textColor }}>{product.title}</h4>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="font-black text-sm" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} {currency}</p>
                      {(product as any).original_price && (product as any).original_price > product.price && (
                        <p className="text-[10px] line-through" style={{ color: textMuted }}>{Math.round((product as any).original_price ?? 0).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
        <footer className="p-10 text-center mt-10" style={{ backgroundColor: surfaceMuted, color: textMuted }}>
          <p className="text-xs uppercase tracking-widest font-bold">{brandName}</p>
          <p
            className="text-[10px] mt-2 italic"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('boutique_footer_text')}
          >
            {footerText}
          </p>
          <p className="text-[10px] mt-3">صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
        </footer>
      </div>

      {/* ── SIDE CART & CHECKOUT DRAWER ── */}
      {orderProduct && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }} onClick={() => { setOrderProduct(null); setOrderQty(1); }} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md shadow-2xl flex flex-col" style={{ backgroundColor: surfaceColor }}>

              {/* Drawer Header */}
              <div className="px-4 py-6 border-b flex justify-between items-center" style={{ borderColor: surfaceBorderColor }}>
                <button onClick={() => { setOrderProduct(null); setOrderQty(1); }} className="p-2" style={{ color: surfaceTextColor }}><X size={24} /></button>
                <h2 className="text-lg font-black" style={{ color: surfaceTextColor }}>تأكيد الطلب</h2>
                <span className="w-10" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Product Summary */}
                  <div className="flex gap-3 p-3 rounded-2xl border" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
                    {orderProduct.images?.[0] && <img src={orderProduct.images[0]} className="w-20 h-20 object-cover rounded-xl shrink-0" alt={orderProduct.title} />}
                    <div className="flex-1">
                      <h4 className="font-bold text-sm" style={{ color: surfaceTextColor }}>{orderProduct.title}</h4>
                      {orderVariant?.variant_name && <p className="text-xs mt-0.5" style={{ color: surfaceTextMuted }}>{orderVariant.variant_name}</p>}
                      <p className="font-black text-sm mt-1" style={{ color: accentColor }}>{Math.round(orderVariant?.price ?? orderProduct.price ?? 0).toLocaleString()} {currency}</p>
                      <div className="flex items-center border rounded-lg mt-2 w-fit" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
                        <button type="button" onClick={() => setOrderQty(q => Math.max(1, q - 1))} className="p-1.5" style={{ color: surfaceTextMuted }}><Minus size={14} /></button>
                        <span className="px-3 font-bold text-sm" style={{ color: surfaceTextColor }}>{orderQty}</span>
                        <button type="button" onClick={() => setOrderQty(q => q + 1)} className="p-1.5" style={{ color: surfaceTextMuted }}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* COD FORM */}
                  <div className="border-t pt-4" style={{ borderColor: surfaceBorderColor }}>
                      {offers.length > 0 && orderProduct.id === heroProduct?.id && (
                          <OfferSelector
                            offers={offers}
                            unitPrice={heroProduct?.price || 0}
                            currency={currency}
                            selectedOfferId={selectedOffer?.offer_id ?? null}
                            onSelect={handleOfferSelect}
                            accentColor={accentColor}
                            textColor={surfaceTextColor}
                            borderColor={surfaceBorderColor}
                            hidePrice={true}
                          />
                        )}
                        <h3 className="text-lg font-black mb-4 mt-2" style={{ color: surfaceTextColor }}>معلومات التوصيل</h3>
                        <div className="space-y-3">
                          {/* Name + Phone */}
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              required
                              placeholder="الاسم الكامل"
                              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                              style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                            />
                            <div className="relative">
                              <input
                                type="tel"
                                required
                                dir="ltr"
                                placeholder="05 55 55 55 55"
                                className="w-full border rounded-xl px-4 py-3 text-sm text-right outline-none focus:ring-2"
                                style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }}
                                onFocus={e => e.currentTarget.style.borderColor = accentColor}
                                onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                              />
                              <Phone size={16} className="absolute left-4 top-3.5" style={{ color: surfaceTextMuted }} />
                            </div>
                          </div>

                          {/* Wilaya + Commune */}
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              required
                              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 appearance-none"
                              style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}
                              value={selectedWilayaId ?? ''}
                              onChange={(e) => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                            >
                              <option value="">اختر الولاية</option>
                              {wilayas.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {String(w.id).padStart(2, '0')} - {w.labelAR}
                                  {w.homePrice ? ` (${w.homePrice} ${currency})` : ''}
                                </option>
                              ))}
                            </select>
                            {showCommune && <input
                              type="text"
                              placeholder="البلدية"
                              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                              style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }}
                              onFocus={e => e.currentTarget.style.borderColor = accentColor}
                              onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}
                              value={commune}
                              onChange={(e) => setCommune(e.target.value)}
                            />}
                          </div>

                          {showAddress && <input type="text" placeholder="العنوان" className="w-full border rounded-xl px-4 py-3 text-sm outline-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                          {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor }} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}
                          {(showHomeDelivery || showDeskDelivery) && (
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
                      </div>
                  </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t space-y-3" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
                <div className="flex justify-between font-black text-base" style={{ color: surfaceTextColor }}>
                  <span>المجموع</span>
                  <span style={{ color: accentColor }}>{Math.round(((orderVariant?.price ?? orderProduct.price) * orderQty) + deliveryFee).toLocaleString()} {currency}</span>
                </div>
                <button
                  type="button"
                  onClick={handleOrder}
                  disabled={isSubmitting}
                  className="w-full text-white font-bold py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                  style={{ backgroundColor: themeColor }}
                >
                  {isSubmitting ? 'جاري الإرسال...' : (
                    <><CheckCircle2 size={20} /> تأكيد الطلب (الدفع عند الاستلام)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .boutique-gallery-img { max-height: 50dvh !important; }
        }
        @media (min-width: 768px) {
          .boutique-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .boutique-gallery-wrap { height: 100%; }
          .boutique-gallery-img { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Product Detail Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4" onTouchMove={e => e.preventDefault()} style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="boutique-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full">
              <BoutiqueImageGallery product={detailProduct} surfaceMuted={surfaceMuted} accentColor={accentColor} surfaceTextMuted={surfaceTextMuted} surfaceBorderColor={surfaceBorderColor} onZoom={(src) => { const imgs = detailProduct?.images?.filter(Boolean) || []; const idx = imgs.indexOf(src); setZoomState({ images: imgs.length ? imgs : [src], idx: idx >= 0 ? idx : 0 }); }} />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-black leading-tight" style={{ color: surfaceTextColor }}>{detailProduct.title}</h3>
                  <p className="text-xl font-black shrink-0" style={{ color: accentColor }}>{Math.round(detailProduct.price ?? 0).toLocaleString()} {currency}</p>
                </div>
                {detailProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: surfaceTextMuted }}>{detailProduct.description}</p>}
                {detailProduct.category && <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: surfaceBorderColor, color: surfaceTextMuted }}>{detailProduct.category}</span>}
                {detailProduct.variants && detailProduct.variants.length > 0 && (
                  <VariantSelector variants={detailProduct.variants} selected={detailVariant} onSelect={setDetailVariant} accentColor={accentColor} currency={currency} basePrice={detailProduct.price} />
                )}
              </div>
              <div className="shrink-0 px-6 pb-6 pt-3 space-y-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
                <button onClick={() => { setOrderProduct(detailProduct); setOrderVariant(detailVariant); setDetailProduct(null); setDetailVariant(null); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold tracking-wide transition-all active:scale-95 shadow-lg" style={{ backgroundColor: accentColor, color: isLight(accentColor) ? '#1e293b' : '#fff' }}>
                  اطلب الآن →
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
