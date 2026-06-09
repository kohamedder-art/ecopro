import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  EyeOff,
  Home,
  Building2,
  ChevronDown
} from 'lucide-react';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById, communeDisplayName } from '@/lib/algeriaGeo';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { buildStoreUrl } from '@/lib/resolvedStore';

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
    videoUrl: '',
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
    videoUrl: '',
    features: ["ANC Technology", "Waterproof IPX7", "Deep Bass"]
  }
];

export default function NeedDZTemplate({ settings, products, canManage, storeSlug, navigate, initialProductSlug, onProductView }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#059669';
  const headerColor = settings?.iyco_header_color || '#ffffff';
  const bgColor = settings?.template_bg_color || '#ffffff';
  const isDark = useMemo(() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [bgColor]);
  const textColor = settings?.primary_color || (isDark ? '#f1f5f9' : '#1f2937');
  const textMuted = isDark ? '#94a3b8' : '#6b7280';
  const borderColor = isDark ? '#334155' : '#e5e7eb';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const surfaceMuted = isDark ? '#0f172a' : '#f9fafb';
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Pre-select product from URL slug on mount
  useEffect(() => {
    if (!initialProductSlug) { setSelectedProduct(null); setIsCheckoutOpen(false); return; }
    if (products?.length) {
      const match = products.find((p: any) => p.slug === initialProductSlug);
      if (match) { setSelectedProduct(match); setIsCheckoutOpen(true); }
    }
  }, [initialProductSlug, products]);

  // Fire product view tracking when a product is selected
  useEffect(() => { if (selectedProduct && onProductView) onProductView(selectedProduct); }, [selectedProduct?.id, onProductView]);

  // Update URL when product is selected
  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setIsCheckoutOpen(true);
    if (product?.slug && navigate) navigate(buildStoreUrl(storeSlug, product.slug));
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
    if (navigate) navigate(buildStoreUrl(storeSlug, '/'));
  };
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [timeLeft, setTimeLeft] = useState(() => {
    const target = Date.now() + 45 * 60 * 1000;
    return { target, hours: 0, mins: 45, secs: 0 };
  });
  const [currentImgIdx, setCurrentImgIdx] = useState<Record<number, number>>({});
  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const baseDeliveryFee = selectedWilaya
    ? (selectedDeliveryType === 'desk' ? (selectedWilaya.deskPrice ?? selectedWilaya.homePrice ?? 0) : (selectedWilaya.homePrice ?? 0))
    : 0;
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCommune, setCustomerCommune] = useState('');
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState('');

  // Variant and Offer support
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, selectedProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const galleryIdxRef = useRef<Record<string, number>>({});
  galleryIdxRef.current = currentImgIdx as Record<string, number>;
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
  const deliveryFee = resolveDeliveryFee(selectedProduct, selectedOffer, baseDeliveryFee);
  const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : (variantPrice ?? selectedProduct?.price ?? 0) * quantity;

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
    videoUrl: (p as any)?.metadata?.video_url || '',
    features: ["جودة عالية", "توصيل سريع", "ضمان"],
    variants: p.variants || []
  })) : FALLBACK_PRODUCTS;

const parseVideoEmbed = (videoUrl: string) => {
  if (!videoUrl) return null;
  const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return { type: 'youtube' as const, id: yt[1] };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
  return { type: 'iframe' as const, url: videoUrl };
};

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (canManage) {
      e.currentTarget.setAttribute('data-setting-key', key);
      window.parent.postMessage({ type: "TEMPLATE_UPDATE_SETTING", key, value: e.currentTarget.textContent || "" }, "*");
    }
  };

  // Countdown timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, timeLeft.target - Date.now());
      const totalSecs = Math.floor(remaining / 1000);
      setTimeLeft(prev => ({
        ...prev,
        hours: Math.floor(totalSecs / 3600),
        mins: Math.floor((totalSecs % 3600) / 60),
        secs: totalSecs % 60,
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft.target]);

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const fd = new FormData(e.currentTarget);
    const phone = (fd.get('phone') as string || '').replace(/[^0-9]/g, '');
    if (!isValidAlgerianPhone(phone)) {
      setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
      setOrderStatus('error');
      return;
    }
    setOrderStatus('loading');
    try {
      const payload = {
        store_slug: storeSlug || settings?.store_name || "needdz",
        product_id: selectedProduct.id,
        ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        quantity: quantity,
        ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
        total_price: productTotal,
        delivery_fee: deliveryFee,
        delivery_type: selectedDeliveryType,
        customer_name: fd.get('name'),
        customer_phone: fd.get('phone'),
        customer_address: [selectedWilaya?.labelAR, communeDisplayName(getAlgeriaCommuneById(customerCommune)!) || customerCommune, customerAddress].filter(Boolean).join(' - '),
        customer_notes: customerNotes,
        product_name: selectedProduct.title || selectedProduct.name || '',
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
          errMsg = data.error || 'حدث خطأ أثناء إرسال الطلب';
        }
        setOrderStatus('idle');
        setOrderError(errMsg);
        return;
      }
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
      setSubmittedPhone(String(fd.get('phone') || ''));
      setOrderStatus('success');
      trackAllPixels(PixelEvents.PURCHASE, {
        content_name: selectedProduct?.title || selectedProduct?.name || '',
        content_ids: selectedProduct?.id ? [selectedProduct.id] : [],
        content_type: 'product',
        value: productTotal,
        currency: settings?.currency_code || 'DZD',
        num_items: selectedOffer?.quantity || quantity,
        order_id: data?.order?.id || null,
      });
    } catch(err) {
      console.error(err);
      setOrderStatus('idle');
      if (!orderError) setOrderError('حدث خطأ في الاتصال. حاول مرة أخرى.');
    }
  };

  const nextImg = (id: number, max: number) => {
    setCurrentImgIdx(prev => ({ ...prev, [id]: ((prev[id] || 0) + 1) % max }));
  };

  return (
    <div className="min-h-screen flex justify-center font-sans" style={{ backgroundColor: settings?.template_bg_color || '#f1f5f9' }} dir="rtl">
      <div className="w-full max-w-[480px] relative flex flex-col shadow-xl min-h-screen" style={{ backgroundColor: cardBg }}>
        
        {/* Urgent Header */}
        {(showCountdown || canManage) && (
        <div className="text-white px-4 py-2 text-[11px] font-bold flex justify-between items-center sticky top-0 z-50 relative overflow-visible" style={{ backgroundColor: accentColor }} data-edit-path="countdown-header">
          {canManage && (
              <div className="absolute -bottom-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-[60]">
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
        <header className="px-6 py-5 flex justify-between items-center border-b" style={{ backgroundColor: headerColor, borderColor: borderColor }}>
          <div className="flex items-center gap-2">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: accentColor + '4d' }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: accentColor }}>
                {(settings?.store_name || 'م').charAt(0)}
              </div>
            )}
            <span className="text-lg font-black" style={{ color: textColor }}>{settings?.store_name || "متجري"}</span>
          </div>
          <div className="relative">
            <ShoppingBag size={24} style={{ color: textColor }} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
          </div>
        </header>

        <main className="flex-1 pb-32">
          {/* Trust Banner */}
          {(showTrustBanner || canManage) && (
          <div className="relative overflow-visible" data-edit-path="trust-banner">
            {canManage && (
                <div className="absolute -bottom-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-[60]">
                    <button
                        onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'needdz_show_trust', value: !showTrustBanner }, '*')}
                        className="flex items-center gap-1 font-bold"
                    >
                        {showTrustBanner ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                    </button>
                </div>
            )}
            {showTrustBanner ? (
            <div className="flex overflow-x-auto py-4 px-6 gap-4 no-scrollbar" style={{ backgroundColor: surfaceMuted }}>
            {[
              { icon: <Truck size={16}/>, text: "توصيل 58 ولاية" },
              { icon: <ShieldCheck size={16}/>, text: "الدفع عند الاستلام" },
              { icon: <Clock size={16}/>, text: "ضمان 12 شهر" }
            ].map((item, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border shadow-sm" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                <span style={{ color: accentColor }}>{item.icon}</span>
                <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: textColor }}>{item.text}</span>
              </div>
            ))}
            </div>
            ) : canManage ? (
                <div className="py-4 px-6" style={{ backgroundColor: surfaceMuted }}><span className="text-[10px]" style={{ color: textMuted }}>🛡️ Trust banner hidden</span></div>
            ) : null}
          </div>
          )}

          {/* Product Feed */}
          <div className="p-4 space-y-10 mt-2">
            {displayProducts.map(product => (
              <div key={product.id} className="rounded-[32px] overflow-hidden border shadow-sm group" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                {/* Image Gallery */}
                {(() => {
                  const totalMedia = product.images.length + (product.videoUrl ? 1 : 0);
                  const curIdx = (currentImgIdx as any)[product.id] || 0;
                  const goTo = (idx: number) => {
                    const clamped = ((idx % totalMedia) + totalMedia) % totalMedia;
                    setCurrentImgIdx((prev: any) => ({ ...prev, [product.id]: clamped }));
                  };
                  return (
                  <div className="relative aspect-square overflow-hidden select-none" style={{ backgroundColor: surfaceMuted, touchAction: 'pan-y' }}
                    onTouchStart={e => { const t = e.currentTarget as any; t._tsx = e.touches[0].clientX; t._tsy = e.touches[0].clientY; }}
                    onTouchEnd={e => {
                      const t = e.currentTarget as any;
                      const dx = t._tsx - e.changedTouches[0].clientX;
                      const dy = t._tsy - e.changedTouches[0].clientY;
                      if (t._tsx == null || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
                      const total = totalMedia;
                      if (total <= 1) return;
                      const cur = galleryIdxRef.current[String(product.id)] || 0;
                      const tgt = dx > 0 ? (cur + 1) % total : (cur - 1 + total) % total;
                      goTo(tgt);
                    }}
                  >
                    <div style={{
                      display: 'flex', height: '100%',
                      width: `${totalMedia * 100}%`,
                      transform: `translateX(-${(curIdx / totalMedia) * 100}%)`,
                      transition: 'transform 0.3s ease',
                      willChange: 'transform',
                    }}>
                      {product.videoUrl && parseVideoEmbed(product.videoUrl) && (() => {
                        const ve = parseVideoEmbed(product.videoUrl);
                        return (
                          <div style={{ width: `${100 / totalMedia}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                            {ve.type === 'youtube' ? (
                              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ve.id}?autoplay=1&mute=1&loop=1&playlist=${ve.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                            ) : ve.type === 'video' ? (
                              <video className="w-full h-full object-cover" src={ve.url} autoPlay muted loop playsInline />
                            ) : (
                              <iframe className="w-full h-full" src={ve.url} allowFullScreen />
                            )}
                          </div>
                        );
                      })()}
                      {product.images.length > 0 ? product.images.map((img: string, i: number) => (
                        <div key={i} style={{ width: `${100 / totalMedia}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }}
                          onClick={() => { setPreviewImg(img); setPreviewProduct(product); }}>
                          <img src={img} alt={product.name} className="w-full h-full object-cover cursor-pointer" loading="lazy" />
                        </div>
                      )) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ width: `${100 / totalMedia}%`, color: textMuted }}>
                          <ShoppingBag size={48} strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    
                    {/* Badge */}
                    <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                      <Flame size={12} className="text-orange-400" /> {product.badge}
                    </div>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {[...Array(totalMedia)].map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${curIdx === idx ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/50'}`}></div>
                      ))}
                    </div>

                    {totalMedia > 1 && (
                      <>
                        <button onClick={() => goTo(curIdx - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                          <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => goTo(curIdx + 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}
                  </div>
                  );
                })()}

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold leading-tight w-2/3" style={{ color: textColor }}>{product.name}</h2>
                    <div className="text-right">
                      {product.oldPrice > product.price && (
                          <div className="text-xs line-through font-medium" style={{ color: textMuted }}>{product.oldPrice} DA</div>
                      )}
                      <div className="text-xl font-black" style={{ color: accentColor }}>{product.price} DA</div>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: textMuted }}>{product.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {product.features.map((f: string) => (
                      <span key={f} className="text-[10px] font-bold px-2 py-1 rounded-md italic" style={{ color: textMuted, backgroundColor: surfaceMuted, border: `1px solid ${borderColor}` }}># {f}</span>
                    ))}
                  </div>

                  <button 
                    onClick={() => handleSelectProduct(product)}
                    className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    اطلب الآن
                    <ArrowRight size={18} />
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold" style={{ color: textMuted }}>
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    +45 توصيل هذا الصباح في الجزائر
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Social Proof Section */}
          {(showSocialProof || canManage) && (
          <section className="px-6 py-10 bg-slate-900 text-white rounded-t-[40px] mt-10 relative overflow-visible" data-edit-path="social-proof">
            {canManage && (
                <div className="absolute -bottom-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-[60]">
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
            <div className="w-full max-w-[480px] rounded-t-[40px] p-8 animate-slide-up relative max-h-[90vh] overflow-y-auto [scrollbar-hide::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ backgroundColor: cardBg }}>
              
              <button 
                onClick={() => { handleCloseCheckout(); setOrderStatus('idle'); }}
                className="absolute top-6 right-8 transition-colors" style={{ color: textMuted }}
              >
                <X size={28} />
              </button>

              {orderStatus === 'success' ? (
                <div className="py-16 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: accentColor + '20' }}>
                    <CheckCircle2 size={40} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black" style={{ color: accentColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
                    <p className="mt-2 px-6" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
                  </div>
                  <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={submittedPhone} />
                  <div className="text-right rounded-xl p-4 space-y-2 border" style={{ backgroundColor: surfaceMuted, borderColor: borderColor }}>
                    <div className="flex justify-between text-sm">
                      <span>{selectedProduct?.name || 'المنتج'} × {selectedOffer?.quantity || quantity}</span>
                      <span className="font-bold">{Math.round(Number(selectedOffer?.bundle_price || (selectedProduct?.price || 0) * quantity)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: textMuted }}>التوصيل</span>
                      <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${settings?.currency_code || 'دج'}`}</span>
                    </div>
                    <div className="h-px my-1" style={{ backgroundColor: borderColor }} />
                    <div className="flex justify-between font-black">
                      <span>المجموع</span>
                      <span style={{ color: accentColor }}>{Math.round(Number(selectedOffer?.bundle_price || (selectedProduct?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleCloseCheckout}
                    className="w-full text-white font-bold py-5 rounded-2xl"
                    style={{ backgroundColor: accentColor }}
                  >
                    تسوق مرة أخرى
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: borderColor }}>
                    <img src={selectedProduct?.images[0]} className="w-20 h-20 rounded-2xl object-cover border" alt="" loading="lazy" style={{ borderColor: borderColor }} />
                    <div>
                      <h4 className="font-bold" style={{ color: textColor }}>{selectedProduct?.name}</h4>
                      <p className="font-black" style={{ color: accentColor }}>{selectedProduct?.price} DA</p>
                    </div>
                  </div>

                  <form className="space-y-5" onSubmit={handleOrder}>
                    {/* Variants */}
                    {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                      <VariantSelector 
                        variants={selectedProduct.variants} 
                        selected={selectedVariant} 
                        onSelect={setSelectedVariant} 
                        accentColor={accentColor} 
                        currency={settings?.currency_code || 'دج'} 
                        basePrice={selectedProduct.price} 
                      />
                    )}

                    {/* Offers */}
                    {offers.length > 0 && (
                      <OfferSelector 
                        offers={offers} 
                        unitPrice={selectedProduct?.price || 0} 
                        currency={settings?.currency_code || 'دج'} 
                        selectedOfferId={selectedOffer?.offer_id ?? null} 
                        onSelect={handleOfferSelect} 
                        accentColor={accentColor} 
                        textColor={textColor} 
                        borderColor={borderColor} 
                        bgColor={cardBg}
                      />
                    )}
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>الاسم واللقب</label>
                          <input required name="name" type="text" placeholder="مثال: محمد علامي" className="w-full px-4 py-3 rounded-xl outline-none transition-all" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>رقم الهاتف</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2" size={16} style={{ color: textMuted }} />
                            <input required name="phone" type="tel" maxLength={10} placeholder="05 / 06 / 07 XX XX XX XX" className="w-full pl-12 pr-5 py-3 rounded-xl outline-none transition-all" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>الولاية</label>
                          <select name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-4 py-3 rounded-xl outline-none transition-all text-sm font-medium" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor}>
                            <option value="">اختر...</option>
                            {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                          </select>
                        </div>
                        {showCommune && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>البلدية</label>
                            <div className="relative">
                              <select name="commune" required disabled={!selectedWilayaId} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} className="w-full px-4 py-3 rounded-xl outline-none transition-all text-sm appearance-none disabled:opacity-50" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor}>
                                <option value="">{selectedWilayaId ? 'اختر...' : 'اختر الولاية أولاً'}</option>
                                {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                              </select>
                              <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {showAddress && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>العنوان</label>
                          <input name="address" type="text" placeholder="أدخل عنوانك" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl outline-none transition-all text-sm" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                        </div>
                      )}

                      {showNotes && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider" style={{ color: textMuted }}>ملاحظات</label>
                          <textarea name="notes" placeholder="ملاحظات إضافية" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl outline-none transition-all text-sm resize-none" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} rows={2} />
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="pt-2">
                      <label className="text-[11px] font-black uppercase mb-2 block" style={{ color: textMuted }}>الكمية</label>
                      <div className="flex items-center justify-between rounded-xl p-1" style={{ backgroundColor: surfaceMuted, border: `1px solid ${borderColor}` }}>
                        <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, color: textColor }}>−</button>
                        <span className="font-black text-lg">{quantity}</span>
                        <button type="button" onClick={() => setQuantity(Math.min(selectedProduct?.stock_quantity ?? 999, quantity + 1))} className="w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, color: textColor }}>+</button>
                      </div>
                    </div>

                    {/* Delivery Type Buttons */}
                    {(showHomeDelivery || showDeskDelivery) && (
                      <div>
                        <label className="text-[11px] font-black uppercase mb-2 block" style={{ color: textMuted }}>نوع التوصيل</label>
                        <div className="grid grid-cols-2 gap-3">
                          {showHomeDelivery && (
                            <button type="button" onClick={() => setSelectedDeliveryType('home')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'home' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : cardBg, color: selectedDeliveryType === 'home' ? accentColor : textColor }}>
                              <Home size={16} />
                              <span>التوصيل للمنزل</span>
                            </button>
                          )}
                          {showDeskDelivery && (
                            <button type="button" onClick={() => setSelectedDeliveryType('desk')} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-bold" style={{ borderColor: selectedDeliveryType === 'desk' ? accentColor : borderColor, backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : cardBg, color: selectedDeliveryType === 'desk' ? accentColor : textColor }}>
                              <Building2 size={16} />
                              <span>الاستلام من المكتب</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Price Breakdown */}
                    {selectedWilayaId && (
                      <div className="p-4 rounded-2xl space-y-2 border" style={{ backgroundColor: surfaceMuted, borderColor: borderColor }}>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold" style={{ color: textColor }}>سعر المنتج{selectedOffer ? ` (${selectedOffer.quantity} قطعة)` : ` (${quantity})`}</span>
                          <span className="font-black">{Math.round(Number(selectedOffer?.bundle_price || (selectedProduct?.price || 0) * quantity)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold" style={{ color: textColor }}>التوصيل</span>
                          <span className="font-black">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${settings?.currency_code || 'دج'}`}</span>
                        </div>
                        <div className="h-px" style={{ backgroundColor: borderColor }} />
                        <div className="flex justify-between">
                          <span className="font-black text-lg">المجموع</span>
                          <span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(Number(selectedOffer?.bundle_price || (selectedProduct?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                        </div>
                      </div>
                    )}

                    {orderError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl text-center whitespace-pre-line text-start" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                        {orderError}
                      </div>
                    )}

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

      {/* Image Preview Lightbox */}
      {previewImg && previewProduct && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center select-none" onClick={() => { setPreviewImg(null); setPreviewProduct(null); }}>
          <button onClick={() => { setPreviewImg(null); setPreviewProduct(null); }} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xl z-10">✕</button>
          <div className="flex-1 flex items-center justify-center w-full relative"
            onTouchStart={e => { (e.currentTarget as any)._px = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = (e.currentTarget as any)._px - e.changedTouches[0].clientX;
              if (Math.abs(dx) < 50) return;
              const imgs = previewProduct.images;
              if (imgs.length <= 1) return;
              const cur = imgs.indexOf(previewImg);
              const n = dx > 0
                ? (cur + 1) % imgs.length
                : (cur - 1 + imgs.length) % imgs.length;
              setPreviewImg(imgs[n]);
            }}>
            <img src={previewImg} alt="" className="max-w-full max-h-[70vh] object-contain px-4" onClick={e => e.stopPropagation()} />
            {previewProduct.images.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); const imgs = previewProduct.images; const cur = imgs.indexOf(previewImg); setPreviewImg(imgs[(cur - 1 + imgs.length) % imgs.length]); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white z-10 backdrop-blur-md">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); const imgs = previewProduct.images; const cur = imgs.indexOf(previewImg); setPreviewImg(imgs[(cur + 1) % imgs.length]); }}
                  className="absolute right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white z-10 backdrop-blur-md">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          {previewProduct.images.length > 1 && (
            <div className="flex gap-2 mb-6 px-4 overflow-x-auto max-w-full">
              {previewProduct.images.map((img: string, i: number) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setPreviewImg(img); }}
                  className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${previewImg === img ? 'border-white opacity-100' : 'border-transparent opacity-50'}`}>
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
