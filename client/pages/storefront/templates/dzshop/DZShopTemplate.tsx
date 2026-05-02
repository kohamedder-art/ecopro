import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TemplateProps, StoreProduct } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function DZShopTemplate({ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor, onProductView, initialProductSlug }: TemplateProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [orderSuccess, setOrderSuccess] = React.useState(false);
    const [lastOrderId, setLastOrderId] = React.useState<number | string | null>(null);
    const [lastTelegramUrl, setLastTelegramUrl] = React.useState<string | null>(null);
    const [lastCustomerPhone, setLastCustomerPhone] = React.useState<string | null>(null);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
    const [showBanner, setShowBanner] = useState(settings?.show_promotional_banner !== false);
    const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    useEffect(() => { if (wilayas.length > 0) { const stillValid = wilayas.some(w => w.id === selectedWilayaId); if (!selectedWilayaId || !stillValid) setSelectedWilayaId(wilayas[0].id); } }, [wilayas]);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const baseDeliveryFee = selectedWilaya ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice)) : 0;

    const handleDefaultOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const product = (initialProductSlug ? products?.find((p: any) => p.slug === initialProductSlug) : null) || (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];
        if (!product) return;
        setIsSubmitting(true);
        try {
            const fd = new FormData(e.currentTarget);
            const payload = {
                store_slug: storeSlug || settings?.store_name || 'dzshop',
                product_id: product.id,
                ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                quantity: selectedOffer?.quantity || 1,
                ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                total_price: selectedOffer ? selectedOffer.bundle_price : (product.price || 0),
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
            setLastOrderId(data.order?.id || null);
            setLastTelegramUrl(data.telegramStartUrl || null);
            setLastCustomerPhone(String(fd.get('phone') || ''));
            setOrderSuccess(true);
        } catch(err) {
            console.error(err);
            alert('حدث خطأ أثناء تقديم الطلب.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || propPrimaryColor || '#2563eb');
    const accentColor = settings?.template_accent_color || propPrimaryColor || primaryColor;
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

        const productId = settings?.dzp_main_product_id;
    const product = (productId ? products?.find((p: any) => String(p.id) === String(productId)) : null) || products?.[0];
    const hasProductImages = product?.images && product.images.length > 0;

    useEffect(() => { if (product && onProductView) onProductView(product); }, [product?.id]);

    // Variant system
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);

    // Offers system
    const { offers } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); } }, [offers]);
    const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);
    const productTotal = selectedOffer ? selectedOffer.bundle_price : ((selectedVariant?.price ?? product?.price ?? 0) * 1);
    const grandTotal = productTotal + deliveryFee;

    // Smart image classification: if any image is tall → stack all vertically
    const productImages = product?.images || [];
    const { classified, loading: classifyLoading } = useImageClassifier(productImages, 'dzshop');
    // Only trigger landing mode for truly long images (ratio < 0.5 = height > 2× width)
    const isLandingMode = !classifyLoading && classified.length > 0 && classified.some(c => c.ratio < 0.5);
    const galleryImages = isLandingMode ? [] : productImages;
    const autoBannerImage = null;
    const bottomBannerImage = null;

    useEffect(() => {
        if (settings?.primary_color) {
            setPrimaryColor(settings.primary_color);
        }
    }, [settings?.primary_color]);
    
    // Inject Phosphor Icons and Google Fonts
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
            link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&family=Inter:wght@400;600;700&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    // Set variable on root
    useEffect(() => {
        document.documentElement.style.setProperty('--dz-primary', primaryColor);
    }, [primaryColor]);

    const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.textContent || '';
        window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    };

    // Separate Refs for Top and Bottom Images
    const mainImagePlaceholderRef = useRef<HTMLDivElement>(null);
    const mainFileInputRef = useRef<HTMLInputElement>(null);
    
    const bottomImagePlaceholderRef = useRef<HTMLDivElement>(null);
    const bottomFileInputRef = useRef<HTMLInputElement>(null);

    const handleMainImageClick = () => { if(!canManage) return;  mainFileInputRef.current?.click(); }
    const handleBottomImageClick = () => { if(!canManage) return;  bottomFileInputRef.current?.click(); }

    const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && mainImagePlaceholderRef.current) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                if (mainImagePlaceholderRef.current && evt.target) {
                    mainImagePlaceholderRef.current.innerHTML = `<img src="${evt.target.result}" class="w-full h-full object-cover">`;
                    mainImagePlaceholderRef.current.classList.remove('image-placeholder');
                    mainImagePlaceholderRef.current.classList.remove('dz-image-placeholder');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleBottomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && bottomImagePlaceholderRef.current) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                if (bottomImagePlaceholderRef.current && evt.target) {
                    bottomImagePlaceholderRef.current.innerHTML = `<img src="${evt.target.result}" class="w-full h-full object-cover">`;
                    bottomImagePlaceholderRef.current.classList.remove('image-placeholder');
                    bottomImagePlaceholderRef.current.classList.remove('dz-image-placeholder');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Image Gallery State
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showVideo, setShowVideo] = useState(true);
    const videoUrl = (product as any)?.metadata?.video_url || '';
    const videoEmbed = useMemo(() => {
      if (!videoUrl) return null;
      const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (yt) return { type: 'youtube' as const, id: yt[1] };
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl)) return { type: 'video' as const, url: videoUrl };
      return { type: 'iframe' as const, url: videoUrl };
    }, [videoUrl]);
    useEffect(() => { setSelectedImageIndex(0); setShowVideo(!!videoEmbed); }, [product?.id]);

    // Swipe support
    const swipeTouchStartX = useRef<number | null>(null);
    const handleSwipeStart = (e: React.TouchEvent) => { swipeTouchStartX.current = e.touches[0].clientX; };
    const handleSwipeEnd = (e: React.TouchEvent, images: string[]) => {
      if (swipeTouchStartX.current === null) return;
      const diff = swipeTouchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) setSelectedImageIndex(i => diff > 0 ? Math.min(i + 1, images.length - 1) : Math.max(i - 1, 0));
      swipeTouchStartX.current = null;
    };
    const [zoomState, setZoomState] = useState<{ images: string[]; idx: number } | null>(null);

    return (
        <div className="min-h-screen relative pb-20 md:pb-0" style={{ fontFamily: "'Cairo', sans-serif", isolation: 'isolate', backgroundColor: bgColor, color: textColor }} dir="rtl">
            <style dangerouslySetInnerHTML={{ __html: `
                :root {
                    --dz-primary: ${primaryColor};
                    --dz-secondary: #f97316;
                    --dz-success: #22c55e;
                    --dz-bg: #f3f4f6;
                }
                .dz-checkout-card {
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                }
                .dz-sticky-order-bar {
                    box-shadow: 0 -4px 10px rgba(0,0,0,0.05);
                }
                [contenteditable="true"] {
                    outline: none;
                    transition: all 0.2s;
                    display: inline-block;
                    min-width: 20px;
                }
                [contenteditable="true"]:hover {
                    background: rgba(37, 99, 235, 0.05);
                    border-radius: 4px;
                    cursor: text;
                }
                [contenteditable="true"]:focus {
                    background: #fff;
                    box-shadow: 0 0 0 2px var(--dz-primary);
                    border-radius: 4px;
                    padding: 0 4px;
                }
                .dz-image-placeholder {
                    background: #e5e7eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px dashed #d1d5db;
                    cursor: pointer;
                    transition: 0.3s;
                }
                .dz-image-placeholder:hover {
                    background: #d1d5db;
                }
                .ph { vertical-align: middle; }
            `}} />

            {/* Top Bar Notice */}
            <div className="text-white text-center py-2 text-sm font-bold" style={{ backgroundColor: accentColor }}>
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_top_notice')}>
                    {settings?.template_top_notice || "التوصيل متوفر لـ 58 ولاية - الدفع عند الاستلام"}
                </span>
            </div>

            {/* Header */}
            <header className="border-b sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: accentColor }}>
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-extrabold" style={{ color: accentColor }}>{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex gap-4">
                    <i className="ph ph-shopping-cart text-2xl" style={{ color: textMuted }}></i>
                    <i className="ph ph-list text-2xl md:hidden" style={{ color: textMuted }}></i>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-4 md:py-8 lg:py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_420px] gap-6 lg:gap-10 relative z-10 items-start">
                
                {/* Left Column: Product Visuals */}
                <div className="space-y-3">
                    {/* Landing page mode: stack all tall images vertically */}
                    {isLandingMode ? (
                      <div className="flex flex-col rounded-2xl overflow-hidden shadow-sm gap-2">
                        {productImages.map((img: string, i: number) => (
                          <img key={i} src={img} alt={product?.title} className="w-full h-auto block cursor-pointer rounded-xl" onClick={() => setZoomState({ images: productImages, idx: i })} />
                        ))}
                      </div>
                    ) : (
                    <>
                    {/* Main Product Image */}
                    <div
                        className="rounded-2xl overflow-hidden shadow-sm relative group cursor-pointer select-none"
                        style={{ backgroundColor: surfaceColor, aspectRatio: '4 / 5', maxHeight: '520px' }}
                        onTouchStart={handleSwipeStart}
                        onTouchEnd={e => handleSwipeEnd(e, galleryImages)}
                        onClick={() => { if (videoEmbed && showVideo) return; hasProductImages && setZoomState({ images: galleryImages, idx: selectedImageIndex }); }}
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
                        ) : hasProductImages ? (
                            <img src={galleryImages[selectedImageIndex] || galleryImages[0]} alt={product.title} className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                            <>
                                <div className="dz-image-placeholder w-full h-full" ref={mainImagePlaceholderRef} onClick={handleMainImageClick}>
                                    <i className="ph ph-image text-4xl" style={{ color: textMuted }}></i>
                                    <p className="text-xs mt-2 absolute bottom-4" style={{ color: textMuted }}>انقر لتغيير الصورة (أو أضف منتج من لوحة التحكم)</p>
                                </div>
                                {canManage && <input type="file" ref={mainFileInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} /> }
                            </>
                        )}
                    </div>
                                        {/* Dot indicators */}
                                        {(videoEmbed || (hasProductImages && galleryImages.length > 1)) && (
                                            <div className="flex justify-center gap-1.5 items-center">
                                                {videoEmbed && (
                                                  <button onClick={() => setShowVideo(true)} className="w-7 h-5 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: showVideo ? '#000' : accentColor + '40', border: showVideo ? `2px solid ${accentColor}` : '2px solid transparent' }}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                                                  </button>
                                                )}
                                                {galleryImages.map((_, i) => (
                                                    <button key={i} onClick={() => { setShowVideo(false); setSelectedImageIndex(i); }}
                                                        className="rounded-full transition-all"
                                                        style={{ width: !showVideo && selectedImageIndex === i ? 20 : 6, height: 6, backgroundColor: !showVideo && selectedImageIndex === i ? accentColor : accentColor + '40' }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Thumbnails (horizontal, swipeable) */}
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                                {videoEmbed && (
                                                  <button onClick={() => setShowVideo(true)} className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 flex items-center justify-center" style={{ border: showVideo ? `2px solid ${accentColor}` : '2px solid transparent', backgroundColor: '#000' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                                                  </button>
                                                )}
                                                {hasProductImages && galleryImages.length > 0 ? (
                                                        galleryImages.map((img, idx) => (
                                                                <button
                                                                        key={idx}
                                                                        onClick={() => { setShowVideo(false); setSelectedImageIndex(idx); }}
                                                                        className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all`}
                                                                        style={{ border: !showVideo && selectedImageIndex === idx ? `2px solid ${accentColor}` : '2px solid transparent', backgroundColor: surfaceMuted }}
                                                                >
                                                                        <img src={img} className="w-full h-full object-cover" />
                                                                </button>
                                                        ))
                                                ) : (
                                                        <>
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg border-2 overflow-hidden" style={{ borderColor: accentColor, backgroundColor: surfaceMuted }}></div>
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden" style={{ backgroundColor: surfaceMuted }}></div>
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden" style={{ backgroundColor: surfaceMuted }}></div>
                                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden" style={{ backgroundColor: surfaceMuted }}></div>
                                                        </>
                                                )}
                                        </div>
                    </>)}


                    {/* Trust Badges (Desktop) */}
                    <div className="hidden md:grid grid-cols-3 gap-4 py-6 border-t" style={{ borderColor: surfaceBorderColor }}>
                        <div className="text-center">
                            <i className="ph ph-truck text-2xl mb-1" style={{ color: accentColor }}></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_1')}>
                                {settings?.template_badge_1 || "توصيل سريع"}
                            </p>
                        </div>
                        <div className="text-center">
                            <i className="ph ph-hand-coins text-2xl mb-1" style={{ color: accentColor }}></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_2')}>
                                {settings?.template_badge_2 || "الدفع عند الاستلام"}
                            </p>
                        </div>
                        <div className="text-center">
                            <i className="ph ph-shield-check text-2xl mb-1" style={{ color: accentColor }}></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_3')}>
                                {settings?.template_badge_3 || "ضمان الجودة"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Product Details & Form */}
                <div className="flex flex-col lg:sticky lg:top-20">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold mb-2 leading-snug" style={{ color: textColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>
                        {settings?.template_hero_heading || product?.title || "اسم المنتج المميز - جودة عالية وتصميم عصري"}
                    </h1>
                    
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl font-black" style={{ color: accentColor }}>
                            {Math.round(product?.price ?? 4500).toLocaleString()} دج
                        </span>
                        {(product?.original_price || settings?.template_original_price) && (
                            <span className="text-lg line-through" style={{ color: textMuted }}>
                                {Math.round((product?.original_price || 0)).toLocaleString()} دج
                            </span>
                        )}
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">-35%</span>
                    </div>

                    {showBanner ? (
                    <div className="relative border p-4 rounded-xl mb-6" style={{ backgroundColor: accentColor + '10', borderColor: accentColor + '30' }}>
                        {canManage && (
                            <button
                                onClick={() => setShowBanner(false)}
                                className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
                                style={{ color: accentColor }}
                                title="إزالة اللافتة"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <p className="text-sm font-semibold" style={{ color: accentColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_subtitle')}>
                            {settings?.template_hero_subtitle || "🔥 عرض محدود: اطلب الآن واحصل على توصيل مجاني!"}
                        </p>
                    </div>
                ) : canManage && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowBanner(true)}
                            className="w-full border-2 border-dashed rounded-xl p-4 text-center hover:border-solid transition-colors"
                            style={{ borderColor: accentColor + '50', color: accentColor }}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl">🎯</span>
                                <span className="font-semibold">Add Promotional Banner</span>
                            </div>
                            <p className="text-xs mt-1 opacity-70">Click to add a promotional banner</p>
                        </button>
                    </div>
                )}

                    {/* Checkout Form */}
                    {orderSuccess ? (
    <div className="dz-checkout-card rounded-2xl p-6 border-2 text-center relative" style={{ backgroundColor: accentColor + '10', borderColor: accentColor }}>
        <div className="w-16 h-16 text-white rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor }}>
            <i className="ph ph-check text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: accentColor }}>تم تسجيل طلبك بنجاح!</h3>
        <p style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب وترتيب التوصيل.</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
    </div>
) : (
<div className="dz-checkout-card rounded-2xl p-6 border-2 relative" style={{ borderColor: accentColor, backgroundColor: surfaceColor }}>
                        <div className="absolute -top-3 right-6 text-white px-4 py-1 rounded-full text-xs font-bold uppercase" style={{ backgroundColor: accentColor }}>
                            أكمل البيانات للطلب
                        </div>
                        
                        <h3 className="text-lg font-bold mb-4 mt-2" style={{ color: textColor }}>معلومات المشتري</h3>
                        
                        <form className="space-y-4" onSubmit={handleDefaultOrder}>
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
                                textColor={textColor}
                                borderColor={surfaceBorderColor}
                              />
                            )}
                            <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>الاسم الكامل</label>
                                <input required name="name" type="text" placeholder="أدخل اسمك الكامل" className="w-full px-4 py-3 rounded-xl border outline-none transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>رقم الهاتف</label>
                                <input required name="phone" type="tel" placeholder="رقم الهاتف المحمول" className="w-full px-4 py-3 rounded-xl border outline-none text-right transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} dir="ltr" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>الولاية</label>
                                <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-4 py-3 rounded-xl border outline-none appearance-none transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor}>
                                    <option value="">اختر الولاية</option>
                                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                                </select>
                                {(showHomeDelivery && showDeskDelivery) && (
                                    <div className="mt-2">
                                        <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>نوع التوصيل</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDeliveryType('home')}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-xs"
                                                style={{
                                                    backgroundColor: selectedDeliveryType === 'home' ? accentColor : inputBg,
                                                    border: `1px solid ${surfaceBorderColor}`,
                                                    color: selectedDeliveryType === 'home' ? '#ffffff' : textColor,
                                                }}
                                            >
                                                <i className="ph ph-house"></i>
                                                <span className="font-bold">التوصيل للمنزل</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDeliveryType('desk')}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-xs"
                                                style={{
                                                    backgroundColor: selectedDeliveryType === 'desk' ? accentColor : inputBg,
                                                    border: `1px solid ${surfaceBorderColor}`,
                                                    color: selectedDeliveryType === 'desk' ? '#ffffff' : textColor,
                                                }}
                                            >
                                                <i className="ph ph-building-office"></i>
                                                <span className="font-bold">الاستلام من المكتب</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {selectedWilayaId && (
                                    <div className="mt-2 p-3 rounded-xl text-sm space-y-2" style={{ backgroundColor: accentColor + '10', border: `1px solid ${accentColor}30` }}>
                                        <div className="flex justify-between" style={{ color: textMuted }}>
                                            <span>سعر المنتجات</span>
                                            <span className="font-bold" style={{ color: textColor }}>{Math.round(productTotal).toLocaleString()} دج</span>
                                        </div>
                                        <div className="flex justify-between" style={{ color: textMuted }}>
                                            <span>سعر التوصيل</span>
                                            <span className="font-bold" style={{ color: accentColor }}>{Math.round(deliveryFee).toLocaleString()} دج</span>
                                        </div>
                                        <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${accentColor}40` }}>
                                            <span className="font-bold" style={{ color: textColor }}>التكلفة الإجمالية</span>
                                            <span className="font-black text-base" style={{ color: accentColor }}>{Math.round(grandTotal).toLocaleString()} دج</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {showCommune && <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>البلدية</label>
                                <input name="commune" type="text" placeholder="البلدية" className="w-full px-4 py-3 rounded-xl border outline-none transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                            </div>}
                            {showAddress && <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>العنوان</label>
                                <input name="address" type="text" placeholder="عنوان التوصيل" className="w-full px-4 py-3 rounded-xl border outline-none transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                            </div>}
                            {showNotes && <div>
                                <label className="block text-sm font-bold mb-1" style={{ color: textColor }}>ملاحظات</label>
                                <textarea name="notes" placeholder="ملاحظات إضافية" rows={2} className="w-full px-4 py-3 rounded-xl border outline-none resize-none transition-colors" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = surfaceBorderColor} />
                            </div>}
                            
                            <button className="w-full text-white font-black py-5 rounded-2xl text-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3" style={{ backgroundColor: accentColor }}>
                                اضغط هنا للطلب الآن
                                <i className="ph ph-cursor-click"></i>
                            </button>
                            
                            <p className="text-center text-xs mt-3 flex items-center justify-center gap-1" style={{ color: textMuted }}>
                                <i className="ph ph-lock-key"></i>
                                الدفع عند الاستلام بعد معاينة المنتج
                            </p>
                        </form>
                    </div>
                )}

                    {/* Product Description */}
                    <div className="mt-8 space-y-6 leading-relaxed" style={{ color: textMuted }}>
                        <h3 className="text-xl font-bold border-b-2 inline-block pb-1" style={{ borderColor: accentColor, color: textColor }}>وصف المنتج</h3>
                        
                        {product?.description ? (
                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
                        ) : (
                            <div contentEditable={canManage} suppressContentEditableWarning className="prose max-w-none" onBlur={handleTextEdit('template_description_text')}>
                                {settings?.template_description_text ? (
                                    <div dangerouslySetInnerHTML={{ __html: settings.template_description_text }} />
                                ) : (
                                    <>
                                        <p>هذا المنتج هو الحل الأمثل لكل من يبحث عن الجودة والراحة. مصنوع من أجود المواد لضمان استدامة طويلة.</p>
                                        <ul className="list-disc pr-6 mt-4 space-y-2">
                                            <li>ميزة المنتج الأولى التي تجعله فريداً</li>
                                            <li>جودة عالية ومضمونة 100%</li>
                                            <li>سهل الاستخدام ويناسب جميع الأعمار</li>
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {/* Landing Page Style Image (Bottom image) - only show placeholder to managers */}
                        {(settings?.banner_url || bottomBannerImage || canManage) && (
                        <div className={`rounded-xl overflow-hidden mt-4 relative${!settings?.banner_url && !bottomBannerImage ? ' dz-image-placeholder min-h-64' : ''}`} style={{ backgroundColor: surfaceMuted }} ref={bottomImagePlaceholderRef} onClick={handleBottomImageClick}>
                            {settings?.banner_url ? (
                                <img src={settings.banner_url} className="w-full h-auto block" />
                            ) : bottomBannerImage ? (
                                <img src={bottomBannerImage} className="w-full h-auto block" />
                            ) : (
                                <div className="p-10 flex flex-col items-center justify-center pointer-events-none">
                                    <i className="ph ph-plus-circle text-3xl mb-2" style={{ color: textMuted }}></i>
                                    <span className="text-sm font-bold" style={{ color: textMuted }}>أضف صورة توضيحية للمميزات</span>
                                </div>
                            )}
                        </div>
                        )}
                        {canManage && <input type="file" ref={bottomFileInputRef} className="hidden" accept="image/*" onChange={handleBottomFileChange} /> }
                    </div>
                </div>
            </main>

            {/* Sticky Mobile Order Bar */}
            <div className="fixed bottom-0 left-0 right-0 dz-sticky-order-bar p-3 md:hidden z-[100] border-t flex gap-3" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
                <div className="flex-1 flex flex-col justify-center px-2">
                    <span className="font-black text-xl" style={{ color: accentColor }}>{Math.round(product?.price ?? 4500).toLocaleString()} دج</span>
                    <span className="text-[10px]" style={{ color: textMuted }}>الدفع عند الاستلام</span>
                </div>
                <button className="text-white font-bold px-8 py-3 rounded-xl text-lg flex-grow shadow-lg" style={{ backgroundColor: accentColor }} onClick={() => window.scrollTo({top: document.querySelector('.dz-checkout-card')?.getBoundingClientRect().top || 0, behavior: 'smooth'})}>
                    أطلب الآن
                </button>
            </div>

            {/* Admin Panel (Floating) - Only visible to store owner */}
            {canManage && (
            <div className="fixed bottom-24 left-6 z-[100] group hidden md:block">
                <div className="shadow-2xl rounded-2xl p-4 border scale-0 group-hover:scale-100 origin-bottom-left transition-all duration-300 w-64 mb-4" style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}>
                    <h4 className="font-bold border-b pb-2 mb-3" style={{ color: textColor, borderColor: surfaceBorderColor }}>لوحة التحكم السريعة</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs">اللون الأساسي</span>
                            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-6 w-10 border-none bg-transparent cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs">عملة المتجر</span>
                            <input type="text" defaultValue="دج" className="w-12 text-center text-xs border rounded p-1" style={{ backgroundColor: inputBg, color: textColor, borderColor: surfaceBorderColor }} />
                        </div>
                        <button className="w-full py-2 bg-gray-900 text-white text-xs rounded-lg font-bold hover:bg-gray-800">حفظ التغييرات</button>
                    </div>
                </div>
                <button className="w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:rotate-12 transition-transform shadow-gray-900/30">
                    <i className="ph ph-gear text-2xl"></i>
                </button>
            </div>
            )}

            {/* Platform Footer */}
            <footer className="py-6 text-center text-xs" style={{ borderTop: `1px solid ${surfaceBorderColor}`, color: textMuted }}>
                © {new Date().getFullYear()} {settings?.store_name || 'متجري'}. جميع الحقوق محفوظة · صنع بواسطة <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>Sahla4Eco</a>
            </footer>

            {/* Image Zoom Modal */}
            {zoomState && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomState(null)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomState(null)}>
                        <i className="ph ph-x text-xl"></i>
                    </button>
                    <img src={zoomState.images[zoomState.idx]} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
                    {zoomState.images.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                            {zoomState.images.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); setZoomState({ ...zoomState, idx: i }); }}
                                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all"
                                    style={{ border: `2px solid ${i === zoomState.idx ? accentColor : 'rgba(255,255,255,0.3)'}`, opacity: i === zoomState.idx ? 1 : 0.6 }}
                                >
                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

