import { generateText, GeminiContent } from './gemini';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

const DESIGN_PRESETS: Record<string, StoreBuildConfig> = {
  darkTech: {
    storeName: '', storeDescription: '', template: 'primo', theme: 'dark',
    primaryColor: '#0EA5E9', accentColor: '#38BDF8', backgroundColor: '#0B1121',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Tajawal, sans-serif', fontFamilyBody: 'Tajawal, sans-serif',
    heroLayout: 'split', gridColumns: 3, cardStyle: 'elevated', cardRadius: 8,
    hoverEffect: 'glow', showProductShadows: true, sampleProducts: [],
  },
  luxuryGold: {
    storeName: '', storeDescription: '', template: 'dzshop', theme: 'dark',
    primaryColor: '#D4AF37', accentColor: '#F59E0B', backgroundColor: '#0F172A',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Playfair Display, serif', fontFamilyBody: 'Inter, sans-serif',
    heroLayout: 'left-text', gridColumns: 2, cardStyle: 'flat', cardRadius: 0,
    hoverEffect: 'lift', showProductShadows: false, sampleProducts: [],
  },
  minimalClean: {
    storeName: '', storeDescription: '', template: 'zenith', theme: 'light',
    primaryColor: '#1E293B', accentColor: '#6366F1', backgroundColor: '#FFFFFF',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Inter, sans-serif', fontFamilyBody: 'Inter, sans-serif',
    heroLayout: 'centered', gridColumns: 3, cardStyle: 'shadow', cardRadius: 12,
    hoverEffect: 'none', showProductShadows: true, sampleProducts: [],
  },
  warmEarth: {
    storeName: '', storeDescription: '', template: 'leroishop', theme: 'light',
    primaryColor: '#4A7C59', accentColor: '#D4A574', backgroundColor: '#FAF5F0',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Merriweather, serif', fontFamilyBody: 'Inter, sans-serif',
    heroLayout: 'centered', gridColumns: 3, cardStyle: 'border', cardRadius: 8,
    hoverEffect: 'zoom', showProductShadows: false, sampleProducts: [],
  },
  kidsPlayful: {
    storeName: '', storeDescription: '', template: 'boutique', theme: 'light',
    primaryColor: '#FF6B9D', accentColor: '#87CEEB', backgroundColor: '#FFF5F5',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Comic Sans MS, cursive', fontFamilyBody: 'Inter, sans-serif',
    heroLayout: 'fullscreen', gridColumns: 2, cardStyle: 'shadow', cardRadius: 16,
    hoverEffect: 'zoom', showProductShadows: true, sampleProducts: [],
  },
  spicyRed: {
    storeName: '', storeDescription: '', template: 'spiriluxe', theme: 'light',
    primaryColor: '#DC2626', accentColor: '#FF8C00', backgroundColor: '#FFF8F0',
    heroHeading: '', heroSubtitle: '', buttonText: 'تسوق الآن',
    fontFamily: 'Inter, sans-serif', fontFamilyBody: 'Inter, sans-serif',
    heroLayout: 'centered', gridColumns: 2, cardStyle: 'elevated', cardRadius: 8,
    hoverEffect: 'none', showProductShadows: true, sampleProducts: [],
  },
};

const PRESET_MAP: Record<string, string> = {
  'إلكترونيات': 'darkTech', 'تقنية': 'darkTech', 'هواتف': 'darkTech', 'كمبيوتر': 'darkTech',
  'مجوهرات': 'luxuryGold', 'فضة': 'luxuryGold', 'ذهب': 'luxuryGold', 'ساعات': 'luxuryGold',
  'عطور': 'minimalClean', 'تجميل': 'minimalClean', 'عناية': 'minimalClean', 'صحة': 'minimalClean',
  'أثاث': 'warmEarth', 'ديكور': 'warmEarth', 'منزل': 'warmEarth', 'مفروشات': 'warmEarth',
  'أطفال': 'kidsPlayful', 'ملابس أطفال': 'kidsPlayful', 'لعب': 'kidsPlayful',
  'أكل': 'spicyRed', 'مأكولات': 'spicyRed', 'مطعم': 'spicyRed', 'حلويات': 'spicyRed',
};

const SYSTEM_PROMPT = `أنت مصمم قوالـب متجر إلكتروني على منصة Sahla4Eco. تتحدث العربية الفصحى فقط.

مهمتك: اختر تصميماً جاهزاً (preset) يناسب متجر المستخدم، واملأ النصوص والمنتجات.

لديك 6 تصاميم جاهزة. كل تصميم له ألوان وخطوط وتنسيقات مجربة ومضمونة. أنت فقط:
1. تختار التصميم المناسب حسب نوع المتجر
2. تملأ اسم المتجر والوصف والعناوين
3. تضيف منتجين فقط كمثال

أخرج BUILD_STORE JSON في نهاية كل رد.
اختر presetId من: darkTech, luxuryGold, minimalClean, warmEarth, kidsPlayful, spicyRed

القاعدة الذهبية: المستخدم يصف متجره → أنت تختار التصميم وتعبئ النصوص. منتجين فقط. لا أسئلة أبداً.`;

export type StoreBuildConfig = {
  presetId?: string;
  storeName: string;
  storeDescription: string;
  template: string;
  theme?: 'light' | 'dark';
  primaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  heroHeading: string;
  heroSubtitle: string;
  buttonText: string;
  fontFamily: string;
  fontFamilyBody?: string;
  heroLayout?: string;
  gridColumns?: number;
  cardStyle?: string;
  cardRadius?: number;
  hoverEffect?: string;
  showProductShadows?: boolean;
  sampleProducts: Array<{
    title: string;
    price: number;
    category: string;
  }>;
};

export function parseBuildConfig(response: string): { config: StoreBuildConfig | null; answer: string } {
  const idx = response.indexOf('BUILD_STORE:');
  if (idx === -1) return { config: null, answer: response };

  const jsonStr = response.slice(idx + 'BUILD_STORE:'.length).trim();
  if (!jsonStr.startsWith('{')) return { config: null, answer: response };

  try {
    const raw = JSON.parse(jsonStr);
    const presetId = raw.presetId as string;
    const preset = presetId ? DESIGN_PRESETS[presetId] : undefined;
    
    const config: StoreBuildConfig = {
      ...preset || DESIGN_PRESETS.minimalClean,
      storeName: raw.storeName || '',
      storeDescription: raw.storeDescription || '',
      heroHeading: raw.heroHeading || '',
      heroSubtitle: raw.heroSubtitle || '',
      buttonText: raw.buttonText || 'تسوق الآن',
      sampleProducts: raw.sampleProducts || [],
    };

    const answer = response.slice(0, idx).trim();
    return { config, answer };
  } catch {
    return { config: null, answer: response };
  }
}

export async function handleStoreBuilderMessage(
  clientId: number,
  question: string,
  prevHistory: GeminiContent[] = []
): Promise<{ answer: string; config: StoreBuildConfig | null }> {
  if (!checkRateLimit(`builder:${clientId}`, RATE_LIMITS.store_owner)) {
    return { answer: getRateLimitMessage(getRateLimitResetTime(`builder:${clientId}`), 'store_owner', 'ar'), config: null };
  }

  const ctx = await loadStoreContext(clientId);

  let prompt = `اختر تصميم من التصاميم الجاهزة (${Object.keys(DESIGN_PRESETS).join(', ')}) واملأ النصوص والمنتجات.

وصف المستخدم: ${question}

أخرج BUILD_STORE JSON بـ presetId + النصوص والمنتجات. لا تغير أي قيم تصميم.`;

  try {
    const response = await generateText('store_owner', prompt, {
      storeId: clientId,
      storeName: ctx?.storeName || '',
      clientId,
      userType: 'owner',
    }, prevHistory, undefined, SYSTEM_PROMPT);

    const { config, answer } = parseBuildConfig(response);
    return { answer, config };
  } catch (err) {
    console.error(`[StoreBuilderAI] Error for client ${clientId}:`, err);
    return { answer: 'حدث خطأ. حاول مرة أخرى.', config: null };
  }
}

async function loadStoreContext(clientId: number): Promise<{ storeName: string } | null> {
  try {
    const { pool } = await import('../utils/database');
    const p = await pool();
    const res = await p.query(`SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
    if (res.rows.length && res.rows[0].store_name) {
      return { storeName: res.rows[0].store_name };
    }
    return null;
  } catch {
    return null;
  }
}
