import React, { lazy, Suspense } from 'react';
import type { TemplateProps } from './types';

// Built-in templates (static imports)
const DZShopTemplate = lazy(() => import('./dzshop/DZShopTemplate'));
const NeedDZTemplate = lazy(() => import('./needdz/NeedDZTemplate'));
const ZenithTemplate = lazy(() => import('./zenith/ZenithTemplate'));
const BoutiqueTemplate = lazy(() => import('./boutique/BoutiqueTemplate'));
const IycoTemplate = lazy(() => import('./iyco/IycoTemplate'));
const PrimoTemplate = lazy(() => import('./primo/PrimoTemplate'));
const SpiriluxeTemplate = lazy(() => import('./spiriluxe/SpiriluxeTemplate'));
const LeRoiShopTemplate = lazy(() => import('./leroishop/LeRoiShopTemplate'));

// AI-generated templates registry (populated at runtime)
const aiGeneratedTemplates: Record<string, React.LazyExoticComponent<React.ComponentType<TemplateProps>>> = {};

function TemplateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
    </div>
  );
}

export type TemplateId = 'dzshop' | 'luxedrop' | string;

export function normalizeTemplateId(id: string): string {
  if (id === 'luxedark') return 'dzshop';
  if (id === 'bassem28') return 'primo';
  const validIds = ['dzshop', 'needdz', 'zenith', 'boutique', 'iyco', 'primo', 'spiriluxe', 'leroishop'];
  if (validIds.includes(id)) return id;
  if (aiGeneratedTemplates[id]) return id;
  return 'zenith';
}

/**
 * Register an AI-generated template at runtime
 */
export function registerAITemplate(templateId: string, code: string) {
  // Create a blob URL from the code and dynamically import it
  // This is a simplified approach - in production you'd want to:
  // 1. Save the code to a file on the server
  // 2. Import it via a proper bundler plugin
  // For now, we'll use Function constructor as a quick prototype

  try {
    // Extract the component from the code
    const Component = new Function('React', 'useTemplateSkeleton', 'VariantSelector', 'OfferSelector', 'OrderSuccessConnect', 'TemplateProps', `
      ${code}
      return ${code.match(/export\s+default\s+function\s+(\w+)/)?.[1] || 'DefaultTemplate'};
    `);

    const LazyComponent = lazy(() => Promise.resolve({ default: Component }));
    aiGeneratedTemplates[templateId] = LazyComponent;
    console.log(`[TemplateRegistry] Registered AI template: ${templateId}`);
  } catch (err) {
    console.error(`[TemplateRegistry] Failed to register template ${templateId}:`, err);
  }
}

/**
 * Get a template component by ID
 */
export function getTemplate(id: string): React.ComponentType<TemplateProps> | null {
  const normalizedId = normalizeTemplateId(id);

  // Check built-in templates
  switch (normalizedId) {
    case 'zenith': return ZenithTemplate;
    case 'boutique': return BoutiqueTemplate;
    case 'iyco': return IycoTemplate;
    case 'primo': return PrimoTemplate;
    case 'spiriluxe': return SpiriluxeTemplate;
    case 'leroishop': return LeRoiShopTemplate;
    case 'needdz': return NeedDZTemplate;
    case 'dzshop': return DZShopTemplate;
  }

  // Check AI-generated templates
  if (aiGeneratedTemplates[normalizedId]) {
    return aiGeneratedTemplates[normalizedId];
  }

  return null;
}

export function RenderStorefront(t: TemplateId | string, props: TemplateProps) {
  const id = normalizeTemplateId(String(t || (props.settings as any)?.template || 'zenith'));

  // If a main product is selected, move it to the front
  let orderedProducts = [...(props.products || [])].map((p) => ({ ...p, category: undefined }));

  if (props.settings?.dzp_main_product_id) {
    const mainProductIndex = orderedProducts.findIndex(p => p.id === props.settings?.dzp_main_product_id);
    if (mainProductIndex > -1) {
      const mainProduct = orderedProducts[mainProductIndex];
      orderedProducts.splice(mainProductIndex, 1);
      orderedProducts.unshift(mainProduct);
    }
  }

  const sanitizedProps: TemplateProps = {
    ...props,
    products: orderedProducts,
    filtered: (props.filtered || []).map((p) => ({ ...p, category: undefined })),
    categories: [],
    categoryFilter: '',
    setCategoryFilter: () => {},
  };

  const TemplateComponent = getTemplate(id);

  if (!TemplateComponent) {
    return <TemplateFallback />;
  }

  return (
    <Suspense fallback={<TemplateFallback />}>
      <TemplateComponent {...sanitizedProps} />
    </Suspense>
  );
}

export { DZShopTemplate, NeedDZTemplate, ZenithTemplate, BoutiqueTemplate, IycoTemplate, PrimoTemplate, SpiriluxeTemplate, LeRoiShopTemplate };
