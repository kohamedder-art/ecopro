import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingBag, ArrowRight, ShieldCheck, Star, X, Zap,
  Globe, Crown, Check, Phone,
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
  selectedSize: string;
  variant_id?: number;
  variant_name?: string;
}

function AuroraImageGallery({ product: p, surfaceColor, accentColor, onZoom }: { product: any; surfaceColor: string; accentColor: string; onZoom: (src: string) => void }) {
  const [idx, setIdx] = React.useState(0);
  const [showVideo, setShowVideo] = React.useState(true);
  const imgs: string[] = p.images?.filter(Boolean) || [];
  const tsRef = useRef<number | null>(null);
  const videoUrl = p?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  React.useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [p?.id]);
  return (
    <div className="aurora-gallery-wrap flex flex-col h-full">
      <div className="aurora-gallery-img relative w-full aspect-square overflow-hidden shrink-0 select-none" style={{ backgroundColor: surfaceColor }}
        onTouchStart={e => { e.stopPropagation(); tsRef.current = e.touches[0].clientX; }}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => {
          e.stopPropagation();
          if (videoEmbed && showVideo) return;
          if (tsRef.current === null || imgs.length <= 1) return;
          const d = tsRef.current - e.changedTouches[0].clientX;
          tsRef.current = null;
          if (Math.abs(d) < 40) return;
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
          <div className="w-full h-full flex items-center justify-center text-white/40"><ShoppingBag size={48} strokeWidth={1} /></div>
        )}
        {(videoEmbed || imgs.length > 1) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
            {videoEmbed && <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.5)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
            {imgs.map((_, i) => <button key={i} onClick={e => { e.stopPropagation(); setShowVideo(false); setIdx(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === idx ? accentColor : 'rgba(255,255,255,0.5)', transform: !showVideo && i === idx ? 'scale(1.3)' : 'scale(1)' }} />)}
          </div>
        )}
      </div>
      {(videoEmbed || imgs.length > 1) && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 border-b border-white/10">
          {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
          {imgs.map((img, i) => (
            <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuroraTemplate({ settings, products, canManage, storeSlug, onProductView, initialProductSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const [selectedSize, setSelectedSize] = useState('M');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  // Hero product = first product
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

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || settings?.aurora_accent_color || '#E2B872';
  const bgColor = settings?.template_bg_color || settings?.aurora_bg_color || '#080808';
  const surfaceColor = settings?.aurora_surface_color || '#121212';

  // Editable text
  const brandName = settings?.aurora_brand_name || settings?.store_name || 'AURORA';
  const brandSuffix = settings?.aurora_brand_suffix || 'STUDIO';
  const heroTitle = settings?.aurora_hero_title || settings?.template_hero_heading || 'فـخـامة\nتـتحدث عـنك';
  const heroSubtitle = settings?.aurora_hero_subtitle || settings?.template_hero_subtitle || 'تصاميم حصرية تم انتقاؤها بعناية لتناسب ذوقك الرفيع.';
  const heroBadge = settings?.aurora_hero_badge || 'جديد';

  // All products for the list
  const allProducts = products || [];

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // Body scroll lock
  useEffect(() => {
    if (showCheckout || detailProduct || zoomImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCheckout, detailProduct, zoomImage]);

  const addToCart = (product: { id: number; title?: string; name?: string; price: number; images?: string[] }, variant?: SelectedVariant | null) => {
    onProductView?.(product as any);
    const item: CartItem = {
      id: product.id,
      name: product.title || product.name || 'منتج',
      price: variant?.price ?? product.price,
      image: product.images?.[0] || '',
      selectedSize,
      variant_id: variant?.id,
      variant_name: variant ? (variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / ')) : undefined,
    };
    setCart(prev => [...prev, item]);
    setShowCheckout(true);
  };

  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));

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

      // Submit one order per cart item
      for (const item of cart) {
        const isOfferItem = selectedOffer && item.id === heroProduct?.id;
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
      <div className="min-h-screen flex items-center justify-center p-6 text-white" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="max-w-md w-full rounded-[2rem] p-8 text-center border border-white/10" style={{ backgroundColor: surfaceColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '30' }}>
            <Check size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2">تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-white/50 text-sm mb-6">سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right bg-white/5 border border-white/10">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-white/50">{item.name}</span>
                <span className="font-bold">{Math.round(item.price ?? 0).toLocaleString()} {currency}</span>
              </div>
            ))}
            <div className="h-px bg-white/10 my-1" />
            <div className="flex justify-between"><span className="text-white/50">التوصيل</span><span className="font-bold">{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span></div>
            <div className="flex justify-between"><span className="font-black">المجموع</span><span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(total ?? 0).toLocaleString()} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: bgColor }} dir="rtl">

      {/* HEADER */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />}
            <div className="flex flex-col">
              <span
                className="text-2xl font-black tracking-widest text-white"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('aurora_brand_name')}
              >
                {brandName}
              </span>
              <span
                className="text-[10px] tracking-[0.4em] font-bold -mt-1"
                style={{ color: accentColor }}
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('aurora_brand_suffix')}
              >
                {brandSuffix}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCheckout(true)}
              className="relative w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <ShoppingBag size={20} className="text-black" />
              {cart.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 text-black text-[10px] rounded-full flex items-center justify-center font-black border-2 border-black"
                  style={{ backgroundColor: accentColor }}
                >
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 max-w-6xl mx-auto px-6">

        {/* HERO SECTION */}
        {heroProduct && (
          <section className="mb-12 relative overflow-hidden rounded-[2.5rem] p-8 aspect-[21/9] flex flex-col justify-end">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
            <img
              src={heroProduct.images?.[0] || ''}
              className="absolute inset-0 w-full h-full object-cover scale-110"
              alt={heroProduct.title}
            />
            <div className="relative z-20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase" style={{ color: accentColor }}>
                <Crown size={14} />
                <span
                  contentEditable={canManage}
                  suppressContentEditableWarning
                  onBlur={handleTextEdit('aurora_hero_badge')}
                >
                  {heroBadge}
                </span>
              </div>
              <h2
                className="text-4xl font-black leading-tight whitespace-pre-line"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('aurora_hero_title')}
              >
                {heroTitle}
              </h2>
              <p
                className="text-white/60 text-sm max-w-[240px]"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit('aurora_hero_subtitle')}
              >
                {heroSubtitle}
              </p>
            </div>
          </section>
        )}

        {/* PRODUCT LIST */}
        <div className="space-y-16 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-6">
          {allProducts.map(product => {
            const originalPrice = (product as any).original_price;
            const lowStock = product.stock_quantity > 0 && product.stock_quantity < 5;

            return (
              <section key={product.id} className="relative group">
                <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden border border-white/5" style={{ backgroundColor: surfaceColor }}>
                  <img
                    src={product.images?.[0] || ''}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 cursor-pointer"
                    loading="lazy"
                    onClick={() => { setDetailProduct(product); onProductView?.(product); }}
                  />

                  {/* Floating Tags */}
                  <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                    {product.category && (
                      <span className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest" style={{ color: accentColor }}>
                        {product.category}
                      </span>
                    )}
                    {lowStock && (
                      <span className="bg-red-500/20 backdrop-blur-md border border-red-500/30 px-4 py-2 rounded-full text-[10px] font-bold text-red-400">
                        بقي {product.stock_quantity} فقط!
                      </span>
                    )}
                  </div>

                  {/* Mobile: always-visible bottom strip */}
                  <div className="md:hidden absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-[3rem]">
                    <h3 className="text-base font-bold text-white leading-tight line-clamp-1">{product.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-black" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} <span className="text-[10px] text-white/40">{currency}</span></p>
                      <button onClick={() => { setDetailProduct(product); onProductView?.(product); }} className="text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1" style={{ backgroundColor: accentColor, color: '#000' }}>اطلب <ArrowRight size={12} /></button>
                    </div>
                  </div>

                  {/* Desktop: slide-up hover card */}
                  <div className="hidden md:block absolute bottom-0 inset-x-0 p-5 bg-black/60 backdrop-blur-2xl border-t border-white/10 rounded-b-[3rem] translate-y-full group-hover:translate-y-0 transition-all duration-500">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{product.title}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-black" style={{ color: accentColor }}>
                            {Math.round(product.price ?? 0).toLocaleString()} <span className="text-[10px] text-white/40">{currency}</span>
                          </p>
                          {originalPrice && originalPrice > product.price && (
                            <span className="text-sm text-white/30 line-through">{originalPrice}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setDetailProduct(product); onProductView?.(product); }}
                      className="w-full h-14 text-black rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
                      style={{ backgroundColor: accentColor }}
                    >
                      عرض المنتج <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* No products placeholder */}
        {allProducts.length === 0 && (
          <div className="py-20 text-center">
            <ShoppingBag size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/40 font-bold">أضف منتجات من لوحة التحكم</p>
          </div>
        )}

        {/* FOOTER STATS */}
        <section className="mt-20 grid grid-cols-2 gap-4">
          <div className="p-6 rounded-[2rem] border border-white/5" style={{ backgroundColor: surfaceColor }}>
            <Zap size={24} style={{ color: accentColor }} className="mb-4" />
            <p className="text-lg font-bold">24 ساعة</p>
            <p className="text-xs text-white/40">توصيل سريع للعاصمة</p>
          </div>
          <div className="p-6 rounded-[2rem] border border-white/5" style={{ backgroundColor: surfaceColor }}>
            <Globe size={24} style={{ color: accentColor }} className="mb-4" />
            <p className="text-lg font-bold">58 ولاية</p>
            <p className="text-xs text-white/40">نصل إليك أينما كنت</p>
          </div>
        </section>
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-6 inset-x-6 z-50">
        <div className="max-w-xs mx-auto h-16 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full flex items-center justify-around px-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
          <button className="p-2 rounded-full" style={{ color: accentColor }}>
            <Crown size={24} fill="currentColor" />
          </button>
          <button onClick={() => setShowCheckout(true)} className={`p-2 rounded-full ${cart.length > 0 ? 'text-white' : 'text-white/40'}`}>
            <ShoppingBag size={24} />
          </button>
          <button className="p-2 rounded-full text-white/40">
            <ShieldCheck size={24} />
          </button>
        </div>
      </nav>

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center md:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowCheckout(false)} />
          <div
            className="relative w-full md:max-w-xl md:rounded-[3rem] overflow-hidden flex flex-col border border-white/10"
            style={{ backgroundColor: surfaceColor, height: '100dvh', maxHeight: '100dvh' }}
          >

            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-2xl font-black">حقيبة التسوق</h3>
              <button onClick={() => setShowCheckout(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingBag size={64} className="mx-auto text-white/10 mb-4" />
                  <p className="text-white/40">حقيبتك فارغة</p>
                </div>
              ) : (
                <>
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex gap-6 items-center bg-white/5 p-4 rounded-3xl border border-white/5">
                      {item.image && <img src={item.image} className="w-20 h-24 rounded-2xl object-cover" alt={item.name} />}
                      <div className="flex-1">
                        <p className="font-bold text-lg">{item.name}</p>
                        <p className="font-black mt-2 text-lg" style={{ color: accentColor }}>{Math.round(item.price ?? 0).toLocaleString()} {currency}</p>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="text-white/20"><X size={20} /></button>
                    </div>
                  ))}

                  {/* Form */}
                  {offers.length > 0 && (
                    <OfferSelector
                      offers={offers}
                      unitPrice={heroProduct?.price || 0}
                      currency={currency}
                      selectedOfferId={selectedOffer?.offer_id ?? null}
                      onSelect={handleOfferSelect}
                      accentColor={accentColor}
                      textColor="#ffffff"
                      borderColor="rgba(255,255,255,0.1)"
                    />
                  )}
                  <div className="space-y-4 pt-4">
                    <input
                      type="text"
                      required
                      placeholder="الاسم الكامل"
                      className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none transition-all text-white placeholder-white/30"
                      style={{ ['--tw-ring-color' as string]: accentColor }}
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        placeholder="05 55 55 55 55"
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none transition-all text-right text-white placeholder-white/30"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                      />
                      <Phone size={16} className="absolute left-6 top-5 text-white/30" />
                    </div>
                    <select
                      required
                      className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none appearance-none text-white"
                      value={selectedWilayaId ?? ''}
                      onChange={e => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="" className="bg-black">اختر الولاية</option>
                      {wilayas.map((w) => (
                        <option key={w.id} value={w.id} className="bg-black">
                          {String(w.id).padStart(2, '0')} - {w.labelAR}
                          {w.homePrice ? ` (${w.homePrice} ${currency})` : ' (مجاني)'}
                        </option>
                      ))}
                    </select>
                    {showAddress && <input type="text" placeholder="العنوان" className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none text-white placeholder-white/30" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />}
                    {showCommune && <input type="text" placeholder="البلدية" className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none text-white placeholder-white/30" value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} />}
                    {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none text-white placeholder-white/30 resize-none" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />}
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 bg-black/40 border-t border-white/10 space-y-4">
                <div className="flex justify-between text-white/60"><span>المجموع الفرعي</span><span>{Math.round(subtotal ?? 0).toLocaleString()} {currency}</span></div>
                <div className="flex justify-between text-white/60"><span>التوصيل</span><span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span></div>
                <div className="flex justify-between text-2xl font-black text-white pt-2"><span>الإجمالي</span><span>{Math.round(total ?? 0).toLocaleString()} {currency}</span></div>
                <button
                  type="button"
                  onClick={handleOrder}
                  disabled={isSubmitting}
                  className="w-full h-16 text-black rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-colors mt-4 active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSubmitting ? 'جاري الإرسال...' : <><Check size={20} /> تأكيد الطلب الآن</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .aurora-gallery-img { max-height: 50dvh !important; }
        }
        @media (min-width: 768px) {
          .aurora-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .aurora-gallery-wrap { height: 100%; }
          .aurora-gallery-img { aspect-ratio: unset !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} {brandName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Product Detail Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="aurora-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: surfaceColor, color: '#fff', height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
              <AuroraImageGallery product={detailProduct} surfaceColor={surfaceColor} accentColor={accentColor} onZoom={(src) => { const imgs = detailProduct?.images?.filter(Boolean) || []; const idx = imgs.indexOf(src); setZoomState({ images: imgs.length ? imgs : [src], idx: idx >= 0 ? idx : 0 }); }} />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-black leading-tight text-white">{detailProduct.title}</h3>
                  <p className="text-xl font-black shrink-0" style={{ color: accentColor }}>{Math.round(detailProduct.price ?? 0).toLocaleString()} {currency}</p>
                </div>
                {detailProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line text-white/50">{detailProduct.description}</p>}
                {detailProduct.category && <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 text-white/50">{detailProduct.category}</span>}
                {detailProduct.variants && detailProduct.variants.length > 0 && (
                  <VariantSelector variants={detailProduct.variants} selected={detailVariant} onSelect={setDetailVariant} accentColor={accentColor} currency={currency} basePrice={detailProduct.price} />
                )}
              </div>
              <div className="shrink-0 px-6 pb-6 pt-3 border-t border-white/10">
                <button onClick={() => { addToCart(detailProduct, detailVariant); setDetailProduct(null); setDetailVariant(null); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black tracking-wide transition-all active:scale-95" style={{ backgroundColor: accentColor, color: '#000' }}>
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
