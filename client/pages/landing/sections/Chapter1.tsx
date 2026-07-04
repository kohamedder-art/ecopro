import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';
import { Sparkles, Play, ArrowRight, Laptop, Smartphone, Check, ShoppingBag, Eye } from 'lucide-react';

function Particles() {
  const dots = Array.from({ length: 45 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 5,
    duration: Math.random() * 8 + 6,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full bg-indigo-500/20"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function Chapter1() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  // Interactive Mockup States
  const [selectedTemplate, setSelectedTemplate] = useState<'books' | 'shiro' | 'kids'>('books');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [simulatedOrder, setSimulatedOrder] = useState<string | null>(null);

  // Colors available for customization in simulator
  const colorOptions = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' }
  ];

  // Simulating incoming COD orders
  useEffect(() => {
    const orders = [
      isRTL ? "طلب جديد: عطر ديفين (5,400 دج) - الجزائر" : "New Order: Divine Perfume (5,400 DZD) - Algiers",
      isRTL ? "طلب جديد: حذاء رياضي (6,200 دج) - وهران" : "New Order: Sports Sneakers (6,200 DZD) - Oran",
      isRTL ? "طلب جديد: كتاب التغيير (1,800 دج) - قسنطينة" : "New Order: Change Book (1,800 DZD) - Constantine"
    ];

    let count = 0;
    const interval = setInterval(() => {
      setSimulatedOrder(orders[count % orders.length]);
      count++;
      
      // Auto-hide alert after 4 seconds
      setTimeout(() => {
        setSimulatedOrder(null);
      }, 4000);

    }, 8500);

    return () => clearInterval(interval);
  }, [isRTL]);

  const templateConfigs = {
    books: {
      title: isRTL ? "مكتبة القارئ" : "The Reader Bookstore",
      desc: isRTL ? "أفضل الكتب والروايات بين يديك مع توصيل سريع." : "Premium books and novels at your doorstep with fast shipping.",
      emoji: "📚",
      price: "1,900 DZD",
      btnText: isRTL ? "اطلب كتابك الآن" : "Order Book Now",
      bgClass: "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950/20"
    },
    shiro: {
      title: isRTL ? "مستحضرات شيرو" : "Shiro Cosmetics",
      desc: isRTL ? "جمال طبيعي بلمسة ذهبية فاخرة ومنتجات أصلية." : "Natural beauty with a luxurious golden touch and authentic products.",
      emoji: "✨💄",
      price: "4,500 DZD",
      btnText: isRTL ? "اشتري الآن" : "Shop Premium",
      bgClass: "bg-gradient-to-br from-[#0c0c0e] via-[#16161a] to-amber-950/20"
    },
    kids: {
      title: isRTL ? "عالم الصغار" : "Kids Planet",
      desc: isRTL ? "ألعاب تفاعلية وملابس مريحة مصممة بعناية لطفلك." : "Interactive toys and cozy apparel curated for your little ones.",
      emoji: "🧸🦖",
      price: "3,200 DZD",
      btnText: isRTL ? "تسوق لأطفالك" : "Shop Kids Collection",
      bgClass: "bg-gradient-to-br from-slate-900 via-sky-950/10 to-rose-950/10"
    }
  };

  const currentTpl = templateConfigs[selectedTemplate];

  const handleScrollToDemo = () => {
    const el = document.getElementById('demo-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen pt-28 pb-20 flex flex-col items-center justify-center overflow-hidden bg-[#030307]">
      <Particles />

      {/* Decorative Blur Spheres */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[35rem] h-[35rem] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-10 right-10 w-[20rem] h-[20rem] bg-rose-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col items-center">
        {/* Floating Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs md:text-sm font-semibold text-indigo-300 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>{t('index.badge') || "Algeria's Leading COD E-commerce Platform"}</span>
        </motion.div>

        {/* Hero Copy */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white mb-6"
          >
            <span>{t('index.heroLine1') || "Build Your Own Store"}</span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #6366f1 70%, #4f46e5 100%)',
              }}
            >
              {t('index.heroHighlight') || "With One Magic Touch."}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10 font-medium"
          >
            {t('index.heroDesc') || "Don't just sell — wow your customers with a world-class shopping experience. Instant, lightning-fast, built specifically for the Algerian market."}
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              to="/signup"
              className="group relative inline-flex items-center gap-2 text-base font-extrabold h-14 px-8 rounded-2xl text-white overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:shadow-[0_0_35px_rgba(99,102,241,0.4)] transition-all active:scale-[0.98] w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <span>{t('index.ctaCreate') || "Create Your Store Now"}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <button
              onClick={handleScrollToDemo}
              className="inline-flex items-center gap-2 text-base font-bold h-14 px-8 rounded-2xl border border-white/10 hover:border-white/20 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98] w-full sm:w-auto"
            >
              <Play className="w-4 h-4 fill-white/80" />
              <span>{t('index.ctaDemo') || "Watch Quick Demo"}</span>
            </button>
          </motion.div>
        </div>

        {/* Live Order Simulation Alert Banner */}
        <AnimatePresence>
          {simulatedOrder && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0e0e16]/95 border border-emerald-500/30 text-emerald-400 font-bold text-xs md:text-sm shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>{simulatedOrder}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Storefront Editor Mockup */}
        <motion.div
          id="demo-section"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative w-full max-w-5xl mx-auto mt-6"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-[2.5rem] blur-3xl opacity-70 pointer-events-none" />

          {/* Desktop/Tablet Simulated Browser Shell */}
          <div className="relative bg-[#09090e]/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl">
            
            {/* Window Chrome Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#07070b]/90">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500/60" />
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500/60" />
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/60" />
              </div>

              {/* URL Address Bar */}
              <div className="flex-1 mx-6 max-w-lg hidden sm:block">
                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-1.5 text-xs text-white/40 font-mono text-center flex items-center justify-center gap-2">
                  <span className="text-emerald-400">🔒</span>
                  <span>{isRTL ? "محرر_المتجر.sahla4eco.com" : "editor.sahla4eco.com"}</span>
                </div>
              </div>

              {/* View Mode Toggle Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMobileView(false)}
                  className={`p-2 rounded-lg transition-colors ${!isMobileView ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                >
                  <Laptop className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMobileView(true)}
                  className={`p-2 rounded-lg transition-colors ${isMobileView ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Editor Simulation Layout */}
            <div className="grid md:grid-cols-12 min-h-[500px]">
              
              {/* Left Control Panel (Options) - Takes 4 cols */}
              <div className="md:col-span-4 p-6 border-r border-white/5 bg-[#06060a]/90 space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-indigo-400" />
                      <span>{isRTL ? "تخصيص القالب" : "Customize Template"}</span>
                    </h3>
                    
                    {/* Template Selection Toggles */}
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'books', name: isRTL ? "📚 قالب الكتب الكلاسيكي" : "📚 Classic Books", desc: 'Clean, elegant, text focus' },
                        { id: 'shiro', name: isRTL ? "✨ قالب شيرو العصري" : "✨ Shiro Modern", desc: 'Dark theme, premium products' },
                        { id: 'kids', name: isRTL ? "🧸 عالم الأطفال الملون" : "🧸 Kids Planet", desc: 'Vibrant colors, playful font' }
                      ].map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => setSelectedTemplate(tpl.id as any)}
                          className={`text-left w-full p-3 rounded-xl border transition-all ${
                            selectedTemplate === tpl.id
                              ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                              : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="font-extrabold text-sm flex items-center justify-between">
                            <span>{tpl.name}</span>
                            {selectedTemplate === tpl.id && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <p className="text-[10px] text-white/30 font-medium mt-0.5">{tpl.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brand Color Customizer Simulator */}
                  <div>
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🎨 {isRTL ? "اللون الأساسي" : "Brand Accent Color"}</span>
                    </h3>
                    <div className="flex gap-2.5">
                      {colorOptions.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setSelectedColor(c.value)}
                          className="relative w-8 h-8 rounded-full border border-white/10 transition-transform active:scale-95 animate-none"
                          style={{ backgroundColor: c.value }}
                        >
                          {selectedColor === c.value && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Helpful Mini Guide Info */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isRTL ? "محرر مباشر تفاعلي" : "Live Store Previewer"}</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-1 font-medium leading-relaxed">
                    {isRTL 
                      ? "جرب الضغط على القوالب أو الألوان لمشاهدة التحديث الحي للمتجر فوراً." 
                      : "Try clicking templates or colors above to see how the storefront renders in real-time."}
                  </p>
                </div>
              </div>

              {/* Right Storefront Preview Panel - Takes 8 cols */}
              <div className="md:col-span-8 bg-[#09090d] flex items-center justify-center p-6 min-h-[350px]">
                
                {/* Simulated Store Container */}
                <div
                  className={`border border-white/10 bg-[#0d0d12] shadow-2xl rounded-2xl overflow-hidden transition-all ${
                    isMobileView 
                      ? 'w-[280px] h-[450px] overflow-y-auto border-4 border-slate-700/60 rounded-[2rem]' 
                      : 'w-full max-w-xl'
                  }`}
                >
                  
                  {/* Store Header Preview */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[#08080b]/90 border-b border-white/5">
                    <span className="font-black text-white text-xs">{currentTpl.title}</span>
                    <div className="flex gap-2 text-white/40 text-[10px] font-bold">
                      <span>{isRTL ? "الرئيسية" : "Home"}</span>
                      <span>{isRTL ? "المنتجات" : "Products"}</span>
                    </div>
                  </div>

                  {/* Template Content Render */}
                  <div className={`p-5 space-y-4 ${currentTpl.bgClass} min-h-[250px] flex flex-col justify-between`}>
                    
                    {/* Hero Layout */}
                    <div className="space-y-2">
                      <div className="inline-block px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-white/50">
                        ⚡ {isRTL ? "توصيل متوفر لـ 58 ولاية" : "Shipping to 58 Wilayas"}
                      </div>
                      <h4 className="text-base md:text-lg font-black text-white leading-tight">
                        {currentTpl.title}
                      </h4>
                      <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                        {currentTpl.desc}
                      </p>
                    </div>

                    {/* Featured Item Preview */}
                    <div className="bg-[#0b0b0e]/80 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-xl">
                          {currentTpl.emoji}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-white">{isRTL ? "المنتج الحصري" : "Featured Item"}</div>
                          <div className="text-[10px] text-white/40 font-medium mt-0.5">{isRTL ? "متوفر حالياً" : "In Stock"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-black" style={{ color: selectedColor }}>
                          {currentTpl.price}
                        </div>
                        <div className="text-[9px] text-white/30 line-through mt-0.5">
                          {selectedTemplate === 'shiro' ? '6,500 DZD' : '2,900 DZD'}
                        </div>
                      </div>
                    </div>

                    {/* Simulated COD Checkout Form */}
                    <div className="space-y-2 bg-[#09090c]/90 border border-white/5 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-white/40 mb-1">
                        📋 {isRTL ? "طلب سريع (الدفع عند الاستلام)" : "Quick COD Order Form"}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-6 rounded bg-white/5 border border-white/5 flex items-center px-2 text-[9px] text-white/30">
                          {isRTL ? "الاسم الكامل" : "Full Name"}
                        </div>
                        <div className="h-6 rounded bg-white/5 border border-white/5 flex items-center px-2 text-[9px] text-white/30">
                          {isRTL ? "رقم الهاتف" : "Phone Number"}
                        </div>
                      </div>
                      <div className="h-6 rounded bg-white/5 border border-white/5 flex items-center px-2 text-[9px] text-white/30">
                        {isRTL ? "العنوان بالكامل" : "Delivery Address"}
                      </div>
                    </div>

                    {/* Interactive Button Accent styling */}
                    <button
                      className="w-full py-2.5 rounded-xl text-center text-white text-xs font-bold transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: selectedColor }}
                    >
                      <span>{currentTpl.btnText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                  </div>
                </div>

              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
