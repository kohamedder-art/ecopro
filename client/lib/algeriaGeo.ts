import wilayasRaw from '@/data/algeria-geo/wilayas.json';
import communesRaw from '@/data/algeria-geo/communes.json';

export type AlgeriaWilaya = {
  id: number;
  code: number;
  name: string;
  arabic_name?: string;
};

export type AlgeriaCommune = {
  id: string;
  wilaya_id: string;
  post_code?: string;
  name: string;
  arabic_name?: string;
};

const wilayas: AlgeriaWilaya[] = (wilayasRaw as any[])
  .map((w) => ({
    id: Number(w.id),
    code: Number(w.code),
    name: String(w.name),
    arabic_name: w.arabic_name ? String(w.arabic_name) : undefined,
  }))
  .filter((w) => Number.isFinite(w.id) && Number.isFinite(w.code) && !!w.name)
  .sort((a, b) => a.code - b.code);

const communes: AlgeriaCommune[] = (communesRaw as any[])
  .map((c) => ({
    id: String(c.id),
    wilaya_id: String(c.wilaya_id),
    post_code: c.post_code ? String(c.post_code) : undefined,
    name: String(c.name),
    arabic_name: c.arabic_name ? String(c.arabic_name) : undefined,
  }))
  .filter((c) => !!c.id && !!c.wilaya_id && !!c.name);

const wilayaById = new Map<string, AlgeriaWilaya>();
for (const w of wilayas) wilayaById.set(String(w.id), w);

const communeById = new Map<string, AlgeriaCommune>();
for (const c of communes) communeById.set(String(c.id), c);

const communesByWilayaId = new Map<string, AlgeriaCommune[]>();
for (const c of communes) {
  const key = String(c.wilaya_id);
  const arr = communesByWilayaId.get(key);
  if (arr) arr.push(c);
  else communesByWilayaId.set(key, [c]);
}
for (const [key, arr] of communesByWilayaId.entries()) {
  arr.sort((a, b) => a.name.localeCompare(b.name));
  communesByWilayaId.set(key, arr);
}

export function getAlgeriaWilayas(): AlgeriaWilaya[] {
  return wilayas;
}

export function getAlgeriaCommunesByWilayaId(wilayaId: string | number | null | undefined): AlgeriaCommune[] {
  if (!wilayaId) return [];
  return communesByWilayaId.get(String(wilayaId)) || [];
}

export function getAlgeriaWilayaById(wilayaId: string | number | null | undefined): AlgeriaWilaya | null {
  if (!wilayaId) return null;
  return wilayaById.get(String(wilayaId)) || null;
}

export function getAlgeriaCommuneById(communeId: string | number | null | undefined): AlgeriaCommune | null {
  if (!communeId) return null;
  return communeById.get(String(communeId)) || null;
}

export function formatWilayaLabel(w: AlgeriaWilaya): string {
  const code = String(w.code).padStart(2, '0');
  return `${code} - ${w.name}`;
}

/** Returns the Arabic name if available, otherwise falls back to Latin name */
export function communeDisplayName(c: AlgeriaCommune): string {
  return c.arabic_name || c.name;
}
