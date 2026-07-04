import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function Footer() {
  const { t, locale } = useTranslation();

  return (
    <footer className="py-16 px-6 border-t border-white/5 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="border-b md:border-b-0 border-white/5 pb-8 md:pb-0">
          <a href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <span className="text-white font-black text-sm">S</span>
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Sahla<span className="text-indigo-400">4</span>Eco
            </span>
          </a>
          <p className="text-white/30 text-xs leading-relaxed max-w-xs font-medium">{t('index.footerTagline')}</p>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-white/50 uppercase tracking-widest text-[11px]">{t('index.footerProduct')}</h5>
          <ul className="space-y-3 text-xs text-white/25 font-bold">
            <li><a href="#features" className="hover:text-indigo-400 transition-colors">{t('index.footerFeatures')}</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">{t('index.footerTemplates')}</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">{t('index.footerUpdates')}</a></li>
          </ul>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-white/50 uppercase tracking-widest text-[11px]">{t('index.footerCompany')}</h5>
          <ul className="space-y-3 text-xs text-white/25 font-bold">
            <li><a href="#" className="hover:text-indigo-400 transition-colors">{t('index.footerAbout')}</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">{t('index.footerBlog')}</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">{t('index.footerContact')}</a></li>
          </ul>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-white/50 uppercase tracking-widest text-[11px]">{t('index.footerFollow')}</h5>
          <div className="flex gap-3">
            <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/25 hover:bg-indigo-600 hover:text-white transition-all border border-white/5">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/25 hover:bg-indigo-600 hover:text-white transition-all border border-white/5">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/25 hover:bg-indigo-600 hover:text-white transition-all border border-white/5">
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/5 text-center text-white/15 text-[11px] font-bold">
        {t('index.footerCopyright')}
      </div>
    </footer>
  );
}
