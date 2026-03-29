import React, { useEffect, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

export default function DZPremiumTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#059669'); // Emerald Green
    const accentColor = settings?.template_accent_color || primaryColor;
        const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const deliveryFee = selectedWilaya?.homePrice ?? 0;

    const handleDefaultOrder = async (e: React.FormEvent<HTMLFormElement>) => {
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

    const productId = settings?.dzp_main_product_id;
    const product = (productId ? products?.find((p: any) => String(p.id) === String(productId)) : null) || products?.[0];
    const hasProductImages = product?.images && product.images.length > 0;

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
        if (!document.getElementById('tajawal-font')) {
            const link = document.createElement('link');
            link.id = 'tajawal-font';
            link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    // Set variable on root
    useEffect(() => {
        document.documentElement.style.setProperty('--accent', primaryColor);
    }, [primaryColor]);

    const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.textContent || '';
        window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    };

    // Refs for Image Uploads
    const heroFileInputRef = useRef<HTMLInputElement>(null);
    const f1FileInputRef = useRef<HTMLInputElement>(null);
    const f2FileInputRef = useRef<HTMLInputElement>(null);

    const [heroImgUrl, setHeroImgUrl] = useState<string>(product?.images?.[0] || "");
    const [f1ImgUrl, setF1ImgUrl] = useState<string>("");
    const [f2ImgUrl, setF2ImgUrl] = useState<string>("");

    // Auto-sync images when product changes
    useEffect(() => {
        if (product?.images) {
            setHeroImgUrl(product.images[0] || "");
            setF1ImgUrl(product.images[1] || "");
            setF2ImgUrl(product.images[2] || "");
        }
    }, [product]);


    const handleImageChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
                if (evt.target?.result) {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_SIZE = 800; // max dimension
                        if (width > MAX_SIZE || height > MAX_SIZE) {
                            if (width > height) {
                                height = Math.round((height * MAX_SIZE) / width);
                                width = MAX_SIZE;
                            } else {
                                width = Math.round((width * MAX_SIZE) / height);
                                height = MAX_SIZE;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, width, height);
                            setter(canvas.toDataURL('image/jpeg', 0.8));
                        } else {
                            setter(evt.target!.result as string);
                        }
                    };
                    img.src = evt.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const scrollToOrder = () => {
        document.getElementById('order-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ fontFamily: "'Tajawal', sans-serif", backgroundColor: settings?.template_bg_color || undefined }} className="pb-32 md:pb-0 bg-white text-gray-900" dir="rtl">
            <style>{`
                .premium-benefit-card { transition: transform 0.3s ease; }
                .premium-benefit-card:hover { transform: translateY(-5px); }
                [contenteditable="true"]:focus { outline: 2px solid var(--accent); border-radius: 4px; background: #fff; }
                .premium-img-container { position: relative; background: #f3f4f6; min-height: 200px; display: flex; align-items: center; justify-content: center; border: 2px dashed #e5e7eb; cursor: pointer; }
                .premium-img-container img { max-width: 100%; height: auto; display: block; }
                @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(249, 115, 22, 0); } 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); } }
                .premium-pulse-btn { animation: pulse-orange 2s infinite; }
            `}</style>

            {/* Promo Header */}
            <div className="bg-black text-white py-2 overflow-hidden whitespace-nowrap">
                <div className="flex space-x-8 space-x-reverse text-sm font-medium justify-center">
                    <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_promo1')}>
                        {settings?.dzp_promo1 || "✨ تخفيضات حصرية لليوم فقط ✨"}
                    </span>
                    <span className="hidden md:inline" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_promo2')}>
                        {settings?.dzp_promo2 || "🚚 توصيل سريع لـ 58 ولاية 🚚"}
                    </span>
                    <span className="hidden lg:inline" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_promo3')}>
                        {settings?.dzp_promo3 || "💳 الدفع عند الاستلام 💳"}
                    </span>
                </div>
            </div>

            {/* Header / Logo */}
            <header className="bg-white border-b sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "متجري"} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: 'var(--accent)' }}>
                            {(settings?.store_name || 'م').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-extrabold" style={{ color: 'var(--accent)' }}>{settings?.store_name || "متجري"}</span>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative bg-white">
                <div className="max-w-4xl mx-auto px-4 pt-8 pb-12 text-center">
                    <div className="mb-4 flex justify-center">
                         <span className="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-bold" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_badge')}>
                             {settings?.dzp_badge || "الأكثر مبيعاً في الجزائر 🇩🇿"}
                         </span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-6 leading-tight" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_hero_title')}>
                        {settings?.dzp_hero_title || product?.title || "اكتشف السر وراء الراحة التامة مع منتجنا الجديد"}
                    </h1>
                    
                    {/* Main Landing Image */}
                    <div className="premium-img-container rounded-3xl overflow-hidden mb-8 shadow-xl border-none" onClick={() => canManage && heroFileInputRef.current?.click()}>
                        {heroImgUrl ? (
                            <img src={heroImgUrl} alt={product?.title || "Product"} className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 pointer-events-none">
                                <i className="ph ph-image-square text-6xl"></i>
                                <p className="font-bold mt-2">ضع صورة المنتج الرئيسية هنا</p>
                            </div>
                        )}
                        {canManage && <input type="file" ref={heroFileInputRef} className="hidden" accept="image/*" onChange={handleImageChange(setHeroImgUrl)} /> }
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10">
                        <div className="flex items-center gap-2">
                            <span className="text-4xl font-black text-emerald-600" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_price')}>
                                {product?.price || "3900"} دج
                            </span>
                            <span className="text-xl text-gray-400 line-through" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_compare_price')}>
                                {(product as any)?.compare_at_price ? `${(product as any)?.compare_at_price} دج` : "5500 دج"}
                            </span>
                        </div>
                        <button onClick={scrollToOrder} className="premium-pulse-btn text-white px-10 py-4 rounded-2xl text-xl font-black shadow-lg flex items-center gap-3" style={{ backgroundColor: accentColor }}>
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_cta_btn')}>
                                {settings?.dzp_cta_btn || "أطلب الآن - الكمية محدودة"}
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Why Us Section */}
            <section className="bg-gray-50 py-12 px-4">
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="premium-benefit-card bg-white p-6 rounded-2xl text-center shadow-sm">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="ph ph-truck text-2xl"></i>
                        </div>
                        <h3 className="font-bold text-lg mb-2" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit1_title')}>
                            {settings?.dzp_benefit1_title || "توصيل سريع"}
                        </h3>
                        <p className="text-sm text-gray-500" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit1_desc')}>
                            {settings?.dzp_benefit1_desc || "نوصل طلبك إلى باب المنزل في وقت قياسي لجميع الولايات"}
                        </p>
                    </div>
                    <div className="premium-benefit-card bg-white p-6 rounded-2xl text-center shadow-sm">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="ph ph-hand-coins text-2xl"></i>
                        </div>
                        <h3 className="font-bold text-lg mb-2" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit2_title')}>
                            {settings?.dzp_benefit2_title || "دفع آمن"}
                        </h3>
                        <p className="text-sm text-gray-500" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit2_desc')}>
                            {settings?.dzp_benefit2_desc || "لا تدفع شيئاً حتى تستلم منتجك وتتأكد من جودته بنفسك"}
                        </p>
                    </div>
                    <div className="premium-benefit-card bg-white p-6 rounded-2xl text-center shadow-sm">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="ph ph-shield-check text-2xl"></i>
                        </div>
                        <h3 className="font-bold text-lg mb-2" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit3_title')}>
                            {settings?.dzp_benefit3_title || "ضمان 100%"}
                        </h3>
                        <p className="text-sm text-gray-500" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_benefit3_desc')}>
                            {settings?.dzp_benefit3_desc || "إذا لم يعجبك المنتج، يمكنك استبداله أو استرجاع أموالك"}
                        </p>
                    </div>
                </div>
            </section>

            {/* Content Blocks */}
            <section className="py-16 px-4 max-w-3xl mx-auto space-y-12">
                <div className="text-center">
                    <h2 className="text-2xl md:text-4xl font-black mb-4" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_features_title')}>
                        {settings?.dzp_features_title || "لماذا يحب الجميع هذا المنتج؟"}
                    </h2>
                    <p className="text-gray-600" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_features_desc')}>
                        {settings?.dzp_features_desc || "إليك أهم المميزات التي تجعل حياتك أسهل وأفضل بكثير مع استخدامنا اليومي"}
                    </p>
                </div>

                {/* Feature 1 */}
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 w-full premium-img-container rounded-2xl overflow-hidden" onClick={() => canManage && f1FileInputRef.current?.click()}>
                        {f1ImgUrl || settings?.dzp_f1_img ? (
                            <img src={f1ImgUrl || settings?.dzp_f1_img} className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                                <i className="ph ph-image text-4xl"></i>
                            </div>
                        )}
                        {canManage && <input type="file" ref={f1FileInputRef} className="hidden" accept="image/*" onChange={handleImageChange(setF1ImgUrl)} /> }
                    </div>
                    <div className="flex-1 w-full space-y-4">
                        <h4 className="text-xl font-bold" style={{ color: 'var(--accent)' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_f1_title')}>
                            {settings?.dzp_f1_title || "الميزة الأولى: سهولة الاستخدام"}
                        </h4>
                        <p className="text-gray-600 leading-relaxed" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_f1_desc')}>
                            {settings?.dzp_f1_desc || "هذا النص يعبر عن ميزات المنتج وكيفية استخدامه. صممنا هذا المنتج ليكون بسيطاً وفعالاً في نفس الوقت ليناسب الجميع."}
                        </p>
                    </div>
                </div>

                {/* Feature 2 */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-8">
                    <div className="flex-1 w-full premium-img-container rounded-2xl overflow-hidden" onClick={() => canManage && f2FileInputRef.current?.click()}>
                        {f2ImgUrl || settings?.dzp_f2_img ? (
                            <img src={f2ImgUrl || settings?.dzp_f2_img} className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                                <i className="ph ph-image text-4xl"></i>
                            </div>
                        )}
                        {canManage && <input type="file" ref={f2FileInputRef} className="hidden" accept="image/*" onChange={handleImageChange(setF2ImgUrl)} /> }
                    </div>
                    <div className="flex-1 w-full space-y-4">
                        <h4 className="text-xl font-bold" style={{ color: 'var(--accent)' }} contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_f2_title')}>
                            {settings?.dzp_f2_title || "الميزة الثانية: جودة تدوم طويلاً"}
                        </h4>
                        <p className="text-gray-600 leading-relaxed" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_f2_desc')}>
                            {settings?.dzp_f2_desc || "نستخدم أفضل الخامات المتوفرة في السوق لضمان بقاء المنتج معكم لسنوات طويلة دون أي مشاكل تذكر."}
                        </p>
                    </div>
                </div>
            </section>

            {/* Order Form Section */}
            <section id="order-section" className="py-16 px-4 text-white" style={{ backgroundColor: '#064e3b' /* emerald-900 */ }}>
                <div className="max-w-xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black mb-2" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_form_title')}>
                            {settings?.dzp_form_title || "أطلب الآن قبل نفاذ الكمية"}
                        </h2>
                        <p className="text-emerald-200" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_form_subtitle')}>
                            {settings?.dzp_form_subtitle || "التوصيل مجاني اليوم فقط لجميع الطلبات!"}
                        </p>
                    </div>

                    {orderSuccess ? (
                    <div className="bg-white/20 p-8 rounded-3xl text-center border border-white/30 backdrop-blur-sm relative overflow-hidden">
                        <i className="ph ph-check-circle text-6xl text-white mb-4 animate-bounce"></i>
                        <h3 className="text-3xl font-black mb-2 text-white">تم تسجيل طلبك بنجاح!</h3>
                        <p className="text-emerald-100 text-lg">سنتصل بك قريباً لتأكيد طلبك وتحديد موعد التسليم.</p>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={handleDefaultOrder}>
                        <div>
                            <input required name="name" type="text" placeholder="الاسم واللقب" className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold outline-none border-4 border-transparent focus:border-emerald-400" />
                        </div>
                        <div>
                            <input required name="phone" type="tel" placeholder="رقم الهاتف" className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold outline-none border-4 border-transparent focus:border-emerald-400 text-right" dir="ltr" />
                        </div>
                        <div>
                            <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold outline-none border-4 border-transparent focus:border-emerald-400 appearance-none text-right">
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
                        <div>
                            <input name="address" type="text" placeholder="العنوان بالتفصيل (اختياري)" className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold outline-none border-4 border-transparent focus:border-emerald-400" />
                        </div>
                        
                        <button disabled={isSubmitting} type="submit" className="w-full py-5 rounded-2xl text-2xl font-black shadow-2xl transition-all active:scale-95 mt-4 text-white disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: accentColor }}>
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_form_btn')}>
                                {isSubmitting ? "جاري الطلب..." : (settings?.dzp_form_btn || "تأكيد الطلب الآن")}
                            </span>
                        </button>
                    </form>
                )}
                    
                    <p className="text-center mt-6 text-emerald-300 text-sm">
                        <i className="ph ph-check-circle align-middle ml-1"></i>
                        <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_form_footer')}>
                            {settings?.dzp_form_footer || "سنقوم بالاتصال بك هاتفياً لتأكيد الطلب"}
                        </span>
                    </p>
                </div>
            </section>
        </div>
    );
}
