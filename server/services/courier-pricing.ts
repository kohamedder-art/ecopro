/**
 * Courier Pricing Auto-Import
 *
 * Reads delivery prices (home + desk per wilaya) from a connected delivery
 * company's API and stores them in `delivery_prices`, so sellers never have
 * to enter them manually when the API provides them.
 *
 * Companies whose API exposes no pricing endpoint are NOT supported here —
 * for those, sellers keep entering prices manually (existing dashboard flow).
 */
import { ensureConnection } from '../utils/database';
import { YalidineService } from './couriers/yalidine';
import { ProColisService } from './couriers/procolis';

export interface ImportedPrice {
  wilaya_id: number;
  home_delivery_price: number;
  desk_delivery_price: number | null;
}

export interface FailedWilaya {
  wilaya_id: number;
  error: string;
}

export interface PriceImportResult {
  /** false when the company's API exposes no pricing (→ manual entry) */
  supported: boolean;
  source: string;
  imported: ImportedPrice[];
  failed: FailedWilaya[];
}

type SupportedCompany = 'maystro' | 'yalidine' | 'guepex' | 'procolis';

/** Which companies expose a pricing API we can auto-import from. */
export function priceImportSupport(companyName: string): SupportedCompany | null {
  const n = String(companyName || '').toLowerCase();
  if (n.includes('maystro')) return 'maystro';
  if (n.includes('yalidine')) return 'yalidine';
  if (n.includes('guepex')) return 'guepex';
  if (n.includes('procolis') || n.includes('procolis')) return 'procolis';
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Pick the first present numeric key from a list of candidates. */
function pickNum(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = num(obj[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

// ─── Maystro ──────────────────────────────────────────────
// Same pattern as before: per wilaya, take the first commune, then read
// its home / stopdesk delivery options.
const MAYSTRO_API_BASE = 'https://orders-management.maystro-delivery.com/api';

async function fetchMaystroPrices(token: string): Promise<PriceImportResult> {
  const imported: ImportedPrice[] = [];
  const failed: FailedWilaya[] = [];
  for (let wilayaId = 1; wilayaId <= 58; wilayaId++) {
    try {
      const communesRes = await fetch(
        `${MAYSTRO_API_BASE}/base/communes/?wilaya=${encodeURIComponent(String(wilayaId))}`,
        { headers: { Authorization: token } }
      );
      if (!communesRes.ok) throw new Error(`communes failed (${communesRes.status})`);
      const communes = await communesRes.json();
      if (!Array.isArray(communes) || !communes.length || !communes[0]?.id) {
        failed.push({ wilaya_id: wilayaId, error: 'No communes returned by Maystro' });
        continue;
      }
      const optionsRes = await fetch(
        `${MAYSTRO_API_BASE}/base/delivery-options/?commune=${encodeURIComponent(String(communes[0].id))}`,
        { headers: { Authorization: token } }
      );
      if (!optionsRes.ok) throw new Error(`delivery-options failed (${optionsRes.status})`);
      const options = await optionsRes.json();
      const list = Array.isArray(options) ? options : [];
      const home = list.find((o: any) => String(o?.type || '').toLowerCase() === 'home');
      const desk = list.find((o: any) => String(o?.type || '').toLowerCase() === 'stopdesk');
      const homePrice = num(home?.price);
      if (homePrice === null) {
        failed.push({ wilaya_id: wilayaId, error: 'Home delivery option not found' });
        continue;
      }
      imported.push({ wilaya_id: wilayaId, home_delivery_price: homePrice, desk_delivery_price: num(desk?.price) });
    } catch (e: any) {
      failed.push({ wilaya_id: wilayaId, error: e?.message || 'Unknown import error' });
    }
  }
  return { supported: true, source: 'Maystro', imported, failed };
}

// ─── Yalidine ─────────────────────────────────────────────
// GET /v1/deliveryfees/?from_wilaya_id=&to_wilaya_id=&weight=&is_stopdesk=
// Fees depend on the origin wilaya; sellers ship from Alger (16) by default.
async function fetchYalidinePrices(apiKey: string, apiSecret: string | undefined, fromWilaya = 16): Promise<PriceImportResult> {
  const svc = new YalidineService();
  const apiId = apiSecret || undefined;
  const imported: ImportedPrice[] = [];
  const failed: FailedWilaya[] = [];
  for (let wilayaId = 1; wilayaId <= 58; wilayaId++) {
    try {
      const fees = await svc.getDeliveryFees(fromWilaya, wilayaId, 1, false, apiKey, apiId);
      const homePrice = num((fees as any)?.home_fee ?? (fees as any)?.home ?? (fees as any)?.home_price);
      if (homePrice === null) {
        failed.push({ wilaya_id: wilayaId, error: 'No fee returned by Yalidine' });
        continue;
      }
      imported.push({
        wilaya_id: wilayaId,
        home_delivery_price: homePrice,
        desk_delivery_price: num((fees as any)?.desk_fee ?? (fees as any)?.desk ?? (fees as any)?.desk_price),
      });
    } catch (e: any) {
      failed.push({ wilaya_id: wilayaId, error: e?.message || 'Unknown import error' });
    }
    await sleep(100);
  }
  return { supported: true, source: 'Yalidine', imported, failed };
}

// ─── Guepex (Yalidine-compatible API) ─────────────────────
// Guepex mirrors the Yalidine API shape, so we probe the same endpoint.
// If it answers, prices import; otherwise the company falls back to manual.
async function fetchGuepexPrices(apiKey: string, apiSecret: string | undefined, fromWilaya = 16): Promise<PriceImportResult> {
  const imported: ImportedPrice[] = [];
  const failed: FailedWilaya[] = [];
  let answered = false;
  for (let wilayaId = 1; wilayaId <= 58; wilayaId++) {
    try {
      const params = new URLSearchParams({
        from_wilaya_id: String(fromWilaya),
        to_wilaya_id: String(wilayaId),
        weight: '1',
        is_stopdesk: 'false',
      });
      const res = await fetch(`https://api.guepex.app/v1/deliveryfees/?${params}`, {
        headers: { 'X-API-KEY': apiKey, 'X-API-TOKEN': apiSecret || apiKey },
      });
      if (!res.ok) throw new Error(`deliveryfees failed (${res.status})`);
      answered = true;
      const data = await res.json();
      const homePrice = pickNum(data, ['home_fee', 'home', 'home_price', 'domicile']);
      if (homePrice === null) {
        failed.push({ wilaya_id: wilayaId, error: 'No fee returned by Guepex' });
        continue;
      }
      imported.push({
        wilaya_id: wilayaId,
        home_delivery_price: homePrice,
        desk_delivery_price: pickNum(data, ['desk_fee', 'desk', 'desk_price', 'stopdesk']),
      });
    } catch (e: any) {
      failed.push({ wilaya_id: wilayaId, error: e?.message || 'Unknown import error' });
    }
    await sleep(100);
  }
  if (!answered || imported.length === 0) {
    return { supported: false, source: 'Guepex', imported: [], failed };
  }
  return { supported: true, source: 'Guepex', imported, failed };
}

// ─── ProColis ─────────────────────────────────────────────
// GET /tarification returns the full tariff table (shape varies) —
// normalize defensively into per-wilaya rows.
function normalizeProcolisTarification(data: any): ImportedPrice[] {
  const out: ImportedPrice[] = [];
  const WILAYA_KEYS = ['wilaya', 'wilaya_id', 'id_wilaya', 'code', 'id', 'wilayaId'];
  const HOME_KEYS = ['home', 'home_price', 'domicile', 'a_domicile', 'price_home', 'homePrice'];
  const DESK_KEYS = ['desk', 'desk_price', 'stopdesk', 'stop_desk', 'bureau', 'price_desk', 'deskPrice'];
  const pushRow = (wilayaRaw: any, obj: any) => {
    const wilayaId = num(wilayaRaw);
    const home = pickNum(obj, HOME_KEYS);
    if (wilayaId === null || wilayaId < 1 || wilayaId > 58 || home === null) return;
    out.push({ wilaya_id: wilayaId, home_delivery_price: home, desk_delivery_price: pickNum(obj, DESK_KEYS) });
  };
  const list = Array.isArray(data) ? data
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.tarifs) ? data.tarifs
    : Array.isArray(data?.tarification) ? data.tarification
    : null;
  if (list) {
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      let wilayaRaw: any = null;
      for (const k of WILAYA_KEYS) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') { wilayaRaw = row[k]; break; }
      }
      pushRow(wilayaRaw, row);
    }
    return out;
  }
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      pushRow(k, v);
    }
  }
  return out;
}

async function fetchProcolisPrices(apiKey: string, apiSecret?: string): Promise<PriceImportResult> {
  const svc = new ProColisService();
  const data = await svc.getTarification(apiKey, apiSecret).catch(() => null);
  const imported = normalizeProcolisTarification(data);
  if (imported.length === 0) {
    return { supported: true, source: 'ProColis', imported: [], failed: [{ wilaya_id: 0, error: 'Tarification table empty or unrecognized shape' }] };
  }
  return { supported: true, source: 'ProColis', imported, failed: [] };
}

// ─── DB upsert (shared) ───────────────────────────────────
async function saveImportedPrices(
  clientId: number,
  companyId: number,
  source: string,
  rows: ImportedPrice[]
): Promise<void> {
  const pool = await ensureConnection();
  for (const row of rows) {
    await pool.query(
      `INSERT INTO delivery_prices (
        client_id, wilaya_id, delivery_company_id, home_delivery_price,
        desk_delivery_price, is_active, estimated_days, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, 3, $6, NOW())
      ON CONFLICT (client_id, wilaya_id, delivery_company_id)
      DO UPDATE SET
        home_delivery_price = EXCLUDED.home_delivery_price,
        desk_delivery_price = EXCLUDED.desk_delivery_price,
        is_active = true,
        updated_at = NOW()`,
      [clientId, row.wilaya_id, companyId, row.home_delivery_price, row.desk_delivery_price, `Auto-imported from ${source}`]
    );
  }
}

// ─── Dispatcher ───────────────────────────────────────────
export interface ImportCompanyPricesOpts {
  clientId: number;
  companyId: number;
  companyName: string;
  /** plaintext credentials (decrypt before calling, or pass through from configure) */
  apiKey: string;
  apiSecret?: string;
  /** origin wilaya for origin-dependent fees (Yalidine/Guepex); default Alger (16) */
  fromWilaya?: number;
}

export async function importCompanyPrices(opts: ImportCompanyPricesOpts): Promise<PriceImportResult> {
  const kind = priceImportSupport(opts.companyName);
  const fromWilaya = opts.fromWilaya ?? 16;
  let result: PriceImportResult;
  switch (kind) {
    case 'maystro':
      result = await fetchMaystroPrices(opts.apiKey);
      break;
    case 'yalidine':
      result = await fetchYalidinePrices(opts.apiKey, opts.apiSecret, fromWilaya);
      break;
    case 'guepex':
      result = await fetchGuepexPrices(opts.apiKey, opts.apiSecret, fromWilaya);
      break;
    case 'procolis':
      result = await fetchProcolisPrices(opts.apiKey, opts.apiSecret);
      break;
    default:
      return { supported: false, source: opts.companyName, imported: [], failed: [] };
  }
  if (result.supported && result.imported.length > 0) {
    await saveImportedPrices(opts.clientId, opts.companyId, result.source, result.imported);
  }
  // Guepex probe answered nothing usable → treat as unsupported (manual entry)
  if (kind === 'guepex' && result.imported.length === 0) {
    return { ...result, supported: false };
  }
  return result;
}
