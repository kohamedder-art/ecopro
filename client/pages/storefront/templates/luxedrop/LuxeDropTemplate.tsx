import React, { useEffect, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import { Eye, EyeOff } from 'lucide-react';

export default function LuxeDropTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
        const accentColor = settings?.template_accent_color || settings?.primary_color || '#d4af37';
        const productId = settings?.luxd_main_product_id;
    const product = (productId ? products?.find((p: any) => p.id === productId) : null) || products?.[0];
    const hasProductImages = product?.images && product.images.length > 0;

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
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const deliveryFee = selectedWilaya?.homePrice ?? 0;

    // Section visibility toggles
    const showCountdown = settings?.luxd_show_countdown !== false;
    const showFeatures = settings?.luxd_show_features !== false;
    const showSocialProof = settings?.luxd_show_social !== false;

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
                    quantity: 1,
                    total_price: product.price,
                    delivery_fee: deliveryFee,
                    delivery_type: 'desk', 
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: selectedWilaya?.labelAR || ''
                })
            });

            const data = await res.json();
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

    // Auto-sync images when product changes
    useEffect(() => {
        if (product?.images) {
            setMainImage(product.images[0] || "");
            setT1Image(product.images[1] || "");
            setT2Image(product.images[2] || "");
            setT3Image(product.images[3] || "");
            setT4Image(product.images[4] || "");
        }
    }, [product]);


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

    const scrollToOrder = () => {
        document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: settings?.template_bg_color || '#0a0a0a' }} className="text-white min-h-screen pb-24" dir="rtl">
            <style>{`
                .lux-gold-gradient { background: linear-gradient(90deg, ${accentColor} 0%, #f9e076 50%, ${accentColor} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .lux-gold-bg { background: linear-gradient(90deg, ${accentColor} 0%, #f9e076 100%); }
                .lux-glass-card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
                .lux-img-slot { aspect-ratio: 1/1; background: #1a1a1a; border: 2px dashed #333; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; }
                .lux-img-slot img { width: 100%; height: 100%; object-fit: cover; }
                [contenteditable="true"]:focus { outline: 2px solid ${accentColor}; background: rgba(212, 175, 55, 0.1); padding: 0 4px; border-radius: 4px; }
                @keyframes slideInLux { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .lux-notification-pop { animation: slideInLux 0.5s ease-out; }
            `}</style>

            {/* Top Banner */}
            <div className="bg-red-600 text-white text-center py-1 text-sm font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_banner')}>
                {settings?.luxd_banner || "🔥 عرض خاص: ينتهي العرض عند انتهاء العداد"}
            </div>

            {/* Header */}
            <header className="p-4 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 border-yellow-500/40 shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm lux-gold-gradient">
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-black lux-gold-gradient">{settings?.store_name || "متجري"}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-gray-400" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_visitors')}>
                        {settings?.luxd_visitors || "142 متسوق حالياً"}
                    </span>
                </div>
            </header>

            {/* Product Showcase */}
            <main className="max-w-md mx-auto px-4 mt-6">
                
                {/* Main Image Container */}
                <div className="lux-img-slot rounded-3xl mb-4" onClick={() => canManage && fileMainRef.current?.click()}>
                    {mainImage ? (
                        <img src={mainImage} alt="Main" />
                    ) : ( 
                        <div className="text-center text-gray-500">
                            <i className="ph ph-camera text-5xl"></i>
                            <p className="text-sm mt-2">انقر لإضافة الصورة الأساسية</p>
                        </div>
                   )}
                   {canManage && <input type="file" ref={fileMainRef} className="hidden" accept="image/*" onChange={handleImgUpload(setMainImage)} /> }
                </div>

                {/* Thumbnails */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    <div className="lux-img-slot rounded-xl h-20" onClick={() => (!t1Image && canManage) ? fileT1Ref.current?.click() : handleThumbClick(t1Image)}>
                        {t1Image ? <img src={t1Image} /> : <i className="ph ph-plus text-gray-600"></i>}
                        {!t1Image && canManage && <input type="file" ref={fileT1Ref} className="hidden" accept="image/*" onChange={handleImgUpload(setT1Image, true)} /> }
                    </div>
                    <div className="lux-img-slot rounded-xl h-20" onClick={() => (!t2Image && canManage) ? fileT2Ref.current?.click() : handleThumbClick(t2Image)}>
                        {t2Image ? <img src={t2Image} /> : <i className="ph ph-plus text-gray-600"></i>}
                        {!t2Image && canManage && <input type="file" ref={fileT2Ref} className="hidden" accept="image/*" onChange={handleImgUpload(setT2Image, true)} /> }
                    </div>
                    <div className="lux-img-slot rounded-xl h-20" onClick={() => (!t3Image && canManage) ? fileT3Ref.current?.click() : handleThumbClick(t3Image)}>
                        {t3Image ? <img src={t3Image} /> : <i className="ph ph-plus text-gray-600"></i>}
                        {!t3Image && canManage && <input type="file" ref={fileT3Ref} className="hidden" accept="image/*" onChange={handleImgUpload(setT3Image, true)} /> }
                    </div>
                    <div className="lux-img-slot rounded-xl h-20" onClick={() => (!t4Image && canManage) ? fileT4Ref.current?.click() : handleThumbClick(t4Image)}>
                        {t4Image ? <img src={t4Image} /> : <i className="ph ph-plus text-gray-600"></i>}
                        {!t4Image && canManage && <input type="file" ref={fileT4Ref} className="hidden" accept="image/*" onChange={handleImgUpload(setT4Image, true)} /> }
                    </div>
                </div>

                {/* Title & Price */}
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-bold leading-tight" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_title')}>
                        {settings?.luxd_title || product?.title || `ساعة "إمبراطور" الفاخرة - إصدار محدود`}
                    </h1>
                    <div className="flex justify-center items-center gap-4">
                        <span className="text-3xl font-black text-white" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_price')}>
                            {product?.price || "8500"} دج
                        </span>
                        <span className="text-lg text-gray-500 line-through" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_compare_price')}>
                            {(product as any)?.compare_at_price ? `${(product as any).compare_at_price} دج` : "12000 دج"}
                        </span>
                    </div>
                    <p className="text-green-400 font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_savings')}>
                        {settings?.luxd_savings || "وفرت 3500 دج اليوم!"}
                    </p>
                </div>

                {/* Countdown */}
                {(showCountdown || canManage) && (
                <div className="lux-glass-card rounded-2xl p-4 mb-8 text-center relative overflow-visible" data-edit-path="countdown">
                    {canManage && (
                        <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                            <button
                                onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'luxd_show_countdown', value: !showCountdown }, '*')}
                                className="flex items-center gap-1 font-bold"
                            >
                                {showCountdown ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                            </button>
                        </div>
                    )}
                    {showCountdown && (
                    <>
                    <p className="text-sm text-gray-400 mb-2">ينتهي هذا العرض في:</p>
                    <div className="flex justify-center gap-4 text-2xl font-bold">
                        <div><span>{timeLeft.min.toString().padStart(2, '0')}</span><p className="text-[10px] text-gray-500 uppercase">دقيقة</p></div>
                        <div style={{ color: accentColor }}>:</div>
                        <div><span>{timeLeft.sec.toString().padStart(2, '0')}</span><p className="text-[10px] text-gray-500 uppercase">ثانية</p></div>
                    </div>
                    </>
                    )}
                    {canManage && !showCountdown && (
                        <span className="text-gray-500 text-xs">⏱️ Countdown hidden</span>
                    )}
                </div>
                )}

                {/* Quick Features */}
                {(showFeatures || canManage) && (
                <div className="space-y-3 mb-8 relative overflow-visible" data-edit-path="features">
                    {canManage && (
                        <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                            <button
                                onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'luxd_show_features', value: !showFeatures }, '*')}
                                className="flex items-center gap-1 font-bold"
                            >
                                {showFeatures ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                            </button>
                        </div>
                    )}
                    {showFeatures && (
                    <>
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
                    </>
                    )}
                    {canManage && !showFeatures && (
                        <span className="text-gray-500 text-xs">⭐ Features hidden</span>
                    )}
                </div>
                )}

                {/* Sticky Form Section */}
                <div id="order-form" className="bg-white text-black p-6 rounded-3xl mb-8">
                    <h3 className="text-xl font-black mb-4 text-center" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_form_title')}>
                        {settings?.luxd_form_title || "املأ المعلومات لإتمام الطلب"}
                    </h3>
                    {orderSuccess ? (
                        <div className="bg-green-50 p-6 rounded-3xl border border-green-200 text-center">
                            <h3 className="text-2xl font-black mb-2 text-green-700">تم الشراء بنجاح!</h3>
                            <p className="text-gray-600 font-bold">سنتصل بك لتأكيد طلبك في أقرب وقت.</p>
                        </div>
                    ) : (
                    <form className="space-y-4" onSubmit={handleOrder}>
                        <input required name="name" type="text" placeholder="الاسم الكامل" className="w-full bg-gray-100 p-4 rounded-xl font-bold outline-none focus:ring-2 ring-yellow-500" />
                        <input required name="phone" type="tel" placeholder="رقم الهاتف" className="w-full bg-gray-100 p-4 rounded-xl font-bold outline-none focus:ring-2 ring-yellow-500 text-left" dir="ltr" />
                        <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full bg-gray-100 p-4 rounded-xl font-bold outline-none focus:ring-2 ring-yellow-500 text-right">
                            <option value="">اختر الولاية</option>
                            {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
                        </select>
                        {selectedWilayaId && (
                            <div className="p-2 bg-emerald-50 rounded-lg text-sm font-bold text-emerald-700 flex justify-between">
                                <span>سعر التوصيل:</span>
                                <span>{deliveryFee} دج</span>
                            </div>
                        )}
                        <button disabled={isSubmitting} type="submit" className="w-full lux-gold-bg text-black py-5 rounded-xl text-xl font-black shadow-xl uppercase disabled:opacity-50">
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('luxd_form_btn')}>
                                {isSubmitting ? "جاري الشراء..." : (settings?.luxd_form_btn || "تأكيد الشراء الآن")}
                            </span>
                        </button>
                    </form>
                    )}
                </div>

            </main>

            {/* Fake Social Proof Popup */}
            {(showSocialProof || canManage) && (
            <div className={`fixed bottom-24 left-4 right-4 md:left-auto md:w-80 lux-glass-card p-3 rounded-2xl flex items-center gap-3 lux-notification-pop z-40 transition-all duration-300 relative overflow-visible ${socialProof.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`} data-edit-path="social-proof">
                {canManage && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                        <button
                            onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'luxd_show_social', value: !showSocialProof }, '*')}
                            className="flex items-center gap-1 font-bold"
                        >
                            {showSocialProof ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                        </button>
                    </div>
                )}
                {showSocialProof && (
                <>
                <div className="w-12 h-12 bg-gray-700 rounded-full flex-shrink-0 flex items-center justify-center">
                    <i className="ph ph-user text-xl"></i>
                </div>
                <div className="text-xs">
                    <p><strong>{socialProof.name}</strong></p>
                    <p className="text-gray-400">طلب هذا المنتج منذ 3 دقائق</p>
                </div>
                </>
                )}
                {canManage && !showSocialProof && (
                    <span className="text-gray-500 text-xs">⭐ Social proof hidden</span>
                )}
            </div>
            )}

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center gap-4 z-50">
                <div className="flex-1">
                    <div className="text-xs text-gray-400">السعر الإجمالي:</div>
                    <div className="text-lg font-bold lux-gold-gradient">
                        {(product?.price || 0) + deliveryFee} دج
                    </div>
                </div>
                <button onClick={scrollToOrder} className="flex-[2] lux-gold-bg text-black py-3 rounded-xl font-black flex items-center justify-center gap-2">
                    <i className="ph ph-shopping-cart-simple text-xl"></i>
                    اطلب الآن
                </button>
            </div>

        </div>
    );
}
