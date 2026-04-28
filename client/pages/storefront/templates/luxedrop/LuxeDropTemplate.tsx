import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function LuxeDropTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView }: TemplateProps) {
        const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#d4af37';
    const bgColor = settings?.template_bg_color || '#0a0a0a';
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
        const productId = settings?.luxd_main_product_id;
    const product = (productId ? products?.find((p: any) => p.id === productId) : null) || products?.[0];
    const hasProductImages = product?.images && product.images.length > 0;

    useEffect(() => { if (product && onProductView) onProductView(product); }, [product?.id]);

    // Countdown State
    const [timeLeft, setTimeLeft] = useState({ min: 14, sec: 59 });

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev.sec > 0) return { min: prev.min, sec: prev.sec - 1 };
                if (prev.min > 0) return { min: prev.min - 1, sec: 59 };
                return prev; // Stop at 0
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Social Proof State
    const [socialProof, setSocialProof] = useState<{name: string, visible: boolean}>({ name: '', visible: false });
    const buyers = ["كمال من وهران", "سارة من تيزي وزو", "أحمد من سطيف", "ياسين من قسنطينة", "ليلى من عنابة", "محمد من العاصمة"];

    useEffect(() => {
        const showProof = () => {
            setSocialProof({ 
                name: buyers[Math.floor(Math.random() * buyers.length)], 
                visible: true 
            });
            setTimeout(() => setSocialProof(prev => ({ ...prev, visible: false })), 5000);
        };
        const initial = setTimeout(showProof, 3000);
        const interval = setInterval(showProof, 15000);
        return () => { clearTimeout(initial); clearInterval(interval); };
    }, []);

    // Inject fonts and icons
    useEffect(() => {
        if (!document.getElementById('phosphor-icons')) {
            const script = document.createElement('script');
            script.id = 'phosphor-icons';
            script.src = 'https://unpkg.com/@phosphor-icons/web';
            document.head.appendChild(script);
        }
        if (!document.getElementById('cairo-font')) {
            const link = document.createElement('link');
            link.id = 'cairo-font';
            link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
  const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const { showAddress, showCommune, showNotes } = useOrderFields(settings);
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
                    customer_address: [selectedWilaya?.labelAR || '', fd.get('commune'), fd.get('address'), fd.get('notes')].filter(Boolean).join(' - '),
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

    // Images state
    const [mainImage, setMainImage] = useState<string>(product?.images?.[0] || "");
    const [t1Image, setT1Image] = useState<string>(product?.images?.[1] || "");
    const [t2Image, setT2Image] = useState<string>(product?.images?.[2] || "");
    const [t3Image, setT3Image] = useState<string>(product?.images?.[3] || "");
    const [t4Image, setT4Image] = useState<string>(product?.images?.[4] || "");
    const [showVideo, setShowVideo] = useState(true);
    const videoUrl = (product as any)?.metadata?.video_url || '';
    const videoEmbed = useMemo(() => {
      if (!videoUrl) return null;
      const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (yt) return { type: 'youtube' as const, id: yt[1] };
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
      return { type: 'iframe' as const, url: videoUrl };
    }, [videoUrl]);

    // Swipe support
    const swipeTouchStartX = useRef<number | null>(null);
    const handleSwipeStart = (e: React.TouchEvent) => { swipeTouchStartX.current = e.touches[0].clientX; };
    const handleSwipeEnd = (e: React.TouchEvent, images: string[]) => {
      if (swipeTouchStartX.current === null) return;
      const diff = swipeTouchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        const cur = images.indexOf(mainImage);
        const next = diff > 0 ? Math.min(cur + 1, images.length - 1) : Math.max(cur - 1, 0);
        if (images[next]) setMainImage(images[next]);
      }
      swipeTouchStartX.current = null;
    };

    // Auto-sync images when product changes
    useEffect(() => {
        if (product?.images) {
            setMainImage(product.images[0] || "");
            setT1Image(product.images[1] || "");
            setT2Image(product.images[2] || "");
            setT3Image(product.images[3] || "");
            setT4Image(product.images[4] || "");
        }
        setShowVideo(!!videoEmbed);
    }, [product?.id]);


    const fileMainRef = useRef<HTMLInputElement>(null);
    const fileT1Ref = useRef<HTMLInputElement>(null);
    const fileT2Ref = useRef<HTMLInputElement>(null);
    const fileT3Ref = useRef<HTMLInputElement>(null);
    const fileT4Ref = useRef<HTMLInputElement>(null);

    const handleImgUpload = (setter: React.Dispatch<React.SetStateAction<string>>, isThumbnail = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                if (evt.target?.result) {
                    const result = evt.target.result as string;
                    setter(result);
                    if (isThumbnail) setMainImage(result); // Click thumb => show main too
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleThumbClick = (imgSrc: string) => {
        if (imgSrc) setMainImage(imgSrc);
    };

    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const allImages = product?.images && product.images.length > 0 ? product.images : [mainImage, t1Image, t2Image, t3Image, t4Image].filter(Boolean);
    const extraImages = product?.images && product.images.length > 5 ? product.images.slice(5) : [];
    const thumbBase = [t1Image, t2Image, t3Image, t4Image];
    const thumbImages = [...thumbBase.filter(Boolean), ...extraImages];

    const scrollToOrder = () => {
        document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: bgColor, color: textColor }} className="min-h-screen pb-24" dir="rtl">
            <style>{`
                .lux-gold-gradient { background: linear-gradient(90deg, ${accentColor} 0%, #f9e076 50%, ${accentColor} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .lux-gold-bg { background: linear-gradient(90deg, ${accentColor} 0%, #f9e076 100%); }
                .lux-glass-card { background: ${surfaceColor}; backdrop-filter: blur(10px); border: 1px solid ${surfaceBorderColor}; }
                .lux-img-slot { aspect-ratio: 1/1; background: ${surfaceMuted}; border: 2px dashed ${borderColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; }
                .lux-img-slot img { width: 100%; height: 100%; object-fit: cover; }
                [contenteditable="true"]:focus { outline: 2px solid ${accentColor}; background: rgba(212, 175, 55, 0.1); padding: 0 4px; border-radius: 4px; }
                @keyframes slideInLux { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .lux-notification-pop { animation: slideInLux 0.5s ease-out; }
            `}</style>

            {/* Top Banner */}
            <div className="text-center py-1 text-sm font-bold" style={{ backgroundColor: accentColor, color: isLight(accentColor) ? '#1e293b' : '#ffffff' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_banner')}>
                {settings?.luxd_banner || "🔥 عرض خاص: ينتهي العرض عند انتهاء العداد"}
            </div>

            {/* Header */}
            <header className="p-4 flex justify-between items-center border-b" style={{ borderColor }}>
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: accentColor + '66' }} />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm lux-gold-gradient">
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-black lux-gold-gradient">{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs" style={{ color: textMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_visitors')}>
                        {settings?.luxd_visitors || "142 متسوق حالياً"}
                    </span>
                </div>
            </header>

            {/* Product Showcase */}
            <main className="max-w-6xl mx-auto px-4 mt-4 lg:grid lg:grid-cols-[1fr_420px] lg:gap-10 lg:items-start">

                {/* Left Column: Images (wraps on mobile) */}
                <div className="lg:sticky lg:top-20">
                
                {/* Main Image Container */}
                <div className="lux-img-slot rounded-3xl mb-3 select-none" style={{ aspectRatio: '4/5', maxHeight: '560px' }}
                    onTouchStart={handleSwipeStart}
                    onTouchEnd={e => handleSwipeEnd(e, allImages)}
                    onClick={() => { if (videoEmbed && showVideo) return; canManage ? fileMainRef.current?.click() : mainImage && setZoomImage(mainImage); }}>
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
                    ) : mainImage ? (
                        <img src={mainImage} alt="Main" className="pointer-events-none" />
                    ) : ( 
                        <div className="text-center" style={{ color: textMuted }}>
                            <i className="ph ph-camera text-5xl"></i>
                            <p className="text-sm mt-2">انقر لإضافة الصورة الأساسية</p>
                        </div>
                   )}
                   {canManage && !showVideo && <input type="file" ref={fileMainRef} className="hidden" accept="image/*" onChange={handleImgUpload(setMainImage)} /> }
                </div>
                {/* Dot indicators + video indicator */}
                {(videoEmbed || allImages.length > 1) && (
                  <div className="flex justify-center gap-1.5 mb-3 items-center">
                    {videoEmbed && (
                      <button onClick={() => setShowVideo(true)} className="w-7 h-5 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: showVideo ? '#000' : accentColor + '40', border: showVideo ? `2px solid ${accentColor}` : '2px solid transparent' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </button>
                    )}
                    {allImages.map((img, i) => (
                      <button key={i} onClick={() => { setShowVideo(false); setMainImage(img); }}
                        className="rounded-full transition-all"
                        style={{ width: !showVideo && mainImage === img ? 20 : 6, height: 6, backgroundColor: !showVideo && mainImage === img ? accentColor : accentColor + '40' }}
                      />
                    ))}
                  </div>
                )}

                {/* Thumbnails (horizontal, supports extra product images) */}
                <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
                    {thumbImages.map((img, idx) => {
                        if (idx < 4) {
                            const slotRef = idx === 0 ? fileT1Ref : idx === 1 ? fileT2Ref : idx === 2 ? fileT3Ref : fileT4Ref;
                            const slotImg = [t1Image, t2Image, t3Image, t4Image][idx];
                            const slotSetter = idx === 0 ? setT1Image : idx === 1 ? setT2Image : idx === 2 ? setT3Image : setT4Image;
                            return (
                                <div key={idx} className="lux-img-slot rounded-xl h-24" onClick={() => (!slotImg && canManage) ? slotRef.current?.click() : handleThumbClick(slotImg)}>
                                    {slotImg ? <img src={slotImg} /> : <i className="ph ph-plus text-gray-600"></i>}
                                    {!slotImg && canManage && <input type="file" ref={slotRef} className="hidden" accept="image/*" onChange={handleImgUpload(slotSetter, true)} /> }
                                </div>
                            );
                        }
                        return (
                            <button key={idx} onClick={() => handleThumbClick(img)} className="flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden cursor-pointer" style={{ backgroundColor: surfaceMuted }}>
                                <img src={img} className="w-full h-full object-cover" />
                            </button>
                        );
                    })}
                </div>

                </div>{/* end left column */}

                {/* Right Column: Details + Form */}
                <div>

                {/* Title & Price */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-bold leading-tight" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_title')}>
                        {settings?.luxd_title || product?.title || `ساعة "إمبراطور" الفاخرة - إصدار محدود`}
                    </h1>
                    <div className="flex justify-center items-center gap-4">
                        <span className="text-3xl font-black" style={{ color: textColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_price')}>
                            {Math.round(product?.price ?? 8500).toLocaleString()} دج
                        </span>
                        <span className="text-lg line-through" style={{ color: textMuted }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_compare_price')}>
                            {(product as any)?.compare_at_price ? `${Math.round((product as any).compare_at_price ?? 0).toLocaleString()} دج` : "12000 دج"}
                        </span>
                    </div>
                    <p className="text-green-400 font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_savings')}>
                        {settings?.luxd_savings || "وفرت 3500 دج اليوم!"}
                    </p>
                </div>

                {/* Countdown */}
                <div className="lux-glass-card rounded-2xl p-4 mb-8 text-center">
                    <p className="text-sm mb-2" style={{ color: textMuted }}>ينتهي هذا العرض في:</p>
                    <div className="flex justify-center gap-4 text-2xl font-bold">
                        <div><span>{timeLeft.min.toString().padStart(2, '0')}</span><p className="text-[10px] uppercase" style={{ color: textMuted }}>دقيقة</p></div>
                        <div style={{ color: accentColor }}>:</div>
                        <div><span>{timeLeft.sec.toString().padStart(2, '0')}</span><p className="text-[10px] uppercase" style={{ color: textMuted }}>ثانية</p></div>
                    </div>
                </div>

                {/* Quick Features */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 p-3 lux-glass-card rounded-xl">
                        <i className="ph ph-seal-check text-2xl" style={{ color: accentColor }}></i>
                        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_feat1')}>
                            {settings?.luxd_feat1 || "جودة عالية وضمان لمدة سنة كاملة"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 lux-glass-card rounded-xl">
                        <i className="ph ph-truck text-2xl" style={{ color: accentColor }}></i>
                        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_feat2')}>
                            {settings?.luxd_feat2 || "توصيل سريع مجاني لباب المنزل"}
                        </span>
                    </div>
                </div>

                {/* Sticky Form Section */}
                <div id="order-form" className="p-6 rounded-3xl mb-8" style={{ backgroundColor: surfaceColor, color: surfaceTextColor }}>
                    <h3 className="text-xl font-black mb-4 text-center" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_form_title')}>
                        {settings?.luxd_form_title || "املأ المعلومات لإتمام الطلب"}
                    </h3>
                    {orderSuccess ? (
                        <div className="p-6 rounded-3xl border text-center" style={{ backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderColor: isDark ? 'rgba(34,197,94,0.3)' : '#bbf7d0' }}>
                            <h3 className="text-2xl font-black mb-2" style={{ color: isDark ? '#4ade80' : '#15803d' }}>تم الشراء بنجاح!</h3>
                            <p className="font-bold" style={{ color: surfaceTextMuted }}>سنتصل بك لتأكيد طلبك في أقرب وقت.</p>
                            <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
                        </div>
                    ) : (
                    <form className="space-y-4" onSubmit={handleOrder}>
                        {product?.variants && product.variants.length > 0 && (
                          <VariantSelector
                            variants={product.variants}
                            selected={selectedVariant}
                            onSelect={setSelectedVariant}
                            accentColor={accentColor}
                            currency="دج"
                            basePrice={product.price}
                          />
                        )}
                        {offers.length > 0 && (
                          <OfferSelector
                            offers={offers}
                            unitPrice={product?.price || 0}
                            currency="دج"
                            selectedOfferId={selectedOffer?.offer_id ?? null}
                            onSelect={handleOfferSelect}
                            accentColor={accentColor}
                            textColor={surfaceTextColor}
                            borderColor={surfaceBorderColor}
                          />
                        )}
                        <input required name="name" type="text" placeholder="الاسم الكامل" className="w-full p-4 rounded-xl font-bold outline-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'} />
                        <input required name="phone" type="tel" placeholder="رقم الهاتف" className="w-full p-4 rounded-xl font-bold outline-none text-left" dir="ltr" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'} />
                        <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full p-4 rounded-xl font-bold outline-none text-right" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'}>
                            <option value="">اختر الولاية</option>
                            {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                        </select>
                        {selectedWilayaId && (
                            <div className="p-3 rounded-xl text-sm space-y-2" style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #a7f3d0' }}>
                                <div className="flex justify-between" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                                    <span>سعر المنتجات</span>
                                    <span className="font-bold" style={{ color: surfaceTextColor }}>{Math.round(productTotal ?? 0).toLocaleString()} دج</span>
                                </div>
                                <div className="flex justify-between" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                                    <span>سعر التوصيل</span>
                                    <span className="font-bold" style={{ color: isDark ? '#34d399' : '#047857' }}>{Math.round(deliveryFee ?? 0).toLocaleString()} دج</span>
                                </div>
                                <div className="flex justify-between pt-2" style={{ borderTop: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #a7f3d0' }}>
                                    <span className="font-bold" style={{ color: surfaceTextColor }}>التكلفة الإجمالية</span>
                                    <span className="font-black" style={{ color: isDark ? '#34d399' : '#047857' }}>{Math.round(grandTotal ?? 0).toLocaleString()} دج</span>
                                </div>
                            </div>
                        )}
                        {showCommune && <input name="commune" type="text" placeholder="البلدية" className="w-full p-4 rounded-xl font-bold outline-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'} />}
                        {showAddress && <input name="address" type="text" placeholder="العنوان" className="w-full p-4 rounded-xl font-bold outline-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'} />}
                        {showNotes && <textarea name="notes" placeholder="ملاحظات" rows={2} className="w-full p-4 rounded-xl font-bold outline-none resize-none" style={{ backgroundColor: inputBg, color: surfaceTextColor, border: `1px solid ${surfaceBorderColor}` }} onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`} onBlur={e => e.currentTarget.style.boxShadow = 'none'} />}
                        <button disabled={isSubmitting} type="submit" className="w-full lux-gold-bg text-black py-5 rounded-xl text-xl font-black shadow-xl uppercase disabled:opacity-50">
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_form_btn')}>
                                {isSubmitting ? "جاري الشراء..." : (settings?.luxd_form_btn || settings?.template_button_text || "تأكيد الشراء الآن")}
                            </span>
                        </button>
                    </form>
                    )}
                </div>

                </div>{/* end right column */}
            </main>

            {/* Fake Social Proof Popup */}
            <div className={`fixed bottom-24 left-4 right-4 md:left-auto md:w-80 lux-glass-card p-3 rounded-2xl flex items-center gap-3 lux-notification-pop z-40 transition-all duration-300 ${socialProof.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: surfaceMuted }}>
                    <i className="ph ph-user text-xl"></i>
                </div>
                <div className="text-xs">
                    <p><strong>{socialProof.name}</strong></p>
                    <p style={{ color: textMuted }}>طلب هذا المنتج منذ 3 دقائق</p>
                </div>
            </div>

            {/* Sticky Bottom Bar - mobile only */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 backdrop-blur-md border-t flex items-center gap-4 z-50" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)', borderColor }}>
                <div className="flex-1">
                    <div className="text-xs" style={{ color: textMuted }}>السعر الإجمالي:</div>
                    <div className="text-lg font-bold lux-gold-gradient">
                        {Math.round((product?.price ?? 0) + deliveryFee).toLocaleString()} دج
                    </div>
                </div>
                <button onClick={scrollToOrder} className="flex-[2] lux-gold-bg text-black py-3 rounded-xl font-black flex items-center justify-center gap-2">
                    <i className="ph ph-shopping-cart-simple text-xl"></i>
                    اطلب الآن
                </button>
            </div>

            {/* Platform Footer */}
            <div className="pb-20 text-center py-6 text-xs" style={{ color: textMuted }}>
                © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
            </div>

            {/* Image Zoom Modal */}
            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
                        ✕
                    </button>
                    <img src={zoomImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
                    {allImages.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                            {allImages.map((img, i) => (
                                <div
                                    key={i}
                                    className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all"
                                    style={{ border: zoomImage === img ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.3)', opacity: zoomImage === img ? 1 : 0.6 }}
                                    onClick={(e) => { e.stopPropagation(); setZoomImage(img); }}
                                >
                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
