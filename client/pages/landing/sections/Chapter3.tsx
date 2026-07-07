import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/contexts/ThemeContext';
import { Truck, Package } from 'lucide-react';

export function Chapter3() {
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = locale === 'ar';

  return (
    <section className={`relative min-h-screen flex items-center py-24 overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#030307]' : 'bg-gray-50'
    }`}>
      {isDark && (
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[150px] pointer-events-none" />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-sm font-bold text-indigo-500 tracking-widest uppercase mb-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t('index.ch3Sub') || 'Every order confirmed — every wilaya delivered.'}</span>
          </p>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {t('index.ch3Title') || 'Orders flowing in'}
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 max-w-6xl mx-auto mb-10">
          <motion.div
            className="lg:col-span-7 relative rounded-2xl overflow-hidden border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
          >
            <img
              src="/Test Orders.png"
              alt="Orders dashboard"
              className="w-full block"
              loading="lazy"
            />
            <div
              className="absolute bottom-0 left-0 right-0 p-6 md:p-8"
              style={{
                background: isDark
                  ? 'linear-gradient(to top, rgba(3,3,7,0.92) 20%, transparent)'
                  : 'linear-gradient(to top, rgba(255,255,255,0.92) 20%, transparent)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Package className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <span className={`text-xs font-bold tracking-wider uppercase ${
                  isDark ? 'text-indigo-300' : 'text-indigo-600'
                }`}>
                  {isRTL ? 'مخطط التوصيل السريع' : 'Delivery Funnel'}
                </span>
              </div>
              <h3 className={`text-xl md:text-2xl font-black mb-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {isRTL ? 'أتمتة الطلبات من الفاتورة إلى التوصيل' : 'Order Management Simplified'}
              </h3>
              <p className={`text-sm max-w-md ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                {isRTL
                  ? 'يتتبع نظامنا طلبات الدفع عند الاستلام بـ 7 خطوات ذكية.'
                  : 'Track orders dynamically from checkout to cash validation.'}
              </p>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-5 relative rounded-2xl overflow-hidden border"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
          >
            <img
              src="/Test Shipment.png"
              alt="Shipment tracking"
              className="w-full block"
              loading="lazy"
            />
            <div
              className="absolute bottom-0 left-0 right-0 p-6 md:p-8"
              style={{
                background: isDark
                  ? 'linear-gradient(to top, rgba(3,3,7,0.92) 20%, transparent)'
                  : 'linear-gradient(to top, rgba(255,255,255,0.92) 20%, transparent)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Truck className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span className={`text-xs font-bold tracking-wider uppercase ${
                  isDark ? 'text-emerald-300' : 'text-emerald-600'
                }`}>
                  {isRTL ? 'تتبع الشحنات' : 'Live Tracking'}
                </span>
              </div>
              <h3 className={`text-xl md:text-2xl font-black mb-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {isRTL ? 'مراقبة الشحنات في الوقت الحقيقي' : 'Real-time Shipment View'}
              </h3>
              <p className={`text-sm max-w-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                {isRTL
                  ? 'كل شحنة تحت المجهر — من الاستلام إلى التوصيل.'
                  : 'Every package tracked end-to-end across 58 wilayas.'}
              </p>
            </div>
          </motion.div>
        </div>


      </div>
    </section>
  );
}
