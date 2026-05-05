import React, { useState, useEffect, useCallback } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
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
  Eye,
  EyeOff
} from 'lucide-react';

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
  } = props;

  /* ---------- settings ---------- */
  const storeName   = (settings as any)?.gallery_store_name   ?? 'ELEVATE CLOSET';
  const headline    = (settings as any)?.gallery_headline     ?? 'مجموعة الصيف الأساسية';
  const subheadline = (settings as any)?.gallery_subheadline  ?? 'أناقة بسيطة لكل يوم';
  const heroBadge   = (settings as any)?.gallery_hero_badge   ?? 'حصرياً في الجزائر';
  const accentColor = settings?.template_accent_color ?? (settings as any)?.gallery_accent_color ?? settings?.primary_color ?? '#facc15';
  const currency    = (settings as any)?.currency_code        ?? 'د.ج';

  // Section visibility toggles
  const showTrustBadges = (settings as any)?.gallery_show_trust !== false;

  /* ---------- delivery ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);

  /* ---------- state ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [quickQty, setQuickQty] = useState(1);

  useEffect(() => {
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

  /* ---------- cart actions ---------- */
  const handleAdd = (product: any, qty: number = 1) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { ...product, qty }];
    });
    setActiveProduct(null);
    setQuickQty(1);
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const removeItem = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const shipping = selectedWilaya?.homePrice ?? 0;
  const subtotal = cart.reduce((acc, item) => acc + ((item.price ?? 0) * item.qty), 0);
  const total = subtotal + (cart.length > 0 ? shipping : 0);

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
            quantity: item.qty,
            total_price: (item.price ?? 0) * item.qty + shipping,
            delivery_fee: shipping,
            delivery_type: 'desk',
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_address: formData.address || selectedWilaya?.labelAR || '',
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
    <div className="min-h-screen text-slate-900 font-sans" style={{ backgroundColor: settings?.template_bg_color || '#f8fafc' }} dir="rtl">

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center">
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
            <span className="text-[10px] text-slate-400 font-bold uppercase">المجموع</span>
            <span className="text-sm font-black">{fmtPrice(total)}</span>
          </div>
          <div className="relative">
            <ShoppingBag size={22} strokeWidth={2.5} />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] flex items-center justify-center rounded-full border border-white">{cart.length}</span>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-24 pb-12 px-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
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
            className="text-slate-500 text-sm max-w-[200px]"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('gallery_subheadline')}
          >
            {subheadline}
          </p>
        </div>
      </section>

      {/* ── PRODUCT GRID ── */}
      <section className="px-6 grid grid-cols-2 gap-x-4 gap-y-8 pb-32">
        {products.map((product, idx) => (
          <div key={product.id} className="relative group">
            <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-slate-200 relative mb-3">
              {product.images?.[0] && (
                <img src={product.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={product.name || product.title} />
              )}
              <button
                onClick={() => { setActiveProduct(product); setQuickQty(1); }}
                className="absolute bottom-3 right-3 left-3 bg-white/95 text-black font-black text-xs py-3 rounded-2xl shadow-lg opacity-100 md:opacity-0 group-hover:opacity-100 translate-y-0 md:translate-y-2 group-hover:translate-y-0 transition-all"
              >
                شراء سريع +
              </button>
              {idx === 0 && <span className="absolute top-3 right-3 bg-black text-white text-[9px] font-bold px-2 py-1 rounded-lg uppercase">Best Seller</span>}
            </div>
            <h3 className="font-bold text-sm">{product.name || product.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-black text-black">{fmtPrice(product.price ?? 0)}</span>
              {product.original_price && <span className="text-xs text-slate-400 line-through">{fmtPrice(product.original_price)}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ── STICKY CART BOTTOM SHEET ── */}
      {cart.length > 0 && !isOrderComplete && (
        <div className="fixed bottom-0 left-0 w-full z-40 px-4 pb-4">
          <div className="max-w-md mx-auto bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            {/* Items thumbnails */}
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <div className="flex gap-2">
                {cart.slice(0, 3).map(item => (
                  <div key={item.id} className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100">
                    {item.images?.[0] && <img src={item.images[0]} className="w-full h-full object-cover" alt="" />}
                  </div>
                ))}
                {cart.length > 3 && <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-bold">+{cart.length - 3}</div>}
              </div>
              <button onClick={() => setCart([])} className="text-[10px] font-bold text-rose-500 underline uppercase">تفريغ السلة</button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="الاسم" className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <input type="tel" placeholder="رقم الهاتف" dir="ltr" className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none text-right focus:ring-2 focus:ring-black" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <select className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black" value={formData.wilaya} onChange={e => setFormData({ ...formData, wilaya: e.target.value })}>
                {wilayas.map(w => <option key={w.id} value={String(w.id)}>{w.labelAR} — {fmtPrice(w.homePrice)}</option>)}
              </select>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.name || !formData.phone}
                className="w-full text-white font-black py-5 rounded-2xl flex items-center justify-between px-8 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                <span>{submitting ? 'جاري الإرسال...' : 'تأكيد الطلب الآن'}</span>
                <span className="flex items-center gap-1">{fmtPrice(total)} <ArrowRight size={18} /></span>
              </button>
              <div className="flex justify-center items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest relative">
                {(showTrustBadges || canManage) && (
                    <>
                    {canManage && (
                        <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-[10px] px-2 py-1 rounded-full shadow-lg z-10">
                            <button
                                onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'gallery_show_trust', value: !showTrustBadges }, '*')}
                                className="flex items-center gap-1 font-bold"
                            >
                                {showTrustBadges ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                            </button>
                        </div>
                    )}
                    {showTrustBadges && (
                    <>
                    <span className="flex items-center gap-1"><Truck size={12} /> شحن سريع</span>
                    <span className="flex items-center gap-1"><Package size={12} /> فحص قبل الدفع</span>
                    </>
                    )}
                    {canManage && !showTrustBadges && (
                        <span className="text-slate-400 text-[9px]">🛡️ Trust badges hidden</span>
                    )}
                    </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK BUY MODAL ── */}
      {activeProduct && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveProduct(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 overflow-hidden gallery-slide-up">
            <button onClick={() => setActiveProduct(null)} className="absolute top-4 left-4 p-2 bg-slate-50 rounded-full"><X size={20} /></button>
            <div className="flex gap-6 items-start">
              {activeProduct.images?.[0] && <img src={activeProduct.images[0]} className="w-24 h-32 object-cover rounded-2xl shadow-md" alt="" />}
              <div>
                <h4 className="text-xl font-black">{activeProduct.name || activeProduct.title}</h4>
                <p className="font-black text-lg mt-1" style={{ color: '#d97706' }}>{fmtPrice(activeProduct.price ?? 0)}</p>
                <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1"><Check size={14} className="text-emerald-500" /> متوفر في المخزن</span>
                </div>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                <span className="font-bold text-sm">الكمية</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuickQty(Math.max(1, quickQty - 1))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"><Minus size={16} /></button>
                  <span className="font-black">{quickQty}</span>
                  <button onClick={() => setQuickQty(quickQty + 1)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"><Plus size={16} /></button>
                </div>
              </div>
              <button
                onClick={() => handleAdd(activeProduct, quickQty)}
                className="w-full bg-black text-white font-black py-5 rounded-2xl shadow-xl hover:bg-slate-800 transition-colors"
              >
                أضف إلى السلة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS OVERLAY ── */}
      {isOrderComplete && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <Check size={48} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black mb-2">تم استلام طلبك!</h2>
          <p className="text-slate-500 text-sm">سنتصل بك في أقرب وقت لتأكيد العنوان والشحن.</p>
          <button
            onClick={() => { setIsOrderComplete(false); setCart([]); }}
            className="mt-10 border-2 border-slate-900 px-8 py-3 rounded-2xl font-black"
          >
            العودة للمتجر
          </button>
        </div>
      )}

      {/* ── ANIMATIONS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gallery-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .gallery-slide-up { animation: gallery-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}} />
    </div>
  );
}
