import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ShoppingCart, Truck, ShieldCheck, Star,
  ChevronDown, Phone, ArrowDownCircle, Settings, X,
  Home, Building2
} from 'lucide-react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function LuminaTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState({ h: 2, m: 47, s: 33 });
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(prev => {
      if (prev.s > 0) return { ...prev, s: prev.s - 1 };
      if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
      if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
      return prev;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const { wilayas } = useStoreDeliveryPrices(storeSlug);
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
  const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
  const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [commune, setCommune] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Main product
  const mainProduct = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null)
    || (settings?.dzp_main_product_id
    ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id))
    : null) || products?.[0] || {
    id: 0,
    title: 'منتج مميز',
    price: 3900,
    original_price: 6500,
    images: [],
  };

  useEffect(() => { if (mainProduct?.id && onProductView) onProductView(mainProduct as any); }, [mainProduct?.id]);

  // Variant system
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

  // Offers system
  const { offers } = useProductOffers(storeSlug, mainProduct?.id);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); setQuantity(f.quantity); } }, [offers]);
  const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); if (o) setQuantity(o.quantity); else setQuantity(1); };
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);

  const productPrice = mainProduct?.price ?? 3900;
  const originalPrice = (mainProduct as any)?.original_price ?? null;
  const productImages = mainProduct?.images && mainProduct.images.length > 0 ? mainProduct.images : [];

  const videoUrl = (mainProduct as any)?.metadata?.video_url || '';
  const videoEmbed = useMemo(() => {
    if (!videoUrl) return null;
    const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return { type: 'youtube' as const, id: yt[1] };
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
    return { type: 'iframe' as const, url: videoUrl };
  }, [videoUrl]);

  // Theme from editor settings
  const accentColor = settings?.template_accent_color || propPrimaryColor || '#e11d48'; // rose-600
  const primaryBg = settings?.primary_color || '#0f172a'; // slate-900
  const bgColor = settings?.template_bg_color || '#ffffff';
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

  // Editable text fields (contentEditable for editor mode)
  const storeName = settings?.lumina_store_name || settings?.store_name || 'LUMINA';
  const tagline = settings?.lumina_tagline || 'EAU DE PARFUM';
  const announcement = settings?.lumina_announcement || settings?.template_hero_heading || 'توصيل مجاني للطلبات أكثر من حبتين!';
  const offerText = settings?.lumina_offer_text || '🔥 تخفيض لفترة محدودة 🔥';
  const ctaText = settings?.lumina_cta_text || settings?.template_button_text || 'أطلب الآن وادفع لاحقاً';
  const formTitle = settings?.lumina_form_title || 'أدخل معلوماتك للطلب';
  const formSubtitle = settings?.lumina_form_subtitle || 'لن تدفع شيئاً حتى تستلم منتجك';
  const submitText = settings?.lumina_submit_text || 'تأكيد الطلب';
  const socialProofText = settings?.lumina_social_proof || '+240 عميل سعيد هذا الشهر';
  const badge1Text = settings?.lumina_badge1 || 'ضمان الجودة';
  const badge2Text = settings?.lumina_badge2 || 'الدفع عند الاستلام';
  const badge3Text = settings?.lumina_badge3 || 'توصيل لـ 58 ولاية';
  const footerText = settings?.lumina_footer_text || 'علامة تجارية مسجلة. جميع الحقوق محفوظة';
  const showCountdown = settings?.lumina_show_countdown !== false;

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
  const allFeatures = [
    { icon: <Star size={24} style={{ color: '#fbbf24' }} />, title: settings?.lumina_feat1_title || 'مكونات فاخرة', desc: settings?.lumina_feat1_desc || 'مزيج ساحر من العود الملكي والفانيليا الدافئة.', idx: 1 },
    { icon: <Truck size={24} style={{ color: accentColor }} />, title: settings?.lumina_feat2_title || 'ثبات يدوم طويلاً', desc: settings?.lumina_feat2_desc || 'تركيز عالي يضمن لك بقاء العطر على ملابسك.', idx: 2 },
    { icon: <ShieldCheck size={24} style={{ color: accentColor }} />, title: settings?.lumina_feat3_title || '', desc: settings?.lumina_feat3_desc || '', idx: 3 },
    { icon: <ShoppingCart size={24} style={{ color: accentColor }} />, title: settings?.lumina_feat4_title || '', desc: settings?.lumina_feat4_desc || '', idx: 4 },
  ];
  const features = allFeatures.filter(f => f.title.trim().length > 0);

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
      const address = [selectedWilaya?.labelAR || '', commune, customerAddress, customerNotes].filter(Boolean).join(' - ');

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: mainProduct.id,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
          quantity: selectedOffer?.quantity || quantity,
          ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
          total_price: selectedOffer ? selectedOffer.bundle_price : productPrice * quantity,
          delivery_fee: deliveryFee,
          delivery_type: selectedDeliveryType,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: address,
          shipping_wilaya_id: selectedWilayaId,
        }),
      });

      const data = await res.json();
      setLastOrderId(data.order?.id || null);
      setLastTelegramUrl(data.telegramStartUrl || null);
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: surfaceMuted }} dir="rtl">
        <div className="rounded-3xl p-8 shadow-xl text-center max-w-sm w-full" style={{ backgroundColor: surfaceColor }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <ShoppingCart size={36} style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: surfaceTextColor }}>تم تسجيل طلبك بنجاح! 🎉</h2>
          <p className="text-sm mb-6" style={{ color: surfaceTextMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
          <div className="rounded-xl p-4 text-sm space-y-2 text-right" style={{ backgroundColor: surfaceMuted }}>
            <div className="flex justify-between"><span style={{ color: surfaceTextMuted }}>المنتج:</span><span className="font-bold" style={{ color: surfaceTextColor }}>{mainProduct?.title}</span></div>
            <div className="flex justify-between"><span style={{ color: surfaceTextMuted }}>الكمية:</span><span className="font-bold" style={{ color: surfaceTextColor }}>{quantity}</span></div>
            <div className="flex justify-between"><span style={{ color: surfaceTextMuted }}>المبلغ:</span><span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(totalCost ?? 0).toLocaleString()} {currency}</span></div>
          </div>
          <button onClick={() => setOrderSuccess(false)} className="mt-6 w-full py-3 rounded-xl font-bold text-white" style={{ backgroundColor: primaryBg }}>
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: bgColor, color: textColor }} dir="rtl">

      {/* ANNOUNCEMENT BAR */}
      <div className="text-white text-center py-2.5 text-sm font-bold flex justify-center items-center gap-2" style={{ backgroundColor: accentColor }}>
        <Truck size={16} />
        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_announcement')}>
          {announcement}
        </span>
      </div>

      <div className="w-full lg:max-w-6xl lg:mx-auto lg:grid lg:grid-cols-2 lg:gap-0 lg:shadow-2xl min-h-screen relative" style={{ backgroundColor: surfaceColor }}>

        {/* HEADER */}
        <header className="py-6 text-center text-white relative z-10 lg:col-span-2" style={{ backgroundColor: primaryBg }}>
          {settings?.store_logo && <img src={settings.store_logo} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-2 border-2 border-white/20" />}
          <h1 className="text-4xl font-black tracking-wider" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_store_name')}>
            {storeName}
          </h1>
          <p className="text-white/80 text-sm mt-1 font-light tracking-widest" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_tagline')}>
            {tagline}
          </p>
        </header>

        {/* LEFT COL: images (desktop) */}
        <div className="lg:overflow-y-auto lg:sticky lg:top-0 lg:h-screen">

        {/* DYNAMIC IMAGE STACK */}
        {(videoEmbed || landingImages.length > 0) && (
          <div className="w-full flex flex-col">
            {videoEmbed && (
              <div className="w-full aspect-video">
                {videoEmbed.type === 'youtube' ? (
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoEmbed.id}?autoplay=1&mute=1&loop=1&playlist=${videoEmbed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                ) : videoEmbed.type === 'video' ? (
                  <video className="w-full h-full object-cover" src={videoEmbed.url} autoPlay muted loop playsInline />
                ) : (
                  <iframe className="w-full h-full" src={videoEmbed.url} allowFullScreen />
                )}
              </div>
            )}
            {landingImages.map((imgUrl, index) => (
              <img
                key={index}
                src={imgUrl}
                alt={`Product section ${index + 1}`}
                className="w-full h-auto object-cover cursor-pointer"
                loading={index === 0 ? 'eager' : 'lazy'}
                onClick={() => setZoomState({ images: landingImages, idx: index })}
              />
            ))}
          </div>
        )}

        {/* Fallback if no images */}
        {landingImages.length === 0 && (
          <div className="w-full aspect-square flex items-center justify-center" style={{ backgroundColor: surfaceMuted }}>
            <div className="text-center" style={{ color: surfaceTextMuted }}>
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">أضف صور المنتج من لوحة التحكم</p>
            </div>
          </div>
        )}

        </div>{/* end left col */}

        {/* RIGHT COL: price, form, features (desktop) */}
        <div className="lg:overflow-y-auto lg:h-screen pb-24">

        {/* PRICE & CTA BLOCK */}
        <div className="p-6 text-center border-y" style={{ backgroundColor: surfaceMuted, borderColor: surfaceBorderColor }}>
          {originalPrice && originalPrice > productPrice && (
            <p className="line-through text-lg" style={{ color: surfaceTextMuted }}>{Math.round(originalPrice ?? 0).toLocaleString()} {currency}</p>
          )}
          <div className="flex justify-center items-end gap-2 mb-2">
            <span className="text-5xl font-black" style={{ color: accentColor }}>{productPrice}</span>
            <span className="text-xl font-bold mb-1" style={{ color: surfaceTextColor }}>{currency}</span>
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

          {/* Countdown - toggleable */}
          {showCountdown && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs font-bold" style={{ color: surfaceTextMuted }}>ينتهي العرض خلال:</span>
            {[{ v: timeLeft.h, l: 'سا' }, { v: timeLeft.m, l: 'د' }, { v: timeLeft.s, l: 'ث' }].map(({ v, l }) => (
              <div key={l} className="flex items-center gap-0.5">
                <span className="text-white text-sm font-black w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                  {String(v).padStart(2, '0')}
                </span>
                <span className="text-xs" style={{ color: surfaceTextMuted }}>{l}</span>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* SOCIAL PROOF */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${surfaceBorderColor}` }}>
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {['#f97316','#e11d48','#8b5cf6','#0ea5e9'].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: c }}>
                {['أ','م','ي','س'][i]}
              </div>
            ))}
          </div>
          <div>
            <div className="flex gap-0.5 mb-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} size={10} fill={accentColor} style={{ color: accentColor }} />)}
            </div>
            <p className="text-xs font-bold" style={{ color: surfaceTextMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_social_proof')}>{socialProofText}</p>
          </div>
        </div>

        {/* TRUST BADGES */}
        <div className="grid grid-cols-3 gap-2 p-4 text-white" style={{ backgroundColor: primaryBg }}>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <ShieldCheck size={28} style={{ color: '#fbbf24' }} />
            <span className="text-[10px] font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_badge1')}>{badge1Text}</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <ShoppingCart size={28} style={{ color: accentColor }} />
            <span className="text-[10px] font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_badge2')}>{badge2Text}</span>
          </div>
          <div className="flex flex-col items-center text-center gap-2 p-2">
            <Truck size={28} style={{ color: accentColor }} />
            <span className="text-[10px] font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_badge3')}>{badge3Text}</span>
          </div>
        </div>

        {/* FEATURES SECTION */}
        {(features.length > 0 || canManage) && (
          <div className="p-6 space-y-3">
            {features.map((feat, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl p-4 border" style={{ backgroundColor: surfaceMuted, borderColor: surfaceBorderColor }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: primaryBg }}>
                  {feat.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`lumina_feat${feat.idx}_title`)}>
                    {feat.title}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: surfaceTextMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(`lumina_feat${i + 1}_desc`)}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
            {canManage && features.length < 4 && (
              <p className="text-center text-xs py-2 rounded-xl border border-dashed" style={{ color: surfaceTextMuted, borderColor: surfaceBorderColor }}>
                اكتب في حقل العنوان لإضافة ميزة جديدة — احذفه بتفريغ العنوان
              </p>
            )}
          </div>
        )}

        {/* CHECKOUT FORM */}
        <div ref={formRef} className="p-6" style={{ backgroundColor: surfaceMuted }} id="checkout">
          <div className="rounded-3xl p-6 shadow-lg border" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black" style={{ color: surfaceTextColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_form_title')}>
                {formTitle}
              </h2>
              <p className="text-sm mt-1" style={{ color: surfaceTextMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_form_subtitle')}>
                {formSubtitle}
              </p>
            </div>

            <form onSubmit={handleOrder} className="space-y-4">
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
                  unitPrice={productPrice}
                  currency={currency}
                  selectedOfferId={selectedOffer?.offer_id ?? null}
                  onSelect={handleOfferSelect}
                  accentColor={accentColor}
                  textColor={surfaceTextColor}
                  borderColor={surfaceBorderColor}
                />
              )}
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>الاسم الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="الاسم واللقب..."
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 outline-none"
                  style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>رقم الهاتف</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="05 55 55 55 55"
                    className="w-full border rounded-xl px-4 py-3 text-right focus:ring-2 outline-none"
                    style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Phone size={18} className="absolute left-4 top-3.5" style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              {/* Wilaya */}
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>الولاية</label>
                <div className="relative">
                  <select
                    className="w-full border rounded-xl px-4 py-3 appearance-none focus:ring-2 outline-none"
                    style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties}
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
                  <ChevronDown size={18} className="absolute left-4 top-3.5 pointer-events-none" style={{ color: surfaceTextMuted }} />
                </div>
              </div>

              {/* Commune */}
              {showCommune && <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>البلدية</label>
                <input
                  type="text"
                  placeholder="بلدية الإقامة..."
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 outline-none"
                  style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties}
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                />
              </div>}
              {showAddress && <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>العنوان</label>
                <input type="text" placeholder="عنوان التوصيل" className="w-full border rounded-xl px-4 py-3 focus:ring-2 outline-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>}
              {showNotes && <div>
                <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>ملاحظات</label>
                <textarea placeholder="ملاحظات إضافية" rows={2} className="w-full border rounded-xl px-4 py-3 focus:ring-2 outline-none resize-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, borderColor: surfaceBorderColor, '--tw-ring-color': accentColor } as React.CSSProperties} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />
              </div>}
              {(showHomeDelivery && showDeskDelivery) && (
                <div>
                  <label className="block text-sm font-bold mb-1" style={{ color: surfaceTextColor }}>نوع التوصيل</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('home')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'home' ? accentColor : inputBg,
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'home' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <Home size={16} />
                      <span className="text-sm font-bold">التوصيل للمنزل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryType('desk')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: selectedDeliveryType === 'desk' ? accentColor : inputBg,
                        border: `1px solid ${surfaceBorderColor}`,
                        color: selectedDeliveryType === 'desk' ? '#ffffff' : surfaceTextColor,
                      }}
                    >
                      <Building2 size={16} />
                      <span className="text-sm font-bold">الاستلام من المكتب</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="pt-2">
                <label className="block text-sm font-bold mb-2" style={{ color: surfaceTextColor }}>الكمية</label>
                <div className="flex items-center justify-between border rounded-xl p-1" style={{ backgroundColor: inputBg, borderColor: surfaceBorderColor }}>
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-lg shadow-sm font-bold text-xl" style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>-</button>
                  <span className="font-bold text-lg" style={{ color: surfaceTextColor }}>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-lg shadow-sm font-bold text-xl" style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>+</button>
                </div>
              </div>

              {/* Receipt */}
              <div className="text-white rounded-2xl p-5 shadow-inner mt-6" style={{ backgroundColor: primaryBg }}>
                <div className="flex justify-between text-sm mb-2 text-white/70">
                  <span>سعر المنتج ({quantity}):</span>
                  <span dir="ltr">{Math.round(productPrice * quantity).toLocaleString()} {currency}</span>
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
          <p className="text-sm" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('lumina_footer_text')}>{footerText} © {new Date().getFullYear()}</p>
          <p className="text-xs mt-2">صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a></p>
        </footer>

        </div>{/* end right col */}

        {/* STICKY BOTTOM BAR - mobile only */}
        <div className="lg:hidden fixed bottom-0 left-0 w-full z-50 p-4 backdrop-blur-md border-t" style={{ backgroundColor: surfaceColor + 'f2', borderColor: surfaceBorderColor }}>
          <div className="max-w-md mx-auto flex items-center gap-4">
            <div className="flex-1">
              <span className="text-xs font-bold block" style={{ color: surfaceTextMuted }}>السعر الحالي</span>
              <span className="text-lg font-black leading-none" style={{ color: accentColor }}>
                {Math.round(productPrice ?? 0).toLocaleString()} {currency}
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
