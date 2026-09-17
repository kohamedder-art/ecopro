/**
 * Store scope resolution for multi-store accounts.
 *
 * Every AI entry point must resolve WHICH store it serves:
 * - customer messages → store from the bot connection (bot_settings / tokens / subscribers)
 * - owner dashboard   → active store sent by the client (FloatingChatBubble)
 *
 * Fallback is always the account's first store (legacy single-store behavior).
 * Callers MUST validate ownership through resolveStore — never trust a raw id.
 */
import { ensureConnection } from '../utils/database';

export interface StoreRef {
  id: number;
  name: string;
}

export interface ResolvedStore {
  /** Resolved store id (first store fallback when ambiguous/unknown). Null only if account has no stores. */
  storeId: number | null;
  storeName: string;
  /** True when the account owns more than one store. */
  multi: boolean;
  /** True when multi-store AND no explicit store was given (caller should confirm for writes). */
  ambiguous: boolean;
  all: StoreRef[];
}

export async function listStores(clientId: number): Promise<StoreRef[]> {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT id, COALESCE(NULLIF(store_name, ''), 'المتجر') as name
     FROM client_store_settings WHERE client_id = $1 ORDER BY id`,
    [clientId]
  );
  return res.rows.map((r: any) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function resolveStore(clientId: number, preferredId?: number | null): Promise<ResolvedStore> {
  const stores = await listStores(clientId).catch(() => [] as StoreRef[]);
  if (stores.length === 0) {
    return { storeId: null, storeName: 'المتجر', multi: false, ambiguous: false, all: [] };
  }
  if (preferredId != null) {
    const hit = stores.find((s) => s.id === Number(preferredId));
    if (hit) return { storeId: hit.id, storeName: hit.name, multi: stores.length > 1, ambiguous: false, all: stores };
    // Invalid/foreign id → fall through to default (never trust it)
  }
  const first = stores[0];
  return {
    storeId: first.id,
    storeName: first.name,
    multi: stores.length > 1,
    ambiguous: stores.length > 1 && preferredId == null,
    all: stores,
  };
}

// Arabic + French + English write-intent keywords (owner AI confirmation gate).
const WRITE_PATTERNS = [
  // Arabic
  /عدّل|عدل|غيّر|غير|احذف|امسح|أضف|اضف|أنشئ|انشئ|حدّث|حدث|صمّم|صمم|بدّل|بدل|فعّل|فعل|عطّل|عطل|أوقف|اوقف|أنشر|انشر|اخف|أخفِ|غيّر السعر|زِد|زد|انقص|خصم/,
  // French / English
  /\b(modifi|change|update|ajoute?r?|crée?r?|supprim|delete|create|add|edit|désactive?r?|active?r?|design|prix|price|stock|remise|discount)\b/i,
];

export function looksLikeWrite(text: string): boolean {
  const t = String(text || '');
  return WRITE_PATTERNS.some((re) => re.test(t));
}

export function askWhichStoreMessage(stores: StoreRef[], locale: string = 'ar'): string {
  const list = stores.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
  if (locale === 'ar') {
    return `لديك ${stores.length} متاجر. أي متجر تقصد؟\n${list}\n\nأجب برقم المتجر أو اسمه، وسأنفذ طلبك فوراً.`;
  }
  return `You have ${stores.length} stores. Which one do you mean?\n${list}\n\nReply with the number or name and I'll proceed.`;
}
