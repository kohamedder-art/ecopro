import { ensureConnection } from './database';

const cache = new Map<string, string>();
let loaded = false;

async function loadAll(): Promise<void> {
  try {
    const pool = await ensureConnection();
    const { rows } = await pool.query('SELECT key, value FROM security_settings');
    cache.clear();
    for (const r of rows) cache.set(r.key, r.value);
    loaded = true;
  } catch {
    // DB not ready yet -- will retry on next read
  }
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  if (!loaded) await loadAll();
  return cache.get(key) ?? defaultValue;
}

export async function getSettingInt(key: string, defaultValue: number): Promise<number> {
  const v = await getSetting(key, String(defaultValue));
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

export async function getSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const v = await getSetting(key, String(defaultValue));
  return v === 'true';
}

export async function setSetting(key: string, value: string): Promise<void> {
  const pool = await ensureConnection();
  await pool.query(
    `INSERT INTO security_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
  cache.set(key, value);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  if (!loaded) await loadAll();
  return Object.fromEntries(cache.entries());
}

export function invalidateCache(): void {
  loaded = false;
}
