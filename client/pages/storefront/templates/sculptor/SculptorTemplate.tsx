import React, { useState, useRef, useMemo } from 'react';
import {
  ShoppingBag, Maximize2, Ruler, ShieldCheck, Truck,
  CheckCircle2, X, CreditCard, ChevronDown, ChevronLeft, Phone
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
}

export default function SculptorTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);

  const [activeImage, setActiveImage] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || settings?.sculptor_accent_color || '#D4AF37';
  const bgColor = settings?.template_bg_color || settings?.sculptor_bg_color || '#0A0A0A';
  const surfaceColor = settings?.sculptor_surface_color || '#0F0F0F';

  // Editable text
  const brandName = settings?.sculptor_brand_name || settings?.store_name || 'SCULPTOR';
  const brandTagline = settings?.sculptor_tagline || 'ARTISANAL APPAREL';

  // Main product (single-product detail view)
  const mainProduct = useMemo(() => {
    const mainId = settings?.dzp_main_product_id;
    const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
    return found || products?.[0] || null;
  }, [products, settings?.dzp_main_product_id]);

  const productImages = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [];
  const productPrice = mainProduct?.price ?? 0;
  const originalPrice = (mainProduct as any)?.original_price ?? null;

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollPosition = el.scrollLeft;
    const itemWidth = el.offsetWidth;
    const index = Math.abs(Math.round(scrollPosition / itemWidth));
    setActiveImage(index);
  };

  const handleAddToCart = () => {
    if (!mainProduct) return;
    setIsAdding(true);
    setTimeout(() => {
      setCart(prev => [...prev, {
        id: mainProduct.id,
        name: mainProduct.title || 'منتج',
        price: productPrice,
        image: productImages[0] || '',
      }]);
      setIsAdding(false);
      setShowCart(true);
    }, 800);
  };

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
            <CheckCircle2 size={36} style={{ color: accentColor }} />
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
            <div className="flex justify-between"><span className="text-white/50">التوصيل</span><span className="font-bold">{deliveryFee} {currency}</span></div>
            <div className="flex justify-between"><span className="font-black">المجموع</span><span className="font-black text-lg" style={{ color: accentColor }}>{total} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans" style={{ backgroundColor: bgColor }} dir="rtl">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 h-20 z-50 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <span className="w-10" />
        <div className="flex flex-col items-center">
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-10 h-10 rounded-full object-cover mb-1 border border-white/10" />}
          <h1
            className="text-xl font-black tracking-[0.3em]"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('sculptor_brand_name')}
          >
            {brandName}
          </h1>
          <span
            className="text-[8px] font-bold tracking-widest uppercase"
            style={{ color: accentColor }}
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('sculptor_tagline')}
          >
            {brandTagline}
          </span>
        </div>
        <button onClick={() => setShowCart(true)} className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10">
          <ShoppingBag size={20} />
          {cart.length > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 text-black text-[9px] font-black rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              {cart.length}
            </span>
          )}
        </button>
      </nav>

      <main className="pt-24 pb-32 max-w-lg mx-auto px-0 md:px-6">

        {/* HORIZONTAL IMAGE GALLERY */}
        {productImages.length > 0 ? (
          <div className="relative group">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-6 pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {productImages.map((img, i) => (
                <div key={i} className="min-w-full snap-center">
                  <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      alt={`Product view ${i + 1}`}
                      loading={i === 0 ? 'eager' : 'lazy'}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                  </div>
                </div>
              ))}
            </div>

            {/* Indicators */}
            {productImages.length > 1 && (
              <div className="absolute bottom-10 inset-x-0 flex justify-center gap-2 pointer-events-none">
                {productImages.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${activeImage === i ? 'w-8' : 'w-2 bg-white/40'}`}
                    style={activeImage === i ? { backgroundColor: accentColor } : undefined}
                  />
                ))}
              </div>
            )}

            {/* Swipe Hint */}
            {productImages.length > 1 && (
              <div className="absolute left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                  <ChevronLeft size={20} style={{ color: accentColor }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-6 aspect-[4/5] rounded-[2.5rem] bg-white/5 flex items-center justify-center border border-white/10">
            <p className="text-white/30 text-sm">أضف صور المنتج من لوحة التحكم</p>
          </div>
        )}

        {/* PRODUCT INFO */}
        {mainProduct && (
          <div className="px-6 mt-8 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                {mainProduct.category && (
                  <span className="text-xs text-white/40 font-bold uppercase tracking-widest">{mainProduct.category}</span>
                )}
                <h2 className="text-3xl font-black mt-1 leading-tight">{mainProduct.title}</h2>
              </div>
              <div className="text-left">
                <p className="text-2xl font-black" style={{ color: accentColor }}>
                  {productPrice} <span className="text-xs">{currency}</span>
                </p>
                {originalPrice && originalPrice > productPrice && (
                  <span className="text-sm text-white/30 line-through block">{originalPrice} {currency}</span>
                )}
              </div>
            </div>

            {mainProduct.description && (
              <p className="text-sm text-white/60 leading-relaxed max-w-[90%]">{mainProduct.description}</p>
            )}
          </div>
        )}

        {/* ADD TO CART */}
        <div className="px-6 mt-10 space-y-4">
          <button
            onClick={handleAddToCart}
            disabled={isAdding || !mainProduct}
            className="w-full rounded-[1.8rem] font-black text-lg transition-all flex items-center justify-center gap-4 py-5 active:scale-[0.97]"
            style={isAdding
              ? { backgroundColor: accentColor, color: '#000' }
              : { backgroundColor: '#fff', color: '#000' }
            }
          >
            {isAdding ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>جاري التجهيز...</span>
              </div>
            ) : (
              <>إضافة إلى الحقيبة <ShoppingBag size={22} /></>
            )}
          </button>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2 py-4">
            {[
              { icon: Truck, text: 'توصيل سريع' },
              { icon: ShieldCheck, text: 'أصلي 100%' },
              { icon: CreditCard, text: 'عند الاستلام' },
            ].map((badge, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
                <badge.icon size={18} />
                <span className="text-[9px] font-black uppercase tracking-widest">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* No product placeholder */}
        {!mainProduct && (
          <div className="px-6 py-20 text-center">
            <ShoppingBag size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/40 font-bold">أضف منتجات من لوحة التحكم</p>
          </div>
        )}
      </main>

      {/* CHECKOUT DRAWER */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCart(false)} />
          <div
            className="relative w-full max-w-lg rounded-t-[3rem] border-x border-t border-white/10 flex flex-col max-h-[92vh] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
            style={{ backgroundColor: surfaceColor }}
          >
            <div className="w-full flex justify-center py-4">
              <div className="w-12 h-1.5 bg-white/10 rounded-full" />
            </div>

            <div className="p-8 flex-1 overflow-y-auto pt-0" style={{ scrollbarWidth: 'none' }}>
              <div className="flex justify-between items-center mb-8 sticky top-0 py-2 z-10 backdrop-blur-sm" style={{ backgroundColor: surfaceColor + 'E6' }}>
                <h3 className="text-2xl font-black">الحقيبة</h3>
                <button onClick={() => setShowCart(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-24 text-center space-y-6">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                    <ShoppingBag size={40} className="text-white/10" />
                  </div>
                  <p className="text-white/40 font-black tracking-widest uppercase">حقيبتك فارغة</p>
                </div>
              ) : (
                <div className="space-y-8 pb-10">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex gap-5">
                      {item.image && (
                        <img src={item.image} className="w-28 h-32 rounded-3xl object-cover border border-white/5" alt={item.name} />
                      )}
                      <div className="flex-1 flex flex-col justify-between py-2">
                        <h4 className="font-black text-xl leading-tight">{item.name}</h4>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-black">{item.price} {currency}</p>
                          <button
                            type="button"
                            onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500/60 hover:text-red-500 text-[10px] font-black uppercase underline"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Shipping Form */}
                  <div className="space-y-4 pt-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>معلومات الشحن</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="الاسم الكامل"
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none transition-all font-bold text-white placeholder-white/30"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          placeholder="05 55 55 55 55"
                          className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none transition-all text-right font-bold text-white placeholder-white/30"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                        />
                        <Phone size={16} className="absolute left-6 top-5 text-white/30" />
                      </div>
                      <div className="relative">
                        <select
                          required
                          className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none appearance-none font-bold text-white"
                          value={selectedWilayaId ?? ''}
                          onChange={e => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="" className="bg-black">اختر الولاية</option>
                          {wilayas.map((w) => (
                            <option key={w.id} value={w.id} className="bg-black">
                              {String(w.id).padStart(2, '0')} - {w.labelAR}
                              {w.homePrice ? ` (${w.homePrice} ${currency})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={20} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 pb-10 bg-black border-t border-white/5 rounded-t-[3rem] space-y-5">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-white/40 text-xs font-bold uppercase">
                    <span>قيمة المشتريات</span>
                    <span>{subtotal} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center text-white/40 text-xs font-bold uppercase pb-3 border-b border-white/5">
                    <span>تكلفة التوصيل</span>
                    <span>{deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${currency}`}</span>
                  </div>
                  <div className="flex justify-between items-end pt-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">المبلغ الإجمالي</p>
                      <p className="text-4xl font-black" style={{ color: accentColor }}>
                        {total} <span className="text-sm font-bold">{currency}</span>
                      </p>
                    </div>
                    <div className="text-[9px] text-white/20 font-bold mb-2 uppercase">الدفع نقداً عند الاستلام</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOrder}
                  disabled={isSubmitting}
                  className="w-full rounded-[1.8rem] font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all py-5 disabled:opacity-60"
                  style={{ backgroundColor: accentColor, color: '#000', boxShadow: `0 15px 30px ${accentColor}33` }}
                >
                  {isSubmitting ? 'جاري الإرسال...' : <><span>تأكيد الطلب</span> <CheckCircle2 size={24} /></>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
