import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

const stores = [
  { name: 'متجر أنيق', category: 'أزياء', gradient: 'from-pink-500/20 to-rose-500/20', emoji: '👗' },
  { name: 'تك شوب', category: 'إلكترونيات', gradient: 'from-blue-500/20 to-cyan-500/20', emoji: '📱' },
  { name: 'بيت الجمال', category: 'تجميل', gradient: 'from-purple-500/20 to-fuchsia-500/20', emoji: '💄' },
  { name: 'سوبر ماركت', category: 'غذائيات', gradient: 'from-green-500/20 to-emerald-500/20', emoji: '🛒' },
  { name: 'رياضة بلس', category: 'رياضة', gradient: 'from-orange-500/20 to-amber-500/20', emoji: '⚽' },
  { name: 'ديكور منزلي', category: 'ديكور', gradient: 'from-teal-500/20 to-cyan-500/20', emoji: '🏠' },
];

export function Chapter4() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative z-10" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          className="text-center mb-16 px-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-sm font-bold text-indigo-400/80 tracking-widest uppercase mb-4">
            {t('index.ch4Sub')}
          </p>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1]"
            style={{
              background: 'linear-gradient(135deg, #ffffff, #a5b4fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('index.ch4Title')}
          </h2>
        </motion.div>

        {/* Scrolling store cards */}
        <div className="relative">
          <div className="flex gap-5 overflow-x-auto px-6 pb-4 snap-x snap-mandatory hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {stores.map((store, i) => (
              <motion.div
                key={store.name}
                className="flex-shrink-0 w-72 snap-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`relative h-80 rounded-2xl border border-white/10 bg-gradient-to-br ${store.gradient} backdrop-blur-sm p-6 flex flex-col justify-between overflow-hidden group hover:border-white/20 transition-all`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-8 translate-x-8" />

                  <div>
                    <span className="text-4xl mb-4 block">{store.emoji}</span>
                    <h3 className="text-xl font-black text-white mb-1">{store.name}</h3>
                    <p className="text-sm text-white/40 font-bold">{store.category}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/30 font-bold">
                      {locale === 'ar' ? 'يعمل على' : 'Powered by'} Sahla
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40 group-hover:bg-white/20 group-hover:text-white transition-all">
                      →
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Gradient fade edges */}
          <div className="absolute top-0 left-0 bottom-0 w-20 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />
        </div>

        {/* Stats */}
        <motion.div
          className="flex justify-center gap-12 mt-16 px-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          {[
            { value: '+5,000', label: locale === 'ar' ? 'متجر نشط' : 'Active Stores' },
            { value: '1M+', label: locale === 'ar' ? 'طلبية ناجحة' : 'Orders Delivered' },
            { value: '58', label: locale === 'ar' ? 'ولاية' : 'Wilayas Covered' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</div>
              <div className="text-xs text-white/30 font-bold">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
