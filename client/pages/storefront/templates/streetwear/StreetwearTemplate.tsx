import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, type SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  Menu,
  Search,
  Filter,
  X,
  ArrowRight,
  Trash2,
  ShoppingCart,
  MapPin,
  Phone,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

/* ------------------------------------------------------------------ */
/*  Streetwear — Dark grid store w/ size selector, cart drawer, gold   */
/* ------------------------------------------------------------------ */

export default function StreetwearTemplate(props: TemplateProps) {
  const {
    storeSlug,
    products = [],
    settings = {} as any,
    formatPrice,
    canManage,
    onProductView,
    initialProductSlug,
  } = props;

  /* ---------- settings ---------- */
  const brandName     = (settings as any)?.streetwear_brand_name   ?? 'SCULPTOR';
  const brandSuffix   = (settings as any)?.streetwear_brand_suffix ?? 'Algiers Based';
  const heroTitle     = (settings as any)?.streetwear_hero_title   ?? 'The Full Drop';
  const heroSubtitle  = (settings as any)?.streetwear_hero_sub     ?? 'Available Now • Worldwide Shipping';
  const accentColor   = settings?.template_accent_color ?? (settings as any)?.streetwear_accent_color ?? settings?.primary_color ?? '#D4AF37';
  const bgColor       = settings?.template_bg_color ?? (settings as any)?.streetwear_bg_color ?? '#080808';
  const currency      = (settings as any)?.currency_code           ?? 'د.ج';

  /* ---------- delivery prices ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);

  /* ---------- state ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '', commune: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  /* set default wilaya */
  React.useEffect(() => {
    if (wilayas.length > 0 && !formData.wilaya) {
      setFormData(prev => ({ ...prev, wilaya: String(wilayas[0].id) }));
    }
  }, [wilayas]);

  /* ---------- helpers ---------- */
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${Math.round(p).toLocaleString()} ${currency}`);

  const handleTextEdit = useCallback((key: string) => {
    if (!canManage) return undefined;
    return (e: React.FormEvent<HTMLElement>) => {
      const value = (e.target as HTMLElement).innerText;
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value }, '*');
    };
  }, [canManage]);

  // Product Image Gallery for detail modal
  const ProductImageGallery = ({ product: p }: { product: any }) => {
    const [idx, setIdx] = useState(0);
    const [showVideo, setShowVideo] = useState(true);
    const imgs: string[] = p.images?.filter(Boolean) || [];
    const [ts, setTs] = useState<number | null>(null);
    const videoUrl = p?.metadata?.video_url || '';
    const videoEmbed = useMemo(() => {
      if (!videoUrl) return null;
      const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (yt) return { type: 'youtube' as const, id: yt[1] };
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
      return { type: 'iframe' as const, url: videoUrl };
    }, [videoUrl]);
    useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [p?.id]);
    return (
      <div className="sw-gallery-wrap flex flex-col h-full">
        <div className="sw-gallery-img relative w-full aspect-square overflow-hidden shrink-0 bg-[#111]"
          onTouchStart={e => setTs(e.touches[0].clientX)}
          onTouchEnd={e => { if (videoEmbed && showVideo) return; if (ts !== null && imgs.length > 1) { const d = ts - e.changedTouches[0].clientX; if (Math.abs(d) > 50) { d > 0 ? setIdx(i => Math.min(i+1, imgs.length-1)) : setIdx(i => Math.max(i-1, 0)); } setTs(null); } }}>
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
            <img src={imgs[idx] || imgs[0]} alt="" className="w-full h-full object-cover transition-all duration-300" onClick={() => setZoomImage(imgs[idx] || imgs[0])} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30"><ShoppingBag size={48} strokeWidth={1} /></div>
          )}
          {(videoEmbed || imgs.length > 1) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
              {videoEmbed && <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.5)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
              {imgs.map((_, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === idx ? accentColor : 'rgba(255,255,255,0.4)', transform: !showVideo && i === idx ? 'scale(1.3)' : 'scale(1)' }} />)}
            </div>
          )}
        </div>
        {(videoEmbed || imgs.length > 1) && (
          <div className="flex gap-2 px-6 py-3 overflow-x-auto shrink-0 border-b border-white/10">
            {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
            {imgs.map((img, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}><img src={img} alt="" className="w-full h-full object-cover" /></button>)}
          </div>
        )}
      </div>
    );
  };

  /* derive sizes from product variants or default */
  const getSizes = (product: any): string[] => {
    if (product.variants?.length) {
      return product.variants.map((v: any) => {
        if (typeof v === 'string') return v;
        return v.name || v.label || v.variant_name || `${v.color || ''} ${v.size || ''}`.trim() || `Variant ${v.id}`;
      });
    }
    return [];
  };

  const handleSizeSelect = (productId: number, size: string) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const addToCart = (product: any, variant?: SelectedVariant | null) => {
    onProductView?.(product);
    if (variant) {
      setCart(prev => [...prev, { ...product, price: variant.price ?? product.price, selectedSize: variant.size || variant.variant_name, variant_id: variant.id, variant_name: variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / '), cartId: Math.random() }]);
    } else {
      const size = selectedSizes[product.id];
      setCart(prev => [...prev, { ...product, selectedSize: size || '', cartId: Math.random() }]);
    }
    setIsCartOpen(true);
  };

  const removeFromCart = (cartId: number) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const baseShipping = selectedWilaya?.homePrice ?? 0;

  /* ---------- offers ---------- */
  const mainProduct = products[0];
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (offer: SelectedOffer | null) => setSelectedOffer(offer);
  const shipping = resolveDeliveryFee(mainProduct, selectedOffer, baseShipping);

  const cartTotal = cart.reduce((acc, c) => acc + (c.price ?? 0), 0);
  const total = cartTotal + (cart.length > 0 ? shipping : 0);

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || cart.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of cart) {
        const isOfferItem = selectedOffer && item.id === mainProduct?.id;
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            ...(item.variant_id ? { variant_id: item.variant_id } : {}),
            quantity: isOfferItem ? selectedOffer.quantity : 1,
            total_price: isOfferItem ? selectedOffer.bundle_price + shipping : (item.price ?? 0) + shipping,
            delivery_fee: shipping,
            delivery_type: 'desk',
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_address: [formData.address, formData.commune, formData.notes].filter(Boolean).join(' - ') || selectedWilaya?.labelAR || '',
            shipping_wilaya_id: formData.wilaya ? Number(formData.wilaya) : null,
            ...(isOfferItem ? { offer_id: selectedOffer.offer_id, offer_quantity: selectedOffer.quantity, offer_bundle_price: selectedOffer.bundle_price } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
          return;
        }
        setLastOrderId(data.order?.id || null);
        setLastTelegramUrl(data.telegramStartUrl || null);
      }
      setOrderSuccess(true);
      setCart([]);
    } catch (e) {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: bgColor }} dir="rtl">

      {/* ── HEADER ── */}
      <header className="fixed top-0 inset-x-0 h-20 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/60"><Menu size={20} /></button>
        <div className="flex flex-col items-center">
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover mb-1 border border-white/10" />}
          <h1
            className="text-xl font-black tracking-[0.2em] italic"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('streetwear_brand_name')}
          >
            {brandName}
          </h1>
          <span
            className="text-[8px] font-bold tracking-[0.3em] uppercase"
            style={{ color: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('streetwear_brand_suffix')}
          >
            {brandSuffix}
          </span>
        </div>
        <button onClick={() => setIsCartOpen(true)} className="relative w-12 h-12 flex items-center justify-center rounded-2xl text-black shadow-lg transition-transform active:scale-90" style={{ backgroundColor: accentColor }}>
          <ShoppingBag size={22} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2" style={{ borderColor: accentColor }}>{cart.length}</span>
          )}
        </button>
      </header>

      {/* ── HERO BANNER ── */}
      <section className="pt-28 px-6">
        <div className="relative h-40 rounded-[2rem] overflow-hidden bg-[#111] border border-white/5 flex items-center p-8">
          <div className="relative z-10 space-y-1">
            <h2
              className="text-2xl font-black italic uppercase leading-none"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('streetwear_hero_title')}
            >
              {heroTitle}
            </h2>
            <p
              className="text-white/40 text-xs font-bold uppercase tracking-widest"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('streetwear_hero_sub')}
            >
              {heroSubtitle}
            </p>
          </div>
          {products[0]?.images?.[0] && (
            <div className="absolute left-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none">
              <img src={products[0].images[0]} className="w-full h-full object-cover grayscale" alt="" />
            </div>
          )}
        </div>
      </section>

      {/* ── PRODUCT GRID ── */}
      <section className="px-6 mt-8 pb-32">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Latest Inventory</h3>
          <div className="h-[1px] flex-1 mx-4 bg-white/5" />
          <Filter size={16} className="text-white/20" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => {
            const sizes = getSizes(product);
            return (
              <div key={product.id} className="group flex flex-col bg-white/[0.02] rounded-[2.5rem] border border-white/5 p-3 transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10">
                {/* Image */}
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-[#111] cursor-pointer" onClick={() => { setDetailProduct(product); onProductView?.(product); }}>
                  {product.images?.[0] && (
                    <img src={product.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={product.name || product.title} />
                  )}
                  {/* Quick order overlay */}
                  <div className="absolute inset-x-4 bottom-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailProduct(product); onProductView?.(product); }}
                      className="w-full bg-white text-black h-11 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-colors"
                    >
                      اطلب الآن →
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="mt-5 px-3 pb-2 flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-black tracking-tight">{product.name || product.title}</h4>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">Premium Fabric</p>
                  </div>
                  <p className="text-xl font-black" style={{ color: accentColor }}>
                    {product.price ?? 0} <span className="text-[10px] opacity-60">{currency}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CART DRAWER ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-[#0A0A0A] shadow-2xl flex flex-col streetwear-slide-left">

            <div className="p-8 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                  <ShoppingBag style={{ color: accentColor }} size={20} />
                </div>
                <h3 className="text-xl font-black italic">YOUR BAG</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                  <ShoppingBag size={48} strokeWidth={1} />
                  <p className="font-bold uppercase tracking-[0.3em] text-[10px]">السلة فارغة</p>
                </div>
              ) : (
                <>
                  {orderSuccess ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                        <ShieldCheck size={40} />
                      </div>
                      <h3 className="text-2xl font-black">تم تأكيد طلبك!</h3>
                      <p className="text-white/50 text-sm">سنتواصل معك قريباً</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={formData.phone} />
                      <button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="mt-4 px-6 py-3 rounded-2xl font-bold border" style={{ borderColor: accentColor, color: accentColor }}>
                        متابعة التسوق
                      </button>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.cartId} className="flex gap-6 group">
                        <div className="w-24 h-28 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5 bg-[#111]">
                          {item.images?.[0] && <img src={item.images[0]} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start">
                              <h5 className="font-black text-lg leading-tight">{item.name}</h5>
                              <button onClick={() => removeFromCart(item.cartId)} className="text-white/20 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                            {item.selectedSize && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Size:</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded border" style={{ color: accentColor, backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>{item.selectedSize}</span>
                              </div>
                            )}
                          </div>
                          <p className="font-black text-lg" style={{ color: accentColor }}>{fmtPrice(item.price ?? 0)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {cart.length > 0 && !orderSuccess && (
              <div className="p-8 bg-black/40 border-t border-white/5 space-y-6" dir="rtl">
                {mainProduct && offers.length > 0 && (
                  <OfferSelector
                    offers={offers}
                    loading={offersLoading}
                    selectedOffer={selectedOffer}
                    onSelect={handleOfferSelect}
                    currency={currency}
                    formatPrice={formatPrice}
                    className="bg-white/5 text-white"
                  />
                )}
                <div className="grid grid-cols-1 gap-4">
                  <input type="text" placeholder="الاسم الكامل" className="h-14 bg-white/5 rounded-2xl px-4 border border-white/5 text-sm font-bold text-white/80 placeholder:text-white/20 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  <div className="flex items-center gap-3 h-14 bg-white/5 rounded-2xl px-4 border border-white/5">
                    <Phone size={18} style={{ color: `${accentColor}60` }} />
                    <input type="tel" placeholder="رقم الهاتف" className="bg-transparent border-none outline-none flex-1 text-sm font-bold text-white/80 placeholder:text-white/20" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3 h-14 bg-white/5 rounded-2xl px-4 border border-white/5">
                    <MapPin size={18} style={{ color: `${accentColor}60` }} />
                    <select className="bg-transparent border-none outline-none flex-1 text-sm font-bold text-white/80 cursor-pointer appearance-none" value={formData.wilaya} onChange={e => setFormData({ ...formData, wilaya: e.target.value })}>
                      {wilayas.map(w => <option key={w.id} value={String(w.id)} className="bg-black">{w.labelAR} — {fmtPrice(w.homePrice)}</option>)}
                    </select>
                  </div>
                  {showAddress && <input type="text" placeholder="العنوان" className="h-14 bg-white/5 rounded-2xl px-4 border border-white/5 text-sm font-bold text-white/80 placeholder:text-white/20 outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />}
                  {showCommune && <input type="text" placeholder="البلدية" className="h-14 bg-white/5 rounded-2xl px-4 border border-white/5 text-sm font-bold text-white/80 placeholder:text-white/20 outline-none" value={formData.commune} onChange={e => setFormData({ ...formData, commune: e.target.value })} />}
                  {showNotes && <textarea placeholder="ملاحظات" rows={2} className="bg-white/5 rounded-2xl px-4 py-3 border border-white/5 text-sm font-bold text-white/80 placeholder:text-white/20 outline-none resize-none" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />}
                </div>

                <div className="flex justify-between items-end pt-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">المجموع</p>
                    <p className="text-3xl font-black" style={{ color: accentColor }}>{fmtPrice(total)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-green-500 mb-1">
                      <CheckCircle2 size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest">جاهز للشحن</span>
                    </div>
                    <span className="text-[9px] text-white/20 font-bold uppercase">التوصيل: 2-4 أيام</span>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.name || !formData.phone}
                  className="w-full h-16 text-black rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl uppercase italic disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {submitting ? 'جاري الإرسال...' : 'تأكيد الطلب'} <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANIMATIONS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes streetwear-slide-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .streetwear-slide-left { animation: streetwear-slide-left 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}} />

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) {
          .sw-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .sw-gallery-wrap { height: 100%; }
          .sw-gallery-img { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} {brandName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Product Detail Modal */}
      {detailProduct && (() => {
        const sizes = getSizes(detailProduct);
        return (
          <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
            <div className="sw-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row bg-[#0A0A0A] text-white border border-white/10" dir="ltr" style={{ height: '100dvh', maxHeight: '100dvh' }}>
              <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md text-white"><X size={18} /></button>
              <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
                <div className="h-full"><ProductImageGallery product={detailProduct} /></div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{detailProduct.name || detailProduct.title}</h3>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">Premium Fabric</p>
                  </div>
                  <p className="text-xl font-black shrink-0" style={{ color: accentColor }}>{detailProduct.price ?? 0} <span className="text-[10px] opacity-60">{currency}</span></p>
                </div>
                {detailProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line text-white/50">{detailProduct.description}</p>}
                {detailProduct.variants && detailProduct.variants.length > 0 ? (
                  <VariantSelector
                    variants={detailProduct.variants}
                    selected={detailVariant}
                    onSelect={setDetailVariant}
                    accentColor={accentColor}
                    currency={currency}
                    basePrice={detailProduct.price}
                  />
                ) : null}
              </div>
              <div className="shrink-0 px-6 pb-6 pt-3 border-t border-white/10">
                <button onClick={() => { addToCart(detailProduct, detailVariant); setDetailProduct(null); setDetailVariant(null); }} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-white text-black transition-all active:scale-95">
                  اطلب الآن →
                </button>
              </div>
              </div>
            </div>
          </div>
        );
      })()}

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
