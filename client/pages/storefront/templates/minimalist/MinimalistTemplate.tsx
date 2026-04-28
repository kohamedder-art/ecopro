import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import { 
  ShoppingBag, 
  ArrowRight, 
  MapPin, 
  CheckCircle2, 
  Instagram, 
  Menu,
  X,
  Clock
} from 'lucide-react';
import { TemplateProps } from '../types';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function MinimalistTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#1c1917';
  const bgColor = settings?.template_bg_color || '#F9F8F6';
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);
  const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');
  const isHeaderDark = useMemo(() => {
    const hex = headerColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [headerColor]);
  const isLight = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
  };
  const textColor = isDark ? (isLight(accentColor) ? accentColor : '#f1f5f9') : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';
  const surfaceColor = headerColor;
  const surfaceTextColor = isHeaderDark ? '#f1f5f9' : '#1e293b';
  const surfaceTextMuted = isHeaderDark ? '#94a3b8' : '#64748b';
  const surfaceBorderColor = isHeaderDark ? '#334155' : '#e2e8f0';
  const inputBg = isHeaderDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [activeScroll, setActiveScroll] = useState(0);
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const { showAddress, showCommune, showNotes } = useOrderFields(settings);
  // Handle scroll tracking for background transitions
  useEffect(() => {
    const handleScroll = () => {
      const position = window.scrollY;
      setActiveScroll(position);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (detailProduct || selectedProduct || zoomImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [detailProduct, selectedProduct, zoomImage]);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
  };

  const ProductDetailModal = ({ product, onClose, onOrder }: { product: any, onClose: () => void, onOrder: (p: any) => void }) => {
    const [activeImg, setActiveImg] = useState(0);
    const [showVideo, setShowVideo] = useState(true);
    const images: string[] = product.images?.filter(Boolean) || [];
    const hasMultiple = images.length > 1;
    const tsRef = useRef<number | null>(null);
    const videoUrl = product?.metadata?.video_url || '';
    const videoEmbed = useMemo(() => {
      if (!videoUrl) return null;
      const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (yt) return { type: 'youtube' as const, id: yt[1] };
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
      return { type: 'iframe' as const, url: videoUrl };
    }, [videoUrl]);
    useEffect(() => { setActiveImg(0); setShowVideo(!!videoEmbed); }, [product?.id]);

    const handleSwipe = (e: React.TouchEvent) => {
      if (videoEmbed && showVideo) return;
      if (tsRef.current === null || !hasMultiple) return;
      const diff = tsRef.current - e.changedTouches[0].clientX;
      tsRef.current = null;
      if (Math.abs(diff) < 40) return;
      setActiveImg(i => diff > 0 ? Math.min(i + 1, images.length - 1) : Math.max(i - 1, 0));
    };

    return (
      <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="minimalist-modal-card relative z-10 w-full md:max-w-5xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row" dir="ltr" style={{ backgroundColor: surfaceColor, color: surfaceTextColor, height: '100dvh', maxHeight: '100dvh' }}>
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}>
            <X size={18} />
          </button>

          {/* Image column — left on desktop */}
          <div className="w-full md:w-[55%] md:shrink-0 md:h-full flex flex-col">
          <div className="relative flex-1 min-h-0 overflow-hidden select-none" style={{ backgroundColor: surfaceMuted, aspectRatio: '1/1' }}
            onTouchStart={e => { e.stopPropagation(); tsRef.current = e.touches[0].clientX; }}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); handleSwipe(e); }}
          >
            {videoEmbed && showVideo ? (
              <div className="w-full h-full">
                {videoEmbed.type === 'youtube' ? (
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                ) : videoEmbed.type === 'video' ? (
                  <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                ) : (
                  <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                )}
              </div>
            ) : images.length > 0 ? (
              <img 
                src={images[activeImg] || images[0]} 
                alt={product.title} 
                className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ color: surfaceTextMuted }}>
                <ShoppingBag size={48} strokeWidth={1} />
              </div>
            )}
            {(videoEmbed || hasMultiple) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
                {videoEmbed && <button onClick={e => { e.stopPropagation(); setShowVideo(true); }} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.4)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
                {images.map((_, i) => (
                  <button key={i} onClick={() => { setShowVideo(false); setActiveImg(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === activeImg ? accentColor : 'rgba(255,255,255,0.5)', transform: !showVideo && i === activeImg ? 'scale(1.3)' : 'scale(1)' }} />
                ))}
              </div>
            )}
          </div>
          {/* Thumbnails — below main image, inside left column */}
          {(videoEmbed || hasMultiple) && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0" style={{ borderTop: `1px solid ${borderColor}`, backgroundColor: surfaceColor }}>
              {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
              {images.map((img, i) => (
                <button key={i} onClick={() => { setShowVideo(false); setActiveImg(i); }} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === activeImg ? accentColor : 'transparent', opacity: !showVideo && i === activeImg ? 1 : 0.6 }}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          </div>

          {/* Right side: info + button */}
          <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">

            {/* Product Info */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-xl font-serif italic leading-tight" style={{ color: surfaceTextColor }}>{product.title}</h3>
                <p className="text-lg font-bold shrink-0" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} DA</p>
              </div>
              {product.description && (
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: surfaceTextMuted }}>{product.description}</p>
              )}
              {product.category && (
                <span className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: surfaceBorderColor, color: surfaceTextMuted }}>{product.category}</span>
              )}
            </div>

            {/* Order Button */}
            <div className="shrink-0 px-6 pb-6 pt-3" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
              <button 
                onClick={() => { onOrder(product); onClose(); }}
                className="w-full flex items-center justify-center gap-3 text-white py-4 rounded-2xl font-bold tracking-wide transition-all active:scale-95 shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <ShoppingBag size={18} />
                <span className="text-sm uppercase tracking-widest">اطلب الآن</span>
                <ArrowRight size={16} />
              </button>
              <p className="text-center text-[10px] mt-3 uppercase tracking-widest flex items-center justify-center gap-2" style={{ color: surfaceTextMuted }}>
                <CheckCircle2 size={10} /> الدفع عند الاستلام
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OrderModal = ({ product, onClose }: { product: any, onClose: () => void }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

    // Variant system
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

    // Offers system
    const { offers } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); } }, [offers]);
    const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);
    const productTotal = selectedOffer ? selectedOffer.bundle_price : (selectedVariant?.price ?? product?.price ?? 0);
    const grandTotal = productTotal + deliveryFee;

    const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const fd = new FormData(e.currentTarget);
        const name = fd.get('name') as string;
        const phone = fd.get('phone') as string;
        
        if (!name || !phone || !selectedWilayaId || !product) {
            alert('الرجاء تعبئة جميع الحقول المطلوبة');
            return;
        }

        try {
            setIsSubmitting(true);
            
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_slug: storeSlug,
                    product_id: product.id,
                    ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                    quantity: selectedOffer?.quantity || 1,
                    ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                    total_price: selectedOffer ? selectedOffer.bundle_price : product.price,
                    delivery_fee: deliveryFee,
                    delivery_type: 'desk', 
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: [selectedWilaya?.labelFR || '', fd.get('commune'), fd.get('address'), fd.get('notes')].filter(Boolean).join(' - '),
                    shipping_wilaya_id: selectedWilayaId,
                })
            });

            const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
            if (res.ok) {
                setOrderSuccess(true);
            } else {
                alert(data.error || 'Error processing order');
            }
        } catch (err: any) {
            console.error('Order error', err);
            alert('Error processing order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-md rounded-[32px] overflow-hidden relative z-10 animate-in fade-in zoom-in duration-300" style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif italic" style={{ color: surfaceTextColor }}>تفاصيل الطلب</h3>
              <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ color: surfaceTextColor }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="flex gap-4 mb-8 p-4 rounded-2xl border" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
              <img src={product.images?.[0] || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-xl object-cover" alt="" />
              <div>
                <p className="font-bold" style={{ color: surfaceTextColor }}>{product.title || product.name}</p>
                <p style={{ color: surfaceTextMuted }}>{Math.round(product.price ?? 0).toLocaleString()} DA</p>
              </div>
            </div>

            {orderSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: inputBg, color: surfaceTextColor }}>
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-xl font-bold font-serif italic">تم تأكيد طلبك</h4>
                <p className="text-sm" style={{ color: surfaceTextMuted }}>سنتواصل معك قريباً لترتيب التوصيل.</p>
                <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} />
                <button onClick={onClose} className="mt-8 text-sm font-bold tracking-widest uppercase border-b pb-1 hover:opacity-70" style={{ borderColor: surfaceBorderColor }}>إغلاق</button>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="space-y-4">
                {product?.variants && product.variants.length > 0 && (
                  <VariantSelector
                    variants={product.variants}
                    selected={selectedVariant}
                    onSelect={setSelectedVariant}
                    accentColor={accentColor}
                    currency="DA"
                    basePrice={product.price}
                  />
                )}
                {offers.length > 0 && (
                  <OfferSelector
                    offers={offers}
                    unitPrice={product?.price || 0}
                    currency="DA"
                    selectedOfferId={selectedOffer?.offer_id ?? null}
                    onSelect={handleOfferSelect}
                    accentColor={accentColor}
                    textColor={surfaceTextColor}
                    borderColor={surfaceBorderColor}
                  />
                )}
                <input required name="name" type="text" placeholder="الاسم الكامل" className="w-full px-6 py-4 rounded-2xl border transition-all outline-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                <input required name="phone" type="tel" placeholder="رقم الهاتف" className="w-full px-6 py-4 rounded-2xl border transition-all outline-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-6 py-4 rounded-2xl border transition-all outline-none appearance-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}>
                  <option value="">اختر الولاية</option>
                  {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelFR}</option>)}
                </select>
                {selectedWilayaId && (
                  <div className="p-3 rounded-2xl text-sm space-y-2" style={{ backgroundColor: inputBg, border: `1px solid ${surfaceBorderColor}` }}>
                    <div className="flex justify-between">
                      <span style={{ color: surfaceTextMuted }}>سعر المنتجات</span>
                      <span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(productTotal ?? 0).toLocaleString()} DA</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: surfaceTextMuted }}>سعر التوصيل</span>
                      <span className="font-bold" style={{ color: accentColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} DA</span>
                    </div>
                    <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${surfaceBorderColor}` }}>
                      <span className="font-bold" style={{ color: surfaceTextColor }}>التكلفة الإجمالية</span>
                      <span className="font-black" style={{ color: accentColor }}>{Math.round(grandTotal ?? 0).toLocaleString()} DA</span>
                    </div>
                  </div>
                )}
                {showCommune && <input name="commune" type="text" placeholder="البلدية" className="w-full px-6 py-4 rounded-2xl border transition-all outline-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />}
                {showAddress && <input name="address" type="text" placeholder="عنوان التوصيل" className="w-full px-6 py-4 rounded-2xl border transition-all outline-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />}
                {showNotes && <textarea name="notes" placeholder="ملاحظات" rows={2} className="w-full px-6 py-4 rounded-2xl border transition-all outline-none resize-none" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor, color: surfaceTextColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />}
                <button disabled={isSubmitting} type="submit" className="w-full text-white py-5 rounded-2xl font-bold tracking-wide transition-all shadow-xl active:scale-95 disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                  {isSubmitting ? 'جاري المعالجة...' : (settings?.template_button_text || 'تأكيد الشراء')}
                </button>

                <p className="text-center text-[10px] mt-6 uppercase tracking-widest flex items-center justify-center gap-2" style={{ color: surfaceTextMuted }}>
                  <CheckCircle2 size={10} /> الدفع عند الاستلام
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // If products are passed from the system, use them, otherwise use fallback styling to indicate to the user what goes where.
  const displayProducts = products && products.length > 0 ? products : [];

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">
      
      {/* Elegant Floating Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-6 pointer-events-none">
        <div className="backdrop-blur-md px-6 py-3 rounded-full border shadow-sm flex items-center gap-8 pointer-events-auto" style={{ backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.8)', borderColor }}>
          <button onClick={() => setIsMenuOpen(true)} className="hover:opacity-70 transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={settings?.store_name || "المتجر"} className="w-8 h-8 rounded-full object-cover border shadow-sm" style={{ borderColor }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: accentColor, color: '#fff' }}>
                {(settings?.store_name || 'م').charAt(0)}
              </div>
            )}
            <h1 className="text-xl font-serif tracking-tighter italic">
                {settings?.store_name || "المتجر"}
            </h1>
          </div>
          <div className="relative">
            <ShoppingBag size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></span>
          </div>
        </div>
      </nav>

      {/* Hero / Intro */}
      <section className="min-h-[60vh] flex flex-col items-center justify-center text-center px-8 relative overflow-hidden pt-24">
        <div className="z-10 max-w-sm">
          <span className="text-[10px] uppercase tracking-[0.4em] block mb-6" style={{ color: textMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_collection')}>
              {settings?.min_hero_collection || "مجموعة 2024"}
          </span>
          <h2 className="text-5xl font-serif italic mb-6 leading-tight whitespace-pre-line" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_title')}>
              {settings?.min_hero_title || settings?.template_hero_heading || "قطع بسيطة.\nتدوم للأبد."}
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: textMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_subtitle')}>
            {settings?.min_hero_subtitle || settings?.template_hero_subtitle || "مجموعة مختارة من الأساسيات اليومية مصممة لتدوم طويلاً. صنع محلي، إلهام عالمي."}
          </p>
          <div className="animate-bounce" style={{ color: textMuted }}>
            <div className="w-[1px] h-12 mx-auto" style={{ backgroundColor: borderColor }}></div>
          </div>
        </div>
        {/* Abstract Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[60%] rounded-[100%] blur-[120px] -z-0" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }}></div>
      </section>

      {/* Main Product Grid */}
      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayProducts.map((product, index) => (
          <div key={product.id || index} className="group cursor-pointer" onClick={() => { setDetailProduct(product); onProductView?.(product); }}>
            <div className="relative overflow-hidden rounded-2xl aspect-[4/5] shadow-sm transition-all duration-500 group-hover:shadow-lg group-hover:scale-[0.98]">
              <img 
                src={product.images?.[0] || 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&q=80&w=800'} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                alt={product.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-[9px] uppercase tracking-widest opacity-70 mb-0.5">منتج 0{index + 1}</p>
                <h3 className="text-sm font-serif italic leading-tight">{product.title}</h3>
              </div>
              {product.original_price && product.original_price > product.price && (
                <div className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: accentColor }}>
                  -{Math.round((1 - product.price / product.original_price) * 100)}%
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between items-center px-0.5">
              <p className="text-sm font-bold" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} دج</p>
              {product.original_price && product.original_price > product.price
                ? <p className="text-xs line-through" style={{ color: textMuted }}>{Math.round(product.original_price ?? 0).toLocaleString()} دج</p>
                : <p className="text-xs italic line-clamp-1" style={{ color: textMuted }}>{product.description || ""}</p>
              }
            </div>
          </div>
        ))}
        {displayProducts.length === 0 && (
          <div className="col-span-full text-center py-32 font-serif italic text-xl" style={{ color: textMuted }}>
            أضف منتجاتك من لوحة التحكم لتظهر هنا.
          </div>
        )}
      </main>

      {/* Why Us Section */}
      <section className="py-16 px-8 rounded-t-[48px] relative z-20" style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="space-y-4">
            <h4 className="text-2xl font-serif italic" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_promise_title')}>
                {settings?.min_promise_title || "وعدنا لك"}
            </h4>
            <div className="w-12 h-[1px] mx-auto" style={{ backgroundColor: surfaceBorderColor }}></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm mt-10">
            <div className="space-y-2">
              <MapPin className="mx-auto mb-4" size={24} style={{ color: surfaceTextMuted }} />
              <p className="font-bold tracking-widest uppercase" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature1_title')}>{settings?.min_feature1_title || "صناعة محلية"}</p>
              <p style={{ color: surfaceTextMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature1_desc')}>{settings?.min_feature1_desc || "ندعم الحرفيين المحليين عبر كامل الوطن."}</p>
            </div>
            <div className="space-y-2">
              <Clock className="mx-auto mb-4" size={24} style={{ color: surfaceTextMuted }} />
              <p className="font-bold tracking-widest uppercase" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature2_title')}>{settings?.min_feature2_title || "توصيل سريع"}</p>
              <p style={{ color: surfaceTextMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature2_desc')}>{settings?.min_feature2_desc || "خلال 48 ساعة لكبرى الولايات."}</p>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            <a href="#" className="flex items-center justify-center gap-2 hover:opacity-70 transition-colors" style={{ color: surfaceTextMuted }}>
              <Instagram size={18} />
              <span className="text-xs font-bold tracking-widest" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_instagram')}>
                  {settings?.min_instagram || "@store_dz"}
              </span>
            </a>
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: surfaceTextMuted }}>صنع في الجزائر</p>
          </div>
        </div>
      </section>

      {detailProduct && !selectedProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onOrder={(p) => { setSelectedProduct(p); setDetailProduct(null); }}
        />
      )}

      {selectedProduct && (
        <OrderModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}

      {/* Side Menu */}
      <div className={`fixed inset-0 z-[200] transition-all duration-500 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 backdrop-blur-md" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setIsMenuOpen(false)}></div>
        <div className={`absolute top-0 left-0 bottom-0 w-72 p-12 transition-transform duration-500 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>
            <button onClick={() => setIsMenuOpen(false)} className="mb-12 hover:rotate-90 transition-transform">
                <X size={24} />
            </button>
            <div className="flex flex-col gap-8 text-2xl font-serif italic">
                <a href="#" className="hover:opacity-70">المنتجات</a>
                <a href="#" className="hover:opacity-70">التوصيل</a>
                <a href="#" className="hover:opacity-70">من نحن</a>
            </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) {
          .minimalist-modal-card { height: 85vh !important; max-height: 85vh !important; }
        }
      `}} />

      {/* Platform Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${borderColor}`, color: textMuted }}>
        © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
      </footer>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
            <X size={20} />
          </button>
          <img src={zoomImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
