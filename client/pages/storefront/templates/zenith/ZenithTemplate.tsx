import React, { useState, useRef } from 'react';
import { ChevronDown, Phone, ShoppingCart, ShieldCheck } from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';

export default function ZenithTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#000000';
  const formRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

  // Main product
  const mainProduct = (settings?.dzp_main_product_id
    ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id))
    : null) || products?.[0];

  // Variant and Offer support
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Safe fallbacks after mainProduct declaration
  const safeProduct = mainProduct || { id: 0, title: 'منتج مميز', price: 3900, original_price: 6500, images: [], variants: [] };
  const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
  const productPrice = variantPrice ?? safeProduct.price ?? 3900;
  const productImages = safeProduct.images && safeProduct.images.length > 0 ? safeProduct.images : [];
  const currency = settings?.currency_code || 'د.ج';

  // Editable text fields
  const storeName = settings?.zenith_store_name || settings?.store_name || 'STORE';
  const ctaText = settings?.zenith_cta_text || settings?.template_button_text || 'اطلب الان';
  const formTitle = settings?.zenith_form_title || 'معلومات الطلب';
  const submitText = settings?.zenith_submit_text || 'تأكيد الطلب';

  // Smart image classification: prefers tall images for landing strips
  const { getSlotImages } = useImageClassifier(productImages, 'zenith');
  const classifiedLanding = getSlotImages('landing');

  // Landing images (stacked Canva slices)
  const landingImages: string[] = (() => {
    if (settings?.zenith_landing_images && Array.isArray(settings.zenith_landing_images) && settings.zenith_landing_images.length > 0) {
      return settings.zenith_landing_images;
    }
    return classifiedLanding.length > 0 ? classifiedLanding : productImages;
  })();

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : productPrice * quantity;
  const totalCost = productTotal + deliveryFee;

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
      const address = `${selectedWilaya?.labelAR || ''} - ${commune}${customerAddress ? ` - ${customerAddress}` : ''}`;

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity || quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: productTotal,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          customer_notes: customerNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastOrderId(data.order?.id || null);
        setLastTelegramUrl(data.telegramStartUrl || null);
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f3f4f6', fontFamily: "'Cairo', sans-serif" }} dir="rtl">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-xl text-center w-full">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <ShieldCheck size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-gray-500 text-sm mb-6">سنتصل بك قريباً لتأكيد الطلب</p>
          <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2 text-right mb-4">
            <div className="flex justify-between"><span className="text-gray-500">المنتج</span><span className="font-bold">{mainProduct.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">الكمية</span><span className="font-bold">{quantity}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">التوصيل</span><span className="font-bold">{deliveryFee} {currency}</span></div>
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex justify-between"><span className="font-black">المجموع</span><span className="font-black text-lg">{totalCost} {currency}</span></div>
          </div>
          <button onClick={() => setOrderSuccess(false)} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>
            تسوق مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-gray-900" style={{ backgroundColor: settings?.template_bg_color || '#f3f4f6' }} dir="rtl">

      {/* Mobile Container */}
      <div className={`${settings?.template_desktop_layout ? 'max-w-7xl mx-auto' : 'max-w-md mx-auto'} bg-white min-h-screen relative shadow-2xl`}>

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <div
              className="font-black text-xl tracking-wider text-black"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_store_name')}
            >
              {storeName}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left flex flex-col">
              <span className="text-xs text-gray-500 font-bold">السعر</span>
              <span className="font-black text-lg leading-none" dir="ltr">
                {productPrice} {currency}
              </span>
            </div>
            <button
              onClick={scrollToForm}
              className="text-white px-5 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: accentColor }}
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_cta_text')}
            >
              {ctaText}
            </button>
          </div>
        </div>

        {/* ── LONG IMAGE STACK ── */}
        <div className="w-full flex flex-col">
          {videoUrl && (
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-auto block"
              poster={landingImages[0]}
            />
          )}
          {landingImages.length > 0 ? (
            landingImages.map((imgUrl, index) => (
              <img
                key={index}
                src={imgUrl}
                alt={`Landing slice ${index + 1}`}
                className="w-full h-auto block"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))
          ) : (
            <div className="w-full aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 flex items-center justify-center">
              <p className="text-gray-500 text-sm">أضف صور المنتج من لوحة التحكم</p>
            </div>
          )}
        </div>
        
        {/* ── ORDER FORM ── */}
        <div ref={formRef} className="p-5 bg-gray-50 pb-24" id="checkout-form">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2
              className="text-xl font-black text-center mb-6"
              contentEditable={canManage}
              suppressContentEditableWarning
              onBlur={handleTextEdit('zenith_form_title')}
            >
              {formTitle}
            </h2>

            <form onSubmit={handleOrder} className="space-y-4">
              {/* Variants */}
              {safeProduct.variants && safeProduct.variants.length > 0 && (
                <VariantSelector 
                  variants={safeProduct.variants} 
                  selected={selectedVariant} 
                  onSelect={setSelectedVariant} 
                  accentColor={accentColor} 
                  currency={currency} 
                  basePrice={safeProduct.price} 
                />
              )}

              {/* Offers */}
              {offers.length > 0 && (
                <OfferSelector 
                  offers={offers} 
                  unitPrice={mainProduct?.price || 0} 
                  currency={currency} 
                  selectedOfferId={selectedOffer?.offer_id ?? null} 
                  onSelect={handleOfferSelect} 
                  accentColor={accentColor} 
                  textColor="#1e293b" 
                  borderColor="#e2e8f0" 
                  hidePrice={true}
                />
              )}

              {/* 2-Column: Name | Phone */}
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">الاسم واللقب</label>
                  <input
                    type="text"
                    required
                    placeholder="أدخل اسمك الكامل"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="05 55 55 55 55"
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-right text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* 2-Column: Wilaya | Commune */}
              <div className="grid grid-cols-2 gap-4">
                {/* Wilaya */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">الولاية</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm appearance-none focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
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
                    <ChevronDown size={18} className="absolute left-3 top-3.5 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Commune (when enabled) */}
                {showCommune && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">البلدية</label>
                    <input
                      type="text"
                      required
                      placeholder="أدخل بلديتك"
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Address (when enabled) */}
              {showAddress && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">العنوان</label>
                  <input
                    type="text"
                    placeholder="أدخل عنوانك"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              )}
              <div className="pt-2">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">الكمية</label>
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-md font-bold text-xl text-gray-600 active:bg-gray-100 flex items-center justify-center"
                  >-</button>
                  <span className="font-black text-lg">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-md font-bold text-xl text-gray-600 active:bg-gray-100 flex items-center justify-center"
                  >+</button>
                </div>
              </div>

              {/* Delivery Type Buttons */}
              {(showHomeDelivery || showDeskDelivery) && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع التوصيل</label>
                  <div className="grid grid-cols-2 gap-3">
                    {showHomeDelivery && (
                      <button
                        type="button"
                        onClick={() => setSelectedDeliveryType('home')}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: selectedDeliveryType === 'home' ? accentColor : '#e5e7eb',
                          backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : '#fff',
                          color: selectedDeliveryType === 'home' ? accentColor : '#374151',
                        }}
                      >
                        <span className="text-sm font-bold">التوصيل للمنزل</span>
                      </button>
                    )}
                    {showDeskDelivery && (
                      <button
                        type="button"
                        onClick={() => setSelectedDeliveryType('desk')}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: selectedDeliveryType === 'desk' ? accentColor : '#e5e7eb',
                          backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : '#fff',
                          color: selectedDeliveryType === 'desk' ? accentColor : '#374151',
                        }}
                      >
                        <span className="text-sm font-bold">الاستلام من المكتب</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Notes (when enabled) */}
              {showNotes && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                  <textarea
                    placeholder="ملاحظات إضافية"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-black focus:border-black outline-none transition-all text-sm"
                    rows={3}
                  />
                </div>
              )}

              {/* Order Summary */}
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>سعر المنتج ({quantity})</span>
                  <span className="font-bold" dir="ltr">{productPrice * quantity} {currency}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-3">
                  <span>سعر التوصيل</span>
                  <span className="font-bold" dir="ltr">{deliveryFee} {currency}</span>
                </div>
                <div className="h-px w-full bg-gray-200 mb-3" />
                <div className="flex justify-between items-center">
                  <span className="font-black text-lg">المجموع:</span>
                  <span className="font-black text-xl" dir="ltr">
                    {totalCost} {currency}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 text-white text-lg font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? 'جاري الإرسال...' : (
                  <>
                    <span
                      contentEditable={canManage}
                      suppressContentEditableWarning
                      onBlur={handleTextEdit('zenith_submit_text')}
                    >{submitText}</span>
                    <ShoppingCart size={20} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1 mt-3 text-xs text-gray-500 font-bold">
                <ShieldCheck size={14} className="text-green-600" />
                الدفع يكون بعد استلام المنتج
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
