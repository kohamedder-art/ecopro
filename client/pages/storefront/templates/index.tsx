import React from 'react';
import { TemplateProps } from './types';
import DZShopTemplate from './dzshop/DZShopTemplate';
import LuxeDarkTemplate from './luxedark/LuxeDarkTemplate';
import DZPremiumTemplate from './dzpremium/DZPremiumTemplate';
import LuxeDropTemplate from './luxedrop/LuxeDropTemplate';
import NeedDZTemplate from './needdz/NeedDZTemplate';
import NovaDzTemplate from './novadz/NovaDzTemplate';
import MinimalistTemplate from './minimalist/MinimalistTemplate';
import LuminaTemplate from './lumina/LuminaTemplate';
import ZenithTemplate from './zenith/ZenithTemplate';
import BoutiqueTemplate from './boutique/BoutiqueTemplate';
import AuroraTemplate from './aurora/AuroraTemplate';
import SculptorTemplate from './sculptor/SculptorTemplate';
import ArtisanTemplate from './artisan/ArtisanTemplate';
import VeraTemplate from './vera/VeraTemplate';
import StreetwearTemplate from './streetwear/StreetwearTemplate';
import GalleryTemplate from './gallery/GalleryTemplate';

export type TemplateId = 'dzshop' | 'dzpremium' | 'luxedark' | 'luxedrop' | string;

export function normalizeTemplateId(id: string): string {
    const validIds = ['dzshop', 'dzpremium', 'luxedark', 'luxedrop', 'needdz', 'novadz', 'minimalist', 'lumina', 'zenith', 'boutique', 'aurora', 'sculptor', 'artisan', 'vera', 'streetwear', 'gallery'];
    if (validIds.includes(id)) return id;
    return 'dzshop'; // Fallback
}

export function RenderStorefront(t: TemplateId | string, props: TemplateProps) {
  const id = normalizeTemplateId(String(t || (props.settings as any)?.template || 'dzshop'));


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

  switch (id) {
      case 'novadz':
          return <NovaDzTemplate {...sanitizedProps} />;
      case 'lumina':
          return <LuminaTemplate {...sanitizedProps} />;
      case 'zenith':
          return <ZenithTemplate {...sanitizedProps} />;
      case 'boutique':
          return <BoutiqueTemplate {...sanitizedProps} />;
      case 'aurora':
          return <AuroraTemplate {...sanitizedProps} />;
      case 'sculptor':
          return <SculptorTemplate {...sanitizedProps} />;
      case 'artisan':
          return <ArtisanTemplate {...sanitizedProps} />;
      case 'vera':
          return <VeraTemplate {...sanitizedProps} />;
      case 'streetwear':
          return <StreetwearTemplate {...sanitizedProps} />;
      case 'gallery':
          return <GalleryTemplate {...sanitizedProps} />;
      case 'minimalist':
          return <MinimalistTemplate {...sanitizedProps} />;
      case 'dzpremium':
          return <DZPremiumTemplate {...sanitizedProps} />;
      case 'luxedrop':
          return <LuxeDropTemplate {...sanitizedProps} />;
      case 'needdz':
          return <NeedDZTemplate {...sanitizedProps} />;
      case 'luxedark':
          return <LuxeDarkTemplate {...sanitizedProps} />;
      case 'dzshop':
      default:
          return <DZShopTemplate {...sanitizedProps} />;
  }
}

export { DZShopTemplate, DZPremiumTemplate, LuxeDarkTemplate, LuxeDropTemplate, NeedDZTemplate, NovaDzTemplate, MinimalistTemplate, LuminaTemplate, ZenithTemplate, BoutiqueTemplate, AuroraTemplate, SculptorTemplate, ArtisanTemplate, VeraTemplate, StreetwearTemplate, GalleryTemplate };
