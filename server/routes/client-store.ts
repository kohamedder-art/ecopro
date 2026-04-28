import { Router, RequestHandler } from "express";
import { randomBytes } from "crypto";
import { pool, ensureConnection, getPool } from "../utils/database";
import type { Pool } from "pg";
import { logStoreSettings } from "../utils/logger";
import { invalidateStorefrontSettingsCache, invalidateAllStorefrontSettingsCache, invalidateStorefrontProductsCache } from "./public-store";
import { getPublicBaseUrl } from "../utils/public-url";

const router = Router();

// Simple in-memory cache for slow remote DB
const settingsCache = new Map<number, { data: any; expires: number }>();
const productsCache = new Map<number, { data: any; expires: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds cache
const PRODUCTS_CACHE_TTL_MS = 15000; // 15 seconds for products (shorter since they change more)

// Schema cache: column names rarely change at runtime (only after migrations)
let storeSettingsColumnCache: { cols: Set<string>; expires: number } | null = null;
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getStoreSettingsColumns(db: any): Promise<Set<string>> {
  if (storeSettingsColumnCache && storeSettingsColumnCache.expires > Date.now()) {
    return storeSettingsColumnCache.cols;
  }
  const colsRes = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_store_settings'`
  );
  const cols = new Set<string>(colsRes.rows.map((r: any) => String(r.column_name)));
  storeSettingsColumnCache = { cols, expires: Date.now() + SCHEMA_CACHE_TTL_MS };
  return cols;
}

function getCachedSettings(clientId: number) {
  const cached = settingsCache.get(clientId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}

function setCachedSettings(clientId: number, data: any) {
  settingsCache.set(clientId, { data, expires: Date.now() + CACHE_TTL_MS });
}

function invalidateSettingsCache(clientId: number) {
  settingsCache.delete(clientId);
}

function getCachedProducts(clientId: number) {
  const cached = productsCache.get(clientId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}

function setCachedProducts(clientId: number, data: any) {
  productsCache.set(clientId, { data, expires: Date.now() + PRODUCTS_CACHE_TTL_MS });
}

function invalidateProductsCache(clientId: number) {
  productsCache.delete(clientId);
}

// Get all store products for client
export const getStoreProducts: RequestHandler = async (req, res) => {
  try {
    // Admins are platform users and should not manage client storefronts.
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    const { status, category, search } = req.query;

    // Use cache only for unfiltered requests (most common case)
    const hasFilters = status || category || search;
    if (!hasFilters) {
      const cached = getCachedProducts(clientId);
      if (cached) {
        return res.json(cached);
      }
    }

    let query = `
      SELECT id, title, description, price, original_price, images, 
             category, stock_quantity, status, is_featured, metadata, slug, views,
             created_at, updated_at
      FROM client_store_products
      WHERE client_id = $1
    `;
    const params: any[] = [clientId];
    let paramCount = 2;

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    
    // Cache unfiltered results
    if (!hasFilters) {
      setCachedProducts(clientId, result.rows);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error("Get store products error:", error);
    console.error("Get store products stack:", (error as Error).stack);

    const isDev = process.env.NODE_ENV !== 'production' || String(process.env.SKIP_DB_INIT || '') === 'true';
    if (isDev) {
      return res.json([]);
    }

    res.status(500).json({ error: "Failed to fetch store products", details: (error as Error).message });
  }
};

// Get single product
export const getStoreProduct: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    try {
      const statsRes = await pool.query(
        `SELECT
          (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1) AS total_products,
          (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1 AND status='active') AS active_products,
          (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1 AND status='draft') AS draft_products,
          (SELECT COALESCE(SUM(views), 0)::int FROM client_store_products WHERE client_id = $1) AS total_product_views,
          (SELECT COALESCE(page_views, 0)::int FROM client_store_settings WHERE client_id = $1) AS page_views,
          -- Backward-compatible field name (historically meant product views)
          (SELECT COALESCE(SUM(views), 0)::int FROM client_store_products WHERE client_id = $1) AS total_views`,
        [clientId]
      );
      res.json(statsRes.rows[0]);
    } catch (err: any) {
      // If page_views column isn't present yet (migration not applied), fall back safely.
      if (err?.code === '42703') {
        const statsRes = await pool.query(
          `SELECT
            (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1) AS total_products,
            (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1 AND status='active') AS active_products,
            (SELECT COUNT(*)::int FROM client_store_products WHERE client_id = $1 AND status='draft') AS draft_products,
            (SELECT COALESCE(SUM(views), 0)::int FROM client_store_products WHERE client_id = $1) AS total_product_views,
            0::int AS page_views,
            (SELECT COALESCE(SUM(views), 0)::int FROM client_store_products WHERE client_id = $1) AS total_views`,
          [clientId]
        );
        res.json(statsRes.rows[0]);
      } else {
        throw err;
      }
    }

  } catch (error) {
    console.error("Get store product error:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

// Create product
export const createStoreProduct: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    const {
      title,
      description,
      price,
      original_price,
      images,
      category,
      stock_quantity,
      status,
      is_featured,
      metadata,
      sizes,
      colors,
      source_stock_id,
      stock_variant_ids,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Title and price are required" });
    }

    // Debug: Log incoming images
    console.log('[createStoreProduct] Received images:', images, 'Type:', typeof images, 'IsArray:', Array.isArray(images));

    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;

    // Ensure images is a proper array
    const imagesArray = Array.isArray(images) ? images : (images ? [images] : []);
    console.log('[createStoreProduct] Images to save:', imagesArray);

    const importStockId = source_stock_id == null ? null : Number(source_stock_id);
    const rawVariantIds = Array.isArray(stock_variant_ids) ? stock_variant_ids : [];
    const importVariantIds = rawVariantIds
      .map((v: any) => Number(v))
      .filter((n: any) => Number.isInteger(n) && n > 0);
    const uniqueImportVariantIds = Array.from(new Set(importVariantIds));
    const importFromStockVariants = Number.isInteger(importStockId) && importStockId! > 0 && uniqueImportVariantIds.length > 0;

    const result = await client.query(
      `INSERT INTO client_store_products 
       (client_id, title, description, price, original_price, images, 
        category, stock_quantity, status, is_featured, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        clientId,
        title,
        description || null,
        price,
        original_price || null,
        imagesArray,
        category || null,
        importFromStockVariants ? 0 : (stock_quantity || 0),
        status || "active",
        is_featured || false,
        metadata && typeof metadata === 'object' ? metadata : {},
      ]
    );

    const product = result.rows[0];
    console.log('[createStoreProduct] Created product images:', product.images);
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${product.id}`;

    await client.query(
      `UPDATE client_store_products SET slug = $1 WHERE id = $2 AND client_id = $3`,
      [slug, product.id, clientId]
    );

    // If this product was created directly in Store Management (not imported from Stock),
    // also create a matching stock item so it shows up in Stock immediately.
    // We store the linkage in product.metadata.stock_id.
    if (!Number.isInteger(importStockId) || !(importStockId! > 0)) {
      const existingMeta = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
      const existingStockId = (existingMeta as any)?.stock_id;

      if (!(Number.isInteger(Number(existingStockId)) && Number(existingStockId) > 0)) {
        const stockName = String(title || '').trim();
        const qty = Math.max(0, Number(stock_quantity ?? 0) || 0);
        const statusForStock = qty > 0 ? 'active' : 'out_of_stock';

        let stockRes: any;
        try {
          stockRes = await client.query(
            `INSERT INTO client_stock_products (
              client_id, name, sku, description, category,
              sizes, colors,
              quantity, unit_price, reorder_level, location,
              supplier_name, supplier_contact, status,
              shipping_mode, shipping_flat_fee,
              notes, images
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING id`,
            [
              clientId,
              stockName,
              null,
              description || null,
              category || null,
              Array.isArray(sizes) ? sizes : [],
              Array.isArray(colors) ? colors : [],
              qty,
              price == null ? null : Number(price),
              0,
              null,
              null,
              null,
              statusForStock,
              'delivery_pricing',
              null,
              null,
              imagesArray,
            ]
          );
        } catch (err: any) {
          // Backward compatible if the DB is missing newer stock columns.
          if (err?.code === '42703') {
            stockRes = await client.query(
              `INSERT INTO client_stock_products (
                client_id, name, sku, description, category,
                quantity, unit_price, reorder_level, location,
                supplier_name, supplier_contact, status,
                notes
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
              RETURNING id`,
              [
                clientId,
                stockName,
                null,
                description || null,
                category || null,
                qty,
                price == null ? null : Number(price),
                0,
                null,
                null,
                null,
                statusForStock,
                null,
              ]
            );
          } else {
            throw err;
          }
        }

        const createdStockId = Number(stockRes?.rows?.[0]?.id);
        if (Number.isInteger(createdStockId) && createdStockId > 0) {
          try {
            // log initial stock history (best-effort)
            if (qty > 0) {
              await client.query(
                `INSERT INTO client_stock_history (
                  stock_id, client_id, quantity_before, quantity_after, adjustment, reason, created_by
                ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [createdStockId, clientId, 0, qty, qty, 'initial_stock', clientId]
              );
            }
          } catch {
            // ignore
          }

          const nextMeta = {
            ...(existingMeta || {}),
            stock_id: createdStockId,
            stock_source: 'store_management',
          };
          await client.query(
            'UPDATE client_store_products SET metadata = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3',
            [nextMeta, product.id, clientId]
          );
          product.metadata = nextMeta;
        }
      }
    }

    const computeVariantName = (v: { color?: string | null; size?: string | null; variant_name?: string | null }) => {
      const explicit = String(v.variant_name || '').trim();
      if (explicit) return explicit;
      const parts = [String(v.color || '').trim(), String(v.size || '').trim()].filter(Boolean);
      return parts.join(' / ') || null;
    };

    // If importing from stock variants, copy the selected variants exactly.
    if (importFromStockVariants) {
      const ownsStock = await client.query(
        'SELECT 1 FROM client_stock_products WHERE id = $1 AND client_id = $2 LIMIT 1',
        [importStockId, clientId]
      );
      if (!ownsStock.rowCount) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(404).json({ error: 'Stock item not found' });
      }

      let stockVariants: any[] = [];
      try {
        const variantsRes = await client.query(
          `SELECT id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
           FROM client_stock_variants
           WHERE client_id = $1 AND stock_id = $2 AND id = ANY($3::bigint[])
           ORDER BY sort_order ASC, id ASC`,
          [clientId, importStockId, uniqueImportVariantIds]
        );
        stockVariants = Array.isArray(variantsRes.rows) ? variantsRes.rows : [];
      } catch (err: any) {
        if (err?.code === '42P01') {
          await client.query('ROLLBACK');
          inTransaction = false;
          return res.status(400).json({ error: 'Stock variants are not available yet (migration pending)' });
        }
        throw err;
      }

      const foundIds = new Set<number>(stockVariants.map((v: any) => Number(v.id)));
      const missing = uniqueImportVariantIds.filter((id) => !foundIds.has(id));
      if (missing.length) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Some selected variants were not found' });
      }

      const seenKey = new Set<string>();
      for (const sv of stockVariants) {
        const color = sv.color != null && String(sv.color).trim() ? String(sv.color).trim() : null;
        const size = sv.size != null && String(sv.size).trim() ? String(sv.size).trim() : null;
        const key = `${String(color || '').toLowerCase()}::${String(size || '').toLowerCase()}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);

        const variantName = computeVariantName({ color, size, variant_name: sv.variant_name });
        const vPrice = sv.price == null ? null : Number(sv.price);
        const vStock = Number(sv.stock_quantity ?? 0);
        const vImages = Array.isArray(sv.images) ? sv.images : null;
        const isActive = sv.is_active == null ? true : Boolean(sv.is_active);
        const sortOrder = sv.sort_order == null ? 0 : Number(sv.sort_order);

        await client.query(
          `INSERT INTO product_variants
           (client_id, product_id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [clientId, product.id, color, size, variantName, vPrice, vStock, vImages, isActive, sortOrder]
        );
      }

      const sumRes = await client.query(
        `SELECT COALESCE(SUM(stock_quantity), 0)::int AS total
         FROM product_variants
         WHERE client_id = $1 AND product_id = $2 AND is_active = true`,
        [clientId, product.id]
      );
      const total = Number(sumRes.rows?.[0]?.total || 0);
      await client.query(
        'UPDATE client_store_products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3',
        [total, product.id, clientId]
      );
    }

    // If this product is created from Stock (sizes/colors arrays), auto-generate variants.
    // This bridges StockManagement (client_stock_products.sizes/colors) to storefront checkout (product_variants).
    const normalizeOptionList = (v: any): string[] => {
      if (!Array.isArray(v)) return [];
      const out: string[] = [];
      for (const raw of v) {
        const s = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
        if (!s) continue;
        if (s.length > 80) continue;
        const key = s.toLowerCase();
        if (!out.some((x) => x.toLowerCase() === key)) out.push(s);
        if (out.length >= 50) break;
      }
      return out;
    };

    const normalizedSizes = normalizeOptionList(sizes);
    const normalizedColors = normalizeOptionList(colors);

    if (!importFromStockVariants && (normalizedSizes.length || normalizedColors.length)) {
      const hasSize = normalizedSizes.length > 0;
      const hasColor = normalizedColors.length > 0;

      const combos: Array<{ color: string | null; size: string | null }> = [];
      if (hasColor && hasSize) {
        for (const c of normalizedColors) {
          for (const s of normalizedSizes) {
            combos.push({ color: c, size: s });
          }
        }
      } else if (hasColor) {
        for (const c of normalizedColors) combos.push({ color: c, size: null });
      } else if (hasSize) {
        for (const s of normalizedSizes) combos.push({ color: null, size: s });
      }

      const total = Math.max(0, Number(stock_quantity || 0));
      const count = combos.length || 1;
      const base = Math.floor(total / count);
      let remainder = total - base * count;

      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const qty = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        const nameParts = [combo.color || '', combo.size || ''].map((x) => String(x).trim()).filter(Boolean);
        const variantName = nameParts.length ? nameParts.join(' / ') : null;

        // Best-effort insert; unique index prevents duplicates.
        await client.query(
          `INSERT INTO product_variants (client_id, product_id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [
            clientId,
            product.id,
            combo.color,
            combo.size,
            variantName,
            null,
            qty,
            null,
            true,
            i,
          ]
        );
      }
    }

    await client.query('COMMIT');
    inTransaction = false;

    product.slug = slug;
    // Audit log create
    try {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)',
        [clientId, 'create_store_product', 'client_store_product', product.id, JSON.stringify({ title })]
      );
    } catch (e) {
      // Non-fatal
      console.error('Audit log (create_store_product) failed:', (e as any).message);
    }
    
    // Invalidate products cache after creation
    invalidateProductsCache(clientId);
    
    res.status(201).json(product);
  } catch (error) {
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error("Create store product error:", error);
    res.status(500).json({ error: "Failed to create product" });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

// Update product
export const updateStoreProduct: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    const { id } = req.params;
    const updates = req.body;

    // Whitelist of allowed columns to update
    const allowedColumns = [
      'title', 'description', 'price', 'original_price', 'images',
      'category', 'stock_quantity', 'status', 'is_featured', 'metadata'
    ];

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      // Only allow whitelisted columns
      if (allowedColumns.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        // For arrays (like images), ensure proper formatting
        if (Array.isArray(value)) {
          values.push(value);
        } else {
          values.push(value);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, clientId);

    const result = await pool.query(
      `UPDATE client_store_products 
       SET ${fields.join(", ")}
       WHERE id = $${paramCount} AND client_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    // Audit log update (record the fields changed, excluding large arrays)
    const changedKeys = Object.keys(updates).filter(k => !['images'].includes(k));
    try {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)',
        [clientId, 'update_store_product', 'client_store_product', id, JSON.stringify({ changed: changedKeys })]
      );
    } catch (e) {
      console.error('Audit log (update_store_product) failed:', (e as any).message);
    }
    
    // Invalidate products cache after update
    invalidateProductsCache(clientId);
    invalidateStorefrontProductsCache(); // clear public storefront cache for all stores (we don't have slug here)
    
    res.json(result.rows[0]);
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error("Update store product error:", error instanceof Error ? error.message : String(error));
    if (!isProduction) {
      console.error("Full error:", error);
    }
    const details = isProduction ? undefined : (error instanceof Error ? error.message : String(error));
    return res.status(500).json({
      error: "Failed to update product",
      ...(details ? { details } : {}),
    });
  }
};

// Delete product
export const deleteStoreProduct: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM client_store_products 
       WHERE id = $1 AND client_id = $2
       RETURNING id`,
      [id, clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    try {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id) VALUES ($1,$2,$3,$4)',
        [clientId, 'delete_store_product', 'client_store_product', id]
      );
    } catch (e) {
      console.error('Audit log (delete_store_product) failed:', (e as any).message);
    }
    
    // Invalidate products cache after deletion
    invalidateProductsCache(clientId);
    
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Delete store product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
};

// Get store categories
export const getStoreCategories: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;

    const result = await pool.query(
      `SELECT DISTINCT category 
       FROM client_store_products 
       WHERE client_id = $1 AND category IS NOT NULL
       ORDER BY category`,
      [clientId]
    );

    res.json(result.rows.map(r => r.category));
  } catch (error) {
    console.error("Get store categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// Get store settings
export const getStoreSettings: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins do not have a client store' });
    const clientId = (req as any).user.id;
    
    // Check cache first for faster response
    const cached = getCachedSettings(clientId);
    if (cached) {
      return res.json(cached);
    }
    
    logStoreSettings('getStoreSettings:start', { clientId });

    let result = await pool.query(
      `SELECT * FROM client_store_settings WHERE client_id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      // Check platform store limit before creating new store.
      // This must never hard-fail (some deployments may not have platform_settings).
      let currentStoreCount = 0;
      let maxStores = 1000; // Default if not set

      try {
        const storeCountResult = await pool.query(
          "SELECT COUNT(*) as count FROM client_store_settings WHERE client_id IS NOT NULL"
        );
        currentStoreCount = parseInt(storeCountResult.rows?.[0]?.count, 10) || 0;
      } catch (e) {
        console.warn('[STORE] Store count check failed:', (e as any)?.message);
      }

      try {
        const maxStoresResult = await pool.query(
          "SELECT setting_value FROM platform_settings WHERE setting_key = 'max_stores'"
        );
        if (maxStoresResult.rows.length > 0) {
          maxStores = parseInt(maxStoresResult.rows[0].setting_value, 10) || maxStores;
        }
      } catch (e) {
        console.warn('[STORE] max_stores setting read failed:', (e as any)?.message);
      }

      if (currentStoreCount >= maxStores) {
        console.log("[STORE] Store limit reached. Current:", currentStoreCount, "Max:", maxStores);
        return res.status(429).json({
          error: `Platform store limit reached. Maximum stores: ${maxStores}`,
          code: 'STORE_LIMIT_REACHED',
        });
      }

      // Generate unique slug
      const randomSlug = 'store-' + randomBytes(6).toString('base64url');
      
      // Create default settings with slug
      result = await pool.query(
        `INSERT INTO client_store_settings (client_id, store_slug, template)
         VALUES ($1, $2, $3) RETURNING *`,
        [clientId, randomSlug, 'books']
      );
    }

    // Handle legacy rows missing store_slug
    if (result.rows[0].store_slug == null) {
      const newSlug = 'store-' + randomBytes(6).toString('base64url');
      const updated = await pool.query(
        `UPDATE client_store_settings SET store_slug = $1 WHERE client_id = $2 RETURNING *`,
        [newSlug, clientId]
      );
      result.rows[0] = updated.rows[0];
    }

    const row = result.rows[0];
    const templateSettings = row?.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {};
    const globalSettings = row?.global_settings && typeof row.global_settings === 'object' ? row.global_settings : {};
    // IMPORTANT: Ensure row.template is NOT overridden by templateSettings/globalSettings
    const dbTemplate = row.template || 'books';
    const merged = { ...globalSettings, ...templateSettings, ...row, template: dbTemplate };

    // Cache the result for faster subsequent requests
    setCachedSettings(clientId, merged);
    
    logStoreSettings('getStoreSettings:success', { clientId, store_slug: merged.store_slug, template: merged.template });
    res.json(merged);
  } catch (error) {
    console.error("Get store settings error:", error);
    logStoreSettings('getStoreSettings:error', { error: (error as any)?.message });

    // Dev resilience: if Render DB is slow/unreachable during local development,
    // allow the UI (template editor, dashboard) to still load with a sane fallback.
    // This does NOT create any local database; it only avoids a hard crash/blank page.
    const isDev = process.env.NODE_ENV !== 'production' || String(process.env.SKIP_DB_INIT || '') === 'true';
    if (isDev) {
      const clientIdSafe = Number.isFinite(Number((req as any)?.user?.id)) ? Number((req as any).user.id) : undefined;
      return res.json({
        __dbUnavailable: true,
        __note: 'Using fallback store settings (DB unavailable in dev)',
        client_id: clientIdSafe,
        store_slug: 'preview',
        store_name: 'Preview Store',
        store_description: '',
        template: 'books',
        currency_code: 'DZD',
        primary_color: '#111827',
        secondary_color: '#6B7280',
        banner_url: null,
        hero_main_url: null,
        hero_tile1_url: null,
        hero_tile2_url: null,
        template_settings: {},
        global_settings: {},
      });
    }

    res.status(500).json({ error: "Failed to fetch store settings" });
  }
};

// Helper function to retry database operations on transient errors
// Operations should use the pool parameter, not the module-level pool import
async function withRetry<T>(operation: (db: typeof pool) => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Get a fresh pool connection for each attempt
      const db = await getPool();
      return await operation(db);
    } catch (err: any) {
      lastError = err;
      const isRetryable = err?.message?.includes('Connection terminated') ||
                          err?.message?.includes('Query read timeout') ||
                          err?.message?.includes('ECONNRESET') ||
                          err?.message?.includes('Cannot read properties of null') ||
                          err?.message?.includes('Pool was reset') ||
                          err?.message?.includes('connection') ||
                          err?.code === 'ECONNRESET';
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      console.log(`Retrying database operation (attempt ${attempt + 2}/${maxRetries + 1})...`);
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 5000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Update store settings
export const updateStoreSettings: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins are not allowed to manage client storefronts' });
    const clientId = (req as any).user.id;
    const updates = req.body || {};
    logStoreSettings('updateStoreSettings:start', { clientId, keys: Object.keys(updates) });

    // Basic input validation (defense-in-depth)
    const updateKeys = Object.keys(updates);
    if (updateKeys.length > 200) {
      return res.status(400).json({ error: 'Too many fields in update' });
    }

    const stringFields = new Set([
      'store_name',
      'store_description',
      'store_logo',
      'primary_color',
      'secondary_color',
      'custom_domain',
      'store_slug',
      'template',
      'banner_url',
      'currency_code',
      'hero_main_url',
      'hero_tile1_url',
      'hero_tile2_url',
      'owner_name',
      'owner_email',
      'template_hero_heading',
      'template_hero_subtitle',
      'template_button_text',
      'template_accent_color',
      'template_bg_color',
      'seller_name',
      'seller_email',
    ]);

    const booleanFields = new Set(['is_public']);

    for (const key of updateKeys) {
      const value = (updates as any)[key];
      if (stringFields.has(key)) {
        if (value !== null && value !== undefined && typeof value !== 'string') {
          return res.status(400).json({ error: `Invalid type for ${key}` });
        }
        if (typeof value === 'string' && value.length > 5000) {
          return res.status(400).json({ error: `Value too long for ${key}` });
        }
      }
      if (booleanFields.has(key)) {
        if (value !== null && value !== undefined && typeof value !== 'boolean') {
          return res.status(400).json({ error: `Invalid type for ${key}` });
        }
      }
      if (key === '__templateSwitch') {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          return res.status(400).json({ error: 'Invalid __templateSwitch payload' });
        }
      }
    }

    // Load current row so we can merge JSON settings and support template switching.
    // Wrap in retry for transient connection errors
    let existingRes = await withRetry((db) => db.query('SELECT * FROM client_store_settings WHERE client_id = $1', [clientId]));
    if (existingRes.rows.length === 0) {
      const randomSlug = 'store-' + randomBytes(6).toString('base64url');
      existingRes = await withRetry((db) => db.query(
        `INSERT INTO client_store_settings (client_id, store_slug)
         VALUES ($1, $2) RETURNING *`,
        [clientId, randomSlug]
      ));
    }
    const existingRow = existingRes.rows[0];

    // Detect available columns (cached to avoid slow information_schema queries)
    const existingCols = await getStoreSettingsColumns(await ensureConnection());

    // Reserved control payload for template switching.
    const templateSwitch = (updates as any).__templateSwitch;
    if ((updates as any).__templateSwitch !== undefined) delete (updates as any).__templateSwitch;

    // Normalize image list fields: trim whitespace, remove duplicate commas, convert empty to NULL
    const imageKeys = new Set(['banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url']);
    Object.keys(updates).forEach((key) => {
      const val = updates[key];
      if (imageKeys.has(key) && typeof val === 'string') {
        // Normalize: split by comma, trim each, filter empties, dedupe
        const parts = val
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        const deduped: string[] = [];
        parts.forEach((p: string) => {
          if (!deduped.includes(p)) deduped.push(p);
        });
        if (deduped.length === 0) {
          updates[key] = null;
        } else {
          updates[key] = deduped.join(',');
        }
      }
      // Explicitly allow clearing by sending null
      if (imageKeys.has(key) && (val === '' || val === undefined)) {
        updates[key] = null;
      }
    });

    // Support `store_images` (array) for gallery images. Normalize to text[] or NULL.
    if (Object.prototype.hasOwnProperty.call(updates, 'store_images')) {
      const v = updates.store_images;
      if (v == null) {
        updates.store_images = null;
      } else if (Array.isArray(v)) {
        const arr = v.map((s: any) => (s == null ? '' : String(s).trim())).filter((s: string) => s.length > 0);
        updates.store_images = arr.length ? arr : null;
      } else if (typeof v === 'string') {
        const arr = v
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        updates.store_images = arr.length ? arr : null;
      } else {
        // Unknown type - coerce to null
        updates.store_images = null;
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Whitelist of allowed store settings columns (avoid unknown keys causing DB errors)
    const allowedCols = new Set([
      'store_name', 'store_description', 'store_logo', 'primary_color', 'secondary_color',
      'custom_domain', 'is_public', 'store_slug', 'template', 'banner_url', 'currency_code',
      'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'owner_name', 'owner_email', 'store_images',
      'hero_video_url', // Video hero support
      // Template customization fields
      'template_hero_heading', 'template_hero_subtitle', 'template_button_text', 'template_accent_color',
      'template_bg_color', 'template_text_color', 'template_muted_color',
      'template_header_bg', 'template_header_text',
      'template_hero_title_color', 'template_hero_title_size',
      'template_hero_subtitle_color', 'template_hero_subtitle_size',
      'template_hero_kicker', 'template_hero_kicker_color',
      'template_button2_text', 'template_button2_border',
      'template_hero_badge_title', 'template_hero_badge_subtitle',
      'template_featured_title', 'template_featured_subtitle',
      'template_section_title_color', 'template_section_title_size', 'template_section_subtitle_color',
      'template_card_bg', 'template_product_title_color', 'template_product_price_color',
      'template_copyright', 'template_footer_text', 'template_footer_link_color', 'template_footer_bg',
      // Typography
      'template_font_family', 'template_font_weight', 'template_heading_font_weight',
      // Border radius
      'template_border_radius', 'template_card_border_radius', 'template_button_border_radius',
      // Spacing
      'template_spacing', 'template_section_spacing',
      // Animations
      'template_animation_speed', 'template_hover_scale',
      // Grid
      'template_grid_columns', 'template_grid_gap', 'template_grid_title',
      // Category pills
      'template_category_pill_bg', 'template_category_pill_text',
      'template_category_pill_active_bg', 'template_category_pill_active_text', 'template_category_pill_border_radius',
      // Custom CSS and links (stored as JSON strings)
      'template_custom_css', 'template_social_links', 'template_nav_links',
      // Product card settings
      'template_add_to_cart_label',
      // allow older/client payloads to include seller fields without failing
      'seller_name', 'seller_email'
    ].filter((col) => existingCols.has(col)));

    // Columns we treat as template-scoped for per-template snapshots.
    const templateScopedCols = new Set([
      'template_hero_heading',
      'template_hero_subtitle',
      'template_button_text',
      'template_accent_color',
      'template_bg_color',
      'hero_main_url',
      'hero_tile1_url',
      'hero_tile2_url',
      'store_images',
    ].filter((col) => existingCols.has(col)));

    const normalizeTemplateIdForAvailability = (id: any): string => {
      const normalized = String(id || '')
        .trim()
        .toLowerCase()
        .replace(/^gold-/, '')
        .replace(/-gold$/, '');
      if (!normalized) return 'pro';
      if (normalized === 'shiro-hana') return 'pro';
      if (normalized === 'babyos' || normalized === 'baby') return 'kids';
      if (normalized === 'luxedark') return 'luxedrop';
      return normalized;
    };

    const existingTemplateRaw = existingRow?.template || 'pro';
    const existingTemplate = normalizeTemplateIdForAvailability(existingTemplateRaw);
    const existingTemplateSettings =
      existingRow?.template_settings && typeof existingRow.template_settings === 'object'
        ? existingRow.template_settings
        : {};
    // Clean previously embedded DB columns from template_settings JSONB (past data-compounding bug)
    for (const staleKey of ['template_settings', 'template_settings_by_template', 'global_settings',
      'id', 'client_id', 'created_at', 'updated_at', 'page_views']) {
      delete existingTemplateSettings[staleKey];
    }
    const existingTemplateByTemplate =
      existingRow?.template_settings_by_template && typeof existingRow.template_settings_by_template === 'object'
        ? existingRow.template_settings_by_template
        : {};

    const buildTemplateSnapshot = (row: any) => {
      const snapshot: any = {
        ...(row?.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {}),
      };
      for (const col of templateScopedCols) {
        if (row && Object.prototype.hasOwnProperty.call(row, col)) snapshot[col] = row[col];
      }
      return snapshot;
    };

    const safeObject = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

    // Unknown keys are persisted into template_settings JSONB instead of being dropped.
    // IMPORTANT: Exclude actual DB column names so they never get re-embedded into template_settings JSONB,
    // which would cause exponential data growth on every save cycle.
    const dbMetaColumns = new Set([
      'template_settings', 'template_settings_by_template', 'global_settings',
      'created_at', 'updated_at', 'page_views', 'subscription_status',
      'subscription_plan', 'trial_ends_at', 'subscription_ends_at', 'is_locked',
    ]);
    const extraUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'client_id') return;
      if (key.startsWith('__')) return;
      if (allowedCols.has(key)) return;
      if (dbMetaColumns.has(key)) return;
      // Store any other key in JSON settings.
      extraUpdates[key] = value;
    });

    // Prepare a column update object so we can inject computed changes (switching templates).
    const columnUpdates: Record<string, any> = {};

    // Apply any allowed column updates from payload.
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'client_id') return;
      if (key.startsWith('__')) return;
      if (!allowedCols.has(key)) return;
      columnUpdates[key] = value;
    });

    // Handle template switching (server-side, persisted immediately)
    // Expected payload: { __templateSwitch: { toTemplate, mode: 'defaults'|'import', importKeys?: string[] } }
    // - defaults: start with empty snapshot (template defaults)
    // - import: start with existing target snapshot (if any) and overlay selected keys from old snapshot
    let nextTemplateSettings: any | null = null;
    let nextTemplateByTemplate: any | null = null;
    if (templateSwitch && typeof templateSwitch === 'object' && typeof templateSwitch.toTemplate === 'string') {
      const toTemplate = String(templateSwitch.toTemplate);
      const mode = templateSwitch.mode === 'import' ? 'import' : 'defaults';
      const importKeys: string[] = Array.isArray(templateSwitch.importKeys)
        ? templateSwitch.importKeys.map((k: any) => String(k))
        : [];

      logStoreSettings('templateSwitch:start', { 
        clientId, 
        fromTemplate: existingTemplate, 
        toTemplate, 
        mode, 
        importKeys 
      });

      const oldSnapshot = buildTemplateSnapshot(existingRow);
      const map = { ...safeObject(existingTemplateByTemplate) };
      map[existingTemplate] = oldSnapshot;

      const baseTargetSnapshot = mode === 'defaults' ? {} : { ...safeObject(map[toTemplate]) };
      if (mode === 'import') {
        for (const k of importKeys) {
          if (Object.prototype.hasOwnProperty.call(oldSnapshot, k)) {
            baseTargetSnapshot[k] = oldSnapshot[k];
          }
        }
      }

      // Apply new template + snapshot.
      columnUpdates.template = toTemplate;

      logStoreSettings('templateSwitch:columnUpdates', { 
        clientId, 
        template: columnUpdates.template 
      });

      // Template-scoped columns: set to snapshot value, or NULL on defaults.
      for (const col of templateScopedCols) {
        if (Object.prototype.hasOwnProperty.call(baseTargetSnapshot, col)) {
          columnUpdates[col] = baseTargetSnapshot[col];
        } else {
          // Reset to default (template internal fallback) when not provided
          columnUpdates[col] = null;
        }
      }

      // JSON settings are snapshot minus template-scoped columns.
      const { ...snapshotCopy } = baseTargetSnapshot;
      for (const col of templateScopedCols) delete snapshotCopy[col];
      // Never store 'template' in JSON settings (it's a DB column)
      delete snapshotCopy.template;
      nextTemplateSettings = snapshotCopy;

      // Persist updated snapshot map.
      map[toTemplate] = baseTargetSnapshot;
      nextTemplateByTemplate = map;
    } else {
      // Normal save: merge extra updates into JSON template settings, and refresh per-template snapshot.
      const mergedTemplateSettings = { ...safeObject(existingTemplateSettings), ...extraUpdates };
      // Ensure 'template' key is never stored in JSON settings (it's a DB column)
      delete mergedTemplateSettings.template;
      nextTemplateSettings = mergedTemplateSettings;

      const snapshot = buildTemplateSnapshot({ ...existingRow, template_settings: mergedTemplateSettings, ...columnUpdates });
      const map = { ...safeObject(existingTemplateByTemplate), [existingTemplate]: snapshot };
      nextTemplateByTemplate = map;
    }

    // Clean any 'template' key from JSON settings before saving (it's a DB column, not JSON)
    if (nextTemplateSettings && typeof nextTemplateSettings === 'object') {
      delete nextTemplateSettings.template;
    }

    // All templates are now enabled
    const ENABLED_TEMPLATE_IDS = new Set<string>([
      'bags', 'jewelry',
      'fashion', 'electronics', 'beauty', 'food', 'cafe', 'furniture', 'perfume',
      'minimal', 'classic', 'modern',
      // New templates
      'sports', 'books', 'pets', 'toys', 'garden', 'art', 'music', 'health',
      'watches', 'shoes', 'gaming', 'automotive', 'crafts', 'outdoor', 'vintage',
      'tech', 'organic', 'luxury', 'kids', 'travel', 'photography', 'wedding',
      'fitness', 'gifts', 'candles', 'skincare', 'supplements', 'phone-accessories',
      'tools', 'office', 'stationery', 'neon', 'pastel', 'monochrome', 'gradient',
      'florist', 'eyewear', 'lingerie', 'swimwear', 'streetwear', 'wine', 'chocolate', 'tea',
      'pro',
      // Pro variants
      'pro-aurora', 'pro-vertex', 'pro-atelier', 'pro-orbit', 'pro-zen',
      'pro-studio', 'pro-mosaic', 'pro-grid', 'pro-catalog',
      'dzshop', 'dzpremium', 'luxedrop', 'needdz',
      'dzshop', 'dzpremium',
      // Screenshot-inspired templates
      'sage-boutique', 'mint-elegance', 'forest-store',
      'sunset-shop', 'coral-market', 'amber-store',
      'magenta-mall', 'berry-market', 'rose-catalog',
      'lime-direct', 'emerald-shop', 'neon-store',
      'clean-single', 'pure-product', 'snow-shop',
      'gallery-pro', 'showcase-plus', 'exhibit-store'
    ]);

    // If the store currently has a removed/legacy template, migrate it on any save.
    if (!('template' in columnUpdates) && existingTemplateRaw !== existingTemplate) {
      columnUpdates.template = existingTemplate;
    }

    const requestedTemplate = typeof columnUpdates.template === 'string' ? String(columnUpdates.template) : null;
    if (requestedTemplate) {
      const normalizedRequested = normalizeTemplateIdForAvailability(requestedTemplate);
      const normalizedExisting = normalizeTemplateIdForAvailability(existingTemplate);
      const isEnabled = ENABLED_TEMPLATE_IDS.has(normalizedRequested);
      const isSameAsExisting = normalizedRequested === normalizedExisting;

      if (!isEnabled && !isSameAsExisting) {
        return res.status(400).json({
          error: 'This template is coming soon',
          template: normalizedRequested,
        });
      }

      // Persist normalized template IDs (unified template category), while still
      // accepting legacy values like gold-shiro-hana.
      columnUpdates.template = normalizedRequested;
    }

    // Apply computed + direct column updates
    Object.entries(columnUpdates).forEach(([key, value]) => {
      // Always add the field to update, even if null
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    // Persist JSON settings columns
    if (nextTemplateSettings != null && existingCols.has('template_settings')) {
      fields.push(`template_settings = $${paramCount}`);
      values.push(nextTemplateSettings);
      paramCount++;
    }
    if (nextTemplateByTemplate != null && existingCols.has('template_settings_by_template')) {
      fields.push(`template_settings_by_template = $${paramCount}`);
      values.push(nextTemplateByTemplate);
      paramCount++;
    }

    if (fields.length === 0) {
      // No fields to update - still return success with current settings
      const result = await withRetry((db) => db.query(
        'SELECT * FROM client_store_settings WHERE client_id = $1',
        [clientId]
      ));
      const row = result.rows[0];
      const templateSettings = row?.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {};
      const globalSettings = row?.global_settings && typeof row.global_settings === 'object' ? row.global_settings : {};
      const dbTemplate = row?.template;
      return res.json({ ...globalSettings, ...templateSettings, ...row, template: dbTemplate });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(clientId);

    const queryText = `UPDATE client_store_settings 
       SET ${fields.join(", ")}
       WHERE client_id = $${paramCount}
       RETURNING *`;
    
    logStoreSettings('updateStoreSettings:query', { 
      clientId, 
      fields: fields.length, 
      hasTemplate: fields.some(f => f.startsWith('template =')),
      queryPreview: queryText.substring(0, 200)
    });
    
    const result = await withRetry((db) => db.query(queryText, values));

    const updatedRow = result.rows[0];
    
    // Sync store_name to clients.business_name
    if (columnUpdates.store_name) {
      await pool.query(
        `UPDATE clients SET business_name = $1, updated_at = NOW() WHERE id = $2`,
        [columnUpdates.store_name, clientId]
      );
    }
    
    // Verify template was saved correctly
    if (updatedRow) {
      logStoreSettings('updateStoreSettings:dbResult', { 
        clientId, 
        savedTemplate: updatedRow.template,
        rowCount: result.rowCount
      });
    }
    
    const templateSettings = updatedRow?.template_settings && typeof updatedRow.template_settings === 'object' ? updatedRow.template_settings : {};
    const globalSettings = updatedRow?.global_settings && typeof updatedRow.global_settings === 'object' ? updatedRow.global_settings : {};
    // IMPORTANT: Ensure template from DB is NOT overridden by templateSettings/globalSettings
    const dbTemplate = updatedRow?.template;
    const merged = { ...globalSettings, ...templateSettings, ...updatedRow, template: dbTemplate };
    
    // Invalidate cache after update
    invalidateSettingsCache(clientId);
    // Also invalidate public storefront cache so visitors see the new template immediately
    if (merged.store_slug) {
      invalidateStorefrontSettingsCache(merged.store_slug);
    } else {
      invalidateAllStorefrontSettingsCache();
    }
    // Also update cache with new data
    setCachedSettings(clientId, merged);
    
    logStoreSettings('updateStoreSettings:success', { clientId, keys: Object.keys(updates), store_slug: merged.store_slug, template: merged.template });

    // Audit log settings update
    const changedSettings = Object.keys(updates);
    try {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)',
        [clientId, 'update_store_settings', 'client_store_settings', clientId, JSON.stringify({ changed: changedSettings })]
      );
    } catch (e) {
      console.error('Audit log (update_store_settings) failed:', (e as any).message);
    }
    res.json(merged);
  } catch (error) {
    // Log full error for debugging
    console.error("Update store settings error:", error);
    logStoreSettings('updateStoreSettings:error', { error: (error as any)?.message });

    // Try to extract a clear error message
    let errorMsg = 'Failed to update store settings';
    let details = '';
    if (error instanceof Error) {
      details = error.message;
      // Common image size/encoding errors
      if (details.includes('payload too large') || details.includes('out of memory') || details.includes('too large')) {
        errorMsg = 'Image is too large to save. Please use a smaller image.';
      } else if (details.includes('invalid input syntax')) {
        errorMsg = 'Invalid image data or URL.';
      } else if (details.includes('connection') || details.includes('timeout')) {
        errorMsg = 'Database connection error. Please try again later.';
      } else {
        errorMsg = details;
      }
    } else if (typeof error === 'string') {
      details = error;
      errorMsg = error;
    }

    const isDev = process.env.NODE_ENV !== 'production' || String(process.env.SKIP_DB_INIT || '') === 'true';
    if (isDev) {
      // Dev resilience: echo back the attempted settings so the UI remains usable.
      // (Not persisted without DB.)
      return res.json({
        ...(req.body || {}),
        __dbUnavailable: true,
        __note: 'Update accepted in dev fallback (DB unavailable)',
        error: errorMsg,
        details,
      });
    }

    res.status(500).json({ error: errorMsg, details });
  }
};

// Fast template-only update (avoids timeout on slow DB)
export const updateStoreTemplate: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) {
      return res.status(403).json({ error: 'Admins do not have a client store' });
    }
    const clientId = (req as any).user.id;
    const { template, mode, importKeys } = req.body || {};
    
    if (!template || typeof template !== 'string') {
      return res.status(400).json({ error: 'Template ID required' });
    }
    
    const normalizedTemplate = String(template).trim().toLowerCase()
      .replace(/^gold-/, '').replace(/-gold$/, '');
    
    const switchMode = mode === 'defaults' ? 'defaults' : 'import';
    const safeImportKeys: string[] = Array.isArray(importKeys) ? importKeys.map((k: any) => String(k)) : [];

    logStoreSettings('updateStoreTemplate:start', {
      clientId,
      template: normalizedTemplate,
      mode: switchMode,
      importKeysCount: safeImportKeys.length,
    });

    const isRetryableDbError = (err: any): boolean => {
      const msg = String(err?.message || '').toLowerCase();
      const code = String(err?.code || '').toUpperCase();
      return (
        msg.includes('query read timeout') ||
        msg.includes('connection terminated') ||
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        (msg.includes('socket') && msg.includes('hang up')) ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET'
      );
    };

    const withDbRetry = async <T,>(operation: (db: Pool) => Promise<T>, maxRetries = 2): Promise<T> => {
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
    };

    const merged = await withDbRetry(async (db) => {
      // Load current row so we can persist template snapshots (per-template edits).
      const currentRes = await db.query('SELECT * FROM client_store_settings WHERE client_id = $1', [clientId]);
      if (currentRes.rowCount === 0) {
        return null;
      }

      const existingRow = currentRes.rows[0];

      // Discover existing columns (cached to avoid slow information_schema queries)
      const existingCols = await getStoreSettingsColumns(db);

    const normalizeTemplateIdForAvailability = (id: any): string => {
      const normalized = String(id || '')
        .trim()
        .toLowerCase()
        .replace(/^gold-/, '')
        .replace(/-gold$/, '');
      if (!normalized) return 'pro';
      if (normalized === 'shiro-hana') return 'pro';
      if (normalized === 'babyos' || normalized === 'baby') return 'kids';
      if (normalized === 'luxedark') return 'luxedrop';
      return normalized;
    };

      const existingTemplateRaw = existingRow?.template || 'pro';
    const existingTemplate = normalizeTemplateIdForAvailability(existingTemplateRaw);
    const existingTemplateSettings =
      existingRow?.template_settings && typeof existingRow.template_settings === 'object'
        ? existingRow.template_settings
        : {};
    // Clean previously embedded DB columns from template_settings JSONB (past data-compounding bug)
    for (const staleKey of ['template_settings', 'template_settings_by_template', 'global_settings',
      'id', 'client_id', 'created_at', 'updated_at', 'page_views']) {
      delete existingTemplateSettings[staleKey];
    }
    const existingTemplateByTemplate =
      existingRow?.template_settings_by_template && typeof existingRow.template_settings_by_template === 'object'
        ? existingRow.template_settings_by_template
        : {};

    const safeObject = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

    // Columns we treat as template-scoped for per-template snapshots.
    const templateScopedCols = [
      'template_hero_heading',
      'template_hero_subtitle',
      'template_button_text',
      'template_accent_color',
      'template_bg_color',
      'hero_main_url',
      'hero_tile1_url',
      'hero_tile2_url',
      'store_images',
    ].filter((col) => existingCols.has(col));

      const buildTemplateSnapshot = (row: any) => {
      const snapshot: any = {
        ...(row?.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {}),
      };
      for (const col of templateScopedCols) {
        if (row && Object.prototype.hasOwnProperty.call(row, col)) snapshot[col] = row[col];
      }
      return snapshot;
      };

    const oldSnapshot = buildTemplateSnapshot(existingRow);
    const map = { ...safeObject(existingTemplateByTemplate) } as any;
    map[existingTemplate] = oldSnapshot;

    const targetSnapshotBase =
      switchMode === 'defaults' ? {} : { ...safeObject(map[normalizedTemplate]) };

    if (switchMode === 'import' && safeImportKeys.length > 0) {
      for (const k of safeImportKeys) {
        if (Object.prototype.hasOwnProperty.call(oldSnapshot, k)) {
          targetSnapshotBase[k] = oldSnapshot[k];
        }
      }
    }

    // Apply scoped columns (or reset to null on defaults).
    const columnUpdates: Record<string, any> = { template: normalizedTemplate };
    for (const col of templateScopedCols) {
      if (Object.prototype.hasOwnProperty.call(targetSnapshotBase, col)) {
        columnUpdates[col] = targetSnapshotBase[col];
      } else {
        columnUpdates[col] = null;
      }
    }

    // JSON settings are snapshot minus template-scoped columns.
    const nextTemplateSettings = { ...targetSnapshotBase } as any;
    for (const col of templateScopedCols) delete nextTemplateSettings[col];
    delete nextTemplateSettings.template;

    map[normalizedTemplate] = targetSnapshotBase;
    const nextTemplateByTemplate = map;

    // Build update query.
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(columnUpdates).forEach(([key, value]) => {
      if (!existingCols.has(key)) return;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    if (existingCols.has('template_settings')) {
      fields.push(`template_settings = $${paramCount}`);
      values.push(nextTemplateSettings);
      paramCount++;
    }
    if (existingCols.has('template_settings_by_template')) {
      fields.push(`template_settings_by_template = $${paramCount}`);
      values.push(nextTemplateByTemplate);
      paramCount++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(clientId);

      const queryText = `UPDATE client_store_settings SET ${fields.join(", ")} WHERE client_id = $${paramCount} RETURNING *`;
      const result = await db.query(queryText, values);

    const updatedRow = result.rows[0];
    const templateSettings =
      updatedRow?.template_settings && typeof updatedRow.template_settings === 'object' ? updatedRow.template_settings : {};
    const globalSettings =
      updatedRow?.global_settings && typeof updatedRow.global_settings === 'object' ? updatedRow.global_settings : {};
    const dbTemplate = updatedRow?.template;
    const merged = { ...globalSettings, ...templateSettings, ...updatedRow, template: dbTemplate };

      return merged;
    });

    if (!merged) {
      return res.status(404).json({ error: 'Store settings not found' });
    }

    invalidateSettingsCache(clientId);
    // Also invalidate public storefront cache so visitors see the new template immediately
    if (merged.store_slug) {
      invalidateStorefrontSettingsCache(merged.store_slug);
    } else {
      invalidateAllStorefrontSettingsCache();
    }
    setCachedSettings(clientId, merged);

    logStoreSettings('updateStoreTemplate:success', { clientId, template: merged?.template, mode: switchMode });
    res.json(merged);
  } catch (error) {
    console.error('Update store template error:', error);
    logStoreSettings('updateStoreTemplate:error', { error: (error as any)?.message });
    const isDev = process.env.NODE_ENV !== 'production' || String(process.env.SKIP_DB_INIT || '') === 'true';
    if (isDev) {
      return res.json({
        ...(req.body || {}),
        __dbUnavailable: true,
        __note: 'Update accepted in dev fallback (DB unavailable)',
        error: String((error as any)?.message || 'Failed to update template'),
      });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
};

// Store stats (aggregated)
export const getStoreStats: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins do not have a client store' });
    const clientId = (req as any).user.id;
    
    // Get product stats
    const productStatsRes = await pool.query(
      `SELECT 
        COUNT(*) AS total_products,
        COUNT(*) FILTER (WHERE status='active') AS active_products,
        COUNT(*) FILTER (WHERE status='draft') AS draft_products,
        COALESCE(SUM(views),0) AS total_product_views
       FROM client_store_products
       WHERE client_id = $1`,
      [clientId]
    );
    
    // Get page views from store settings
    const pageViewsRes = await pool.query(
      `SELECT COALESCE(page_views, 0) AS page_views
       FROM client_store_settings
       WHERE client_id = $1`,
      [clientId]
    );
    
    const productStats = productStatsRes.rows[0];
    const pageViews = pageViewsRes.rows[0]?.page_views || 0;
    
    res.json({
      total_products: productStats.total_products,
      active_products: productStats.active_products,
      draft_products: productStats.draft_products,
      total_product_views: productStats.total_product_views,
      page_views: pageViews,
      // Keep total_views for backward compatibility (now means page views)
      total_views: pageViews
    });
  } catch (e) {
    console.error('Get store stats error:', e);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Generate shareable link for product
export const getProductShareLink: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) return res.status(403).json({ error: 'Admins do not have a client store' });
    const clientId = (req as any).user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT slug FROM client_store_products 
       WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Fetch store slug to build human-friendly URL
    const settingsRes = await pool.query(
      `SELECT store_slug FROM client_store_settings WHERE client_id = $1`,
      [clientId]
    );
    const storeSlug = settingsRes.rows[0]?.store_slug || clientId;
    const baseUrl = getPublicBaseUrl(req);
    const shareLink = `${baseUrl}/store/${storeSlug}/${result.rows[0].slug}`;

    res.json({ shareLink, slug: result.rows[0].slug, store_slug: storeSlug });
  } catch (error) {
    console.error("Get share link error:", error);
    res.status(500).json({ error: "Failed to generate share link" });
  }
};

/**
 * Get all images in the client's account (Media Library)
 * GET /api/client/media-library
 */
export const getMediaLibrary: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) {
      return res.status(403).json({ error: 'Admins do not have a client store' });
    }
    const clientId = (req as any).user.id;

    const images: any[] = [];

    // 1. Get product images
    const productsRes = await pool.query(
      `SELECT id, title, images FROM client_store_products WHERE client_id = $1 AND images IS NOT NULL`,
      [clientId]
    );
    
    for (const product of productsRes.rows) {
      const productImages = Array.isArray(product.images) 
        ? product.images 
        : (typeof product.images === 'string' ? JSON.parse(product.images) : []);
      
      for (let i = 0; i < productImages.length; i++) {
        const url = productImages[i];
        if (url && typeof url === 'string' && url.trim()) {
          images.push({
            id: `product_${product.id}_${i}`,
            url: url.trim(),
            source: 'product',
            source_id: product.id,
            source_name: product.title
          });
        }
      }
    }

    // 2. Get store settings images
    const imageKeys = [
      'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 
      'banner_url', 'logo_url', 'favicon_url', 'store_images'
    ];
    
    const settingsRes = await pool.query(
      `SELECT key, value FROM store_settings WHERE client_id = $1 AND key = ANY($2)`,
      [clientId, imageKeys]
    );

    for (const setting of settingsRes.rows) {
      if (setting.key === 'store_images') {
        // store_images is an array
        try {
          const storeImages = typeof setting.value === 'string' 
            ? JSON.parse(setting.value) 
            : setting.value;
          if (Array.isArray(storeImages)) {
            for (let i = 0; i < storeImages.length; i++) {
              const url = storeImages[i];
              if (url && typeof url === 'string' && url.trim()) {
                images.push({
                  id: `store_images_${i}`,
                  url: url.trim(),
                  source: 'store_images',
                  source_name: `Store Image ${i + 1}`
                });
              }
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      } else {
        // Single URL settings
        const url = setting.value;
        if (url && typeof url === 'string' && url.trim()) {
          images.push({
            id: `setting_${setting.key}`,
            url: url.trim(),
            source: setting.key,
            source_name: setting.key.replace(/_/g, ' ').replace(/url$/i, '').trim()
          });
        }
      }
    }

    res.json({ images });
  } catch (error) {
    console.error("Get media library error:", error);
    res.status(500).json({ error: "Failed to load media library" });
  }
};

/**
 * Delete an image from the media library
 * DELETE /api/client/media-library
 */
export const deleteMediaImage: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (user && (user.role === 'admin' || user.user_type === 'admin')) {
      return res.status(403).json({ error: 'Admins do not have a client store' });
    }
    const clientId = (req as any).user.id;
    const { url, source, source_id } = req.body;

    if (!url || !source) {
      return res.status(400).json({ error: 'URL and source are required' });
    }

    if (source === 'product' && source_id) {
      // Remove image from product's images array
      const productRes = await pool.query(
        `SELECT images FROM client_store_products WHERE id = $1 AND client_id = $2`,
        [source_id, clientId]
      );
      
      if (productRes.rows.length > 0) {
        let images = productRes.rows[0].images || [];
        if (typeof images === 'string') images = JSON.parse(images);
        images = images.filter((img: string) => img !== url);
        
        await pool.query(
          `UPDATE client_store_products SET images = $1 WHERE id = $2 AND client_id = $3`,
          [JSON.stringify(images), source_id, clientId]
        );
        invalidateProductsCache(clientId);
      }
    } else if (source === 'store_images') {
      // Remove from store_images array
      const settingRes = await pool.query(
        `SELECT value FROM store_settings WHERE client_id = $1 AND key = 'store_images'`,
        [clientId]
      );
      
      if (settingRes.rows.length > 0) {
        let images = settingRes.rows[0].value || [];
        if (typeof images === 'string') images = JSON.parse(images);
        images = images.filter((img: string) => img !== url);
        
        await pool.query(
          `UPDATE store_settings SET value = $1 WHERE client_id = $2 AND key = 'store_images'`,
          [JSON.stringify(images), clientId]
        );
        invalidateSettingsCache(clientId);
      }
    } else {
      // Delete single URL setting (hero, banner, logo, etc)
      await pool.query(
        `DELETE FROM store_settings WHERE client_id = $1 AND key = $2`,
        [clientId, source]
      );
      invalidateSettingsCache(clientId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete media image error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
};

export default router;
