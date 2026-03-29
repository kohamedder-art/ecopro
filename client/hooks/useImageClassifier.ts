import { useState, useEffect } from 'react';
import {
  classifyImages,
  distributeImages,
  ClassifiedImage,
  TemplateImageMap,
  TEMPLATE_SLOTS,
  ImageShape,
} from '@/utils/imageClassifier';

/**
 * React hook that classifies product images by their dimensions and distributes
 * them into the correct template slots.
 * 
 * Usage:
 *   const { slots, classified, loading } = useImageClassifier(product.images, 'dzshop');
 *   // slots.gallery  → square images for the product gallery
 *   // slots.banner   → wide/tall images for the bottom landing area
 * 
 * For multi-product templates, call once per product:
 *   const { getShape } = useImageClassifier(allImageUrls, templateId);
 *   // getShape('https://...') → 'square' | 'wide' | 'tall'
 */
export function useImageClassifier(
  imageUrls: string[] | undefined,
  templateId: string
) {
  const [classified, setClassified] = useState<ClassifiedImage[]>([]);
  const [slots, setSlots] = useState<TemplateImageMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urls = imageUrls?.filter(Boolean) ?? [];
    if (urls.length === 0) {
      setClassified([]);
      setSlots({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    classifyImages(urls).then((results) => {
      if (cancelled) return;
      setClassified(results);
      setSlots(distributeImages(results, templateId));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [imageUrls?.join(','), templateId]);

  /**
   * Quick lookup: get the shape of a specific image URL.
   * Useful in multi-product templates where you loop over products
   * and want to know each image's shape for conditional rendering.
   */
  const getShape = (url: string): ImageShape | null => {
    const found = classified.find(c => c.url === url);
    return found?.shape ?? null;
  };

  /**
   * Check if a specific URL is classified as a given shape.
   */
  const isShape = (url: string, shape: ImageShape): boolean => {
    return getShape(url) === shape;
  };

  /**
   * Get the best image for a specific slot name.
   * Returns the first image from that slot, or undefined.
   */
  const getSlotImage = (slotName: string): string | undefined => {
    return slots[slotName]?.[0];
  };

  /**
   * Get all images for a specific slot.
   */
  const getSlotImages = (slotName: string): string[] => {
    return slots[slotName] ?? [];
  };

  return {
    classified,
    slots,
    loading,
    getShape,
    isShape,
    getSlotImage,
    getSlotImages,
    hasSlots: Object.keys(TEMPLATE_SLOTS).includes(templateId),
  };
}
