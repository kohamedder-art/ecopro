import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, type SelectedOffer } from '@/components/storefront/OfferSelector';
import {
  ShoppingBag,
  ArrowRight,
  Check,
  Truck,
  X,
  Plus,
  Minus,
  MessageCircle,
  Package,
  ShieldCheck,
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

/* ------------------------------------------------------------------ */
/*  Gallery — Minimal light 2-col grid w/ quick-buy modal, sticky cart */
/* ------------------------------------------------------------------ */

export default function GalleryTemplate(props: TemplateProps) {
  const {
    storeSlug,
    products = [],
    settings = {} as any,
    formatPrice,
    canManage,
    primaryColor: propPrimaryColor,
    onProductView,
  } = props;

  /* ---------- settings ---------- */
  const storeName   = (settings as any)?.gallery_store_name   ?? settings?.store_name ?? 'ELEVATE CLOSET';
  const headline    = (settings as any)?.gallery_headline     ?? settings?.template_hero_heading ?? 'مجموعة الصيف الأساسية';
  const subheadline = (settings as any)?.gallery_subheadline  ?? settings?.template_hero_subtitle ?? 'أناقة بسيطة لكل يوم';
  const heroBadge   = (settings as any)?.gallery_hero_badge   ?? 'حصرياً في الجزائر';
  const accentColor = settings?.template_accent_color ?? (settings as any)?.gallery_accent_color ?? propPrimaryColor ?? settings?.primary_color ?? '#facc15';
  const bgColor = settings?.template_bg_color || '#f8fafc';

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

  const currency    = (settings as any)?.currency_code        ?? 'د.ج';

  /* ---------- delivery ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);

  /* ---------- state ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '', commune: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [quickQty, setQuickQty] = useState(1);
  const [activeVariant, setActiveVariant] = useState<SelectedVariant | null>(null);

  useEffect(() => {
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

  /* ---------- cart actions ---------- */
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
      <div className="gallery-img-wrap flex flex-col h-full">
        <div className="gallery-img-main relative w-full aspect-square overflow-hidden shrink-0" style={{ backgroundColor: surfaceMuted }}
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
            <div className="w-full h-full flex items-center justify-center" style={{ color: surfaceTextMuted }}><ShoppingBag size={48} strokeWidth={1} /></div>
          )}
          {(videoEmbed || imgs.length > 1) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
              {videoEmbed && <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.4)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
              {imgs.map((_, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === idx ? accentColor : 'rgba(255,255,255,0.5)', transform: !showVideo && i === idx ? 'scale(1.3)' : 'scale(1)' }} />)}
            </div>
          )}
        </div>
        {(videoEmbed || imgs.length > 1) && (
          <div className="flex gap-2 px-6 py-3 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${surfaceBorderColor}` }}>
            {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
            {imgs.map((img, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}><img src={img} alt="" className="w-full h-full object-cover" /></button>)}
          </div>
        )}
      </div>
    );
  };

  const handleAdd = (product: any, qty: number = 1, variant?: SelectedVariant | null) => {
    const vid = variant?.id;
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id && i.variant_id === vid);
      if (exists) return prev.map(i => (i.id === product.id && i.variant_id === vid) ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { ...product, price: variant?.price ?? product.price, qty, variant_id: vid, variant_name: variant ? (variant.variant_name || [variant.color, variant.size].filter(Boolean).join(' / ')) : undefined }];
    });
    setActiveProduct(null);
    setQuickQty(1);
  };

  const updateQty = (id: number, delta: number, vid?: number) => {
    setCart(prev => prev.map(item =>
      (item.id === id && item.variant_id === vid) ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const removeItem = (id: number, vid?: number) => setCart(prev => prev.filter(i => !(i.id === id && i.variant_id === vid)));

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const baseShipping = selectedWilaya?.homePrice ?? 0;

  /* ---------- offers ---------- */
  const mainProduct = products[0];
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer>(null);
  const handleOfferSelect = (offer: SelectedOffer) => setSelectedOffer(offer);
  const shipping = resolveDeliveryFee(mainProduct, selectedOffer, baseShipping);

  const subtotal = cart.reduce((acc, item) => acc + ((item.price ?? 0) * item.qty), 0);
  const total = subtotal + (cart.length > 0 ? shipping : 0);

  /* ---------- submit ---------- */
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
            quantity: isOfferItem ? selectedOffer.quantity : item.qty,
            total_price: isOfferItem ? selectedOffer.bundle_price + shipping : (item.price ?? 0) * item.qty + shipping,
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
      setIsOrderComplete(true);
      setCart([]);
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl border-b px-6 py-4 flex justify-between items-center" style={{ backgroundColor: surfaceColor + 'b3', borderColor: surfaceBorderColor }}>
        <div className="flex items-center gap-2">
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />}
          <h1
            className="font-black text-xl tracking-widest uppercase"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('gallery_store_name')}
          >
            {storeName}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] font-bold uppercase" style={{ color: textMuted }}>المجموع</span>
            <span className="text-sm font-black">{fmtPrice(total)}</span>
          </div>
          <div className="relative">
            <ShoppingBag size={22} strokeWidth={2.5} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] flex items-center justify-center rounded-full border border-white" style={{ backgroundColor: accentColor, color: isLight(accentColor) ? '#000' : '#fff' }}>{cart.length}</span>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-24 pb-12 px-6">
        <div className="rounded-[2.5rem] p-8 shadow-sm border flex flex-col items-center text-center" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
          <span
            className="px-3 py-1 rounded-full text-[10px] font-black mb-4"
            style={{ backgroundColor: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('gallery_hero_badge')}
          >
            {heroBadge}
          </span>
          <h2
            className="text-4xl font-black mb-2 leading-tight"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('gallery_headline')}
          >
            {headline}
          </h2>
          <p
            className="text-sm max-w-[200px]" style={{ color: textMuted }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('gallery_subheadline')}
          >
            {subheadline}
          </p>
        </div>
      </section>

      {/* ── PRODUCT GRID ── */}
      <section className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 pb-32">
        {products.map((product, idx) => (
          <div key={product.id} className="relative group">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden relative mb-3" style={{ backgroundColor: surfaceMuted }}>
              {product.images?.[0] && (
                <img src={product.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer" alt={product.name || product.title} onClick={() => { setActiveProduct(product); setQuickQty(1); onProductView?.(product); }} />
              )}
              <button
                onClick={() => { setActiveProduct(product); setQuickQty(1); onProductView?.(product); }}
                className="absolute bottom-3 right-3 left-3 font-black text-xs py-3 rounded-2xl shadow-lg opacity-100 md:opacity-0 group-hover:opacity-100 translate-y-0 md:translate-y-2 group-hover:translate-y-0 transition-all"
                style={{ backgroundColor: surfaceColor, color: textColor }}
              >
                شراء سريع +
              </button>
              {idx === 0 && <span className="absolute top-3 right-3 bg-black text-white text-[9px] font-bold px-2 py-1 rounded-lg uppercase">Best Seller</span>}
            </div>
            <h3 className="font-bold text-sm">{product.name || product.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-black text-black">{fmtPrice(product.price ?? 0)}</span>
              {product.original_price && <span className="text-xs line-through" style={{ color: textMuted }}>{fmtPrice(product.original_price)}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ── STICKY CART BOTTOM SHEET ── */}
      {cart.length > 0 && !isOrderComplete && (
        <div className="fixed bottom-0 left-0 w-full z-40 px-4 pb-4">
          <div className="max-w-md mx-auto rounded-[2rem] shadow-2xl border overflow-hidden" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
            {/* Items thumbnails */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: surfaceBorderColor }}>
              <div className="flex gap-2">
                {cart.slice(0, 3).map(item => (
                  <div key={item.id} className="w-8 h-8 rounded-lg overflow-hidden border" style={{ borderColor: surfaceBorderColor }}>
                    {item.images?.[0] && <img src={item.images[0]} className="w-full h-full object-cover" alt="" />}
                  </div>
                ))}
                {cart.length > 3 && <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: surfaceMuted }}>+{cart.length - 3}</div>}
              </div>
              <button onClick={() => setCart([])} className="text-[10px] font-bold text-rose-500 underline uppercase">تفريغ السلة</button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {mainProduct && offers.length > 0 && (
                <OfferSelector
                  offers={offers}
                  loading={offersLoading}
                  selectedOffer={selectedOffer}
                  onSelect={handleOfferSelect}
                  currency={currency}
                  formatPrice={formatPrice}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="الاسم" className="border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <input type="tel" placeholder="رقم الهاتف" dir="ltr" className="border-none rounded-2xl px-4 py-3 text-sm outline-none text-right focus:ring-2" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <select className="w-full border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.wilaya} onChange={e => setFormData({ ...formData, wilaya: e.target.value })}>
                {wilayas.map(w => <option key={w.id} value={String(w.id)}>{w.labelAR} — {fmtPrice(w.homePrice)}</option>)}
              </select>
              {showAddress && <input type="text" placeholder="العنوان" className="w-full border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />}
              {showCommune && <input type="text" placeholder="البلدية" className="w-full border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.commune} onChange={e => setFormData({ ...formData, commune: e.target.value })} />}
              {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, '--tw-ring-color': accentColor } as any} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />}
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.name || !formData.phone}
                className="w-full text-white font-black py-5 rounded-2xl flex items-center justify-between px-8 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                <span>{submitting ? 'جاري الإرسال...' : 'تأكيد الطلب الآن'}</span>
                <span className="flex items-center gap-1">{fmtPrice(total)} <ArrowRight size={18} /></span>
              </button>
              <div className="flex justify-center items-center gap-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                <span className="flex items-center gap-1"><Truck size={12} /> شحن سريع</span>
                <span className="flex items-center gap-1"><Package size={12} /> فحص قبل الدفع</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT DETAIL MODAL ── */}
      {activeProduct && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveProduct(null)} />
          <div className="gallery-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => setActiveProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
              <div className="h-full"><ProductImageGallery product={activeProduct} /></div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-xl font-black leading-tight" style={{ color: surfaceTextColor }}>{activeProduct.name || activeProduct.title}</h3>
                <p className="text-xl font-black shrink-0" style={{ color: '#d97706' }}>{fmtPrice(activeProduct.price ?? 0)}</p>
              </div>
              {activeProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: surfaceTextMuted }}>{activeProduct.description}</p>}
              {activeProduct.category && <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: surfaceBorderColor, color: surfaceTextMuted }}>{activeProduct.category}</span>}
              {activeProduct.variants && activeProduct.variants.length > 0 && (
                <VariantSelector variants={activeProduct.variants} selected={activeVariant} onSelect={setActiveVariant} accentColor={accentColor} currency={currency} basePrice={activeProduct.price} />
              )}
              <div className="p-4 rounded-2xl flex items-center justify-between" style={{ backgroundColor: surfaceMuted }}>
                <span className="font-bold text-sm">الكمية</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuickQty(Math.max(1, quickQty - 1))} className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center" style={{ backgroundColor: surfaceColor }}><Minus size={16} /></button>
                  <span className="font-black">{quickQty}</span>
                  <button onClick={() => setQuickQty(quickQty + 1)} className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center" style={{ backgroundColor: surfaceColor }}><Plus size={16} /></button>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 pb-6 pt-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
              <button onClick={() => handleAdd(activeProduct, quickQty, activeVariant)} className="w-full font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95" style={{ backgroundColor: accentColor, color: isLight(accentColor) ? '#000' : '#fff' }}>
                <ShoppingBag size={18} className="inline mr-2" /> أضف إلى السلة
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS OVERLAY ── */}
      {isOrderComplete && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: bgColor, color: textColor }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
            <Check size={48} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black mb-2">تم استلام طلبك!</h2>
          <p className="text-sm" style={{ color: textMuted }}>سنتصل بك في أقرب وقت لتأكيد العنوان والشحن.</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={formData.phone} />
          <button
            onClick={() => { setIsOrderComplete(false); setCart([]); }}
            className="mt-10 border-2 px-8 py-3 rounded-2xl font-black" style={{ borderColor: textColor, color: textColor }}
          >
            العودة للمتجر
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) {
          .gallery-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .gallery-img-wrap { height: 100%; }
          .gallery-img-main { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* ── ANIMATIONS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gallery-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .gallery-slide-up { animation: gallery-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}} />

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${surfaceBorderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

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
