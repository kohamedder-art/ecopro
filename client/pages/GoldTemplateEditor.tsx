import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Eye, Settings, Check, Search, X, ChevronDown } from 'lucide-react';
import { RenderStorefront, normalizeTemplateId } from './storefront/templates';
import { uploadImage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStoreProducts } from '@/hooks/useStoreProducts';

const DEFAULT_TEMPLATE_ID = 'minimal';

// Templates that are considered 100% editable + verified against TEMPLATE_EDITS_CONTRACT.
// These are the only templates shown by default in the picker.
const READY_TEMPLATE_IDS = new Set([
  'bags',
  'books',
  'wedding',
  'tools',
  'pro-atelier',
  'pro-studio',
  'amber-store',
  'rose-catalog',
  'lime-direct',
  'urgency-max',
  'papercraft',
  'minimal',
]);

// Template preview data with categories
const TEMPLATE_PREVIEWS = [
  // Original templates (updated previews)
  { id: 'bags', name: 'Bags Editorial', image: '/template-previews/bags-preview.svg', categories: ['elegant', 'industry'] },
  { id: 'jewelry', name: 'JewelryOS', image: '/template-previews/jewelry-preview.svg', categories: ['elegant', 'industry'] },
  { id: 'fashion', name: 'Fashion', image: '/template-previews/fashion-preview.svg', categories: ['popular', 'elegant'] },
  { id: 'electronics', name: 'Electronics', image: '/template-previews/electronics-preview.svg', categories: ['industry'] },
  { id: 'beauty', name: 'Beauty', image: '/template-previews/beauty-preview.svg', categories: ['colorful', 'industry'] },
  { id: 'food', name: 'Food & Restaurant', image: '/template-previews/food-preview.svg', categories: ['colorful', 'industry'] },
  { id: 'cafe', name: 'Cafe & Bakery', image: '/template-previews/cafe-preview.svg', categories: ['colorful', 'industry'] },
  { id: 'furniture', name: 'Furniture', image: '/template-previews/furniture-preview.svg', categories: ['minimal', 'industry'] },
  { id: 'perfume', name: 'Perfume', image: '/template-previews/perfume-preview.svg', categories: ['elegant', 'industry'] },
  { id: 'minimal', name: 'Minimal', image: '/template-previews/minimal.png', categories: ['popular', 'minimal'] },
  { id: 'classic', name: 'Classic', image: '/template-previews/classic.png', categories: ['elegant'] },
  { id: 'modern', name: 'Modern', image: '/template-previews/modern.png', categories: ['minimal'] },
  // New templates - Industry/Niche
  { id: 'sports', name: 'Sports & Fitness', image: '/template-previews/sports.svg', categories: ['colorful', 'industry'] },
  { id: 'books', name: 'Bookstore', image: '/template-previews/books.svg', categories: ['elegant', 'industry'] },
  { id: 'pets', name: 'Pet Supplies', image: '/template-previews/pets.svg', categories: ['colorful', 'industry'] },
  { id: 'toys', name: 'Toys & Games', image: '/template-previews/toys.svg', categories: ['colorful', 'industry'] },
  { id: 'garden', name: 'Garden & Plants', image: '/template-previews/garden.svg', categories: ['colorful', 'industry'] },
  { id: 'art', name: 'Art Gallery', image: '/template-previews/art.svg', categories: ['elegant', 'industry'] },
  { id: 'music', name: 'Music & Instruments', image: '/template-previews/music.svg', categories: ['industry'] },
  { id: 'health', name: 'Health & Pharmacy', image: '/template-previews/health.svg', categories: ['minimal', 'industry'] },
  { id: 'watches', name: 'Watches', image: '/template-previews/watches.svg', categories: ['elegant', 'industry'] },
  { id: 'shoes', name: 'Shoes & Footwear', image: '/template-previews/shoes.svg', categories: ['industry'] },
  { id: 'gaming', name: 'Gaming', image: '/template-previews/gaming.svg', categories: ['dark', 'industry'] },
  { id: 'automotive', name: 'Automotive', image: '/template-previews/automotive.svg', categories: ['dark', 'industry'] },
  { id: 'crafts', name: 'Handmade & Crafts', image: '/template-previews/crafts.svg', categories: ['colorful', 'industry'] },
  { id: 'outdoor', name: 'Outdoor & Camping', image: '/template-previews/outdoor.svg', categories: ['industry'] },
  { id: 'vintage', name: 'Vintage & Antiques', image: '/template-previews/vintage.svg', categories: ['elegant', 'industry'] },
  { id: 'tech', name: 'Tech & Gadgets', image: '/template-previews/tech.svg', categories: ['dark', 'industry'] },
  { id: 'organic', name: 'Organic & Natural', image: '/template-previews/organic.svg', categories: ['colorful', 'industry'] },
  { id: 'luxury', name: 'Luxury', image: '/template-previews/luxury.svg', categories: ['elegant', 'industry'] },
  { id: 'kids', name: 'Kids & Baby', image: '/template-previews/kids.svg', categories: ['colorful', 'industry'] },
  { id: 'travel', name: 'Travel & Luggage', image: '/template-previews/travel.svg', categories: ['industry'] },
  { id: 'photography', name: 'Photography', image: '/template-previews/photography.svg', categories: ['minimal', 'industry'] },
  { id: 'wedding', name: 'Wedding', image: '/template-previews/wedding.svg', categories: ['elegant', 'industry'] },
  { id: 'fitness', name: 'Fitness & Gym', image: '/template-previews/fitness.svg', categories: ['colorful', 'industry'] },
  { id: 'gifts', name: 'Gift Shop', image: '/template-previews/gifts.svg', categories: ['colorful', 'industry'] },
  { id: 'candles', name: 'Candles & Home Scents', image: '/template-previews/candles.svg', categories: ['elegant', 'industry'] },
  { id: 'skincare', name: 'Skincare', image: '/template-previews/skincare.svg', categories: ['minimal', 'industry'] },
  { id: 'supplements', name: 'Supplements & Vitamins', image: '/template-previews/supplements.svg', categories: ['minimal', 'industry'] },
  { id: 'phone-accessories', name: 'Phone Accessories', image: '/template-previews/phone-accessories.svg', categories: ['industry'] },
  { id: 'tools', name: 'Tools & Hardware', image: '/template-previews/tools.svg', categories: ['industry'] },
  { id: 'office', name: 'Office Supplies', image: '/template-previews/office.svg', categories: ['minimal', 'industry'] },
  { id: 'stationery', name: 'Stationery', image: '/template-previews/stationery.svg', categories: ['colorful', 'industry'] },
  // New templates - Style/Design
  { id: 'neon', name: 'Neon Cyberpunk', image: '/template-previews/neon.svg', categories: ['dark', 'colorful'] },
  { id: 'pastel', name: 'Pastel Dreams', image: '/template-previews/pastel.svg', categories: ['colorful', 'elegant'] },
  { id: 'monochrome', name: 'Monochrome', image: '/template-previews/monochrome.svg', categories: ['minimal', 'dark'] },
  { id: 'gradient', name: 'Gradient Wave', image: '/template-previews/gradient.svg', categories: ['colorful'] },
  { id: 'florist', name: 'Florist', image: '/template-previews/florist.svg', categories: ['elegant', 'industry'] },
  { id: 'eyewear', name: 'Eyewear', image: '/template-previews/eyewear.svg', categories: ['minimal', 'industry'] },
  { id: 'lingerie', name: 'Lingerie & Intimates', image: '/template-previews/lingerie.svg', categories: ['elegant', 'industry'] },
  { id: 'swimwear', name: 'Swimwear & Beach', image: '/template-previews/swimwear.svg', categories: ['colorful', 'industry'] },
  { id: 'streetwear', name: 'Streetwear', image: '/template-previews/streetwear.svg', categories: ['dark', 'industry'] },
  { id: 'wine', name: 'Wine & Spirits', image: '/template-previews/wine.svg', categories: ['elegant', 'industry'] },
  { id: 'chocolate', name: 'Chocolate & Sweets', image: '/template-previews/chocolate.svg', categories: ['colorful', 'industry'] },
  { id: 'tea', name: 'Tea & Coffee', image: '/template-previews/tea.svg', categories: ['elegant', 'industry'] },
  { id: 'pro', name: 'Pro (Professional)', image: '/template-previews/pro.svg', categories: ['popular', 'pro', 'minimal'] },
  { id: 'pro-landing', name: 'Pro Landing', image: '/template-previews/pro-landing.svg', categories: ['popular', 'pro', 'minimal', 'landing'] },
  { id: 'focus-one', name: 'Focus One', image: '/template-previews/focus-one.svg', categories: ['landing', 'popular', 'minimal'] },
  { id: 'split-specs', name: 'Split Specs', image: '/template-previews/split-specs.svg', categories: ['landing', 'minimal', 'elegant'] },
  // Pro variants (new)
  { id: 'pro-aurora', name: 'Pro Aurora', image: '/template-previews/pro-aurora.svg', categories: ['pro', 'colorful'] },
  { id: 'pro-vertex', name: 'Pro Vertex', image: '/template-previews/pro-vertex.svg', categories: ['pro', 'dark'] },
  { id: 'pro-atelier', name: 'Pro Atelier', image: '/template-previews/pro-atelier.svg', categories: ['pro', 'elegant'] },
  { id: 'pro-orbit', name: 'Pro Orbit', image: '/template-previews/pro-orbit.svg', categories: ['pro', 'dark'] },
  { id: 'pro-zen', name: 'Pro Zen', image: '/template-previews/pro-zen.svg', categories: ['pro', 'minimal'] },
  { id: 'pro-studio', name: 'Pro Studio', image: '/template-previews/pro-studio.svg', categories: ['pro', 'minimal'] },
  { id: 'pro-mosaic', name: 'Pro Mosaic', image: '/template-previews/pro-mosaic.svg', categories: ['pro', 'colorful'] },
  { id: 'pro-grid', name: 'Pro Grid', image: '/template-previews/pro-grid.svg', categories: ['pro', 'minimal'] },
  { id: 'pro-catalog', name: 'Pro Catalog', image: '/template-previews/pro-catalog.svg', categories: ['pro', 'elegant'] },
  // Screenshot-inspired templates - Batch 1 (Green/Sage)
  { id: 'sage-boutique', name: 'Sage Boutique', image: '/template-previews/sage-boutique.svg', categories: ['elegant', 'colorful'] },
  { id: 'mint-elegance', name: 'Mint Elegance', image: '/template-previews/mint-elegance.svg', categories: ['elegant', 'colorful'] },
  { id: 'forest-store', name: 'Forest Store', image: '/template-previews/forest-store.svg', categories: ['dark', 'colorful'] },
  // Screenshot-inspired templates - Batch 2 (Orange/Coral)
  { id: 'sunset-shop', name: 'Sunset Shop', image: '/template-previews/sunset-shop.svg', categories: ['colorful', 'minimal'] },
  { id: 'coral-market', name: 'Coral Market', image: '/template-previews/coral-market.svg', categories: ['colorful'] },
  { id: 'amber-store', name: 'Amber Store', image: '/template-previews/amber-store.svg', categories: ['elegant', 'colorful'] },
  // Screenshot-inspired templates - Batch 3 (Magenta/Pink)
  { id: 'magenta-mall', name: 'Magenta Mall', image: '/template-previews/magenta-mall.svg', categories: ['colorful'] },
  { id: 'berry-market', name: 'Berry Market', image: '/template-previews/berry-market.svg', categories: ['colorful'] },
  { id: 'rose-catalog', name: 'Rose Catalog', image: '/template-previews/rose-catalog.svg', categories: ['colorful', 'elegant'] },
  // Screenshot-inspired templates - Batch 4 (Lime/Green)
  { id: 'lime-direct', name: 'Lime Direct', image: '/template-previews/lime-direct.svg', categories: ['colorful', 'minimal', 'landing'] },
  { id: 'emerald-shop', name: 'Emerald Shop', image: '/template-previews/emerald-shop.svg', categories: ['colorful', 'elegant'] },
  { id: 'neon-store', name: 'Neon Store', image: '/template-previews/neon-store.svg', categories: ['dark', 'colorful'] },
  // Screenshot-inspired templates - Batch 5 (Clean/Minimal)
  { id: 'clean-single', name: 'Clean Single', image: '/template-previews/clean-single.svg', categories: ['minimal', 'popular', 'landing'] },
  { id: 'pure-product', name: 'Pure Product', image: '/template-previews/pure-product.svg', categories: ['minimal', 'landing'] },
  { id: 'snow-shop', name: 'Snow Shop', image: '/template-previews/snow-shop.svg', categories: ['minimal'] },
  // Screenshot-inspired templates - Batch 6 (Gallery)
  { id: 'gallery-pro', name: 'Gallery Pro', image: '/template-previews/gallery-pro.svg', categories: ['minimal', 'elegant', 'landing'] },
  { id: 'showcase-plus', name: 'Showcase Plus', image: '/template-previews/showcase-plus.svg', categories: ['colorful', 'landing'] },
  { id: 'exhibit-store', name: 'Exhibit Store', image: '/template-previews/exhibit-store.svg', categories: ['elegant', 'minimal', 'landing'] },

  // New Gold templates (2026 expansion)
  { id: 'ocean-splash', name: 'Ocean Splash', image: '/template-previews/ocean-splash.svg', categories: ['colorful', 'elegant'] },
  { id: 'noir-eclipse', name: 'Noir Eclipse', image: '/template-previews/noir-eclipse.svg', categories: ['dark', 'elegant'] },
  { id: 'terra-market', name: 'Terra Market', image: '/template-previews/terra-market.svg', categories: ['colorful', 'industry'] },
  { id: 'pixel-pop', name: 'Pixel Pop', image: '/template-previews/pixel-pop.svg', categories: ['colorful'] },
  { id: 'zen-grove', name: 'Zen Grove', image: '/template-previews/zen-grove.svg', categories: ['minimal', 'elegant'] },
  { id: 'skyline-editorial', name: 'Skyline Editorial', image: '/template-previews/skyline-editorial.svg', categories: ['minimal', 'elegant'] },
  { id: 'copper-craft', name: 'Copper Craft', image: '/template-previews/copper-craft.svg', categories: ['elegant', 'industry'] },
  { id: 'violet-vault', name: 'Violet Vault', image: '/template-previews/violet-vault.svg', categories: ['dark', 'colorful'] },
  { id: 'chalk-cafe', name: 'Chalk Cafe', image: '/template-previews/chalk-cafe.svg', categories: ['colorful', 'industry'] },
  { id: 'sunbeam', name: 'Sunbeam', image: '/template-previews/sunbeam.svg', categories: ['colorful'] },
  { id: 'ice-glass', name: 'Ice Glass', image: '/template-previews/ice-glass.svg', categories: ['minimal'] },
  { id: 'paperfold', name: 'Paperfold', image: '/template-previews/paperfold.svg', categories: ['minimal'] },
  { id: 'orbit-mart', name: 'Orbit Mart', image: '/template-previews/orbit-mart.svg', categories: ['dark', 'industry'] },
  { id: 'royal-boutique', name: 'Royal Boutique', image: '/template-previews/royal-boutique.svg', categories: ['elegant', 'dark'] },
  { id: 'mono-press', name: 'Mono Press', image: '/template-previews/mono-press.svg', categories: ['minimal'] },
  { id: 'citrus-bloom', name: 'Citrus Bloom', image: '/template-previews/citrus-bloom.svg', categories: ['colorful'] },
  { id: 'harbor-ledger', name: 'Harbor Ledger', image: '/template-previews/harbor-ledger.svg', categories: ['minimal'] },

  // Landing Page Templates (unique designs with embedded checkout)
  { id: 'trust-pulse', name: 'Trust Pulse', image: '/template-previews/trust-pulse.svg', categories: ['landing', 'popular', 'colorful'] },
  { id: 'social-proof', name: 'Social Proof', image: '/template-previews/social-proof.svg', categories: ['landing', 'colorful'] },
  { id: 'authority-pro', name: 'Authority Pro', image: '/template-previews/authority-pro.svg', categories: ['landing', 'dark', 'elegant'] },
  { id: 'guarantee-focus', name: 'Guarantee Focus', image: '/template-previews/guarantee-focus.svg', categories: ['landing', 'colorful'] },
  { id: 'video-sales', name: 'Video Sales', image: '/template-previews/video-sales.svg', categories: ['landing', 'dark'] },
  { id: 'lifestyle-story', name: 'Lifestyle Story', image: '/template-previews/lifestyle-story.svg', categories: ['landing', 'elegant', 'colorful'] },
  { id: 'before-after', name: 'Before & After', image: '/template-previews/before-after.svg', categories: ['landing', 'colorful'] },
  { id: 'cinematic-hero', name: 'Cinematic Hero', image: '/template-previews/cinematic-hero.svg', categories: ['landing', 'dark', 'elegant'] },
  { id: 'magazine-style', name: 'Magazine Style', image: '/template-previews/magazine-style.svg', categories: ['landing', 'elegant', 'minimal'] },
  { id: 'polaroid-memory', name: 'Polaroid Memory', image: '/template-previews/polaroid-memory.svg', categories: ['landing', 'colorful'] },
  { id: 'urgency-max', name: 'Urgency Max', image: '/template-previews/urgency-max.svg', categories: ['landing', 'colorful', 'popular'] },
  { id: 'bundle-builder', name: 'Bundle Builder', image: '/template-previews/bundle-builder.svg', categories: ['landing', 'colorful'] },
  { id: 'quiz-funnel', name: 'Quiz Funnel', image: '/template-previews/quiz-funnel.svg', categories: ['landing', 'colorful'] },
  { id: 'comparison-table', name: 'Comparison Table', image: '/template-previews/comparison-table.svg', categories: ['landing', 'minimal'] },
  { id: 'flash-deal', name: 'Flash Deal', image: '/template-previews/flash-deal.svg', categories: ['landing', 'colorful', 'popular'] },
  { id: 'neon-pulse', name: 'Neon Pulse', image: '/template-previews/neon-pulse.svg', categories: ['landing', 'dark', 'colorful'] },
  { id: 'glassmorphism', name: 'Glassmorphism', image: '/template-previews/glassmorphism.svg', categories: ['landing', 'colorful', 'elegant'] },
  { id: 'brutalist-raw', name: 'Brutalist Raw', image: '/template-previews/brutalist-raw.svg', categories: ['landing', 'dark', 'minimal'] },
  { id: 'retrowave', name: 'Retrowave', image: '/template-previews/retrowave.svg', categories: ['landing', 'dark', 'colorful'] },
  { id: 'papercraft', name: 'Papercraft', image: '/template-previews/papercraft.svg', categories: ['landing', 'colorful', 'elegant'] },
];

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: '🎨' },
  { id: 'popular', name: 'Popular', icon: '⭐' },
  { id: 'landing', name: 'Landing Pages', icon: '📄' },
  { id: 'minimal', name: 'Minimal & Clean', icon: '✨' },
  { id: 'colorful', name: 'Colorful', icon: '🌈' },
  { id: 'dark', name: 'Dark Mode', icon: '🌙' },
  { id: 'elegant', name: 'Elegant', icon: '💎' },
  { id: 'industry', name: 'Industry Specific', icon: '🏪' },
  { id: 'pro', name: 'Pro Series', icon: '🚀' },
];

// Default settings for each template - used for reset functionality
// Keys that should be reset when switching/resetting templates
const TEMPLATE_SETTING_KEYS = [
  'template_bg_color',
  'template_text_color', 
  'template_muted_color',
  'template_accent_color',
  'template_hero_heading',
  'template_hero_subtitle',
  'template_button_text',
  'template_description_text',
  'template_description_color',
  'template_description_size',
  'template_description_weight',
  'template_description_style',
] as const;

// When resetting, we clear these values so templates use their built-in defaults
const getTemplateDefaults = (): Partial<StoreSettings> => {
  const defaults: Partial<StoreSettings> = {};
  TEMPLATE_SETTING_KEYS.forEach(key => {
    defaults[key] = null; // null = use template's built-in default
  });
  return defaults;
};

type StoreSettings = {
  [key: string]: any;
  store_slug?: string;
  store_name?: string;
  store_description?: string;
  store_logo?: string;
  banner_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  currency_code?: string;
  template?: string;
  template_hero_heading?: string | null;
  template_hero_subtitle?: string | null;
  template_button_text?: string | null;
  template_accent_color?: string | null;
};

type StoreProduct = {
  id: number;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  category?: string;
  stock_quantity: number;
  is_featured: boolean;
  slug: string;
  views: number;
};

export default function GoldTemplateEditor() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const previewRootRef = React.useRef<HTMLDivElement | null>(null);
  const previewFitRef = React.useRef<HTMLDivElement | null>(null);
  const previewIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const previewIframeRootRef = React.useRef<ReturnType<typeof createRoot> | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'settings'>('preview');

  const {
    data: storeSettingsData,
    isLoading: settingsLoading,
    error: storeSettingsError,
  } = useStoreSettings({
    onUnauthorized: () => navigate('/login'),
  });

  const {
    data: storeProductsData,
    isLoading: productsLoading,
    error: storeProductsError,
  } = useStoreProducts({
    onUnauthorized: () => navigate('/login'),
  });

  const loading = settingsLoading || productsLoading;

  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    // Auto-detect: on mobile devices, show mobile preview by default
    if (window.innerWidth < 640) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  });
  const [selectedEditPath, setSelectedEditPath] = useState<string | null>(null);
  const [mobileEditPanelOpen, setMobileEditPanelOpen] = useState(false);

  // Auto-open mobile edit panel when element is selected (only on mobile)
  useEffect(() => {
    if (selectedEditPath && window.innerWidth < 1024) {
      setMobileEditPanelOpen(true);
    }
  }, [selectedEditPath]);

  const handleSelectEditPath = useCallback((path: string) => {
    setSelectedEditPath(path);
  }, []);

  const IFRAME_SRC_DOC = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8" /></head><body style="margin:0"><div id="ecopro-iframe-root"></div></body></html>`,
    []
  );

  const syncIframeHead = useCallback((doc: Document) => {
    // Copy over styles so Tailwind/media queries work inside the iframe.
    const head = doc.head;
    // Remove any previous copied styles (but keep meta/charset).
    Array.from(head.querySelectorAll('style[data-ecopro],link[data-ecopro]')).forEach((n) => n.remove());

    const parentNodes = Array.from(document.head.querySelectorAll('link[rel="stylesheet"],style'));
    parentNodes.forEach((node) => {
      if (node.tagName === 'LINK') {
        const link = node as HTMLLinkElement;
        if (!link.href) return;
        const clone = doc.createElement('link');
        clone.rel = 'stylesheet';
        clone.href = link.href;
        clone.setAttribute('data-ecopro', '1');
        head.appendChild(clone);
        return;
      }
      const style = node as HTMLStyleElement;
      if (!style.textContent) return;
      const clone = doc.createElement('style');
      clone.textContent = style.textContent;
      clone.setAttribute('data-ecopro', '1');
      head.appendChild(clone);
    });

    // Match RTL/LTR directionality.
    doc.documentElement.lang = document.documentElement.lang || 'en';
    doc.documentElement.dir = document.documentElement.dir || 'ltr';
  }, []);

  // Reset iframe state when switching preview mode.
  useEffect(() => {
    if (previewDevice === 'desktop') {
      setIframeReady(false);
      previewIframeRootRef.current = null;
    }
  }, [previewDevice]);

  // Template picker (header)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const autoExpandedForLegacyTemplateRef = React.useRef(false);

  const currentTemplateIsReady = useMemo(() => {
    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    return READY_TEMPLATE_IDS.has(normalized);
  }, [settings.template]);

  // If this store is already on a non-ready template, automatically expand so the
  // current selection is still reachable from the picker.
  useEffect(() => {
    if (loading) return;
    if (autoExpandedForLegacyTemplateRef.current) return;

    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    if (!READY_TEMPLATE_IDS.has(normalized)) {
      setShowAllTemplates(true);
      autoExpandedForLegacyTemplateRef.current = true;
    }
  }, [loading, settings.template]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const base = showAllTemplates
      ? TEMPLATE_PREVIEWS
      : TEMPLATE_PREVIEWS.filter((tpl) => READY_TEMPLATE_IDS.has(tpl.id));

    return base.filter((tpl) => {
      const searchMatch = !q || tpl.name.toLowerCase().includes(q) || tpl.id.toLowerCase().includes(q);
      const categoryMatch = templateCategory === 'all' || (tpl.categories && tpl.categories.includes(templateCategory));
      return searchMatch && categoryMatch;
    });
  }, [templateSearch, templateCategory, showAllTemplates]);

  const effectiveTemplateId = useMemo(() => {
    const normalized = normalizeTemplateId(String(settings.template || DEFAULT_TEMPLATE_ID));
    const allowed = TEMPLATE_PREVIEWS.some((t) => t.id === normalized);
    return allowed ? normalized : DEFAULT_TEMPLATE_ID;
  }, [settings.template]);

  // Preview-only selection (does not save until user clicks "Use template")
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const activeTemplateId = previewTemplateId ? normalizeTemplateId(previewTemplateId) : effectiveTemplateId;
  const isPreviewingDifferentTemplate = Boolean(previewTemplateId && normalizeTemplateId(previewTemplateId) !== effectiveTemplateId);

  // If an old/removed template is present in settings, switch locally to a valid one.
  useEffect(() => {
    if (loading) return;
    setSettings((prev) => {
      const normalized = normalizeTemplateId(String(prev.template || DEFAULT_TEMPLATE_ID));
      const allowed = TEMPLATE_PREVIEWS.some((t) => t.id === normalized);
      if (allowed) return prev;
      return { ...prev, template: DEFAULT_TEMPLATE_ID };
    });
  }, [loading]);

  // Load store data
  useEffect(() => {
    if (storeSettingsData) setSettings(storeSettingsData);
  }, [storeSettingsData]);

  useEffect(() => {
    if (Array.isArray(storeProductsData)) setProducts(storeProductsData);
  }, [storeProductsData]);

  useEffect(() => {
    if (storeSettingsError && !error) {
      const message = storeSettingsError instanceof Error ? storeSettingsError.message : 'Failed to load store settings';
      setError(message);
    }
  }, [storeSettingsError, error]);

  useEffect(() => {
    if (storeProductsError && !error) {
      const message = storeProductsError instanceof Error ? storeProductsError.message : 'Failed to load products';
      setError(message);
    }
  }, [storeProductsError, error]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Handle template change - reset template-specific settings when switching and auto-save
  const handleTemplateChange = async (newTemplateId: string) => {
    const currentTemplate = normalizeTemplateId(settings.template || DEFAULT_TEMPLATE_ID);
    const nextTemplate = normalizeTemplateId(newTemplateId);
    if (nextTemplate === currentTemplate) {
      setPreviewTemplateId(null);
      return;
    }

    // Use fast template-only endpoint (now supports per-template snapshots).
    setSaving(true);
    try {
      const res = await fetch('/api/client/store/template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ template: nextTemplate, mode: 'import' }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : t('editor.saveFailed'));
      }

      const savedData = await res.json().catch(() => ({} as any));

      // If backend is running in dev fallback mode (DB unavailable), don't pretend it saved.
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }

      // Server returns the merged settings for the selected template snapshot.
      setSelectedEditPath(null);
      setPreviewTemplateId(null);
      setSettings(savedData || { template: nextTemplate });
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      setSuccess(t('editor.templateChanged', { name: nextTemplate }) || `Template changed to ${nextTemplate}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save template change');
    } finally {
      setSaving(false);
    }
  };

  // Reset current template to its defaults
  const handleResetTemplate = async () => {
    if (!confirm('Reset this template to its original layout and settings? This only affects the currently selected template.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/client/store/template', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ template: effectiveTemplateId, mode: 'defaults' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to reset template');
      }

      const savedData = await res.json().catch(() => ({} as any));
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }

      setSelectedEditPath(null);
      setPreviewTemplateId(null);
      setSettings(savedData || { template: effectiveTemplateId });
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      setSuccess('Template reset to defaults');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset template');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && (data.error || data.message)) ? String(data.error || data.message) : t('editor.saveFailed'));
      }

      // Update local settings with response from server to ensure consistency
      const savedData = await res.json().catch(() => ({} as any));

      // If backend is running in dev fallback mode (DB unavailable), don't pretend it saved.
      if (savedData && (savedData as any).__dbUnavailable) {
        throw new Error('Database unavailable. Changes were not saved.');
      }
      setSettings(savedData);
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      
      setSuccess(t('editor.saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (key: string, file: File) => {
    try {
      const result = await uploadImage(file);
      handleSettingChange(key, result.url);
    } catch (err) {
      setError('Failed to upload image');
    }
  };

  const handlePreviewClickCapture = useCallback((e: React.MouseEvent) => {
    // If the template picker is open, any click in the preview should hide it
    // so users can focus on selecting/editing elements inside the phone.
    setTemplatePickerOpen(false);

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const root = previewRootRef.current;
    const el = target.closest('[data-edit-path]') as HTMLElement | null;
    if (!el) return;
    if (root && !root.contains(el)) return;

    const path = el.getAttribute('data-edit-path');
    if (!path) return;

    e.preventDefault();
    e.stopPropagation();
    handleSelectEditPath(path);
  }, [handleSelectEditPath]);

  // Close the template picker if the user switches away from Preview.
  useEffect(() => {
    if (activeTab !== 'preview') setTemplatePickerOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const escapeCss = (value: string) => {
      const cssAny = (globalThis as any).CSS;
      if (cssAny && typeof cssAny.escape === 'function') return cssAny.escape(value);
      return value.replace(/[^a-zA-Z0-9_\-]/g, (m) => `\\${m}`);
    };

    const clearAndSelect = (root: ParentNode | null) => {
      if (!root) return;
      const prev = root.querySelector('[data-edit-selected="true"]') as HTMLElement | null;
      if (prev) prev.removeAttribute('data-edit-selected');
      if (!selectedEditPath) return;
      const selected = root.querySelector(`[data-edit-path="${escapeCss(selectedEditPath)}"]`) as HTMLElement | null;
      if (selected) {
        selected.setAttribute('data-edit-selected', 'true');
        try {
          selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch {
          // ignore
        }
      }
    };

    if (previewDevice === 'desktop') {
      clearAndSelect(previewRootRef.current);
      return;
    }

    const doc = previewIframeRef.current?.contentDocument;
    clearAndSelect(doc);
  }, [selectedEditPath]);

  const previewGridCols = useMemo(() => {
    // Use minmax(0, ...) so wide preview content can't force horizontal overflow.
    if (previewDevice === 'desktop') return 'lg:grid-cols-[minmax(0,1fr),460px]';
    if (previewDevice === 'tablet') return 'lg:grid-cols-[minmax(0,620px),minmax(0,1fr)]';
    return 'lg:grid-cols-[minmax(0,420px),minmax(0,1fr)]';
  }, [previewDevice]);

  useEffect(() => {
    const root = previewDevice === 'desktop' ? previewRootRef.current : previewIframeRef.current?.contentDocument;
    if (!root) return;

    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement | null;
      if (!img) return;
      if (img.src === '/placeholder.png') return; // Already fallback, don't loop
      // Silently replace broken image with placeholder without logging
      img.src = '/placeholder.png';
    };

    const handleVideoError = (e: Event) => {
      const video = e.target as HTMLVideoElement | null;
      if (!video) return;
      // Hide broken video elements
      video.style.display = 'none';
    };

    // Add error handlers to all current images
    const images = (root as any).querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    images.forEach((img) => img.addEventListener('error', handleImageError));

    const videos = (root as any).querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
    videos.forEach((video) => video.addEventListener('error', handleVideoError));

    return () => {
      images.forEach((img) => img.removeEventListener('error', handleImageError));
      videos.forEach((video) => video.removeEventListener('error', handleVideoError));
    };
  }, [selectedEditPath, settings, products]);

  const formatPrice = useCallback(
    (price: number) => {
      const currency = settings.currency_code || 'DZD';
      return `${price.toLocaleString()} ${currency}`;
    },
    [settings.currency_code]
  );

  // Template preview props
  const templateProps = useMemo(
    () => ({
      storeSlug: settings.store_slug || 'preview',
      settings: {
        ...settings,
        ...(isPreviewingDifferentTemplate ? getTemplateDefaults() : null),
        template: activeTemplateId,
      },
      products,
      filtered: products,
      categories: [...new Set(products.map((p) => p.category).filter(Boolean))] as string[],
      searchQuery: '',
      setSearchQuery: () => {},
      categoryFilter: '',
      setCategoryFilter: () => {},
      sortOption: 'featured' as const,
      setSortOption: () => {},
      viewMode: 'grid' as const,
      setViewMode: () => {},
      formatPrice,
      primaryColor: settings.template_accent_color || settings.primary_color || '#1E90FF',
      secondaryColor: settings.secondary_color || '#6B7280',
      bannerUrl: settings.banner_url || null,
      navigate: (to: string | number) => { if (typeof to === 'string') navigate(to); },
      canManage: true,
      forcedBreakpoint: previewDevice,
      onSelect: handleSelectEditPath,
    }),
    [settings, products, formatPrice, navigate, previewDevice, activeTemplateId, isPreviewingDifferentTemplate, handleSelectEditPath]
  );

  const selectedTemplateId = useMemo(() => normalizeTemplateId(String(activeTemplateId)), [activeTemplateId]);

  // Render storefront into an iframe for mobile/tablet so CSS breakpoints match the simulated device width.
  useEffect(() => {
    if (previewDevice === 'desktop') return;
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc || !iframeReady) return;

    try {
      syncIframeHead(doc);
    } catch {
      // ignore
    }

    const mount = doc.getElementById('ecopro-iframe-root');
    if (!mount) return;

    if (!previewIframeRootRef.current) {
      previewIframeRootRef.current = createRoot(mount);
    }

    previewIframeRootRef.current.render(
      <div>
        <style>{`[data-edit-selected="true"]{outline:2px solid hsl(var(--primary)); outline-offset:2px;}`}</style>
        {RenderStorefront(selectedTemplateId, templateProps as any)}
      </div>
    );
  }, [iframeReady, previewDevice, selectedTemplateId, templateProps, syncIframeHead]);

  // Click-to-edit inside iframe (capture phase) so templates don't need special wiring.
  // Also handle touch events for mobile devices
  useEffect(() => {
    if (previewDevice === 'desktop') return;
    const doc = previewIframeRef.current?.contentDocument;
    if (!doc || !iframeReady) return;

    const handleEditPath = (target: HTMLElement | null) => {
      setTemplatePickerOpen(false);
      if (!target) return;
      const el = target.closest('[data-edit-path]') as HTMLElement | null;
      if (!el) return;
      const path = el.getAttribute('data-edit-path');
      if (!path) return;
      handleSelectEditPath(path);
    };

    const onClickCapture = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleEditPath(e.target as HTMLElement | null);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleEditPath(e.target as HTMLElement | null);
    };

    doc.addEventListener('click', onClickCapture, true);
    doc.addEventListener('touchend', onTouchEnd, true);
    return () => {
      doc.removeEventListener('click', onClickCapture, true);
      doc.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [iframeReady, previewDevice, handleSelectEditPath]);

  // Touch event handler for desktop preview mode on real mobile devices
  // Click events are handled by onClickCapture in JSX, but touch needs native listener
  useEffect(() => {
    if (previewDevice !== 'desktop') return;
    const root = previewRootRef.current;
    if (!root) return;

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest('[data-edit-path]') as HTMLElement | null;
      if (el) {
        const path = el.getAttribute('data-edit-path');
        if (path) {
          e.preventDefault();
          e.stopPropagation();
          setTemplatePickerOpen(false);
          handleSelectEditPath(path);
        }
      }
    };

    root.addEventListener('touchend', onTouchEnd, true);
    return () => {
      root.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [previewDevice, handleSelectEditPath]);

  const deviceFrame = useMemo(() => {
    if (previewDevice === 'mobile') {
      // Samsung Galaxy S24 Ultra scaled to 80%: 330x732
      return { width: '330px', maxWidth: '330px', height: '732px', aspectRatio: '330/732' } as const;
    }
    if (previewDevice === 'tablet') {
      // iPad Pro 11" scaled to 65%: 542x776
      return { width: '542px', maxWidth: '542px', height: '776px', aspectRatio: '542/776' } as const;
    }
    // Desktop: cap width so the editor panels stay usable; height is controlled by layout.
    return { width: '100%', maxWidth: '1100px', height: '100%', aspectRatio: 'auto' } as const;
  }, [previewDevice]);

  const baseDeviceOuter = useMemo(() => {
    if (previewDevice === 'mobile') {
      // Outer container is 342px wide and has 6px padding around a 732px screen.
      return { width: 342, height: 732 + 12 };
    }
    if (previewDevice === 'tablet') {
      // Outer container is 562px wide; includes 12px vertical padding and a small camera area.
      return { width: 562, height: 776 + 24 + 20 };
    }
    // Desktop uses fluid width; scaling is unnecessary.
    return { width: 0, height: 0 };
  }, [previewDevice]);

  const [deviceScale, setDeviceScale] = useState(1);

  useLayoutEffect(() => {
    const host = previewFitRef.current;
    if (!host) return;

    const compute = () => {
      if (previewDevice === 'desktop') {
        setDeviceScale(1);
        return;
      }
      const rect = host.getBoundingClientRect();
      const availW = Math.max(1, rect.width);
      // Fit to visible viewport, but keep a small bottom buffer.
      const availH = Math.max(1, window.innerHeight - rect.top - 12);
      const baseW = baseDeviceOuter.width || 1;
      const baseH = baseDeviceOuter.height || 1;

      // Allow scaling up more so the device fills the available space.
      const maxScale = previewDevice === 'mobile' ? 3.0 : 2.35;
      const s = Math.min(availW / baseW, availH / baseH, maxScale);
      const clamped = Math.max(0.25, Math.min(maxScale, s));
      setDeviceScale(clamped);
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(host);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [previewDevice, baseDeviceOuter.width, baseDeviceOuter.height]);

  useEffect(() => {
    if (!templatePickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTemplatePickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [templatePickerOpen]);

  const editPanel = useMemo(() => {
    const path = selectedEditPath;
    if (!path) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{t('editor.edit')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('editor.clickToEdit')}
            </div>
          </CardContent>
        </Card>
      );
    }

    const bindText = (label: string, key: keyof StoreSettings, placeholder?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <Input
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(String(key), e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );

    const bindImage = (label: string, key: keyof StoreSettings) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-3">
          {(settings as any)[key] ? (
            <img src={String((settings as any)[key])} alt={label} className="h-14 w-auto rounded" />
          ) : null}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageUpload(String(key), file);
            }}
          />
        </div>
      </div>
    );

    const bindColor = (label: string, key: keyof StoreSettings, fallback: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String((settings as any)[key] || fallback)}
            onChange={(e) => handleSettingChange(String(key), e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <Input
            value={String((settings as any)[key] || fallback)}
            onChange={(e) => handleSettingChange(String(key), e.target.value)}
          />
        </div>
      </div>
    );

    const bindSelect = (label: string, key: string, options: { value: string; label: string }[], fallback: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <select
          value={String((settings as any)[key] || fallback)}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );

    const bindRange = (label: string, key: string, min: number, max: number, fallback: number, unit?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}: {(settings as any)[key] || fallback}{unit || ''}</div>
        <input
          type="range"
          min={min}
          max={max}
          value={Number((settings as any)[key]) || fallback}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          className="w-full"
        />
      </div>
    );

    const bindTextarea = (label: string, key: string, placeholder?: string, rows?: number) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <textarea
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          placeholder={placeholder}
          rows={rows || 4}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono text-xs"
        />
      </div>
    );

    const bindJsonArray = (label: string, key: string, placeholder?: string) => (
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <textarea
          value={String((settings as any)[key] || '')}
          onChange={(e) => handleSettingChange(key, e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 border rounded-md bg-background text-foreground font-mono text-xs"
        />
        <div className="text-xs text-muted-foreground">{t('editor.jsonRequired')}</div>
      </div>
    );

    let body: React.ReactNode = (
      <div className="text-sm text-muted-foreground">
        {t('editor.notEditable')}
      </div>
    );

    if (path === '__settings.store_name') {
      body = bindText('Store Name', 'store_name', 'Your Store Name');
    } else if (path.startsWith('layout.header.logo') || path === 'layout.header') {
      body = (
        <div className="space-y-4">
          {bindImage('Store Logo', 'store_logo')}
          {bindText('Store Name', 'store_name', 'Your Store Name')}
          {bindColor('Header Background', 'template_header_bg' as any, '#FDF8F3')}
          {bindColor('Header Text Color', 'template_header_text' as any, '#F97316')}
        </div>
      );
    } else if (path.startsWith('layout.hero.title')) {
      if (activeTemplateId === 'urgency-max') {
        body = bindText('Hero Title', 'template_hero_heading', 'Main headline');
      } else {
        body = (
          <div className="space-y-4">
            {bindText('Hero Heading', 'template_hero_heading', 'Main headline for your store')}
            {bindColor('Heading Color', 'template_hero_title_color' as any, '#1C1917')}
            {bindText('Heading Size (px)', 'template_hero_title_size' as any, '32')}
          </div>
        );
      }
    } else if (path.startsWith('layout.hero.subtitle')) {
      if (activeTemplateId === 'urgency-max') {
        body = bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle text');
      } else {
        body = (
          <div className="space-y-4">
            {bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle or tagline')}
            {bindColor('Subtitle Color', 'template_hero_subtitle_color' as any, '#78716C')}
            {bindText('Subtitle Size (px)', 'template_hero_subtitle_size' as any, '13')}
          </div>
        );
      }
    } else if (path.startsWith('layout.hero.kicker')) {
      body = (
        <div className="space-y-4">
          {bindText('Kicker Text', 'template_hero_kicker' as any, 'NEW SEASON • SOFT & PLAYFUL')}
          {bindColor('Kicker Color', 'template_hero_kicker_color' as any, '#78716C')}
        </div>
      );
    } else if (path.startsWith('layout.hero.cta')) {
      body = (
        <div className="space-y-4">
          {bindText('Primary Button Text', 'template_button_text', 'Shop Now')}
          {bindText('Secondary Button Text', 'template_button2_text' as any, 'View All')}
          {bindColor('Primary Button Color', 'template_accent_color', '#F97316')}
          {bindColor('Secondary Button Border', 'template_button2_border' as any, '#D6D3D1')}
        </div>
      );
    } else if (path.startsWith('layout.hero.image')) {
      body = (
        <div className="space-y-4">
          {bindImage('Hero Image (Banner)', 'banner_url')}
          {bindText('Hero Video URL (optional)', 'hero_video_url' as any, 'https://...')}
        </div>
      );
    } else if (path.startsWith('layout.hero.badge')) {
      if (activeTemplateId === 'papercraft') {
        body = (
          <div className="space-y-4">
            {bindTextarea('Testimonial Text', 'template_testimonial_text' as any, '"Amazing product..."', 4)}
            {bindText('Testimonial Author', 'template_testimonial_author' as any, '— Sarah M.')}
          </div>
        );
      } else if (activeTemplateId === 'urgency-max') {
        body = (
          <div className="space-y-4">
            {bindText('Urgency Bar Text', 'template_hero_kicker' as any, '🔥 SELLING FAST')}
            {bindText('Urgency Bar Warning', 'template_warning_text' as any, '⚠️ Price increases when timer ends!')}
          </div>
        );
      } else {
        body = (
          <div className="space-y-4">
            {bindText('Badge Title', 'template_hero_badge_title' as any, 'Soft Plush Elephant')}
            {bindText('Badge Subtitle', 'template_hero_badge_subtitle' as any, 'Limited offer')}
            {bindColor('Badge Accent', 'template_accent_color', '#F97316')}
          </div>
        );
      }
    } else if (path === 'layout.hero') {
      body = (
        <div className="space-y-4">
          {bindImage('Hero Image', 'banner_url')}
          {bindText('Hero Heading', 'template_hero_heading', 'Main headline')}
          {bindText('Hero Subtitle', 'template_hero_subtitle', 'Subtitle')}
          {bindColor('Background Color', 'template_bg_color' as any, '#FDF8F3')}
          {bindColor('Accent Color', 'template_accent_color', '#F97316')}
        </div>
      );
    } else if (path.startsWith('layout.checkout.')) {
      body = (
        <div className="space-y-4">
          {bindText('Checkout Title', 'template_checkout_title' as any, 'Your Order')}
          {bindText('Checkout Subheading', 'template_checkout_subheading' as any, 'Secure checkout subheading')}
        </div>
      );
    } else if (path.startsWith('layout.featured.title')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Title', 'template_featured_title' as any, 'Soft & snugly picks')}
          {bindColor('Title Color', 'template_section_title_color' as any, '#1C1917')}
          {bindText('Title Size (px)', 'template_section_title_size' as any, '20')}
        </div>
      );
    } else if (path.startsWith('layout.featured.subtitle')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Subtitle', 'template_featured_subtitle' as any, 'A small edit of plush toys...')}
          {bindColor('Subtitle Color', 'template_section_subtitle_color' as any, '#78716C')}
        </div>
      );
    } else if (path === 'layout.products' || path.startsWith('layout.products.')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Product details are managed in your product list.
          </div>
          {bindColor('Product Card Background', 'template_card_bg' as any, '#FFFFFF')}
          {bindColor('Product Tag Color', 'template_accent_color', '#F97316')}
          {bindColor('Product Title Color', 'template_product_title_color' as any, '#1C1917')}
          {bindColor('Product Price Color', 'template_product_price_color' as any, '#1C1917')}
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Edit Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.featured.items')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Product details are managed in your product list.
          </div>
          {bindColor('Product Card Background', 'template_card_bg' as any, '#FFFFFF')}
          {bindColor('Product Tag Color', 'template_accent_color', '#F97316')}
          {bindColor('Product Title Color', 'template_product_title_color' as any, '#1C1917')}
          {bindColor('Product Price Color', 'template_product_price_color' as any, '#1C1917')}
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Edit Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.featured.addLabel')) {
      body = (
        <div className="space-y-4">
          {bindText('Add Button Label', 'template_add_to_cart_label' as any, 'Add')}
          <div className="text-xs text-muted-foreground">
            This label is used on product cards (e.g., Add/View).
          </div>
        </div>
      );
    } else if (path.startsWith('layout.featured')) {
      body = (
        <div className="space-y-4">
          {bindText('Section Title', 'template_featured_title' as any, 'Soft & snugly picks')}
          {bindText('Section Subtitle', 'template_featured_subtitle' as any, 'Description text...')}
          {bindColor('Section Background', 'template_bg_color' as any, '#FDF8F3')}
          <div className="text-sm text-muted-foreground">
            Products are generated from your product list.
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/store')}>Go to Products</Button>
        </div>
      );
    } else if (path.startsWith('layout.footer.copyright')) {
      body = (
        <div className="space-y-4">
          {bindText('Copyright Text', 'template_copyright' as any, '© 2026 Your Store')}
          {bindColor('Footer Text Color', 'template_footer_text' as any, '#A8A29E')}
        </div>
      );
    } else if (path.startsWith('layout.footer.social')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Add social media links in JSON format.
          </div>
          {bindJsonArray('Social Links', 'template_social_links', '[{"platform":"facebook","url":"https://facebook.com/..."},{"platform":"instagram","url":"https://instagram.com/..."}]')}
          <div className="text-xs text-muted-foreground">
            Supported: facebook, twitter, instagram, youtube, linkedin, tiktok, pinterest
          </div>
        </div>
      );
    } else if (path.startsWith('layout.footer.links')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Footer links can be customized in JSON format.
          </div>
          {bindJsonArray('Footer Links', 'template_footer_links' as any, '[{"label":"Shipping","url":"/shipping"},{"label":"Returns","url":"/returns"},{"label":"Contact","url":"/contact"}]')}
          {bindColor('Link Color', 'template_footer_link_color' as any, '#78716C')}
        </div>
      );
    } else if (path.startsWith('layout.header.nav')) {
      body = (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Add navigation links in JSON format.
          </div>
          {bindJsonArray('Navigation Links', 'template_nav_links', '[{"label":"Shop","url":"/products"},{"label":"About","url":"/about"},{"label":"Contact","url":"/contact"}]')}
        </div>
      );
    } else if (path === 'layout.categories') {
      if (activeTemplateId === 'papercraft') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Feature Cards</div>
            {bindText('Feature 1 Title', 'template_feature1_title' as any, '✋ Handcrafted')}
            {bindText('Feature 1 Description', 'template_feature1_desc' as any, 'Made by real artisans')}
            {bindText('Feature 2 Title', 'template_feature2_title' as any, '🌿 Sustainable')}
            {bindText('Feature 2 Description', 'template_feature2_desc' as any, 'Eco-friendly materials')}
            {bindText('Feature 3 Title', 'template_feature3_title' as any, '🎁 Gift Ready')}
            {bindText('Feature 3 Description', 'template_feature3_desc' as any, 'Beautiful packaging')}
          </div>
        );
      } else if (activeTemplateId === 'urgency-max') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Social Proof</div>
            {bindText('Viewers Text', 'template_viewers_text' as any, '47 people viewing this right now')}
            {bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in the last 24 hours')}
          </div>
        );
      } else {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Description</div>
            {bindTextarea('Description Text', 'template_description_text', 'Write a short description for your store...', 5)}
            {bindColor('Text Color', 'template_description_color' as any, '#78716C')}
            {bindRange('Font Size', 'template_description_size', 10, 32, 14, 'px')}
            {bindSelect('Font Style', 'template_description_style', [
              { value: 'normal', label: 'Normal' },
              { value: 'italic', label: 'Italic' },
            ], 'normal')}
            {bindSelect('Font Weight', 'template_description_weight', [
              { value: '300', label: 'Light (300)' },
              { value: '400', label: 'Normal (400)' },
              { value: '500', label: 'Medium (500)' },
              { value: '600', label: 'Semi-bold (600)' },
              { value: '700', label: 'Bold (700)' },
            ], '400')}
            <div className="text-xs text-muted-foreground">
              Tip: if left empty, it will use your store description.
            </div>
          </div>
        );
      }
    } else if (path === 'layout.grid' || path.startsWith('layout.grid.')) {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Product Grid Settings</div>
          {bindText('Grid Section Title', 'template_grid_title' as any, 'Our Products')}
          {bindSelect('Grid Columns (Desktop)', 'template_grid_columns', [
            { value: '2', label: '2 Columns' },
            { value: '3', label: '3 Columns' },
            { value: '4', label: '4 Columns' },
            { value: '5', label: '5 Columns' },
            { value: '6', label: '6 Columns' },
          ], '4')}
          {bindRange('Grid Gap', 'template_grid_gap', 8, 48, 24, 'px')}
          {bindRange('Card Border Radius', 'template_card_border_radius', 0, 32, 12, 'px')}
          {bindColor('Card Background', 'template_card_bg' as any, '#FFFFFF')}
        </div>
      );
    } else if (path.startsWith('layout.urgency.')) {
      if (path === 'layout.urgency.timer.hours.label' || path === 'layout.urgency.timer.hours') {
        body = bindText('Hours Label', 'template_timer_label_hours' as any, 'ساعات');
      } else if (path === 'layout.urgency.timer.mins.label' || path === 'layout.urgency.timer.mins') {
        body = bindText('Minutes Label', 'template_timer_label_mins' as any, 'دقائق');
      } else if (path === 'layout.urgency.timer.secs.label' || path === 'layout.urgency.timer.secs') {
        body = bindText('Seconds Label', 'template_timer_label_secs' as any, 'ثوان');
      } else if (path === 'layout.urgency.timer' || path.startsWith('layout.urgency.timer')) {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Timer Labels</div>
            {bindText('Ends In Label', 'template_timer_ends_label' as any, 'Ends in:')}
            {bindText('Hours Label', 'template_timer_label_hours' as any, 'HOURS')}
            {bindText('Minutes Label', 'template_timer_label_mins' as any, 'MINS')}
            {bindText('Seconds Label', 'template_timer_label_secs' as any, 'SECS')}
          </div>
        );
      } else if (path === 'layout.urgency.stock') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Stock Warning</div>
            {bindText('Prefix', 'template_stock_prefix' as any, '⚠️ Only')}
            {bindText('Stock Count', 'template_stock_count' as any, '7')}
            {bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!')}
          </div>
        );
      } else if (path === 'layout.urgency.pricing.original') {
        body = bindText('Original Price', 'template_original_price' as any, '$199.99');
      } else if (path === 'layout.urgency.pricing.sale') {
        body = bindText('Sale Price', 'template_sale_price' as any, '$59.99');
      } else if (path === 'layout.urgency.pricing.save') {
        body = bindText('Save Amount Text', 'template_save_amount' as any, 'You Save $140!');
      } else if (path === 'layout.urgency.pricing') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Pricing</div>
            {bindText('Original Price', 'template_original_price' as any, '$199.99')}
            {bindText('Sale Price', 'template_sale_price' as any, '$59.99')}
            {bindText('Save Amount Text', 'template_save_amount' as any, 'You Save $140!')}
          </div>
        );
      } else if (path === 'layout.urgency.benefits.item1') {
        body = bindText('Benefit 1', 'template_feature1_title' as any, '✅ Free Express Shipping');
      } else if (path === 'layout.urgency.benefits.item2') {
        body = bindText('Benefit 2', 'template_feature2_title' as any, '✅ 30-Day Money Back Guarantee');
      } else if (path === 'layout.urgency.benefits.item3') {
        body = bindText('Benefit 3', 'template_feature3_title' as any, '✅ Limited Time Bonus Gift');
      } else if (path === 'layout.urgency.benefits.item4') {
        body = bindText('Benefit 4', 'template_feature4_title' as any, '✅ Priority Customer Support');
      } else if (path === 'layout.urgency.benefits') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Benefits List</div>
            {bindText('Benefit 1', 'template_feature1_title' as any, '✅ Free Express Shipping')}
            {bindText('Benefit 2', 'template_feature2_title' as any, '✅ 30-Day Money Back Guarantee')}
            {bindText('Benefit 3', 'template_feature3_title' as any, '✅ Limited Time Bonus Gift')}
            {bindText('Benefit 4', 'template_feature4_title' as any, '✅ Priority Customer Support')}
          </div>
        );
      } else if (path === 'layout.urgency.stock.prefix') {
        body = bindText('Stock Prefix', 'template_stock_prefix' as any, '⚠️ Only');
      } else if (path === 'layout.urgency.stock.count') {
        body = bindText('Stock Count', 'template_stock_count' as any, '7');
      } else if (path === 'layout.urgency.stock.text') {
        body = bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!');
      } else if (path === 'layout.urgency.stock') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Stock Warning</div>
            {bindText('Prefix', 'template_stock_prefix' as any, '⚠️ Only')}
            {bindText('Stock Count', 'template_stock_count' as any, '7')}
            {bindText('Stock Text', 'template_stock_text' as any, 'items left at this price!')}
          </div>
        );
      } else if (path === 'layout.urgency.saleBadge') {
        body = bindText('Sale Badge Text', 'template_discount_badge_text' as any, '🔥 FLASH SALE');
      } else if (path === 'layout.urgency.topBar.kicker') {
        body = bindText('Urgency Kicker', 'template_hero_kicker' as any, '🔥 بيع سريع جداً');
      } else if (path === 'layout.urgency.topBar.warning') {
        body = bindText('Warning Text', 'template_warning_text' as any, '⚠️ Price increases when timer ends!');
      } else if (path === 'layout.urgency.topBar') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Top Urgency Bar</div>
            {bindText('Urgency Kicker', 'template_hero_kicker' as any, '🔥 بيع سريع جداً')}
            {bindText('Warning Text', 'template_warning_text' as any, '⚠️ Price increases when timer ends!')}
          </div>
        );
      } else if (path === 'layout.urgency.timer.endsLabel') {
        body = bindText('Timer Label', 'template_timer_ends_label' as any, 'Ends In');
      } else if (path === 'layout.urgency.socialProof.viewers') {
        body = bindText('Viewers Text', 'template_viewers_text' as any, '47 people watching now');
      } else if (path === 'layout.urgency.socialProof.sold') {
        body = bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in last 24 hours');
      } else if (path === 'layout.urgency.socialProof') {
        body = (
          <div className="space-y-4">
            <div className="font-medium text-sm">Social Proof</div>
            {bindText('Viewers Text', 'template_viewers_text' as any, '47 people watching now')}
            {bindText('Sold Today Text', 'template_sold_today' as any, '156 sold in last 24 hours')}
          </div>
        );
      } else if (path === 'layout.urgency.trustBadges') {
        body = (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Trust badges shown under checkout (JSON string array).</div>
            {bindTextarea('Trust Badges', 'template_trust_badges' as any, '["🔒 Secure","📦 Fast Ship","✅ Guaranteed"]', 4)}
            <div className="text-xs text-muted-foreground">Example: ["🔒 Secure","📦 Fast Ship","✅ Guaranteed"]</div>
          </div>
        );
      }
    } else if (path.startsWith('layout.testimonial.')) {
      body = (
        <div className="space-y-4">
          {bindTextarea('Testimonial Text', 'template_testimonial_text' as any, '"Amazing product..."', 4)}
          {bindText('Testimonial Author', 'template_testimonial_author' as any, '— Sarah M.')}
        </div>
      );
    } else if (path.startsWith('layout.features.')) {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Feature Cards</div>
          {bindText('Feature 1 Title', 'template_feature1_title' as any, '✋ Handcrafted')}
          {bindText('Feature 1 Description', 'template_feature1_desc' as any, 'Made by real artisans')}
          {bindText('Feature 2 Title', 'template_feature2_title' as any, '🌿 Sustainable')}
          {bindText('Feature 2 Description', 'template_feature2_desc' as any, 'Eco-friendly materials')}
          {bindText('Feature 3 Title', 'template_feature3_title' as any, '🎁 Gift Ready')}
          {bindText('Feature 3 Description', 'template_feature3_desc' as any, 'Beautiful packaging')}
        </div>
      );
    } else if (path === 'layout.footer') {
      body = (
        <div className="space-y-4">
          {bindText('Copyright Text', 'template_copyright' as any, '© 2026 Your Store')}
          {bindColor('Footer Background', 'template_footer_bg' as any, '#FDF8F3')}
          {bindColor('Footer Text Color', 'template_footer_text' as any, '#A8A29E')}
          {bindColor('Footer Link Color', 'template_footer_link_color' as any, '#78716C')}
          {bindJsonArray('Social Links', 'template_social_links', '[{"platform":"instagram","url":"https://instagram.com/..."}]')}
        </div>
      );
    } else if (path === '__root' || path === '__settings') {
      body = (
        <div className="space-y-4">
          <div className="font-medium text-sm">Global Typography</div>
          {bindSelect('Font Family', 'template_font_family', [
            { value: 'system-ui, -apple-system, sans-serif', label: 'System (Default)' },
            { value: 'Inter, sans-serif', label: 'Inter' },
            { value: 'Poppins, sans-serif', label: 'Poppins' },
            { value: 'Roboto, sans-serif', label: 'Roboto' },
            { value: 'Open Sans, sans-serif', label: 'Open Sans' },
            { value: 'Lato, sans-serif', label: 'Lato' },
            { value: 'Montserrat, sans-serif', label: 'Montserrat' },
            { value: 'Playfair Display, serif', label: 'Playfair Display' },
            { value: 'Merriweather, serif', label: 'Merriweather' },
            { value: 'Georgia, serif', label: 'Georgia' },
          ], 'system-ui, -apple-system, sans-serif')}
          {bindSelect('Body Font Weight', 'template_font_weight', [
            { value: '300', label: 'Light (300)' },
            { value: '400', label: 'Normal (400)' },
            { value: '500', label: 'Medium (500)' },
          ], '400')}
          {bindSelect('Heading Font Weight', 'template_heading_font_weight', [
            { value: '500', label: 'Medium (500)' },
            { value: '600', label: 'Semi-bold (600)' },
            { value: '700', label: 'Bold (700)' },
            { value: '800', label: 'Extra-bold (800)' },
          ], '600')}

          <div className="font-medium text-sm pt-4">Border Radius</div>
          {bindRange('Global Border Radius', 'template_border_radius', 0, 24, 8, 'px')}
          {bindRange('Card Border Radius', 'template_card_border_radius', 0, 32, 12, 'px')}
          {bindRange('Button Border Radius', 'template_button_border_radius', 0, 50, 9999, 'px')}

          <div className="font-medium text-sm pt-4">Spacing</div>
          {bindRange('Base Spacing', 'template_spacing', 8, 32, 16, 'px')}
          {bindRange('Section Spacing', 'template_section_spacing', 24, 96, 48, 'px')}

          <div className="font-medium text-sm pt-4">Animations</div>
          {bindRange('Animation Speed', 'template_animation_speed', 100, 500, 200, 'ms')}
          {bindSelect('Hover Scale', 'template_hover_scale', [
            { value: '1', label: 'None' },
            { value: '1.02', label: 'Subtle (1.02)' },
            { value: '1.05', label: 'Medium (1.05)' },
            { value: '1.1', label: 'Strong (1.1)' },
          ], '1.02')}

          <div className="font-medium text-sm pt-4">Custom CSS</div>
          {bindTextarea('Custom CSS', 'template_custom_css', '/* Add your custom CSS here */\n.my-class {\n  color: red;\n}', 6)}
        </div>
      );
    } else if (path.startsWith('layout.footer') || path.startsWith('layout.header')) {
      body = (
        <div className="space-y-4">
          {bindColor('Background Color', 'template_bg_color' as any, '#FDF8F3')}
          {bindColor('Accent Color', 'template_accent_color', '#F97316')}
          {bindColor('Text Color', 'template_text_color' as any, '#1C1917')}
          {bindColor('Muted Text Color', 'template_muted_color' as any, '#78716C')}
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('editor.edit')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">{t('editor.selected')}: {path}</div>
          {body}
        </CardContent>
      </Card>
    );
  }, [selectedEditPath, settings, navigate, t, activeTemplateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-2 md:px-4 py-2 md:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('editor.back')}</span>
            </Button>
            <h1 className="text-base md:text-lg font-semibold truncate">{t('editor.title')}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplatePickerOpen((v) => !v)}
              className="gap-1 md:gap-2 text-xs md:text-sm"
              aria-label="Select template"
            >
              <span className="max-w-[80px] md:max-w-none truncate">
                {TEMPLATE_PREVIEWS.find((t) => t.id === activeTemplateId)?.name || activeTemplateId}
              </span>
              <ChevronDown className="w-4 h-4" />
            </Button>

            {activeTab === 'preview' && (
              <div className="flex items-center gap-1">
                <Button
                  variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('mobile')}
                  className="px-2 md:px-3 text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">{t('editor.mobile')}</span>
                  <span className="sm:hidden">📱</span>
                </Button>
                <Button
                  variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('tablet')}
                  className="px-2 md:px-3 text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">{t('editor.tablet')}</span>
                  <span className="sm:hidden">📋</span>
                </Button>
                <Button
                  variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('desktop')}
                  className="px-2 md:px-3 text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">{t('editor.desktop')}</span>
                  <span className="sm:hidden">🖥️</span>
                </Button>
              </div>
            )}

            <Button
              variant={activeTab === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('preview')}
              className="px-2 md:px-3 text-xs md:text-sm"
            >
              <Eye className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('editor.preview')}</span>
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('settings')}
              className="px-2 md:px-3 text-xs md:text-sm"
            >
              <Settings className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('editor.settings')}</span>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="px-2 md:px-3 text-xs md:text-sm">
              <Save className="w-4 h-4 md:mr-2" />
              <span className="hidden sm:inline">{saving ? t('editor.saving') : t('editor.save')}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Alerts */}
        {(error || success) && (
          <div className="mx-4 mt-4 space-y-3 shrink-0">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 text-green-700">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Content */}
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex-1 min-h-0 overflow-auto lg:overflow-hidden">
        {activeTab === 'preview' ? (
          <div className={`grid grid-cols-1 ${previewGridCols} gap-2 sm:gap-4 items-start lg:items-stretch min-h-full lg:h-full`}>
            <div className="space-y-3 min-w-0 min-h-0 flex flex-col pb-20 lg:pb-0">
              {/* Device Frame Container */}
              <div ref={previewFitRef} className="w-full flex-1 min-h-0 flex items-start justify-center lg:justify-start">
                {previewDevice === 'desktop' ? (
                  <div
                    style={{
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      width: '100%',
                      maxWidth: deviceFrame.maxWidth as any,
                      height: '100%',
                    }}
                  >
                    <div
                      className="overflow-hidden bg-white flex flex-col"
                      style={{
                        maxWidth: deviceFrame.maxWidth as any,
                        width: deviceFrame.width as any,
                        height: deviceFrame.height as any,
                        aspectRatio: deviceFrame.aspectRatio as any,
                        borderRadius: '4px',
                        position: 'relative',
                      }}
                    >
                      <style>{`[data-edit-selected="true"]{outline:2px solid hsl(var(--primary)); outline-offset:2px;}`}</style>
                      <div
                        ref={previewRootRef}
                        onClickCapture={handlePreviewClickCapture}
                        className="flex-1 overflow-y-auto overflow-x-hidden"
                      >
                        {RenderStorefront(selectedTemplateId, templateProps as any)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: `${baseDeviceOuter.width * deviceScale}px`,
                      height: `${baseDeviceOuter.height * deviceScale}px`,
                    }}
                  >
                    <div
                      style={{
                        width: `${baseDeviceOuter.width}px`,
                        height: `${baseDeviceOuter.height}px`,
                        transform: `scale(${deviceScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          marginLeft: '0',
                          marginRight: 'auto',
                          ...(previewDevice === 'mobile'
                            ? {
                                // Samsung Galaxy S24 Ultra frame styling
                                background:
                                  'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 50%, #0d0d0d 100%)',
                                borderRadius: '28px',
                                padding: '6px',
                                boxShadow:
                                  '0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px #333',
                                width: '342px',
                              }
                            : {
                                // iPad frame styling (65% scale)
                                background: '#2d2d2d',
                                borderRadius: '16px',
                                padding: '12px 10px',
                                boxShadow:
                                  '0 20px 40px -10px rgba(0,0,0,0.35), inset 0 0 0 2px #444',
                                width: '562px',
                              }),
                        }}
                      >
                        {/* Front Camera for iPad */}
                        {previewDevice === 'tablet' && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              marginBottom: '10px',
                            }}
                          >
                            <div
                              style={{
                                width: '10px',
                                height: '10px',
                                background: '#1a1a1a',
                                borderRadius: '50%',
                                boxShadow: 'inset 0 0 2px rgba(255,255,255,0.2)',
                              }}
                            />
                          </div>
                        )}

                        {/* Screen */}
                        <div
                          className="overflow-hidden bg-white flex flex-col"
                          style={{
                            maxWidth: deviceFrame.maxWidth as any,
                            width: deviceFrame.width as any,
                            height: deviceFrame.height as any,
                            aspectRatio: deviceFrame.aspectRatio as any,
                            borderRadius: previewDevice === 'mobile' ? '22px' : '8px',
                            position: 'relative',
                          }}
                        >
                          <iframe
                            ref={previewIframeRef}
                            title="Storefront Preview"
                            srcDoc={IFRAME_SRC_DOC}
                            onLoad={() => setIframeReady(true)}
                            style={{
                              border: 0,
                              width: '100%',
                              height: '100%',
                              display: 'block',
                              background: '#ffffff',
                            }}
                          />
                        </div>

                        {/* Punch-hole camera overlay for Galaxy */}
                        {previewDevice === 'mobile' && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '12px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '12px',
                              height: '12px',
                              background: '#000',
                              borderRadius: '50%',
                              boxShadow: 'inset 0 0 3px rgba(255,255,255,0.15)',
                              zIndex: 10,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 h-full overflow-hidden hidden lg:block">
              <div className="relative h-full overflow-hidden">
                {/* Edit panel stays mounted (so it feels instant when templates hide) */}
                <div
                  className={`transition-opacity duration-200 ${
                    templatePickerOpen ? 'opacity-30 pointer-events-none select-none' : 'opacity-100'
                  }`}
                >
                  <div className="h-full overflow-y-auto pr-1">{editPanel}</div>
                </div>

                {/* Templates panel slides over the edit panel - DESKTOP ONLY */}
                <div
                  className={
                    `absolute inset-0 transition-all duration-200 ease-out will-change-transform ${
                      templatePickerOpen
                        ? 'opacity-100 translate-x-0 pointer-events-auto'
                        : 'opacity-0 translate-x-6 pointer-events-none'
                    }`
                  }
                >
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">{(t('editor.chooseTemplate') as any) || 'Choose Template'}</CardTitle>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePickerOpen(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className="w-4 h-4 text-primary" />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{(t('editor.currentTemplate') as any) || 'Current'}:</span>
                          <span className="font-semibold text-primary truncate">
                            {TEMPLATE_PREVIEWS.find((t) => t.id === effectiveTemplateId)?.name || effectiveTemplateId}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleResetTemplate} className="text-xs">
                          🔄 Reset
                        </Button>
                      </div>

                      {isPreviewingDifferentTemplate && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Previewing:</div>
                            <div className="font-semibold truncate">
                              {TEMPLATE_PREVIEWS.find((t) => t.id === activeTemplateId)?.name || activeTemplateId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving || !previewTemplateId}
                              onClick={() => {
                                if (!previewTemplateId) return;
                                handleTemplateChange(previewTemplateId);
                              }}
                            >
                              Use template
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={saving}
                              onClick={() => setPreviewTemplateId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search templates..."
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          className="pl-10 pr-8"
                        />
                        {templateSearch && (
                          <button
                            type="button"
                            onClick={() => setTemplateSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setTemplateCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              templateCategory === cat.id
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            <span className="mr-1">{cat.icon}</span>
                            {cat.name}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Showing {filteredTemplates.length} of {showAllTemplates ? TEMPLATE_PREVIEWS.length : READY_TEMPLATE_IDS.size}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!currentTemplateIsReady && showAllTemplates}
                          onClick={() => {
                            // If current template isn't ready, keep expanded so the current template remains reachable.
                            if (!currentTemplateIsReady && showAllTemplates) return;
                            setShowAllTemplates((v) => !v);
                          }}
                          className="text-xs"
                          title={!currentTemplateIsReady && showAllTemplates ? 'Your current template is not fully tested. Keep all templates visible.' : undefined}
                        >
                          {showAllTemplates ? 'Show ready only' : 'Show all templates'}
                        </Button>
                      </div>

                      {showAllTemplates && (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                          <AlertDescription className="text-sm">
                            Some templates are not fully tested in the editor yet. Use them at your own decision.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div
                        className={`grid gap-3 pb-1 ${
                          previewDevice === 'mobile'
                            ? 'grid-cols-5'
                            : previewDevice === 'tablet'
                              ? 'grid-cols-4'
                              : 'grid-cols-3'
                        }`}
                      >
                        {filteredTemplates.map((template) => {
                          const isSelected = activeTemplateId === template.id;
                          const isCurrent = effectiveTemplateId === template.id;
                          const isReady = READY_TEMPLATE_IDS.has(template.id);
                          return (
                            <div
                              key={template.id}
                              onClick={() => {
                                setPreviewTemplateId(template.id);
                              }}
                              className={`relative cursor-pointer group transition-all duration-200 ${
                                isSelected ? 'scale-[1.01]' : 'hover:scale-[1.01]'
                              }`}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setPreviewTemplateId(template.id);
                                }
                              }}
                            >
                              <div
                                className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected
                                    ? 'border-primary shadow-lg shadow-primary/25 ring-2 ring-primary/50'
                                    : 'border-border/50 hover:border-primary/50'
                                }`}
                              >
                                <img
                                  src={template.image}
                                  alt={template.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div
                                  className={`absolute inset-0 transition-opacity ${
                                    isSelected ? 'bg-primary/10' : 'bg-black/0 group-hover:bg-black/20'
                                  }`}
                                />

                                {!isReady && showAllTemplates && (
                                  <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Not ready
                                  </div>
                                )}

                                {isCurrent && (
                                  <div className="absolute bottom-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                    Current
                                  </div>
                                )}

                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              <p
                                className={`mt-2 text-center text-xs font-medium truncate ${
                                  isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                }`}
                              >
                                {template.name}
                              </p>
                            </div>
                          );
                        })}

                        {filteredTemplates.length === 0 && (
                          <div className="col-span-full py-8 text-center">
                            <div className="text-3xl mb-2">🔍</div>
                            <p className="text-muted-foreground">No templates found</p>
                            <button
                              type="button"
                              onClick={() => {
                                setTemplateSearch('');
                                setTemplateCategory('all');
                              }}
                              className="mt-2 text-sm text-primary hover:underline"
                            >
                              Clear filters
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* MOBILE Template Picker - Bottom Sheet */}
            <div
              className={`lg:hidden fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
                templatePickerOpen ? 'translate-y-0' : 'translate-y-full'
              }`}
              style={{ maxHeight: '70vh' }}
            >
              {/* Backdrop */}
              {templatePickerOpen && (
                <div 
                  className="fixed inset-0 bg-black/50 -z-10" 
                  onClick={() => setTemplatePickerOpen(false)}
                />
              )}
              
              <div className="bg-background rounded-t-2xl border-t shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
                {/* Handle bar */}
                <div className="flex justify-center py-2">
                  <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                </div>
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b">
                  <h3 className="font-semibold">{(t('editor.chooseTemplate') as any) || 'اختر قالبك'}</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePickerOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Current template indicator */}
                <div className="px-4 py-2 bg-primary/5 border-b flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground">Current:</span>
                    <span className="text-sm font-semibold text-primary truncate">
                      {TEMPLATE_PREVIEWS.find((t) => t.id === effectiveTemplateId)?.name || effectiveTemplateId}
                    </span>
                  </div>
                </div>

                {/* Preview action bar - shows when previewing different template */}
                {isPreviewingDifferentTemplate && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b flex items-center justify-between gap-2">
                    <span className="text-sm truncate">
                      <span className="text-muted-foreground">Preview: </span>
                      <span className="font-medium">{TEMPLATE_PREVIEWS.find((t) => t.id === activeTemplateId)?.name}</span>
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs h-8"
                        disabled={saving || !previewTemplateId}
                        onClick={() => {
                          if (!previewTemplateId) return;
                          handleTemplateChange(previewTemplateId);
                        }}
                      >
                        Use
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setPreviewTemplateId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Template grid - scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(70vh - 140px)' }}>
                  <div className="grid grid-cols-4 gap-2">
                    {filteredTemplates.map((template) => {
                      const isSelected = activeTemplateId === template.id;
                      const isCurrent = effectiveTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setPreviewTemplateId(template.id)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-border/50'
                          }`}
                        >
                          <div className="aspect-[3/4] bg-muted">
                            <img
                              src={template.image}
                              alt={template.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          {isCurrent && (
                            <div className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                              Current
                            </div>
                          )}
                          {isSelected && !isCurrent && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                          <p className="text-[10px] font-medium text-center py-1 truncate px-1">
                            {template.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* MOBILE Edit Panel - Bottom Sheet */}
            <div
              className={`lg:hidden fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
                mobileEditPanelOpen && selectedEditPath ? 'translate-y-0' : 'translate-y-full'
              }`}
              style={{ maxHeight: '60vh' }}
            >
              {/* Backdrop */}
              {mobileEditPanelOpen && selectedEditPath && (
                <div 
                  className="fixed inset-0 bg-black/50 -z-10" 
                  onClick={() => {
                    setMobileEditPanelOpen(false);
                    setSelectedEditPath(null);
                  }}
                />
              )}
              
              <div className="bg-background rounded-t-2xl border-t shadow-2xl flex flex-col" style={{ maxHeight: '60vh' }}>
                {/* Handle bar */}
                <div className="flex justify-center py-2">
                  <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                </div>
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b">
                  <h3 className="font-semibold">{t('editor.edit')}</h3>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setMobileEditPanelOpen(false);
                      setSelectedEditPath(null);
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Edit Panel Content - scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(60vh - 70px)' }}>
                  {editPanel}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            <div className="space-y-6">
            {/* Basic Settings */}
            <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('editor.storeInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('editor.storeName')}</label>
                  <Input
                    value={settings.store_name || ''}
                    onChange={(e) => handleSettingChange('store_name', e.target.value)}
                    placeholder={t('editor.storeNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('editor.storeDescription')}</label>
                  <Input
                    value={settings.store_description || ''}
                    onChange={(e) => handleSettingChange('store_description', e.target.value)}
                    placeholder={t('editor.storeDescPlaceholder')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Hero Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t('editor.heroSection')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('editor.heroHeading')}</label>
                  <Input
                    value={settings.template_hero_heading || ''}
                    onChange={(e) => handleSettingChange('template_hero_heading', e.target.value)}
                    placeholder={t('editor.heroHeadingPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('editor.heroSubtitle')}</label>
                  <Input
                    value={settings.template_hero_subtitle || ''}
                    onChange={(e) => handleSettingChange('template_hero_subtitle', e.target.value)}
                    placeholder={t('editor.heroSubtitlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('editor.buttonText')}</label>
                  <Input
                    value={settings.template_button_text || ''}
                    onChange={(e) => handleSettingChange('template_button_text', e.target.value)}
                    placeholder="Shop Now"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <CardHeader>
                <CardTitle>{t('editor.branding')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('editor.logo')}</label>
                  <div className="flex items-center gap-4">
                    {settings.store_logo && (
                      <img src={settings.store_logo} alt="Logo" className="h-12 w-auto" />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('store_logo', file);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('editor.bannerImage')}</label>
                  <div className="flex items-center gap-4">
                    {settings.banner_url && (
                      <img src={settings.banner_url} alt="Banner" className="h-20 w-auto" />
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('banner_url', file);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('editor.accentColor')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.template_accent_color || settings.primary_color || '#1E90FF'}
                      onChange={(e) => handleSettingChange('template_accent_color', e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={settings.template_accent_color || settings.primary_color || '#1E90FF'}
                      onChange={(e) => handleSettingChange('template_accent_color', e.target.value)}
                      placeholder="#1E90FF"
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
