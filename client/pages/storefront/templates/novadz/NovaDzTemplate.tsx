import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Clock
} from 'lucide-react';
import { TemplateProps } from '../types';

import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function NovaDzTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  // ── Color wiring: 4 color pickers ──
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#f97316';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const primaryColor = settings?.primary_color || '#1a1a1a';
  const headerColor = settings?.iyco_header_color || '#ffffff';

  // ── Dark / light detection ──
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);

  const isHeaderDark = useMemo(() => {
    const hex = headerColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [headerColor]);

  const isLight = !isDark;

  // ── Derived page-level colors ──
  const textColor = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const surfaceMuted = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

  // ── Derived surface-level colors (cards, nav, form) ──
  const surfaceColor = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const surfaceTextColor = isDark ? '#f1f5f9' : '#1a1a1a';
  const surfaceTextMuted = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)';
  const surfaceBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // ── Input colors ──
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb';
  const inputFocusBg = isDark ? 'rgba(255,255,255,0.10)' : '#ffffff';

  const [imgIdx, setImgIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;
  
  const [quantity, setQuantity] = useState(1);
  const currency = settings?.currency_code || 'د.ج';

  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null) || (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id)) : null) || products?.[0] || {
    id: 1,
    title: "Veste Premium Tech-Wear v2",
    price: 6800,
    original_price: 8500,
    images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=1200"]
  };

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  useEffect(() => { setImgIdx(0); setShowVideo(!!videoEmbed); }, [mainProduct?.id]);

  const images = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1539533377285-b9dfb0ee4cbe?auto=format&fit=crop&q=80&w=1200"
  ];

  useEffect(() => { if (mainProduct?.id && onProductView) onProductView(mainProduct as any); }, [mainProduct?.id]);

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); setQuantity(f.quantity); } }, [offers]);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); if (o) setQuantity(o.quantity); else setQuantity(1); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);
  const productTotal = selectedOffer ? selectedOffer.bundle_price : ((selectedVariant?.price ?? mainProduct?.price ?? 0) * quantity);
  const grandTotal = productTotal + deliveryFee;

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
          const address = [selectedWilaya?.labelAR || '', commune, fd.get('address'), fd.get('notes')].filter(Boolean).join(' - ');

          const res = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  store_slug: storeSlug,
                  product_id: mainProduct.id,
                  ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                  quantity,
                  ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                  total_price: selectedOffer ? selectedOffer.bundle_price : mainProduct.price * quantity,
                  delivery_fee: deliveryFee,
                  delivery_type: selectedDeliveryType, 
                  customer_name: name,
                  customer_phone: phone,
                  customer_address: address,
                  shipping_wilaya_id: selectedWilayaId,
              })
          });

          const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setLastCustomerPhone(phone);
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

  // ── Focus/blur handlers for inputs ──
  const inputFocusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = accentColor;
    e.currentTarget.style.backgroundColor = inputFocusBg;
  };
  const inputBlurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'transparent';
    e.currentTarget.style.backgroundColor = inputBg;
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor, ['--selection-bg' as any]: accentColor + '33' }} dir="rtl">
      
      {/* Top Banner - Urgency */}
      <div className="text-white py-2 px-4 text-center text-sm font-bold animate-pulse" style={{ backgroundColor: accentColor }}>
        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_top_banner')}>
            {settings?.nova_top_banner || "🔥 عرض خاص: توصيل مجاني على الجزائر العاصمة اليوم!"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md px-4 py-3 flex justify-between items-center" style={{ backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.80)', borderBottom: `1px solid ${surfaceBorderColor}` }}>
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
                className="text-white px-5 py-2 rounded-full text-sm font-bold hover:scale-105 transition-transform"
                style={{ backgroundColor: accentColor }}
            >
                اطلب الآن
            </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Product Showcase */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Image Gallery */}
          <div className="rounded-2xl overflow-hidden shadow-sm group relative" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
            <div className="aspect-square relative cursor-pointer select-none"
              onTouchStart={e => { (e.currentTarget as any)._tsx = e.touches[0].clientX; }}
              onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => {
                const startX = (e.currentTarget as any)._tsx;
                if (startX == null) return;
                const diff = startX - e.changedTouches[0].clientX;
                (e.currentTarget as any)._tsx = null;
                if (videoEmbed && showVideo) return;
                if (Math.abs(diff) < 40) { setZoomState({ images: images, idx: imgIdx }); return; }
                setImgIdx(i => diff > 0 ? Math.min(i + 1, images.length - 1) : Math.max(i - 1, 0));
              }}
              onClick={e => { if (!(e.target as HTMLElement).closest('button') && !(videoEmbed && showVideo)) setZoomState({ images: images, idx: imgIdx }); }}
            >
              {showVideo && videoEmbed ? (
                <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
              ) : (
                <>
                  <img
                    src={images[imgIdx]}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    alt={mainProduct.title}
                  />
                  <div className="text-white px-3 py-1 rounded-full text-sm font-black shadow-lg absolute top-4 left-4" style={{ backgroundColor: accentColor }}>
                    -{Math.round((1 - (mainProduct.price / (Number(mainProduct.original_price) || mainProduct.price + 1000))) * 100)}% PROMO
                  </div>
                  {images.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_: string, i: number) => (
                        <div key={i} className="rounded-full transition-all" style={{ width: i === imgIdx ? 16 : 6, height: 6, backgroundColor: i === imgIdx ? accentColor : 'rgba(255,255,255,0.6)' }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex p-2 gap-2 overflow-x-auto" style={{ backgroundColor: surfaceMuted }}>
              {videoEmbed && (
                <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden flex items-center justify-center" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
              )}
              {images.map((img: string, i: number) => (
                <button 
                  key={i} 
                  onClick={e => { e.stopPropagation(); setShowVideo(false); setImgIdx(i); }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${!showVideo && i === imgIdx ? 'scale-105 shadow-md' : 'border-transparent opacity-60'}`}
                  style={!showVideo && i === imgIdx ? { borderColor: accentColor } : undefined}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details - Copywriting focused */}
          <div className="space-y-3">
            <h1 className="text-2xl lg:text-3xl font-black leading-tight" style={{ color: textColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_product_name')}>
                {settings?.nova_product_name || settings?.template_hero_heading || mainProduct.title}
            </h1>
            <div className="flex items-center gap-4">
                <span className="text-2xl font-black" style={{ color: accentColor }}>{Math.round(mainProduct.price).toLocaleString()} DA</span>
                <span className="text-sm line-through font-medium" style={{ color: textMuted }}>{Math.round(mainProduct.original_price || (mainProduct.price + 2000)).toLocaleString()} DA</span>
            </div>
            
            <p className="text-sm leading-relaxed italic border-l-4 pl-3" style={{ color: surfaceTextMuted, borderColor: accentColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_product_desc')}>
                {settings?.nova_product_desc || settings?.template_hero_subtitle || settings?.store_description || "جودة عالية وتصميم عصري."}
            </p>

            {settings?.nova_show_features !== false && (
            <div className="grid grid-cols-2 gap-2">
                {[
                    settings?.nova_feat_1 || "Tissu Imperméable",
                    settings?.nova_feat_2 || "Garantie 12 Mois",
                    settings?.nova_feat_3 || "Style Moderne",
                    settings?.nova_feat_4 || "الدفع عند الاستلام"
                ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl shadow-sm" style={{ backgroundColor: surfaceColor, border: `1px solid ${surfaceBorderColor}` }}>
                        <CheckCircle2 style={{ color: accentColor }} size={20} />
                        <span className="font-bold" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`nova_feat_${i+1}`)}>
                            {f}
                        </span>
                    </div>
                ))}
            </div>
            )}
          </div>

          {/* Trust Sections */}
          {settings?.nova_show_trust !== false && (
          <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: accentColor + '10', border: `1px solid ${accentColor}20` }}>
             <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: textColor }}>
                <Truck size={24} style={{ color: accentColor }}/> 
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_title')}>
                    {settings?.nova_trust_title || "Pourquoi nous choisir ?"}
                </span>
             </h3>
             <div className="grid grid-cols-3 gap-3">
                <div className="text-center space-y-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto shadow-sm" style={{ backgroundColor: surfaceColor, color: accentColor }}><Clock size={14} /></div>
                    <p className="text-sm font-bold" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_1')}>{settings?.nova_trust_1 || "توصيل سريع"}</p>
                </div>
                <div className="text-center space-y-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto shadow-sm" style={{ backgroundColor: surfaceColor, color: accentColor }}><ShieldCheck size={14} /></div>
                    <p className="text-xs font-bold" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_2')}>{settings?.nova_trust_2 || "الدفع عند الاستلام"}</p>
                </div>
                <div className="text-center space-y-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto shadow-sm" style={{ backgroundColor: surfaceColor, color: accentColor }}><PhoneCall size={14} /></div>
                    <p className="text-xs font-bold" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_trust_3')}>{settings?.nova_trust_3 || "Support 7j/7"}</p>
                </div>
             </div>
          </div>
          )}
        </div>

        {/* Right Column: Sticky Order Form */}
        <div className="lg:col-span-5">
          <div ref={orderRef} className="sticky top-14 rounded-2xl shadow-lg border-2 overflow-hidden" style={{ backgroundColor: surfaceColor, borderColor: accentColor, boxShadow: `0 25px 50px -12px ${accentColor}1a` }}>
            <div className="p-3 text-white text-center" style={{ backgroundColor: accentColor }}>
                <h2 className="text-sm font-black uppercase tracking-wider" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_form_title')}>
                    {settings?.nova_form_title || "اطلب الآن"}
                </h2>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_form_subtitle')}>
                    {settings?.nova_form_subtitle || "Remplissez le formulaire ci-dessous"}
                </p>
            </div>

            <div className="p-4">
              {orderSuccess ? (
                <div className="py-6 text-center space-y-3 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: accentColor + '1a', color: accentColor }}>
                        <CheckCircle2 size={48} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black" style={{ color: textColor }}>تم استلام طلبك!</h3>
                        <p className="mt-2" style={{ color: textMuted }}>سنتصل بك لتأكيد الطلب.</p>
                        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
                    </div>
                </div>
              ) : (
                <form onSubmit={handleOrder} className="space-y-2.5">
                    {(mainProduct as any)?.variants && (mainProduct as any).variants.length > 0 && (
                      <VariantSelector
                        variants={(mainProduct as any).variants}
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
                        onSelect={handleOfferSelect}
                        accentColor={accentColor}
                        textColor={surfaceTextColor}
                        borderColor={surfaceBorderColor}
                      />
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>الاسم الكامل</label>
                        <input 
                            required
                            name="name"
                            className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold text-sm"
                            style={{ backgroundColor: inputBg, color: surfaceTextColor }}
                            placeholder="مثال: محمد علامي"
                            onFocus={inputFocusHandler}
                            onBlur={inputBlurHandler}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>رقم الهاتف</label>
                        <input 
                            required
                            name="phone"
                            type="tel"
                            className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold text-sm"
                            style={{ backgroundColor: inputBg, color: surfaceTextColor }}
                            placeholder="05 50 12 34 56"
                            dir="ltr"
                            onFocus={inputFocusHandler}
                            onBlur={inputBlurHandler}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>الولاية</label>
                            <select 
                                required
                                name="wilaya"
                                value={selectedWilayaId ?? ''}
                                onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
                                className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold appearance-none cursor-pointer text-sm"
                                style={{ backgroundColor: inputBg, color: surfaceTextColor }}
                                onFocus={inputFocusHandler as any}
                                onBlur={inputBlurHandler as any}
                            >
                                <option value="">اختر...</option>
                                {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>الكمية</label>
                            <div className="flex items-center rounded-xl overflow-hidden border-2 border-transparent" style={{ backgroundColor: inputBg }}>
                                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2.5 transition-colors" style={{ color: surfaceTextColor }} onMouseEnter={e => e.currentTarget.style.backgroundColor = surfaceMuted} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>-</button>
                                <span className="flex-1 text-center font-black" style={{ color: surfaceTextColor }}>{quantity}</span>
                                <button type="button" onClick={() => setQuantity(quantity + 1)} className="p-2.5 transition-colors" style={{ color: surfaceTextColor }} onMouseEnter={e => e.currentTarget.style.backgroundColor = surfaceMuted} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>+</button>
                            </div>
                        </div>
                    </div>

                    {(showHomeDelivery && showDeskDelivery) && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>نوع التوصيل</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDeliveryType('home')}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                                    style={{
                                        backgroundColor: selectedDeliveryType === 'home' ? accentColor : inputBg,
                                        color: selectedDeliveryType === 'home' ? '#ffffff' : surfaceTextColor,
                                    }}
                                >
                                    التوصيل للمنزل
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDeliveryType('desk')}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                                    style={{
                                        backgroundColor: selectedDeliveryType === 'desk' ? accentColor : inputBg,
                                        color: selectedDeliveryType === 'desk' ? '#ffffff' : surfaceTextColor,
                                    }}
                                >
                                    الاستلام من المكتب
                                </button>
                            </div>
                        </div>
                    )}

                    {showCommune && <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>البلدية</label>
                        <input 
                            name="commune"
                            className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold text-sm"
                            style={{ backgroundColor: inputBg, color: surfaceTextColor }}
                            placeholder="Votre adresse exacte"
                            onFocus={inputFocusHandler}
                            onBlur={inputBlurHandler}
                        />
                    </div>}
                    {showAddress && <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>العنوان</label>
                        <input name="address" className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold text-sm" style={{ backgroundColor: inputBg, color: surfaceTextColor }} placeholder="عنوان التوصيل" onFocus={inputFocusHandler} onBlur={inputBlurHandler} />
                    </div>}
                    {showNotes && <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: surfaceTextMuted }}>ملاحظات</label>
                        <textarea name="notes" rows={2} className="w-full p-2.5 border-2 border-transparent rounded-xl transition-all outline-none font-bold resize-none text-sm" style={{ backgroundColor: inputBg, color: surfaceTextColor }} placeholder="ملاحظات إضافية" />
                    </div>}

                    {selectedWilayaId && (
                        <div className="p-4 rounded-2xl border-2 space-y-2 text-sm" style={{ backgroundColor: accentColor + '0d', borderColor: accentColor + '20' }}>
                            <div className="flex justify-between" style={{ color: surfaceTextMuted }}>
                                <span>سعر المنتجات</span>
                                <span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(productTotal ?? 0).toLocaleString()} دج</span>
                            </div>
                            <div className="flex justify-between" style={{ color: surfaceTextMuted }}>
                                <span>سعر التوصيل</span>
                                <span className="font-bold" style={{ color: accentColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} دج</span>
                            </div>
                            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${accentColor}30` }}>
                                <span className="font-bold" style={{ color: surfaceTextColor }}>التكلفة الإجمالية</span>
                                <span className="font-black text-base" style={{ color: accentColor }}>{Math.round(grandTotal ?? 0).toLocaleString()} دج</span>
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 text-white rounded-xl font-black text-base hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: accentColor, boxShadow: `0 10px 30px -10px ${accentColor}80` }}
                    >
                        {isSubmitting ? (
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('nova_btn_text')}>
                                    {settings?.nova_btn_text || settings?.template_button_text || "اطلب الآن"}
                                </span>
                                <ArrowRight />
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs font-bold mt-4 flex items-center justify-center gap-2" style={{ color: textMuted }}>
                        <ShieldCheck size={14}/> Vos données sont protégées
                    </p>
                </form>
              )}
            </div>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/77/Yalidine_logo.png" className="h-8 grayscale opacity-50 hover:grayscale-0 transition-all cursor-pointer" alt="Yalidine" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            <div className="h-8 w-[1px]" style={{ backgroundColor: borderColor }}></div>
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: textMuted }}>الدفع نقداً</span>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 z-50" style={{ backgroundColor: surfaceColor, borderTop: `1px solid ${surfaceBorderColor}` }}>
          <button 
            onClick={scrollToOrder}
            className="w-full py-4 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            اطلب الآن - {Math.round(mainProduct.price * quantity).toLocaleString()} DA
          </button>
      </div>
      
      {/* Spacer for mobile CTA */}
      <div className="lg:hidden h-24"></div>

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${surfaceBorderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setZoomState(null); }}>
            <X size={20} />
          </button>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded-2xl" />
          </div>
          {images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pb-6 pt-2 overflow-x-auto justify-center" onClick={(e) => e.stopPropagation()}>
              {images.map((img: string, i: number) => (
                <button key={i} onClick={() => setZoomState({ ...zoomState, idx: i })} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${i === zoomState.idx ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
