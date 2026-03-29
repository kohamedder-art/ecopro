import React, { useState, useCallback } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
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

  /* ---------- state ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  /* set default wilaya */
  React.useEffect(() => {
    if (wilayas.length > 0 && !formData.wilaya) {
      setFormData(prev => ({ ...prev, wilaya: String(wilayas[0].id) }));
    }
  }, [wilayas]);

  /* ---------- helpers ---------- */
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${p.toLocaleString()} ${currency}`);

  const handleTextEdit = useCallback((key: string) => {
    if (!canManage) return undefined;
    return (e: React.FormEvent<HTMLElement>) => {
      const value = (e.target as HTMLElement).innerText;
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value }, '*');
    };
  }, [canManage]);

  /* derive sizes from product variants or default */
  const getSizes = (product: any): string[] => {
    if (product.variants?.length) return product.variants.map((v: any) => v.name || v.label || v);
    return ['S', 'M', 'L', 'XL'];
  };

  const handleSizeSelect = (productId: number, size: string) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const addToCart = (product: any) => {
    const size = selectedSizes[product.id];
    if (!size) return; // no size selected
    setCart(prev => [...prev, { ...product, selectedSize: size, cartId: Math.random() }]);
    setIsCartOpen(true);
  };

  const removeFromCart = (cartId: number) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const shipping = selectedWilaya?.homePrice ?? 0;
  const cartTotal = cart.reduce((acc, c) => acc + (c.price ?? 0), 0);
  const total = cartTotal + (cart.length > 0 ? shipping : 0);

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || cart.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of cart) {
        await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            quantity: 1,
            total_price: (item.price ?? 0) + shipping,
            delivery_fee: shipping,
            delivery_type: 'desk',
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_address: formData.address || selectedWilaya?.labelAR || '',
          }),
        });
      }
      setOrderSuccess(true);
      setCart([]);
    } catch { /* silent */ } finally {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map(product => {
            const sizes = getSizes(product);
            return (
              <div key={product.id} className="group flex flex-col bg-white/[0.02] rounded-[2.5rem] border border-white/5 p-3 transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10">
                {/* Image */}
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-[#111]">
                  {product.images?.[0] && (
                    <img src={product.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={product.name || product.title} />
                  )}
                  {/* Size selector overlay */}
                  <div className="absolute inset-x-4 bottom-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="bg-black/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10">
                      <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest text-center mb-2">Select Size</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {sizes.map(size => (
                          <button
                            key={size}
                            onClick={() => handleSizeSelect(product.id, size)}
                            className={`w-10 h-10 rounded-lg text-[10px] font-bold transition-all border ${selectedSizes[product.id] === size ? 'text-black' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'}`}
                            style={selectedSizes[product.id] === size ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full mt-3 bg-white text-black h-11 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-colors"
                      >
                        Add to Bag <ShoppingCart size={14} />
                      </button>
                    </div>
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
    </div>
  );
}
