import { Mail, Phone, MapPin, Send, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function Contact() {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden relative font-['Noto_Sans_Arabic']">
      <div className="fixed top-0 left-0 w-full h-full z-0 bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.08)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.05)_0%,transparent_35%),#f8fafc] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.15)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.10)_0%,transparent_35%),#020617]"></div>
      
      <div className="relative pt-32 pb-16 px-6 overflow-hidden z-10 w-full">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[50vw] h-[40vh] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] blur-[80px] z-0 opacity-80 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 space-x-reverse bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mb-6">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t('contact.badge')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900 dark:text-white leading-tight">
              {t('contact.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">{t('contact.titleHighlight')}</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold max-w-2xl mx-auto leading-relaxed">
              {t('contact.desc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div className="space-y-6">
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-3xl p-8 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">{t('contact.infoTitle')}</h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{t('contact.emailLabel')}</p>
                      <a href="mailto:support@sahla4eco.com" className="text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">support@sahla4eco.com</a>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{t('contact.phoneLabel')}</p>
                      <a href="tel:+21312345678" className="text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" dir="ltr">+213 12 345 678</a>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{t('contact.addressLabel')}</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{t('contact.addressValue')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ Teaser */}
              <div className="bg-indigo-900 text-white rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30"></div>
                <h4 className="text-xl font-black mb-3">{t('contact.faqTitle')}</h4>
                <p className="text-indigo-100 font-medium mb-6 leading-relaxed">
                  {t('contact.faqDesc')}
                </p>
                <Button className="bg-white text-indigo-900 hover:bg-slate-50 rounded-full px-6 font-bold flex items-center gap-2">
                  <span>{t('contact.faqBtn')}</span>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-3xl p-8 shadow-indigo-100/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">{t('contact.formTitle')}</h3>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('contact.nameLabel')}</label>
                  <input 
                    type="text" 
                    placeholder={t('contact.namePlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('contact.emailFormLabel')}</label>
                  <input 
                    type="email" 
                    placeholder="example@mail.com"
                    dir="ltr"
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('contact.subjectLabel')}</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
                    <option value="">{t('contact.subjectDefault')}</option>
                    <option value="support">{t('contact.subjectSupport')}</option>
                    <option value="sales">{t('contact.subjectSales')}</option>
                    <option value="billing">{t('contact.subjectBilling')}</option>
                    <option value="other">{t('contact.subjectOther')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t('contact.messageLabel')}</label>
                  <textarea 
                    rows={4}
                    placeholder={t('contact.messagePlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white rounded-xl py-3.5 px-4 font-black flex items-center justify-center gap-2 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <span>{t('contact.sendBtn')}</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
