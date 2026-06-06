import { RequestHandler } from "express";
import { ensureConnection, ensureMigrationsReady } from "../utils/database";
import { sendBotMessagesForOrder } from "./order-confirmation";
import { createOrderTelegramLink } from "../utils/telegram";
import { createConfirmationLink, sendTelegramMessage, replaceTemplateVariables } from "../utils/bot-messaging";
import { ensureBotSettingsRow } from "../utils/client-provisioning";
import { assessOrderRisk } from "../utils/fraud-detection";
import { z, ZodError } from "zod";
import type { Pool } from "pg";
import { notifyOrderCreated } from '../services/push-notifications';

const StoreSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => v !== 'null' && v !== 'undefined', { message: 'Invalid store ID' });

const ProductSlugSchema = z.string().trim().min(1).max(200);
const ProductIdSchema = z.preprocess((v) => Number(v), z.number().int().positive());

const VariantIdSchema = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().positive()
);

type CacheEntry<T> = { value: T; expiresAt: number };

const isDev = process.env.NODE_ENV !== 'production';
const SETTINGS_CACHE_TTL_MS = Number(
  process.env.STOREFRONT_SETTINGS_CACHE_TTL_MS ?? (isDev ? 5_000 : 60_000)
);
const PRODUCTS_CACHE_TTL_MS = Number(
  process.env.STOREFRONT_PRODUCTS_CACHE_TTL_MS ?? (isDev ? 10_000 : 120_000)
);

const storefrontSettingsCache = new Map<string, CacheEntry<any>>();
const storefrontSettingsInFlight = new Map<string, Promise<any>>();
const storefrontProductsCache = new Map<string, CacheEntry<any[]>>();
const storefrontProductsInFlight = new Map<string, Promise<any[]>>();

/**
 * Invalidate public storefront settings cache for a given store slug.
 * Called from client-store routes after settings/template updates.
 */
export function invalidateStorefrontSettingsCache(storeSlug: string) {
  if (storeSlug) {
    storefrontSettingsCache.delete(`settings:${storeSlug}`);
    storefrontSettingsInFlight.delete(`settings:${storeSlug}`);
  }
}

/**
 * Invalidate ALL entries in the public storefront settings cache.
 * Useful when we only have a clientId but not the store slug.
 */
export function invalidateAllStorefrontSettingsCache() {
  storefrontSettingsCache.clear();
  storefrontSettingsInFlight.clear();
}

export function invalidateStorefrontProductsCache(storeSlug?: string) {
  if (storeSlug) {
    storefrontProductsCache.delete(`products:${storeSlug}`);
    storefrontProductsInFlight.delete(`products:${storeSlug}`);
  } else {
    storefrontProductsCache.clear();
    storefrontProductsInFlight.clear();
  }
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
}

function isRetryableDbError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  return (
    msg.includes('query read timeout') ||
    msg.includes('connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket') && msg.includes('hang up') ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET'
  );
}

async function withDbRetry<T>(operation: (db: Pool) => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const db = await ensureConnection();
      return await operation(db as any);
    } catch (err: any) {
      lastErr = err;
      if (!isRetryableDbError(err) || attempt === maxRetries) throw err;
      const delay = Math.min(250 * Math.pow(2, attempt) + Math.random() * 150, 1500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function getStoreOrdersColumns(): Promise<Set<string>> {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'store_orders'`
  );
  return new Set<string>(res.rows.map((r: any) => String(r.column_name)));
}

// Get all products for a storefront
export const getStorefrontProducts: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const startTime = Date.now();
  let storeSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid store ID' });
  }

  // CDN-friendly caching: 60s, serve stale for 5 min
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');

  const cacheKey = `products:${storeSlug}`;
  const cached = getCached(storefrontProductsCache, cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const inFlight = storefrontProductsInFlight.get(cacheKey);
  if (inFlight) {
    try {
      const value = await inFlight;
      return res.json(value);
    } catch (e) {
      storefrontProductsInFlight.delete(cacheKey);
      // fall through to normal handler
    }
  }

  try {
    if (!isProduction) {
      console.log(`[Storefront] Fetching products for store: ${storeSlug}`);
    }
    const promise = (async () => {
      const pool = await ensureConnection();
      if (!isProduction) {
        console.log(`[Storefront] DB connection established in ${Date.now() - startTime}ms`);
      }

      // IMPORTANT PERFORMANCE NOTE:
      // REGEXP_REPLACE-based matching forces a scan and is very slow on remote DB.
      // Try indexed store_slug exact match first, then fall back only if needed.
      let clientCheck = await withDbRetry<any>((db) =>
        db.query(
          `SELECT client_id FROM client_store_settings WHERE store_slug = $1`,
          [storeSlug]
        ) as any
      );
      if (clientCheck.rows.length === 0) {
        clientCheck = await withDbRetry<any>((db) =>
          db.query(
            `SELECT client_id FROM client_store_settings 
             WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
            [storeSlug]
          ) as any
        );
      }

      if (clientCheck.rows.length > 0) {
        const clientId = clientCheck.rows[0].client_id;
        if (!isProduction) {
          console.log(`Loading client store ${storeSlug} for client ID ${clientId}`);
        }
        // Include store-level fields so product cards can show owner/store info without extra round-trip
        const result = await withDbRetry<any>((db) =>
          db.query(
            `SELECT 
              p.id, p.title, p.description, p.price, p.original_price, 
              p.images, p.category, p.stock_quantity, p.is_featured, 
              p.slug, p.views, p.created_at, p.metadata,
              s.store_name, s.owner_name AS seller_name
            FROM client_store_products p
            INNER JOIN client_store_settings s ON p.client_id = s.client_id
            WHERE p.client_id = $1 AND p.status = 'active'
            ORDER BY p.is_featured DESC, p.created_at DESC`,
            [clientId]
          ) as any
        );
        if (!isProduction) {
          console.log(`Found ${result.rows.length} client products for store ${storeSlug}`);
        }

        // Fetch variants for all products in one query
        const productIds = result.rows.map((p: any) => p.id);
        let variantsByProduct: Record<number, any[]> = {};
        if (productIds.length > 0) {
          try {
            const vRes = await pool.query(
              `SELECT id, product_id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
               FROM product_variants
               WHERE product_id = ANY($1) AND is_active = true
               ORDER BY sort_order ASC, id ASC`,
              [productIds]
            );
            for (const v of vRes.rows) {
              const pid = Number(v.product_id);
              if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
              variantsByProduct[pid].push(v);
            }
          } catch {
            // Variants table may not exist yet — continue without
          }
        }

        // Ensure all products have a slug (generate fallback if missing)
        const productsWithSlugs = result.rows.map((p: any) => ({
          ...p,
          slug: p.slug || `${String(p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`,
          variants: variantsByProduct[p.id] || [],
        }));
        // Strip base64 data URIs from images to keep payload small on slow connections.
        // Only keep URL-based images (Cloudinary, etc.) that load lazily in the browser.
        const isDataUri = (s: string) => typeof s === 'string' && s.startsWith('data:');
        const cleanProducts = productsWithSlugs.map((p: any) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images.filter((img: string) => !isDataUri(img)) : p.images,
        }));
        setCached(storefrontProductsCache, cacheKey, cleanProducts, PRODUCTS_CACHE_TTL_MS);
        return cleanProducts;
      }

      // Otherwise try seller storefronts (seller_store_settings) and return marketplace_products
      let sellerCheck = await withDbRetry<any>((db) =>
        db.query(
          `SELECT seller_id FROM seller_store_settings WHERE store_slug = $1`,
          [storeSlug]
        )
      );
      if (sellerCheck.rows.length === 0) {
        sellerCheck = await withDbRetry<any>((db) =>
          db.query(
            `SELECT seller_id FROM seller_store_settings 
             WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
            [storeSlug]
          )
        );
      }
      if (sellerCheck.rows.length === 0) {
        if (!isProduction) {
          console.log(`Store not found: ${storeSlug}`);
        }
        return [];
      }
      const sellerId = sellerCheck.rows[0].seller_id;
      if (!isProduction) {
        console.log(`Loading seller store ${storeSlug} for seller ID ${sellerId}`);
      }
      const mResult = await withDbRetry<any>((db) =>
        db.query(
          `SELECT p.id, p.title, p.description, p.price, p.original_price, p.images, p.category, p.stock, p.condition, p.location, p.shipping_available AS shipping, p.views, p.created_at,
                  ss.store_name, sel.name AS seller_name, sel.email AS seller_email
           FROM marketplace_products p
           INNER JOIN seller_store_settings ss ON p.seller_id = ss.seller_id
           LEFT JOIN sellers sel ON p.seller_id = sel.id
           WHERE p.seller_id = $1 AND p.status = 'active'
           ORDER BY p.created_at DESC`,
          [sellerId]
        )
      );
      if (!isProduction) {
        console.log(`Found ${mResult.rows.length} marketplace products for seller store ${storeSlug}`);
      }
      setCached(storefrontProductsCache, cacheKey, mResult.rows, PRODUCTS_CACHE_TTL_MS);
      return mResult.rows;
    })();

    storefrontProductsInFlight.set(cacheKey, promise);
    const value = await promise;
    storefrontProductsInFlight.delete(cacheKey);
    res.json(value);
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error('Get storefront products error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
// Get store settings for a storefront
export const getStorefrontSettings: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const startTime = Date.now();
  let storeSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid store ID' });
  }

  // CDN-friendly caching: 60s, serve stale for 5 min
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');

  try {
    if (!isProduction) {
      console.log(`[Storefront] Fetching settings for store: ${storeSlug}`);
    }

    const cacheKey = `settings:${storeSlug}`;
    const cached = getCached(storefrontSettingsCache, cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const inFlight = storefrontSettingsInFlight.get(cacheKey);
    if (inFlight) {
      try {
        const value = await inFlight;
        return res.json(value);
      } catch {
        storefrontSettingsInFlight.delete(cacheKey);
        // fall through to normal handler
      }
    }
    
    // Helper function to convert store name to clean format (same as client-side)
    // Preserves case, removes spaces only
    const storeNameToClean = (name: string): string => {
      return name
        .trim()
        .replace(/\s+/g, '')           // Remove spaces
        .replace(/[^a-zA-Z0-9]/g, '')  // Remove non-alphanumeric
        || 'store';
    };

    // First, try to find by exact store_slug match
    let querySlug = storeSlug;

    const normalizeTemplateIdForPublic = (id: any): string => {
      const raw = String(id || '')
        .trim()
        .toLowerCase()
        .replace(/^gold-/, '')
        .replace(/-gold$/, '');
      if (!raw) return 'pro';
      if (raw === 'shiro-hana') return 'pro';
      if (raw === 'babyos' || raw === 'baby') return 'kids';
      return raw;
    };
    
    const promise = (async () => {
      const pool = await ensureConnection();
      if (!isProduction) {
        console.log(`[Storefront] DB connection established in ${Date.now() - startTime}ms`);
      }

      // Try client storefront settings first
      let clientRes: any;
      const selectClientSettings = (whereSql: string) =>
        `SELECT store_name, store_description, store_logo, 
                primary_color, secondary_color,
                template, banner_url, 'DZD' as currency_code,
                hero_main_url, hero_tile1_url, hero_tile2_url, 
                store_images,
                owner_name, owner_email,
                template_hero_heading, template_hero_subtitle, template_button_text, template_accent_color, template_bg_color,
                template_settings, template_settings_by_template, global_settings,
                store_slug
         FROM client_store_settings
         ${whereSql}`;

      const selectClientSettingsLegacy = (whereSql: string) =>
        `SELECT store_name, store_description, store_logo, primary_color, secondary_color, template, banner_url, 'DZD' as currency_code,
                NULL as hero_main_url, NULL as hero_tile1_url, NULL as hero_tile2_url,
                store_images, owner_name, owner_email,
                NULL as template_hero_heading, NULL as template_hero_subtitle, NULL as template_button_text, NULL as template_accent_color,
                NULL as template_settings, NULL as template_settings_by_template, NULL as global_settings,
                store_slug
         FROM client_store_settings
         ${whereSql}`;

      // IMPORTANT: exact store_slug match first (indexed), fallback to expensive name normalization only if needed.
      try {
        clientRes = await withDbRetry((db) => db.query(selectClientSettings('WHERE store_slug = $1'), [querySlug]) as any);
      } catch (err: any) {
        if (err.code === '42703') {
          clientRes = await withDbRetry((db) => db.query(selectClientSettingsLegacy('WHERE store_slug = $1'), [querySlug]) as any);
        } else {
          throw err;
        }
      }

      if (clientRes.rows.length === 0) {
        try {
          clientRes = await withDbRetry(
            (db) =>
              db.query(
                selectClientSettings(
                  "WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)"
                ),
                [querySlug]
              ) as any
          );
        } catch (err: any) {
          if (err.code === '42703') {
            clientRes = await withDbRetry(
              (db) =>
                db.query(
                  selectClientSettingsLegacy(
                    "WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)"
                  ),
                  [querySlug]
                ) as any
            );
          } else {
            throw err;
          }
        }
      }

      let row: any = null;
      if (clientRes.rows.length > 0) {
        row = clientRes.rows[0];
      } else {
        // Fall back to seller storefront settings
        let sellerRes: any;
        const selectSellerSettings = (whereSql: string) =>
          `SELECT store_name, store_description, store_logo, primary_color, secondary_color, template, banner_url, 'DZD' as currency_code, 
                  hero_main_url, hero_tile1_url, hero_tile2_url, store_images
           FROM seller_store_settings
           ${whereSql}`;
        const selectSellerSettingsLegacy = (whereSql: string) =>
          `SELECT store_name, store_description, store_logo, primary_color, secondary_color, template, banner_url, 'DZD' as currency_code,
                  NULL as hero_main_url, NULL as hero_tile1_url, NULL as hero_tile2_url, store_images
           FROM seller_store_settings
           ${whereSql}`;

        try {
          sellerRes = await withDbRetry((db) => db.query(selectSellerSettings('WHERE store_slug = $1'), [querySlug]) as any);
        } catch (err: any) {
          if (err.code === '42703') {
            sellerRes = await withDbRetry((db) => db.query(selectSellerSettingsLegacy('WHERE store_slug = $1'), [querySlug]) as any);
          } else {
            throw err;
          }
        }

        if (sellerRes.rows.length === 0) {
          try {
            sellerRes = await withDbRetry(
              (db) =>
                db.query(
                  selectSellerSettings(
                    "WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)"
                  ),
                  [querySlug]
                ) as any
            );
          } catch (err: any) {
            if (err.code === '42703') {
              sellerRes = await withDbRetry(
                (db) =>
                  db.query(
                    selectSellerSettingsLegacy(
                      "WHERE LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)"
                    ),
                    [querySlug]
                  ) as any
              );
            } else {
              throw err;
            }
          }
        }

        if (sellerRes.rows.length === 0) {
          // Don't hard-fail: return a safe default so UI doesn't show an opaque error.
          // Products endpoint will still determine if store exists.
          return {
            store_name: 'Store',
            primary_color: '#3b82f6',
            secondary_color: '#8b5cf6',
            template: 'books',
            currency_code: 'DZD',
            banner_url: null,
            hero_main_url: null,
            hero_tile1_url: null,
            hero_tile2_url: null,
            store_slug: storeSlug,
          };
        }
        row = sellerRes.rows[0];
      }
    // Sanitize image list fields: trim, remove empties; return null if empty
    const sanitize = (v: any) => {
      if (v == null) return null;
      if (typeof v !== 'string') return v;
      const parts = v
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      const deduped: string[] = [];
      parts.forEach((p: string) => {
        if (!deduped.includes(p)) deduped.push(p);
      });
      return deduped.length ? deduped.join(',') : null;
    };

    // Convert store_images (text[]) to JS array or fallback to hero tiles
    let storeImagesArr: string[] | null = null;
    if (row.store_images && Array.isArray(row.store_images) && row.store_images.length) {
      storeImagesArr = row.store_images.map((s: string) => (s == null ? '' : String(s).trim())).filter((s: string) => s.length > 0);
    } else {
      // Fallback to hero tiles if no explicit store_images
      storeImagesArr = [row.hero_main_url, row.hero_tile1_url, row.hero_tile2_url].filter((s: any) => s != null && String(s).trim().length > 0) as string[];
      if (storeImagesArr.length === 0) storeImagesArr = null;
    }

    const templateSettings = row?.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {};
    const globalSettings = row?.global_settings && typeof row.global_settings === 'object' ? row.global_settings : {};

    // Debug: log what template is being returned
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[storefront:${storeSlug}] template from DB: ${row.template}`);
    }

    // IMPORTANT: Ensure row.template is NOT overridden by templateSettings/globalSettings
    // The template field from the database row takes precedence
    const dbTemplate = normalizeTemplateIdForPublic(row.template);

      const payload = {
        ...globalSettings,
        ...templateSettings,
        ...row,
        template: dbTemplate, // Explicitly set to ensure it's not overridden
        store_slug: row?.store_slug || storeSlug,
        banner_url: sanitize(row.banner_url),
        hero_main_url: sanitize(row.hero_main_url),
        hero_tile1_url: sanitize(row.hero_tile1_url),
        hero_tile2_url: sanitize(row.hero_tile2_url),
        store_images: storeImagesArr,
      };
      setCached(storefrontSettingsCache, cacheKey, payload, SETTINGS_CACHE_TTL_MS);
      return payload;
    })();

    storefrontSettingsInFlight.set(cacheKey, promise);
    const value = await promise;
    storefrontSettingsInFlight.delete(cacheKey);
    return res.json(value);
  } catch (error) {
    console.error('Get storefront settings error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch store settings' });
  }
};

// Get single product for a storefront
export const getPublicProduct: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let storeSlug: string;
  let productSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
    productSlug = ProductSlugSchema.parse(req.params.productSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const shouldTrackView = String((req.query as any)?.track_view || '') === '1' ||
    String(req.get('x-track-view') || '') === '1';

  try {
    const pool = await ensureConnection();
    if (!isProduction) {
      console.log('[getPublicProduct] Looking for:', { storeSlug, productSlug });
    }
    
    // Try client store product first
    const productResult = await pool.query(
      `SELECT 
        p.*,
        s.store_name,
        s.primary_color,
        s.secondary_color,
        s.template AS store_template,
        s.store_slug,
        s.owner_name AS seller_name,
        s.owner_email AS seller_email
      FROM client_store_products p
      INNER JOIN client_store_settings s ON p.client_id = s.client_id
      WHERE (s.store_slug = $1
          OR LOWER(REGEXP_REPLACE(s.store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1))
        AND p.slug = $2`,
      [storeSlug, productSlug]
    );
    if (!isProduction) {
      console.log('[getPublicProduct] Found rows:', productResult.rows.length);
    }
    
    if (productResult.rows.length === 0) {
      // Try marketplace product for seller storefronts
      const mResult = await pool.query(
        `SELECT p.*, ss.store_name, ss.primary_color, ss.secondary_color, ss.store_slug, sel.name AS seller_name, sel.email AS seller_email
         FROM marketplace_products p
         INNER JOIN seller_store_settings ss ON p.seller_id = ss.seller_id
         LEFT JOIN sellers sel ON p.seller_id = sel.id
         WHERE (ss.store_slug = $1
            OR LOWER(REGEXP_REPLACE(ss.store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1))
           AND p.slug = $2`,
        [storeSlug, productSlug]
      );

      if (mResult.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const mprod = mResult.rows[0];
      if (shouldTrackView) {
        await pool.query('UPDATE marketplace_products SET views = views + 1 WHERE id = $1', [mprod.id]);
      }
      return res.json({
        ...mprod,
        views: (mprod.views || 0) + (shouldTrackView ? 1 : 0),
      });
    }

    const product = productResult.rows[0];

    let variants: any[] = [];
    try {
      const vRes = await pool.query(
        `SELECT id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
         FROM product_variants
         WHERE product_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [product.id]
      );
      variants = vRes.rows || [];
    } catch {
      variants = [];
    }

    // Increment view count
    if (shouldTrackView) {
      await pool.query(
        'UPDATE client_store_products SET views = views + 1 WHERE id = $1',
        [product.id]
      );
    }

    res.json({
      ...product,
      variants,
      views: (product.views || 0) + (shouldTrackView ? 1 : 0),
    });
  } catch (error) {
    console.error('Get public product error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// Get single product by ID for a storefront
export const getStorefrontProductById: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let storeSlug: string;
  let productId: number;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
    productId = ProductIdSchema.parse(req.params.productId);
  } catch {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const pool = await ensureConnection();
    if (!isProduction) {
      console.log('[getStorefrontProductById] Looking for:', { storeSlug, productId });
    }
    
    // Try client store product first by ID
    const productResult = await pool.query(
      `SELECT 
        p.*,
        s.store_name,
        s.primary_color,
        s.secondary_color,
        s.template AS store_template,
        s.store_slug,
        s.owner_name AS seller_name,
        s.owner_email AS seller_email
      FROM client_store_products p
      INNER JOIN client_store_settings s ON p.client_id = s.client_id
      WHERE (s.store_slug = $1
          OR LOWER(REGEXP_REPLACE(s.store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1))
        AND p.id = $2`,
      [storeSlug, productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    let variants: any[] = [];
    try {
      const vRes = await pool.query(
        `SELECT id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
         FROM product_variants
         WHERE product_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [product.id]
      );
      variants = vRes.rows || [];
    } catch {
      variants = [];
    }

    res.json({ ...product, variants });
  } catch (error) {
    console.error('Get storefront product by ID error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// Create order via public storefront using storeSlug
function getClientIpXs(req: any): string | null {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff)) return xff[0].trim();
  return req.socket?.remoteAddress || null;
}

export const createPublicStoreOrder: RequestHandler = async (req, res) => {
  const { storeSlug } = req.params as any;
  let pool: any;
  let client: any;
  let inTransaction = false;
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    pool = await ensureConnection();
    client = await pool.connect();

    const trimmedOptionalString = (maxLen: number) =>
      z.preprocess(
        (v) => {
          if (v === null || v === undefined) return undefined;
          if (typeof v !== 'string') return v;
          const t = v.trim();
          return t === '' ? undefined : t;
        },
        z.string().max(maxLen)
      );

    const CreatePublicStoreOrderSchema = z.object({
      product_id: z.preprocess((v) => Number(v), z.number().int().positive()),
      variant_id: VariantIdSchema.optional(),
      offer_id: z.preprocess(
        (v) => (v === null || v === undefined || v === '' ? undefined : Number(v)),
        z.number().int().positive()
      ).optional(),
      quantity: z.preprocess((v) => Number(v), z.number().int().positive()),
      // Client-provided total_price is accepted for backward-compatibility but ignored.
      // Total is computed server-side from the current product price.
      total_price: z.preprocess((v) => Number(v), z.number().positive()).optional(),
      delivery_fee: z.preprocess((v) => Number(v), z.number().nonnegative()).optional(),
      delivery_type: z.enum(['home', 'desk']).optional(),
      customer_name: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : v),
        z.string().min(1).max(120)
      ),
      customer_phone: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : v),
        z.string().min(7).max(32)
      ),
      customer_email: trimmedOptionalString(255).pipe(z.string().email()).optional(),
      customer_address: trimmedOptionalString(500).optional(),
      shipping_wilaya_id: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().positive()).optional(),
      shipping_commune_id: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().positive()).optional(),
      shipping_hai: trimmedOptionalString(120).optional(),
    });

    let data: z.infer<typeof CreatePublicStoreOrderSchema>;
    try {
      data = CreatePublicStoreOrderSchema.parse(req.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }

    const {
      product_id,
      variant_id,
      offer_id,
      quantity,
      total_price: _ignoredTotalPrice,
      delivery_type,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      shipping_wilaya_id,
      shipping_commune_id,
      shipping_hai,
    } = data;

    // ── Field-level validation with Arabic messages ──
    const fieldErrors: Record<string, string> = {};

    const trimmedName = String(customer_name || '').trim();
    if (!trimmedName || /^\d+$/.test(trimmedName)) {
      fieldErrors.customer_name = 'الاسم مطلوب ويجب ألا يكون أرقاماً فقط';
    }

    const normalizedPhone = String(customer_phone).replace(/\s/g, '');
    if (!normalizedPhone) {
      fieldErrors.customer_phone = 'رقم الهاتف مطلوب';
    } else if (!/^(05|06|07)\d{8}$/.test(normalizedPhone)) {
      fieldErrors.customer_phone = 'رقم الهاتف يجب أن يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام';
    }

    if (quantity < 1) {
      fieldErrors.quantity = 'الكمية يجب أن تكون 1 على الأقل';
    }

    if (delivery_type === 'home') {
      const addr = String(customer_address || '').trim();
      if (!addr) {
        fieldErrors.customer_address = 'العنوان مطلوب عند اختيار التوصيل إلى المنزل';
      }
      if (!shipping_wilaya_id) {
        fieldErrors.shipping_wilaya_id = 'الولاية مطلوبة عند اختيار التوصيل إلى المنزل';
      }
      if (!shipping_commune_id) {
        fieldErrors.shipping_commune_id = 'البلدية مطلوبة عند اختيار التوصيل إلى المنزل';
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({
        error: 'يرجى تصحيح البيانات التالية',
        fields: fieldErrors,
      });
      return;
    }

    // Match by exact store_slug OR normalized store_name (same as storefront loading)
    const cs = await pool.query(
      `SELECT client_id, store_name
       FROM client_store_settings
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
      [storeSlug]
    );
    
    let clientId: number | string;
    let storeName: string;
    
    if (cs.rows.length > 0) {
      clientId = cs.rows[0].client_id;
      storeName = cs.rows[0].store_name || 'EcoPro Store';
      if (!isProduction) {
        console.log('[createPublicStoreOrder] Found client store, client_id:', clientId);
      }
    } else {
      // NOTE: This endpoint is for client storefronts only.
      if (!isProduction) {
        console.log('[createPublicStoreOrder] Client store not found for slug:', storeSlug);
      }
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    // Prefer store name in URLs when available; fall back to the incoming identifier.
    // Must stay compatible with server-side resolution (same normalization used in SQL).
    const preferredStoreSlug = String(storeName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const storefrontSlugForLinks = preferredStoreSlug || String(storeSlug);

    // Ensure product belongs to this store (prevents cross-tenant product/order spoofing)
    const productRes = await pool.query(
      `SELECT id, price, stock_quantity
       FROM client_store_products
       WHERE id = $1 AND client_id = $2 AND status = 'active'
       LIMIT 1`,
      [product_id, clientId]
    );

    if (productRes.rows.length === 0) {
      if (!isProduction) {
        console.log('[createPublicStoreOrder] Product not found for store:', { product_id, clientId });
      }
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const productRow = productRes.rows[0];

    let variantRow: any | null = null;
    if (variant_id) {
      const vRes = await pool.query(
        `SELECT id, color, size, variant_name, price, stock_quantity, is_active
         FROM product_variants
         WHERE id = $1 AND product_id = $2 AND COALESCE(is_active, true) = true
         LIMIT 1`,
        [Number(variant_id), product_id]
      );
      if (vRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid variant' });
      }
      variantRow = vRes.rows[0];
      const vStock = Number(variantRow.stock_quantity ?? 0);
      if (!Number.isFinite(vStock) || vStock < Number(quantity)) {
        return res.status(400).json({ error: 'Insufficient stock.' });
      }
    }

    const unitPrice = variantRow && variantRow.price != null ? Number(variantRow.price) : Number(productRow.price);

    // Validate offer if provided
    let offerRow: any | null = null;
    if (offer_id) {
      try {
        const offerRes = await pool.query(
          `SELECT id, quantity, bundle_price, compare_price, free_delivery
           FROM product_offers
           WHERE id = $1 AND product_id = $2 AND client_id = $3 AND is_active = true
           LIMIT 1`,
          [Number(offer_id), product_id, clientId]
        );
        if (offerRes.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid offer' });
        }
        offerRow = offerRes.rows[0];
        // Ensure the submitted quantity matches the offer's quantity
        if (Number(offerRow.quantity) !== Number(quantity)) {
          return res.status(400).json({ error: 'Quantity does not match offer' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid offer' });
      }
    }

    // Total includes product price * quantity + delivery fee (computed server-side)
    let deliveryAmount = 0;
    if (shipping_wilaya_id) {
      try {
        const feeRes = await pool.query(
          `SELECT home_delivery_price, desk_delivery_price
           FROM delivery_prices
           WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true
           ORDER BY home_delivery_price ASC
           LIMIT 1`,
          [clientId, Number(shipping_wilaya_id)]
        );
        if (feeRes.rows.length === 0) {
          deliveryAmount = 500;
        } else {
          const row = feeRes.rows[0];
          const home = Number(row.home_delivery_price ?? 0);
          const desk = row.desk_delivery_price == null ? null : Number(row.desk_delivery_price);
          const chosen = (delivery_type === 'desk' && desk != null) ? desk : home;
          deliveryAmount = Number.isFinite(chosen) && chosen >= 0 ? chosen : 0;
        }
      } catch {
        // If delivery pricing table is unavailable for any reason, avoid blocking checkout
        deliveryAmount = 0;
      }
    }

    // If offer has free_delivery, override delivery fee to 0
    if (offerRow?.free_delivery) {
      deliveryAmount = 0;
    }

    // Use offer bundle_price if present, otherwise normal unit * qty
    const expectedTotalPrice = offerRow
      ? Number(offerRow.bundle_price) + deliveryAmount
      : (unitPrice * Number(quantity)) + deliveryAmount;

    await client.query('BEGIN');
    inTransaction = true;

    const storeOrderColumns = await getStoreOrdersColumns();
    const insertCols: string[] = [];
    const insertVals: any[] = [];
    const addCol = (col: string, val: any) => {
      if (!storeOrderColumns.has(col)) return;
      insertCols.push(col);
      insertVals.push(val);
    };

    addCol('product_id', product_id);
    addCol('client_id', clientId);
    addCol('quantity', quantity);
    addCol('total_price', expectedTotalPrice);
    addCol('delivery_fee', deliveryAmount);
    addCol('delivery_type', delivery_type || 'home');
    addCol('variant_id', variantRow ? Number(variantRow.id) : null);
    addCol('variant_color', variantRow ? (variantRow.color || null) : null);
    addCol('variant_size', variantRow ? (variantRow.size || null) : null);
    addCol('variant_name', variantRow ? (variantRow.variant_name || null) : null);
    addCol('unit_price', unitPrice);
    addCol('offer_id', offerRow ? Number(offerRow.id) : null);
    addCol('offer_quantity', offerRow ? Number(offerRow.quantity) : null);
    addCol('offer_bundle_price', offerRow ? Number(offerRow.bundle_price) : null);
    addCol('customer_name', customer_name);
    addCol('customer_email', customer_email || null);
    addCol('customer_phone', normalizedPhone || null);
    addCol('shipping_address', customer_address || null);
    addCol('shipping_wilaya_id', shipping_wilaya_id || null);
    addCol('shipping_commune_id', shipping_commune_id || null);
    addCol('shipping_hai', shipping_hai || null);
    addCol('customer_ip', getClientIpXs(req));
    addCol('browser_fingerprint', (req.body?.browser_fingerprint || '').trim().slice(0, 255) || null);
    addCol('form_fill_time_ms', req.body?.form_fill_time_ms != null ? Number(req.body.form_fill_time_ms) : null);

    // --- Fraud & duplicate detection ---
    let initialStatus = 'pending';

    // 1. Phone velocity check: block rapid-fire spam (same phone, 3+ orders in 10 min)
    try {
      const velocityCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM store_orders
         WHERE client_id = $1 AND customer_phone = $2
           AND created_at > NOW() - INTERVAL '10 minutes'`,
        [clientId, normalizedPhone]
      );
      if (parseInt(velocityCheck.rows[0]?.cnt || '0') >= 3) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(429).json({ error: 'Too many orders from this phone number. Please wait before ordering again.' });
      }
    } catch {}

    // 2. Risk assessment — auto-flag high/critical risk as fake
    try {
      const risk = await assessOrderRisk(Number(clientId), normalizedPhone, customer_address || undefined, {
        customerIp: getClientIpXs(req),
        browserFingerprint: (req.body?.browser_fingerprint || '').trim().slice(0, 255) || undefined,
        formFillTimeMs: req.body?.form_fill_time_ms != null ? Number(req.body.form_fill_time_ms) : undefined,
      });
      if (risk.level === 'critical' || risk.level === 'high') {
        initialStatus = 'fake';
      }
    } catch {}

    // 3. Duplicate phone detection (only if not already flagged as fake)
    if (initialStatus === 'pending') {
      try {
        const dupCheck = await client.query(
          `SELECT id FROM store_orders
           WHERE client_id = $1 AND customer_phone = $2
             AND status NOT IN ('cancelled','failed','fake','duplicate','completed','delivered','returned')
           LIMIT 1`,
          [clientId, normalizedPhone]
        );
        if (dupCheck.rows.length > 0) initialStatus = 'duplicate';
      } catch {}
    }

    addCol('status', initialStatus);
    addCol('payment_status', 'unpaid');
    addCol('created_at', new Date());

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await client.query(
      `INSERT INTO store_orders (${insertCols.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      insertVals
    );
    if (!isProduction) {
      console.log('[createPublicStoreOrder] Inserted order id:', result.rows?.[0]?.id);
    }

    // Create Telegram deep-link for this order (optional for the customer)
    const telegram = await createOrderTelegramLink({
      orderId: Number(result.rows[0].id),
      clientId: Number(clientId),
      customerPhone: normalizedPhone,
      customerName: String(customer_name),
    }).catch(() => ({ startToken: '', startUrl: null } as any));

    // Decrease stock after successful order creation (scoped + guarded)
    if (variantRow) {
      const vUpdate = await client.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND product_id = $3 AND client_id = $4 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, Number(variantRow.id), product_id, clientId]
      );
      const pUpdate = await client.query(
        'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, product_id, clientId]
      );
      if (vUpdate.rows.length === 0 || pUpdate.rows.length === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Insufficient stock.' });
      }
    } else {
      const stockUpdate = await client.query(
        'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, product_id, clientId]
      );
      if (stockUpdate.rows.length === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Insufficient stock.' });
      }
    }
    if (!isProduction) {
      console.log(`[createPublicStoreOrder] Stock decreased by ${quantity} for product ${product_id}`);
    }

    await client.query('COMMIT');
    inTransaction = false;
    // Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs(actor_type, actor_id, action, target_type, target_id, details, created_at)
         VALUES($1,$2,$3,$4,$5,$6,NOW())`,
        ['system', clientId, 'create_order', 'order', result.rows[0]?.id || null, JSON.stringify({ product_id, customer_name })]
      );
    } catch {}

    // Fire-and-forget bot confirmation with confirmation link tied to this order
    if (normalizedPhone) {
      // Ensure bot_settings exists for this client; many bot codepaths assume it.
      try {
        await ensureBotSettingsRow(Number(clientId), { enabled: true });
      } catch (e) {
        console.warn('[createPublicStoreOrder] Failed to ensure bot_settings row:', (e as any)?.message || e);
      }

      const orderTotalPrice = Number(result.rows?.[0]?.total_price ?? expectedTotalPrice);
      const productTitle = (await pool.query('SELECT title FROM client_store_products WHERE id = $1', [product_id])).rows?.[0]?.title || 'Product';

      // Check if customer has pre-connected via Telegram
      const preConnectRes = await pool.query(
        `SELECT telegram_chat_id FROM customer_messaging_ids 
         WHERE client_id = $1 AND customer_phone = $2 AND telegram_chat_id IS NOT NULL
         LIMIT 1`,
        [clientId, normalizedPhone]
      );
      // Fallback: if the phone matches the store owner's support phone, notify the owner
      if (preConnectRes.rows.length === 0) {
        const ownerRes = await pool.query(
          `SELECT owner_telegram_chat_id, support_phone FROM bot_settings WHERE client_id = $1 LIMIT 1`,
          [clientId]
        );
        if (ownerRes.rows.length && ownerRes.rows[0].owner_telegram_chat_id) {
          const supportPhone = String(ownerRes.rows[0].support_phone || '').replace(/\D/g, '');
          if (supportPhone && supportPhone === normalizedPhone) {
            preConnectRes.rows = [{ telegram_chat_id: ownerRes.rows[0].owner_telegram_chat_id }];
          }
        }
      }
      if (!isProduction) {
        console.log('[createPublicStoreOrder] Pre-connect found:', preConnectRes.rows.length > 0);
      }

      if (preConnectRes.rows.length > 0) {
        // Customer is pre-connected! Send immediate notification
        const chatId = preConnectRes.rows[0].telegram_chat_id;
        if (!isProduction) {
          console.log('[createPublicStoreOrder] Customer is pre-connected, chat_id:', chatId);
        }
        
        // Get bot settings - check for telegram_bot_token presence, not just provider
        // This allows sending Telegram when they have a token even if provider is facebook/messenger
        const botRes = await pool.query(
          `SELECT telegram_bot_token, template_instant_order, template_pin_instructions, 
                  telegram_delay_minutes, template_order_confirmation
           FROM bot_settings 
           WHERE client_id = $1 AND enabled = true AND telegram_bot_token IS NOT NULL
           LIMIT 1`,
          [clientId]
        );
        if (!isProduction) {
          console.log('[createPublicStoreOrder] Bot settings found:', botRes.rows.length > 0);
        }

        if (botRes.rows.length > 0 && botRes.rows[0].telegram_bot_token) {
          const botToken = botRes.rows[0].telegram_bot_token;
          if (!isProduction) {
            console.log('[createPublicStoreOrder] Sending Telegram message to chat:', chatId);
          }
          
          // Default instant order template
          const defaultInstantOrder = `🎉 شكراً لك، {customerName}!

تم استلام طلبك بنجاح ✅

━━━━━━━━━━━━━━━━
📦 تفاصيل الطلب
━━━━━━━━━━━━━━━━
🔢 رقم الطلب: #{orderId}
📱 المنتج: {productName}
💰 السعر: {totalPrice} دج
📍 الكمية: {quantity}

━━━━━━━━━━━━━━━━
👤 معلومات التوصيل
━━━━━━━━━━━━━━━━
📛 الاسم: {customerName}
📞 الهاتف: {customerPhone}
🏠 العنوان: {address}

━━━━━━━━━━━━━━━━
🚚 حالة الطلب: قيد المعالجة
━━━━━━━━━━━━━━━━

سنتواصل معك قريباً للتأكيد 📞

⭐ من {storeName}`;

          const defaultPinInstructions = `📌 نصيحة مهمة:

اضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!

🔔 تأكد من:
• تفعيل الإشعارات للبوت
• عدم كتم المحادثة
• ستتلقى تحديثات حالة الطلب هنا مباشرة`;

          const instantOrderTemplate = botRes.rows[0].template_instant_order || defaultInstantOrder;
          const pinInstructionsTemplate = botRes.rows[0].template_pin_instructions || defaultPinInstructions;
          
          // Replace variables
          const templateVars = {
            customerName: customer_name,
            productName: productTitle,
            totalPrice: orderTotalPrice.toLocaleString(),
            quantity: quantity,
            orderId: result.rows[0].id,
            customerPhone: normalizedPhone,
            address: customer_address || 'غير محدد',
            storeName: storeName,
            companyName: storeName,
          };
          const orderMessage = replaceTemplateVariables(instantOrderTemplate, templateVars);
          const pinMessage = replaceTemplateVariables(pinInstructionsTemplate, templateVars);

          // Send instant order notification (NO buttons - just info)
          const orderId = result.rows[0].id;
          
          const msgResult = await sendTelegramMessage(botToken, chatId, orderMessage);
          if (!isProduction) {
            console.log('[createPublicStoreOrder] Telegram send result:', msgResult);
          }
          
          // Send pinning instruction as separate message
          if (msgResult.success) {
            const pinResult = await sendTelegramMessage(botToken, chatId, pinMessage);
            if (!isProduction) {
              console.log('[createPublicStoreOrder] Pin instructions send result:', pinResult);
            }
          }
          
          // Schedule confirmation message with buttons after delay
          const delayMinutes = botRes.rows[0].telegram_delay_minutes || 5; // default 5 minutes
          console.log(`[PublicStore] Scheduling confirmation for order ${orderId} in ${delayMinutes} minutes`);
          
          // Get confirmation template
          const defaultConfirmationTemplate = `مرحباً {customerName}! 🌟

هل تؤكد طلبك من {storeName}؟

📦 المنتج: {productName}
💰 السعر: {totalPrice} دج
📍 العنوان: {address}

اضغط على أحد الأزرار للتأكيد أو الإلغاء:`;
          const confirmationTemplate = botRes.rows[0].template_order_confirmation || defaultConfirmationTemplate;
          
          const confirmationMessage = replaceTemplateVariables(confirmationTemplate, {
            customerName: customer_name,
            productName: productTitle,
            totalPrice: String(orderTotalPrice),
            quantity: quantity,
            orderId: orderId,
            customerPhone: normalizedPhone,
            address: customer_address || 'غير محدد',
            storeName: storeName,
            companyName: storeName,
          });
          
          // Insert into scheduled_messages table (use DO NOTHING to prevent duplicates for same order)
          // Use PostgreSQL NOW() + INTERVAL to avoid timezone issues between JS and DB
          await pool.query(
            `INSERT INTO scheduled_messages 
             (client_id, order_id, telegram_chat_id, message_content, message_type, scheduled_at, status)
             VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::INTERVAL, 'pending')
             ON CONFLICT DO NOTHING`,
            [clientId, orderId, chatId, confirmationMessage, 'order_confirmation', delayMinutes]
          );
          if (!isProduction) {
            console.log(`[createPublicStoreOrder] Scheduled confirmation message for ${delayMinutes} minutes later`);
          }

          // Also create the order-telegram link for future use
          await pool.query(
            `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id`,
            [result.rows[0].id, clientId, chatId]
          );

          if (!isProduction) {
            console.log(`[createPublicStoreOrder] Sent immediate Telegram notification to chat ${chatId}`);
          }

          // Also schedule Messenger messages (if enabled) without duplicating Telegram.
          sendBotMessagesForOrder(
            result.rows[0].id,
            Number(clientId),
            normalizedPhone,
            customer_name,
            storeName,
            productTitle,
            orderTotalPrice,
            storefrontSlugForLinks,
            { skipTelegram: true, quantity, address: customer_address || undefined }
          ).catch(() => {});
        }
      } else {
        // Customer not pre-connected, use the scheduled bot message flow
        sendBotMessagesForOrder(
          result.rows[0].id,
          Number(clientId),
          normalizedPhone,
          customer_name,
          storeName,
          productTitle,
          orderTotalPrice,
          storefrontSlugForLinks,
          { quantity, address: customer_address || undefined }
        ).catch(() => {});
      }
    }

    if (!isProduction) {
      console.log('[createPublicStoreOrder] Order creation successful, sending response...');
    }

    // Create a tokenized confirmation URL for the buyer (lets web flow work securely)
    let confirmationUrl: string | null = null;
    try {
      const token = await createConfirmationLink(Number(result.rows[0].id), Number(clientId));
      confirmationUrl = `/store/${storefrontSlugForLinks}/order/${result.rows[0].id}/confirm?t=${encodeURIComponent(String(token))}`;
    } catch {
      confirmationUrl = null;
    }

    // Return only safe fields - don't expose client_id to buyers
    const { client_id, ...safeOrder } = result.rows[0];
    notifyOrderCreated(Number(clientId), Number(result.rows[0].id), String(customer_name));
    res.status(201).json({ success: true, order: safeOrder, telegramStartUrl: telegram?.startUrl || null, confirmationUrl });
  } catch (error) {
    const isMissingSchemaError = (err: any): boolean => {
      const msg = String(err?.message || '').toLowerCase();
      return msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column'));
    };
    if (isMissingSchemaError(error) && !(req as any).__migrationsRetried) {
      (req as any).__migrationsRetried = true;
      try {
        await ensureMigrationsReady('createPublicStoreOrder missing schema');
        return createPublicStoreOrder(req, res, () => undefined);
      } catch (e) {
        console.error('[createPublicStoreOrder] Migration retry failed:', (e as any)?.message || e);
      }
    }
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    const isProduction = process.env.NODE_ENV === 'production';
    console.error(
      'Create public store order error:',
      isProduction ? (error instanceof Error ? error.message : String(error)) : error
    );
    if (!isProduction) {
      console.error('Full error details:', error);
    }
    if (!res.headersSent) {
      const details = isProduction ? undefined : (error instanceof Error ? error.message : String(error));
      res.status(500).json({
        error: 'Failed to create order',
        ...(details ? { details } : {}),
      });
    }
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

// Get Hai / Neighborhood suggestions for a storefront (public)
// GET /api/storefront/:storeSlug/address/hai-suggestions?communeId=123
export const getStorefrontHaiSuggestions: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let storeSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse((req.params as any).storeSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid store ID' });
  }

  const communeIdRaw = (req.query as any)?.communeId;
  const communeId = Number(communeIdRaw);
  if (!Number.isFinite(communeId) || communeId <= 0) {
    return res.status(400).json({ error: 'communeId is required' });
  }

  try {
    const pool = await ensureConnection();
    const cs = await pool.query(
      `SELECT client_id
       FROM client_store_settings
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
      [storeSlug]
    );
    if (cs.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    const clientId = Number(cs.rows[0].client_id);

    const result = await pool.query(
      `SELECT shipping_hai AS value, COUNT(*)::int AS count
       FROM store_orders
       WHERE client_id = $1
         AND shipping_commune_id = $2
         AND shipping_hai IS NOT NULL
         AND BTRIM(shipping_hai) <> ''
       GROUP BY shipping_hai
       ORDER BY COUNT(*) DESC, shipping_hai ASC
       LIMIT 50`,
      [clientId, communeId]
    );

    res.json({ suggestions: result.rows });
  } catch (error) {
    console.error('Get Hai suggestions error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

// Get product by ID or slug with store info (for Telegram integration)
export const getProductWithStoreInfo: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let productId: string;
  try {
    productId = z.string().trim().min(1).max(200).parse(req.params.productId);
  } catch {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const pool = await ensureConnection();
    
    // Determine if it's an ID (numeric) or slug
    const isNumericId = /^\d+$/.test(productId);
    const idOrSlug: number | string = isNumericId ? Number(productId) : productId;
    
    // Try client store product first - search by ID or slug
    const result = await pool.query(
      `SELECT 
        p.id, p.client_id, p.title, p.description, p.price, p.original_price,
        p.images, p.category, p.stock_quantity, p.slug, p.status, p.metadata,
        s.store_name, s.store_slug, s.primary_color, s.template_accent_color
      FROM client_store_products p
      INNER JOIN client_store_settings s ON p.client_id = s.client_id
      WHERE ${isNumericId ? 'p.id = $1' : 'p.slug = $1'}`,
      [idOrSlug]
    );

    if (result.rows.length > 0) {
      const p = result.rows[0];
      // Ensure product has a slug (generate fallback if missing)
      let variants: any[] = [];
      try {
        const vRes = await pool.query(
          `SELECT id, color, size, variant_name, price, stock_quantity, images, sort_order
           FROM product_variants
           WHERE product_id = $1 AND client_id = $2 AND is_active = true
           ORDER BY sort_order ASC, id ASC`,
          [p.id, p.client_id]
        );
        variants = vRes.rows || [];
      } catch {
        variants = [];
      }

      return res.json({
        ...p,
        variants,
        metadata: p.metadata && typeof p.metadata === 'object' ? p.metadata : {},
        slug: p.slug || `${String(p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`
      });
    }

    // Try marketplace product - search by ID or slug
    const mResult = await pool.query(
      `SELECT 
        p.id, p.title, p.description, p.price, p.original_price,
        p.images, p.category, p.stock, p.slug, p.status,
        ss.store_name, ss.store_slug, ss.primary_color
      FROM marketplace_products p
      INNER JOIN seller_store_settings ss ON p.seller_id = ss.seller_id
      WHERE ${isNumericId ? 'p.id = $1' : 'p.slug = $1'}`,
      [idOrSlug]
    );

    if (mResult.rows.length > 0) {
      const p = mResult.rows[0];
      // Ensure product has a slug (generate fallback if missing)
      return res.json({
        ...p,
        slug: p.slug || `${String(p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`
      });
    }

    res.status(404).json({ error: 'Product not found' });
  } catch (error) {
    console.error('Get product with store info error:', isProduction ? (error as any)?.message : error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// Track storefront page view (increments page_views counter in client_store_settings)
export const trackStorefrontPageView: RequestHandler = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let storeSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid store ID' });
  }

  try {
    const pool = await ensureConnection();
    
    // Update page_views for client store
    const result = await pool.query(
      `UPDATE client_store_settings 
       SET page_views = COALESCE(page_views, 0) + 1
       WHERE store_slug = $1 
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)
       RETURNING client_id, page_views`,
      [storeSlug]
    );

    // Also track daily views for chart
    if (result.rows.length > 0) {
      const clientId = result.rows[0].client_id;
      await pool.query(
        `INSERT INTO client_store_daily_views (client_id, view_date, views)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (client_id, view_date)
         DO UPDATE SET views = client_store_daily_views.views + 1`,
        [clientId]
      ).catch(() => {}); // non-critical
    }

    if (result.rows.length === 0) {
      // Try seller store
      await pool.query(
        `UPDATE seller_store_settings 
         SET page_views = COALESCE(page_views, 0) + 1
         WHERE store_slug = $1 
            OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
        [storeSlug]
      );
    }

    res.json({ success: true });
  } catch (error) {
    if (!isProduction) {
      console.error('Track page view error:', error);
    }
    // Don't fail the request - page view tracking is non-critical
    res.json({ success: false });
  }
};

/**
 * GET /api/storefront/:storeSlug/contact-channels
 * Returns available contact channels (WhatsApp, Telegram, Instagram, Facebook, Phone)
 * for the chat bubble on the public storefront.
 */
export const getStorefrontContactChannels: RequestHandler = async (req, res) => {
  let storeSlug: string;
  try {
    storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
  } catch {
    return res.status(400).json({ error: 'Invalid store ID' });
  }

  try {
    const pool = await ensureConnection();

    // Look up client_id and store name from store slug
    const storeRes = await pool.query(
      `SELECT client_id, store_name FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
      [storeSlug]
    );

    if (storeRes.rows.length === 0) {
      return res.json({ channels: [] });
    }

    const clientId = storeRes.rows[0].client_id;
    const storeName = String(storeRes.rows[0].store_name || '').trim() || storeSlug;

    // Fetch bot settings — match exactly what the dashboard GET /api/bot-settings returns
    const botRes = await pool.query(
      `SELECT enabled, provider, whatsapp_phone_id, whatsapp_token, whatsapp_display_phone,
              telegram_bot_token, telegram_bot_username,
              viber_auth_token, viber_sender_name, support_phone,
              messenger_enabled, fb_page_id, fb_page_access_token
       FROM bot_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );

    if (botRes.rows.length === 0) {
      return res.json({ channels: [] });
    }

    const bot = botRes.rows[0];

    // Bot must be enabled for chat icons to show
    if (!bot.enabled) {
      return res.json({ channels: [] });
    }

    const channels: { platform: string; url: string; label: string }[] = [];

    // --- Compute platform availability (same as server/routes/bot.ts GET handler) ---
    const platformFbPageId = String(process.env.PLATFORM_FB_PAGE_ID || '').trim();
    const platformFbPageAccessToken = String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim();
    const platformMessengerAvailable = !!(platformFbPageId && platformFbPageAccessToken);

    const platformWhatsappPhoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const platformWhatsappAccessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const platformWhatsappAvailable = !!(platformWhatsappPhoneId && platformWhatsappAccessToken);

    const platformTelegramBotToken = String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim();
    const platformTelegramAvailable = !!platformTelegramBotToken;

    // --- Facebook Messenger (matches dashboard isConnected('facebook')) ---
    const storedFbPageId = String(bot.fb_page_id || '').trim();
    const storedFbAccessToken = String(bot.fb_page_access_token || '').trim();
    const messengerUsingPlatform = platformMessengerAvailable && storedFbPageId === platformFbPageId;
    const messengerTokenConfigured = !!storedFbAccessToken;
    // Dashboard: isConnected = fbPageAccessTokenConfigured || usePlatformMessenger || messengerUsingPlatform
    const messengerConnected = messengerTokenConfigured || messengerUsingPlatform;

    if (messengerConnected) {
      const pageId = storedFbPageId || platformFbPageId;
      if (pageId) {
        const refParam = encodeURIComponent(storeSlug);
        channels.push({ platform: 'facebook', url: `https://m.me/${pageId}?ref=${refParam}`, label: 'Messenger' });
      }
    }

    // --- Instagram - own account via facebook_tokens, or platform fallback ---
    let instagramAdded = false;
    try {
      const igRes = await pool.query(
        `SELECT instagram_username FROM facebook_tokens
         WHERE client_id = $1 AND is_active = TRUE AND instagram_username IS NOT NULL AND instagram_username != ''
         LIMIT 1`,
        [clientId]
      );
      if (igRes.rows.length && igRes.rows[0].instagram_username) {
        const username = igRes.rows[0].instagram_username.replace(/^@/, '');
        channels.push({ platform: 'instagram', url: `https://ig.me/m/${username}`, label: 'Instagram' });
        instagramAdded = true;
      }
    } catch { /* facebook_tokens may not exist */ }
    if (!instagramAdded) {
      const platformIgUsername = String(process.env.PLATFORM_INSTAGRAM_USERNAME || '').trim();
      if (platformIgUsername) {
        channels.push({
          platform: 'instagram',
          url: `https://ig.me/m/${platformIgUsername.replace(/^@/, '')}`,
          label: 'Instagram',
        });
      }
    }

    // --- WhatsApp (matches dashboard isConnected('whatsapp_cloud')) ---
    const storedWhatsappPhoneId = String(bot.whatsapp_phone_id || '').trim();
    const storedWhatsappToken = String(bot.whatsapp_token || '').trim();
    const whatsappUsingPlatform = platformWhatsappAvailable && storedWhatsappPhoneId === platformWhatsappPhoneId;
    const whatsappTokenConfigured = !!storedWhatsappToken || whatsappUsingPlatform;
    // Dashboard: isConnected = whatsappTokenConfigured || usePlatformWhatsapp
    const whatsappConnected = whatsappTokenConfigured;

    // Need phone number for wa.me link — support_phone, whatsapp_display_phone, or Graph API
    const supportPhone = String(bot.support_phone || '').replace(/[^0-9]/g, '');
    let effectiveWaPhone = supportPhone || String(bot.whatsapp_display_phone || '').replace(/[^0-9]/g, '');

    // If no phone yet, try Graph API with platform token
    if (whatsappConnected && !effectiveWaPhone && storedWhatsappPhoneId) {
      const waToken = storedWhatsappToken || platformWhatsappAccessToken;
      if (waToken) {
        try {
          const waRes = await fetch(`https://graph.facebook.com/v25.0/${storedWhatsappPhoneId}?fields=display_phone_number`, {
            headers: { 'Authorization': `Bearer ${waToken}` }
          });
          if (waRes.ok) {
            const waData = await waRes.json();
            effectiveWaPhone = String(waData.display_phone_number || '').replace(/[^0-9]/g, '') || '';
            if (effectiveWaPhone) {
              await pool.query(
                `UPDATE bot_settings SET whatsapp_display_phone = $1 WHERE client_id = $2`,
                [effectiveWaPhone, clientId]
              );
            }
          }
        } catch { /* graph API transient failure */ }
      }
    }

    // Fallback: check store settings contact_phone
    if (whatsappConnected && !effectiveWaPhone) {
      try {
        const storeSettingsFallback = await pool.query(
          `SELECT template_settings, global_settings FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
          [clientId]
        );
        if (storeSettingsFallback.rows.length) {
          const ts = storeSettingsFallback.rows[0].template_settings || {};
          const gs = storeSettingsFallback.rows[0].global_settings || {};
          const merged = { ...gs, ...ts };
          const fallbackPhone = String(merged.contact_phone || '').replace(/[^0-9]/g, '');
          if (fallbackPhone && fallbackPhone.length >= 8) {
            effectiveWaPhone = fallbackPhone;
          }
        }
      } catch { /* ignore */ }
    }

    if (whatsappConnected && effectiveWaPhone) {
      const storeName = String(bot.company_name || 'المتجر').trim();
      const greeting = `السلام عليكم، أتواصل معكم من متجر ${storeName}`;
      channels.push({
        platform: 'whatsapp',
        url: `https://wa.me/${effectiveWaPhone}?text=${encodeURIComponent(greeting)}`,
        label: 'WhatsApp',
      });
    }

    // --- Telegram (matches dashboard isConnected('telegram')) ---
    const storedTelegramUsername = String(bot.telegram_bot_username || '').trim().replace(/^@/, '');
    const platformTelegramUsername = String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
    const telegramUsingPlatform = platformTelegramAvailable && storedTelegramUsername !== '';
    const telegramTokenConfigured = !!String(bot.telegram_bot_token || '').trim() || telegramUsingPlatform;
    const effectiveTelegramUsername = storedTelegramUsername || platformTelegramUsername;
    // Dashboard: isConnected = telegramTokenConfigured || telegramUsingPlatform
    const telegramConnected = telegramTokenConfigured;

    if (telegramConnected && effectiveTelegramUsername) {
      channels.push({
        platform: 'telegram',
        url: `https://t.me/${effectiveTelegramUsername}?start=store_${storeSlug}`,
        label: 'Telegram',
      });
    }

    // --- Viber ---
    const viberSender = String(bot.viber_sender_name || '').trim();
    const platformViberToken = String(process.env.PLATFORM_VIBER_AUTH_TOKEN || '').trim();
    const platformViberSender = String(process.env.PLATFORM_VIBER_SENDER_NAME || '').trim();
    const effectiveViberSender = (bot.viber_auth_token && viberSender)
      ? viberSender
      : (platformViberToken && platformViberSender ? platformViberSender : '');
    if (effectiveViberSender) {
      channels.push({
        platform: 'viber',
        url: `viber://pa?chatURI=${encodeURIComponent(effectiveViberSender)}`,
        label: 'Viber',
      });
    }

    // --- Phone (from template/global settings) ---
    try {
      const storeSettingsRes = await pool.query(
        `SELECT template_settings, global_settings FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      );
      if (storeSettingsRes.rows.length) {
        const ts = storeSettingsRes.rows[0].template_settings || {};
        const gs = storeSettingsRes.rows[0].global_settings || {};
        const merged = { ...gs, ...ts };
        if (merged.phone_call_enabled && merged.contact_phone) {
          const phone = String(merged.contact_phone).replace(/[^0-9+]/g, '');
          if (phone) {
            channels.push({
              platform: 'phone',
              url: `tel:${phone}`,
              label: 'اتصل بنا',
            });
          }
        }
      }
    } catch {
      // ignore
    }

    res.json({ channels });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Contact channels error:', error);
    }
    res.json({ channels: [] });
  }
};
