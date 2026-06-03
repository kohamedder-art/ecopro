import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TemplateProps, StoreProduct } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import { useOrderFields } from '@/hooks/useOrderFields';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getAlgeriaCommunesByWilayaId, getAlgeriaCommuneById } from '@/lib/algeriaGeo';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';

export default function DZShopTemplate({ settings, products, canManage, storeSlug, onProductView }: TemplateProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [orderSuccess, setOrderSuccess] = React.useState(false);
    const [lastOrderId, setLastOrderId] = React.useState<number | string | null>(null);
    const [lastTelegramUrl, setLastTelegramUrl] = React.useState<string | null>(null);
    const [customerPhone, setCustomerPhone] = React.useState('');
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);

    // Order form field visibility (before baseDeliveryFee — selectedDeliveryType must be initialized first)
    const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
    const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);

    const baseDeliveryFee = selectedWilaya
      ? (selectedDeliveryType === 'desk' ? (selectedWilaya.deskPrice ?? selectedWilaya.homePrice ?? 0) : (selectedWilaya.homePrice ?? 0))
      : 0;

    // Scroll-hide header
    const [headerVisible, setHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    useEffect(() => {
      const handleScroll = () => {
        const currentY = window.scrollY;
        if (currentY < 60) {
          setHeaderVisible(true);
        } else if (currentY > lastScrollY.current) {
          setHeaderVisible(false);
        } else {
          setHeaderVisible(true);
        }
        lastScrollY.current = currentY;
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Section visibility toggles
    const showBanner = settings?.dzshop_show_banner !== false;
    const showTrustBadges = settings?.dzshop_show_trust !== false;

    const [customerAddress, setCustomerAddress] = useState('');
    const [customerCommune, setCustomerCommune] = useState('');
    const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
    useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
    const [customerNotes, setCustomerNotes] = useState('');
    const [quantity, setQuantity] = useState(1);

    // Get product first (needed for variant/offer hooks)
    const product = (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];

    // Fire product view tracking when product changes
    useEffect(() => { if (product && onProductView) onProductView(product); }, [product?.id, onProductView]);

    // Variant and Offer support
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
    const { offers, loading: offersLoading } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null);
    const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);
    const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
    const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : (variantPrice ?? product?.price ?? 0) * quantity;

    const handleDefaultOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!product) return;
        const fd = new FormData(e.currentTarget);
        const phone = (fd.get('phone') as string || '').replace(/[^0-9]/g, '');
        if (!isValidAlgerianPhone(phone)) {
            setOrderError('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05، 06 أو 07 ويكون 10 أرقام');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                store_slug: storeSlug || settings?.store_name || 'dzshop',
                product_id: product.id,
                ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                quantity: quantity,
                ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                total_price: productTotal,
                delivery_fee: deliveryFee,
                delivery_type: 'desk',
                customer_name: fd.get('name'),
                customer_phone: fd.get('phone'),
                customer_address: (fd.get('address') as string) || selectedWilaya?.labelAR || '',
                customer_commune: getAlgeriaCommuneById(customerCommune)?.name || fd.get('commune') || '',
                customer_notes: fd.get('notes') || '',
                product_name: product.title || product.name || '',
            };
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error('Order error');
            setLastOrderId(data.order?.id || null);
            setLastTelegramUrl(data.telegramStartUrl || null);
            setCustomerPhone(fd.get('phone') as string);
            setOrderSuccess(true);
            trackAllPixels(PixelEvents.PURCHASE, {
              content_name: product?.title || product?.name || '',
              content_ids: product?.id ? [product.id] : [],
              content_type: 'product',
              value: productTotal,
              currency: settings?.currency_code || 'DZD',
              num_items: quantity,
              order_id: data?.order?.id || null,
            });
        } catch(err) {
            console.error(err);
            setOrderError('حدث خطأ أثناء تقديم الطلب. حاول مرة أخرى.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#2563eb');
    const accentColor = settings?.template_accent_color || primaryColor;
    const headerColor = settings?.iyco_header_color || '#ffffff';
    const bgColor = settings?.template_bg_color || '#f3f4f6';
    const isDark = useMemo(() => {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }, [bgColor]);
    const textColor = isDark ? '#f1f5f9' : '#1f2937';
    const textMuted = isDark ? '#94a3b8' : '#6b7280';
    const borderColor = isDark ? '#334155' : '#e5e7eb';
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const surfaceMuted = isDark ? '#0f172a' : '#f9fafb';
    const isHeaderDark = useMemo(() => {
      const hex = headerColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }, [headerColor]);
    const headerTextColor = isHeaderDark ? '#f1f5f9' : '#1f2937';
    const cssVariables = `
                :root {
                    --dz-primary: ${primaryColor};
                    --dz-secondary: #f97316;
                    --dz-success: #22c55e;
                    --dz-bg: ${bgColor};
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                [contenteditable="true"] { outline: none; transition: all 0.2s; display: inline-block; min-width: 20px; }
                [contenteditable="true"]:hover { background: rgba(37, 99, 235, 0.05); border-radius: 4px; cursor: text; }
                [contenteditable="true"]:focus { background: #fff; box-shadow: 0 0 0 2px var(--dz-primary); border-radius: 4px; padding: 0 4px; }
                .dz-image-placeholder { background: #e5e7eb; display: flex; align-items: center; justify-content: center; border: 2px dashed #d1d5db; cursor: pointer; transition: 0.3s; }
                .dz-image-placeholder:hover { background: #d1d5db; }
                .ph { vertical-align: middle; }
            `;
    const hasProductImages = product?.images && product.images.length > 0;

    // Smart image classification: routes square images to gallery, wide/tall to banner
    const { slots: imageSlots, loading: classifyingImages } = useImageClassifier(product?.images, 'dzshop');
    const galleryImages = imageSlots.gallery?.length > 0 ? imageSlots.gallery : (product?.images || []);
    const autoBannerImage = imageSlots.banner?.[0] || null;
    const rawVideoUrl = (product as any)?.metadata?.video_url || '';
    const videoEmbed = useMemo(() => {
        if (!rawVideoUrl) return null;
        const yt = rawVideoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (yt) return { type: 'youtube' as const, id: yt[1] };
        if (/\.(mp4|webm|ogg)(\?|$)/i.test(rawVideoUrl)) return { type: 'video' as const, url: rawVideoUrl };
        return { type: 'iframe' as const, url: rawVideoUrl };
    }, [rawVideoUrl]);

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

    // Image Gallery State — transform-based (like LeRoiShop)
    const [activeImageIndex, setActiveImageIndex] = useState(1);

    // Build unified media array: video + images
    const allMedia = useMemo(() => {
        const items: ({ type: 'video'; embed: typeof videoEmbed } | { type: 'image'; src: string })[] = [];
        if (videoEmbed) items.push({ type: 'video', embed: videoEmbed });
        galleryImages.forEach((src: string) => items.push({ type: 'image', src }));
        return items;
    }, [videoEmbed, galleryImages]);

    const loopedMedia = useMemo(() => {
        const len = allMedia.length;
        if (len <= 1) return allMedia;
        return [allMedia[len - 1], ...allMedia, allMedia[0]];
    }, [allMedia]);

    // Map looped index → real allMedia index
    const realMediaIndex = useMemo(() => {
        const n = allMedia.length;
        if (n <= 1) return 0;
        if (activeImageIndex === 0) return n - 1;
        if (activeImageIndex === loopedMedia.length - 1) return 0;
        return activeImageIndex - 1;
    }, [activeImageIndex, allMedia, loopedMedia]);

    const galleryStripRef = useRef<HTMLDivElement>(null);
    const thumbnailRowRef = useRef<HTMLDivElement>(null);
    const galleryIdxRef = useRef(1);
    const wrapRef = useRef(false);
    galleryIdxRef.current = activeImageIndex;

    const goTo = (idx: number) => {
        const clamped = Math.max(0, Math.min(idx, loopedMedia.length - 1));
        galleryIdxRef.current = clamped;
        setActiveImageIndex(clamped);
    };

    // Infinite loop snap-back
    useEffect(() => {
        if (allMedia.length <= 1) return;
        const idx = activeImageIndex;
        const len = loopedMedia.length;
        if (idx === len - 1) {
            const timer = setTimeout(() => {
                wrapRef.current = true;
                galleryIdxRef.current = 1;
                setActiveImageIndex(1);
            }, 300);
            return () => { clearTimeout(timer); wrapRef.current = false; };
        } else if (idx === 0) {
            const timer = setTimeout(() => {
                wrapRef.current = true;
                galleryIdxRef.current = allMedia.length;
                setActiveImageIndex(allMedia.length);
            }, 300);
            return () => { clearTimeout(timer); wrapRef.current = false; };
        } else {
            wrapRef.current = false;
        }
    }, [activeImageIndex, allMedia.length, loopedMedia.length]);

    // Separate lightbox image index so gallery navigation is unaffected
    const [lightboxImgIdx, setLightboxImgIdx] = useState(0);
    useEffect(() => {
        if (lightboxOpen) {
            setLightboxImgIdx(Math.max(0, realMediaIndex - (videoEmbed ? 1 : 0)));
        }
    }, [lightboxOpen]);

    return (
        <div className="min-h-screen relative pb-20 md:pb-0" style={{ fontFamily: "'Cairo', sans-serif", isolation: 'isolate', backgroundColor: bgColor, color: textColor, marginTop: 'calc(-1 * env(safe-area-inset-top))' }} dir="rtl">
            <style dangerouslySetInnerHTML={{ __html: cssVariables }} />

            {/* Top Bar Notice */}
            {(showBanner || canManage) && (
            <div className="text-white text-center py-2 text-sm font-bold relative overflow-visible" style={{ backgroundColor: 'var(--dz-primary)' }} data-edit-path="top-notice">
                {canManage && (
                    <div className="absolute bottom-1.5 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-50">
                        <button
                            onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'dzshop_show_banner', value: !showBanner }, '*')}
                            className="flex items-center gap-1 font-bold"
                        >
                            {showBanner ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                        </button>
                    </div>
                )}
                {showBanner && (
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_top_notice')}>
                    {settings?.template_top_notice || "التوصيل متوفر لـ 58 ولاية - الدفع عند الاستلام"}
                </span>
                )}
                {canManage && !showBanner && (
                    <span className="text-white/70 text-[10px]">📢 Banner hidden</span>
                )}
            </div>
            )}

            {/* Header */}
            <header className={`border-b sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`} style={{ backgroundColor: headerColor }}>
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: 'var(--dz-primary)' }}>
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-extrabold" style={{ color: headerTextColor }}>{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex gap-4">
                    <i className="ph ph-shopping-cart text-2xl" style={{ color: headerTextColor }}></i>
                    <i className="ph ph-list text-2xl md:hidden" style={{ color: headerTextColor }}></i>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-0 pt-0 pb-4 md:px-4 md:py-10 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 relative z-10">
                
                {/* Left Column: Product Visuals */}
                <div className="space-y-0 md:space-y-4">
                    {/* Main Product Image (Swipeable Carousel) */}
                    <div className="w-full aspect-[3/4] md:aspect-[4/5] rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-sm relative">
                        {allMedia.length > 0 ? (
                            <div ref={galleryStripRef}
                              style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex', direction: 'ltr', transform: `translateX(-${(activeImageIndex * 100) / loopedMedia.length}%)`, transition: `transform ${wrapRef.current ? '0s' : '0.3s'} ease`, willChange: 'transform', width: `${loopedMedia.length * 100}%` }}
                              onTouchStart={e => { (e.currentTarget as any)._tsx = e.touches[0].clientX; }}
                              onTouchEnd={e => {
                                const diff = (e.currentTarget as any)._tsx - e.changedTouches[0].clientX;
                                if (Math.abs(diff) < 50) return;
                                diff > 0 ? goTo(galleryIdxRef.current + 1) : goTo(galleryIdxRef.current - 1);
                              }}>
                                {loopedMedia.map((item, i) => (
                                    <div key={i} style={{ width: `${100 / loopedMedia.length}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }} onClick={() => item.type === 'image' && setLightboxOpen(true)}>
                                        {item.type === 'video' ? (
                                            item.embed.type === 'youtube' ? (
                                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${item.embed.id}?autoplay=1&mute=1&loop=1&playlist=${item.embed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                                            ) : item.embed.type === 'video' ? (
                                                <video className="w-full h-full object-cover" src={item.embed.url} autoPlay muted loop playsInline />
                                            ) : (
                                                <iframe className="w-full h-full" src={item.embed.url} allowFullScreen />
                                            )
                                        ) : (
                                            <img src={item.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }} loading="lazy" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="dz-image-placeholder w-full h-full" ref={mainImagePlaceholderRef} onClick={handleMainImageClick}>
                                    <i className="ph ph-image text-4xl" style={{ color: textMuted }}></i>
                                    <p className="text-xs mt-2 absolute bottom-4" style={{ color: textMuted }}>انقر لتغيير الصورة (أو أضف منتج من لوحة التحكم)</p>
                                </div>
                                {canManage && <input type="file" ref={mainFileInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} /> }
                            </>
                        )}
                        {allMedia.length > 1 && (
                            <>
                                <button onClick={e => { e.stopPropagation(); goTo(galleryIdxRef.current - 1); }}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={e => { e.stopPropagation(); goTo(galleryIdxRef.current + 1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronRight className="w-5 h-5" /></button>
                            </>
                        )}
                    </div>

                    {/* Thumbnail Scrollable Row */}
                    <div ref={thumbnailRowRef} className="flex gap-1.5 md:gap-2 overflow-x-auto px-0 pb-2 hide-scrollbar" style={{ direction: 'ltr', justifyContent: 'center' }}>
                        {allMedia.length > 1 && allMedia.map((item, i) => (
                            <div key={i} onClick={() => goTo(i + 1)} className="flex-shrink-0 w-12 h-12 md:w-20 md:h-20 rounded-lg overflow-hidden cursor-pointer relative" style={{ backgroundColor: surfaceMuted, border: i === realMediaIndex ? '2px solid var(--dz-primary)' : '2px solid transparent' }}>
                                {item.type === 'video' ? (
                                    <>
                                        {item.embed.type === 'youtube' ? (
                                            <img src={`https://img.youtube.com/vi/${item.embed.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#000' }}>
                                                <i className="ph ph-video text-white text-xl md:text-2xl"></i>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <i className="ph ph-play-circle text-white text-xl md:text-2xl drop-shadow-lg"></i>
                                        </div>
                                    </>
                                ) : (
                                    <img src={item.src} alt="" className="w-full h-full object-cover" loading="lazy" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Trust Badges (Desktop) */}
                    {(showTrustBadges || canManage) && (
                    <div className="hidden md:grid grid-cols-3 gap-4 py-6 border-t border-gray-100 relative overflow-visible" data-edit-path="trust-badges">
                        {canManage && (
                            <div className="absolute bottom-1.5 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                                <button
                                    onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'dzshop_show_trust', value: !showTrustBadges }, '*')}
                                    className="flex items-center gap-1 font-bold"
                                >
                                    {showTrustBadges ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                                </button>
                            </div>
                        )}
                        {showTrustBadges && (
                        <>
                        <div className="text-center">
                            <i className="ph ph-truck text-2xl text-orange-500 mb-1"></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_1')}>
                                {settings?.template_badge_1 || "توصيل سريع"}
                            </p>
                        </div>
                        <div className="text-center">
                            <i className="ph ph-hand-coins text-2xl text-green-500 mb-1"></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_2')}>
                                {settings?.template_badge_2 || "الدفع عند الاستلام"}
                            </p>
                        </div>
                        <div className="text-center">
                            <i className="ph ph-shield-check text-2xl mb-1" style={{ color: 'var(--dz-primary)' }}></i>
                            <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_badge_3')}>
                                {settings?.template_badge_3 || "ضمان الجودة"}
                            </p>
                        </div>
                        </>
                        )}
                        {canManage && !showTrustBadges && (
                            <span className="text-xs" style={{ color: textMuted }}>🛡️ Trust badges hidden</span>
                        )}
                    </div>
                    )}
                </div>

                {/* Right Column: Product Details & Form */}
                <div className="flex flex-col px-4 md:px-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h1 className="text-xl md:text-2xl font-extrabold leading-snug flex-1" style={{ color: textColor }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>
                            {settings?.template_hero_heading || product?.title || "اسم المنتج المميز - جودة عالية وتصميم عصري"}
                        </h1>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">🔥 {product?.stock_quantity && product.stock_quantity < 20 ? `${product.stock_quantity} فقط` : "محدود"}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-black" style={{ color: 'var(--dz-primary)' }}>
                            {product?.price || "4500"} دج
                        </span>
                        {(product?.original_price || settings?.template_original_price) && (
                            <>
                                <span className="text-sm line-through" style={{ color: textMuted }}>
                                    {product?.original_price || settings?.template_original_price || "6200"} دج
                                </span>
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">-35%</span>
                            </>
                        )}
                        <span className="text-[10px] flex items-center gap-0.5 mr-auto" style={{ color: textMuted }}>
                            <i className="ph ph-truck"></i> توصيل سريع
                        </span>
                    </div>

                    {/* Checkout Form */}
                    {orderSuccess ? (
    <div className="dz-checkout-card bg-green-50 rounded-2xl p-4 border-2 border-green-500 text-center relative" style={{ color: textColor }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <i className="ph ph-check text-3xl" style={{ color: accentColor }}></i>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: accentColor }}>تم تسجيل طلبك بنجاح! 🎉</h3>
        <p className="mb-4" style={{ color: textMuted }}>سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
        <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: cardBg, color: textColor }}>
          <div className="flex justify-between text-sm">
            <span>{product.title} × {quantity}</span>
            <span className="font-bold">{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-xs" style={{ color: textMuted }}>التوصيل</span>
            <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${settings?.currency_code || 'دج'}`}</span>
          </div>
          <div className="h-px my-1" style={{ backgroundColor: borderColor }} />
          <div className="flex justify-between font-black">
            <span>المجموع</span>
            <span style={{ color: accentColor }}>{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
          </div>
        </div>
        <button onClick={() => setOrderSuccess(false)} className="px-6 py-2 rounded-lg text-white font-bold" style={{ backgroundColor: accentColor }}>
          تسوق مرة أخرى
        </button>
    </div>
) : (
<div className="dz-checkout-card rounded-2xl p-5 border-2 relative" style={{ borderColor: accentColor, backgroundColor: cardBg }}>
                        <div className="absolute -top-3 right-6 text-white px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: accentColor }}>
                            أكمل البيانات للطلب
                        </div>

                        <form className="space-y-3 mt-4" onSubmit={handleDefaultOrder}>
                            {/* Variants */}
                            {product?.variants && product.variants.length > 0 && (
                                <VariantSelector 
                                    variants={product.variants} 
                                    selected={selectedVariant} 
                                    onSelect={setSelectedVariant} 
                                    accentColor={accentColor} 
                                    currency={settings?.currency_code || 'دج'} 
                                    basePrice={product.price} 
                                />
                            )}
                            
                            {/* Offers */}
                            {offers.length > 0 && (
                                <OfferSelector 
                                    offers={offers} 
                                    unitPrice={product?.price || 0} 
                                    currency={settings?.currency_code || 'دج'} 
                                    selectedOfferId={selectedOffer?.offer_id ?? null} 
                                    onSelect={handleOfferSelect} 
                                    accentColor={accentColor} 
                                    textColor={textColor}
                                    borderColor={borderColor}
                                    bgColor={cardBg}
                                />
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>الاسم الكامل</label>
                                    <input required name="name" type="text" placeholder="اسمك" className="w-full px-4 py-2.5 rounded-xl outline-none text-sm transition-colors" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>رقم الهاتف</label>
                                    <input required name="phone" type="tel" maxLength={10} placeholder="رقم الهاتف" className="w-full px-4 py-2.5 rounded-xl outline-none text-sm text-right transition-colors" dir="ltr" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>الولاية</label>
                                    <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-4 py-2.5 rounded-xl outline-none text-sm appearance-none transition-colors" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor}>
                                        <option value="">اختر الولاية</option>
                                        {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                                    </select>
                                </div>
                                {showAddress && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>العنوان</label>
                                        <input name="address" type="text" placeholder="العنوان" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-4 py-2.5 rounded-xl outline-none text-sm transition-colors" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                                    </div>
                                )}
                                {showCommune && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>البلدية</label>
                                        <div className="relative">
                                            <select name="commune" required disabled={!selectedWilayaId} value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} className="w-full px-4 py-2.5 rounded-xl outline-none text-sm appearance-none transition-colors disabled:opacity-50" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor}>
                                                <option value="">{selectedWilayaId ? 'اختر البلدية' : 'اختر الولاية أولاً'}</option>
                                                {communes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
                                        </div>
                                    </div>
                                )}
                                {showNotes && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>ملاحظات</label>
                                        <textarea name="notes" placeholder="ملاحظات إضافية" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl outline-none text-sm transition-colors" rows={2} style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg, color: textColor }} onFocus={e => e.currentTarget.style.borderColor = accentColor} onBlur={e => e.currentTarget.style.borderColor = borderColor} />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>الكمية</label>
                                    <div className="flex items-center justify-between rounded-xl" style={{ border: `1px solid ${borderColor}`, backgroundColor: surfaceMuted }}>
                                        <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center" style={{ color: textMuted, backgroundColor: cardBg }}>−</button>
                                        <span className="font-black text-base" style={{ color: textColor }}>{quantity}</span>
                                        <button type="button" onClick={() => setQuantity(Math.min(product?.stock_quantity ?? 999, quantity + 1))} className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center" style={{ color: textMuted, backgroundColor: cardBg }}>+</button>
                                    </div>
                                </div>
                                {(showHomeDelivery || showDeskDelivery) && (
                                <div className="flex-1">
                                    <label className="block text-sm font-bold mb-1" style={{ color: textMuted }}>نوع التوصيل</label>
                                    <div className="flex gap-2">
                                        {showHomeDelivery && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDeliveryType('home')}
                                            className="flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all"
                                            style={{
                                                borderColor: selectedDeliveryType === 'home' ? accentColor : borderColor,
                                                backgroundColor: selectedDeliveryType === 'home' ? accentColor + '10' : cardBg,
                                                color: selectedDeliveryType === 'home' ? accentColor : textColor,
                                            }}
                                        >
                                            منزل
                                        </button>
                                        )}
                                        {showDeskDelivery && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDeliveryType('desk')}
                                            className="flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all"
                                            style={{
                                                borderColor: selectedDeliveryType === 'desk' ? accentColor : borderColor,
                                                backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '10' : cardBg,
                                                color: selectedDeliveryType === 'desk' ? accentColor : textColor,
                                            }}
                                        >
                                            مكتب
                                        </button>
                                        )}
                                    </div>
                                </div>
                                )}
                            </div>
                            
                            {selectedWilayaId && (
                                <div className="flex items-center justify-between text-xs pt-1" style={{ borderTop: `1px solid ${borderColor}`, color: textColor }}>
                                    <span className="font-black" style={{ color: accentColor }}>
                                        {Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}
                                    </span>
                                    <span style={{ color: textMuted }}>
                                        {Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity)).toLocaleString()} دج + {deliveryFee === 0 ? 'مجاني' : `${deliveryFee} دج`}
                                    </span>
                                </div>
                            )}

                            <button className="w-full text-white font-black py-4 rounded-2xl text-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3" style={{ backgroundColor: accentColor }}>
                                اطلب الآن - الدفع عند الاستلام
                                <i className="ph ph-lightning"></i>
                            </button>
                            
                            <p className="text-center text-xs flex items-center justify-center gap-1" style={{ color: textMuted }}>
                                <i className="ph ph-shield-check"></i>
                                الدفع عند الاستلام - معاينة المنتج قبل الدفع
                            </p>
                        </form>
                    </div>
                )}

                    {/* Trust Badges (Mobile) */}
                    {(showTrustBadges || canManage) && (
                    <div className="flex md:hidden items-center justify-center gap-5 py-3 mt-2">
                        {showTrustBadges && (
                        <>
                            <div className="flex items-center gap-1.5">
                                <i className="ph ph-truck text-base text-orange-500"></i>
                                <span className="text-xs font-bold" style={{ color: textMuted }}>{settings?.template_badge_1 || "توصيل سريع"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <i className="ph ph-hand-coins text-base text-green-500"></i>
                                <span className="text-xs font-bold" style={{ color: textMuted }}>{settings?.template_badge_2 || "الدفع عند الاستلام"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <i className="ph ph-shield-check text-base" style={{ color: 'var(--dz-primary)' }}></i>
                                <span className="text-xs font-bold" style={{ color: textMuted }}>{settings?.template_badge_3 || "ضمان الجودة"}</span>
                            </div>
                        </>
                        )}
                        {canManage && !showTrustBadges && (
                            <span className="text-xs" style={{ color: textMuted }}>🛡️ Trust badges hidden</span>
                        )}
                    </div>
                    )}

                    {/* Product Description */}
                    <div className="mt-8 space-y-6 leading-relaxed" style={{ color: textColor }}>
                        <h3 className="text-xl font-bold border-b-2 inline-block pb-1" style={{ borderColor: 'var(--dz-primary)' }}>وصف المنتج</h3>
                        
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
                        
                        {/* Landing Page Style Image (Bottom image) */}
                            <div className="rounded-xl overflow-hidden mt-4 relative" style={{ backgroundColor: surfaceMuted }} ref={bottomImagePlaceholderRef} onClick={handleBottomImageClick}>
                            {settings?.banner_url ? (
                                <img src={settings.banner_url} alt={settings?.store_name || ''} className="w-full h-full object-cover" loading="eager" />
                            ) : autoBannerImage ? (
                                <img src={autoBannerImage} alt={settings?.store_name || ''} className="w-full h-full object-cover" loading="eager" />
                            ) : (
                                <div className="p-10 flex flex-col items-center justify-center pointer-events-none">
                                    <i className="ph ph-plus-circle text-3xl mb-2" style={{ color: textMuted }}></i>
                                    <span className="text-sm font-bold" style={{ color: textMuted }}>أضف صورة توضيحية للمميزات</span>
                                </div>
                            )}
                        </div>
                        {canManage && <input type="file" ref={bottomFileInputRef} className="hidden" accept="image/*" onChange={handleBottomFileChange} /> }
                    </div>
                </div>
            </main>

            {/* Image Lightbox/Preview */}
            {lightboxOpen && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90" onClick={() => setLightboxOpen(false)}>
                    <button className="absolute top-4 right-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={() => setLightboxOpen(false)}>✕</button>
                    {galleryImages.length > 1 && (
                        <>
                            <button className="absolute left-2 md:left-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={(e) => { e.stopPropagation(); setLightboxImgIdx(i => (i - 1 + galleryImages.length) % galleryImages.length); }}><ChevronLeft className="w-8 h-8" /></button>
                            <button className="absolute right-2 md:right-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={(e) => { e.stopPropagation(); setLightboxImgIdx(i => (i + 1) % galleryImages.length); }}><ChevronRight className="w-8 h-8" /></button>
                        </>
                    )}
                    <img
                        src={galleryImages[lightboxImgIdx] || galleryImages[0]}
                        alt={product?.title || ''}
                        className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {galleryImages.length > 1 && (
                        <div className="flex gap-2 mt-4 px-4 overflow-x-auto hide-scrollbar" onClick={(e) => e.stopPropagation()}>
                            {galleryImages.map((img, idx) => (
                                <div key={idx} onClick={() => setLightboxImgIdx(idx)} className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden cursor-pointer" style={{ border: lightboxImgIdx === idx ? '2px solid white' : '2px solid transparent' }}>
                                    <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Sticky Mobile Order Bar */}
            <div className="fixed bottom-0 left-0 right-0 dz-sticky-order-bar p-3 md:hidden z-[100] border-t flex gap-3" style={{ backgroundColor: cardBg, borderColor: borderColor }}>
                <div className="flex-1 flex flex-col justify-center px-2">
                    <span className="font-black text-xl" style={{ color: textColor }}>{product?.price || "4500"} دج</span>
                    <span className="text-[10px]" style={{ color: textMuted }}>الدفع عند الاستلام</span>
                </div>
                <button className="text-white font-bold px-8 py-3 rounded-xl text-lg flex-grow shadow-lg" style={{ backgroundColor: accentColor }} onClick={() => window.scrollTo({top: document.querySelector('.dz-checkout-card')?.getBoundingClientRect().top || 0, behavior: 'smooth'})}>
                    أطلب الآن
                </button>
            </div>

            {/* Admin Panel (Floating) - Only visible to store owner */}
            {canManage && (
            <div className="fixed bottom-24 left-6 z-[100] group hidden md:block">
                <div className="shadow-2xl rounded-2xl p-4 scale-0 group-hover:scale-100 origin-bottom-left transition-all duration-300 w-64 mb-4" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                    <h4 className="font-bold pb-2 mb-3" style={{ color: textColor, borderBottom: `1px solid ${borderColor}` }}>لوحة التحكم السريعة</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs">اللون الأساسي</span>
                            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-6 w-10 border-none bg-transparent cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs">عملة المتجر</span>
                            <input type="text" defaultValue="دج" className="w-12 text-center text-xs bg-gray-50 border rounded p-1" />
                        </div>
                        <button className="w-full py-2 bg-gray-900 text-white text-xs rounded-lg font-bold hover:bg-gray-800">حفظ التغييرات</button>
                    </div>
                </div>
                <button className="w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:rotate-12 transition-transform shadow-gray-900/30">
                    <i className="ph ph-gear text-2xl"></i>
                </button>
            </div>
            )}
        </div>
    );
}

