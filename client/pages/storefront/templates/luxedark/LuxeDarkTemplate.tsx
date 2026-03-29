import React, { useEffect, useRef, useState } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';

export default function LuxeDarkTemplate({ settings, products, storeSlug }: TemplateProps) {
    const defaultColor = '#d4af37'; // Luxury Gold
    const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || defaultColor);
    const accentColor = settings?.template_accent_color || primaryColor;

    // Sync primaryColor when settings change (e.g. in editor iframe)
    useEffect(() => {
        if (settings?.primary_color) {
            setPrimaryColor(settings.primary_color);
        }
    }, [settings?.primary_color]);
    
    // Inject Phosphor Icons and Fonts
    useEffect(() => {
        if (!document.getElementById('phosphor-icons')) {
            const script = document.createElement('script');
            script.id = 'phosphor-icons';
            script.src = 'https://unpkg.com/@phosphor-icons/web';
            document.head.appendChild(script);
        }
        if (!document.getElementById('playfair-font')) {
            const link = document.createElement('link');
            link.id = 'playfair-font';
            link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, []);

    // Set CSS Variables
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--luxe-primary', primaryColor);
        root.style.setProperty('--luxe-font', settings?.template_font_family === 'sans' ? "'Inter', sans-serif" : "'Playfair Display', serif");
        root.style.setProperty('--luxe-radius', settings?.template_border_radius === 'none' ? '0px' : settings?.template_border_radius === 'full' ? '9999px' : '8px');
    }, [primaryColor, settings?.template_font_family, settings?.template_border_radius]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const { wilayas } = useStoreDeliveryPrices(storeSlug);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const deliveryFee = selectedWilaya?.homePrice ?? 0;

    const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const fd = new FormData(e.currentTarget);
        const name = fd.get('name') as string;
        const phone = fd.get('phone') as string;
        
        const mainProduct = (settings?.dzp_main_product_id ? products?.find((p: any) => String(p.id) === String(settings?.dzp_main_product_id)) : null) || products?.[0];

        if (!name || !phone || !selectedWilayaId || !mainProduct) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            setIsSubmitting(true);

            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_slug: storeSlug,
                    product_id: mainProduct.id,
                    quantity: 1,
                    total_price: mainProduct.price,
                    delivery_fee: deliveryFee,
                    delivery_type: 'desk', 
                    customer_name: name,
                    customer_phone: phone,
                    customer_address: selectedWilaya?.labelFR || ''
                })
            });

            const data = await res.json();
            if (res.ok) {
                setOrderSuccess(true);
            } else {
                alert(data.error || 'Error processing order');
            }
        } catch (err: any) {
            console.error('Order error', err);
            alert('Error processing order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.textContent || '';
        // Send a message to the React parent (the editor iframe wrapper) to update the setting live
        window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
    };

    return (
        <div className="bg-[#0a0a0b] text-slate-300 min-h-screen relative pb-24 md:pb-0 font-sans" style={{ fontFamily: 'var(--luxe-font)', isolation: 'isolate', backgroundColor: settings?.template_bg_color || undefined }} dir="rtl">
            <style dangerouslySetInnerHTML={{ __html: `
                :root {
                    --luxe-primary: ${primaryColor};
                    --luxe-radius: 8px;
                    --luxe-font: 'Playfair Display', serif;
                }
                .luxe-border { border-radius: var(--luxe-radius); }
                [contenteditable="true"] { outline: none; transition: 0.2s; border-radius: 4px; border: 1px solid transparent; }
                [contenteditable="true"]:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); cursor: text; }
                [contenteditable="true"]:focus { border-color: var(--luxe-primary); background: rgba(0,0,0,0.5); }
                .glow-btn { box-shadow: 0 0 20px -5px var(--luxe-primary); transition: all 0.3s; }
                .glow-btn:hover { box-shadow: 0 0 30px 0px var(--luxe-primary); transform: translateY(-2px); }
            `}} />

            {/* Announcement Bar */}
            <div className="text-center py-2 text-xs font-medium tracking-[0.2em] text-[#0a0a0b] uppercase" style={{ backgroundColor: 'var(--luxe-primary)' }}>
                <span contentEditable suppressContentEditableWarning onBlur={handleTextEdit('template_top_notice')}>
                    {settings?.template_top_notice || "COMPLIMENTARY WORLDWIDE SHIPPING"}
                </span>
            </div>

            {/* Header */}
            <header className="px-6 py-6 flex justify-between items-center border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    {settings?.store_logo ? (
                        <img src={settings.store_logo} alt={settings?.store_name || "فاخر"} className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-sm" />
                    ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-black font-bold text-sm bg-white shadow-sm">
                            {(settings?.store_name || 'ف').charAt(0)}
                        </div>
                    )}
                    <span className="text-lg font-bold tracking-widest text-white uppercase">{settings?.store_name || "فاخر"}</span>
                </div>
                <div className="flex gap-4">
                    <i className="ph ph-magnifying-glass text-xl hover:text-white transition-colors cursor-pointer"></i>
                    <i className="ph ph-tote text-xl hover:text-white transition-colors cursor-pointer"></i>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
                
                {/* Left: Product Images */}
                <div className="md:col-span-6 lg:col-span-7 space-y-4">
                    <div className="aspect-[4/5] overflow-hidden bg-[#111] luxe-border border border-white/5 relative group">
                        <img 
                            src={settings?.banner_url || "https://images.unsplash.com/photo-1615397323789-980bd353d9e0?q=80&w=2600&auto=format&fit=crop"} 
                            alt="Product" 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                        />
                    </div>
                </div>

                {/* Right: Product Details & Checkout */}
                <div className="md:col-span-6 lg:col-span-5 flex flex-col justify-center">
                    <div className="inline-block mb-4">
                        <span className="text-xs uppercase tracking-widest px-3 py-1 border border-white/10 luxe-border" style={{ color: 'var(--luxe-primary)' }}>
                            Premium Collection
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-normal text-white mb-4 leading-tight" contentEditable suppressContentEditableWarning onBlur={handleTextEdit('template_hero_heading')}>
                        {products?.[0]?.title || "Ethereal Glow Serum"}
                    </h1>
                    
                    <div className="flex items-center gap-4 mb-8">
                        <span className="text-2xl text-white font-light">
                            {settings?.currency_code || '$'}{products?.[0]?.price || "145.00"}
                        </span>
                        <span className="text-lg text-slate-600 line-through">
                            {settings?.currency_code || '$'}{products?.[0]?.original_price || "195.00"}
                        </span>
                    </div>

                    <div className="text-slate-400 font-light leading-relaxed mb-10 text-sm md:text-base border-b border-white/5 pb-8" contentEditable suppressContentEditableWarning onBlur={handleTextEdit('template_hero_subtitle')}>
                        {settings?.template_hero_subtitle || "A transformative nightly treatment infused with pure botanical extracts and 24k gold flakes. Restores luminosity and deeply hydrates your skin overnight."}
                    </div>

                    {/* Direct Checkout Form */}
                    <div className="bg-[#111] luxe-border p-6 border border-white/5">
                        <h3 className="text-sm uppercase tracking-widest text-white mb-6">Complete Your Order</h3>
                        {orderSuccess ? (
                            <div className="bg-green-900/20 p-6 border border-green-500/30 text-center luxe-border">
                                <h3 className="text-xl font-light mb-2 text-green-400">Order Successful</h3>
                                <p className="text-slate-400 text-sm">We will contact you shortly to confirm your delivery.</p>
                            </div>
                        ) : (
                        <form className="space-y-4" onSubmit={handleOrder}>
                            <div>
                                <input required name="name" type="text" placeholder="Full Name" className="w-full bg-transparent border-b border-white/10 px-0 py-3 text-white focus:border-[var(--luxe-primary)] outline-none transition-colors placeholder:text-slate-600" />
                            </div>
                            <div>
                                <input required name="phone" type="tel" placeholder="Phone Number" className="w-full bg-transparent border-b border-white/10 px-0 py-3 text-white focus:border-[var(--luxe-primary)] outline-none transition-colors placeholder:text-slate-600" />
                            </div>
                            <div>
                                <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full bg-transparent border-b border-white/10 px-0 py-3 text-slate-400 focus:border-[var(--luxe-primary)] outline-none transition-colors appearance-none">
                                    <option value="">Select Wilaya / Region</option>
                                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelFR}</option>)}
                                </select>
                                {selectedWilayaId && (
                                    <div className="mt-2 text-sm font-medium flex justify-between" style={{ color: 'var(--luxe-primary)' }}>
                                        <span>Delivery Fee:</span>
                                        <span>{deliveryFee} DA</span>
                                    </div>
                                )}
                            </div>
                            
                            <button disabled={isSubmitting} type="submit" className="w-full mt-6 py-4 uppercase tracking-widest text-sm font-bold text-[#0a0a0b] luxe-border glow-btn flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: 'var(--luxe-primary)' }}>
                                <i className="ph ph-lock-key"></i>
                                {isSubmitting ? "Processing..." : "Secure Checkout"}
                            </button>
                        </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
