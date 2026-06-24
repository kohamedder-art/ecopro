/**
 * Landing Page Template Renderer
 *
 * Renders HTML templates with product data, then uses Playwright
 * to screenshot the result into a PNG image.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, 'templates');

export interface LandingPageData {
  template: 'dark' | 'teal' | 'minimal';
  product_name: string;
  product_description: string;
  product_image: string;
  product_images?: string[];
  price: string;
  currency: string;
  phone: string;
  headline: string;
  subheadline: string;
  badge_text: string;
  features_title: string;
  features: { icon: string; text: string }[];
  cta_label: string;
  cta_button: string;

  // Dark template
  hero_image?: string;
  bg_color?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  trust_items?: string[];
  footer_items?: string[];

  // Teal template
  hero_badges?: string[];
  callout_badges?: { icon: string; text: string }[];
  show_before_after?: boolean;
  before_after_title?: string;
  before_image?: string;
  after_image?: string;
  before_label?: string;
  after_label?: string;
  show_testimonials?: boolean;
  testimonials_title?: string;
  testimonials?: { quote: string; author: string }[];
  cta_guarantees?: string[];

  // Minimal template
  highlights?: { number: string; label: string }[];
  old_price?: string;
  guarantees?: { icon: string; text: string }[];
}

const DEFAULT_COLORS: Record<string, { bg: string; primary: string; secondary: string; accent: string }> = {
  dark: { bg: '#0a0e1a', primary: '#1a1f3a', secondary: '#2d1b69', accent: '#a855f7' },
  teal: { bg: '#f5f5f0', primary: '#0d7377', secondary: '#14a3a8', accent: '#14a3a8' },
  minimal: { bg: '#ffffff', primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560' },
};

function renderMustache(template: string, data: Record<string, any>): string {
  let result = template;

  // Handle {{#array}}...{{/array}} blocks
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, block) => {
    const arr = data[key];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map((item: any) => {
      if (typeof item === 'string') {
        return block.replace(/\{\{\.\}\}/g, item);
      }
      // Object item — replace {{key}} within block
      let rendered = block;
      for (const [k, v] of Object.entries(item)) {
        rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
      return rendered;
    }).join('');
  });

  // Handle simple {{key}} replacements
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' || typeof value === 'number') {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
  }

  // Clean up any remaining unreplaced placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

export function renderTemplate(data: LandingPageData): string {
  const templateFile = join(TEMPLATES_DIR, `${data.template}.html`);
  let html = readFileSync(templateFile, 'utf8');

  const colors = DEFAULT_COLORS[data.template] || DEFAULT_COLORS.dark;

  const mergedData = {
    bg_color: colors.bg,
    primary_color: colors.primary,
    secondary_color: colors.secondary,
    accent_color: colors.accent,
    hero_image: data.product_image,
    trust_items: ['توصيل سريع', 'دفع عند الاستلام', 'ضمان المنتج'],
    features_title: 'المميزات',
    cta_label: 'اطلب الآن',
    cta_button: 'اطلب عبر واتساب',
    before_label: 'قبل',
    after_label: 'بعد',
    before_after_title: 'الفرق واضح',
    testimonials_title: 'آراء عملائنا',
    currency: 'د.م.',
    phone: '',
    ...data,
  };

  return renderMustache(html, mergedData);
}

export async function screenshotTemplate(html: string, width = 1080): Promise<Buffer> {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width, height: 800 });
  await page.setContent(html, { waitUntil: 'networkidle' });

  // Wait for fonts to load
  await page.waitForTimeout(2000);

  // Get full page height
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

  await page.setViewportSize({ width, height: bodyHeight });
  await page.waitForTimeout(500);

  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'png',
  });

  await browser.close();
  return screenshot;
}
