import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Brain, Bot, Layout, Truck, BarChart3, ClipboardList } from 'lucide-react';

const icons = [Brain, Bot, Layout, Truck, BarChart3, ClipboardList];

const colors = [
  'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400',
  'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
  'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
];

const titles = [
  'index.featAiTitle',
  'index.featBotTitle',
  'index.feat1Title',
  'index.feat2Title',
  'index.feat3Title',
  'index.feat5Title',
];

const descs = [
  'index.featAiDesc',
  'index.featBotDesc',
  'index.feat1Desc',
  'index.feat2Desc',
  'index.feat3Desc',
  'index.feat5Desc',
];

export function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 text-slate-900 dark:text-white">
            {t('index.featuresSectionTitle')}<br className="md:hidden" /> {t('index.featuresSectionSub')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm">{t('index.featuresSectionDesc')}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {titles.map((titleKey, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg ${colors[i]} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold mb-2 text-slate-900 dark:text-white">{t(titleKey)}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t(descs[i])}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
