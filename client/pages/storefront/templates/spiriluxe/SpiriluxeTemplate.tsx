import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TemplateProps, StoreProduct } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { X, Upload, Image, Video, Play, Truck, Shield, Plus, Trash2 } from 'lucide-react';
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
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(settings?.show_promotional_banner !== false);

  // ── Content Areas State (Above/Below Form) ──
  const [aboveContent, setAboveContent] = useState(settings?.spiriluxe_above_content || []);
  const [belowContent, setBelowContent] = useState(settings?.spiriluxe_below_content || []);

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
  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null) || (settings?.spiriluxe_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.spiriluxe_main_product_id)) : null) || products?.[0];

  // ─── Offer & Variant System ───
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);

  // Load content from settings on mount
  useEffect(() => {
    if (settings) {
      try {
        // Try template_settings first, then regular settings
        const templateSettings = settings.template_settings || {};
        const aboveContentData = templateSettings.spiriluxe_above_content || settings.spiriluxe_above_content;
        const belowContentData = templateSettings.spiriluxe_below_content || settings.spiriluxe_below_content;
        
        if (aboveContentData && typeof aboveContentData === 'string') {
          setAboveContent(JSON.parse(aboveContentData));
        }
        if (belowContentData && typeof belowContentData === 'string') {
          setBelowContent(JSON.parse(belowContentData));
        }
      } catch (error) {
        console.error('Error loading content from settings:', error);
      }
    }
  }, [settings]);
  
  useEffect(() => { 
    if (offers.length > 0 && !selectedOffer) { 
      const f = offers[0]; 
      setSelectedOffer({ 
        offer_id: f.id, 
        quantity: f.quantity, 
        bundle_price: f.bundle_price, 
        free_delivery: f.free_delivery 
      }); 
    } 
  }, [offers]);

  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);
  const productTotal = selectedOffer ? selectedOffer.bundle_price : (selectedVariant?.price ?? mainProduct?.price ?? 0);
  const grandTotal = productTotal + deliveryFee;

  // ─── Order Handling ───
  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mainProduct) return;
    
    setIsSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        store_slug: storeSlug || settings?.store_name || 'spiriluxe',
        product_id: mainProduct.id,
        ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        quantity: selectedOffer?.quantity || 1,
        ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
        total_price: selectedOffer ? selectedOffer.bundle_price : (mainProduct.price || 0),
        delivery_fee: deliveryFee,
        delivery_type: selectedDeliveryType,
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR || '', fd.get('commune'), fd.get('address'), fd.get('notes')].filter(Boolean).join(' - '),
        shipping_wilaya_id: selectedWilayaId,
      };
      
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Order error');
      const data = await res.json();
      setOrderSuccess(true);
      setLastOrderId(data.order_id);
      setLastTelegramUrl(data.telegram_start_url);
      setLastCustomerPhone(data.customer_phone);
    } catch (error) {
      console.error('Order error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Content Management ───
  const fileInputRefs = {
    aboveImage: useRef<HTMLInputElement>(null),
    aboveVideo: useRef<HTMLInputElement>(null),
    belowImage: useRef<HTMLInputElement>(null),
    belowVideo: useRef<HTMLInputElement>(null),
  };

  const addContentAbove = (type: 'image' | 'video') => {
    const newContent = { id: Date.now(), type, url: '', caption: '', uploading: false };
    setAboveContent([...aboveContent, newContent]);
  };

  const addContentBelow = (type: 'image' | 'video') => {
    const newContent = { id: Date.now(), type, url: '', caption: '', uploading: false };
    setBelowContent([...belowContent, newContent]);
  };

  const removeContentAbove = (id: number) => {
    setAboveContent(aboveContent.filter(item => item.id !== id));
  };

  const removeContentBelow = (id: number) => {
    setBelowContent(belowContent.filter(item => item.id !== id));
  };

  const updateContentAbove = (id: number, updates: any) => {
    setAboveContent(aboveContent.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const updateContentBelow = (id: number, updates: any) => {
    setBelowContent(belowContent.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleFileUpload = async (type: 'above' | 'below', contentType: 'image' | 'video', file: File) => {
    try {
      // Create temporary uploading state item
      const tempId = Date.now();
      const tempContent = { id: tempId, type: contentType, url: '', caption: '', uploading: true, fileName: file.name };
      
      // Add temporary uploading item
      const addFn = type === 'above' ? setAboveContent : setBelowContent;
      const currentContent = type === 'above' ? aboveContent : belowContent;
      addFn([...currentContent, tempContent]);

      // Upload the file
      const result = await uploadImage(file);
      
      // Update the temporary item with the uploaded URL and remove uploading state
      const updateFn = type === 'above' ? updateContentAbove : updateContentBelow;
      updateFn(tempId, { 
        url: result.url, 
        uploading: false,
        type: contentType,
        fileName: file.name
      });

      // Save to settings for persistence
      const updatedContent = type === 'above' ? aboveContent : belowContent;
      const settingKey = type === 'above' ? 'spiriluxe_above_content' : 'spiriluxe_below_content';
      
      if (canManage) {
        // Save to store settings using template_settings
        try {
          await fetch('/api/client/store/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              template_settings: {
                [settingKey]: JSON.stringify(updatedContent)
              }
            })
          });
        } catch (saveError) {
          console.error('Failed to save content to settings:', saveError);
        }
      }

    } catch (error) {
      console.error('Upload failed:', error);
      // Remove the temporary item on error
      const removeFn = type === 'above' ? setAboveContent : setBelowContent;
      const currentContent = type === 'above' ? aboveContent : belowContent;
      removeFn(currentContent.filter(item => !item.uploading));
    }
  };

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  // ─── Text Edit Handler ───
  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!canManage) return;
    const text = e.currentTarget.innerText || e.currentTarget.textContent || '';
    console.log(`Saving ${key}:`, text);
  };

  // ─── Render Content Section ───
  const renderContentSection = (content: any[], isAbove: boolean) => {
    // Only show items that have URLs or are currently uploading
    const visibleContent = content.filter(item => item.url || item.uploading);
    
    return (
      <div className="space-y-4 mb-8">
        {visibleContent.map((item) => (
          <div key={item.id} className="relative group">
            {item.uploading ? (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Uploading...</p>
                </div>
              </div>
            ) : item.type === 'image' ? (
              <div className="relative">
                <img 
                  src={item.url} 
                  alt={item.caption || 'Content image'}
                  className="w-full rounded-lg shadow-sm"
                />
                {item.caption && (
                  <p className="mt-2 text-sm text-gray-600 text-center">{item.caption}</p>
                )}
              </div>
            ) : (
              <div className="relative">
                <video 
                  src={item.url} 
                  controls 
                  className="w-full rounded-lg shadow-sm"
                  poster=""
                />
                {item.caption && (
                  <p className="mt-2 text-sm text-gray-600 text-center">{item.caption}</p>
                )}
              </div>
            )}
            
            {canManage && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    isAbove ? removeContentAbove(item.id) : removeContentBelow(item.id);
                  }}
                  className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                  title="Remove content"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {canManage && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                const ref = isAbove ? fileInputRefs.aboveImage : fileInputRefs.belowImage;
                triggerFileInput(ref);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              <Image className="w-4 h-4" />
              Add Image
            </button>
            <button
              onClick={() => {
                const ref = isAbove ? fileInputRefs.aboveVideo : fileInputRefs.belowVideo;
                triggerFileInput(ref);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              <Plus className="w-4 h-4" />
              <Video className="w-4 h-4" />
              Add Video
            </button>
          </div>
        )}
        
        {/* Hidden file inputs */}
        {canManage && (
          <>
            <input
              ref={fileInputRefs.aboveImage}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload('above', 'image', file);
                }
              }}
              className="hidden"
            />
            <input
              ref={fileInputRefs.aboveVideo}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload('above', 'video', file);
                }
              }}
              className="hidden"
            />
            <input
              ref={fileInputRefs.belowImage}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload('below', 'image', file);
                }
              }}
              className="hidden"
            />
            <input
              ref={fileInputRefs.belowVideo}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload('below', 'video', file);
                }
              }}
              className="hidden"
            />
          </>
        )}
      </div>
    );
  };

  // ─── Render ───
  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="max-w-md mx-auto">
        {/* Content Above Form */}
        {renderContentSection(aboveContent, true)}

        {/* Order Form - Center */}
        <div className="px-6 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                <span className="text-2xl">🛒</span>
              </div>
              <h3 className="text-xl font-bold mb-2">أكمل طلبك</h3>
              <p className="text-sm opacity-70">املأ بياناتك وسنقوم بمعالجة طلبك فوراً</p>
            </div>
            
            {orderSuccess ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-green-600">تم الطلب بنجاح! 🎉</h3>
                <p className="text-gray-600 mb-4">شكراً لطلبك! سنتصل بك خلال 24 ساعة لتأكيد تفاصيل التوصيل.</p>
                <OrderSuccessConnect 
                  storeSlug={storeSlug} 
                  accentColor={accentColor} 
                  orderId={lastOrderId || undefined} 
                  telegramStartUrl={lastTelegramUrl} 
                  customerPhone={lastCustomerPhone || undefined} 
                />
              </div>
            ) : (
              <form onSubmit={handleOrder} className="space-y-5">
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
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="أدخل بلديتك"
                    />
                  </div>
                )}

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
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                      placeholder="أي طلبات خاصة أو ملاحظات (اختياري)"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold mb-3">طريقة التوصيل *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer hover:border-purple-500 transition-all" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : '#e5e7eb' }}>
                      <input 
                        type="radio" 
                        name="delivery_type" 
                        value="home" 
                        checked={selectedDeliveryType === 'home'}
                        onChange={() => setSelectedDeliveryType('home')}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <Truck className="w-6 h-6 mx-auto mb-1" style={{ color: selectedDeliveryType === 'home' ? accentColor : '#6b7280' }} />
                        <span className="text-sm font-medium">توصيل للمنزل</span>
                      </div>
                    </label>
                    <label className="flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer hover:border-purple-500 transition-all" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : '#e5e7eb' }}>
                      <input 
                        type="radio" 
                        name="delivery_type" 
                        value="desk" 
                        checked={selectedDeliveryType === 'desk'}
                        onChange={() => setSelectedDeliveryType('desk')}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <span className="text-xl mb-1 block" style={{ color: selectedDeliveryType === 'desk' ? accentColor : '#6b7280' }}>🏢</span>
                        <span className="text-sm font-medium">استلام من المكتب</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">سعر المنتج:</span>
                      <span className="font-semibold">{Math.round(productTotal).toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">رسوم التوصيل:</span>
                      <span className="font-semibold">{Math.round(deliveryFee).toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-bold">الإجمالي:</span>
                      <span className="text-xl font-bold" style={{ color: accentColor }}>{Math.round(grandTotal).toLocaleString()} {currency}</span>
                    </div>
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

        {/* Content Below Form */}
        {renderContentSection(belowContent, false)}
      </div>
    </div>
  );

  function handleOfferSelect(offerId: string) {
    const offer = offers.find(o => String(o.id) === String(offerId));
    if (offer) {
      setSelectedOffer({
        offer_id: offer.id,
        quantity: offer.quantity,
        bundle_price: offer.bundle_price,
        free_delivery: offer.free_delivery
      });
    }
  }
}
