import React, { lazy, Suspense } from 'react';
import { TemplateProps } from './types';

// Lazy-load every template — each becomes its own chunk loaded only when needed
const DZShopTemplate    = lazy(() => import('./dzshop/DZShopTemplate'));
const NeedDZTemplate    = lazy(() => import('./needdz/NeedDZTemplate'));
const ZenithTemplate    = lazy(() => import('./zenith/ZenithTemplate'));
const BoutiqueTemplate  = lazy(() => import('./boutique/BoutiqueTemplate'));
const IycoTemplate      = lazy(() => import('./iyco/IycoTemplate'));
const Bassem28Template  = lazy(() => import('./bassem28/Bassem28Template'));
const Dz3ShopTemplate   = lazy(() => import('./dz3shop/Dz3ShopTemplate'));
const SpiriluxeTemplate = lazy(() => import('./spiriluxe/SpiriluxeTemplate'));
const LeRoiShopTemplate = lazy(() => import('./leroishop/LeRoiShopTemplate'));

function TemplateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
    </div>
  );
}

export type TemplateId = 'dzshop' | 'luxedrop' | string;

export function normalizeTemplateId(id: string): string {
    if (id === 'luxedark') return 'dzshop'; // luxedrop disabled, redirect to dzshop
    // Disabled: dzpremium, minimalist, aurora, sculptor, artisan, gallery, jewelheart, classicshop, vera, novadz, lumina, luxedrop, streetwear
    const validIds = ['dzshop', 'needdz', 'zenith', 'boutique', 'iyco', 'bassem28', 'dz3shop', 'spiriluxe', 'leroishop'];
    if (validIds.includes(id)) return id;
    return 'leroishop'; // Fallback
}

export function RenderStorefront(t: TemplateId | string, props: TemplateProps) {
  const id = normalizeTemplateId(String(t || (props.settings as any)?.template || 'leroishop'));


  // If a main product is selected, move it to the front of the products array so single-product templates pick it up automatically
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

  let template: React.ReactElement;
  switch (id) {
      case 'zenith':      template = <ZenithTemplate {...sanitizedProps} />; break;
      case 'boutique':    template = <BoutiqueTemplate {...sanitizedProps} />; break;
      case 'iyco':        template = <IycoTemplate {...sanitizedProps} />; break;
      case 'bassem28':    template = <Bassem28Template {...sanitizedProps} />; break;
      case 'dz3shop':     template = <Dz3ShopTemplate {...sanitizedProps} />; break;
      case 'spiriluxe':   template = <SpiriluxeTemplate {...sanitizedProps} />; break;
      case 'leroishop':   template = <LeRoiShopTemplate {...sanitizedProps} />; break;
      case 'needdz':      template = <NeedDZTemplate {...sanitizedProps} />; break;
      case 'dzshop':
      default:            template = <DZShopTemplate {...sanitizedProps} />; break;
  }
  return <Suspense fallback={<TemplateFallback />}>{template}</Suspense>;
}

// Only exporting active templates
// NOTE: LuxeDropTemplate, NovaDzTemplate, LuminaTemplate, StreetwearTemplate disabled
export { DZShopTemplate, NeedDZTemplate, ZenithTemplate, BoutiqueTemplate, IycoTemplate, Bassem28Template, Dz3ShopTemplate, SpiriluxeTemplate, LeRoiShopTemplate };
