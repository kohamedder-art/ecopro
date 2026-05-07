import React, { useState, useEffect } from 'react';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
import { 
  ShoppingBag, 
  ArrowRight, 
  MapPin, 
  CheckCircle2, 
  Instagram, 
  Menu,
  X,
  PhoneCall,
  MessageCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { TemplateProps } from '../types';

export default function MinimalistTemplate({ settings, products, canManage, storeSlug }: TemplateProps) {
  const accentColor = settings?.template_accent_color || settings?.primary_color || '#1c1917';
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeScroll, setActiveScroll] = useState(0);
  const { wilayas } = useStoreDeliveryPrices(storeSlug);

  // Section visibility toggles
  const showFeatures = settings?.min_show_features !== false;

  // Handle scroll tracking for background transitions
  useEffect(() => {
    const handleScroll = () => {
      const position = window.scrollY;
      setActiveScroll(position);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    const text = e.currentTarget.textContent || '';
    window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
  };

  const OrderModal = ({ product, onClose }: { product: any, onClose: () => void }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
    const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
    const deliveryFee = selectedWilaya?.homePrice ?? 0;

    const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const fd = new FormData(e.currentTarget);
        const name = fd.get('name') as string;
        const phone = fd.get('phone') as string;
        
        if (!name || !phone || !selectedWilayaId || !product) {
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
                    product_id: product.id,
                    quantity: 1,
                    total_price: product.price,
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

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden relative z-10 animate-in fade-in zoom-in duration-300">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif italic text-stone-800">Complete Order</h3>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex gap-4 mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <img src={product.images?.[0] || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-xl object-cover" alt="" />
              <div>
                <p className="font-bold text-stone-800">{product.title || product.name}</p>
                <p className="text-stone-500">{product.price} DA</p>
              </div>
            </div>

            {orderSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-stone-100 text-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-xl font-bold font-serif italic">Order Confirmed</h4>
                <p className="text-stone-500 text-sm">We will contact you shortly to arrange delivery.</p>
                <button onClick={onClose} className="mt-8 text-sm font-bold tracking-widest uppercase border-b border-stone-300 pb-1 hover:text-stone-500">Close</button>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="space-y-4">
                <input required name="name" type="text" placeholder="Full Name" className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-800 transition-all outline-none" />
                <input required name="phone" type="tel" placeholder="Phone Number" className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-800 transition-all outline-none" />
                <select required name="wilaya" value={selectedWilayaId ?? ''} onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)} className="w-full px-6 py-4 rounded-2xl bg-stone-50 border-none ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-800 transition-all outline-none appearance-none">
                  <option value="">Select Wilaya / Region</option>
                  {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelFR}</option>)}
                </select>
                {selectedWilayaId && (
                  <div className="p-3 bg-stone-50 rounded-2xl text-sm font-medium flex justify-between ring-1 ring-stone-200">
                    <span className="text-stone-500">Delivery Fee:</span>
                    <span className="font-bold text-stone-800">{deliveryFee} DA</span>
                  </div>
                )}
                <button disabled={isSubmitting} type="submit" className="w-full text-white py-5 rounded-2xl font-bold tracking-wide transition-all shadow-xl active:scale-95 disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                  {isSubmitting ? 'PROCESSING...' : 'CONFIRM PURCHASE'}
                </button>

                <p className="text-center text-[10px] text-stone-400 mt-6 uppercase tracking-widest flex items-center justify-center gap-2">
                  <CheckCircle2 size={10} /> Payment on Delivery
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // If products are passed from the system, use them, otherwise use fallback styling to indicate to the user what goes where.
  const displayProducts = products && products.length > 0 ? products : [];

  return (
    <div className="min-h-screen text-stone-900 font-sans selection:bg-stone-900 selection:text-white" style={{ backgroundColor: settings?.template_bg_color || '#F9F8F6' }} dir="rtl">
      
      {/* Elegant Floating Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-6 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-full border border-stone-200 shadow-sm flex items-center gap-8 pointer-events-auto">
          <button onClick={() => setIsMenuOpen(true)} className="hover:text-stone-500 transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            {settings?.store_logo ? (
              <img src={settings.store_logo} alt={settings?.store_name || "المتجر"} className="w-8 h-8 rounded-full object-cover border border-stone-200 shadow-sm" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-900 text-white font-bold text-sm">
                {(settings?.store_name || 'م').charAt(0)}
              </div>
            )}
            <h1 className="text-xl font-serif tracking-tighter italic">
                {settings?.store_name || "المتجر"}
            </h1>
          </div>
          <div className="relative">
            <ShoppingBag size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-stone-900 rounded-full"></span>
          </div>
        </div>
      </nav>

      {/* Hero / Intro */}
      <section className="h-screen flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
        <div className="z-10 max-w-sm">
          <span className="text-[10px] uppercase tracking-[0.4em] text-stone-400 block mb-6" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_collection')}>
              {settings?.min_hero_collection || "Collection 2024"}
          </span>
          <h2 className="text-5xl font-serif italic mb-6 leading-tight whitespace-pre-line" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_title')}>
              {settings?.min_hero_title || "Small Batches.\nGreat Intent."}
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-10" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_hero_subtitle')}>
            {settings?.min_hero_subtitle || "A curated selection of daily essentials designed to last a lifetime. Locally crafted, globally inspired."}
          </p>
          <div className="animate-bounce text-stone-300">
            <div className="w-[1px] h-12 bg-stone-300 mx-auto"></div>
          </div>
        </div>
        {/* Abstract Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[60%] bg-stone-100 rounded-[100%] blur-[120px] -z-0"></div>
      </section>

      {/* Main Narrative Scroller */}
      <main className="pb-32">
        {displayProducts.map((product, index) => (
          <section key={product.id || index} className="min-h-screen flex flex-col items-center justify-center px-6 py-20 sticky top-0 bg-[#F9F8F6]">
            <div className="w-full max-w-xl group relative">
              <div className="relative overflow-hidden rounded-[48px] aspect-[4/5] shadow-2xl transition-transform duration-700 group-hover:scale-[0.98]">
                <img 
                  src={product.images?.[0] || 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&q=80&w=800'} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  alt={product.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <div className="absolute bottom-10 left-10 text-white">
                    <p className="text-[10px] uppercase tracking-widest opacity-80 mb-2">Item 0{index + 1}</p>
                    <h3 className="text-3xl font-serif italic">{product.title}</h3>
                </div>
              </div>

              <div className="mt-8 flex justify-between items-end bg-[#F9F8F6] pb-4">
                <div className="max-w-[60%]">
                  <p className="text-lg text-stone-800 font-medium mb-1">{product.price} DA</p>
                  <p className="text-sm text-stone-500 leading-relaxed italic line-clamp-2">
                    {product.description || "The essence of modern design."}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedProduct(product)}
                  className="group flex items-center gap-3 text-white px-8 py-5 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-lg"
                  style={{ backgroundColor: accentColor }}
                >
                  <span className="text-xs font-bold uppercase tracking-widest">Order Now</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </section>
        ))}
        {displayProducts.length === 0 && (
            <div className="text-center py-32 text-stone-400 font-serif italic text-xl">
                Please add products from your dashboard to display them here.
            </div>
        )}
      </main>

      {/* Why Us Section */}
      {(showFeatures || canManage) && (
      <section className="bg-stone-900 text-stone-100 py-24 px-8 rounded-t-[60px] relative z-20 overflow-visible" data-edit-path="features-section">
        {canManage && (
            <div className="absolute -top-3 left-4 flex items-center gap-1 bg-violet-600 text-white text-xs px-2 py-1 rounded-full shadow-lg z-10">
                <button
                    onClick={() => window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key: 'min_show_features', value: !showFeatures }, '*')}
                    className="flex items-center gap-1 font-bold"
                >
                    {showFeatures ? <><Eye className="w-3 h-3"/> إخفاء</> : <><EyeOff className="w-3 h-3"/> إظهار</>}
                </button>
            </div>
        )}
        {showFeatures && (
        <>
        <div className="max-w-md mx-auto text-center space-y-16">
          <div className="space-y-4">
            <h4 className="text-3xl font-serif italic text-white" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_promise_title')}>
                {settings?.min_promise_title || "Our Promise"}
            </h4>
            <div className="w-12 h-[1px] bg-stone-700 mx-auto"></div>
          </div>
          
          <div className="grid gap-12 text-sm">
            <div className="space-y-2">
              <MapPin className="mx-auto text-stone-500 mb-4" size={24} />
              <p className="font-bold tracking-widest uppercase" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature1_title')}>{settings?.min_feature1_title || "Local Craft"}</p>
              <p className="text-stone-400" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature1_desc')}>{settings?.min_feature1_desc || "Supporting local artisans across the country."}</p>
            </div>
            <div className="space-y-2">
              <Clock className="mx-auto text-stone-500 mb-4" size={24} />
              <p className="font-bold tracking-widest uppercase" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature2_title')}>{settings?.min_feature2_title || "Fast Delivery"}</p>
              <p className="text-stone-400" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_feature2_desc')}>{settings?.min_feature2_desc || "Within 48 hours to major wilayas."}</p>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            <a href="#" className="flex items-center justify-center gap-2 text-stone-400 hover:text-white transition-colors">
              <Instagram size={18} />
              <span className="text-xs font-bold tracking-widest" contentEditable={canManage} suppressContentEditableWarning onBlur={handleTextEdit('min_instagram')}>
                  {settings?.min_instagram || "@store_dz"}
              </span>
            </a>
            <p className="text-[10px] text-stone-600 uppercase tracking-[0.3em]">Based in Algeria</p>
          </div>
        </div>
        </>
        )}
        {canManage && !showFeatures && (
            <div className="text-center py-4 text-stone-600 text-xs">✨ Features hidden</div>
        )}
      </section>
      )}

      {/* Floating Contact Trigger */}
      <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-3">
        <a href={`https://wa.me/${settings?.whatsapp_number || ''}`} className="w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
            <MessageCircle size={24} fill="currentColor" />
        </a>
        <a href={`tel:${settings?.phone_number || ''}`} className="w-14 h-14 bg-white text-stone-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform border border-stone-100">
            <PhoneCall size={24} />
        </a>
      </div>

      {selectedProduct && (
        <OrderModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}

      {/* Side Menu */}
      <div className={`fixed inset-0 z-[200] transition-all duration-500 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" onClick={() => setIsMenuOpen(false)}></div>
        <div className={`absolute top-0 left-0 bottom-0 w-72 bg-white p-12 transition-transform duration-500 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <button onClick={() => setIsMenuOpen(false)} className="mb-12 hover:rotate-90 transition-transform">
                <X size={24} />
            </button>
            <div className="flex flex-col gap-8 text-2xl font-serif italic">
                <a href="#" className="hover:text-stone-400">Catalog</a>
                <a href="#" className="hover:text-stone-400">Shipping</a>
                <a href="#" className="hover:text-stone-400">About Us</a>
            </div>
        </div>
      </div>
    </div>
  );
}
