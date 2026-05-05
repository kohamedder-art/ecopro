import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  PhoneCall, 
  Star, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  X,
  Plus,
  ArrowRight,
  Package,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { TemplateProps } from '../types';

import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

export default function NovaDzTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#f97316';
  const [imgIdx, setImgIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;
  
  // Section visibility toggles
  const showFeatures = settings?.nova_show_features !== false;
  const showTrust = settings?.nova_show_trust !== false;

  const [quantity, setQuantity] = useState(1);

  const mainProduct = (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id)) : null) || products?.[0] || {
    id: 1,
    title: "Veste Premium Tech-Wear v2",
    price: 6800,
    original_price: 8500,
    images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=1200"]
  };

  const images = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1539533377285-b9dfb0ee4cbe?auto=format&fit=crop&q=80&w=1200"
  ];

  const orderRef = useRef<HTMLDivElement>(null);

  const scrollToOrder = () => {
    orderRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      const fd = new FormData(e.currentTarget);
      const name = fd.get('name') as string;
      const phone = fd.get('phone') as string;
      const commune = fd.get('commune') as string;
      
      if (!name || !phone || !selectedWilayaId || !mainProduct) {
          alert('الرجاء تعبئة جميع الحقول المطلوبة');
          return;
      }

      try {
          setIsSubmitting(true);
          const address = `${selectedWilaya?.labelAR || ''} - ${commune}`;

          const res = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  store_slug: storeSlug,
                  product_id: mainProduct.id,
                  quantity: quantity,
                  total_price: mainProduct.price * quantity,
                  delivery_fee: deliveryFee,
                  delivery_type: 'desk', 
                  customer_name: name,
                  customer_phone: phone,
                  customer_address: address
              })
          });

          const data = await res.json();
          if (res.ok) {
              setOrderSuccess(true);
          } else {
              alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
          }
      } catch (err: any) {
          console.error('Order error', err);
          alert('حدث خطأ أثناء إرسال الطلب');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
      const text = e.currentTarget.textContent || '';
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
  };

  return (
    <div className="min-h-screen text-[#1a1a1a] font-sans selection:bg-orange-200" style={{ backgroundColor: settings?.template_bg_color || '#f8f9fa' }} dir="rtl">
      
      {/* Top Banner - Urgency */}
      <div className="text-white py-2 px-4 text-center text-sm font-bold animate-pulse" style={{ backgroundColor: accentColor }}>
        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_top_banner')}>
            {settings?.nova_top_banner || "🔥 عرض خاص: توصيل مجاني على الجزائر العاصمة اليوم!"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {settings?.store_logo ? (
            <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: accentColor + '4d' }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: accentColor }}>
              {(settings?.store_name || 'م').charAt(0)}
            </div>
          )}
          <span className="text-lg font-black tracking-tighter" style={{ color: accentColor }}>{settings?.store_name || "متجري"}</span>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={scrollToOrder}
                className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold hover:scale-105 transition-transform"
            >
                اطلب الآن
            </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Product Showcase */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Image Gallery */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group relative">
            <div className="aspect-[4/5] relative">
                <img 
                    src={images[imgIdx]} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={mainProduct.title}
                />
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-black shadow-lg">
                    -{Math.round((1 - (mainProduct.price / (Number(mainProduct.original_price) || mainProduct.price + 1000))) * 100)}% PROMO
                </div>
            </div>
            
            <div className="flex p-4 gap-3 bg-gray-50/50 overflow-x-auto">
              {images.map((img: string, i: number) => (
                <button 
                  key={i} 
                  onClick={() => setImgIdx(i)}
                  className={`flex-shrink-0 w-20 h-20 rounded-xl border-2 overflow-hidden transition-all ${i === imgIdx ? 'scale-105 shadow-md' : 'border-transparent opacity-60'}`}
                  style={i === imgIdx ? { borderColor: accentColor } : undefined}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details - Copywriting focused */}
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-slate-900" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_product_name')}>
                {settings?.nova_product_name || mainProduct.title}
            </h1>
            <div className="flex items-center gap-4">
                <span className="text-4xl font-black" style={{ color: accentColor }}>{mainProduct.price} DA</span>
                <span className="text-xl text-gray-400 line-through font-medium">{mainProduct.original_price || (mainProduct.price + 2000)} DA</span>
            </div>
            
            <p className="text-xl text-gray-600 leading-relaxed italic border-l-4 pl-4" style={{ borderColor: accentColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_product_desc')}>
                {settings?.nova_product_desc || "La meilleure qualité sur le marché. Tissu imperméable, design moderne et confort absolu."}
            </p>

            {(showFeatures || canManage) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative" data-edit-path="feature-cards">
                {canManage && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                        <button
                            onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'nova_show_features', value: !showFeatures }, '*')}
                            className="flex items-center gap-1 font-bold"
                        >
                            {showFeatures ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                        </button>
                    </div>
                )}
                {showFeatures && (
                <>
                {[
                    settings?.nova_feat_1 || "Tissu Imperméable",
                    settings?.nova_feat_2 || "Garantie 12 Mois",
                    settings?.nova_feat_3 || "Style Moderne",
                    settings?.nova_feat_4 || "الدفع عند الاستلام"
                ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <CheckCircle2 className="text-green-500" size={20} />
                        <span className="font-bold text-gray-700" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`nova_feat_${i+1}`)}>
                            {f}
                        </span>
                    </div>
                ))}
                </>
                )}
                {canManage && !showFeatures && (
                    <span className="text-gray-400 text-xs">✨ Features hidden</span>
                )}
            </div>
            )}
          </div>

          {/* Trust Sections */}
          {(showTrust || canManage) && (
          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-8 space-y-6 relative" data-edit-path="trust-section">
            {canManage && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                    <button
                        onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'nova_show_trust', value: !showTrust }, '*')}
                        className="flex items-center gap-1 font-bold"
                    >
                        {showTrust ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                    </button>
                </div>
            )}
            {showTrust && (
            <>
             <h3 className="text-xl font-bold flex items-center gap-2 text-blue-900">
                <Truck size={24}/> 
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_title')}>
                    {settings?.nova_trust_title || "Pourquoi nous choisir ?"}
                </span>
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-blue-600"><Clock /></div>
                    <p className="text-sm font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_1')}>{settings?.nova_trust_1 || "توصيل سريع"}</p>
                </div>
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-blue-600"><ShieldCheck /></div>
                    <p className="text-sm font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_2')}>{settings?.nova_trust_2 || "الدفع عند الاستلام"}</p>
                </div>
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-blue-600"><PhoneCall /></div>
                    <p className="text-sm font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_3')}>{settings?.nova_trust_3 || "Support 7j/7"}</p>
                </div>
             </div>
            </>
            )}
            {canManage && !showTrust && (
                <span className="text-gray-400 text-xs">🛡️ Trust section hidden</span>
            )}
          </div>
          )}
        </div>

        {/* Right Column: Sticky Order Form */}
        <div className="lg:col-span-5">
          <div ref={orderRef} className="sticky top-24 bg-white rounded-[2.5rem] shadow-2xl border-4 overflow-hidden" style={{ borderColor: accentColor, boxShadow: `0 25px 50px -12px ${accentColor}1a` }}>
            <div className="p-6 text-white text-center" style={{ backgroundColor: accentColor }}>
                <h2 className="text-2xl font-black uppercase tracking-wider italic" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_form_title')}>
                    {settings?.nova_form_title || "اطلب الآن"}
                </h2>
                <p className="text-orange-100 text-sm font-medium" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_form_subtitle')}>
                    {settings?.nova_form_subtitle || "Remplissez le formulaire ci-dessous"}
                </p>
            </div>

            <div className="p-8">
              {orderSuccess ? (
                <div className="py-12 text-center space-y-6 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={48} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black">تم استلام طلبك!</h3>
                        <p className="text-gray-500 mt-2">سنتصل بك لتأكيد الطلب.</p>
                    </div>
                </div>
              ) : (
                <form onSubmit={handleOrder} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700">الاسم الكامل</label>
                        <input 
                            required
                            name="name"
                            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-lg"
                            placeholder="مثال: محمد علامي"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700">رقم الهاتف</label>
                        <input 
                            required
                            name="phone"
                            type="tel"
                            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-lg"
                            placeholder="05 50 12 34 56"
                            dir="ltr"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700">الولاية</label>
                            <select 
                                required
                                name="wilaya"
                                value={selectedWilayaId ?? ''}
                                onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
                                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl transition-all outline-none font-bold appearance-none cursor-pointer"
                            >
                                <option value="">اختر...</option>
                                {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700">الكمية</label>
                            <div className="flex items-center bg-gray-50 rounded-2xl overflow-hidden border-2 border-transparent">
                                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-4 hover:bg-gray-200 transition-colors">-</button>
                                <span className="flex-1 text-center font-black">{quantity}</span>
                                <button type="button" onClick={() => setQuantity(quantity + 1)} className="p-4 hover:bg-gray-200 transition-colors">+</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700">Commune / Adresse (العنوان)</label>
                        <input 
                            required
                            name="commune"
                            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl transition-all outline-none font-bold"
                            placeholder="Votre adresse exacte"
                        />
                    </div>

                    {selectedWilayaId && (
                        <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="text-orange-600" size={18} />
                                <span className="text-sm font-bold text-gray-700">سعر التوصيل:</span>
                            </div>
                            <span className="text-lg font-black text-orange-600">{deliveryFee} دج</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-6 text-white rounded-[1.5rem] font-black text-2xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: accentColor, boxShadow: `0 10px 30px -10px ${accentColor}80` }}
                    >
                        {isSubmitting ? (
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_btn_text')}>
                                    {settings?.nova_btn_text || "ACHETER MAINTENANT"}
                                </span>
                                <ArrowRight />
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs font-bold text-gray-400 mt-4 flex items-center justify-center gap-2">
                        <ShieldCheck size={14}/> Vos données sont protégées
                    </p>
                </form>
              )}
            </div>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/77/Yalidine_logo.png" className="h-8 grayscale opacity-50 hover:grayscale-0 transition-all cursor-pointer" alt="Yalidine" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            <div className="h-8 w-[1px] bg-gray-200"></div>
            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">الدفع نقداً</span>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
          <button 
            onClick={scrollToOrder}
            className="w-full py-4 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            اطلب الآن - {mainProduct.price * quantity} DA
          </button>
      </div>
      
      {/* Spacer for mobile CTA */}
      <div className="lg:hidden h-24"></div>
    </div>
  );
}
