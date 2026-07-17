import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowRight, Zap, Package, CreditCard, Truck } from 'lucide-react';
import { trackFacebookEvent } from '@/lib/pixel';

export function Chapter1() {
  const { t, locale } = useTranslation();
  const { theme, toggle } = useTheme();
  const isRTL = locale === 'ar';
  const isDark = theme === 'dark';

  const [simulatedOrder, setSimulatedOrder] = useState<string | null>(null);

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
      setTimeout(() => setSimulatedOrder(null), 4000);
    }, 8500);

    return () => clearInterval(interval);
  }, [isRTL]);

  const stats = [
    { icon: Package, value: '5,000+', label: isRTL ? 'متجر نشط' : 'Active Stores' },
    { icon: CreditCard, value: '1M+', label: isRTL ? 'طلب تم' : 'Orders Processed' },
    { icon: Truck, value: '58', label: isRTL ? 'ولاية' : 'Wilayas Covered' },
  ];

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/hero.png"
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay — dark in dark mode, light in light mode */}
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            background: isDark
              ? 'linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.6), rgba(0,0,0,0.3))'
              : 'linear-gradient(to right, rgba(255,255,255,0.70), rgba(255,255,255,0.45), rgba(255,255,255,0.15))'
          }}
        />
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            background: isDark
              ? 'linear-gradient(to top, rgba(0,0,0,0.7), transparent, rgba(0,0,0,0.3))'
              : 'linear-gradient(to top, rgba(255,255,255,0.50), transparent, rgba(255,255,255,0.10))'
          }}
        />
      </div>

      {/* Decorative blur accents */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[25rem] h-[25rem] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[20rem] h-[20rem] bg-purple-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20 pb-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 dark:bg-white/10 border border-white/10 dark:border-white/10 backdrop-blur-md text-xs md:text-sm font-semibold text-gray-900 dark:text-white/90 mb-8"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{isRTL ? "منصة التجارة الإلكترونية الأولى في الجزائر" : "Algeria's #1 COD E-commerce Platform"}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] text-gray-900 dark:text-white mb-6"
          >
            <span>{isRTL ? "أنشئ متجرك. أدر كل شيء." : "Build Your Store."}</span>
            <br />
            <span>{isRTL ? "وصّل لكل ولاية." : "Manage Everything."}</span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #818cf8 40%, #a5b4fc 70%)',
              }}
            >
              {isRTL ? "توصيل سريع لكل ولاية." : "Ship Everywhere."}
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-gray-600 dark:text-white/60 max-w-xl leading-relaxed mb-10 font-medium"
          >
            {isRTL
              ? "منصة شاملة لإدارة متجرك: تصميم المتجر، إدارة الطلبات، التوصيل، والمدفوعات — كل شيء في مكان واحد."
              : "Algeria's all-in-one COD e-commerce platform. Design your store, manage orders, handle delivery & payments — all in one place."}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 mb-16"
          >
            <Link
              to="/signup"
              className="group relative inline-flex items-center justify-center gap-2 text-base font-extrabold h-14 px-8 rounded-2xl text-white overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all active:scale-[0.98] w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              onClick={() => trackFacebookEvent('Lead', { source: 'hero_start_free' })}
            >
              <span>{isRTL ? "ابدأ مجاناً" : "Start Free"}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 text-base font-bold h-14 px-8 rounded-2xl border border-gray-300 dark:border-white/15 text-gray-700 dark:text-white/80 bg-white/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 backdrop-blur-sm transition-all active:scale-[0.98] w-full sm:w-auto"
              onClick={() => trackFacebookEvent('Lead', { source: 'hero_view_pricing' })}
            >
              <span>{isRTL ? "استعرض الأسعار" : "View Pricing"}</span>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap gap-8"
          >
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/80 dark:bg-white/10 border border-gray-200 dark:border-white/10 backdrop-blur-md flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-white/50 font-medium">{stat.label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Live Order Alert */}
      <AnimatePresence>
        {simulatedOrder && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/80 dark:bg-black/80 bg-white/90 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs md:text-sm shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{simulatedOrder}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
