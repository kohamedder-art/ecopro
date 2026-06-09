import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function PricingCTA() {
  const { t } = useTranslation();
  const [trialDays, setTrialDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/public')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.trialDays) setTrialDays(data.trialDays); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-10 md:p-14 text-center relative overflow-hidden text-white shadow-xl shadow-indigo-500/20"
      >
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3 text-amber-300" />
            {loading ? t('index.ctaTrial', { n: 30 }) : t('index.ctaTrial', { n: trialDays })}
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight">{t('index.ctaTitle')}</h2>
          <p className="text-indigo-200 text-sm mb-8 max-w-md mx-auto leading-relaxed">{t('index.ctaDesc')}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 transition-all px-7 py-3.5 rounded-xl text-sm font-extrabold shadow-lg shadow-black/20 active:scale-[0.98]">
              {t('index.ctaCta')}
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all px-7 py-3.5 rounded-xl text-sm font-extrabold active:scale-[0.98]">
              عرض خطط الأسعار
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
