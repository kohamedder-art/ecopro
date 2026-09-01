import type { Request, Response, NextFunction } from 'express';

const PAGE_VIEW_FLUSH_INTERVAL = 5000;
const PAGE_VIEW_FLUSH_IDLE_INTERVAL = 30_000;
const PAGE_VIEW_BATCH_MAX = 500;
type PageViewKey = string;
const buffer = new Map<PageViewKey, number>();

function getKey(date: string, group: string, isStore: boolean, slug: string | null): PageViewKey {
  return `${date}|${group}|${isStore}|${slug || ''}`;
}

function getDateStr(d?: Date): string {
  const dt = d || new Date();
  return dt.toISOString().slice(0, 10);
}

async function flushBuffer(): Promise<boolean> {
  if (buffer.size === 0) return false;
  const entries = Array.from(buffer.entries());
  buffer.clear();
  try {
    const { pool } = await import('./database');
    for (let i = 0; i < entries.length; i += PAGE_VIEW_BATCH_MAX) {
      const slice = entries.slice(i, i + PAGE_VIEW_BATCH_MAX);
      const values: any[] = [];
      const rows: string[] = [];
      slice.forEach(([, count], idx) => {
        const [viewDate, pathGroup, isStore, storeSlug] = slice[idx][0].split('|');
        const base = idx * 5;
        rows.push(`($${base + 1}, $${base + 2}, $${base + 3}::boolean, NULLIF($${base + 4}, ''), $${base + 5})`);
        values.push(viewDate, pathGroup, isStore === 'true', storeSlug || null, count);
      });
      await pool.query(
        `INSERT INTO platform_daily_page_views (view_date, path_group, is_store, store_slug, count)
         VALUES ${rows.join(', ')}
         ON CONFLICT (view_date, path_group)
         DO UPDATE SET count = platform_daily_page_views.count + EXCLUDED.count`,
        values
      );
    }
  } catch (e) {
    console.error('[pageViews] flush failed:', (e as Error)?.message);
  }
  return true;
}

let pageViewFlushInterval: ReturnType<typeof setInterval> | null = null;
let lastFlushHadData = false;

function scheduleFlush() {
  clearInterval(pageViewFlushInterval as ReturnType<typeof setInterval>);
  const nextMs = lastFlushHadData ? PAGE_VIEW_FLUSH_INTERVAL : PAGE_VIEW_FLUSH_IDLE_INTERVAL;
  pageViewFlushInterval = setInterval(async () => {
    lastFlushHadData = await flushBuffer();
    scheduleFlush();
  }, nextMs);
}

scheduleFlush();

export function pageViewMiddleware(req: Request, _res: Response, next: NextFunction) {
  const path = (req.originalUrl || req.url || '').split('?')[0] || '';
  const method = req.method.toUpperCase();
  if (method !== 'GET') return next();
  if (path.startsWith('/api/') || path.startsWith('/__') || path === '/favicon.ico') return next();

  let isStore = false;
  let slug: string | null = null;
  let group = 'platform';

  const storeMatch = path.match(/^\/store\/([^/?#]+)/);
  if (storeMatch) {
    isStore = true;
    slug = storeMatch[1];
    group = `store:${slug}`;
  } else if (path === '/' || path === '') {
    group = 'home';
  } else {
    group = path.split('/')[1] || 'other';
  }

  const key = getKey(getDateStr(), group, isStore, slug);
  const wasEmpty = buffer.size === 0;
  buffer.set(key, (buffer.get(key) || 0) + 1);
  // If we just went from idle (empty buffer) to having data, flush promptly so
  // a single visit isn't held in RAM for the whole idle window.
  if (wasEmpty) {
    setTimeout(() => { void flushBuffer(); }, 1000);
  }
  next();
}

export async function getVisitorAnalytics() {
  try {
    const { pool } = await import('./database');

    const today = getDateStr();
    const weekAgo = getDateStr(new Date(Date.now() - 7 * 86400000));
    const monthAgo = getDateStr(new Date(Date.now() - 30 * 86400000));
    const yearAgo = getDateStr(new Date(Date.now() - 365 * 86400000));

    const [todayR, weekR, monthR, yearR, storesR] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(count), 0) as total, COALESCE(SUM(count) FILTER (WHERE NOT is_store), 0) as platform, COALESCE(SUM(count) FILTER (WHERE is_store), 0) as stores FROM platform_daily_page_views WHERE view_date = $1`, [today]),
      pool.query(`SELECT COALESCE(SUM(count), 0) as total, COALESCE(SUM(count) FILTER (WHERE NOT is_store), 0) as platform, COALESCE(SUM(count) FILTER (WHERE is_store), 0) as stores FROM platform_daily_page_views WHERE view_date >= $1`, [weekAgo]),
      pool.query(`SELECT COALESCE(SUM(count), 0) as total, COALESCE(SUM(count) FILTER (WHERE NOT is_store), 0) as platform, COALESCE(SUM(count) FILTER (WHERE is_store), 0) as stores FROM platform_daily_page_views WHERE view_date >= $1`, [monthAgo]),
      pool.query(`SELECT COALESCE(SUM(count), 0) as total, COALESCE(SUM(count) FILTER (WHERE NOT is_store), 0) as platform, COALESCE(SUM(count) FILTER (WHERE is_store), 0) as stores FROM platform_daily_page_views WHERE view_date >= $1`, [yearAgo]),
      pool.query(`SELECT store_slug, SUM(count) as views FROM platform_daily_page_views WHERE is_store = true AND view_date >= $1 GROUP BY store_slug ORDER BY views DESC LIMIT 20`, [monthAgo]),
    ]);

    // Enrich store slugs with store names
    const storeSlugs = storesR.rows.map((r: any) => r.store_slug);
    let storeNames = new Map<string, string>();
    if (storeSlugs.length > 0) {
      try {
        const nameR = await pool.query(`SELECT store_slug, store_name FROM client_store_settings WHERE store_slug = ANY($1)`, [storeSlugs]);
        for (const r of nameR.rows) {
          storeNames.set(r.store_slug, r.store_name);
        }
      } catch { /* ignore */ }
    }

    const topStores = storesR.rows.slice(0, 10).map((r: any) => ({
      slug: r.store_slug,
      name: storeNames.get(r.store_slug) || r.store_slug,
      views: parseInt(r.views),
    }));

    return {
      today: { total: parseInt(todayR.rows[0].total), platform: parseInt(todayR.rows[0].platform), stores: parseInt(todayR.rows[0].stores) },
      week: { total: parseInt(weekR.rows[0].total), platform: parseInt(weekR.rows[0].platform), stores: parseInt(weekR.rows[0].stores) },
      month: { total: parseInt(monthR.rows[0].total), platform: parseInt(monthR.rows[0].platform), stores: parseInt(monthR.rows[0].stores) },
      year: { total: parseInt(yearR.rows[0].total), platform: parseInt(yearR.rows[0].platform), stores: parseInt(yearR.rows[0].stores) },
      topStores,
    };
  } catch (e) {
    console.error('[pageViews] query failed:', (e as Error)?.message);
    return {
      today: { total: 0, platform: 0, stores: 0 },
      week: { total: 0, platform: 0, stores: 0 },
      month: { total: 0, platform: 0, stores: 0 },
      year: { total: 0, platform: 0, stores: 0 },
      topStores: [],
    };
  }
}
