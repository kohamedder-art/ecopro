import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Truck, CheckCircle2, ShoppingCart, Activity } from 'lucide-react';

const steps = [
  { key: 'ch3Step1', icon: <ShoppingCart className="w-5 h-5" />, color: '#6366f1' },
  { key: 'ch3Step2', icon: <Activity className="w-5 h-5" />, color: '#8b5cf6' },
  { key: 'ch3Step3', icon: <Truck className="w-5 h-5" />, color: '#a78bfa' },
  { key: 'ch3Step4', icon: <CheckCircle2 className="w-5 h-5" />, color: '#34d399' },
];

const cities = ['ch3City1', 'ch3City2', 'ch3City3', 'ch3City4', 'ch3City5'];

interface LiveFeedItem {
  id: number;
  wilaya: string;
  item: string;
  time: string;
  status: string;
  courier: string;
}

export function Chapter3() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';

  const [feedItems, setFeedItems] = useState<LiveFeedItem[]>([]);

  useEffect(() => {
    const initialFeed: LiveFeedItem[] = [
      { id: 1, wilaya: isRTL ? 'البليدة' : 'Blida', item: isRTL ? 'سماعات بلوتوث' : 'Wireless Earbuds', time: isRTL ? 'منذ دقيقة' : '1m ago', status: isRTL ? 'تم التسليم' : 'Delivered', courier: 'Yalidine' },
      { id: 2, wilaya: isRTL ? 'سطيف' : 'Sétif', item: isRTL ? 'شاحن سريع 65 واط' : '65W GaN Charger', time: isRTL ? 'منذ 3 دقائق' : '3m ago', status: isRTL ? 'قيد التوصيل' : 'In Transit', courier: 'ZR Express' },
      { id: 3, wilaya: isRTL ? 'تلمسان' : 'Tlemcen', item: isRTL ? 'عطر العود الفاخر' : 'Premium Oud Perfume', time: isRTL ? 'منذ 5 دقائق' : '5m ago', status: isRTL ? 'تأكيد الطلب' : 'Confirmed', courier: 'Noest' }
    ];
    setFeedItems(initialFeed);

    const wilayas = isRTL 
      ? ['الجزائر العاصمة', 'وهران', 'قسنطينة', 'بجاية', 'عنابة', 'شلف', 'تيزي وزو', 'بسكرة', 'باتنة']
      : ['Algiers', 'Oran', 'Constantine', 'Bejaia', 'Annaba', 'Chlef', 'Tizi Ouzou', 'Biskra', 'Batna'];

    const items = isRTL
      ? ['ساعة ذكية برو', 'ماكينة حلاقة شعر', 'حقيبة ظهر رياضية', 'نظارات شمسية', 'مصحح القامة']
      : ['Smart Watch Pro', 'Hair Clipper Kit', 'Sport Backpack', 'Sunglasses', 'Posture Corrector'];

    const statusOptions = isRTL
      ? ['طلب جديد', 'تم التأكيد', 'قيد التوصيل', 'تم التسليم']
      : ['New Order', 'Confirmed', 'In Transit', 'Delivered'];

    const couriers = ['Yalidine', 'ZR Express', 'Noest', 'Maystro', 'Procolis'];

    const interval = setInterval(() => {
      const newItem: LiveFeedItem = {
        id: Date.now(),
        wilaya: wilayas[Math.floor(Math.random() * wilayas.length)],
        item: items[Math.floor(Math.random() * items.length)],
        time: isRTL ? 'الآن' : 'Just now',
        status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
        courier: couriers[Math.floor(Math.random() * couriers.length)]
      };

      setFeedItems(prev => [newItem, ...prev.slice(0, 3)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isRTL]);

  return (
    <section className="relative min-h-screen flex items-center py-24 overflow-hidden bg-[#030307]">
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[150px] pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-sm font-bold text-indigo-400/80 tracking-widest uppercase mb-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t('index.ch3Sub') || "Every order confirmed — every wilaya delivered."}</span>
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
            {t('index.ch3Title') || "Orders flowing in"}
          </h2>
        </motion.div>

        {/* Pipeline & simulated ticker grid */}
        <div className="grid lg:grid-cols-12 gap-10 items-stretch max-w-6xl mx-auto mb-16">
          <div className="lg:col-span-7 bg-[#09090e]/60 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col justify-between backdrop-blur-xl">
            <div className="space-y-4">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>📦 {isRTL ? "مخطط التوصيل السريع" : "Automated Delivery Funnel"}</span>
              </h3>
              <p className="text-sm text-white/50 leading-relaxed font-medium">
                {isRTL 
                  ? "يتتبع نظامنا طلبات الدفع عند الاستلام بـ 7 خطوات ذكية لحمايتك من الطلبات الوهمية وتسهيل الفوترة."
                  : "Track orders dynamically from checkout to cash validation with built-in risk analysis."}
              </p>
            </div>

            <div className="relative mt-12 mb-6">
              <div className="hidden md:block absolute top-10 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 relative z-10">
                {steps.map((step, i) => (
                  <div key={step.key} className="flex flex-col items-center text-center group">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3 border border-white/10 transition-all group-hover:scale-105"
                      style={{ backgroundColor: step.color + '15' }}
                    >
                      <span style={{ color: step.color }}>{step.icon}</span>
                    </div>

                    <p className="text-xs font-bold text-white/80">{t(step.key)}</p>

                    {i < steps.length - 1 && (
                      <motion.div
                        className="hidden md:block absolute top-10 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: step.color, left: `${(i + 1) * 25 - 2}%` }}
                        animate={{
                          x: [0, 45],
                          opacity: [1, 0],
                        }}
                        transition={{
                          duration: 2,
                          delay: i * 0.5 + 0.5,
                          repeat: Infinity,
                          repeatDelay: 2.5,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#09090e]/60 border border-white/10 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between">
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>⚡ {isRTL ? "مراقبة الشحنات الحية" : "Live Shipment Monitor"}</span>
                </h3>
                <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isRTL ? "متصل" : "Live"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 min-h-[220px]">
              <AnimatePresence initial={false}>
                {feedItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                        {item.wilaya.charAt(0)}
                      </div>
                      <div>
                        <div className="font-extrabold text-white">{item.item}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {isRTL ? `ولاية ${item.wilaya}` : `${item.wilaya} Wilaya`} • {item.time}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        item.status.includes('تسليم') || item.status.includes('Delivered')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {item.status}
                      </span>
                      <div className="text-[9px] text-white/30 mt-1 font-mono">{item.courier}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* City tags */}
        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          {cities.map((city, i) => (
            <motion.span
              key={city}
              className="px-4 py-2 rounded-full text-xs font-bold border border-white/10 text-white/40 bg-white/5 transition-all"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileHover={{ borderColor: '#6366f1', color: '#a5b4fc', backgroundColor: '#6366f110' }}
            >
              📍 {t(city)}
            </motion.span>
          ))}
          <span className="px-4 py-2 rounded-full text-xs font-bold border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            +53 {locale === 'ar' ? 'ولاية أخرى' : 'more wilayas'}
          </span>
        </motion.div>

        <motion.p
          className="text-center text-white/30 text-sm mt-10 max-w-lg mx-auto font-medium"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          {t('index.ch3Desc') || "From heart to doorstep. 58 wilayas, 13+ delivery companies, live tracking."}
        </motion.p>
      </div>
    </section>
  );
}
