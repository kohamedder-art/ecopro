import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { Navbar } from './sections/Navbar';
import { Chapter1 } from './sections/Chapter1';
import { Chapter2 } from './sections/Chapter2';
import { Chapter3 } from './sections/Chapter3';
import { Chapter4 } from './sections/Chapter4';
import { FinalCTA } from './sections/FinalCTA';
import { Footer } from './sections/Footer';

export default function Index() {
  const { locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <Navbar />
      <Chapter1 />
      <Chapter2 />
      <Chapter3 />
      <Chapter4 />
      <FinalCTA />
      <Footer />
    </div>
  );
}
