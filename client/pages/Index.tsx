import { Link } from "react-router-dom";
import { 
  Zap, 
  ArrowLeft, 
  PlayCircle, 
  CheckCircle, 
  Layout, 
    BarChart3,
  Truck, 
  CheckCircle2, 
  Check, 
  Facebook, 
  Instagram, 
  Twitter,
  Sparkles
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Index() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Noto+Sans+Arabic:wght@400;600;700;900&display=swap');
        
        :root {
            --primary: #6366f1;
            --magic-glow: rgba(99, 102, 241, 0.15);
        }

        .index-page-wrapper {
            font-family: 'Noto Sans Arabic', 'Plus Jakarta Sans', sans-serif;
            scroll-behavior: smooth;
        }

        .magic-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.08) 0%, transparent 35%),
                radial-gradient(circle at 90% 90%, rgba(168, 85, 247, 0.05) 0%, transparent 35%),
                #f8fafc;
        }

        .hero-glow {
            position: absolute;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 50vw;
            height: 40vh;
            background: radial-gradient(circle, var(--magic-glow) 0%, transparent 60%);
            filter: blur(80px);
            z-index: 0;
            opacity: 0.8;
            pointer-events: none;
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(0, 0, 0, 0.05);
            border-radius: 24px;
            box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .glass-card:hover {
            border-color: rgba(99, 102, 241, 0.2);
            background: rgba(255, 255, 255, 0.95);
            transform: translateY(-4px);
            box-shadow: 0 12px 30px -10px rgba(99, 102, 241, 0.15);
        }

        .btn-magic {
            position: relative;
            background: #0f172a;
            color: #fff;
            overflow: hidden;
            transition: all 0.3s ease;
            z-index: 1;
        }

        .btn-magic::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: 0.5s;
        }

        .btn-magic:hover::before {
            left: 100%;
        }

        .btn-magic:hover {
            transform: scale(1.03);
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4);
        }

        .floating {
            animation: floating 6s ease-in-out infinite;
        }

        @keyframes floating {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
        }

        .text-gradient {
            background: linear-gradient(135deg, #0f172a 0%, #475569 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .bento-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1.25rem;
        }

        .bento-item {
            grid-column: span 12;
        }

        @media (min-width: 768px) {
            .bento-item-4 { grid-column: span 4; }
            .bento-item-8 { grid-column: span 8; }
            .bento-item-6 { grid-column: span 6; }
        }

        /* Dark mode overrides */
        .dark .magic-bg {
            background:
                radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.15) 0%, transparent 35%),
                radial-gradient(circle at 90% 90%, rgba(168, 85, 247, 0.10) 0%, transparent 35%),
                #020617;
        }
        .dark .glass-card {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .dark .glass-card:hover {
            border-color: rgba(99, 102, 241, 0.3);
            background: rgba(15, 23, 42, 0.95);
        }
        .dark .text-gradient {
            background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .dark .btn-magic {
            background: linear-gradient(135deg, #6366f1, #4f46e5);
        }
      `}} />

      <div className="index-page-wrapper relative min-h-screen">
        <div className="magic-bg fixed"></div>


        {/* Hero Section */}
        <section className="relative pt-32 pb-16 px-6 overflow-hidden z-10">
            <div className="hero-glow"></div>
            <div className="max-w-5xl mx-auto text-center relative z-10">
                <div className="inline-flex items-center space-x-2 space-x-reverse bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 px-3 py-1.5 rounded-full mb-6">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">{t('index.badge')}</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[1.1] text-gradient">
                    {t('index.heroLine1')} <br/>
                    <span className="text-indigo-600">{t('index.heroHighlight')}</span>
                </h1>
                
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
                    {t('index.heroDesc')}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4 sm:space-x-reverse">
                    <Link to="/signup" className="btn-magic px-8 py-4 rounded-xl text-button font-black shadow-lg flex items-center group w-full sm:w-auto justify-center">
                        {t('index.ctaCreate')}
                        <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Link>
                    <button className="px-8 py-4 rounded-xl text-button font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-sm transition-all flex items-center w-full sm:w-auto justify-center">
                        <PlayCircle className="ml-2 w-5 h-5 text-indigo-600" />
                        {t('index.ctaDemo')}
                    </button>
                </div>
            </div>

            {/* Floating UI Preview with Statistics Dashboard Image */}
            <div className="max-w-4xl mx-auto mt-16 relative z-10">
                <div className="floating relative z-20">
                    <div className="glass-card p-3 pb-0 overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3 px-3 pt-1">
                            <div className="flex space-x-2 space-x-reverse">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700 px-6 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-tighter flex items-center">
                                <Sparkles className="w-3 h-3 text-indigo-500 mr-2" />
                                store.sahla4eco.com/dashboard
                            </div>
                            <div className="w-8"></div>
                        </div>
                        <div className="rounded-t-lg overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <img src="/screenshots/home-admin-analytics.png" className="w-full transition-transform hover:scale-[1.02] duration-700 object-cover object-top max-h-[450px]" alt="لوحة الإحصائيات والتحليلات" onError={(e) => { e.currentTarget.src = "/screenshots/main-dashboard.png"; }} />
                        </div>
                    </div>
                </div>
                
                {/* Secondary Decorative Elements */}
                <div className="absolute -left-8 top-24 glass-card p-4 w-60 floating z-30" style={{ animationDelay: '-2s' }}>
                    <div className="flex items-center space-x-3 space-x-reverse mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest">{t('index.orderConfirmed')}</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">10,500 DZD</p>
                        </div>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-3/4 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="py-16 px-6 max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-black mb-4 text-gradient">{t('index.featuresSectionTitle')} <br/> {t('index.featuresSectionSub')}</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto text-sm">{t('index.featuresSectionDesc')}</p>
            </div>

            <div className="bento-grid">
                {/* Feature 1 - Templates Image */}
                <div className="bento-item-8 glass-card p-6 md:p-8 flex flex-col justify-between group overflow-hidden relative">
                    <div className="relative z-10 w-full md:w-[38%]">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 border border-indigo-200 dark:border-indigo-800 group-hover:scale-110 transition-transform shadow-sm">
                            <Layout className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-black mb-3 text-slate-900 dark:text-white leading-snug">{t('index.feat1Title')}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{t('index.feat1Desc')}</p>
                    </div>
                    
                    <div className="mt-8 md:mt-0 md:absolute md:left-0 md:top-4 md:bottom-0 md:w-[68%] flex items-end justify-end">
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-t-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border border-slate-200 dark:border-slate-700 border-b-0 translate-y-4 group-hover:translate-y-0 transition-transform duration-500 w-full overflow-hidden">
                            <img src="/screenshots/home-template-mobile-editor.png" className="w-full object-cover object-top rounded-t-xl" alt="معاينة محرر القوالب على الهاتف" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                    </div>
                </div>

                {/* Feature 2 - Delivery Integration Image */}
                <div className="bento-item-4 glass-card p-6 md:p-8 group flex flex-col">
                    <div>
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 border border-emerald-200 dark:border-emerald-800 group-hover:-translate-y-1 transition-transform shadow-sm">
                            <Truck className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black mb-2 text-slate-900 dark:text-white">{t('index.feat2Title')}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t('index.feat2Desc')}</p>
                    </div>
                    <div className="mt-6 flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <img src="/screenshots/home-store-catalog.png" className="w-full h-full object-contain object-top opacity-95 group-hover:scale-[1.02] transition-transform duration-500" alt="متابعة حالات الطلبات والتوصيل" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                </div>

                {/* Feature 3 - Analytics Image */}
                <div className="bento-item-4 glass-card p-6 md:p-8 group flex flex-col">
                    <div>
                        <div className="w-12 h-12 bg-sky-100 dark:bg-sky-950/50 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400 mb-6 border border-sky-200 dark:border-sky-800 group-hover:-translate-y-1 transition-transform shadow-sm">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black mb-2 text-slate-900 dark:text-white">{t('index.feat3Title')}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t('index.feat3Desc')}</p>
                    </div>
                    <div className="mt-6 flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <img src="/screenshots/home-admin-analytics.png" className="w-full h-full object-contain object-top opacity-95 group-hover:scale-[1.02] transition-transform duration-500" alt="لوحة تحليلات المتجر" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                </div>

                {/* Feature 4 - Store Products Image replacing abstract shape */}
                <div className="bento-item-8 glass-card p-6 md:p-8 flex flex-col md:flex-row items-center group overflow-hidden gap-6">
                    <div className="flex-1 w-full relative z-10">
                        <h3 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">{t('index.feat4Title')}</h3>
                        <ul className="space-y-4">
                            <li className="flex items-center space-x-3 space-x-reverse bg-white/50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10">
                                <CheckCircle2 className="text-indigo-500 w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('index.feat4Li1')}</span>
                            </li>
                            <li className="flex items-center space-x-3 space-x-reverse bg-white/50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10">
                                <CheckCircle2 className="text-indigo-500 w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('index.feat4Li2')}</span>
                            </li>
                            <li className="flex items-center space-x-3 space-x-reverse bg-white/50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10">
                                <CheckCircle2 className="text-indigo-500 w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('index.feat4Li3')}</span>
                            </li>
                        </ul>
                    </div>
                    <div className="w-full md:w-[45%] h-64 md:h-full bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-inner group-hover:-translate-y-2 transition-transform duration-500">
                        <div className="absolute inset-x-0 top-0 h-4 bg-slate-200/50 dark:bg-slate-700/50 flex space-x-1 space-x-reverse px-2 items-center z-10 border-b border-slate-200 dark:border-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                        </div>
                        <img src="/screenshots/home-orders-management.png" className="w-full h-full object-contain object-top pt-4" alt="إدارة منتجات المتجر" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                </div>
            </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 px-6 bg-indigo-50/50 dark:bg-slate-900/50 border-y border-indigo-100/50 dark:border-slate-800/50 relative z-10">
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                    <p className="text-4xl font-black text-indigo-600 mb-1">{t('index.stat1')}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('index.stat1Label')}</p>
                </div>
                <div>
                    <p className="text-4xl font-black text-slate-800 dark:text-slate-200 mb-1">{t('index.stat2')}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('index.stat2Label')}</p>
                </div>
                <div>
                    <p className="text-4xl font-black text-indigo-600 mb-1">{t('index.stat3')}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('index.stat3Label')}</p>
                </div>
                <div>
                    <p className="text-4xl font-black text-slate-800 dark:text-slate-200 mb-1">{t('index.stat4')}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('index.stat4Label')}</p>
                </div>
            </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-16 px-6 relative z-10">
            <div className="max-w-3xl mx-auto text-center mb-12">
                <h2 className="text-3xl font-black mb-4 text-gradient">{t('index.howTitle')}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{t('index.howDesc')}</p>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                <div className="hidden md:block absolute top-[40%] left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-100 to-transparent -z-10 bg-[length:10px_10px]" style={{backgroundImage: 'linear-gradient(90deg, #e0e7ff 50%, transparent 50%)'}}></div>
                
                <div className="glass-card p-8 text-center relative border-white sm:hover:scale-[1.02] transition-transform">
                    <div className="w-14 h-14 bg-slate-900 dark:bg-slate-700 text-white font-black text-xl rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">01</div>
                    <h4 className="text-lg font-black mb-2 text-slate-900 dark:text-white">{t('index.step1Title')}</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t('index.step1Desc')}</p>
                </div>

                <div className="glass-card p-8 text-center relative border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 sm:hover:scale-[1.02] transition-transform shadow-[0_4px_20px_-2px_rgba(99,102,241,0.1)]">
                    <div className="w-14 h-14 bg-indigo-600 text-white font-black text-xl rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(99,102,241,0.4)]">02</div>
                    <h4 className="text-lg font-black mb-2 text-slate-900 dark:text-white">{t('index.step2Title')}</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t('index.step2Desc')}</p>
                </div>

                <div className="glass-card p-8 text-center relative border-white sm:hover:scale-[1.02] transition-transform">
                    <div className="w-14 h-14 bg-slate-900 dark:bg-slate-700 text-white font-black text-xl rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">03</div>
                    <h4 className="text-lg font-black mb-2 text-slate-900 dark:text-white">{t('index.step3Title')}</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{t('index.step3Desc')}</p>
                </div>
            </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-6 relative z-10">
            <div className="max-w-4xl mx-auto rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-10 md:p-14 text-center shadow-[0_20px_50px_-12px_rgba(99,102,241,0.3)] relative overflow-hidden text-white border border-indigo-500/50">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10">
                    <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">{t('index.ctaTitle')}</h2>
                    <p className="text-indigo-100 text-sm md:text-base mb-10 max-w-lg mx-auto leading-relaxed">{t('index.ctaDesc')}</p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 sm:space-x-reverse">
                        <Link to="/signup" className="bg-white text-indigo-700 hover:bg-slate-50 transition-colors px-10 py-4 rounded-xl text-base font-black shadow-xl inline-block w-full sm:w-auto transform hover:-translate-y-1">
                            {t('index.ctaCta')}
                        </Link>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl px-6 py-4 text-xs font-bold flex items-center justify-center w-full sm:w-auto">
                            <Check className="ml-2 w-4 h-4 text-emerald-400" />
                            {t('index.ctaTrial')}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-slate-200 dark:border-slate-800 relative z-10 bg-white dark:bg-slate-950">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-1 border-b md:border-b-0 border-slate-100 pb-8 md:pb-0">
                    <div className="flex items-center space-x-2 space-x-reverse mb-4">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                            <Zap className="text-white w-4 h-4" />
                        </div>
                        <span className="text-lg font-black tracking-tighter uppercase text-slate-900 dark:text-white">Sahla<span className="text-indigo-500">4</span>Eco</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-xs">{t('index.footerTagline')}</p>
                </div>
                
                <div>
                    <h5 className="font-black mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerProduct')}</h5>
                    <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerFeatures')}</a></li>
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerTemplates')}</a></li>
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerUpdates')}</a></li>
                    </ul>
                </div>

                <div>
                    <h5 className="font-black mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerCompany')}</h5>
                    <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerAbout')}</a></li>
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerBlog')}</a></li>
                        <li><a href="#" className="hover:text-indigo-600 transition-colors">{t('index.footerContact')}</a></li>
                    </ul>
                </div>

                <div>
                    <h5 className="font-black mb-4 text-slate-900 dark:text-slate-200 uppercase tracking-widest text-[11px]">{t('index.footerFollow')}</h5>
                    <div className="flex space-x-3 space-x-reverse">
                        <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                            <Facebook className="w-4 h-4" />
                        </a>
                        <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                            <Instagram className="w-4 h-4" />
                        </a>
                        <a href="#" className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                            <Twitter className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
            <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-100 dark:border-slate-800 text-center text-slate-500 dark:text-slate-500 text-[11px] font-bold">
            {t('index.footerCopyright')}
            </div>
        </footer>
      </div>
    </div>
  );
}
