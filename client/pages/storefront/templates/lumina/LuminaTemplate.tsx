import React, { useState, useRef } from 'react';
import {
  ShoppingCart, Truck, ShieldCheck, Star,
  ChevronDown, Phone, ArrowDownCircle, Settings, X
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';

export default function LuminaTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const deliveryFee = selectedWilaya?.homePrice ?? 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [commune, setCommune] = useState('');

  // Main product
  const mainProduct = (settings?.dzp_main_product_id
    ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id))
    : null) || products?.[0] || {
    id: 0,
    title: 'منتج مميز',
    price: 3900,
    original_price: 6500,
    images: [],
  };

  const productPrice = mainProduct?.price ?? 3900;
  const originalPrice = (mainProduct as any)?.original_price ?? null;
  const productImages = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [];

  // Theme from editor settings
  const accentColor = settings?.template_accent_color || '#e11d48'; // rose-600
  const primaryBg = settings?.primary_color || '#0f172a'; // slate-900

  // Editable text fields (contentEditable for editor mode)
  const storeName = settings?.lumina_store_name || settings?.store_name || 'LUMINA';
  const tagline = settings?.lumina_tagline || 'EAU DE PARFUM';
  const announcement = settings?.lumina_announcement || settings?.template_hero_heading || 'توصيل مجاني للطلبات أكثر من حبتين!';
  const offerText = settings?.lumina_offer_text || '🔥 تخفيض لفترة محدودة 🔥';
  const ctaText = settings?.lumina_cta_text || settings?.template_button_text || 'أطلب الآن وادفع لاحقاً';
  const formTitle = settings?.lumina_form_title || 'أدخل معلوماتك للطلب';
  const formSubtitle = settings?.lumina_form_subtitle || 'لن تدفع شيئاً حتى تستلم منتجك';
  const submitText = settings?.lumina_submit_text || 'تأكيد الطلب';

  // Smart image classification: prefers tall images for landing strips
  const { getSlotImages } = useImageClassifier(productImages, 'lumina');
  const classifiedLanding = getSlotImages('landing');

  // Landing images (extra images from settings, stacked vertically)
  const landingImages: string[] = (() => {
    if (settings?.lumina_landing_images && Array.isArray(settings.lumina_landing_images) && settings.lumina_landing_images.length > 0) {
      return settings.lumina_landing_images;
    }
    // Use classified images (tall first) or fall back to all product images
    return classifiedLanding.length > 0 ? classifiedLanding : productImages;
  })();

  // Features
  const features = [
    { icon: <Star size={28} className="text-amber-400" />, title: settings?.lumina_feat1_title || 'مكونات فاخرة', desc: settings?.lumina_feat1_desc || 'مزيج ساحر من العود الملكي والفانيليا الدافئة.' },
    { icon: <Truck size={28} className="text-emerald-400" />, title: settings?.lumina_feat2_title || 'ثبات يدوم طويلاً', desc: settings?.lumina_feat2_desc || 'تركيز عالي يضمن لك بقاء العطر على ملابسك.' },
  ];

  const totalCost = (productPrice * quantity) + deliveryFee;
  const currency = settings?.currency_code || 'د.ج';

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    }
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !selectedWilayaId || !mainProduct?.id) {
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
          quantity,
          total_price: productPrice * quantity,
          delivery_fee: deliveryFee,
          delivery_type: 'desk',
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOrderSuccess(true);
      } else {
        alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
    } catch {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <ShoppingCart size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-slate-500 text-sm mb-6">سنتصل بك قريباً لتأكيد الطلب</p>
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-right">
            <div className="flex justify-between"><span className="text-slate-500">المنتج:</span><span className="font-bold">{mainProduct?.title}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الكمية:</span><span className="font-bold">{quantity}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المبلغ:</span><span className="font-bold">{totalCost} {currency}</span></div>
          </div>
          <button onClick={() => setOrderSuccess(false)} className="mt-6 w-full py-3 rounded-xl font-bold text-white" style={{ backgroundColor: primaryBg }}>
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-800" style={{ backgroundColor: settings?.template_bg_color || '#f8fafc' }} dir="rtl">

      {/* ANNOUNCEMENT BAR */}
      <div className="text-white text-center py-2.5 text-sm font-bold flex justify-center items-center gap-2" style={{ backgroundColor: accentColor }}>
        <Truck size={16} />
        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_announcement')}>
          {announcement}
        </span>
      </div>

      <div className="max-w-md mx-auto bg-white shadow-2xl min-h-screen relative pb-24 overflow-hidden">

        {/* HEADER */}
        <header className="py-6 text-center text-white relative z-10" style={{ backgroundColor: primaryBg }}>
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-2 border-2 border-white/20" />}
          <h1 className="text-4xl font-black tracking-wider" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_store_name')}>
            {storeName}
          </h1>
          <p className="text-white/80 text-sm mt-1 font-light tracking-widest" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_tagline')}>
            {tagline}
          </p>
        </header>

        {/* DYNAMIC IMAGE STACK */}
        {landingImages.length > 0 && (
          <div className="w-full flex flex-col">
            {landingImages.map((imgUrl, index) => (
              <img
                key={index}
                src={imgUrl}
                alt={`Product section ${index + 1}`}
                className="w-full h-auto object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
        )}

        {/* Fallback if no images */}
        {landingImages.length === 0 && (
          <div className="w-full aspect-square bg-slate-100 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">أضف صور المنتج من لوحة التحكم</p>
            </div>
          </div>
        )}

        {/* PRICE & CTA BLOCK */}
        <div className="p-6 text-center bg-slate-50 border-y border-slate-200">
          {originalPrice && originalPrice > productPrice && (
            <p className="text-slate-500 line-through text-lg">{originalPrice} {currency}</p>
          )}
          <div className="flex justify-center items-end gap-2 mb-2">
            <span className="text-5xl font-black" style={{ color: accentColor }}>{productPrice}</span>
            <span className="text-xl font-bold text-slate-900 mb-1">{currency}</span>
          </div>
          <p className="text-sm font-bold py-2 rounded-lg mt-3" style={{ color: accentColor, backgroundColor: accentColor + '15' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_offer_text')}>
            {offerText}
          </p>

          <button
            onClick={scrollToForm}
            className="w-full mt-6 text-white text-xl font-bold py-4 rounded-2xl shadow-xl flex justify-center items-center gap-3 hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: primaryBg }}
          >
            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_cta_text')}>
              {ctaText}
            </span>
            <ArrowDownCircle size={24} className="animate-bounce" />
          </button>
        </div>

        {/* TRUST BADGES */}
        <div className="grid grid-cols-3 gap-2 p-4 text-white" style={{ backgroundColor: primaryBg }}>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <ShieldCheck size={28} className="text-amber-400" />
            <span className="text-[10px] font-bold">ضمان الجودة</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <ShoppingCart size={28} style={{ color: accentColor }} />
            <span className="text-[10px] font-bold">الدفع عند الاستلام</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <Truck size={28} className="text-emerald-400" />
            <span className="text-[10px] font-bold">توصيل لـ 58 ولاية</span>
          </div>
        </div>

        {/* FEATURES SECTION */}
        {features.length > 0 && (
          <div className="p-6 space-y-4">
            {features.map((feat, i) => (
              <div key={i} className="flex items-start gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: primaryBg }}>
                  {feat.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`lumina_feat${i + 1}_title`)}>
                    {feat.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`lumina_feat${i + 1}_desc`)}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHECKOUT FORM */}
        <div ref={formRef} className="p-6 bg-slate-100" id="checkout">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-slate-900" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_form_title')}>
                {formTitle}
              </h2>
              <p className="text-sm text-slate-500 mt-1" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_form_subtitle')}>
                {formSubtitle}
              </p>
            </div>

            <form onSubmit={handleOrder} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="الاسم واللقب..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 outline-none"
                  style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="05 55 55 55 55"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-right focus:ring-2 outline-none"
                    style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Phone size={18} className="absolute left-4 top-3.5 text-slate-400" />
                </div>
              </div>

              {/* Wilaya */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الولاية</label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 appearance-none focus:ring-2 outline-none"
                    style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    value={selectedWilayaId ?? ''}
                    onChange={(e) => setSelectedWilayaId(e.target.value ? Number(e.target.value) : null)}
                    required
                  >
                    <option value="">اختر الولاية...</option>
                    {wilayas.map((w) => (
                      <option key={w.id} value={w.id}>
                        {String(w.id).padStart(2, '0')} - {w.labelAR}
                        {w.homePrice ? ` (${w.homePrice} ${currency})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Commune */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">البلدية</label>
                <input
                  type="text"
                  required
                  placeholder="بلدية الإقامة..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 outline-none"
                  style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                />
              </div>

              {/* Quantity */}
              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">الكمية</label>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 bg-white rounded-lg shadow-sm font-bold text-xl text-slate-600">-</button>
                  <span className="font-bold text-lg text-slate-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 bg-white rounded-lg shadow-sm font-bold text-xl text-slate-600">+</button>
                </div>
              </div>

              {/* Receipt */}
              <div className="text-white rounded-2xl p-5 shadow-inner mt-6" style={{ backgroundColor: primaryBg }}>
                <div className="flex justify-between text-sm mb-2 text-white/70">
                  <span>سعر المنتج ({quantity}):</span>
                  <span dir="ltr">{productPrice * quantity} {currency}</span>
                </div>
                <div className="flex justify-between text-sm mb-4 text-white/70">
                  <span>سعر التوصيل:</span>
                  <span dir="ltr">{deliveryFee > 0 ? `${deliveryFee} ${currency}` : 'اختر الولاية'}</span>
                </div>
                <div className="h-px bg-white/20 w-full mb-4" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg text-white">المجموع:</span>
                  <div className="text-right">
                    <span className="text-2xl font-black block leading-none mb-1" dir="ltr">{totalCost}</span>
                    <span className="text-xs text-white/60">{currency}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 text-white text-xl font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
                style={{ background: `linear-gradient(to left, ${accentColor}, ${primaryBg})` }}
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShoppingCart size={24} />
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_submit_text')}>
                      {submitText}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-white/50 text-center p-8 pb-32" style={{ backgroundColor: primaryBg }}>
          <h3 className="text-2xl font-black text-white mb-4">{storeName}</h3>
          <p className="text-sm">علامة تجارية مسجلة. جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
        </footer>

        {/* STICKY BOTTOM BAR */}
        <div className="fixed bottom-0 left-0 w-full z-50 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200">
          <div className="max-w-md mx-auto flex items-center gap-4">
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-500 block">السعر الحالي</span>
              <span className="text-lg font-black leading-none" style={{ color: accentColor }}>
                {productPrice} {currency}
              </span>
            </div>
            <button
              onClick={scrollToForm}
              className="text-white px-8 py-3.5 rounded-xl font-bold text-lg shadow-xl flex items-center gap-2 active:scale-95 transition-all"
              style={{ backgroundColor: primaryBg }}
            >
              أطلب الآن <ShoppingCart size={20} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
