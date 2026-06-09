import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { Navbar, Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { HowItWorks } from './sections/HowItWorks';
import { PricingCTA } from './sections/PricingCTA';
import { Footer } from './sections/Footer';

export default function Index() {
  const { locale } = useTranslation();
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
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingCTA />
      <Footer />
    </div>
  );
}
