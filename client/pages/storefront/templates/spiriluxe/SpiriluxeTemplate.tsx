import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { Truck, Shield, Trash2, Plus, Home, Building2, ChevronDown, User, Phone, MapPin, ShoppingBag } from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';

export default function SpiriluxeTemplate({ 
  settings, 
  products, 
  canManage, 
  storeSlug, 
  primaryColor: propPrimaryColor, 
  onProductView, 
  initialProductSlug,
  navigate,
}: TemplateProps) {
  // ── Settings & State ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#ff6b35';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const rawBgImage = settings?.template_bg_image || '';
  const bgImageCss = rawBgImage
    ? (rawBgImage.startsWith('linear') || rawBgImage.startsWith('radial') || rawBgImage.startsWith('url(')
      ? rawBgImage
      : `url(${rawBgImage})`)
    : '';
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);
  const textColor = isDark ? '#f1f5f9' : '#1f2937';
  const textMuted = isDark ? '#94a3b8' : '#6b7280';
  const borderColor = isDark ? '#9ca3af' : '#94a3b8';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const surfaceMuted = isDark ? '#0f172a' : '#f9fafb';
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
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
  
  useEffect(() => { 
    if (wilayas.length > 0) { 
      const stillValid = wilayas.some(w => w.id === selectedWilayaId); 
      if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); 
    } 
  }, [wilayas]);

  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  const [videoFailed, setVideoFailed] = useState(false);
  // ─── Product Selection ───
  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug || String(p.id) === initialProductSlug) : null) || (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];

  useEffect(() => { if (mainProduct && onProductView) onProductView(mainProduct); }, [mainProduct?.id]);

  // ── Video (product metadata or store-level hero_video_url) ──
  const videoUrl = (mainProduct as any)?.metadata?.video_url || (settings as any)?.hero_video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  // ─── Offer & Variant System ───
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);

  // When product changes: reset images and offer
  useEffect(() => {
    if (!mainProduct?.id) return;
    const imgs = Array.isArray(mainProduct?.images) ? mainProduct.images.filter(Boolean) : [];
    setProductImages(imgs);
    setSelectedOffer(null);
  }, [mainProduct?.id]);

  // When saved aboveCount setting arrives: apply it without resetting images
  useEffect(() => {
    if (!mainProduct?.id) return;
    const localCount = (() => { try { const v = localStorage.getItem(`spiriluxe_above_count_${mainProduct.id}`); return v != null ? Number(v) : null; } catch { return null; } })();
    const savedCount = settings?.[`spiriluxe_above_count_${mainProduct.id}`];
    const count = localCount != null ? localCount : (savedCount != null ? Number(savedCount) : null);
    if (count != null && !isNaN(count)) {
      aboveCountRef.current = count;
      setAboveCount(count);
    }
  }, [mainProduct?.id]);
  

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
    
    const fd = new FormData(e.currentTarget);
    const phone = (fd.get('phone') as string || '').replace(/[^0-9]/g, '');
    if (!isValidAlgerianPhone(phone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      return;
    }
    setIsSubmitting(true);
    setOrderError(null);
    try {
      const payload = {
        store_slug: storeSlug || settings?.store_name || 'spiriluxe',
        product_id: mainProduct.id,
        ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        quantity: quantity,
        ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
        total_price: selectedOffer ? selectedOffer.bundle_price * quantity : (variantPrice ?? mainProduct.price ?? 0) * quantity,
        delivery_fee: deliveryFee,
        delivery_type: selectedDeliveryType,
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR || '', communeDisplayName(getAlgeriaCommuneById(customerCommune)!) || fd.get('commune') || customerCommune, fd.get('address')].filter(Boolean).join(' - '),
        customer_notes: customerNotes || fd.get('notes') || '',
        shipping_wilaya_id: selectedWilayaId,
        shipping_commune_id: Number(customerCommune) || undefined,
        product_name: mainProduct.title || mainProduct.name || '',
        ...getFraudData(),
      };
      
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        let errMsg: string;
        if (data.fields) {
          const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
          errMsg = (data.error || 'يرجى تصحيح البيانات') + '\n' + list;
        } else {
          errMsg = data.error || 'حدث خطأ أثناء تقديم الطلب.';
        }
        setOrderError(errMsg);
        setIsSubmitting(false);
        return;
      }
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setLastCustomerPhone(String(fd.get('phone') || ''));
      setOrderSuccess(true);
      trackAllPixels(PixelEvents.PURCHASE, {
        content_name: mainProduct?.title || mainProduct?.name || '',
        content_ids: mainProduct?.id ? [mainProduct.id] : [],
        content_type: 'product',
        value: productTotal,
        currency: settings?.currency_code || 'DZD',
        num_items: selectedOffer?.quantity || quantity,
        order_id: data?.order?.id || null,
      });
    } catch (error: any) {
      console.error('Order error:', error);
      if (!orderError) setOrderError('حدث خطأ في الاتصال. حاول مرة أخرى.');
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
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [`spiriluxe_above_count_${mainProduct.id}`]: count })
      });
    } catch (err) {
      console.error('Failed to save above count:', err);
    }
    // Also persist locally so it survives refresh immediately
    try {
      const key = `spiriluxe_above_count_${mainProduct.id}`;
      localStorage.setItem(key, String(count));
    } catch {}
  };

  // Upload image and append to product images
  const handleUpload = async (position: 'above' | 'below', file: File) => {
    if (!mainProduct?.id) return;
    const setUploading = position === 'above' ? setUploadingAbove : setUploadingBelow;
    setUploading(true);
    try {
      const result = await uploadImage(file);
      let nextImages: string[];
      if (position === 'above') {
        const currentAboveCount = aboveCount ?? productImages.length;
        const above = productImages.slice(0, currentAboveCount);
        const below = productImages.slice(currentAboveCount);
        nextImages = [...above, result.url, ...below];
        const newCount = currentAboveCount + 1;
        aboveCountRef.current = newCount;
        setAboveCount(newCount);
        await saveAboveCount(newCount);
      } else {
        nextImages = [...productImages, result.url];
        // If aboveCount was never set, lock it to current image count so the new image shows below
        if (aboveCount == null) {
          const newCount = productImages.length;
          aboveCountRef.current = newCount;
          setAboveCount(newCount);
          await saveAboveCount(newCount);
        }
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
            <img src={url} alt="" className="w-full block object-contain" loading={startIndex + i === 0 ? 'eager' : 'lazy'} fetchpriority={startIndex + i === 0 ? 'high' : 'low'} decoding="async" style={{ contentVisibility: 'auto' }} />
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
    <div className="min-h-screen" dir="rtl" style={{ backgroundColor: bgColor, backgroundImage: bgImageCss || undefined, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', color: textColor }}>
      <div className="max-w-3xl mx-auto">

        {/* Video Embed (above images) */}
        {videoEmbed && !videoFailed && (
          <div className="relative">
            {videoEmbed.type === 'youtube' ? (
              <div className="aspect-video w-full">
                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
              </div>
            ) : videoEmbed.type === 'video' ? (
              <div className="w-full overflow-hidden" style={{ maxHeight: '50vh' }}>
                <video className="w-full h-full object-cover block" src={videoEmbed.url} autoPlay muted loop playsInline preload="metadata" onError={() => setVideoFailed(true)} />
              </div>
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
        <div className="px-2 py-2">
          <div className="rounded-2xl shadow-sm px-4 py-5 relative" style={{ backgroundColor: cardBg }}>
            <div className="absolute -top-3 right-6 text-white px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: accentColor }}>
              أكمل البيانات للطلب
            </div>
            <h2 className="text-xl font-black text-center mb-5 mt-2" style={{ color: textColor }}>اطلب الآن</h2>
            
            {orderSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: accentColor + '15' }}>
                  <Shield className="w-8 h-8" style={{ color: accentColor }} />
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: accentColor }}>تم تسجيل طلبك بنجاح!</h3>
                <p className="mb-4 text-sm" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
                <OrderSuccessConnect 
                  storeSlug={storeSlug} 
                  accentColor={accentColor} 
                  orderId={lastOrderId || undefined} 
                  telegramStartUrl={lastTelegramUrl} 
                  customerPhone={lastCustomerPhone || undefined} 
                />
                <div className=" rounded-xl p-3 mb-4 space-y-2 text-sm" style={{ backgroundColor: surfaceMuted, border: `1px solid ${borderColor}` }}>
                  <div className="flex justify-between">
                    <span style={{ color: textMuted }}>{mainProduct?.title || 'المنتج'} × {selectedOffer?.quantity ?? quantity}</span>
                    <span className="font-bold">{Math.round(selectedOffer ? selectedOffer.bundle_price : (variantPrice ?? mainProduct?.price ?? 0) * (selectedOffer?.quantity ?? quantity)).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMuted }}>التوصيل</span>
                    <span className="font-bold">{deliveryFee === 0 ? 'مجاني' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                  </div>
                  <div className="h-px" style={{ backgroundColor: borderColor }} />
                  <div className="flex justify-between font-bold">
                    <span>المجموع</span>
                    <span style={{ color: accentColor }}>{Math.round(grandTotal).toLocaleString()} {currency}</span>
                  </div>
                </div>
                <button onClick={() => setOrderSuccess(false)} className="w-full py-3 rounded-xl font-bold text-sm" style={{ backgroundColor: accentColor, color: '#fff' }}>
                  تسوق مرة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="space-y-3">
                 {orderError && (
                  <div className="text-sm font-semibold rounded-xl px-4 py-3 whitespace-pre-line text-start" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
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
                    borderColor={borderColor}
                    bgColor={cardBg}
                  />
                )}

                {/* Name input with icon */}
                <div className="relative">
                  <input 
                    name="name" 
                    type="text" 
                    required 
                    className="w-full pl-4 pr-12 py-3.5 rounded-xl transition-all "
                    style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                    placeholder="الاسم الكامل"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                    <User size={20} />
                  </div>
                </div>

                {/* Phone input with icon */}
                <div className="relative">
                  <input 
                    name="phone" 
                    type="tel" 
                    required 
                    maxLength={10}
                    className="w-full pl-4 pr-12 py-3.5 rounded-xl transition-all "
                    style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                    placeholder="رقم الهاتف"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                    <Phone size={20} />
                  </div>
                </div>

                {/* Wilaya select with icon */}
                <div className="relative">
                  <select 
                    value={selectedWilayaId || ''} 
                    onChange={e => setSelectedWilayaId(Number(e.target.value))}
                    required
                    className="w-full pl-10 pr-12 py-3.5 rounded-xl transition-all appearance-none "
                    style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: selectedWilayaId ? textColor : textColor + '99' }}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = borderColor}
                  >
                    <option value="">اختر الولاية</option>
                    {wilayas.map(w => (
                      <option key={w.id} value={w.id}>{w.labelAR}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                    <MapPin size={20} />
                  </div>
                  <ChevronDown size={18} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textColor, opacity: 0.4 }} />
                </div>

                {showCommune && (
                  <div className="relative">
                    <select 
                      name="commune"
                      required 
                      disabled={!selectedWilayaId}
                      value={customerCommune}
                      onChange={e => setCustomerCommune(e.target.value)}
                      className="w-full pl-10 pr-12 py-3.5 rounded-xl transition-all appearance-none disabled:opacity-50 "
                      style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }}
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = borderColor}
                    >
                      <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                      {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                      <Building2 size={20} />
                    </div>
                    <ChevronDown size={18} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textColor, opacity: 0.4 }} />
                  </div>
                )}

                {showAddress && (
                  <div className="relative">
                    <input 
                      name="address" 
                      type="text" 
                      className="w-full pl-4 pr-12 py-3.5 rounded-xl transition-all"
                      style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }}
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = borderColor}
                      placeholder="عنوان التوصيل"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: accentColor }}>
                      <Building2 size={20} />
                    </div>
                  </div>
                )}

                {showNotes && (
                  <div>
                    <textarea 
                      name="notes" 
                      rows={2}
                      value={customerNotes}
                      onChange={e => setCustomerNotes(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl transition-all resize-none"
                      style={{ border: `1.5px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }}
                      onFocus={e => e.currentTarget.style.borderColor = accentColor}
                      onBlur={e => e.currentTarget.style.borderColor = borderColor}
                      placeholder="ملاحظات إضافية (اختياري)"
                    />
                  </div>
                )}

                {(showHomeDelivery || showDeskDelivery) && (
                  <div className="grid grid-cols-2 gap-2">
                    {showHomeDelivery && (
                      <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : cardBg, color: selectedDeliveryType === 'home' ? accentColor : textColor }}>
                        <Truck size={16} />
                        <span>توصيل للمنزل</span>
                      </button>
                    )}
                    {showDeskDelivery && (
                      <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : cardBg, color: selectedDeliveryType === 'desk' ? accentColor : textColor }}>
                        <Building2 size={16} />
                        <span>استلام من المكتب</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ backgroundColor: cardBg, border: `1.5px solid ${borderColor}` }}>
                  <span className="text-sm font-semibold" style={{ color: textColor }}>الكمية</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 rounded-full font-bold text-xl flex items-center justify-center transition-all" style={{ backgroundColor: surfaceMuted, color: accentColor }}>−</button>
                    <span className="font-bold text-lg min-w-[2rem] text-center" style={{ color: textColor }}>{String(quantity).padStart(2, '0')}</span>
                    <button type="button" onClick={() => setQuantity(Math.min((mainProduct?.stock_quantity != null && mainProduct.stock_quantity > 0) ? mainProduct.stock_quantity : 999, quantity + 1))} className="w-9 h-9 rounded-full font-bold text-xl flex items-center justify-center transition-all" style={{ backgroundColor: surfaceMuted, color: accentColor }}>+</button>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="p-3.5 rounded-xl text-sm space-y-2" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                  <div className="flex justify-between">
                    <span style={{ color: textMuted }}>سعر المنتج</span>
                    <span className="font-bold">{Math.round(productTotal).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: textMuted }}>اجمالى التوصيل</span>
                    {selectedWilayaId
                      ? <span className="font-bold" style={{ color: accentColor }}>{deliveryFee === 0 ? 'مجاني' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                      : <span className="font-bold" style={{ color: accentColor }}>{deliveryFee === 0 ? 'مجاني' : `${Math.round(deliveryFee).toLocaleString()} ${currency}`}</span>
                    }
                  </div>
                  <div className="flex justify-between pt-2 font-bold" style={{ borderTop: `1px solid ${borderColor}` }}>
                    <span>المجموع</span>
                    <span className="text-base" style={{ color: accentColor }}>{Math.round(selectedWilayaId ? grandTotal : productTotal).toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: String(accentColor), color: '#ffffff', boxShadow: `0 4px 14px ${accentColor}40` }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={20} />
                      <span>{(settings as any)?.order_button_text || 'تأكيد الشراء'}</span>
                    </>
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
