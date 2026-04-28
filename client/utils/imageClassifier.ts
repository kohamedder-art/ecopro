/**
 * Smart Image Classifier
 * 
 * Detects image dimensions and classifies them by aspect ratio so templates
 * can automatically place images in the correct slots (hero, card, landing strip, etc).
 * 
 * Shape categories:
 * - 'square'    → ratio ≈ 1:1  (0.8 – 1.25)   — product cards, thumbnails
 * - 'wide'      → ratio > 1.25                  — banners, hero sections
 * - 'tall'      → ratio < 0.8                   — landing strips, portrait product shots
 */

export type ImageShape = 'square' | 'wide' | 'tall';

export interface ClassifiedImage {
  url: string;
  width: number;
  height: number;
  ratio: number;   // width / height
  shape: ImageShape;
}

// In-memory cache to avoid re-measuring the same URL
const cache = new Map<string, ClassifiedImage>();

/**
 * Load an image and return its natural dimensions + classification.
 * Results are cached per URL.
 */
export function classifyImage(url: string): Promise<ClassifiedImage> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = h > 0 ? w / h : 1;
      const shape: ImageShape =
        ratio >= 0.8 && ratio <= 1.25 ? 'square' :
        ratio > 1.25 ? 'wide' :
        'tall';

      const result: ClassifiedImage = { url, width: w, height: h, ratio, shape };
      cache.set(url, result);
      resolve(result);
    };

    img.onerror = () => {
      // On error, default to square so the image still gets used somewhere
      const result: ClassifiedImage = { url, width: 0, height: 0, ratio: 1, shape: 'square' };
      cache.set(url, result);
      resolve(result);
    };

    img.src = url;
  });
}

/**
 * Classify all images in an array. Returns them in the same order, enriched with shape data.
 */
export async function classifyImages(urls: string[]): Promise<ClassifiedImage[]> {
  return Promise.all(urls.map(classifyImage));
}

/**
 * Split images into shape buckets.
 */
export function groupByShape(classified: ClassifiedImage[]): Record<ImageShape, ClassifiedImage[]> {
  const groups: Record<ImageShape, ClassifiedImage[]> = { square: [], wide: [], tall: [] };
  for (const img of classified) {
    groups[img.shape].push(img);
  }
  return groups;
}

/**
 * Template image slot definitions.
 * Each template declares what shapes work best for each slot.
 * 'preferred' = ideal shape, 'fallback' = acceptable alternatives.
 */
export interface TemplateImageSlot {
  name: string;
  preferred: ImageShape[];
  count: number;  // how many images this slot needs (1 = single, Infinity = all remaining)
}

export interface TemplateImageMap {
  [slotName: string]: string[];
}

/**
 * Pre-defined slot requirements per template.
 */
export const TEMPLATE_SLOTS: Record<string, TemplateImageSlot[]> = {
  dzshop: [
    { name: 'gallery', preferred: ['square', 'wide'], count: 4 }, // main + 3 thumbs (normal product photos)
    { name: 'banner',  preferred: ['tall'], count: 1 },           // bottom long landing page image
  ],
  dzpremium: [
    { name: 'hero',     preferred: ['wide', 'square'], count: 1 }, // hero image
    { name: 'features', preferred: ['wide', 'square'], count: 2 }, // 2 feature images
  ],

  luxedrop: [
    { name: 'gallery', preferred: ['square'], count: 5 },       // main + 4 thumbnails
  ],
  needdz: [
    { name: 'cards', preferred: ['square'], count: Infinity },   // per-product square cards
  ],
  novadz: [
    { name: 'gallery', preferred: ['tall', 'square'], count: Infinity }, // 4:5 gallery with thumbs
  ],
  minimalist: [
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 4:5 full-page cards
  ],
  lumina: [
    { name: 'landing', preferred: ['tall', 'wide'], count: Infinity },   // long landing strips
  ],
  zenith: [
    { name: 'landing', preferred: ['tall', 'wide'], count: Infinity },   // long landing strips
  ],
  classicshop: [
    { name: 'landing', preferred: ['tall', 'wide'], count: Infinity },   // long landing strips
  ],
  boutique: [
    { name: 'hero',  preferred: ['wide'], count: 1 },                   // wide hero banner
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 4:5 product cards
  ],
  aurora: [
    { name: 'hero',  preferred: ['wide'], count: 1 },                   // 16:10 hero
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 3:4 product cards
  ],
  sculptor: [
    { name: 'gallery', preferred: ['tall', 'square'], count: Infinity }, // 4:5 horizontal swipe
  ],
  artisan: [
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 4:5 product cards
  ],
  vera: [
    { name: 'hero',  preferred: ['wide', 'tall'], count: 1 },           // full-screen hero
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // bento grid
  ],
  streetwear: [
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 4:5 grid cards
  ],
  gallery: [
    { name: 'cards', preferred: ['tall', 'square'], count: Infinity },   // 3:4 grid cards
  ],
};

/**
 * Given classified images and a template ID, distribute images into the template's slots.
 * 
 * Strategy:
 * 1. For each slot (in order), pick images that match the preferred shape first.
 * 2. If not enough, fill from remaining images — but skip images that are preferred
 *    by a later slot that still needs them (reservation system).
 * 3. Once an image is assigned, it's removed from the pool.
 * 4. Slots with count=Infinity get all remaining images.
 */
export function distributeImages(
  classified: ClassifiedImage[],
  templateId: string
): TemplateImageMap {
  const slots = TEMPLATE_SLOTS[templateId];
  if (!slots) {
    // Unknown template — just return all images in a 'default' slot
    return { default: classified.map(img => img.url) };
  }

  const result: TemplateImageMap = {};
  const pool = [...classified]; // mutable copy

  for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
    const slot = slots[slotIdx];
    const assigned: string[] = [];
    const needed = slot.count === Infinity ? pool.length : slot.count;

    // First pass: pick preferred shapes
    for (let i = 0; i < pool.length && assigned.length < needed; ) {
      if (slot.preferred.includes(pool[i].shape)) {
        assigned.push(pool[i].url);
        pool.splice(i, 1);
      } else {
        i++;
      }
    }

    // Build a set of shapes that later slots prefer (so we can avoid stealing them)
    const laterPreferred = new Set<ImageShape>();
    for (let j = slotIdx + 1; j < slots.length; j++) {
      for (const shape of slots[j].preferred) {
        laterPreferred.add(shape);
      }
    }

    // Second pass: fill remaining from any shape, but prefer images NOT reserved by later slots
    // Pass 2a: use images that no later slot wants
    for (let i = 0; i < pool.length && assigned.length < needed; ) {
      if (!laterPreferred.has(pool[i].shape)) {
        assigned.push(pool[i].url);
        pool.splice(i, 1);
      } else {
        i++;
      }
    }

    // Pass 2b: if still short, take remaining — but skip images that a later slot
    // specifically needs (e.g. don't let gallery steal the only tall image meant for banner)
    for (let i = 0; i < pool.length && assigned.length < needed; ) {
      const img = pool[i];
      let reservedByLater = false;
      for (let j = slotIdx + 1; j < slots.length; j++) {
        if (slots[j].preferred.includes(img.shape)) {
          const laterNeeded = slots[j].count === Infinity ? 1 : slots[j].count;
          const availableForLater = pool.filter(p => slots[j].preferred.includes(p.shape)).length;
          if (availableForLater <= laterNeeded) {
            reservedByLater = true;
            break;
          }
        }
      }
      if (!reservedByLater) {
        assigned.push(img.url);
        pool.splice(i, 1);
      } else {
        i++;
      }
    }

    // Pass 2c: absolute last resort — only take if nothing else exists
    while (assigned.length < needed && pool.length > 0) {
      assigned.push(pool[0].url);
      pool.splice(0, 1);
    }

    result[slot.name] = assigned;
  }

  return result;
}
