import React, { useEffect, useRef, useState } from 'react';
import { TemplateProps, StoreProduct } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useImageClassifier } from '@/hooks/useImageClassifier';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';
import { Eye, EyeOff } from 'lucide-react';

export default function DZShopTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [orderSuccess, setOrderSuccess] = React.useState(false);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

    // Section visibility toggles
    const showBanner = settings?.dzshop_show_banner !== false;
    const showTrustBadges = settings?.dzshop_show_trust !== false;

    // Get product first (needed for variant/offer hooks)
    const product = (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings.dzp_main_product_id)) : null) || products?.[0];

    // Variant and Offer support
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
    const { offers } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    const handleOfferSelect = (o: SelectedOffer | null) => { setSelectedOffer(o); };
    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);

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
                quantity: selectedOffer?.quantity || 1,
                ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                total_price: selectedOffer ? selectedOffer.bundle_price : (selectedVariant?.price ?? product.price ?? 0),
                delivery_fee: deliveryFee,
                delivery_type: 'desk',
                customer_name: fd.get('name'),
                customer_phone: fd.get('phone'),
                customer_address: selectedWilaya?.labelAR || ''
            };
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Order error');
            setOrderSuccess(true);
        } catch(err) {
            console.error(err);
            alert('حدث خطأ أثناء تقديم الطلب.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#2563eb');
    const accentColor = settings?.template_accent_color || primaryColor;
    const hasProductImages = product?.images && product.images.length > 0;

    // Smart image classification: routes square images to gallery, wide/tall to banner
    const { slots: imageSlots, loading: classifyingImages } = useImageClassifier(product?.images, 'dzshop');
    const galleryImages = imageSlots.gallery?.length > 0 ? imageSlots.gallery : (product?.images || []);
    const autoBannerImage = imageSlots.banner?.[0] || null;

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

    return (
        <div className="bg-gray-50 text-gray-900 min-h-screen relative pb-20 md:pb-0" style={{ fontFamily: "'Cairo', sans-serif", isolation: 'isolate', backgroundColor: settings?.template_bg_color || undefined }} dir="rtl">
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
            {(showBanner || canManage) && (
            <div className="text-white text-center py-2 text-sm font-bold relative overflow-visible" style={{ backgroundColor: 'var(--dz-primary)' }} data-edit-path="top-notice">
                {canManage && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-50">
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
            <header className="bg-white border-b sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: 'var(--dz-primary)' }}>
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-extrabold" style={{ color: 'var(--dz-primary)' }}>{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex gap-4">
                    <i className="ph ph-shopping-cart text-2xl text-gray-700"></i>
                    <i className="ph ph-list text-2xl text-gray-700 md:hidden"></i>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                
                {/* Left Column: Product Visuals */}
                <div className="space-y-4">
                    {/* Main Product Image */}
                    <div className="aspect-square rounded-2xl overflow-hidden shadow-sm bg-white relative group">
                        {hasProductImages ? (
                            <img src={galleryImages[selectedImageIndex] || galleryImages[0]} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                            <>
                                <div className="dz-image-placeholder w-full h-full" ref={mainImagePlaceholderRef} onClick={handleMainImageClick}>
                                    <i className="ph ph-image text-4xl text-gray-400"></i>
                                    <p className="text-xs text-gray-400 mt-2 absolute bottom-4">انقر لتغيير الصورة (أو أضف منتج من لوحة التحكم)</p>
                                </div>
                                {canManage && <input type="file" ref={mainFileInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} /> }
                            </>
                        )}
                    </div>

                    {/* Thumbnail Grid */}
                    <div className="grid grid-cols-4 gap-2">
                        {hasProductImages && galleryImages.length > 0 ? (
                            galleryImages.slice(0, 4).map((img, idx) => (
                                <div key={idx} onClick={() => setSelectedImageIndex(idx)} className="aspect-square rounded-lg bg-gray-100 overflow-hidden cursor-pointer" style={{ border: selectedImageIndex === idx ? '2px solid var(--dz-primary)' : '2px solid transparent' }}>
                                    <img src={img} className="w-full h-full object-cover" />
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="aspect-square rounded-lg bg-gray-200 border-2 overflow-hidden" style={{ borderColor: 'var(--dz-primary)' }}></div>
                                <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden"></div>
                                <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden"></div>
                                <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden"></div>
                            </>
                        )}
                    </div>

                    {/* Trust Badges (Desktop) */}
                    {(showTrustBadges || canManage) && (
                    <div className="hidden md:grid grid-cols-3 gap-4 py-6 border-t border-gray-100 relative" data-edit-path="trust-badges">
                        {canManage && (
                            <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
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
                            <span className="text-gray-400 text-xs">🛡️ Trust badges hidden</span>
                        )}
                    </div>
                    )}
                </div>

                {/* Right Column: Product Details & Form */}
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 leading-snug" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>
                        {settings?.template_hero_heading || product?.title || "اسم المنتج المميز - جودة عالية وتصميم عصري"}
                    </h1>
                    
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl font-black" style={{ color: 'var(--dz-primary)' }}>
                            {product?.price || "4500"} دج
                        </span>
                        {(product?.original_price || settings?.template_original_price) && (
                            <span className="text-lg text-gray-400 line-through">
                                {product?.original_price || settings?.template_original_price || "6200"} دج
                            </span>
                        )}
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">-35%</span>
                    </div>

                    <div className="border p-4 rounded-xl mb-6 bg-blue-50" style={{ borderColor: 'rgba(37, 99, 235, 0.1)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--dz-primary)' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('template_hero_subtitle')}>
                            {settings?.template_hero_subtitle || "🔥 عرض محدود: اطلب الآن واحصل على توصيل مجاني!"}
                        </p>
                    </div>

                    {/* Checkout Form */}
                    {orderSuccess ? (
    <div className="dz-checkout-card bg-green-50 rounded-2xl p-6 border-2 border-green-500 text-center relative">
        <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ph ph-check text-3xl"></i>
        </div>
        <h3 className="text-xl font-bold mb-2 text-green-700">تم تسجيل طلبك بنجاح!</h3>
        <p className="text-gray-600">سنتصل بك قريباً لتأكيد الطلب وترتيب التوصيل.</p>
    </div>
) : (
<div className="dz-checkout-card bg-white rounded-2xl p-6 border-2 relative" style={{ borderColor: accentColor }}>
                        <div className="absolute -top-3 right-6 text-white px-4 py-1 rounded-full text-xs font-bold uppercase" style={{ backgroundColor: accentColor }}>
                            أكمل البيانات للطلب
                        </div>
                        
                        <h3 className="text-lg font-bold mb-4 mt-2">معلومات المشتري</h3>
                        
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

                        <form className="space-y-4" onSubmit={handleDefaultOrder}>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل</label>
                                <input required name="name" type="text" placeholder="أدخل اسمك الكامل" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none bg-gray-50 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف</label>
                                <input required name="phone" type="tel" placeholder="رقم الهاتف المحمول" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none bg-gray-50 text-right transition-colors" dir="ltr" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الولاية</label>
                                <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none bg-gray-50 appearance-none transition-colors">
                                    <option value="">اختر الولاية</option>
                                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                                </select>
                                {selectedWilayaId && (
                                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-sm font-bold text-emerald-700 flex justify-between">
                                        <span>سعر التوصيل:</span>
                                        <span>{deliveryFee} دج</span>
                                    </div>
                                )}
                            </div>
                            
                            <button className="w-full text-white font-black py-5 rounded-2xl text-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3" style={{ backgroundColor: accentColor }}>
                                اضغط هنا للطلب الآن
                                <i className="ph ph-cursor-click"></i>
                            </button>
                            
                            <p className="text-center text-gray-500 text-xs mt-3 flex items-center justify-center gap-1">
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
                        <div className="rounded-xl overflow-hidden bg-gray-100 dz-image-placeholder min-h-64 mt-4 relative" ref={bottomImagePlaceholderRef} onClick={handleBottomImageClick}>
                            {settings?.banner_url ? (
                                <img src={settings.banner_url} className="w-full h-full object-cover" />
                            ) : autoBannerImage ? (
                                <img src={autoBannerImage} className="w-full h-full object-cover" />
                            ) : (
                                <div className="p-10 flex flex-col items-center justify-center pointer-events-none">
                                    <i className="ph ph-plus-circle text-3xl mb-2 text-gray-400"></i>
                                    <span className="text-sm font-bold text-gray-500">أضف صورة توضيحية للمميزات</span>
                                </div>
                            )}
                        </div>
                        {canManage && <input type="file" ref={bottomFileInputRef} className="hidden" accept="image/*" onChange={handleBottomFileChange} /> }
                    </div>
                </div>
            </main>

            {/* Sticky Mobile Order Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dz-sticky-order-bar p-3 md:hidden z-[100] border-t flex gap-3">
                <div className="flex-1 flex flex-col justify-center px-2">
                    <span className="font-black text-xl" style={{ color: 'var(--dz-primary)' }}>{product?.price || "4500"} دج</span>
                    <span className="text-[10px] text-gray-400">الدفع عند الاستلام</span>
                </div>
                <button className="text-white font-bold px-8 py-3 rounded-xl text-lg flex-grow shadow-lg" style={{ backgroundColor: accentColor }} onClick={() => window.scrollTo({top: document.querySelector('.dz-checkout-card')?.getBoundingClientRect().top || 0, behavior: 'smooth'})}>
                    أطلب الآن
                </button>
            </div>

            {/* Admin Panel (Floating) - Only visible to store owner */}
            {canManage && (
            <div className="fixed bottom-24 left-6 z-[100] group hidden md:block">
                <div className="bg-white shadow-2xl rounded-2xl p-4 border border-gray-100 scale-0 group-hover:scale-100 origin-bottom-left transition-all duration-300 w-64 mb-4">
                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-3">لوحة التحكم السريعة</h4>
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

