import { useTranslation } from "@/lib/i18n";
import { Chapter1 } from './sections/Chapter1';
import { Chapter2 } from './sections/Chapter2';
import { Chapter3 } from './sections/Chapter3';

export default function Index() {
  const { locale } = useTranslation();
  const isRTL = locale === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <Chapter1 />
      <Chapter2 />
      <Chapter3 />
    </div>
  );
}
