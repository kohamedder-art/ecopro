import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Truck, ShieldCheck, Star,
  Phone, Trash2, CheckCircle2
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  qty: number;
}

export default function BoutiqueTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [commune, setCommune] = useState('');

  const currency = settings?.currency_code || 'د.ج';
  const accentColor = settings?.template_accent_color || '#f59e0b'; // amber-500
  const themeColor = settings?.boutique_theme_color || settings?.primary_color || '#0f172a'; // slate-900

  // Editable text fields
  const brandName = settings?.boutique_brand_name || settings?.store_name || 'BOUTIQUE';
  const categoryName = settings?.boutique_category_name || 'مجموعة المنتجات';
  const footerText = settings?.boutique_footer_text || 'صنع بشغف لزبائننا في الجزائر';

  // Hero product = first product (or dzp_main_product_id)
  const heroProduct = useMemo(() => {
    const mainId = settings?.dzp_main_product_id;
    const found = mainId ? products?.find((p: any) => String(p.id) === String(mainId)) : null;
    return found || products?.[0] || null;
  }, [products, settings?.dzp_main_product_id]);

  // Collection = rest of products (excluding the hero)
  const collectionProducts = useMemo(() => {
    if (!products || products.length <= 1) return [];
    return products.filter(p => p.id !== heroProduct?.id);
  }, [products, heroProduct?.id]);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  // Cart logic
  const addToCart = (product: { id: number; title?: string; name?: string; price: number; images?: string[] }) => {
    const item: CartItem = {
      id: product.id,
      name: product.title || product.name || 'منتج',
      price: product.price,
      image: product.images?.[0] || '',
      qty: 1,
    };
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, item];
    });
    setIsCartOpen(true);
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);
  const total = subtotal + (cart.length > 0 ? deliveryFee : 0);

  const handleOrder = async () => {
    if (!customerName || !customerPhone || !selectedWilayaId || cart.length === 0) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsSubmitting(true);
      const address = `${selectedWilaya?.labelAR || ''} - ${commune}`;

      // Submit one order per cart item
      for (const item of cart) {
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_slug: storeSlug,
            product_id: item.id,
            quantity: item.qty,
            total_price: item.price * item.qty,
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

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 text-center w-full">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <CheckCircle2 size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-slate-500 text-sm mb-6">سنتصل بك قريباً لتأكيد الطلب</p>
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-right">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="text-slate-500">{item.name} × {item.qty}</span>
                <span className="font-bold">{item.price * item.qty} {currency}</span>
              </div>
            ))}
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between"><span className="text-slate-500">التوصيل</span><span className="font-bold">{deliveryFee} {currency}</span></div>
            <div className="flex justify-between"><span className="font-black">المجموع</span><span className="font-black text-lg">{total} {currency}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-900" style={{ backgroundColor: settings?.template_bg_color || '#ffffff' }} dir="rtl">

      {/* HEADER */}
      <header className="sticky top-0 z-40 text-white px-4 py-4 shadow-md" style={{ backgroundColor: themeColor }}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />}
            <h1
              className="text-xl font-black tracking-tighter italic"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('boutique_brand_name')}
            >
              {brandName}
            </h1>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative p-2">
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span
                className="absolute top-0 right-0 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2"
                style={{ backgroundColor: accentColor, borderColor: themeColor }}
              >
                {cart.reduce((a, b) => a + b.qty, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto">

        {/* HERO SECTION */}
        {heroProduct && (
          <section className="relative h-[450px] overflow-hidden">
            <img
              src={heroProduct.images?.[0] || ''}
              alt={heroProduct.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
            <div className="absolute bottom-0 p-6 text-white">
              <span
                className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest text-white"
                style={{ backgroundColor: accentColor }}
              >
                الأكثر طلباً
              </span>
              <h2 className="text-3xl font-black mt-2">{heroProduct.title}</h2>
              {heroProduct.description && (
                <p className="text-sm text-slate-300 mt-2 line-clamp-2">{heroProduct.description}</p>
              )}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-2xl font-black" style={{ color: accentColor }}>
                  {heroProduct.price} {currency}
                </span>
                {(heroProduct as any).original_price && (heroProduct as any).original_price > heroProduct.price && (
                  <span className="text-sm text-slate-400 line-through" dir="ltr">
                    {(heroProduct as any).original_price} {currency}
                  </span>
                )}
                <button
                  onClick={() => addToCart(heroProduct)}
                  className="bg-white text-slate-900 font-bold px-6 py-2 rounded-full text-sm hover:opacity-90 transition-colors active:scale-95"
                >
                  أضف للسلة
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TRUST MINI-BAR */}
        <div className="flex justify-around py-4 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500">
          <div className="flex items-center gap-1"><Truck size={14} /> توصيل 58 ولاية</div>
          <div className="flex items-center gap-1"><ShieldCheck size={14} /> الدفع عند الاستلام</div>
          <div className="flex items-center gap-1"><Star size={14} fill="currentColor" /> جودة مضمونة</div>
        </div>

        {/* COLLECTION GRID */}
        {collectionProducts.length > 0 && (
          <section className="p-4">
            <h3
              className="text-lg font-black mb-4 pr-3"
              style={{ borderRight: `4px solid ${accentColor}` }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('boutique_category_name')}
            >
              {categoryName}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {collectionProducts.map(product => (
                <div key={product.id} className="bg-white group">
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden mb-3">
                    <img
                      src={product.images?.[0] || ''}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <button
                      onClick={() => addToCart(product)}
                      className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur text-slate-900 text-xs font-bold py-2 rounded-lg opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all"
                    >
                      أضف للسلة +
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800">{product.title}</h4>
                  <p className="font-black text-sm" style={{ color: accentColor }}>{product.price} {currency}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No products placeholder */}
        {!heroProduct && collectionProducts.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            <ShoppingCart size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="font-bold">أضف منتجات من لوحة التحكم</p>
          </div>
        )}

        {/* FOOTER */}
        <footer className="p-10 text-center text-slate-400 bg-slate-50 mt-10">
          <p className="text-xs uppercase tracking-widest font-bold">{brandName}</p>
          <p
            className="text-[10px] mt-2 italic"
            contentEditable={canManage}
            suppressContentEditableWarning
            onBlur={handleTextEdit('boutique_footer_text')}
          >
            {footerText}
          </p>
        </footer>
      </div>

      {/* ── SIDE CART & CHECKOUT DRAWER ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 left-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">

              {/* Drawer Header */}
              <div className="px-4 py-6 border-b flex justify-between items-center">
                <button onClick={() => setIsCartOpen(false)} className="p-2"><X size={24} /></button>
                <h2 className="text-lg font-black">سلة المشتريات</h2>
                <span className="w-10" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <ShoppingCart size={64} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-500 font-bold">سلتك فارغة حالياً</p>
                  </div>
                ) : (
                  <>
                    {/* Item List */}
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.id} className="flex gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {item.image && (
                            <img src={item.image} className="w-20 h-20 object-cover rounded-xl" alt={item.name} />
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-sm">{item.name}</h4>
                            <p className="font-black text-sm mt-1" style={{ color: accentColor }}>{item.price} {currency}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center border bg-white rounded-lg">
                                <button type="button" onClick={() => updateQty(item.id, 1)} className="p-1 text-slate-400"><Plus size={14} /></button>
                                <span className="px-2 font-bold text-sm">{item.qty}</span>
                                <button type="button" onClick={() => updateQty(item.id, -1)} className="p-1 text-slate-400"><Minus size={14} /></button>
                              </div>
                              <button type="button" onClick={() => removeFromCart(item.id)} className="text-rose-500"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* COD FORM */}
                    <div className="mt-10 border-t pt-10">
                      <h3 className="text-lg font-black mb-4">معلومات التوصيل</h3>
                      <div className="space-y-4">
                        <input
                          type="text"
                          required
                          placeholder="الاسم الكامل"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            dir="ltr"
                            placeholder="05 55 55 55 55"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-right outline-none focus:ring-2 focus:ring-slate-900"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                          />
                          <Phone size={16} className="absolute left-4 top-3.5 text-slate-400" />
                        </div>
                        <select
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 appearance-none"
                          value={selectedWilayaId ?? ''}
                          onChange={(e) => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">اختر الولاية</option>
                          {wilayas.map((w) => (
                            <option key={w.id} value={w.id}>
                              {String(w.id).padStart(2, '0')} - {w.labelAR}
                              {w.homePrice ? ` (${w.homePrice} ${currency})` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          placeholder="البلدية"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                          value={commune}
                          onChange={(e) => setCommune(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Drawer Footer / Checkout CTA */}
              {cart.length > 0 && (
                <div className="p-4 bg-white border-t space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>المنتجات</span>
                      <span>{subtotal} {currency}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>التوصيل</span>
                      <span>{deliveryFee} {currency}</span>
                    </div>
                    <div className="flex justify-between font-black text-lg">
                      <span>المجموع النهائي</span>
                      <span style={{ color: accentColor }}>{total} {currency}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOrder}
                    disabled={isSubmitting}
                    className="w-full text-white font-bold py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                    style={{ backgroundColor: themeColor }}
                  >
                    {isSubmitting ? 'جاري الإرسال...' : (
                      <><CheckCircle2 size={20} /> تأكيد الطلب (الدفع عند الاستلام)</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM BAR */}
      {!isCartOpen && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="max-w-md mx-auto w-full text-white font-bold py-4 rounded-xl shadow-xl flex items-center justify-between px-6"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} />
              <span>عرض السلة ({cart.reduce((a, b) => a + b.qty, 0)})</span>
            </div>
            <div className="font-black" style={{ color: accentColor }}>{total} {currency}</div>
          </button>
        </div>
      )}
    </div>
  );
}
