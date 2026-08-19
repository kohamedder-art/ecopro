import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/contexts/ThemeContext';
import {
  LayoutTemplate,
  PackageCheck,
  Truck,
  MessageCircle,
  Bot,
  BarChart3,
  Globe,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: LayoutTemplate,
    titleEn: 'Storefront Templates',
    titleAr: 'قوالب المتجر',
    descEn: '100+ templates with a visual editor. Customize colors, fonts, hero sections, and layout — no code needed.',
    descAr: 'أكثر من 100 قالب مع محرر مرئي. خصص الألوان والخطوط والأقسام الرئيسية والتخطيط — بدون برمجة.',
    color: 'indigo',
  },
  {
    icon: PackageCheck,
    titleEn: 'Order Management',
    titleAr: 'إدارة الطلبات',
    descEn: 'Full order pipeline with 20+ statuses, manual entry, bulk editing, and a visual 6-step tracking view.',
    descAr: 'خط إنتاج كامل للطلبات بأكثر من 20 حالة، إدخال يدوي، تحرير جماعي، وتتبع مرئي بـ 6 خطوات.',
    color: 'violet',
  },
  {
    icon: Truck,
    titleEn: 'Delivery Integrations',
    titleAr: 'تكامل التوصيل',
    descEn: 'Connect to 13+ Algerian courier companies — Yalidine, Guepex, ZR Express, Ecotrack, and more.',
    descAr: 'تكامل مع أكثر من 13 شركة توصيل جزائرية — يالدين، جيبيكس، زد أر إكسبريس، إيكوترك، والمزيد.',
    color: 'emerald',
  },
  {
    icon: MessageCircle,
    titleEn: 'Messaging Bots',
    titleAr: 'روبوتات المراسلة',
    descEn: 'Automate order confirmations and updates via Telegram, WhatsApp, and Facebook Messenger.',
    descAr: 'أتمتة تأكيد الطلبات والتحديثات عبر تيليجرام وواتساب وessenger.',
    color: 'cyan',
  },
  {
    icon: Bot,
    titleEn: 'AI Assistant',
    titleAr: 'المساعد الذكي',
    descEn: 'AI-powered dashboard assistant that answers questions about sales, orders, and store performance.',
    descAr: 'مساعد ذكي في لوحة التحكم يجيب عن أسئلة المبيعات والطلبات وأداء المتجر.',
    color: 'amber',
  },
  {
    icon: BarChart3,
    titleEn: 'Analytics & Tracking',
    titleAr: 'التحليلات والتتبع',
    descEn: 'Marketing dashboard with conversion funnel, ad spend tracking, ROAS, and per-creative performance.',
    descAr: 'لوحة تسويق مع قمع التحويل، تتبع إنفاق الإعلانات، ROAS، وأداء كل إبداع إعلاني.',
    color: 'rose',
  },
  {
    icon: Globe,
    titleEn: 'Multi-Language',
    titleAr: 'دعم متعدد اللغات',
    descEn: 'Arabic (RTL), English, and French — with wilaya/commune address system built in.',
    descAr: 'العربية (من اليمين لليسار)، الإنجليزية، والفرنسية — مع نظام عناوين الولايات والبلديات.',
    color: 'teal',
  },
  {
    icon: Users,
    titleEn: 'Staff Management',
    titleAr: 'إدارة الموظفين',
    descEn: 'Create staff accounts with granular role-based permissions and activity logs.',
    descAr: 'إنشاء حسابات موظفين بصلاحيات دور قابلة للتخصيص وسجلات نشاط.',
    color: 'orange',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-500' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500' },
};

export function Chapter4() {
  const { locale } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = locale === 'ar';

  return (
    <section className={`relative py-24 overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0a0a0f]' : 'bg-white'
    }`}>
      {isDark && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/5 rounded-full blur-[150px]" />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className={`text-sm font-bold tracking-widest uppercase mb-4 flex items-center justify-center gap-2 ${
            isDark ? 'text-indigo-400' : 'text-indigo-600'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            {isRTL ? 'ما نقدمه' : 'What You Get'}
          </p>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {isRTL ? 'كل شيء تحتاجه ل متجرك' : 'Everything Your Store Needs'}
          </h2>
          <p className={`text-lg max-w-2xl mx-auto font-medium ${
            isDark ? 'text-white/50' : 'text-gray-500'
          }`}>
            {isRTL
              ? 'من تصميم المتجر إلى التوصيل — أدوات حقيقية لإدارة أعمالك.'
              : 'From storefront design to delivery — real tools to run your business.'}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => {
            const colors = colorMap[feature.color];
            return (
              <motion.div
                key={i}
                className={`group relative p-6 rounded-2xl border transition-all duration-300 ${
                  isDark
                    ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                    : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-lg'
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={`w-11 h-11 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <h3 className={`text-base font-bold mb-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {isRTL ? feature.titleAr : feature.titleEn}
                </h3>
                <p className={`text-sm leading-relaxed ${
                  isDark ? 'text-white/45' : 'text-gray-500'
                }`}>
                  {isRTL ? feature.descAr : feature.descEn}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
