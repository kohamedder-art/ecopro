import { getAlgeriaWilayas } from '@/lib/algeriaGeo';

/** All 58 wilayas formatted as "01 - أدرار" for use in select dropdowns */
export const WILAYAS_AR = getAlgeriaWilayas().map(
  (w) => `${String(w.code).padStart(2, '0')} - ${w.arabic_name ?? w.name}`
);

/** All 58 wilayas formatted as "01 - Adrar" for use in select dropdowns */
export const WILAYAS_FR = getAlgeriaWilayas().map(
  (w) => `${String(w.code).padStart(2, '0')} - ${w.name}`
);
