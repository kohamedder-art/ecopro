import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Zap, 
  ArrowLeft, 
  PlayCircle, 
  Layout, 
  BarChart3,
  Truck, 
  CheckCircle2, 
  Check, 
  Facebook, 
  Instagram, 
  Twitter,
  Sparkles,
  ClipboardList,
  Bot,
  Brain,
  Package
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

export default function Index() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const [trialDays, setTrialDays] = useState<number>(30);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const res = await apiFetch<{ trialDays: number }>('/api/billing/public');
        if (res?.trialDays) {
          setTrialDays(res.trialDays);
        }
      } catch {
        // keep default fallback
      }
    };

    fetchBilling();
  }, []);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap');

        :root {
          --primary: #4f46e5;
          --primary-light: #6366f1;
          --surface: #ffffff;
          --border: #e2e8f0;
        }

        .dark {
          --surface: #0f172a;
          --border: #1e293b;
        }

        .index-page-wrapper {
          font-family: 'Noto Sans Arabic', 'Plus Jakarta Sans', sans-serif;
        }

        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .feature-card:hover {
          border-color: var(--primary-light);
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
        }

        .bento-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 1.25rem;
        }

        .bento-item,
        .bento-item-4,
        .bento-item-6,
        .bento-item-8 {
          grid-column: span 12;
        }

        @media (min-width: 768px) {
          .bento-item-4 { grid-column: span 4; }
          .bento-item-6 { grid-column: span 6; }
          .bento-item-8 { grid-column: span 8; }
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 2rem;
          font-weight: 700;
          border-radius: 12px;
          background: #0f172a;
          color: white;
          transition: background 0.2s ease;
          cursor: pointer;
          border: none;
        }

        .btn-primary:hover {
          background: #1e293b;
        }

        .dark .btn-primary {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }

        .dark .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 2rem;
          font-weight: 600;
          border-radius: 12px;
          background: white;
          color: #334155;
          border: 1px solid #e2e8f0;
          transition: border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .dark .btn-secondary {
          background: #1e293b;
          color: #e2e8f0;
          border-color: #334155;
        }

        .dark .btn-secondary:hover {
          background: #334155;
          border-color: #475569;
        }

        .text-gradient {
          background: linear-gradient(135deg, #0f172a 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .dark .text-gradient {
          background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .icon-box {
          width: 3rem;
          height: 3rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .step-number {
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.25rem;
          margin: 0 auto 1.25rem;
        }
      `}} />

      <div className="index-page-wrapper">
        {/* Simple background gradient */}
        <div className="fixed inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.06) 0%, transparent 60%)'
        }} />

        {/* Hero Section */}
        <section className="relative pt-28 pb-16 px-6 z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 px-3 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">{t('index.badge')}</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold mb-5 leading-[1.1] text-gradient">
              {t('index.heroLine1')} <br/>
              <span className="text-indigo-600 dark:text-indigo-400">{t('index.heroHighlight')}</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('index.heroDesc')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup" className="btn-primary gap-2 w-full sm:w-auto">
                {t('index.ctaCreate')}
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <button className="btn-secondary gap-2 w-full sm:w-auto">
                <PlayCircle className="w-5 h-5 text-indigo-600" />
                {t('index.ctaDemo')}
              </button>
            </div>
          </div>

          {/* Product screenshot */}
          <div className="max-w-5xl mx-auto mt-14">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-mono flex items-center gap-1.5 ml-4">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  store.yourstore.com/dashboard
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50">
                <img
                  src="/screenshots/home-admin-analytics.png"
                  className="w-full object-cover object-top max-h-[420px]"
                  alt="لوحة الإحصائيات"
                  onError={(e) => { e.currentTarget.src = "/screenshots/main-dashboard.png"; }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 px-6 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3 text-gradient">
              {t('index.featuresSectionTitle')} <br className="md:hidden" /> {t('index.featuresSectionSub')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm">{t('index.featuresSectionDesc')}</p>
          </div>

          <div className="bento-grid">
            {/* AI Store Manager - col 8 */}
            <div className="bento-item-8 feature-card p-6 md:p-8 flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1">
                <div className="icon-box bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 mb-5 border border-violet-200 dark:border-violet-800">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 text-slate-900 dark:text-white leading-snug">{t('index.featAiTitle')}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{t('index.featAiDesc')}</p>
              </div>
              <div className="w-full md:w-[45%] bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                <div className="p-4 space-y-3">
                  {[
                    { icon: '📝', label: 'Auto Descriptions', color: 'text-violet-600' },
                    { icon: '🖼️', label: 'Image Analysis', color: 'text-blue-600' },
                    { icon: '💬', label: 'Chatbot 24/7', color: 'text-emerald-600' },
                    { icon: '📊', label: 'Analytics Narration', color: 'text-amber-600' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-slate-700">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                      <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">AI</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-Platform Bot - col 4 */}
            <div className="bento-item-4 feature-card p-6 md:p-8 flex flex-col">
              <div className="icon-box bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 mb-5 border border-sky-200 dark:border-sky-800">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.featBotTitle')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-5">{t('index.featBotDesc')}</p>
              <div className="mt-auto grid grid-cols-5 gap-2">
                {['Telegram', 'WhatsApp', 'Messenger', 'Instagram', 'Viber'].map((name) => (
                  <div key={name} className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                    <span className="text-lg">{
                      name === 'Telegram' ? '✈️' :
                      name === 'WhatsApp' ? '💬' :
                      name === 'Messenger' ? '💙' :
                      name === 'Instagram' ? '📸' : '📞'
                    }</span>
                    <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 text-center leading-tight">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Integration - col 4 */}
            <div className="bento-item-4 feature-card p-6 md:p-8 flex flex-col">
              <div className="icon-box bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-5 border border-emerald-200 dark:border-emerald-800">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.feat2Title')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{t('index.feat2Desc')}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { src: '/delivery-logos/yalidine.png', name: 'Yalidine' },
                  { src: '/delivery-logos/ZR-Express-1.webp', name: 'ZR Express' },
                  { src: '/delivery-logos/NOEST.png', name: 'Noest' },
                  { src: '/delivery-logos/maystro.png', name: 'Maystro' },
                  { src: '/delivery-logos/EMS.png', name: 'EMS' },
                  { src: '/delivery-logos/dolivroo.png', name: 'Dolivroo' },
                ].map((c) => (
                  <div key={c.name} className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                    <img src={c.src} alt={c.name} className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 mt-1 text-center leading-tight">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analytics Dashboard - col 4 */}
            <div className="bento-item-4 feature-card p-6 md:p-8 flex flex-col">
              <div className="icon-box bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-5 border border-blue-200 dark:border-blue-800">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.feat3Title')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-5">{t('index.feat3Desc')}</p>
              <div className="mt-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Revenue</span>
                  <span className="text-sm font-extrabold text-emerald-600">+32%</span>
                </div>
                <div className="h-20 flex items-end gap-1">
                  {[35, 50, 42, 68, 55, 78, 90].map((h, i) => (
                    <div key={i} className="flex-1 bg-indigo-200 dark:bg-indigo-800 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Order Management - col 4 */}
            <div className="bento-item-4 feature-card p-6 md:p-8 flex flex-col">
              <div className="icon-box bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mb-5 border border-amber-200 dark:border-amber-800">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.feat5Title')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{t('index.feat5Desc')}</p>
              <div className="mt-5 space-y-2">
                {[
                  { status: 'Delivered', count: '156', color: 'bg-emerald-500' },
                  { status: 'Processing', count: '23', color: 'bg-amber-500' },
                  { status: 'Pending', count: '12', color: 'bg-slate-400' },
                ].map((s) => (
                  <div key={s.status} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{s.status}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Editor - col 6 */}
            <div className="bento-item-6 feature-card p-6 md:p-8 flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1">
                <div className="icon-box bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-5 border border-indigo-200 dark:border-indigo-800">
                  <Layout className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.feat1Title')}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{t('index.feat1Desc')}</p>
              </div>
              <div className="w-full md:w-[55%] bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <img src="/screenshots/home-template-mobile-editor.png" className="w-full object-cover object-top" alt="محرر القوالب" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            </div>

            {/* Store & Support - col 6 */}
            <div className="bento-item-6 feature-card p-6 md:p-8 flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1">
                <div className="icon-box bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 mb-5 border border-rose-200 dark:border-rose-800">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold mb-4 text-slate-900 dark:text-white">{t('index.feat4Title')}</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t('index.feat4Li1')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t('index.feat4Li2')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t('index.feat4Li3')}</span>
                  </li>
                </ul>
              </div>
              <div className="w-full md:w-[40%] bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 p-5 flex-shrink-0">
                <div className="text-center">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-indigo-200 dark:border-indigo-800">
                    <span className="text-2xl">🇩🇿</span>
                  </div>
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">24/7 Support</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Arabic + Darija</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 px-6 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-extrabold text-indigo-600 mb-1">{t('index.stat1')}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('index.stat1Label')}</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold text-slate-800 dark:text-slate-200 mb-1">{t('index.stat2')}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('index.stat2Label')}</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold text-indigo-600 mb-1">{t('index.stat3')}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('index.stat3Label')}</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold text-slate-800 dark:text-slate-200 mb-1">{t('index.stat4')}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('index.stat4Label')}</p>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-16 px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-3 text-gradient">{t('index.howTitle')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('index.howDesc')}</p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="feature-card p-8 text-center">
              <div className="step-number bg-slate-900 dark:bg-slate-700 text-white">01</div>
              <h4 className="text-lg font-extrabold mb-2 text-slate-900 dark:text-white">{t('index.step1Title')}</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{t('index.step1Desc')}</p>
            </div>

            <div className="feature-card p-8 text-center border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
              <div className="step-number bg-indigo-600 text-white">02</div>
              <h4 className="text-lg font-extrabold mb-2 text-slate-900 dark:text-white">{t('index.step2Title')}</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{t('index.step2Desc')}</p>
            </div>

            <div className="feature-card p-8 text-center">
              <div className="step-number bg-slate-900 dark:bg-slate-700 text-white">03</div>
              <h4 className="text-lg font-extrabold mb-2 text-slate-900 dark:text-white">{t('index.step3Title')}</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{t('index.step3Desc')}</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto rounded-[1.5rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-10 md:p-14 text-center relative overflow-hidden text-white border border-indigo-500/30">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">{t('index.ctaTitle')}</h2>
              <p className="text-indigo-200 text-sm md:text-base mb-8 max-w-lg mx-auto leading-relaxed">{t('index.ctaDesc')}</p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signup" className="bg-white text-indigo-700 hover:bg-slate-50 transition-colors px-10 py-4 rounded-xl text-base font-extrabold inline-block w-full sm:w-auto">
                  {t('index.ctaCta')}
                </Link>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl px-5 py-4 text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t('index.ctaTrial', { n: trialDays })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 border-b md:border-b-0 border-slate-100 pb-8 md:pb-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap className="text-white w-4 h-4" />
                </div>
                <span className="text-lg font-extrabold tracking-tight uppercase text-slate-900 dark:text-white">Sahla<span className="text-indigo-500">4</span>Eco</span>
              </div>
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
      </div>
    </div>
  );
}
