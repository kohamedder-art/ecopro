import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TemplateProps, StoreProduct } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import PixelScripts from '@/components/storefront/PixelScripts';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { getAlgeriaCommunesByWilayaId, communeDisplayName } from '@/lib/algeriaGeo';

export default function DZShopTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [orderSuccess, setOrderSuccess] = React.useState(false);
    const [lastOrderId, setLastOrderId] = React.useState<number | string | null>(null);
    const [lastTelegramUrl, setLastTelegramUrl] = React.useState<string | null>(null);
    const [customerPhone, setCustomerPhone] = React.useState('');
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);

    // Order form field visibility
    const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
    const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);

    // Section visibility toggles
    const showBanner = settings?.dzshop_show_banner !== false;
    const showTrustBadges = settings?.dzshop_show_trust !== false;

    // Header: visible only at the very top of the page, hidden when scrolled
    const [headerVisible, setHeaderVisible] = useState(true);
    useEffect(() => {
        const handleScroll = () => {
            setHeaderVisible(window.scrollY === 0);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const baseDeliveryFee = selectedWilaya
      ? (selectedDeliveryType === 'home' ? (selectedWilaya.homePrice ?? 0) : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice ?? 0))
      : 0;
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerCommune, setCustomerCommune] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
    useEffect(() => { setCustomerCommune(''); }, [selectedWilayaId]);
    const [quantity, setQuantity] = useState(1);

    // Get product first (needed for variant/offer hooks)
    const product = (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];

    // Variant and Offer support
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
    const { offers, loading: offersLoading } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null);
    const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };

    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);
    const variantPrice = (selectedVariant?.price != null && selectedVariant.price > 0) ? selectedVariant.price : null;
    const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : (variantPrice ?? product?.price ?? 0) * quantity;

    const handleDefaultOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!product) return;
        setIsSubmitting(true);
        try {
            const fd = new FormData(e.currentTarget);
            const payload = {
                store_slug: storeSlug || settings?.store_name || 'dzshop',
                product_id: product.id,
                ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                quantity: quantity,
                ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                total_price: productTotal,
                delivery_fee: deliveryFee,
                delivery_type: selectedDeliveryType,
                customer_name: fd.get('name'),
                customer_phone: fd.get('phone'),
                customer_address: (fd.get('address') as string) || selectedWilaya?.labelAR || '',
                customer_commune: fd.get('commune_name') || '',
                customer_notes: fd.get('notes') || '',
                shipping_wilaya_id: selectedWilayaId,
                shipping_commune_id: Number(fd.get('commune')) || undefined,
            };
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.fields) {
                    const list = Object.values(data.fields).map((m: any) => `• ${m}`).join('\n');
                    throw new Error((data.error || 'يرجى تصحيح البيانات') + '\n' + list);
                }
                throw new Error(data.error || 'حدث خطأ');
            }
            setLastOrderId(data.order?.id || null);
            setLastTelegramUrl(data.telegramStartUrl || null);
            setCustomerPhone(fd.get('phone') as string);
            setOrderSuccess(true);
        } catch(err) {
            const msg = err instanceof Error ? err.message : 'حدث خطأ';
            setOrderError(msg);
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#2563eb');
    const accentColor = settings?.template_accent_color || primaryColor;
    const cssVariables = `
                :root {
                    --dz-primary: ${primaryColor};
                    --dz-secondary: #f97316;
                    --dz-success: #22c55e;
                    --dz-bg: #f3f4f6;
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                [contenteditable="true"] { outline: none; transition: all 0.2s; display: inline-block; min-width: 20px; }
                [contenteditable="true"]:hover { background: rgba(37, 99, 235, 0.05); border-radius: 4px; cursor: text; }
                [contenteditable="true"]:focus { background: #fff; box-shadow: 0 0 0 2px var(--dz-primary); border-radius: 4px; padding: 0 4px; }
                .dz-image-placeholder { background: #e5e7eb; display: flex; align-items: center; justify-content: center; border: 2px dashed #d1d5db; cursor: pointer; transition: 0.3s; }
                .dz-image-placeholder:hover { background: #d1d5db; }
                .ph { vertical-align: middle; }
                .dz-checkout-card { transition: box-shadow 0.3s ease; }
                .dz-checkout-card:focus-within { box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
                input:focus, select:focus, textarea:focus { box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
                .dz-checkout-card input, .dz-checkout-card select, .dz-checkout-card textarea { transition: all 0.2s ease; }
                .dz-checkout-card input:hover, .dz-checkout-card select:hover { border-color: #d1d5db; }
            `;
    // Smart image classification: routes square images to gallery, wide/tall to banner
    const { slots: imageSlots, loading: classifyingImages } = useImageClassifier(product?.images, 'dzshop');
    const galleryImages = imageSlots.gallery?.length > 0 ? imageSlots.gallery : (product?.images?.filter(Boolean) || []);
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
    
    // Inject Phosphor Icons and Google Fonts into the correct document (works in both iframe and standalone)
    useEffect(() => {
        const doc = rootRef.current?.ownerDocument || document;
        if (!doc.getElementById('phosphor-icons')) {
            const script = doc.createElement('script');
            script.id = 'phosphor-icons';
            script.src = 'https://unpkg.com/@phosphor-icons/web';
            doc.head.appendChild(script);
        }
        if (!doc.getElementById('inter-font')) {
            const link = doc.createElement('link');
            link.id = 'inter-font';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
            link.rel = 'stylesheet';
            doc.head.appendChild(link);
        }
    }, []);

    // Set variable on root
    useEffect(() => {
        const doc = rootRef.current?.ownerDocument || document;
        doc.documentElement.style.setProperty('--dz-primary', primaryColor);
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

    // Image Gallery State — LeRoiShop-style infinite loop
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState<string | false>(false);
    const wrapRef = useRef(false);
    const galleryIdxRef = useRef(0);
    galleryIdxRef.current = activeImageIndex;

    const allMedia = useMemo(() => {
        const items: MediaItem[] = [];
        if (videoEmbed) items.push({ type: 'video', embed: videoEmbed, src: '' });
        const imgs = galleryImages.length > 0 ? galleryImages : ['/placeholder.png'];
        imgs.forEach((src: string) => items.push({ type: 'image', src }));
        return items;
    }, [videoEmbed, galleryImages]);

    const loopedMedia = useMemo(() => {
        const len = allMedia.length;
        if (len <= 1) return allMedia;
        return [allMedia[len - 1], ...allMedia, allMedia[0]];
    }, [allMedia]);

    const realMediaIndex = useMemo(() => {
        const n = allMedia.length;
        if (n <= 1) return 0;
        if (activeImageIndex === 0) return n - 1;
        if (activeImageIndex === loopedMedia.length - 1) return 0;
        return activeImageIndex - 1;
    }, [activeImageIndex, allMedia, loopedMedia]);

    const goToMedia = (idx: number) => {
        const clamped = Math.max(0, Math.min(idx, loopedMedia.length - 1));
        galleryIdxRef.current = clamped;
        setActiveImageIndex(clamped);
    };

    // When media count changes, clamp index so single-image doesn't start off-screen
    useEffect(() => {
        if (allMedia.length <= 1) {
            setActiveImageIndex(0);
            galleryIdxRef.current = 0;
        } else if (activeImageIndex === 0) {
            setActiveImageIndex(1);
            galleryIdxRef.current = 1;
        }
    }, [allMedia.length]);

    // Infinite loop: snap to real item after transition when reaching a clone
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

    return (
        <div ref={rootRef} className="text-gray-900 min-h-screen relative pb-20 md:pb-0" style={{ fontFamily: "'Cairo', sans-serif", isolation: 'isolate', backgroundColor: settings?.template_bg_color || '#f3f4f6', backgroundImage: settings?.template_bg_image ? (settings.template_bg_image.startsWith('linear') || settings.template_bg_image.startsWith('radial') || settings.template_bg_image.startsWith('url(') ? settings.template_bg_image : `url(${settings.template_bg_image})`) : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }} dir="rtl">
            <PixelScripts storeSlug={storeSlug} />
            <style dangerouslySetInnerHTML={{ __html: cssVariables }} />

            {/* Top Bar Notice */}
            {(showBanner || canManage) && (
            <div className="text-white text-center py-2 text-sm font-bold relative z-20 overflow-visible" style={{ backgroundColor: (accentColor || 'var(--dz-primary)') + 'cc', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} data-edit-path="top-notice">
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
                <span contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_top_notice" onBlur={handleTextEdit('template_top_notice')}>
                    {settings?.template_top_notice || "التوصيل متوفر لـ 58 ولاية - الدفع عند الاستلام"}
                </span>
                )}
                {canManage && !showBanner && (
                    <span className="text-white/70 text-[10px]">📢 Banner hidden</span>
                )}
            </div>
            )}

            {/* Header — hides on scroll down, shows on scroll up */}
            <header className={`fixed top-0 left-0 right-0 z-50 px-3 py-1 flex justify-between items-center shadow-sm transition-transform duration-300`} style={{ backgroundColor: (accentColor || 'var(--dz-primary)'), backdropFilter: 'none', WebkitBackdropFilter: 'none', transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)' }}>
                <div className="flex items-center gap-3">
{settings?.store_logo ? (
  <img 
    src={settings.store_logo} 
    alt={settings?.store_name || "متجري"} 
    className="rounded-full object-cover border shadow-sm"
    style={{ width: 45, height: 45, borderColor: 'rgba(255,255,255,0.3)', contentVisibility: 'auto' }}
    loading="lazy"
    decoding="async"
    width="45"
    height="45"
  />
) : (
                        <div className="rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ width: 45, height: 45, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-xl font-bold text-white">{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex gap-3">
                    <i className="ph ph-shopping-cart text-xl text-white"></i>
                    <i className="ph ph-list text-xl text-white md:hidden"></i>
                </div>
            </header>

            <main className="w-full px-3 py-6 md:py-10 grid grid-cols-1 md:grid-cols-[5fr_3fr] gap-8 relative z-10 pt-14 md:min-h-[80vh]">
                
                {/* Left Column: Product Visuals */}
                <div className="md:h-full">
                <div className="flex flex-col md:flex-row gap-4 md:h-full">
                    {/* Main Product Image (LeRoiShop-style translateX gallery) */}
                    <div className="h-[65vh] md:flex-1 md:h-[90vh] rounded-2xl overflow-hidden relative group" style={{ boxShadow: `0 4px 30px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.3) inset`, backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
                        {allMedia.length > 0 ? (
                            <div className="h-full relative select-none" style={{ touchAction: 'pan-y' }}
                              onTouchStart={e => { (e.currentTarget as any)._ts = e.touches[0].clientX; (e.currentTarget as any)._tsy = e.touches[0].clientY; }}
                              onTouchEnd={e => {
                                const t = e.currentTarget as any;
                                const dx = t._ts - e.changedTouches[0].clientX;
                                const dy = t._tsy - e.changedTouches[0].clientY;
                                if (t._ts == null || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
                                dx > 0 ? goToMedia(galleryIdxRef.current + 1) : goToMedia(galleryIdxRef.current - 1);
                              }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex', direction: 'ltr', transform: `translateX(-${(activeImageIndex * 100) / loopedMedia.length}%)`, transition: `transform ${wrapRef.current ? '0s' : '0.3s'} ease`, willChange: 'transform', width: `${loopedMedia.length * 100}%` }}>
                                    {loopedMedia.map((item, i) => (
                                        <div key={i} style={{ width: `${100 / loopedMedia.length}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                                            {item.type === 'video' ? (
                                                (() => {
                                                    const posterSrc = galleryImages[0] || product?.images?.[0] || '';
                                                    const ytThumb = item.embed.type === 'youtube' ? `https://img.youtube.com/vi/${item.embed.id}/hqdefault.jpg` : '';
                                                    const bgImg = item.embed.type === 'youtube' ? ytThumb : posterSrc;
                                                    return (
                                                        <div className="relative w-full h-full" style={{ background: bgImg ? `center/cover no-repeat url(${bgImg})` : undefined }}>
                                                            {item.embed.type === 'youtube' ? (
                                                                <iframe className="w-full h-full absolute inset-0" src={`https://www.youtube.com/embed/${item.embed.id}?autoplay=1&mute=1&loop=1&playlist=${item.embed.id}`} allow="autoplay; encrypted-media" allowFullScreen />
                                                            ) : item.embed.type === 'video' ? (
                                                                <video className="w-full h-full absolute inset-0 object-cover" src={item.embed.url} autoPlay muted loop playsInline preload="metadata" poster={posterSrc || undefined} />
                                                            ) : (
                                                                <iframe className="w-full h-full absolute inset-0" src={item.embed.url} allowFullScreen />
                                                            )}
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <img 
  src={item.src} 
  alt="" 
  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', contentVisibility: 'auto', cursor: 'pointer' }} 
  loading="lazy"
  decoding="async"
  onClick={() => setLightboxOpen(item.src)}
/>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {allMedia.length > 1 && (
                                    <>
                                        <button onClick={e => { e.stopPropagation(); goToMedia(galleryIdxRef.current - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronLeft className="w-5 h-5" /></button>
                                        <button onClick={e => { e.stopPropagation(); goToMedia(galleryIdxRef.current + 1); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-10 opacity-70 hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}><ChevronRight className="w-5 h-5" /></button>
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                            {allMedia.map((_, i) => (
                                                <span key={i} className="w-1.5 h-1.5 rounded-full transition-all" style={{ backgroundColor: i === realMediaIndex ? '#fff' : 'rgba(255,255,255,0.4)', transform: i === realMediaIndex ? 'scale(1.4)' : 'scale(1)' }} />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : canManage ? (
                            <>
                                <div className="dz-image-placeholder w-full h-full" ref={mainImagePlaceholderRef} onClick={handleMainImageClick}>
                                    <i className="ph ph-image text-4xl text-gray-400"></i>
                                    <p className="text-xs text-gray-400 mt-2 absolute bottom-4">انقر لتغيير الصورة (أو أضف منتج من لوحة التحكم)</p>
                                </div>
                                <input type="file" ref={mainFileInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} />
                            </>
                        ) : null}
                    </div>

                    {/* Thumbnail Scrollable Row */}
                    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto hide-scrollbar md:w-20 shrink-0 md:order-first pb-2 md:pb-0" style={{ direction: 'ltr' }}>
                        {allMedia.length > 1 ? (
                            allMedia.map((item, i) => (
                                <button key={i} onClick={() => goToMedia(i + 1)} className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer transition-all" style={{ border: `3px solid ${i === realMediaIndex ? 'var(--dz-primary)' : 'transparent'}` }}>
                                    {item.type === 'video' ? (
                                        <div className="w-full h-full relative">
                                            {item.embed.type === 'youtube' ? (
                                                <img 
  src={`https://img.youtube.com/vi/${item.embed.id}/mqdefault.jpg`} 
  alt="" 
  className="w-full h-full object-cover" 
  loading="lazy"
  decoding="async"
  style={{ contentVisibility: 'auto' }}
/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#000' }} />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="drop-shadow-lg"><polygon points="5,3 19,12 5,21"/></svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <img 
  src={item.src} 
  alt="" 
  className="w-full h-full object-contain" 
  loading="lazy"
  decoding="async"
  style={{ contentVisibility: 'auto' }}
/>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="flex gap-2">
                                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-200 border-2 overflow-hidden" style={{ borderColor: 'var(--dz-primary)' }}></div>
                                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 overflow-hidden"></div>
                                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 overflow-hidden"></div>
                                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 overflow-hidden"></div>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                {/* Right Column: Product Details & Form */}
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-extrabold mb-2 leading-snug" style={{ color: '#111827' }} contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_hero_heading" onBlur={handleTextEdit('template_hero_heading')}>
                        {settings?.template_hero_heading || product?.title || "اسم المنتج المميز - جودة عالية وتصميم عصري"}
                    </h1>
                    
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl font-black" style={{ color: 'var(--dz-primary)' }}>
                            {Math.round(Number(product?.price || 4500)).toLocaleString()} دج
                        </span>
                        {(product?.original_price || settings?.template_original_price) && (
                            <span className="text-lg text-gray-400 line-through">
                                {Math.round(Number(product?.original_price || settings?.template_original_price || 6200)).toLocaleString()} دج
                            </span>
                        )}
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">-35%</span>
                    </div>

                    <div className="p-3 rounded-xl mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                        <p className="text-sm font-semibold text-gray-600" contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_hero_subtitle" onBlur={handleTextEdit('template_hero_subtitle')}>
                            {settings?.template_hero_subtitle || "🔥 عرض محدود: اطلب الآن واحصل على توصيل مجاني!"}
                        </p>
                    </div>

                    {/* Checkout Form */}
                    {orderSuccess ? (
    <div className="dz-checkout-card rounded-2xl p-6 text-center relative" style={{ backgroundColor: 'rgba(240,253,244,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.3)', boxShadow: `0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset` }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: accentColor + '20' }}>
            <i className="ph ph-check text-3xl" style={{ color: accentColor }}></i>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: accentColor }}>تم تسجيل طلبك بنجاح! 🎉</h3>
        <p className="text-gray-600 mb-4">سنتصل بك قريباً لتأكيد الطلب</p>
        <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId || undefined} telegramStartUrl={lastTelegramUrl} customerPhone={customerPhone} />
        <div className="text-right rounded-xl p-4 mb-4 space-y-2" style={{ backgroundColor: '#f9fafb' }}>
          <div className="flex justify-between text-sm">
            <span>{product.title} × {quantity}</span>
            <span className="font-bold">{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">التوصيل</span>
            <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${settings?.currency_code || 'دج'}`}</span>
          </div>
          <div className="h-px bg-gray-200 my-1" />
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
            <div className="dz-checkout-card bg-white/40 backdrop-blur-xl rounded-2xl p-6 border border-white/40 relative" style={{ boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset, 0 10px 40px ${accentColor}30` }}>
                        
                        {orderError && (
                            <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4 text-red-700 text-sm whitespace-pre-line">
                                {orderError}
                            </div>
                        )}

                        <form className="space-y-3" onSubmit={handleDefaultOrder}>
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
                                    textColor="#1e293b" 
                                    borderColor="#e2e8f0" 
                                />
                            )}

                            <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-800 pointer-events-none">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </span>
                                    <input required name="name" type="text" placeholder="الاسم" className="w-full pr-12 pl-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900 placeholder:text-gray-500" />
                                </div>
                                <div className="relative">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-800 pointer-events-none">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    </span>
                                    <input required name="phone" type="tel" placeholder="رقم الهاتف" className="w-full pr-12 pl-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900 placeholder:text-gray-500 text-right" dir="ltr" />
                                </div>
                                <div className="relative">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-800 pointer-events-none">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    </span>
                                    <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full pr-12 pl-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900">
                                        <option value="">اختر الولاية</option>
                                        {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                                    </select>
                                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                                {showCommune && (
                                    <div className="relative">
                                        <select name="commune" value={customerCommune} onChange={e => setCustomerCommune(e.target.value)} disabled={!selectedWilayaId} required className="w-full pr-12 pl-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900">
                                            <option value="">اختر البلدية</option>
                                            {communes.map(c => <option key={c.id} value={c.id}>{communeDisplayName(c)}</option>)}
                                        </select>
                                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                        <input name="commune_name" type="hidden" value={customerCommune ? (communeDisplayName(communes.find(c => c.id === customerCommune)!) || customerCommune) : ''} />
                                    </div>
                                )}
                                {showAddress && (
                                    <div className="relative">
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-800 pointer-events-none">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                        </span>
                                        <input name="address" type="text" placeholder="العنوان" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full pr-12 pl-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900 placeholder:text-gray-500" />
                                    </div>
                                )}
                            </div>
                            </div>

                            {showNotes && (
                                <textarea name="notes" placeholder="ملاحظات (اختياري)" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="w-full px-4 py-4 rounded-2xl border border-black/40 focus:border-black/60 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-base bg-white/50 backdrop-blur-xl text-gray-900 placeholder:text-gray-500" rows={2} />
                            )}

                            <div className="flex items-center justify-between py-1">
                                <span className="text-base font-bold text-gray-600">الكمية</span>
                                <div className="flex items-center gap-4">
                                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:scale-90 transition-all text-lg" style={{ border: '1px solid rgba(0,0,0,0.4)', backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>−</button>
                                    <span className="font-bold text-lg min-w-[24px] text-center">{quantity}</span>
                                    <button type="button" onClick={() => setQuantity(Math.min(product?.stock_quantity ?? 999, quantity + 1))} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 active:scale-90 transition-all text-lg" style={{ border: '1px solid rgba(0,0,0,0.4)', backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>+</button>
                                </div>
                            </div>

                            {(showHomeDelivery || showDeskDelivery) && (
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">نوع التوصيل</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {showHomeDelivery && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDeliveryType('home')}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                                        style={{
                                            borderColor: selectedDeliveryType === 'home' ? accentColor : 'rgba(0,0,0,0.4)',
                                            backgroundColor: selectedDeliveryType === 'home' ? accentColor + '20' : 'rgba(255,255,255,0.6)',
                                            color: selectedDeliveryType === 'home' ? accentColor : '#374151',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)',
                                        }}
                                    >
                                        <span className="text-sm font-bold">التوصيل للمنزل</span>
                                    </button>
                                    )}
                                    {showDeskDelivery && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDeliveryType('desk')}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all"
                                        style={{
                                            borderColor: selectedDeliveryType === 'desk' ? accentColor : 'rgba(0,0,0,0.4)',
                                            backgroundColor: selectedDeliveryType === 'desk' ? accentColor + '20' : 'rgba(255,255,255,0.6)',
                                            color: selectedDeliveryType === 'desk' ? accentColor : '#374151',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)',
                                        }}
                                    >
                                        <span className="text-sm font-bold">الاستلام من المكتب</span>
                                    </button>
                                    )}
                                </div>
                            </div>
                            )}
                            
                            {selectedWilayaId && (
                                <div className="space-y-1.5 pt-2 text-sm" style={{ borderTop: '1px solid rgba(0,0,0,0.15)' }}>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">سعر المنتج{selectedOffer ? ` (${selectedOffer.quantity} قطعة)` : ` (${quantity})`}</span>
                                        <span className="font-bold">{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">التوصيل</span>
                                        <span className="font-bold">{deliveryFee === 0 ? 'مجاني ✅' : `${deliveryFee} ${settings?.currency_code || 'دج'}`}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-gray-100">
                                        <span className="font-bold">المجموع</span>
                                        <span className="font-black text-lg" style={{ color: accentColor }}>{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.4)' }}>
                                {product?.images?.[0] && (
                                    <img src={product.images[0]} alt="" className="w-14 h-14 rounded-lg object-contain bg-white" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{product?.title || 'المنتج'}</p>
                                    <p className="text-xs text-gray-400">{selectedOffer ? `${selectedOffer.quantity} قطعة` : `× ${quantity}`}</p>
                                </div>
                                <span className="font-black text-base" style={{ color: accentColor }}>{Math.round(Number(selectedOffer?.bundle_price || (product?.price || 0) * quantity) + Number(deliveryFee || 0)).toLocaleString()} {settings?.currency_code || 'دج'}</span>
                            </div>

                            <button className="w-full text-white font-bold py-3.5 rounded-xl text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: accentColor, boxShadow: `0 4px 20px ${accentColor}50, 0 0 60px ${accentColor}20` }}>
                                أطلب الآن
                            </button>
                            
                            <p className="text-center text-gray-500 text-xs mt-3 flex items-center justify-center gap-1 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
                                <i className="ph ph-lock-key"></i>
                                الدفع عند الاستلام بعد معاينة المنتج
                            </p>
                        </form>
                    </div>
                )}

                    {/* Product Description */}
                    <div className="mt-8 space-y-6 text-gray-700 leading-relaxed">
                        <h3 className="text-xl font-bold border-b-2 inline-block pb-1" style={{ borderColor: 'var(--dz-primary)' }}>وصف المنتج</h3>
                        
                        {product?.description ? (
                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
                        ) : (
                            <div contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_description_text" className="prose max-w-none" onBlur={handleTextEdit('template_description_text')}>
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
                        {(settings?.banner_url || autoBannerImage || canManage) ? (
                        <div className="rounded-xl overflow-hidden bg-gray-100 dz-image-placeholder min-h-64 mt-4 relative" ref={bottomImagePlaceholderRef} onClick={handleBottomImageClick}>
{settings?.banner_url ? (
  <img 
    src={settings.banner_url} 
    className="w-full h-full object-cover" 
    loading="lazy"
    decoding="async"
    style={{ contentVisibility: 'auto' }}
  />
) : autoBannerImage ? (
  <img 
    src={autoBannerImage} 
    className="w-full h-full object-cover" 
    loading="lazy"
    decoding="async"
    style={{ contentVisibility: 'auto' }}
  />
                            ) : canManage ? (
                                <div className="p-10 flex flex-col items-center justify-center pointer-events-none">
                                    <i className="ph ph-plus-circle text-3xl mb-2 text-gray-400"></i>
                                    <span className="text-sm font-bold text-gray-500">أضف صورة توضيحية للمميزات</span>
                                </div>
                            ) : null}
                        </div>
                        ) : null}
                        {canManage && <input type="file" ref={bottomFileInputRef} className="hidden" accept="image/*" onChange={handleBottomFileChange} /> }
                    </div>
                    </div>

                {/* Trust Badges (Full Width Below Grid) */}
                {(showTrustBadges || canManage) && (
                <div className="grid grid-cols-3 gap-3 py-4 relative overflow-visible w-full" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }} data-edit-path="trust-badges">
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
                        <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_badge_1" onBlur={handleTextEdit('template_badge_1')}>
                            {settings?.template_badge_1 || "توصيل سريع"}
                        </p>
                    </div>
                    <div className="text-center">
                        <i className="ph ph-hand-coins text-2xl text-green-500 mb-1"></i>
                        <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_badge_2" onBlur={handleTextEdit('template_badge_2')}>
                            {settings?.template_badge_2 || "الدفع عند الاستلام"}
                        </p>
                    </div>
                    <div className="text-center">
                        <i className="ph ph-shield-check text-2xl mb-1" style={{ color: 'var(--dz-primary)' }}></i>
                        <p className="text-xs font-bold" contentEditable={canManage} suppressContentEditableWarning data-setting-key="template_badge_3" onBlur={handleTextEdit('template_badge_3')}>
                            {settings?.template_badge_3 || "ضمان الجودة"}
                        </p>
                    </div>
                    </>
                    )}
                    {canManage && !showTrustBadges && (
                        <span className="text-gray-400 text-xs">🛡️ Trust badges hidden</span>
                    )}
                </div>
                )}
            </main>

            {/* Sticky Mobile Order Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dz-sticky-order-bar p-3 md:hidden z-[100] border-t border-gray-100 flex gap-3 shadow-lg">
                <div className="flex-1 flex flex-col justify-center px-2">
                    <span className="font-black text-xl" style={{ color: 'var(--dz-primary)' }}>{Math.round(Number(product?.price || 4500)).toLocaleString()} دج</span>
                    <span className="text-[10px] text-gray-400">الدفع عند الاستلام</span>
                </div>
                <button className="text-white font-bold px-8 py-3 rounded-xl text-lg flex-grow shadow-lg" style={{ backgroundColor: accentColor }} onClick={() => { const doc = rootRef.current?.ownerDocument || document; window.scrollTo({top: doc.querySelector('.dz-checkout-card')?.getBoundingClientRect().top || 0, behavior: 'smooth'}); }}>
                    أطلب الآن
                </button>
            </div>

            {/* Image Preview Lightbox */}
            {lightboxOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90" onClick={() => setLightboxOpen(false)}>
                    <button className="absolute top-4 right-4 text-white text-4xl font-bold hover:opacity-70 z-10" onClick={() => setLightboxOpen(false)}>✕</button>
                    <img src={lightboxOpen} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

        </div>
    );
}

