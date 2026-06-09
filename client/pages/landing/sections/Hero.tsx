import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Zap, Menu, X, ArrowLeft, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function Navbar() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <Zap className="text-white w-4 h-4" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Sahla<span className="text-indigo-500">4</span>Eco
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">{t('index.footerFeatures')}</a>
          <a href="#how" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">طريقة العمل</a>
          <a href="#pricing" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">الأسعار</a>
          <Link to="/login" className="text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">تسجيل الدخول</Link>
          <Link to="/signup" className="text-sm font-extrabold h-9 px-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            ابدأ مجاناً
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden"
        >
          <div className="px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setOpen(false)} className="block text-sm font-semibold text-slate-600 dark:text-slate-400">{t('index.footerFeatures')}</a>
            <a href="#how" onClick={() => setOpen(false)} className="block text-sm font-semibold text-slate-600 dark:text-slate-400">طريقة العمل</a>
            <a href="#pricing" onClick={() => setOpen(false)} className="block text-sm font-semibold text-slate-600 dark:text-slate-400">الأسعار</a>
            <div className="pt-2 flex gap-3">
              <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center text-sm font-bold h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">تسجيل الدخول</Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 text-center text-sm font-extrabold h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> ابدأ مجاناً
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

export function Hero() {
  const { t } = useTranslation();
  const [trialDays, setTrialDays] = useState(30);

  useEffect(() => {
    fetch('/api/billing/public')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.trialDays) setTrialDays(data.trialDays); })
      .catch(() => {});
  }, []);

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-indigo-200/40 via-indigo-100/20 to-transparent dark:from-indigo-800/20 dark:via-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-700/40 px-3.5 py-1.5 rounded-full mb-7 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">{t('index.badge')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-5 text-slate-900 dark:text-white">
            {t('index.heroLine1')}<br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">{t('index.heroHighlight')}</span>
          </h1>

          <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-9 leading-relaxed">
            {t('index.heroDesc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-extrabold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-lg shadow-slate-900/20 dark:shadow-indigo-600/25 active:scale-[0.97]">
              {t('index.ctaCreate')}
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <a href="#features" className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all active:scale-[0.97]">
              <PlayCircle className="w-4 h-4 text-indigo-500" />
              {t('index.ctaDemo')}
            </a>
          </div>

          <div className="flex items-center justify-center gap-5 mt-8 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t('index.ctaTrial', { n: trialDays })}</span>
            <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No credit card</span>
            <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto mt-14"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mr-auto">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                store.yourstore.com/dashboard
              </div>
            </div>
            <img
              src="/screenshots/home-admin-analytics.png"
              className="w-full"
              alt="لوحة التحكم"
              onError={(e) => { e.currentTarget.src = "/screenshots/main-dashboard.png"; }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
