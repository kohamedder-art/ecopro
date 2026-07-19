import { generateText, GeminiContent } from './gemini';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

const SYSTEM_PROMPT = `You are a store configuration assistant. Given a user's store description, return ONLY a valid JSON object (no markdown, no explanation, no code fences).

Required JSON format:
{"storeName":"arabic name","primaryColor":"#hex","accentColor":"#hex","bgColor":"#hex","heroHeading":"arabic heading","heroSubtitle":"arabic subtitle","buttonText":"arabic button"}

Rules:
- ALL text values must be in Arabic
- Colors must be valid hex codes
- Return ONLY the JSON object. Nothing else.`;

export type GeneratedTemplate = {
  templateId: string;
  storeName: string;
  description: string;
  settings: {
    storeName: string;
    primary_color: string;
    template_accent_color: string;
    template_bg_color: string;
    template_hero_heading: string;
    template_hero_subtitle: string;
    template_button_text: string;
  };
};

const PRESETS: Record<string, { primary: string; accent: string; bg: string; heading: string; sub: string; btn: string }> = {
  electronics: { primary: '#2563EB', accent: '#60A5FA', bg: '#0F172A', heading: 'أحدث الإلكترونيات', sub: 'أجهزة بجودة عالية وأسعار منافسة', btn: 'تسوق الآن' },
  clothes: { primary: '#7C3AED', accent: '#A78BFA', bg: '#FFFFFF', heading: 'أزياء عصرية', sub: 'ملابس أنيقة لكل المناسبات', btn: 'تسوّق الآن' },
  jewelry: { primary: '#B45309', accent: '#D97706', bg: '#1C1917', heading: 'مجوهرات فاخرة', sub: 'قطع مميزة بتصاميم حصرية', btn: 'اكتشف المزيد' },
  food: { primary: '#DC2626', accent: '#F87171', bg: '#FFFBEB', heading: 'طعم أصيل', sub: 'أطباق شهية بوصفات مغربية', btn: 'اطلب الآن' },
  sports: { primary: '#059669', accent: '#34D399', bg: '#022C22', heading: 'ريادة الأداء', sub: 'معدات رياضية احترافية', btn: 'ابدأ التسوق' },
  beauty: { primary: '#DB2777', accent: '#F472B6', bg: '#FFF1F2', heading: 'جمال طبيعي', sub: 'منتجات عناية بجودة عالية', btn: 'تسوقي الآن' },
  general: { primary: '#f97316', accent: '#22c55e', bg: '#b0b8c9', heading: 'مرحباً بكم', sub: 'منتجات مميزة بأسعار منافسة', btn: 'تسوق الآن' },
};

function keywordPreset(description: string): typeof PRESETS.general {
  const d = description.toLowerCase();
  if (/إلكترون|موبايل|هاتف|لابتوب|سماع|شاحن|ساعة ذكي|gadget|phone|laptop|electronic|tech|computer/.test(d)) return PRESETS.electronics;
  if (/ملابس|ملابس رياضية|أزياء|فاشن|dress|clothes|fashion|tshirt|تيشيرت|بنطلون|جاكيت/.test(d)) return PRESETS.clothes;
  if (/مجوهر|ذهب|فضة|خاتم|سلاسل|jewel|gold|silver|ring/.test(d)) return PRESETS.jewelry;
  if (/مطعم|طعام|أكل|بيتزا|برغر|مقهى|mcdonald|burger|food|restaurant|cafe|coffee/.test(d)) return PRESETS.food;
  if (/رياض| Gym|gym|كرة|تمارين|sport|fitness|football|soccer/.test(d)) return PRESETS.sports;
  if (/عناية|جمال|مكياج|عطور|cosmetic|beauty|makeup|perfume/.test(d)) return PRESETS.beauty;
  return PRESETS.general;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export async function generateTemplateCode(
  clientId: number,
  description: string,
  prevHistory: GeminiContent[] = [],
  currentSettings?: GeneratedTemplate['settings']
): Promise<{ answer: string; template: GeneratedTemplate | null }> {
  if (!checkRateLimit(`builder:${clientId}`, RATE_LIMITS.store_owner)) {
    return {
      answer: getRateLimitMessage(getRateLimitResetTime(`builder:${clientId}`), 'store_owner', 'ar'),
      template: null,
    };
  }

  try {
    let prompt: string;
    if (currentSettings) {
      prompt = `Current store config:
${JSON.stringify(currentSettings, null, 2)}

User request: "${description}"

Modify ONLY the fields the user mentioned. Return the updated JSON. Keep all other values unchanged. ALWAYS return valid JSON.`;
    } else {
      prompt = `User description: "${description}"

Return the JSON config. Pick Arabic text and fitting colors. ALWAYS return valid JSON.`;
    }

    const response = await generateText('store_owner', prompt, {
      storeId: clientId,
      storeName: '',
      clientId,
      userType: 'owner',
    }, prevHistory, undefined, SYSTEM_PROMPT);

    let raw = response.trim();
    console.log('[TemplateGenerator] Raw response:', raw.slice(0, 500));

    // Strip ALL markdown code blocks
    raw = raw.replace(/```[\s\S]*?```/g, '');

    // Try to extract JSON
    let config: Record<string, string> | null = null;
    const openIdx = raw.indexOf('{');
    const closeIdx = raw.lastIndexOf('}');
    if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
      let jsonStr = raw.slice(openIdx, closeIdx + 1).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
      try {
        config = JSON.parse(jsonStr);
      } catch {
        // Try fixing common issues
        jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        try { config = JSON.parse(jsonStr); } catch { /* will use fallback */ }
      }
    }

    // Build template from parsed config or keyword fallback
    const preset = keywordPreset(description);
    const storeName = config?.storeName
      || currentSettings?.storeName
      || toPascalCase(description.split(/\s+/).slice(0, 2).join(' '))
      || 'متجر جديد';

    const template: GeneratedTemplate = {
      templateId: `ai-${storeName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
      storeName,
      description,
      settings: {
        storeName,
        primary_color: config?.primaryColor || currentSettings?.primary_color || preset.primary,
        template_accent_color: config?.accentColor || currentSettings?.template_accent_color || preset.accent,
        template_bg_color: config?.bgColor || currentSettings?.template_bg_color || preset.bg,
        template_hero_heading: config?.heroHeading || currentSettings?.template_hero_heading || preset.heading,
        template_hero_subtitle: config?.heroSubtitle || currentSettings?.template_hero_subtitle || preset.sub,
        template_button_text: config?.buttonText || currentSettings?.template_button_text || preset.btn,
      },
    };

    const answer = `تم إعداد متجر **"${storeName}"** بنجاح! 👇\n\nيمكنك المعاينة على اليسار — عدّل الألوان والتصميم في المحادثة.`;
    return { answer, template };
  } catch (err) {
    console.error(`[TemplateGenerator] Error for client ${clientId}:`, err);
    return { answer: 'حدث خطأ أثناء إعداد المتجر. حاول مرة أخرى.', template: null };
  }
}
