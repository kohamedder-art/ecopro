import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { TemplateProps } from '../types';

import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

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

function ProductImageGallery({ product: p, accentColor, onZoom }: { product: any; accentColor: string; onZoom?: (src: string) => void }) {
  const [idx, setIdx] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const imgs: string[] = p.images?.filter(Boolean) || [];
  const tsRef = React.useRef<number | null>(null);
  const videoUrl = p?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);
  useEffect(() => { setIdx(0); setShowVideo(!!videoEmbed); }, [p?.id]);
  return (
    <div className="needdz-gallery-wrap flex flex-col h-full">
      <div
        className="needdz-gallery-img relative w-full overflow-hidden bg-slate-100 shrink-0"
        style={{ aspectRatio: '3 / 4', maxHeight: '50dvh' }}
        onTouchStart={e => { e.stopPropagation(); tsRef.current = e.touches[0].clientX; }}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => {
          e.stopPropagation();
          if (videoEmbed && showVideo) return;
          if (tsRef.current === null || imgs.length <= 1) return;
          const d = tsRef.current - e.changedTouches[0].clientX;
          tsRef.current = null;
          if (Math.abs(d) < 40) return;
          setIdx(i => d > 0 ? Math.min(i + 1, imgs.length - 1) : Math.max(i - 1, 0));
        }}
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
        ) : imgs.length > 0 ? (
          <div className="w-full h-full cursor-pointer" onClick={() => onZoom?.(imgs[idx] || imgs[0])}>
            <img src={imgs[idx] || imgs[0]} alt="" className="w-full h-full object-cover transition-all duration-300" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300"><ShoppingBag size={48} strokeWidth={1} /></div>
        )}
        {(videoEmbed || imgs.length > 1) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
            {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-5 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: showVideo ? '#000' : 'rgba(0,0,0,0.4)', border: showVideo ? `1.5px solid ${accentColor}` : 'none' }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
            {imgs.map((_, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: !showVideo && i === idx ? accentColor : 'rgba(0,0,0,0.2)', transform: !showVideo && i === idx ? 'scale(1.3)' : 'scale(1)' }} />)}
          </div>
        )}
      </div>
      {(videoEmbed || imgs.length > 1) && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 bg-slate-50 border-t border-slate-100">
          {videoEmbed && <button onClick={() => setShowVideo(true)} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center transition-all" style={{ borderColor: showVideo ? accentColor : 'transparent', backgroundColor: '#000' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></button>}
          {imgs.map((img, i) => <button key={i} onClick={() => { setShowVideo(false); setIdx(i); }} className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all" style={{ borderColor: !showVideo && i === idx ? accentColor : 'transparent', opacity: !showVideo && i === idx ? 1 : 0.6 }}><img src={img} alt="" className="w-full h-full object-cover" /></button>)}
        </div>
      )}
    </div>
  );
}

export default function NeedDZTemplate({ settings, products, canManage, storeSlug, onProductView, initialProductSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#059669';

  // Section visibility toggles
  const showUrgentBar = settings?.needdz_show_urgent_bar !== false;
  const showSocialProof = settings?.needdz_show_social_proof !== false;
  const showCardSocialProof = settings?.needdz_show_card_proof !== false;

  // Editable texts
  const urgentOfferText = settings?.needdz_urgent_text || 'عرض سريع: ينتهي خلال';
  const urgentViewersText = settings?.needdz_viewers_text || '14 شخص يشاهد هذا المنتج';
  const trustPill1 = settings?.needdz_trust1 || 'توصيل 58 ولاية';
  const trustPill2 = settings?.needdz_trust2 || 'الدفع عند الاستلام';
  const trustPill3 = settings?.needdz_trust3 || 'ضمان 12 شهر';
  const socialProofTitle = settings?.needdz_reviews_title || 'آراء عملائنا';
  const review1Name = settings?.needdz_rev1_name || 'Ahmed B.';
  const review1City = settings?.needdz_rev1_city || 'Oran';
  const review1Text = settings?.needdz_rev1_text || 'Qualité top, arrived in 2 days to Oran via Yalidine.';
  const review2Name = settings?.needdz_rev2_name || 'Sara L.';
  const review2City = settings?.needdz_rev2_city || 'Alger';
  const review2Text = settings?.needdz_rev2_text || 'Service client très sérieux. Je recommande.';
  const cardProofText = settings?.needdz_card_proof || '+45 توصيل هذا الصباح';

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, mins: 45, secs: 12 });
  const [currentImgIdx, setCurrentImgIdx] = useState<Record<number, number>>({});
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  useEffect(() => { if (initialProductSlug && products?.length) { const p = products.find((x: any) => x.slug === initialProductSlug); if (p) setDetailProduct(p); } }, [initialProductSlug, products]);
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes } = useOrderFields(settings);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system
  const { offers } = useProductOffers(storeSlug, selectedProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); } }, [offers]);
  useEffect(() => {
    if (detailProduct || isCheckoutOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [detailProduct, isCheckoutOpen]);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(selectedProduct, selectedOffer, baseDeliveryFee);
  const productTotal = selectedOffer ? selectedOffer.bundle_price : (selectedVariant?.price ?? selectedProduct?.price ?? 0);
  const grandTotal = productTotal + deliveryFee;

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
        ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        quantity: selectedOffer?.quantity || 1,
        ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
        total_price: selectedOffer ? selectedOffer.bundle_price : selectedProduct.price,
        delivery_fee: deliveryFee,
        delivery_type: 'desk',
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR, fd.get('commune'), fd.get('address'), fd.get('notes')].filter(Boolean).join(' - '),
        shipping_wilaya_id: selectedWilayaId,
      };
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Order error');
      const resData = await res.json().catch(() => ({}));
      setLastOrderId(resData.order?.id || null);
      setLastTelegramUrl(resData.telegramStartUrl || null);
      setLastCustomerPhone(String(fd.get('phone') || ''));
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
    <div className="min-h-screen font-sans" style={{ backgroundColor: settings?.template_bg_color || '#f1f5f9' }} dir="rtl">
      <div className="w-full bg-white relative flex flex-col min-h-screen">
        
        {/* Urgent Header - toggleable */}
        {showUrgentBar && (
        <div className="text-white px-4 py-2 text-[11px] font-bold flex justify-between items-center sticky top-0 z-50" style={{ backgroundColor: accentColor }}>
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
            <div className="flex items-center gap-1">
              <Zap size={12} fill="white" />
              <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_urgent_text')}>{urgentOfferText}</span>
              &nbsp;{timeLeft.mins}د {timeLeft.secs}ث
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_viewers_text')}>{urgentViewersText}</span>
            </div>
          </div>
        </div>
        )}

        {/* Main Branding */}
        <header className="px-6 py-5 bg-white border-b border-slate-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
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
          </div>
        </header>

        <main className="flex-1 pb-32">
          {/* Trust Banner */}
          <div className="max-w-6xl mx-auto flex overflow-x-auto py-4 px-6 gap-4 no-scrollbar">
            {[
              { icon: <Truck size={16}/>, text: trustPill1, key: 'needdz_trust1' },
              { icon: <ShieldCheck size={16}/>, text: trustPill2, key: 'needdz_trust2' },
              { icon: <Clock size={16}/>, text: trustPill3, key: 'needdz_trust3' }
            ].map((item, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-white px-3 py-2 rounded-full border border-slate-200 shadow-sm">
                <span style={{ color: accentColor }}>{item.icon}</span>
                <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(item.key)}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Product Feed */}
          <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {displayProducts.map(product => {
              const [descExpanded, setDescExpanded] = React.useState(false);
              return (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm group">
                {/* Image */}
                <div className="relative overflow-hidden bg-slate-100" style={{ aspectRatio: '3 / 4' }}>
                  <img
                    src={product.images[currentImgIdx[product.id] || 0]}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
                    alt={product.name}
                    onClick={() => { setDetailProduct(product); onProductView?.(product as any); }}
                  />
                  <div className="absolute top-2 left-2 bg-black text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                    <Flame size={9} className="text-orange-400" /> {product.badge}
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                    {product.images.map((_: any, idx: number) => (
                      <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${(currentImgIdx[product.id] || 0) === idx ? 'w-4 bg-emerald-500' : 'w-1 bg-white/50'}`} />
                    ))}
                  </div>
                  {product.images.length > 1 && (
                    <button onClick={() => nextImg(product.id, product.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-start gap-1">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">{product.name}</h2>
                    <div className="text-right shrink-0">
                      {product.oldPrice > product.price && (
                        <div className="text-[10px] text-slate-400 line-through">{Math.round(product.oldPrice ?? 0).toLocaleString()} DA</div>
                      )}
                      <div className="text-sm font-black" style={{ color: accentColor }}>{Math.round(product.price ?? 0).toLocaleString()} DA</div>
                    </div>
                  </div>

                  <div>
                    <p className={`text-slate-500 text-xs leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>{product.description}</p>
                    {product.description?.length > 60 && (
                      <button onClick={() => setDescExpanded(v => !v)} className="text-[10px] font-bold mt-0.5" style={{ color: accentColor }}>
                        {descExpanded ? '▲ أقل' : '▼ المزيد'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {product.features.map((f: string) => (
                      <span key={f} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded italic"># {f}</span>
                    ))}
                  </div>

                  <button
                    onClick={() => { setDetailProduct(product); onProductView?.(product as any); }}
                    className="w-full text-white font-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow transition-all active:scale-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    عرض المنتج <ArrowRight size={13} />
                  </button>

                  {showCardSocialProof && (
                  <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_card_proof')}>{cardProofText}</span>
                  </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Social Proof Section - fully toggleable + editable */}
          {showSocialProof && (
          <section className="px-6 py-10 bg-slate-900 text-white mt-10">
            <div className="max-w-6xl mx-auto">
            <h3 className="text-xl font-bold mb-6" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_reviews_title')}>{socialProofTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-sm">
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev1_name')}>{review1Name}</span>
                    {' '}<span className="text-emerald-400">• <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev1_city')}>{review1City}</span></span>
                  </span>
                  <div className="flex gap-0.5 text-yellow-400">{[...Array(5)].map((_, j) => <Star key={j} size={10} fill="currentColor" />)}</div>
                </div>
                <p className="text-xs text-slate-300 italic">"<span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev1_text')}>{review1Text}</span>"</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-sm">
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev2_name')}>{review2Name}</span>
                    {' '}<span className="text-emerald-400">• <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev2_city')}>{review2City}</span></span>
                  </span>
                  <div className="flex gap-0.5 text-yellow-400">{[...Array(5)].map((_, j) => <Star key={j} size={10} fill="currentColor" />)}</div>
                </div>
                <p className="text-xs text-slate-300 italic">"<span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('needdz_rev2_text')}>{review2Text}</span>"</p>
              </div>
            </div>
            </div>
          </section>
          )}
        </main>

        {/* Checkout Drawer */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-sm" dir="rtl">
            <div className="w-full bg-white rounded-t-[32px] animate-slide-up relative overflow-y-auto" style={{ maxHeight: '90dvh', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
              
              <div className="max-w-lg mx-auto px-6 pt-6 pb-4">
              <button 
                onClick={() => { setIsCheckoutOpen(false); setOrderStatus('idle'); }}
                className="absolute top-4 left-4 text-slate-400 hover:text-black transition-colors w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X size={20} />
              </button>

              {orderStatus === 'success' ? (
                <div className="py-16 text-center space-y-6">
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle2 size={56} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black">مبروك!</h2>
                    <p className="text-slate-500 mt-2 px-6">تم تسجيل طلبك. سنتصل بك على <span className="font-bold text-slate-900">رقم هاتفك</span> للتأكيد.</p>
                    <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
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
                      <p className="font-black" style={{ color: accentColor }}>{Math.round(selectedProduct?.price ?? 0).toLocaleString()} DA</p>
                    </div>
                  </div>

                  <form className="space-y-5" onSubmit={handleOrder}>
                    {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                      <VariantSelector
                        variants={selectedProduct.variants}
                        selected={selectedVariant}
                        onSelect={setSelectedVariant}
                        accentColor={accentColor}
                        currency="DA"
                        basePrice={selectedProduct.price}
                      />
                    )}
                    {offers.length > 0 && (
                      <OfferSelector
                        offers={offers}
                        unitPrice={selectedProduct?.price || 0}
                        currency="DA"
                        selectedOfferId={selectedOffer?.offer_id ?? null}
                        onSelect={handleOfferSelect}
                        accentColor={accentColor}
                        textColor="#1e293b"
                        borderColor="#e2e8f0"
                      />
                    )}
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
                        {showCommune && <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">البلدية</label>
                          <input name="commune" type="text" placeholder="المدينة" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm outline-none" />
                        </div>}
                      </div>
                      {showAddress && <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">العنوان</label>
                        <input name="address" type="text" placeholder="عنوان التوصيل" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm outline-none" />
                      </div>}
                      {showNotes && <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">ملاحظات</label>
                        <textarea name="notes" placeholder="ملاحظات إضافية" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm outline-none resize-none" />
                      </div>}
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      {selectedWilayaId ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-emerald-700">
                            <span>سعر المنتجات</span>
                            <span className="font-bold text-emerald-900">{Math.round(productTotal ?? 0).toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <span>سعر التوصيل</span>
                            <span className="font-bold text-emerald-900">{Math.round(deliveryFee ?? 0).toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-emerald-200">
                            <span className="font-bold text-emerald-900">التكلفة الإجمالية</span>
                            <span className="font-black text-emerald-900">{Math.round(grandTotal ?? 0).toLocaleString()} دج</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Truck className="text-emerald-600" size={18} />
                          <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">الدفع عند الاستلام بعد التحقق من المنتج.</p>
                        </div>
                      )}
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
          </div>
        )}

        {/* Platform Footer */}
        <footer className="py-6 text-center text-xs" style={{ borderTop: '1px solid #e5e7eb', color: '#6b7280' }}>
          <div className="max-w-6xl mx-auto">
            © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 no-underline">Sahla4Eco</a>
          </div>
        </footer>

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
        @media (max-width: 767px) {
          .needdz-gallery-img { max-height: 50dvh !important; }
        }
        @media (min-width: 768px) {
          .needdz-modal-card { height: 85vh !important; max-height: 85vh !important; }
          .needdz-gallery-wrap { height: 100%; }
          .needdz-gallery-img { aspect-ratio: unset !important; max-height: 100% !important; flex: 1; min-height: 0; }
        }
      `}} />

      {/* Product Detail Modal */}
      {detailProduct && !isCheckoutOpen && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center md:justify-center md:p-4" onTouchMove={e => e.preventDefault()} style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="needdz-modal-card relative z-10 w-full md:max-w-4xl md:mx-auto md:rounded-[32px] overflow-hidden flex flex-col md:flex-row bg-white text-slate-900" dir="ltr" style={{ height: '100dvh', maxHeight: '100dvh', touchAction: 'auto' }}>
            <button onClick={() => setDetailProduct(null)} className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-md text-white"><X size={18} /></button>
            <div className="w-full md:w-[55%] md:shrink-0 md:h-full overflow-hidden">
              <div className="h-full">
              <ProductImageGallery product={detailProduct} accentColor={accentColor} onZoom={(src) => { const imgs = detailProduct?.images?.filter(Boolean) || []; const idx = imgs.indexOf(src); setZoomState({ images: imgs.length ? imgs : [src], idx: idx >= 0 ? idx : 0 }); }} />
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" dir="rtl">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-xl font-bold leading-tight text-slate-900">{detailProduct.name}</h3>
                <div className="text-right shrink-0">
                  {detailProduct.oldPrice > detailProduct.price && <div className="text-xs text-slate-400 line-through">{Math.round(detailProduct.oldPrice ?? 0).toLocaleString()} DA</div>}
                  <div className="text-xl font-black" style={{ color: accentColor }}>{Math.round(detailProduct.price ?? 0).toLocaleString()} DA</div>
                </div>
              </div>
              {detailProduct.description && <p className="text-sm leading-relaxed text-slate-500">{detailProduct.description}</p>}
              {detailProduct.features && <div className="flex flex-wrap gap-2">{detailProduct.features.map((f: string) => <span key={f} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md italic"># {f}</span>)}</div>}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-3 border-t border-slate-100">
              <button onClick={() => { setSelectedProduct(detailProduct); setIsCheckoutOpen(true); setDetailProduct(null); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-white transition-all active:scale-95" style={{ backgroundColor: accentColor }}>
                <ShoppingBag size={18} /> اطلب الآن
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomState && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setZoomState(null)}>
          <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setZoomState(null); }}>
            <X size={20} />
          </button>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded-2xl" />
          </div>
          {zoomState.images.length > 1 && (
            <div className="shrink-0 flex gap-2 px-4 pb-6 pt-2 overflow-x-auto justify-center" onClick={(e) => e.stopPropagation()}>
              {zoomState.images.map((img, i) => (
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
