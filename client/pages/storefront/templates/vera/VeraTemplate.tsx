import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import {
  ShoppingBag,
  Search,
  Menu,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Globe,
  X,
} from 'lucide-react';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';

/* ------------------------------------------------------------------ */
/*  Vera — Cinematic luxury storefront with bento grid & trust badges  */
/* ------------------------------------------------------------------ */

export default function VeraTemplate(props: TemplateProps) {
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
  const brandName     = (settings as any)?.vera_brand_name     ?? 'VÉRA';
  const brandSuffix   = (settings as any)?.vera_brand_suffix   ?? 'GENÈVE • 2026';
  const heroLabel     = (settings as any)?.vera_hero_label      ?? 'Crafting the Impossible';
  const heroTitle     = (settings as any)?.vera_hero_title      ?? 'ETERNAL';
  const heroTitle2    = (settings as any)?.vera_hero_title2     ?? 'LIGHT.';
  const heroCta       = (settings as any)?.vera_hero_cta        ?? 'Explore Collection';
  const sectionTitle  = (settings as any)?.vera_section_title   ?? 'The Curation';
  const sectionDesc   = (settings as any)?.vera_section_desc    ?? 'Every piece is verified on the blockchain to ensure 100% ethical origin and ownership history.';
  const accentColor   = settings?.template_accent_color ?? (settings as any)?.vera_accent_color ?? settings?.primary_color ?? '#d4af37';
  const bgColor       = settings?.template_bg_color ?? (settings as any)?.vera_bg_color ?? '#0a0a0a';
  const trustTitle1   = (settings as any)?.vera_trust1_title    ?? 'Vault Security';
  const trustDesc1    = (settings as any)?.vera_trust1_desc     ?? 'Insured worldwide delivery with real-time biometric tracking on every shipment.';
  const trustTitle2   = (settings as any)?.vera_trust2_title    ?? 'Global Concierge';
  const trustDesc2    = (settings as any)?.vera_trust2_desc     ?? '24/7 personal shoppers available in London, Paris, Tokyo, and New York.';
  const trustTitle3   = (settings as any)?.vera_trust3_title    ?? 'Bespoke AR';
  const trustDesc3    = (settings as any)?.vera_trust3_desc     ?? "Try on any piece instantly via your device's spatial camera with 1:1 precision.";
  const currency      = (settings as any)?.currency_code        ?? 'د.ج';

  /* ---------- delivery ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');

  /* ---------- state ---------- */
  const [showCheckout, setShowCheckout] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '', commune: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  useEffect(() => {
    if (wilayas.length > 0 && !formData.wilaya) {
      setFormData(prev => ({ ...prev, wilaya: String(wilayas[0].id) }));
    }
  }, [wilayas]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ---------- helpers ---------- */
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${Math.round(p).toLocaleString()} ${currency}`);

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
      <div className="vera-gallery-wrap flex flex-col h-full">
        <div className="vera-gallery-img relative w-full aspect-square overflow-hidden shrink-0 bg-[#111]"
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
            <img src={imgs[idx] || imgs[0]} alt="" className="w-full h-full object-cover transition-all duration-300" onClick={() => { const p = detailProduct; const imgs2 = p?.images?.filter(Boolean) || []; setZoomState({ images: imgs2.length ? imgs2 : [imgs[idx] || imgs[0]], idx }); }} />
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

  const handleTextEdit = useCallback((key: string) => {
    if (!canManage) return undefined;
    return (e: React.FormEvent<HTMLElement>) => {
      const value = (e.target as HTMLElement).innerText;
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value }, '*');
    };
  }, [canManage]);

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const baseShipping = selectedWilaya?.homePrice ?? 0;

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system
  const { offers } = useProductOffers(storeSlug, selectedProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); } }, [offers]);
  useEffect(() => { setSelectedOffer(null); }, [selectedProduct?.id]);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const shipping = resolveDeliveryFee(selectedProduct, selectedOffer, baseShipping);

  /* ---------- order ---------- */
  const handleOrder = async (product: any) => {
    if (!formData.name || !formData.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: product.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity || 1,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: (selectedOffer ? selectedOffer.bundle_price : product.price) + shipping,
          delivery_fee: shipping,
          delivery_type: selectedDeliveryType,
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_address: [formData.address, formData.commune, formData.notes].filter(Boolean).join(' - ') || selectedWilaya?.labelAR || '',
          shipping_wilaya_id: formData.wilaya ? Number(formData.wilaya) : null,
        }),
      });
      const _orderData = await res.json().catch(() => ({}));
      setLastOrderId(_orderData.order?.id || null);
      setLastTelegramUrl(_orderData.telegramStartUrl || null);
      setOrderSuccess(true);
      setSelectedProduct(null);
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  };

  const heroProduct = products[0];

  return (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: bgColor, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── NAV ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-black/60 backdrop-blur-xl border-b border-white/5' : 'py-8 bg-transparent'}`}>
        <div className="max-w-[1400px] mx-auto px-8 flex justify-between items-center">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><Menu size={20} /></button>
          <div className="flex flex-col items-center">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover mb-1 border border-white/10" />}
            <h1
              className="text-2xl font-black tracking-[0.3em] italic uppercase leading-none"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('vera_brand_name')}
            >
              {brandName}
            </h1>
            <span
              className="text-[8px] tracking-[0.5em] mt-1"
              style={{ color: accentColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('vera_brand_suffix')}
            >
              {brandSuffix}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Search size={20} className="cursor-pointer text-white/60 hover:text-white transition-colors" />
            <button onClick={() => setShowCheckout(true)} className="relative">
              <ShoppingBag size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black z-10" />
          {heroProduct?.images?.[0] && (
            <img src={heroProduct.images[0]} className="w-full h-full object-cover scale-105 vera-slow-zoom" alt="" />
          )}
        </div>
        <div className="relative z-20 text-center px-4">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.6em] mb-6 vera-fade-in"
            style={{ color: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('vera_hero_label')}
          >
            {heroLabel}
          </p>
          <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter leading-[0.9] mb-12">
            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('vera_hero_title')}>{heroTitle}</span>
            <br />
            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('vera_hero_title2')}>{heroTitle2}</span>
          </h2>
          <button className="group relative px-10 py-5 bg-white text-black rounded-full font-bold uppercase text-xs tracking-widest overflow-hidden transition-all hover:scale-105 active:scale-95">
            <span className="relative z-10 flex items-center gap-3">
              <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('vera_hero_cta')}>{heroCta}</span>
              <ArrowRight size={16} />
            </span>
            <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300" style={{ backgroundColor: accentColor }} />
          </button>
        </div>
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-40">
          <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      {/* ── COLLECTION GRID ── */}
      <section className="py-32 px-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <h3
              className="text-4xl font-black italic tracking-tighter mb-4 uppercase"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('vera_section_title')}
            >
              {sectionTitle}
            </h3>
            <p
              className="text-white/40 font-medium max-w-sm"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('vera_section_desc')}
            >
              {sectionDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {products.map((product, idx) => (
            <div
              key={product.id}
              onClick={() => { setDetailProduct(product); onProductView?.(product); }}
              className={`group relative bg-[#111] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-700 cursor-pointer ${idx % 3 === 1 ? 'md:col-span-8' : 'md:col-span-4'}`}
            >
              <div className="aspect-[4/5] md:aspect-auto md:h-[320px] overflow-hidden">
                {product.images?.[0] && (
                  <img src={product.images[0]} className="w-full h-full object-cover grayscale-[50%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000 cursor-pointer" alt={product.name || product.title} onClick={(e) => { e.stopPropagation(); const imgs = detailProduct?.images?.filter(Boolean) || []; const idx = imgs.indexOf(product.images[0]); setZoomState({ images: imgs.length ? imgs : [product.images[0]], idx: idx >= 0 ? idx : 0 }); }} />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-0 w-full p-8 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: accentColor }}>
                    {product.description?.slice(0, 30) || 'Collection'}
                  </p>
                  <h4 className="text-2xl font-black italic tracking-tight">{product.name || product.title}</h4>
                  <p className="text-white/60 font-medium mt-1">{fmtPrice(product.price)}</p>
                </div>
                <button className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 shadow-2xl">
                  <ShoppingBag size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="py-32 bg-white text-black rounded-[4rem] mx-4 mb-8">
        <div className="max-w-[1400px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-16">
          {[
            { icon: <ShieldCheck size={32} />, title: trustTitle1, desc: trustDesc1, key1: 'vera_trust1_title', key2: 'vera_trust1_desc', rotate: 'rotate-3' },
            { icon: <Globe size={32} />, title: trustTitle2, desc: trustDesc2, key1: 'vera_trust2_title', key2: 'vera_trust2_desc', rotate: '-rotate-6' },
            { icon: <Sparkles size={32} />, title: trustTitle3, desc: trustDesc3, key1: 'vera_trust3_title', key2: 'vera_trust3_desc', rotate: 'rotate-12' },
          ].map((t, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-6">
              <div className={`w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center ${t.rotate}`}>{t.icon}</div>
              <h5
                className="text-xl font-black italic uppercase"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit(t.key1)}
              >
                {t.title}
              </h5>
              <p
                className="text-black/60 text-sm leading-relaxed"
                contentEditable={canManage}
                suppressContentEditableWarning
                onBlur={handleTextEdit(t.key2)}
              >
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-20 px-8 text-center border-t border-white/5">
        <h2 className="text-[12vw] font-black italic tracking-tighter text-white/5 leading-none mb-12 uppercase select-none">{brandName}</h2>
        <p className="text-[10px] font-bold text-white/20 tracking-widest uppercase">© 2026 {brandName}. ALL RIGHTS RESERVED.</p>
        <p className="text-[10px] mt-2 text-white/20">صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .vera-gallery-img { max-height: 50dvh !important; }
        }
        @media (min-width: 768px) {
          .vera-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .vera-gallery-wrap { height: 100%; }
          .vera-gallery-img { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* ── PRODUCT DETAIL MODAL ── */}
      {detailProduct && !selectedProduct && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="vera-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row bg-[#111] text-white border border-white/10" dir="ltr" style={{ height: '100dvh', maxHeight: '100dvh' }}>
            <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md text-white"><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
              <div className="h-full"><ProductImageGallery product={detailProduct} /></div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-xl font-black italic leading-tight text-white">{detailProduct.name || detailProduct.title}</h3>
                <p className="text-xl font-black shrink-0" style={{ color: accentColor }}>{fmtPrice(detailProduct.price)}</p>
              </div>
              {detailProduct.description && <p className="text-sm leading-relaxed whitespace-pre-line text-white/50">{detailProduct.description}</p>}
              {detailProduct.category && <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 text-white/50">{detailProduct.category}</span>}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-3 border-t border-white/10">
              <button onClick={() => { setSelectedProduct(detailProduct); setDetailProduct(null); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black tracking-wide text-black transition-all active:scale-95" style={{ backgroundColor: accentColor }}>
                <ShoppingBag size={18} /> اطلب الآن
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT CHECKOUT MODAL ── */}
      {selectedProduct && !orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-[#111] w-full max-w-md max-h-[90vh] rounded-t-[3rem] md:rounded-[3rem] overflow-y-auto p-8 vera-slide-up border border-white/10">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><X size={18} /></button>
            <div className="flex gap-4 mb-6">
              {selectedProduct.images?.[0] && <img src={selectedProduct.images[0]} className="w-24 h-32 rounded-2xl object-cover" alt="" />}
              <div>
                <h4 className="text-xl font-black italic">{selectedProduct.name || selectedProduct.title}</h4>
                <p className="font-black mt-1" style={{ color: accentColor }}>{fmtPrice(selectedProduct.price)}</p>
              </div>
            </div>
            <div className="space-y-3" dir="rtl">
              {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                <VariantSelector
                  variants={selectedProduct.variants}
                  selected={selectedVariant}
                  onSelect={setSelectedVariant}
                  accentColor={accentColor}
                  currency={currency}
                  basePrice={selectedProduct.price}
                />
              )}
              {offers.length > 0 && (
                <OfferSelector
                  offers={offers}
                  unitPrice={selectedProduct?.price || 0}
                  currency={currency}
                  selectedOfferId={selectedOffer?.offer_id ?? null}
                  onSelect={handleOfferSelect}
                  accentColor={accentColor}
                  textColor="#ffffff"
                  borderColor="rgba(255,255,255,0.1)"
                />
              )}
              <input type="text" placeholder="الاسم الكامل" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              <input type="tel" placeholder="رقم الهاتف" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              {showAddress && <input type="text" placeholder="العنوان (اختياري)" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />}
              <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white" value={formData.wilaya} onChange={e => setFormData({ ...formData, wilaya: e.target.value })}>
                {wilayas.map(w => <option key={w.id} value={String(w.id)} className="bg-black">{w.labelAR} — {fmtPrice(w.homePrice)}</option>)}
              </select>
              {showCommune && <input type="text" placeholder="البلدية" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.commune} onChange={e => setFormData({ ...formData, commune: e.target.value })} />}
              {showNotes && <textarea placeholder="ملاحظات" rows={2} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30 resize-none" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />}
            </div>
            <div className="mt-6 bg-white/5 p-4 rounded-2xl space-y-1">
              <div className="flex justify-between text-sm text-white/50"><span>المنتج:</span><span>{fmtPrice(selectedProduct.price)}</span></div>
              <div className="flex justify-between text-sm text-white/50"><span>التوصيل:</span><span>{fmtPrice(shipping)}</span></div>
              <div className="flex justify-between text-lg font-black pt-2 border-t border-white/10"><span>المجموع:</span><span style={{ color: accentColor }}>{fmtPrice(selectedProduct.price + shipping)}</span></div>
            </div>
            <button
              onClick={() => handleOrder(selectedProduct)}
              disabled={submitting || !formData.name || !formData.phone}
              className="w-full mt-6 py-5 rounded-2xl font-black text-lg text-black transition-all disabled:opacity-50 active:scale-95"
              style={{ backgroundColor: accentColor }}
            >
              {submitting ? 'جاري الإرسال...' : 'تأكيد الطلب'}
            </button>
          </div>
        </div>
      )}

      {/* ── ORDER SUCCESS ── */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-3xl font-black italic mb-2">تم تأكيد طلبك!</h2>
          <p className="text-white/50 text-sm">سنتواصل معك قريباً للتأكيد</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={formData.phone} />
          <button onClick={() => setOrderSuccess(false)} className="mt-8 px-8 py-3 border-2 rounded-full font-bold" style={{ borderColor: accentColor, color: accentColor }}>
            متابعة التسوق
          </button>
        </div>
      )}

      {/* ── ANIMATIONS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes vera-slow-zoom { 0% { transform: scale(1); } 100% { transform: scale(1.1); } }
        .vera-slow-zoom { animation: vera-slow-zoom 20s infinite alternate ease-in-out; }
        @keyframes vera-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .vera-fade-in { animation: vera-fade-in 1s ease-out; }
        @keyframes vera-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .vera-slide-up { animation: vera-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}} />

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
