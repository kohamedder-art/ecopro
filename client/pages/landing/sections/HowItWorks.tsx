import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { title: 'index.step1Title', desc: 'index.step1Desc' },
    { title: 'index.step2Title', desc: 'index.step2Desc' },
    { title: 'index.step3Title', desc: 'index.step3Desc' },
  ];

  return (
    <section id="how" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 text-slate-900 dark:text-white">{t('index.howTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('index.howDesc')}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-slate-200 dark:bg-slate-700" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative mb-6">
                <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center text-lg font-extrabold shadow-md relative z-10">
                  {i + 1}
                </div>
              </div>
              <h3 className="text-base font-extrabold mb-2 text-slate-900 dark:text-white">{t(step.title)}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">{t(step.desc)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
