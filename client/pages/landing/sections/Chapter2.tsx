import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Palette, Zap, Smartphone, CheckCircle, Layout } from 'lucide-react';

function StorePreviewMockup() {
  const { locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Glow effect behind mockup */}
      <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 rounded-[2rem] blur-3xl pointer-events-none" />

      {/* Editor Panel Wrapper */}
      <div className="relative bg-[#09090e]/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
        
        {/* Browser Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#07070b]">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white/5 rounded-md px-3 py-1 text-[9px] text-white/30 font-mono text-center">
              mystore.sahla4eco.com
            </div>
          </div>
        </div>

        {/* Mock Store content */}
        <div className="p-6 space-y-4 bg-gradient-to-b from-[#0e0e16]/40 to-[#08080c]/60">
          
          {/* Mock Store Nav */}
          <div className="flex items-center justify-between">
            <div className="text-white font-extrabold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>{isRTL ? "موضة ديزاد" : "Fashion DZ"}</span>
            </div>
            <div className="flex gap-3 text-white/30 text-[10px] font-bold">
              <span>{isRTL ? "الرئيسية" : "Home"}</span>
              <span>{isRTL ? "اتصل بنا" : "Contact"}</span>
            </div>
          </div>

          {/* Hero Banner Showcase */}
          <div className="relative h-44 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-900 border border-white/5 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)]" />
            <div className="text-center relative z-10 space-y-2">
              <div className="w-14 h-14 mx-auto rounded-xl bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-2xl">✨</span>
              </div>
              <div className="text-white font-black text-sm">{isRTL ? "مجموعة الصيف" : "Summer Collection"}</div>
              <div className="text-indigo-300 text-xs font-bold">{isRTL ? "خصومات تصل إلى 40%" : "Up to 40% Off"}</div>
            </div>
          </div>

          {/* Mini product cards */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2 flex flex-col justify-between h-20">
                <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs">
                  {['👟', '🕶️', '👜'][i - 1]}
                </div>
                <div className="h-2 w-10 bg-white/10 rounded" />
                <div className="h-1.5 w-6 bg-indigo-500/30 rounded" />
              </div>
            ))}
          </div>

          {/* Form Checkout simulator */}
          <div className="bg-[#07070b]/60 border border-white/5 rounded-xl p-3 space-y-2">
            <div className="h-5 rounded bg-white/5 border border-white/5" />
            <div className="h-8 rounded bg-indigo-600/80 flex items-center justify-center text-white text-[10px] font-black tracking-wide">
              {isRTL ? "تأكيد الطلب سريعا" : "Fast Order Confirmation"}
            </div>
          </div>
        </div>
      </div>

      {/* Floating editor options representing UI configuration nodes */}
      <motion.div
        className="absolute -top-6 -right-6 bg-slate-900/90 border border-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-2.5 shadow-xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-white/40 font-bold">{isRTL ? "نمط التصميم" : "Style Accent"}</div>
          <div className="text-[11px] text-white font-black">{isRTL ? "حديث وذهبي" : "Gold & Modern"}</div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -bottom-6 -left-6 bg-slate-900/90 border border-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-2.5 shadow-xl"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Layout className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-white/40 font-bold">{isRTL ? "تخطيط الصفحة" : "Page Layout"}</div>
          <div className="text-[11px] text-white font-black">{isRTL ? "مخصص للهاتف" : "Mobile First"}</div>
        </div>
      </motion.div>
    </div>
  );
}

export function Chapter2() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <section className="relative min-h-screen flex items-center py-24 overflow-hidden bg-[#030307]">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="grid md:grid-cols-2 gap-16 items-center">
          
          {/* Text/Content side */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 45 : -45 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <p className="text-sm font-bold text-indigo-400/80 tracking-widest uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>{t('index.ch2Sub') || "From idea to store in seconds."}</span>
            </p>
            
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1]"
              style={{
                backgroundImage: 'linear-gradient(135deg, #ffffff, #c4b5fd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('index.ch2Title') || "Turn it into a store"}
            </h2>
            
            <p className="text-base md:text-lg text-white/50 leading-relaxed max-w-lg font-medium">
              {t('index.ch2Desc') || "Pick a template, add your products, and your store is ready. No code, no complexity, no waiting."}
            </p>

            {/* Accent Checklist Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {[
                { label: isRTL ? "تصاميم ذهبية حديثة" : "Premium Themes", icon: <Palette className="w-4 h-4 text-indigo-400" /> },
                { label: isRTL ? "سريع الاستجابة" : "High Performance", icon: <Zap className="w-4 h-4 text-indigo-400" /> },
                { label: isRTL ? "متوافق مع الجوال" : "Mobile Optimized", icon: <Smartphone className="w-4 h-4 text-indigo-400" /> },
                { label: isRTL ? "نظام حماية مدمج" : "Secure Framework", icon: <CheckCircle className="w-4 h-4 text-indigo-400" /> }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-white/70 font-semibold text-sm hover:border-white/10 hover:bg-white/10 transition-all"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual Showcase Side */}
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -45 : 45 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <StorePreviewMockup />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
