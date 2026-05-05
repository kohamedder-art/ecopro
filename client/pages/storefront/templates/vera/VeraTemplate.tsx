import React, { useState, useEffect, useCallback } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import {
  ShoppingBag,
  Search,
  Menu,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Globe,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

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

  // Section visibility toggles
  const showTrustSection = (settings as any)?.vera_show_trust !== false;

  /* ---------- delivery ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);

  /* ---------- state ---------- */
  const [showCheckout, setShowCheckout] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

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
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${p.toLocaleString()} ${currency}`);

  const handleTextEdit = useCallback((key: string) => {
    if (!canManage) return undefined;
    return (e: React.FormEvent<HTMLElement>) => {
      const value = (e.target as HTMLElement).innerText;
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value }, '*');
    };
  }, [canManage]);

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const shipping = selectedWilaya?.homePrice ?? 0;

  /* ---------- order ---------- */
  const handleOrder = async (product: any) => {
    if (!formData.name || !formData.phone) return;
    setSubmitting(true);
    try {
      await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: product.id,
          quantity: 1,
          total_price: (product.price ?? 0) + shipping,
          delivery_fee: shipping,
          delivery_type: 'desk',
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_address: formData.address || selectedWilaya?.labelAR || '',
        }),
      });
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
              onClick={() => setSelectedProduct(product)}
              className={`group relative bg-[#111] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-700 cursor-pointer ${idx % 3 === 1 ? 'md:col-span-8' : 'md:col-span-4'}`}
            >
              <div className="aspect-[4/5] md:aspect-auto md:h-[500px] overflow-hidden">
                {product.images?.[0] && (
                  <img src={product.images[0]} className="w-full h-full object-cover grayscale-[50%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt={product.name || product.title} />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-0 w-full p-8 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: accentColor }}>
                    {product.description?.slice(0, 30) || 'Collection'}
                  </p>
                  <h4 className="text-2xl font-black italic tracking-tight">{product.name || product.title}</h4>
                  <p className="text-white/60 font-medium mt-1">{fmtPrice(product.price ?? 0)}</p>
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
      {(showTrustSection || canManage) && (
      <section className="py-32 bg-white text-black rounded-[4rem] mx-4 mb-8 relative" data-edit-path="trust-section">
        {canManage && (
            <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                <button
                    onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'vera_show_trust', value: !showTrustSection }, '*')}
                    className="flex items-center gap-1 font-bold"
                >
                    {showTrustSection ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                </button>
            </div>
        )}
        {showTrustSection && (
        <>
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
        </>
        )}
        {canManage && !showTrustSection && (
            <div className="text-center py-4 text-gray-400 text-xs">🛡️ Trust section hidden</div>
        )}
      </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="py-20 px-8 text-center border-t border-white/5">
        <h2 className="text-[12vw] font-black italic tracking-tighter text-white/5 leading-none mb-12 uppercase select-none">{brandName}</h2>
        <p className="text-[10px] font-bold text-white/20 tracking-widest uppercase">© 2026 {brandName}. ALL RIGHTS RESERVED.</p>
      </footer>

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
                <p className="font-black mt-1" style={{ color: accentColor }}>{fmtPrice(selectedProduct.price ?? 0)}</p>
              </div>
            </div>
            <div className="space-y-3" dir="rtl">
              <input type="text" placeholder="الاسم الكامل" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              <input type="tel" placeholder="رقم الهاتف" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              <input type="text" placeholder="العنوان (اختياري)" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white" value={formData.wilaya} onChange={e => setFormData({ ...formData, wilaya: e.target.value })}>
                {wilayas.map(w => <option key={w.id} value={String(w.id)} className="bg-black">{w.labelAR} — {fmtPrice(w.homePrice)}</option>)}
              </select>
            </div>
            <div className="mt-6 bg-white/5 p-4 rounded-2xl space-y-1">
              <div className="flex justify-between text-sm text-white/50"><span>المنتج:</span><span>{fmtPrice(selectedProduct.price ?? 0)}</span></div>
              <div className="flex justify-between text-sm text-white/50"><span>التوصيل:</span><span>{fmtPrice(shipping)}</span></div>
              <div className="flex justify-between text-lg font-black pt-2 border-t border-white/10"><span>المجموع:</span><span style={{ color: accentColor }}>{fmtPrice((selectedProduct.price ?? 0) + shipping)}</span></div>
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
    </div>
  );
}
