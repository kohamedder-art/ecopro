import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  Star, 
  X, 
  Phone,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Zap,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { TemplateProps } from '../types';

import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

const FALLBACK_PRODUCTS = [
  {
    id: 1,
    name: "Ultra-Fast GaN Charger 65W",
    price: 4500,
    oldPrice: 6200,
    badge: "Best Seller",
    description: "Charge your laptop and phone simultaneously. Perfect for Algerian power sockets.",
    images: [
      "https://images.unsplash.com/photo-1610944230741-9a9978434311?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=600"
    ],
    features: ["65W Fast Charge", "Dual USB-C", "Safety Certified"]
  },
  {
    id: 2,
    name: "Premium Wireless Earbuds Pro",
    price: 8900,
    oldPrice: 12500,
    badge: "Limited Edition",
    description: "Active noise cancellation with 30h battery life. Local warranty included.",
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600"
    ],
    features: ["ANC Technology", "Waterproof IPX7", "Deep Bass"]
  }
];

export default function NeedDZTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#059669';
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [timeLeft, setTimeLeft] = useState({ hours: 0, mins: 45, secs: 12 });
  const [currentImgIdx, setCurrentImgIdx] = useState<Record<number, number>>({});
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;

  // Section visibility toggles
  const showCountdown = settings?.needdz_show_countdown !== false;
  const showTrustBanner = settings?.needdz_show_trust !== false;
  const showSocialProof = settings?.needdz_show_social !== false;

  // Map backend products or fallback
  const displayProducts = products && products.length > 0 ? products.map(p => ({
    id: p.id,
    name: p.title || p.name,
    price: p.price,
    oldPrice: p.original_price || p.price * 1.3,
    badge: "شائع",
    description: p.description || "Un produit fantastique avec de superbes caractéristiques.",
    images: p.images && p.images.length > 0 ? p.images : FALLBACK_PRODUCTS[0].images,
    features: ["جودة عالية", "توصيل سريع", "ضمان"]
  })) : FALLBACK_PRODUCTS;

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (canManage) { window.parent.postMessage({ type: "TEMPLATE_UPDATE_SETTING", key, value: e.currentTarget.textContent || "" }, "*"); //
      
    }
  };

  // Countdown timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.secs > 0) return { ...prev, secs: prev.secs - 1 };
        if (prev.mins > 0) return { ...prev, mins: prev.mins - 1, secs: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setOrderStatus('loading');
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        store_slug: storeSlug || settings?.store_name || "needdz",
        product_id: selectedProduct.id,
        quantity: 1,
        total_price: selectedProduct.price,
        delivery_fee: deliveryFee,
        delivery_type: 'desk',
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR, fd.get('commune')].filter(Boolean).join(' - ')
      };
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Order error');
      setOrderStatus('success');
    } catch(err) {
      console.error(err);
      setOrderStatus('idle');
      alert("Une erreur s'est produite lors de la commande.");
    }
  };

  const nextImg = (id: number, max: number) => {
    setCurrentImgIdx(prev => ({ ...prev, [id]: ((prev[id] || 0) + 1) % max }));
  };

  return (
    <div className="min-h-screen flex justify-center font-sans" style={{ backgroundColor: settings?.template_bg_color || '#f1f5f9' }} dir="rtl">
      <div className="w-full max-w-[480px] bg-white relative flex flex-col shadow-xl min-h-screen">
        
        {/* Urgent Header */}
        {(showCountdown || canManage) && (
        <div className="text-white px-4 py-2 text-[11px] font-bold flex justify-between items-center sticky top-0 z-50 relative" style={{ backgroundColor: accentColor }} data-edit-path="countdown-header">
          {canManage && (
              <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                  <button
                      onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'needdz_show_countdown', value: !showCountdown }, '*')}
                      className="flex items-center gap-1 font-bold"
                  >
                      {showCountdown ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                  </button>
              </div>
          )}
          {showCountdown && (
          <>
          <div className="flex items-center gap-1">
            <Zap size={12} fill="white" />
            عرض سريع: ينتهي خلال {timeLeft.mins}د {timeLeft.secs}ث
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            14 شخص يشاهد هذا المنتج
          </div>
          </>
          )}
          {canManage && !showCountdown && (
              <span className="text-white/70 text-[10px]">⚡ Countdown hidden</span>
          )}
        </div>
        )}

        {/* Main Branding */}
        <header className="px-6 py-5 flex justify-between items-center bg-white border-b border-slate-50">
          <div className="flex items-center gap-2">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: accentColor + '4d' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: accentColor }}>
                {(settings?.store_name || 'م').charAt(0)}
              </div>
            )}
            <span className="text-lg font-black text-slate-900">{settings?.store_name || "متجري"}</span>
          </div>
          <div className="relative">
            <ShoppingBag size={24} className="text-slate-800" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
          </div>
        </header>

        <main className="flex-1 pb-32">
          {/* Trust Banner */}
          {(showTrustBanner || canManage) && (
          <div className="flex overflow-x-auto py-4 px-6 gap-4 no-scrollbar bg-slate-50/50 relative" data-edit-path="trust-banner">
            {canManage && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                    <button
                        onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'needdz_show_trust', value: !showTrustBanner }, '*')}
                        className="flex items-center gap-1 font-bold"
                    >
                        {showTrustBanner ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                    </button>
                </div>
            )}
            {showTrustBanner && (
            <>
            {[
              { icon: <Truck size={16}/>, text: "توصيل 58 ولاية" },
              { icon: <ShieldCheck size={16}/>, text: "الدفع عند الاستلام" },
              { icon: <Clock size={16}/>, text: "ضمان 12 شهر" }
            ].map((item, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-white px-3 py-2 rounded-full border border-slate-200 shadow-sm">
                <span style={{ color: accentColor }}>{item.icon}</span>
                <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">{item.text}</span>
              </div>
            ))}
            </>
            )}
            {canManage && !showTrustBanner && (
                <span className="text-slate-400 text-[10px]">🛡️ Trust banner hidden</span>
            )}
          </div>
          )}

          {/* Product Feed */}
          <div className="p-4 space-y-10 mt-2">
            {displayProducts.map(product => (
              <div key={product.id} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm group">
                {/* Image Gallery */}
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                   <img
                    src={product.images[currentImgIdx[product.id] || 0]}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={product.name}
                  />
                  
                  {/* Badge */}
                  <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <Flame size={12} className="text-orange-400" /> {product.badge}
                  </div>

                  {/* Slider Controls */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                    {product.images.map((_: any, idx: number) => (
                      <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${ (currentImgIdx[product.id] || 0) === idx ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/50'}`}></div>
                    ))}
                  </div>

                  {product.images.length > 1 && (
                      <button 
                        onClick={() => nextImg(product.id, product.images.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                      >
                        <ChevronRight size={20} />
                      </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold text-slate-900 leading-tight w-2/3">{product.name}</h2>
                    <div className="text-right">
                      {product.oldPrice > product.price && (
                          <div className="text-xs text-slate-400 line-through font-medium">{product.oldPrice} DA</div>
                      )}
                      <div className="text-xl font-black" style={{ color: accentColor }}>{product.price} DA</div>
                    </div>
                  </div>

                  <p className="text-slate-500 text-sm leading-relaxed">{product.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {product.features.map((f: string) => (
                      <span key={f} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md italic"># {f}</span>
                    ))}
                  </div>

                  <button 
                    onClick={() => { setSelectedProduct(product); setIsCheckoutOpen(true); }}
                    className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    اطلب الآن
                    <ArrowRight size={18} />
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    +45 توصيل هذا الصباح في الجزائر
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Social Proof Section */}
          {(showSocialProof || canManage) && (
          <section className="px-6 py-10 bg-slate-900 text-white rounded-t-[40px] mt-10 relative" data-edit-path="social-proof">
            {canManage && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                    <button
                        onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'needdz_show_social', value: !showSocialProof }, '*')}
                        className="flex items-center gap-1 font-bold"
                    >
                        {showSocialProof ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                    </button>
                </div>
            )}
            {showSocialProof && (
            <>
            <h3 className="text-xl font-bold mb-6">آراء عملائنا (DZ)</h3>
            <div className="space-y-6">
              {[
                { name: "Ahmed B.", city: "Oran", comment: "Qualité top, arrived in 2 days to Oran via Yalidine.", rating: 5 },
                { name: "Sara L.", city: "Alger", comment: "Service client très sérieux. Je recommande.", rating: 5 }
              ].map((rev, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-sm">{rev.name} <span className="text-emerald-400 ml-1">• {rev.city}</span></span>
                    <div className="flex gap-0.5 text-yellow-400">
                      {[...Array(rev.rating)].map((_, j) => <Star key={j} size={10} fill="currentColor" />)}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 italic">"{rev.comment}"</p>
                </div>
              ))}
            </div>
            </>
            )}
            {canManage && !showSocialProof && (
                <div className="text-center py-4 text-white/50 text-xs">⭐ Social proof hidden</div>
            )}
          </section>
          )}
        </main>

        {/* Improved Checkout Drawer */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm p-0">
            <div className="w-full max-w-[480px] bg-white rounded-t-[40px] p-8 animate-slide-up relative max-h-[90vh] overflow-y-auto [scrollbar-hide::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              <button 
                onClick={() => { setIsCheckoutOpen(false); setOrderStatus('idle'); }}
                className="absolute top-6 right-8 text-slate-400 hover:text-black transition-colors"
              >
                <X size={28} />
              </button>

              {orderStatus === 'success' ? (
                <div className="py-16 text-center space-y-6">
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle2 size={56} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black">مبروك!</h2>
                    <p className="text-slate-500 mt-2 px-6">تم تسجيل طلبك. سنتصل بك على <span className="font-bold text-slate-900">رقم هاتفك</span> للتأكيد.</p>
                  </div>
                  <button 
                    onClick={() => setIsCheckoutOpen(false)}
                    className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl"
                  >
                    العودة للمتجر
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                    <img src={selectedProduct?.images[0]} className="w-20 h-20 rounded-2xl object-cover border border-slate-100" alt="" />
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedProduct?.name}</h4>
                      <p className="font-black" style={{ color: accentColor }}>{selectedProduct?.price} DA</p>
                    </div>
                  </div>

                  <form className="space-y-5" onSubmit={handleOrder}>
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">الاسم واللقب</label>
                        <input required name="name" type="text" placeholder="مثال: محمد علامي" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm focus:ring-2 ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">رقم الهاتف (إلزامي)</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input required name="phone" type="tel" placeholder="05 / 06 / 07 XX XX XX XX" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-5 text-sm focus:ring-2 ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">الولاية</label>
                          <select name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 text-sm font-medium outline-none">
                            <option value="">اختر...</option>
                            {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">البلدية</label>
                          <input required name="commune" type="text" placeholder="المدينة" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl flex items-start gap-3 border border-emerald-100">
                      <Truck className="text-emerald-600 mt-0.5" size={18} />
                      <div className="flex-1">
                        {selectedWilayaId ? (
                          <p className="text-[11px] text-emerald-800 leading-relaxed font-medium flex justify-between items-center">
                            <span>سعر التوصيل:</span>
                            <span className="font-black text-sm">{deliveryFee} دج</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                            الدفع عند الاستلام بعد التحقق من المنتج.
                          </p>
                        )}
                      </div>
                    </div>

                    <button 
                      disabled={orderStatus === 'loading'}
                      className="w-full text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                      style={{ backgroundColor: accentColor }}
                    >
                      {orderStatus === 'loading' ? (
                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>تأكيد الطلب <ArrowRight size={20} /></>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky Call Action for Mobile - Highly Effective in DZ */}
        <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
           <a href={`tel:${settings?.store_phone || "0555555555"}`} className="flex-1 bg-slate-900 text-white font-black rounded-2xl py-4 flex items-center justify-center gap-3 shadow-2xl">
            <Phone size={20} fill="white" />
            APPEL DIRECT
          </a>
          <div className="w-14 h-14 text-white rounded-2xl flex items-center justify-center shadow-2xl animate-pulse" style={{ backgroundColor: accentColor }}>
            <ShoppingBag size={24} />
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
