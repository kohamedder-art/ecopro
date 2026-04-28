export const DELIVERY_LOGO_FALLBACK_SRC = '/delivery-logos/placeholder.svg';
export const DELIVERY_LOGO_GENERIC_SRC = '/delivery-logos/fast-delivery-logo-template-free-vector.webp';

function normalizeCompanyName(name: string): string {
  return String(name || '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toSlug(name: string): string {
  return normalizeCompanyName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileCandidates(baseName: string): string[] {
  const slug = toSlug(baseName);
  if (!slug) return [];
  return [
    `/delivery-logos/${slug}.webp`,
    `/delivery-logos/${slug}.png`,
    `/delivery-logos/${slug}.jpg`,
    `/delivery-logos/${slug}.jpeg`,
  ];
}

export function getDeliveryCompanyLogoCandidates(companyName?: string | null): string[] {
  const raw = String(companyName || '').trim();
  const key = normalizeCompanyName(raw);
  if (!key) return [DELIVERY_LOGO_FALLBACK_SRC];

  // Exact/known logos available in /public/delivery-logos
  const pinned: string[] = [];

  // Newly added named files (case-insensitive handling via candidates below)
  if (key.includes('yalidine')) pinned.push('/delivery-logos/yalidine.png');
  if (key === 'noest') pinned.push('/delivery-logos/NOEST.png');
  if (key.includes('anderson')) pinned.push('/delivery-logos/anderson.png');
  if (key.includes('maystro')) pinned.push('/delivery-logos/maystro.png');
  if (key.includes('zimou')) pinned.push('/delivery-logos/zimou-express.svg');
  if (key === 'ems' || key.includes('express mail')) pinned.push('/delivery-logos/EMS.png');
  if (key === 'dhd' || key.includes('dhd')) pinned.push('/delivery-logos/Dhd.png');
  if (key.includes('ecom')) pinned.push('/delivery-logos/ecom.png');
  if (key.includes('elogistia')) pinned.push('/delivery-logos/elogistia-logo.png');

  // Older assets with non-slug filenames
  if (key === 'zr express' || key.includes('zr')) pinned.push('/delivery-logos/ZR-Express-1.webp');
  if (key.includes('poste') || key.includes('algerie poste') || key.includes('algerie-poste')) {
    pinned.push('/delivery-logos/poste-algerie-logo-png_seeklogo-272140.webp');
  }
  if (key.includes('baridimob') || key.includes('baridi mob')) {
    pinned.push('/delivery-logos/baridimob-logo-png_seeklogo-445029.webp');
  }
  if (key.includes('ecf')) pinned.push('/delivery-logos/ecf-logo-png_seeklogo-45349.webp');
  if (key.includes('prologis')) pinned.push('/delivery-logos/prologis-logo-png_seeklogo-311359.webp');

  // Try slug-derived filenames as well, so adding a file like /delivery-logos/guepex.png just works.
  const variants = new Set<string>();
  variants.add(raw);
  variants.add(key);
  variants.add(key.replace(/\bexpress\b/g, '').trim());
  variants.add(key.replace(/\bdelivery\b/g, '').trim());

  const derived: string[] = [];
  for (const v of variants) {
    derived.push(...fileCandidates(v));
  }

  // De-dupe while preserving priority order
  const out: string[] = [];
  for (const src of [...pinned, ...derived, DELIVERY_LOGO_GENERIC_SRC, DELIVERY_LOGO_FALLBACK_SRC]) {
    if (!out.includes(src)) out.push(src);
  }
  return out;
}

export function getDeliveryCompanyLogoSrc(companyName?: string | null): string {
  return getDeliveryCompanyLogoCandidates(companyName)[0] || DELIVERY_LOGO_FALLBACK_SRC;
}
