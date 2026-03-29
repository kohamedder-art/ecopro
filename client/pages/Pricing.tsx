import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MessageCircle, Loader2, Check, Rocket, Gift, Shield, Infinity, Sparkles, Zap, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type PublicBillingInfo = {
  trialDays: number;
  subscriptionPriceUsd: number;
};

export default function Pricing() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [publicBilling, setPublicBilling] = useState<PublicBillingInfo | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);

    // Fetch public pricing config
    const fetchPricing = async () => {
      try {
        setLoading(true);
        const res = await apiFetch<{ success: boolean; config: PublicBillingInfo }>('/api/v1/auth/public-billing');
        if (res.success && res.config) {
          setPublicBilling(res.config);
        } else {
          // Fallback values if API doesn't return anything config-wise
          setPublicBilling({
            trialDays: 3,
            subscriptionPriceUsd: 2900
          });
        }
      } catch (err: any) {
        console.error("Failed to fetch public pricing:", err);
        // Fallback for demo visually
        setPublicBilling({
          trialDays: 3,
          subscriptionPriceUsd: 2900
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, []);

  const FEATURES = [
    t('pricing.f1'),
    t('pricing.f2'),
    t('pricing.f3'),
    t('pricing.f4'),
    t('pricing.f5'),
    t('pricing.f6'),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const trialDays = publicBilling?.trialDays ?? 3;
  const price = publicBilling?.subscriptionPriceUsd ?? 2900;

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden relative font-['Noto_Sans_Arabic'] pt-32 pb-16 px-4 md:px-6">
      <div className="fixed top-0 left-0 w-full h-full z-0 bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.08)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.05)_0%,transparent_35%),#f8fafc] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.15)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.10)_0%,transparent_35%),#020617]"></div>
      
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Glow behind header */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50vw] h-[40vh] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] blur-[80px] z-0 opacity-80 pointer-events-none"></div>

        <div className="text-center mb-16 relative z-10">
          <div className="inline-flex items-center space-x-2 space-x-reverse bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t('pricing.badge')}</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900 dark:text-white">
            {t('pricing.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">{t('pricing.titleHighlight')}</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            {t('pricing.desc')}
          </p>
        </div>

        {/* Core Pricing Card */}
        <div className="max-w-3xl mx-auto">
          <div className="relative flex flex-col md:flex-row bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-indigo-200 dark:border-indigo-800 shadow-[0_8px_30px_-12px_rgba(99,102,241,0.3)] rounded-[2rem] overflow-hidden">
            
            {/* Left side (Pricing Details) */}
            <div className="md:w-5/12 bg-gradient-to-br from-indigo-50 dark:from-indigo-950/50 to-white dark:to-slate-900 p-8 md:p-10 border-l border-slate-100 dark:border-slate-700 flex flex-col justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
                
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 z-10">{t('pricing.planTitle')}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-6 z-10">{t('pricing.planSubtitle')}</p>
                
                <div className="flex items-baseline justify-center gap-1 mb-4 z-10">
                  <span className="text-5xl font-black text-slate-900 dark:text-white">
                    {price}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 font-bold mb-1">
                    {t('pricing.currency')}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 z-10">
                  {t('pricing.perMonth')}
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center gap-3 mb-6 z-10 mx-auto shadow-sm">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/60 rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-900 dark:text-indigo-100 leading-tight">{t('pricing.trialBadge')}</div>
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t('pricing.trialDays', { n: trialDays })}</div>
                  </div>
                </div>

                <div className="z-10 mt-auto">
                  <Link to={isLoggedIn ? "/dashboard" : "/signup"}>
                    <Button className="w-full rounded-full h-14 font-black text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 group flex items-center gap-2">
                       {isLoggedIn ? t('pricing.ctaDashboard') : t('pricing.cta')}
                       <Rocket className="w-5 h-5 group-hover:animate-bounce" />
                    </Button>
                  </Link>
                </div>
            </div>

            {/* Right side (Features List) */}
            <div className="md:w-7/12 p-8 md:p-10 flex flex-col justify-center">
              <h4 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                 <Zap className="w-5 h-5 text-indigo-500" />
                 {t('pricing.featuresTitle')}
              </h4>
              
              <ul className="space-y-4">
                {FEATURES.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 space-x-reverse font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-700 pb-3 last:border-0 last:pb-0">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 shadow-sm border border-indigo-100">
                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <span className="text-sm md:text-base">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* FAQ Teaser */}
        <div className="mt-20 text-center max-w-2xl mx-auto pt-10">
          <div className="w-14 h-14 bg-white/80 dark:bg-slate-800/80 backdrop-blur-[2px] rounded-3xl flex items-center justify-center shadow-lg border border-indigo-100 dark:border-indigo-800 mx-auto mb-6 transform -rotate-6">
            <MessageCircle className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black mb-3 text-slate-900 dark:text-white">{t('pricing.faqTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 font-semibold mb-8 text-lg">
            {t('pricing.faqDesc')}
          </p>
          <Link to="/contact" className="inline-flex items-center space-x-2 space-x-reverse font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors bg-white dark:bg-slate-800 px-6 py-3 rounded-full shadow-sm hover:shadow-md border border-indigo-50 dark:border-slate-700">
            <span>{t('pricing.faqCta')}</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
