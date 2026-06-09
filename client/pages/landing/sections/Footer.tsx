import { Zap, Facebook, Instagram, Twitter } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="py-12 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="border-b md:border-b-0 border-slate-100 dark:border-slate-800 pb-8 md:pb-0">
          <a href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Zap className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sahla<span className="text-indigo-500">4</span>Eco
            </span>
          </a>
          <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xs">{t('index.footerTagline')}</p>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerProduct')}</h5>
          <ul className="space-y-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <li><a href="#features" className="hover:text-indigo-600 transition-colors">{t('index.footerFeatures')}</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerTemplates')}</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerUpdates')}</a></li>
          </ul>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerCompany')}</h5>
          <ul className="space-y-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerAbout')}</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerBlog')}</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerContact')}</a></li>
          </ul>
        </div>

        <div>
          <h5 className="font-extrabold mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerFollow')}</h5>
          <div className="flex gap-3">
            <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-600 hover:text-white transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-600 hover:text-white transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-indigo-600 hover:text-white transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-100 dark:border-slate-800 text-center text-slate-400 text-[11px] font-bold">
        {t('index.footerCopyright')}
      </div>
    </footer>
  );
}
