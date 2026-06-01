import { RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';

const SUBDOMAIN_CACHE = new Map<string, { slug: string; ts: number }>();
const CACHE_TTL = 30_000;

function getCached(subdomain: string): string | null {
  const entry = SUBDOMAIN_CACHE.get(subdomain);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.slug;
  if (entry) SUBDOMAIN_CACHE.delete(subdomain);
  return null;
}

function setCached(subdomain: string, slug: string) {
  SUBDOMAIN_CACHE.set(subdomain, { slug, ts: Date.now() });
  if (SUBDOMAIN_CACHE.size > 500) {
    const oldest = SUBDOMAIN_CACHE.entries().next().value;
    if (oldest) SUBDOMAIN_CACHE.delete(oldest[0]);
  }
}

export function invalidateSubdomainCache(subdomain: string) {
  SUBDOMAIN_CACHE.delete(subdomain);
}

export const subdomainResolver: RequestHandler = async (req, res, next) => {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const cleanHost = host.split(',')[0].trim().toLowerCase();

  const match = cleanHost.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.sahla4eco\.com$/);
  if (!match || match[1] === 'www' || match[1] === 'mail' || match[1] === 'ftp') return next();

  const subdomain = match[1];

  const cached = getCached(subdomain);
  if (cached) {
    (req as any).storeSlug = cached;
    return next();
  }

  try {
    const pool = await ensureConnection();
    const result = await pool.query(
      `SELECT store_slug, store_name, template FROM client_store_settings WHERE subdomain = $1 LIMIT 1`,
      [subdomain]
    );

    let storeSlug: string | null = null;
    if (result.rows.length > 0) {
      storeSlug = result.rows[0].store_slug;
    }

    if (!storeSlug) {
      return res.status(404).type('html').send(`
        <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>المتجر غير موجود</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;color:#333}
        .card{text-align:center;padding:3rem;max-width:420px}.card h1{font-size:1.5rem;margin-bottom:.5rem}
        .card p{color:#666;font-size:.9rem}</style></head><body>
        <div class="card"><h1>المتجر غير موجود</h1><p>لم يتم العثور على متجر بهذا الرابط. تأكد من صحة الرابط.</p></div></body></html>
      `);
    }

    setCached(subdomain, storeSlug);
    (req as any).storeSlug = storeSlug;
    // Redirect root path to the store page so the SPA renders the storefront for subdomain requests
    if (req.path === '/') {
      return res.redirect(302, `/store/${encodeURIComponent(storeSlug)}`);
    }
    next();
  } catch (err) {
    console.error('[subdomain] resolve error:', (err as any)?.message);
    next();
  }
};

export const resolveSubdomainApi: RequestHandler = async (req, res) => {
  const storeSlug = (req as any).storeSlug;
  if (!storeSlug) return res.status(404).json({ error: 'Not a subdomain' });
  try {
    const pool = await ensureConnection();
    const result = await pool.query(
      `SELECT store_slug, store_name, template FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
      [storeSlug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Store not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve store' });
  }
};
