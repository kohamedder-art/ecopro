import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import OfferSelector, { useProductOffers, SelectedOffer } from '@/components/storefront/OfferSelector';
import OrderSuccessConnect from '@/components/storefront/OrderSuccessConnect';
import VariantSelector, { SelectedVariant } from '@/components/storefront/VariantSelector';

export default function DZPremiumTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
    const accentColor = settings?.template_accent_color || settings?.primary_color || '#059669';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
    const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);
    const [lastCustomerPhone, setLastCustomerPhone] = useState<string | null>(null);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const { showAddress, showCommune, showNotes } = useOrderFields(settings);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const baseDeliveryFee = selectedWilaya?.homePrice ?? 0;

    const productId = settings?.dzp_main_product_id;
    const product = (productId ? products?.find((p: any) => String(p.id) === String(productId)) : null) || products?.[0];

    // Variant + Offer system
    const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
    const { offers } = useProductOffers(storeSlug, product?.id);
    const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
    useEffect(() => { if (offers.length > 0 && !selectedOffer) { const f = offers[0]; setSelectedOffer({ offer_id: f.id, quantity: f.quantity, bundle_price: f.bundle_price, free_delivery: f.free_delivery }); } }, [offers]);
    const deliveryFee = resolveDeliveryFee(product, selectedOffer, baseDeliveryFee);
    const productTotal = selectedOffer ? selectedOffer.bundle_price : (selectedVariant?.price ?? product?.price ?? 0);
    const grandTotal = productTotal + deliveryFee;

    // Image gallery
    const productImages = product?.images || [];
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
    const swipeTouchStartX = useRef<number | null>(null);
    const handleSwipeStart = (e: React.TouchEvent) => { swipeTouchStartX.current = e.touches[0].clientX; };
    const handleSwipeEnd = (e: React.TouchEvent) => {
        if (swipeTouchStartX.current === null) return;
        const diff = swipeTouchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) setSelectedImageIndex(i => diff > 0 ? Math.min(i + 1, productImages.length - 1) : Math.max(i - 1, 0));
        swipeTouchStartX.current = null;
    };
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.textContent || '';
        window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    };

    useEffect(() => {
        if (!document.getElementById('phosphor-icons')) {
            const s = document.createElement('script'); s.id = 'phosphor-icons'; s.src = 'https://unpkg.com/@phosphor-icons/web'; document.head.appendChild(s);
        }
        if (!document.getElementById('cairo-font')) {
            const l = document.createElement('link'); l.id = 'cairo-font'; l.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'; l.rel = 'stylesheet'; document.head.appendChild(l);
        }
    }, []);

    const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!product) return;
        setIsSubmitting(true);
        try {
            const fd = new FormData(e.currentTarget);
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_slug: storeSlug,
                    product_id: product.id,
                    ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
                    quantity: selectedOffer?.quantity || 1,
                    ...(selectedOffer ? { offer_id: selectedOffer.offer_id } : {}),
                    total_price: selectedOffer ? selectedOffer.bundle_price : (product.price || 0),
                    delivery_fee: deliveryFee,
                    delivery_type: 'desk',
                    customer_name: fd.get('name'),
                    customer_phone: fd.get('phone'),
                    customer_address: [selectedWilaya?.labelAR || '', fd.get('commune'), fd.get('address'), fd.get('notes')].filter(Boolean).join(' - '),
                    shipping_wilaya_id: selectedWilayaId,
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Order error');
            setLastOrderId(data.order?.id || null);
            setLastTelegramUrl(data.telegramStartUrl || null);
            setLastCustomerPhone(String(fd.get('phone') || ''));
            setOrderSuccess(true);
        } catch (err) { console.error(err); alert('حدث خطأ أثناء تقديم الطلب.'); }
        finally { setIsSubmitting(false); }
    };

    const heroImage = productImages[selectedImageIndex] || productImages[0] || null;
    const heroBg = settings?.template_bg_color || '#0a0a0a';

    return (
        <div style={{ fontFamily: "'Cairo', sans-serif" }} className="min-h-screen" dir="rtl">
            <style>{`
                .dzp-input { width:100%; padding:12px 16px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:#fff; font-family:inherit; font-weight:600; outline:none; transition:border-color 0.2s; }
                .dzp-input::placeholder { color:rgba(255,255,255,0.35); }
                .dzp-input:focus { border-color:${accentColor}; }
                .dzp-input option { color:#000; background:#fff; }
                .dzp-pulse { animation: dzp-pulse-anim 2s infinite; }
                @keyframes dzp-pulse-anim { 0%,100%{box-shadow:0 0 0 0 ${accentColor}88;} 50%{box-shadow:0 0 0 12px ${accentColor}00;} }
                [contenteditable="true"]:focus { outline:2px solid ${accentColor}; border-radius:4px; background:rgba(255,255,255,0.1); }
                .dzp-form-input { width:100%; padding:14px 16px; border-radius:12px; border:1.5px solid #2d4a3e; background:#0f2d22; color:#fff; font-family:inherit; font-weight:600; outline:none; transition:border-color 0.2s; font-size:15px; }
                .dzp-form-input::placeholder { color:#4a7a62; }
                .dzp-form-input:focus { border-color:${accentColor}; }
                .dzp-form-input option { background:#0f2d22; color:#fff; }
            `}</style>

            {/* ── TOP NOTICE BAR ── */}
            <div className="text-center py-2 text-xs font-bold tracking-wide" style={{ backgroundColor: accentColor, color: '#fff' }}>
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_promo1')}>
                    {settings?.dzp_promo1 || "🚚 توصيل لجميع الولايات · الدفع عند الاستلام · ضمان الجودة"}
                </span>
            </div>

            {/* ── HERO SECTION ── dark split layout ── */}
            <section className="relative min-h-screen lg:min-h-[90vh]" style={{ backgroundColor: heroBg }}>

                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px]" style={{ backgroundColor: accentColor }} />
                    <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full opacity-8 blur-[100px]" style={{ backgroundColor: accentColor }} />
                </div>

                {/* Header inside hero */}
                <header className="relative z-10 px-6 py-4 flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-3">
                        {settings?.store_logo ? (
                            <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: accentColor }}>
                                {(settings?.store_name || 'م').charAt(0)}
                            </div>
                        )}
                        <span className="font-extrabold text-white">{settings?.store_name || 'متجري'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs text-white/50 hidden md:inline">متاح للطلب الآن</span>
                    </div>
                </header>

                {/* Desktop: split | Mobile: stacked */}
                <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                    {/* LEFT: product image */}
                    <div className="relative">
                        <div className="rounded-3xl overflow-hidden shadow-2xl select-none" style={{ aspectRatio: '4/5', maxHeight: '580px' }}
                            onTouchStart={handleSwipeStart}
                            onTouchEnd={handleSwipeEnd}>
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
                          ) : heroImage ? (
                            <div className="w-full h-full cursor-zoom-in" onClick={() => setZoomImage(heroImage)}>
                              <img src={heroImage} alt={product?.title} className="w-full h-full object-cover pointer-events-none" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center border-2 border-dashed border-white/20 text-white/30 w-full h-full">
                              <div className="text-center">
                                <i className="ph ph-image text-5xl block mb-2"></i>
                                <p className="text-sm">أضف منتجاً من لوحة التحكم</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Thumbnail strip */}
                        {(videoEmbed || productImages.length > 1) && (
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                                {videoEmbed && (
                                  <button onClick={() => setShowVideo(true)} className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center transition-all" style={{ border: showVideo ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.1)', backgroundColor: '#000' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                                  </button>
                                )}
                                {productImages.map((img: string, i: number) => (
                                    <button key={i} onClick={() => { setShowVideo(false); setSelectedImageIndex(i); }}
                                        className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden transition-all"
                                        style={{ border: !showVideo && i === selectedImageIndex ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.1)' }}>
                                        <img src={img} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: info + CTA / form */}
                    <div className="text-white space-y-5">
                        {/* Badge */}
                        <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border" style={{ backgroundColor: accentColor + '20', borderColor: accentColor + '50', color: accentColor }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }}></span>
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_badge')}>
                                {settings?.dzp_badge || "الأكثر مبيعاً في الجزائر 🇩🇿"}
                            </span>
                        </span>

                        {/* Title */}
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black leading-tight text-white" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_hero_title')}>
                            {settings?.dzp_hero_title || product?.title || "اكتشف السر وراء الراحة التامة مع منتجنا الجديد"}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-white/60 leading-relaxed text-sm" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_hero_sub')}>
                            {settings?.dzp_hero_sub || "جودة عالية، شحن سريع، دفع عند الاستلام — اطلب الآن قبل نفاذ الكمية"}
                        </p>

                        {/* Price */}
                        <div className="flex items-center gap-4">
                            <span className="text-4xl font-black" style={{ color: accentColor }}>
                                {Math.round(product?.price ?? 3900).toLocaleString()} دج
                            </span>
                            {(product as any)?.compare_at_price && (
                                <span className="text-lg line-through text-white/30">
                                    {Math.round((product as any).compare_at_price ?? 0).toLocaleString()} دج
                                </span>
                            )}
                            {(product as any)?.compare_at_price && product?.price && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                    -{Math.round((1 - product.price / (product as any).compare_at_price) * 100)}%
                                </span>
                            )}
                        </div>

                        {/* Trust pills */}
                        <div className="flex flex-wrap gap-2">
                            {['🚚 توصيل سريع', '💵 الدفع عند الاستلام', '🛡️ ضمان الجودة'].map(t => (
                                <span key={t} className="text-xs px-3 py-1 rounded-full bg-white/8 border border-white/10 text-white/70">{t}</span>
                            ))}
                        </div>

                        {/* Desktop: inline form | Mobile: show form button */}
                        <div className="hidden lg:block">
                            <OrderForm
                                product={product} wilayas={wilayas} selectedWilayaId={selectedWilayaId}
                                setSelectedWilayaId={setSelectedWilayaId} deliveryFee={deliveryFee} productTotal={productTotal} grandTotal={grandTotal}
                                selectedVariant={selectedVariant} setSelectedVariant={setSelectedVariant}
                                offers={offers} selectedOffer={selectedOffer} setSelectedOffer={setSelectedOffer}
                                showAddress={showAddress} showCommune={showCommune} showNotes={showNotes}
                                isSubmitting={isSubmitting} orderSuccess={orderSuccess}
                                lastOrderId={lastOrderId} lastTelegramUrl={lastTelegramUrl} lastCustomerPhone={lastCustomerPhone}
                                accentColor={accentColor} storeSlug={storeSlug} onSubmit={handleOrder}
                                canManage={canManage} handleTextEdit={handleTextEdit}
                            />
                        </div>

                        {/* Mobile CTA button */}
                        <button
                            className="lg:hidden w-full py-4 rounded-2xl text-white font-black text-lg dzp-pulse shadow-xl"
                            style={{ backgroundColor: accentColor }}
                            onClick={() => setShowForm(true)}
                        >
                            <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_cta_btn')}>
                                {settings?.dzp_cta_btn || "أطلب الآن — الكمية محدودة"}
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            {/* ── BENEFITS STRIP ── */}
            <section className="py-12 px-4" style={{ backgroundColor: '#0f1a14' }}>
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: 'ph-truck', titleKey: 'dzp_benefit1_title', descKey: 'dzp_benefit1_desc', def_title: 'توصيل سريع', def_desc: 'نوصل طلبك في وقت قياسي لجميع الولايات' },
                        { icon: 'ph-hand-coins', titleKey: 'dzp_benefit2_title', descKey: 'dzp_benefit2_desc', def_title: 'دفع آمن', def_desc: 'لا تدفع شيئاً حتى تستلم منتجك وتتأكد' },
                        { icon: 'ph-shield-check', titleKey: 'dzp_benefit3_title', descKey: 'dzp_benefit3_desc', def_title: 'ضمان 100%', def_desc: 'إذا لم يعجبك المنتج يمكنك الاستبدال' },
                    ].map((b) => (
                        <div key={b.icon} className="flex items-start gap-4 p-4 rounded-2xl border border-white/5 bg-white/3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '20' }}>
                                <i className={`ph ${b.icon} text-xl`} style={{ color: accentColor }}></i>
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(b.titleKey)}>
                                    {(settings as any)?.[b.titleKey] || b.def_title}
                                </p>
                                <p className="text-white/40 text-xs mt-0.5" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit(b.descKey)}>
                                    {(settings as any)?.[b.descKey] || b.def_desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── PRODUCT DESCRIPTION ── */}
            {product?.description && (
                <section className="py-12 px-4" style={{ backgroundColor: '#080f0b' }}>
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-xl font-black text-white mb-6 border-b border-white/10 pb-4">وصف المنتج</h2>
                        <div className="prose prose-invert max-w-none text-white/70" dangerouslySetInnerHTML={{ __html: product.description }} />
                    </div>
                </section>
            )}

            {/* ── FOOTER ── */}
            <footer className="py-6 text-center text-xs border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', backgroundColor: heroBg, color: 'rgba(255,255,255,0.3)' }}>
                © {new Date().getFullYear()} {settings?.store_name || 'متجري'} · صنع بواسطة{' '}
                <a href="https://sahla4eco.com" target="_blank" rel="noopener noreferrer" style={{ color: accentColor }}>Sahla4Eco</a>
            </footer>

            {/* ── MOBILE SLIDE-UP FORM SHEET ── */}
            {showForm && (
                <div className="lg:hidden fixed inset-0 z-50 flex items-end">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                    <div className="relative w-full rounded-t-3xl overflow-y-auto max-h-[90vh] p-6" style={{ backgroundColor: '#0a1a11' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-white text-lg">تفاصيل الطلب</h3>
                            <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 bg-white/10">
                                <i className="ph ph-x"></i>
                            </button>
                        </div>
                        <OrderForm
                            product={product} wilayas={wilayas} selectedWilayaId={selectedWilayaId}
                            setSelectedWilayaId={setSelectedWilayaId} deliveryFee={deliveryFee} productTotal={productTotal} grandTotal={grandTotal}
                            selectedVariant={selectedVariant} setSelectedVariant={setSelectedVariant}
                            offers={offers} selectedOffer={selectedOffer} setSelectedOffer={setSelectedOffer}
                            showAddress={showAddress} showCommune={showCommune} showNotes={showNotes}
                            isSubmitting={isSubmitting} orderSuccess={orderSuccess}
                            lastOrderId={lastOrderId} lastTelegramUrl={lastTelegramUrl} lastCustomerPhone={lastCustomerPhone}
                            accentColor={accentColor} storeSlug={storeSlug} onSubmit={handleOrder}
                            canManage={canManage} handleTextEdit={handleTextEdit}
                        />
                    </div>
                </div>
            )}

            {/* ── IMAGE ZOOM MODAL ── */}
            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" onClick={() => setZoomImage(null)}>
                        <i className="ph ph-x text-xl"></i>
                    </button>
                    <img src={zoomImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

/* ─── Extracted Order Form ─── */
function OrderForm({ product, wilayas, selectedWilayaId, setSelectedWilayaId, deliveryFee, productTotal, grandTotal, selectedVariant, setSelectedVariant, offers, selectedOffer, setSelectedOffer, showAddress, showCommune, showNotes, isSubmitting, orderSuccess, lastOrderId, lastTelegramUrl, lastCustomerPhone, accentColor, storeSlug, onSubmit, canManage, handleTextEdit }: any) {
    if (orderSuccess) {
        return (
            <div className="rounded-2xl p-6 text-center border" style={{ backgroundColor: accentColor + '15', borderColor: accentColor + '40' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: accentColor }}>
                    <i className="ph ph-check text-2xl text-white"></i>
                </div>
                <h3 className="font-black text-white text-xl mb-1">تم تسجيل طلبك!</h3>
                <p className="text-white/50 text-sm mb-4">سنتصل بك قريباً لتأكيد الطلب.</p>
                <OrderSuccessConnect storeSlug={storeSlug} accentColor={accentColor} orderId={lastOrderId} telegramStartUrl={lastTelegramUrl} customerPhone={lastCustomerPhone || undefined} />
            </div>
        );
    }
    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {product?.variants && product.variants.length > 0 && (
                <VariantSelector variants={product.variants} selected={selectedVariant} onSelect={setSelectedVariant} accentColor={accentColor} currency="دج" basePrice={product.price} />
            )}
            {offers.length > 0 && (
                <OfferSelector offers={offers} unitPrice={product?.price || 0} currency="دج" selectedOfferId={selectedOffer?.offer_id ?? null} onSelect={setSelectedOffer} accentColor={accentColor} textColor="#fff" borderColor="rgba(255,255,255,0.1)" />
            )}
            <input required name="name" type="text" placeholder="الاسم الكامل" className="dzp-form-input" />
            <input required name="phone" type="tel" placeholder="رقم الهاتف" className="dzp-form-input" dir="ltr" style={{ textAlign: 'right' }} />
            <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={e => setSelectedWilayaId(Number(e.target.value) || null)} className="dzp-form-input appearance-none">
                <option value="">اختر الولاية</option>
                {wilayas.map((w: any) => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
            </select>
            {selectedWilayaId && (
                <div className="rounded-xl p-3 text-sm space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex justify-between text-white/50">
                        <span>سعر المنتجات</span>
                        <span className="font-bold text-white">{Math.round(productTotal ?? 0).toLocaleString()} دج</span>
                    </div>
                    <div className="flex justify-between text-white/50">
                        <span>سعر التوصيل</span>
                        <span className="font-bold" style={{ color: accentColor }}>{Math.round(deliveryFee ?? 0).toLocaleString()} دج</span>
                    </div>
                    <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                        <span className="font-bold text-white">التكلفة الإجمالية</span>
                        <span className="font-black" style={{ color: accentColor }}>{Math.round(grandTotal ?? 0).toLocaleString()} دج</span>
                    </div>
                </div>
            )}
            {showCommune && <input name="commune" type="text" placeholder="البلدية" className="dzp-form-input" />}
            {showAddress && <input name="address" type="text" placeholder="العنوان" className="dzp-form-input" />}
            {showNotes && <textarea name="notes" placeholder="ملاحظات" rows={2} className="dzp-form-input resize-none" />}
            <button disabled={isSubmitting} type="submit"
                className="w-full py-4 rounded-xl text-white font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 dzp-pulse"
                style={{ backgroundColor: accentColor }}>
                <span contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('dzp_form_btn')}>
                    {isSubmitting ? 'جاري الطلب...' : (/* settings handled by parent */ 'تأكيد الطلب الآن')}
                </span>
            </button>
            <p className="text-center text-xs text-white/30 flex items-center justify-center gap-1">
                <i className="ph ph-lock-key"></i> الدفع عند الاستلام بعد معاينة المنتج
            </p>
        </form>
    );
}
