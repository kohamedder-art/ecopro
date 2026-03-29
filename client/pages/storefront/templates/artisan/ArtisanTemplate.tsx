import React, { useState, useEffect, useCallback } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import {
  ShoppingBag,
  Heart,
  Truck,
  ShieldCheck,
  Star,
  X,
  Sparkles
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Artisan — Earthy multi-product storefront with cart & checkout     */
/* ------------------------------------------------------------------ */

export default function ArtisanTemplate(props: TemplateProps) {
  const {
    storeSlug,
    products = [],
    settings = {} as any,
    formatPrice,
    canManage,
  } = props;

  /* ---------- settings with defaults ---------- */
  const brandName      = (settings as any)?.artisan_brand_name      ?? 'نـسـيـج';
  const tagline        = (settings as any)?.artisan_tagline          ?? 'صنع بحب، ليدوم طويلاً';
  const story          = (settings as any)?.artisan_story            ?? 'في نسيج، نؤمن أن الملابس ليست مجرد أقمشة، بل هي ذكريات نرتديها. كل قطعة نختارها تمر عبر أيدينا لضمان أعلى جودة تصل إليكم في الجزائر.';
  const themeColor     = settings?.template_accent_color ?? (settings as any)?.artisan_theme_color ?? settings?.primary_color ?? '#7c4a32';
  const bgColor        = settings?.template_bg_color ?? (settings as any)?.artisan_bg_color ?? '#fdfaf6';
  const heroBadge      = (settings as any)?.artisan_hero_badge       ?? 'صناعة يدوية جزائرية';
  const heroTitle      = (settings as any)?.artisan_hero_title       ?? 'قطع كلاسيكية';
  const heroSubtitle   = (settings as any)?.artisan_hero_subtitle    ?? 'تعيش معك للأبد';
  const trustTitle     = (settings as any)?.artisan_trust_title      ?? 'لماذا يختارنا الجزائريون؟';
  const currency       = (settings as any)?.currency_code            ?? 'د.ج';

  /* ---------- delivery prices from API ---------- */
  const { wilayas } = useStoreDeliveryPrices(storeSlug);

  /* ---------- cart ---------- */
  const [cart, setCart] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', wilaya: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Set default wilaya once loaded
  useEffect(() => {
    if (wilayas.length > 0 && !formData.wilaya) {
      setFormData(prev => ({ ...prev, wilaya: String(wilayas[0].id) }));
    }
  }, [wilayas]);

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

  /* ---------- cart helpers ---------- */
  const addToCart = (product: any) => {
    if (!cart.find(i => i.id === product.id)) {
      setCart(prev => [...prev, product]);
    }
    setShowCheckout(true);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const selectedWilaya = wilayas.find(w => String(w.id) === formData.wilaya);
  const shipping = selectedWilaya?.homePrice ?? 0;
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
        await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            quantity: 1,
            total_price: item.price + shipping,
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
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- price display ---------- */
  const fmtPrice = (p: number) => (formatPrice ? formatPrice(p) : `${p.toLocaleString()} ${currency}`);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: bgColor, fontFamily: "'Noto Sans Arabic', sans-serif", color: '#3e2c23' }} dir="rtl">

      {/* ── HEADER ── */}
      <header className="p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-40 border-b border-orange-100">
        <div className="flex items-center gap-2">
          {settings?.store_logo ? <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white italic font-serif text-xl" style={{ backgroundColor: themeColor }}>ن</div>}
          <h1
            className="text-2xl font-black tracking-tighter"
            style={{ color: themeColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('artisan_brand_name')}
          >
            {brandName}
          </h1>
        </div>
        <button onClick={() => setShowCheckout(true)} className="relative p-2 bg-white rounded-full shadow-sm">
          <ShoppingBag size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-700 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white font-bold">
              {cart.length}
            </span>
          )}
        </button>
      </header>

      {/* ── HERO ── */}
      <section className="px-6 py-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold mb-4">
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
          className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed"
          contentEditable={canManage}
          suppressContentEditableWarning
          onBlur={handleTextEdit('artisan_story')}
        >
          {story}
        </p>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="px-6 space-y-12 py-6">
        {products.map((product, idx) => (
          <div key={product.id} className="group">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-stone-200">
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.name || product.title}
                  className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700"
                />
              )}
              {idx === 0 && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  الأكثر طلباً
                </div>
              )}
              <button
                onClick={() => addToCart(product)}
                className="absolute bottom-6 inset-x-6 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"
                style={{ backgroundColor: themeColor }}
              >
                اطلب الآن — {fmtPrice(product.price ?? 0)}
              </button>
            </div>
            <div className="mt-4 px-2">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold">{product.name || product.title}</h3>
                <div className="flex items-center gap-1 text-orange-800">
                  <Star size={14} fill="currentColor" />
                  <span className="text-xs font-bold">4.9</span>
                </div>
              </div>
              {product.description && (
                <p className="text-sm text-stone-500 mt-1">{product.description}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="m-6 p-8 rounded-[2.5rem]" style={{ backgroundColor: '#3e2c23', color: bgColor }}>
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
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative w-full max-h-[90vh] rounded-t-[3rem] overflow-y-auto p-8 artisan-slide-up" style={{ backgroundColor: bgColor }}>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mb-8" />

            {orderSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-2xl font-serif">تم تأكيد طلبك بنجاح!</h3>
                <p className="text-sm text-stone-500">سنتواصل معك قريباً</p>
                <button
                  onClick={() => { setShowCheckout(false); setOrderSuccess(false); }}
                  className="mt-4 px-6 py-3 rounded-2xl text-white font-bold"
                  style={{ backgroundColor: themeColor }}
                >
                  متابعة التسوق
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-serif mb-6">تفاصيل طلبك</h3>

                {cart.length === 0 ? (
                  <div className="text-center py-10 text-stone-400">سلتك فارغة حالياً</div>
                ) : (
                  <div className="space-y-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-4 items-center">
                        {item.images?.[0] && <img src={item.images[0]} className="w-16 h-16 rounded-xl object-cover" alt="" />}
                        <div className="flex-1">
                          <p className="font-bold">{item.name}</p>
                          <p className="text-sm text-stone-500">{fmtPrice(item.price ?? 0)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-stone-300"><X size={18} /></button>
                      </div>
                    ))}

                    <div className="border-t border-stone-200 pt-6 space-y-4">
                      <input
                        type="text"
                        placeholder="الاسم الكامل"
                        className="w-full bg-stone-100 border-none rounded-2xl p-4 text-sm"
                        style={{ '--tw-ring-color': themeColor } as any}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                      <input
                        type="tel"
                        placeholder="رقم الهاتف (ضروري)"
                        className="w-full bg-stone-100 border-none rounded-2xl p-4 text-sm text-right"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="العنوان (اختياري)"
                        className="w-full bg-stone-100 border-none rounded-2xl p-4 text-sm"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                      />
                      <select
                        className="w-full bg-stone-100 border-none rounded-2xl p-4 text-sm"
                        value={formData.wilaya}
                        onChange={e => setFormData({ ...formData, wilaya: e.target.value })}
                      >
                        {wilayas.map(w => (
                          <option key={w.id} value={String(w.id)}>{w.labelAR} — {fmtPrice(w.homePrice)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-orange-50 p-6 rounded-3xl space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">سعر المنتجات:</span>
                        <span className="font-bold">{fmtPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">توصيل:</span>
                        <span className="font-bold">{fmtPrice(shipping)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-black pt-2 border-t border-orange-200">
                        <span>المجموع:</span>
                        <span>{fmtPrice(total)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !formData.name || !formData.phone}
                      className="w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                      style={{ backgroundColor: themeColor }}
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
          <div className="bg-white/90 backdrop-blur shadow-xl border border-stone-100 p-3 rounded-2xl flex items-center gap-3 max-w-xs mx-auto">
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
    </div>
  );
}
