import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { trackFacebookEvent } from '@/lib/pixel';

export function FinalCTA() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const [trialDays, setTrialDays] = useState(30);

  useEffect(() => {
    fetch('/api/billing/public')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.trialDays) setTrialDays(data.trialDays); })
      .catch(() => {});
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center py-24 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            {t('index.ctaTrial', { n: trialDays })}
          </div>

          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1]"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 40%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('index.ctaTitle')}
          </h1>

          <p className="text-lg md:text-xl text-white/30 mb-12 max-w-lg mx-auto font-medium">
            {t('index.ctaDesc')}
          </p>

          <Link
            to="/signup"
            className="inline-flex items-center gap-3 h-14 px-10 rounded-2xl text-white text-base font-extrabold transition-all active:scale-[0.97] shadow-2xl shadow-indigo-500/30"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            onClick={() => trackFacebookEvent('Lead', { source: 'final_cta' })}
          >
            {t('index.ctaCta')}
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <p className="text-xs text-white/20 mt-6 font-bold">
            {locale === 'ar' ? 'بدون بطاقة بنكية · إلغاء في أي وقت' : 'No credit card · Cancel anytime'}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
