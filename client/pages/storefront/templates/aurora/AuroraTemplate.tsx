import React, { useState, useMemo } from 'react';
import {
  ShoppingBag, ArrowRight, ShieldCheck, Star, X, Zap,
  Globe, Crown, Check, Phone, Eye, EyeOff
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  selectedSize: string;
}

export default function AuroraTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedSize, setSelectedSize] = useState('M');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || settings?.aurora_accent_color || '#E2B872';
  const bgColor = settings?.template_bg_color || settings?.aurora_bg_color || '#080808';
  const surfaceColor = settings?.aurora_surface_color || '#121212';

  // Section visibility toggles
  const showTrustBadges = settings?.aurora_show_trust !== false;

  // Editable text
  const brandName = settings?.aurora_brand_name || settings?.store_name || 'AURORA';
  const brandSuffix = settings?.aurora_brand_suffix || 'STUDIO';
  const heroTitle = settings?.aurora_hero_title || settings?.template_hero_heading || 'فـخـامة\nتـتحدث عـنك';
  const heroSubtitle = settings?.aurora_hero_subtitle || settings?.template_hero_subtitle || 'تصاميم حصرية تم انتقاؤها بعناية لتناسب ذوقك الرفيع.';
  const heroBadge = settings?.aurora_hero_badge || 'جديد';

  // Hero product = first product
  const heroProduct = useMemo(() => {
    const mainId = settings?.dzp_main_product_id;
    const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
    return found || products?.[0] || null;
  }, [products, settings?.dzp_main_product_id]);

  // All products for the list
  const allProducts = products || [];

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const addToCart = (product: { id: number; title?: string; name?: string; price: number; images?: string[] }) => {
    const item: CartItem = {
      id: product.id,
      name: product.title || product.name || 'منتج',
      price: product.price,
      image: product.images?.[0] || '',
      selectedSize,
    };
    setCart(prev => [...prev, item]);
    setShowCheckout(true);
    trackAllPixels(PixelEvents.ADD_TO_CART, {
      content_ids: [product.id],
      content_name: product.title || product.name || 'منتج',
      value: product.price,
      currency: 'DZD',
      content_type: 'product',
    });
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
      const address = `${selectedWilaya?.labelAR || ''}`;

      // Submit one order per cart item
      for (const item of cart) {
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            quantity: 1,
            total_price: item.price,
            delivery_fee: deliveryFee,
            delivery_type: 'desk',
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: address,
          }),
        });

        const data = await res.json();
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
          <div className="rounded-xl p-4 text-sm space-y-2 text-right bg-white/5 border border-white/10">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-white/50">{item.name}</span>
                <span className="font-bold">{item.price} {currency}</span>
              </div>
            ))}
            <div className="h-px bg-white/10 my-1" />
            <div className="flex justify-between"><span className="text-white/50">التوصيل</span><span className="font-bold">{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span></div>
            <div className="flex justify-between"><span className="font-black">المجموع</span><span className="font-black text-lg" style={{ color: accentColor }}>{total} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: bgColor }} dir="rtl">

      {/* HEADER */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-xl mx-auto px-6 h-20 flex justify-between items-center">
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

      <main className="pt-24 pb-32 max-w-xl mx-auto px-6">

        {/* HERO SECTION */}
        {heroProduct && (
          <section className="mb-12 relative overflow-hidden rounded-[2.5rem] p-8 aspect-[16/10] flex flex-col justify-end">
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
        <div className="space-y-16">
          {allProducts.map(product => {
            const originalPrice = (product as any).original_price;
            const lowStock = product.stock_quantity > 0 && product.stock_quantity < 5;

            return (
              <section key={product.id} className="relative group">
                <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden border border-white/5" style={{ backgroundColor: surfaceColor }}>
                  <img
                    src={product.images?.[0] || ''}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    loading="lazy"
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

                  {/* Glass Interaction Card */}
                  <div className="absolute bottom-6 inset-x-6 p-6 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{product.title}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-black" style={{ color: accentColor }}>
                            {product.price} <span className="text-[10px] text-white/40">{currency}</span>
                          </p>
                          {originalPrice && originalPrice > product.price && (
                            <span className="text-sm text-white/30 line-through">{originalPrice}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className="w-full h-14 text-black rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
                      style={{ backgroundColor: accentColor }}
                    >
                      أضف للسلة <ArrowRight size={18} />
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
        {(showTrustBadges || canManage) && (
        <section className="mt-20 grid grid-cols-2 gap-4 relative overflow-visible" data-edit-path="trust-badges">
            {canManage && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                    <button
                        onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'aurora_show_trust', value: !showTrustBadges }, '*')}
                        className="flex items-center gap-1 font-bold"
                    >
                        {showTrustBadges ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                    </button>
                </div>
            )}
            {showTrustBadges && (
            <>
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
            </>
            )}
            {canManage && !showTrustBadges && (
                <span className="text-white/40 text-xs">⚡ Trust badges hidden</span>
            )}
        </section>
        )}
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
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowCheckout(false)} />
          <div
            className="relative w-full max-w-xl h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col border border-white/10"
            style={{ backgroundColor: surfaceColor }}
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
                        <p className="font-black mt-2 text-lg" style={{ color: accentColor }}>{item.price} {currency}</p>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="text-white/20"><X size={20} /></button>
                    </div>
                  ))}

                  {/* Form */}
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
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 bg-black/40 border-t border-white/10 space-y-4">
                <div className="flex justify-between text-white/60"><span>المجموع الفرعي</span><span>{subtotal} {currency}</span></div>
                <div className="flex justify-between text-white/60"><span>التوصيل</span><span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span></div>
                <div className="flex justify-between text-2xl font-black text-white pt-2"><span>الإجمالي</span><span>{total} {currency}</span></div>
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
    </div>
  );
}
