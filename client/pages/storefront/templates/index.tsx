import React from 'react';
import { TemplateProps } from './types';
// NOTE: Disabled templates (files kept but not selectable):
// dzpremium, minimalist, aurora, sculptor, artisan, gallery, jewelheart, classicshop, vera, luxedrop, streetwear, novadz, lumina
// To re-enable, add imports and add to validIds array below

import DZShopTemplate from './dzshop/DZShopTemplate';
// NOTE: luxedrop, novadz, lumina disabled - see validIds array below
// import LuxeDropTemplate from './luxedrop/LuxeDropTemplate';
// import NovaDzTemplate from './novadz/NovaDzTemplate';
// import LuminaTemplate from './lumina/LuminaTemplate';
import NeedDZTemplate from './needdz/NeedDZTemplate';
import ZenithTemplate from './zenith/ZenithTemplate';
import BoutiqueTemplate from './boutique/BoutiqueTemplate';
// NOTE: streetwear disabled - see validIds array below
// import StreetwearTemplate from './streetwear/StreetwearTemplate';
import IycoTemplate from './iyco/IycoTemplate';
import Bassem28Template from './bassem28/Bassem28Template';
import Dz3ShopTemplate from './dz3shop/Dz3ShopTemplate';
import SpiriluxeTemplate from './spiriluxe/SpiriluxeTemplate';
import LeRoiShopTemplate from './leroishop/LeRoiShopTemplate';

export type TemplateId = 'dzshop' | 'dzpremium' | 'luxedrop' | string;

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

  switch (id) {
      // Active templates
      case 'zenith':
          return <ZenithTemplate {...sanitizedProps} />;
      case 'boutique':
          return <BoutiqueTemplate {...sanitizedProps} />;
      // NOTE: streetwear disabled - redirect to dzshop
      // case 'streetwear':
      //     return <StreetwearTemplate {...sanitizedProps} />;
      case 'iyco':
          return <IycoTemplate {...sanitizedProps} />;
      case 'bassem28':
          return <Bassem28Template {...sanitizedProps} />;
      case 'dz3shop':
          return <Dz3ShopTemplate {...sanitizedProps} />;
      case 'spiriluxe':
          return <SpiriluxeTemplate {...sanitizedProps} />;
      case 'leroishop':
          return <LeRoiShopTemplate {...sanitizedProps} />;
      // NOTE: luxedrop disabled - redirect to dzshop
      // case 'luxedrop':
      //     return <LuxeDropTemplate {...sanitizedProps} />;
      case 'needdz':
          return <NeedDZTemplate {...sanitizedProps} />;
      // Disabled templates redirect to dzshop:
      case 'dzpremium':
      case 'minimalist':
      case 'aurora':
      case 'sculptor':
      case 'artisan':
      case 'gallery':
      case 'jewelheart':
      case 'classicshop':
      case 'vera':
      case 'novadz':
      case 'lumina':
      case 'luxedrop':
      case 'streetwear':
      case 'dzshop':
      default:
          return <DZShopTemplate {...sanitizedProps} />;
  }
}

// Only exporting active templates
// NOTE: LuxeDropTemplate, NovaDzTemplate, LuminaTemplate, StreetwearTemplate disabled
export { DZShopTemplate, NeedDZTemplate, ZenithTemplate, BoutiqueTemplate, IycoTemplate, Bassem28Template, Dz3ShopTemplate, SpiriluxeTemplate, LeRoiShopTemplate };
