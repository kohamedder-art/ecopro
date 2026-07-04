import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function Navbar() {
  const { t, locale, setLocale } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-white font-black text-sm">S</span>
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">
            Sahla<span className="text-indigo-400">4</span>Eco
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>
          <Link to="/login" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
            {locale === 'ar' ? 'دخول' : 'Login'}
          </Link>
          <Link
            to="/signup"
            className="text-sm font-extrabold h-10 px-6 rounded-xl text-white transition-all active:scale-[0.97] flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {locale === 'ar' ? 'ابدأ مجاناً' : 'Start Free'}
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-white/60 hover:text-white transition-colors">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/5 overflow-hidden"
        >
          <div className="px-6 py-4 space-y-3">
            <button
              onClick={() => { setLocale(locale === 'ar' ? 'en' : 'ar'); setOpen(false); }}
              className="block text-sm font-bold text-white/50"
            >
              {locale === 'ar' ? 'English' : 'عربي'}
            </button>
            <Link to="/login" onClick={() => setOpen(false)} className="block text-sm font-bold text-white/60">
              {locale === 'ar' ? 'دخول' : 'Login'}
            </Link>
            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-extrabold h-10 rounded-xl text-white flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {locale === 'ar' ? 'ابدأ مجاناً' : 'Start Free'}
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
