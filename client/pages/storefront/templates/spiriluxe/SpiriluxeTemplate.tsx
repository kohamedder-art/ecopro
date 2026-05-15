import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { Truck, Shield, Trash2, Plus, Home, Building2 } from 'lucide-react';
import { uploadImage } from '@/lib/api';

export default function SpiriluxeTemplate({ 
  settings, 
  products, 
  canManage, 
  storeSlug, 
  primaryColor: propPrimaryColor, 
  onProductView, 
  initialProductSlug 
}: TemplateProps) {
  // ── Settings & State ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#8b5cf6';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const textColor = settings?.template_text_color || '#1f2937';
  const currency = settings?.currency_code || 'د.ج';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(settings?.show_promotional_banner !== false);
  const [quantity, setQuantity] = useState(1);
  const [customerCommune, setCustomerCommune] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // ── Product Images State ──
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingAbove, setUploadingAbove] = useState(false);
  const [uploadingBelow, setUploadingBelow] = useState(false);
  // aboveCount tracks how many images show above form vs below
  const [aboveCount, setAboveCount] = useState<number | null>(null);
  const aboveCountRef = useRef<number | null>(null);

  // ── Delivery & Order State ──
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  
  useEffect(() => { 
    if (wilayas.length > 0) { 
      const stillValid = wilayas.some(w => w.id === selectedWilayaId); 
      if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); 
    } 
  }, [wilayas]);

  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  // ─── Product Selection ───
  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null) || (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];

  useEffect(() => { if (mainProduct && onProductView) onProductView(mainProduct); }, [mainProduct?.id]);

  // ── Video ──
  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  // ─── Offer & Variant System ───
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);

  // When product changes: reset images and offer
  useEffect(() => {
    if (!mainProduct?.id) return;
    const imgs = Array.isArray(mainProduct?.images) ? mainProduct.images.filter(Boolean) : [];
    setProductImages(imgs);
    setSelectedOffer(null);
    // Default to all above until settings load
    aboveCountRef.current = imgs.length;
    setAboveCount(imgs.length);
  }, [mainProduct?.id]);

  // When saved aboveCount setting arrives (async): apply it without resetting images
  useEffect(() => {
    if (!mainProduct?.id) return;
    const savedCount = settings?.[`spiriluxe_above_count_${mainProduct.id}`];
    if (savedCount != null) {
      const count = Number(savedCount);
      aboveCountRef.current = count;
      setAboveCount(count);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.[`spiriluxe_above_count_${mainProduct?.id}`]]);
  

  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);
  // bundle_price is the fixed total for one instance of the offer.
  // Multiply by quantity so user can order e.g. 4× offer1.
  const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
  const productTotal = selectedOffer
    ? selectedOffer.bundle_price * quantity
    : (variantPrice ?? mainProduct?.price ?? 0) * quantity;
  const grandTotal = productTotal + deliveryFee;

  // ─── Order Handling ───
  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mainProduct) return;
    
    setIsSubmitting(true);
    setOrderError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        store_slug: storeSlug || settings?.store_name || 'spiriluxe',
        product_id: mainProduct.id,
        ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        quantity: selectedOffer?.quantity || quantity,
        ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
        total_price: selectedOffer ? selectedOffer.bundle_price * quantity : (variantPrice ?? mainProduct.price ?? 0) * quantity,
        delivery_fee: deliveryFee,
        delivery_type: selectedDeliveryType,
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR || '', fd.get('commune') || customerCommune, fd.get('address')].filter(Boolean).join(' - '),
        customer_notes: customerNotes || fd.get('notes') || '',
        shipping_wilaya_id: selectedWilayaId,
      };
      
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'حدث خطأ أثناء تقديم الطلب.');
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setLastCustomerPhone(String(fd.get('phone') || ''));
      setOrderSuccess(true);
    } catch (error: any) {
      console.error('Order error:', error);
      setOrderError(error?.message || 'حدث خطأ أثناء تقديم الطلب. يرجى المحاولة مجدداً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Image refs ───
  const fileInputAboveRef = useRef<HTMLInputElement>(null);
  const fileInputBelowRef = useRef<HTMLInputElement>(null);

  // Save images array to product
  const saveProductImages = async (images: string[]) => {
    if (!canManage || !mainProduct?.id) return;
    try {
      await fetch(`/api/client/store/products/${mainProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ images })
      });
    } catch (err) {
      console.error('Failed to save product images:', err);
    }
  };

  // Save aboveCount split to settings
  const saveAboveCount = async (count: number) => {
    if (!canManage || !mainProduct?.id) return;
    try {
      await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [`spiriluxe_above_count_${mainProduct.id}`]: count })
      });
    } catch (err) {
      console.error('Failed to save above count:', err);
    }
  };

  // Upload image and append to product images
  const handleUpload = async (position: 'above' | 'below', file: File) => {
    if (!mainProduct?.id) return;
    const setUploading = position === 'above' ? setUploadingAbove : setUploadingBelow;
    setUploading(true);
    try {
      const result = await uploadImage(file);
      const currentAboveCount = aboveCount ?? productImages.length;
      let nextImages: string[];
      if (position === 'above') {
        // Insert at end of above section
        const above = productImages.slice(0, currentAboveCount);
        const below = productImages.slice(currentAboveCount);
        nextImages = [...above, result.url, ...below];
        setAboveCount(currentAboveCount + 1);
      } else {
        nextImages = [...productImages, result.url];
      }
      setProductImages(nextImages);
      await saveProductImages(nextImages);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  // Remove image from product by index
  const handleRemoveImage = async (index: number) => {
    const currentAboveCount = aboveCount ?? productImages.length;
    const nextImages = productImages.filter((_, i) => i !== index);
    // Adjust aboveCount if removing an above image
    if (index < currentAboveCount) {
      const newCount = Math.max(0, currentAboveCount - 1);
      setAboveCount(newCount);
      await saveAboveCount(newCount);
    }
    setProductImages(nextImages);
    await saveProductImages(nextImages);
  };

  // Move image one position up or down in the array
  const handleMoveImage = async (globalIndex: number, direction: 'up' | 'down') => {
    const current = aboveCountRef.current ?? aboveCount ?? productImages.length;
    const imgs = [...productImages];
    const swapWith = direction === 'up' ? globalIndex - 1 : globalIndex + 1;

    // Special case: last above-image moves ↓ into below (no swap needed, just shift boundary)
    if (direction === 'down' && globalIndex === current - 1) {
      const newCount = current - 1;
      aboveCountRef.current = newCount;
      setAboveCount(newCount);
      await saveAboveCount(newCount);
      return;
    }

    // Special case: first below-image moves ↑ into above (no swap needed, just shift boundary)
    if (direction === 'up' && globalIndex === current) {
      const newCount = current + 1;
      aboveCountRef.current = newCount;
      setAboveCount(newCount);
      await saveAboveCount(newCount);
      return;
    }

    // Normal case: swap within same section
    if (swapWith < 0 || swapWith >= imgs.length) return;
    [imgs[globalIndex], imgs[swapWith]] = [imgs[swapWith], imgs[globalIndex]];
    setProductImages(imgs);
    await saveProductImages(imgs);
  };

  // Render a list of image items with delete/move buttons
  const renderImages = (images: string[], startIndex: number, position: 'above' | 'below') => (
    <div className="space-y-0">
      {images.map((url, i) => {
        const globalIndex = startIndex + i;
        return (
          <div key={url + globalIndex} className="relative group">
            <img src={url} alt="" className="w-full block" loading="lazy" />
            {canManage && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                {/* Show ↑ if not first image, OR if it's the first below-image (can cross into above) */}
                {(globalIndex > 0 || (position === 'below' && globalIndex === (aboveCount ?? productImages.length))) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveImage(globalIndex, 'up'); }}
                    className="p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 text-xs font-bold"
                    title="Move up"
                  >↑</button>
                )}
                {/* Show ↓ if not last image, OR if it's the last above-image (can cross into below) */}
                {(globalIndex < productImages.length - 1 || (position === 'above' && globalIndex === (aboveCount ?? productImages.length) - 1)) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMoveImage(globalIndex, 'down'); }}
                    className="p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 text-xs font-bold"
                    title="Move down"
                  >↓</button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(globalIndex); }}
                  className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                  title="Remove"
                ><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const currentAboveCount = aboveCount ?? productImages.length;
  const aboveImages = productImages.slice(0, currentAboveCount);
  const belowImages = productImages.slice(currentAboveCount);

  // ─── Render ───
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="max-w-md mx-auto">

        {/* Video Embed (above images) */}
        {videoEmbed && (
          <div className="relative">
            {videoEmbed.type === 'youtube' ? (
              <div className="aspect-video w-full">
                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
              </div>
            ) : videoEmbed.type === 'video' ? (
              <video className="w-full block" src={videoEmbed.url} autoPlay muted loop playsInline />
            ) : (
              <div className="aspect-video w-full">
                <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
              </div>
            )}
          </div>
        )}

        {/* Images Above Form */}
        {aboveImages.length > 0 && renderImages(aboveImages, 0, 'above')}

        {/* Upload above button - editor only */}
        {canManage && (
          <div className="flex justify-center gap-2 py-2">
            <button
              onClick={() => fileInputAboveRef.current?.click()}
              disabled={uploadingAbove}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              {uploadingAbove ? 'Uploading...' : 'Add Image Above'}
            </button>
            <button
              onClick={() => fileInputBelowRef.current?.click()}
              disabled={uploadingBelow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              {uploadingBelow ? 'Uploading...' : 'Add Image Below'}
            </button>
          </div>
        )}
        <input ref={fileInputAboveRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('above', f); e.target.value=''; }} />
        <input ref={fileInputBelowRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('below', f); e.target.value=''; }} />

        {/* Order Form */}
        <div className="px-6 py-4">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            
            {orderSuccess ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-green-600">تم تسجيل طلبك بنجاح! 🎉</h3>
                <p className="text-gray-600 mb-4">سنتصل بك قريباً لتأكيد الطلب</p>
                <OrderSuccessConnect 
                  storeSlug={storeSlug} 
                  accentColor={accentColor} 
                  orderId={lastOrderId || undefined} 
                  telegramStartUrl={lastTelegramUrl} 
                  customerPhone={lastCustomerPhone || undefined} 
                />
                <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: '#f9fafb' }}>
                  <div className="flex justify-between text-sm">
                    <span>{mainProduct?.title || 'المنتج'} × {quantity}</span>
                    <span className="font-bold">{Math.round(productTotal).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">التوصيل</span>
                    <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                  </div>
                  <div className="h-px bg-gray-200 my-1" />
                  <div className="flex justify-between font-black">
                    <span>المجموع</span>
                    <span className="text-base" style={{ color: accentColor }}>{Math.round(grandTotal).toLocaleString()} {currency}</span>
                  </div>
                </div>
                <button onClick={() => setOrderSuccess(false)} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>
                  تسوق مرة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="space-y-5">
                {orderError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
                    {orderError}
                  </div>
                )}
                {mainProduct?.variants && mainProduct.variants.length > 0 && (
                  <VariantSelector
                    variants={mainProduct.variants}
                    selected={selectedVariant}
                    onSelect={setSelectedVariant}
                    accentColor={accentColor}
                    currency={currency}
                    basePrice={mainProduct.price}
                  />
                )}
                {offers.length > 0 && (
                  <OfferSelector
                    offers={offers}
                    unitPrice={mainProduct?.price || 0}
                    currency={currency}
                    selectedOfferId={selectedOffer?.offer_id ?? null}
                    onSelect={(o) => setSelectedOffer(o)}
                    accentColor={accentColor}
                    textColor={textColor}
                    borderColor="#e5e7eb"
                    
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">الاسم الكامل *</label>
                    <input 
                      name="name" 
                      type="text" 
                      required 
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="أدخل اسمك الكامل"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">رقم الهاتف *</label>
                    <input 
                      name="phone" 
                      type="tel" 
                      required 
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="رقم الواتساب الخاص بك"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">ولاية التوصيل *</label>
                    <select 
                      value={selectedWilayaId || ''} 
                      onChange={e => setSelectedWilayaId(Number(e.target.value))}
                      required
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="">اختر ولايتك</option>
                      {wilayas.map(w => (
                        <option key={w.id} value={w.id}>{w.labelAR}</option>
                      ))}
                    </select>
                  </div>
                  {showCommune && (
                    <div>
                      <label className="block text-sm font-semibold mb-2">البلدية</label>
                      <input 
                        name="commune" 
                        type="text" 
                        value={customerCommune}
                        onChange={e => setCustomerCommune(e.target.value)}
                        className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        placeholder="أدخل بلديتك"
                      />
                    </div>
                  )}
                </div>

                {showAddress && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">عنوان التوصيل</label>
                    <input 
                      name="address" 
                      type="text" 
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="عنوان الشارع، المبنى، إلخ"
                    />
                  </div>
                )}

                {showNotes && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">ملاحظات إضافية</label>
                    <textarea 
                      name="notes" 
                      rows={3}
                      value={customerNotes}
                      onChange={e => setCustomerNotes(e.target.value)}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                      placeholder="أي طلبات خاصة أو ملاحظات (اختياري)"
                    />
                  </div>
                )}

                {/* Quantity */}
                <div className="pt-2">
                  <label className="block text-sm font-semibold mb-2">الكمية</label>
                  <div className="flex items-center justify-between bg-gray-50 border-2 border-gray-200 rounded-xl p-1">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 bg-white border border-gray-200 rounded-lg font-bold text-xl text-gray-600 active:bg-gray-100 flex items-center justify-center">−</button>
                    <span className="font-black text-lg">{quantity}</span>
                    <button type="button" onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 bg-white border border-gray-200 rounded-lg font-bold text-xl text-gray-600 active:bg-gray-100 flex items-center justify-center">+</button>
                  </div>
                </div>

                {(showHomeDelivery || showDeskDelivery) && (
                  <div>
                    <label className="block text-sm font-semibold mb-3">طريقة التوصيل *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {showHomeDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : '#fff', color: selectedDeliveryType === 'home' ? accentColor : '#374151' }}>
                          <Truck size={16} />
                          <span>توصيل للمنزل</span>
                        </button>
                      )}
                      {showDeskDelivery && (
                        <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : '#e5e7eb', backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : '#fff', color: selectedDeliveryType === 'desk' ? accentColor : '#374151' }}>
                          <Building2 size={16} />
                          <span>استلام من المكتب</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Summary — always visible */}
                <div className="p-3 rounded-xl text-sm space-y-2" style={{ backgroundColor: accentColor + '10', border: `1px solid ${accentColor}30` }}>
                  <div className="flex justify-between">
                    <span className="text-gray-500">سعر المنتجات</span>
                    <span className="font-bold">{Math.round(productTotal).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">سعر التوصيل</span>
                    {selectedWilayaId
                      ? <span className="font-bold" style={{ color: accentColor }}>{deliveryFee === 0 ? 'مجاني ✅' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                      : <span className="text-gray-400 text-xs">يُحدد عند اختيار الولاية</span>
                    }
                  </div>
                  <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${accentColor}40` }}>
                    <span className="font-bold">التكلفة الإجمالية</span>
                    <span className="font-black text-base" style={{ color: accentColor }}>{Math.round(selectedWilayaId ? grandTotal : productTotal).toLocaleString()} {currency}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-lg"
                  style={{ backgroundColor: String(accentColor), color: '#ffffff' }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      جاري المعالجة...
                    </span>
                  ) : (
                    'أكمل الطلب 🚀'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Images Below Form */}
        {belowImages.length > 0 && renderImages(belowImages, currentAboveCount, 'below')}


        {/* Platform Link */}
        <div className="text-center py-6">
          <a 
            href="https://sahla4eco.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm opacity-50 hover:opacity-100 transition-opacity"
          >
            made by sahla4eco
          </a>
        </div>
      </div>
    </div>
  );

}
