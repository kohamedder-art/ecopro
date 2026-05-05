import type { ThemePreset } from '../../shared/theme-presets';
import { THEME_PRESETS } from '../../shared/theme-presets';
import { applyThemePresetToSchema, createDefaultSchemaContent } from '../../shared/apply-theme-preset';
import {
  createStoreSchema,
  type ProductGridNode,
  type ProductNode,
  type UniversalStoreSchema,
} from '../../shared/universal-store-schema';

export type StoreSettingsLike = {
  store_slug?: string | null;
  store_name?: string | null;
  store_description?: string | null;
  store_logo?: string | null;
  banner_url?: string | null;
  currency_code?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  template_accent_color?: string | null;
  template_hero_heading?: string | null;
  template_hero_subtitle?: string | null;
  template_button_text?: string | null;
  // Purchase/checkout settings
  show_product_title?: boolean | null;
  show_full_name?: boolean | null;
  show_phone?: boolean | null;
  show_wilaya?: boolean | null;
  show_address?: boolean | null;
  show_commune?: boolean | null;
  show_notes?: boolean | null;
  show_quantity?: boolean | null;
  payment_cash_on_delivery?: boolean | null;
  payment_credit_card?: boolean | null;
  payment_paypal?: boolean | null;
  checkout_form_bg_color?: string | null;
  checkout_form_text_color?: string | null;
  checkout_button_color?: string | null;
  checkout_button_text?: string | null;
  checkout_accent_color?: string | null;
};

export type StoreProductLike = {
  id: number | string;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  images?: string[] | null;
};

function normalizeTemplateId(input: string | null | undefined): string {
  const t = String(input || '').trim();
  const raw = t.replace(/^gold-/, '').toLowerCase();
  if (!raw) return 'pro';
  if (raw === 'shiro-hana') return 'pro';
  if (raw === 'baby' || raw === 'babyos') return 'kids';
  return raw;
}

function templateIdToPresetId(templateId: string): string {
  const t = normalizeTemplateId(templateId);
  switch (t) {
    case 'fashion':
    case 'fashion2':
    case 'fashion3':
    case 'bags':
      return 'fashion-dark';
    case 'kids':
      return 'baby-soft';
    case 'electronics':
      return 'tech-dark';
    case 'food':
    case 'cafe':
      return 'food-fresh';
    case 'jewelry':
      return 'jewelry-gold';
    case 'beauty':
    case 'perfume':
      return 'beauty-pastel';
    case 'furniture':
    case 'store':
      return 'minimal';
    default:
      return 'minimal';
  }
}

function templateIdToCategory(templateId: string): Parameters<typeof createDefaultSchemaContent>[0] {
  const t = normalizeTemplateId(templateId);
  switch (t) {
    case 'fashion':
    case 'fashion2':
    case 'fashion3':
    case 'bags':
      return 'fashion';
    case 'kids':
      return 'baby';
    case 'electronics':
      return 'electronics';
    case 'food':
    case 'cafe':
      return 'food';
    case 'jewelry':
      return 'jewelry';
    case 'beauty':
    case 'perfume':
      return 'beauty';
    case 'furniture':
    case 'store':
    default:
      return 'home';
  }
}

function findPresetById(id: string): ThemePreset {
  const preset = THEME_PRESETS.find((p) => p.id === id);
  return preset || THEME_PRESETS[0];
}

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function isValidHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

export function looksLikeUniversalStoreSchema(value: unknown): value is UniversalStoreSchema {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return (
    typeof v.schemaVersion === 'string' &&
    typeof v.version === 'number' &&
    v.layout &&
    typeof v.layout === 'object' &&
    v.meta &&
    typeof v.meta === 'object'
  );
}

export function buildUniversalSchemaFromSettingsAndProducts(
  settings: StoreSettingsLike,
  templateIdRaw: string | null | undefined,
  products: StoreProductLike[]
): UniversalStoreSchema {
  const templateId = normalizeTemplateId(templateIdRaw);
  const presetId = templateIdToPresetId(templateId);
  const preset = findPresetById(presetId);

  const storeId = String(settings.store_slug || 'store');
  const storeName = String(settings.store_name || 'My Store');

  // Start from schema defaults
  let schema = createStoreSchema(storeId, storeName, templateId);

  schema.meta = {
    ...schema.meta,
    description: String(settings.store_description || ''),
    currency: String(settings.currency_code || schema.meta.currency || 'DZD'),
    locale: schema.meta.locale || 'en-US',
  };

  // Create essential layout nodes when missing
  schema.layout = {
    ...schema.layout,
    header: {
      type: 'header',
      visible: true,
      logo: { type: 'image', assetKey: 'logo', alt: storeName || 'Store logo' },
      nav: [
        { label: { type: 'text', value: 'Home' }, action: '/' },
        { label: { type: 'text', value: 'Products' }, action: '/products' },
      ],
      sticky: true,
    },
    hero: {
      ...(schema.layout.hero || { type: 'hero', visible: true, title: { type: 'text', value: '' } }),
      ...createDefaultSchemaContent(templateIdToCategory(templateId)).hero,
      title: { type: 'text', value: String(settings.template_hero_heading || '') } as any,
      subtitle: settings.template_hero_subtitle
        ? { type: 'text', value: String(settings.template_hero_subtitle) }
        : settings.store_description
          ? { type: 'text', value: String(settings.store_description) }
          : undefined,
      image: { type: 'image', assetKey: 'hero', alt: storeName ? `${storeName} hero` : 'Hero image' },
      cta: [
        {
          label: {
            type: 'text',
            value: String(settings.template_button_text || 'Shop now'),
          },
          action: '/products',
          variant: 'primary',
        },
      ],
    },
  };

  // Add/refresh assets
  schema.assets = {
    ...(schema.assets || {}),
    ...(isValidHttpUrl(settings.store_logo)
      ? {
          logo: {
            url: settings.store_logo,
            alt: storeName ? `${storeName} logo` : 'Store logo',
          },
        }
      : {}),
    ...(isValidHttpUrl(settings.banner_url)
      ? {
          hero: {
            url: settings.banner_url,
            alt: storeName ? `${storeName} hero` : 'Hero image',
          },
        }
      : {}),
  };

  const productItems: ProductNode[] = (products || []).slice(0, 12).map((p) => ({
    id: String(p.id),
    title: { type: 'text', value: String(p.title || '') },
    description: p.description ? { type: 'text', value: String(p.description) } : undefined,
    price: toNumber(p.price),
    image: {
      type: 'image',
      assetKey: (p.images && p.images[0]) ? String(p.images[0]) : 'hero',
      alt: String(p.title || ''),
    },
    layout: {
      size: 'medium',
    },
  }));

  const grid: ProductGridNode = {
    type: 'grid',
    visible: true,
    items: productItems,
    addLabel: { type: 'text', value: 'Add' },
    columns: preset.defaults.gridColumns || 3,
    gap: preset.defaults.gridGap || 24,
    paddingY: preset.defaults.sectionSpacing || 48,
    paddingX: 24,
    card: {
      radius: preset.defaults.cardRadius || 8,
      shadow: preset.defaults.cardShadow || 'sm',
      hoverEffect: preset.defaults.hoverEffect,
      imageRatio: preset.defaults.productImageRatio,
    },
  };

  // Prefer `layout.featured` since existing renderer/editor expects it.
  (schema.layout as any).featured = grid;
  schema.layout.sections = schema.layout.sections && schema.layout.sections.length ? schema.layout.sections : [grid];

  // Apply preset styles
  schema = applyThemePresetToSchema(schema, preset);

  // Respect per-store overrides if provided
  if (settings.primary_color) schema.styles.primaryColor = String(settings.primary_color);
  if (settings.secondary_color) schema.styles.secondaryColor = String(settings.secondary_color);
  if (settings.template_accent_color) schema.styles.accentColor = String(settings.template_accent_color);

  return schema;
}
