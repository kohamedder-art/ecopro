import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Palette, Zap, Smartphone, CheckCircle, Layout } from 'lucide-react';

function StorePreviewMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Glow effect behind mockup */}
      <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 rounded-[2rem] blur-3xl pointer-events-none" />

      {/* Browser Chrome */}
      <div className="relative bg-white dark:bg-[#09090e]/95 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#07070b]">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-gray-200 dark:bg-white/5 rounded-md px-3 py-1 text-[9px] text-gray-400 dark:text-white/30 font-mono text-center">
              mystore.sahla4eco.com
            </div>
          </div>
        </div>

        {/* Real Store Screenshot */}
        <div className="relative">
          <img
            src="/store-showcase.png"
            alt="Store preview"
            className="w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Floating accent cards */}
      <motion.div
        className="absolute -top-6 -right-6 bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-2.5 shadow-xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-gray-400 dark:text-white/40 font-bold">COD Ready</div>
          <div className="text-[11px] text-gray-900 dark:text-white font-black">Order Form Built-in</div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -bottom-6 -left-6 bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-2.5 shadow-xl"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <Layout className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-gray-400 dark:text-white/40 font-bold">58 Wilayas</div>
          <div className="text-[11px] text-gray-900 dark:text-white font-black">Nationwide Delivery</div>
        </div>
      </motion.div>
    </div>
  );
}

export function Chapter2() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <section className="relative min-h-screen flex items-center py-24 overflow-hidden bg-gray-50 dark:bg-[#030307]">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent" />
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
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400/80 tracking-widest uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>{t('index.ch2Sub') || "From idea to store in seconds."}</span>
            </p>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] text-gray-900 dark:text-white">
              {t('index.ch2Title') || "Turn it into a store"}
            </h2>
            
            <p className="text-base md:text-lg text-gray-600 dark:text-white/50 leading-relaxed max-w-lg font-medium">
              {t('index.ch2Desc') || "Pick a template, add your products, and your store is ready. No code, no complexity, no waiting."}
            </p>

            {/* Accent Checklist Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {[
                { label: isRTL ? "تصاميم ذهبية حديثة" : "Premium Themes", icon: <Palette className="w-4 h-4 text-indigo-500" /> },
                { label: isRTL ? "سريع الاستجابة" : "High Performance", icon: <Zap className="w-4 h-4 text-indigo-500" /> },
                { label: isRTL ? "متوافق مع الجوال" : "Mobile Optimized", icon: <Smartphone className="w-4 h-4 text-indigo-500" /> },
                { label: isRTL ? "نظام حماية مدمج" : "Secure Framework", icon: <CheckCircle className="w-4 h-4 text-indigo-500" /> }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-white/70 font-semibold text-sm hover:border-gray-300 dark:hover:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all shadow-sm dark:shadow-none"
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
