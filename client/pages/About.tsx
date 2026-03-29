import { Users, Heart, Target, Sparkles, Shield, Globe, Zap, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function About() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden relative font-['Noto_Sans_Arabic']">
      <div className="fixed top-0 left-0 w-full h-full z-0 bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.08)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.05)_0%,transparent_35%),#f8fafc] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.15)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.10)_0%,transparent_35%),#020617]"></div>
      
      <div className="relative pt-32 pb-16 px-6 overflow-hidden z-10 w-full">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[50vw] h-[40vh] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] blur-[80px] z-0 opacity-80 pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 space-x-reverse bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t('about.badge')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900 dark:text-white leading-tight">
              {t('about.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">{t('about.titleHighlight')}</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold max-w-2xl mx-auto leading-relaxed">
              {t('about.desc')}
            </p>
          </div>

          {/* Story Bento Box */}
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-3xl p-8 md:p-10 mb-12 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="text-white w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('about.storyTitle')}</h2>
            </div>
            <div className="space-y-4 text-slate-700 dark:text-slate-300 font-medium leading-loose text-lg">
              <p>
                {t('about.storyP1')}
              </p>
              <p>
                {t('about.storyP2')}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <Shield className="w-6 h-6 text-indigo-500 flex-shrink-0" />
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{t('about.storyBadge')}</p>
            </div>
          </div>

          {/* Values Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { icon: Target, titleKey: 'about.v1Title', descKey: 'about.v1Desc' },
              { icon: Users, titleKey: 'about.v2Title', descKey: 'about.v2Desc' },
              { icon: Globe, titleKey: 'about.v3Title', descKey: 'about.v3Desc' },
            ].map((item, i) => (
              <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-300">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 text-slate-700 dark:text-slate-300">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{t(item.titleKey as string)}</h3>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">{t(item.descKey as string)}</p>
              </div>
            ))}
          </div>

          {/* Team CTA */}
          <div className="text-center rounded-3xl p-10 bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black mb-4">{t('about.ctaTitle')}</h2>
              <p className="text-indigo-100 font-medium max-w-lg mx-auto mb-8 leading-relaxed">
                {t('about.ctaDesc')}
              </p>
              <Link to="/contact" className="inline-flex items-center space-x-2 space-x-reverse bg-white text-slate-900 px-6 py-3 rounded-full font-black text-sm hover:bg-slate-50 transition-colors shadow-lg hover:scale-105 active:scale-95">
                <span>{t('about.ctaBtn')}</span>
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
              </Link>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
