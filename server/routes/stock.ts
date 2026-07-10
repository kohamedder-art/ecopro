import { RequestHandler } from "express";
import { ensureConnection } from "../utils/database";
import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

function zStringTrim(max: number) {
  return z.string().trim().min(1).max(max);
}

const stockStatusSchema = z.enum(['active', 'discontinued', 'out_of_stock']);
const stockShippingModeSchema = z.enum(['delivery_pricing', 'flat', 'free']);

const zIntFromAny = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number.parseInt(String(v), 10);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number()
      .int()
      .refine((n) => (opts.min == null ? true : n >= opts.min!), `Must be >= ${opts.min ?? 0}`)
      .refine((n) => (opts.max == null ? true : n <= opts.max!), `Must be <= ${opts.max}`)
  );

const zNumberFromAny = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    },
    z
      .number()
      .refine((n) => (opts.min == null ? true : n >= opts.min!), `Must be >= ${opts.min ?? 0}`)
      .refine((n) => (opts.max == null ? true : n <= opts.max!), `Must be <= ${opts.max}`)
  );

function validateBody(schema: z.ZodTypeAny, body: any): { ok: true; data: any } | { ok: false; message: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors?.[0]?.message || 'Invalid request';
    return { ok: false, message: msg };
  }
  return { ok: true, data: parsed.data };
}

const createStockBodySchema = z
  .object({
    name: zStringTrim(255),
    sku: z.string().trim().max(100).optional(),
    description: z.string().trim().max(10000).optional(),
    category: z.string().trim().max(100).optional(),
    sizes: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
    colors: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
    quantity: zIntFromAny({ min: 0 }).optional(),
    unit_price: zNumberFromAny({ min: 0 }).optional(),
    reorder_level: zIntFromAny({ min: 0 }).optional(),
    location: z.string().trim().max(255).optional(),
    supplier_name: z.string().trim().max(255).optional(),
    supplier_contact: z.string().trim().max(255).optional(),
    status: stockStatusSchema.optional(),
    shipping_mode: stockShippingModeSchema.optional(),
    shipping_flat_fee: zNumberFromAny({ min: 0 }).optional(),
    notes: z.string().trim().max(10000).optional(),
    images: z.array(z.string().trim().max(2048)).max(10).optional(),
  })
  .strict();

const updateStockBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    sku: z.string().trim().max(100).optional(),
    description: z.string().trim().max(10000).optional(),
    category: z.string().trim().max(100).optional(),
    sizes: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
    colors: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
    unit_price: zNumberFromAny({ min: 0 }).optional(),
    reorder_level: zIntFromAny({ min: 0 }).optional(),
    location: z.string().trim().max(255).optional(),
    supplier_name: z.string().trim().max(255).optional(),
    supplier_contact: z.string().trim().max(255).optional(),
    status: stockStatusSchema.optional(),
    shipping_mode: stockShippingModeSchema.optional(),
    shipping_flat_fee: zNumberFromAny({ min: 0 }).optional(),
    notes: z.string().trim().max(10000).optional(),
    images: z.array(z.string().trim().max(2048)).max(10).optional(),
  })
  .strict();

const adjustStockBodySchema = z
  .object({
    adjustment: zIntFromAny({}).refine((n) => n !== 0, 'Adjustment cannot be 0'),
    reason: zStringTrim(100),
    notes: z.string().trim().max(10000).optional(),
  })
  .strict();

const createCategoryBodySchema = z
  .object({
    name: zStringTrim(100),
    color: z.string().trim().max(32).optional(),
    icon: z.string().trim().max(16).optional(),
  })
  .strict();

const StockIdSchema = z.preprocess((v) => Number(v), z.number().int().positive());

const StockVariantSchema = z
  .object({
    id: z
      .preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().positive())
      .optional(),
    color: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(80)).optional(),
    size: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(80)).optional(),
    size2: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(80)).optional(),
    variant_name: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(160)).optional(),
    price: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().positive())
      .optional(),
    stock_quantity: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
    images: z.array(z.string().min(1).max(2000)).optional(),
    is_active: z.preprocess((v) => (v === undefined ? undefined : Boolean(v)), z.boolean()).optional(),
    sort_order: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int())
      .optional(),
  })
  .strict();

const PutStockVariantsSchema = z
  .object({
    variants: z.array(StockVariantSchema),
  })
  .strict();

function computeVariantName(v: { color?: string; size?: string; size2?: string; variant_name?: string }) {
  const explicit = String(v.variant_name || '').trim();
  if (explicit) return explicit;
  const parts = [String(v.color || '').trim(), String(v.size || '').trim(), String(v.size2 || '').trim()].filter(Boolean);
  return parts.join(' / ') || null;
}

/**
 * Get all stock products for authenticated client
 * GET /api/client/stock
 */
export const getClientStock: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      console.error('[getClientStock] No clientId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const low_stock = typeof req.query.low_stock === 'string' ? req.query.low_stock : undefined;

    if (category && category.length > 100) return res.status(400).json({ error: 'Invalid category' });
    if (search && search.length > 200) return res.status(400).json({ error: 'Invalid search' });
    if (status) {
      const parsedStatus = stockStatusSchema.safeParse(status);
      if (!parsedStatus.success) return res.status(400).json({ error: 'Invalid status' });
    }

    let query = `
      SELECT 
        id, client_id, name, sku, description, category,
        sizes, colors,
        quantity, unit_price, reorder_level, location,
        supplier_name, supplier_contact, status, notes, images,
        shipping_mode, shipping_flat_fee,
        created_at, updated_at,
        CASE WHEN quantity <= reorder_level THEN true ELSE false END as is_low_stock
      FROM client_stock_products
      WHERE client_id = $1
    `;

    const params: any[] = [clientId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (low_stock === 'true') {
      query += ` AND quantity <= reorder_level`;
    }

    query += ` ORDER BY name ASC`;

    if (!isProduction) console.log('[getClientStock] Fetching stock for clientId:', clientId);
    const result = await pool.query(query, params);
    if (!isProduction) console.log('[getClientStock] Found', result.rows.length, 'items');
    res.json(result.rows);
  } catch (error) {
    console.error('[getClientStock] error:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
};

/**
 * Get single stock item by ID
 * GET /api/client/stock/:id
 */
export const getStockById: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      console.error('[getStockById] No clientId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM client_stock_products WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[getStockById] error:', error);
    res.status(500).json({ error: 'Failed to fetch stock item' });
  }
};

/**
 * Create new stock item
 * POST /api/client/stock
 */
export const createStock: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      console.error('[createStock] No clientId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsedBody = validateBody(createStockBodySchema, req.body);
    if (parsedBody.ok === false) return res.status(400).json({ error: parsedBody.message });
    const {
      name,
      sku,
      description,
      category,
      sizes,
      colors,
      quantity,
      unit_price,
      reorder_level,
      location,
      supplier_name,
      supplier_contact,
      status,
      shipping_mode,
      shipping_flat_fee,
      notes,
      images,
    } = parsedBody.data;

    const parsedQuantity = quantity == null ? 0 : quantity;
    const parsedReorder = reorder_level == null ? 10 : reorder_level;
    const parsedUnitPrice = unit_price == null ? null : unit_price;

    if (!isProduction) {
      console.log('[createStock] Creating stock item:', { name, sku, clientId, hasImages: !!images });
    }

    const result = await pool.query(
      `INSERT INTO client_stock_products (
        client_id, name, sku, description, category,
        sizes, colors,
        quantity, unit_price, reorder_level, location,
        supplier_name, supplier_contact, status,
        shipping_mode, shipping_flat_fee,
        notes, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        clientId,
        name,
        sku || null,
        description || null,
        category || null,
        Array.isArray(sizes) ? sizes : [],
        Array.isArray(colors) ? colors : [],
        parsedQuantity,
        parsedUnitPrice,
        parsedReorder,
        location || null,
        supplier_name || null,
        supplier_contact || null,
        status || 'active',
        shipping_mode || 'delivery_pricing',
        shipping_flat_fee == null ? null : shipping_flat_fee,
        notes || null,
        Array.isArray(images) ? images : [],
      ]
    );

    // Log initial stock creation in history
    if (parsedQuantity > 0 && result.rows.length > 0) {
      try {
        await pool.query(
          `INSERT INTO client_stock_history (
            stock_id, client_id, quantity_before, quantity_after, adjustment, reason, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [result.rows[0].id, clientId, 0, parsedQuantity, parsedQuantity, 'initial_stock', clientId]
        );
      } catch (historyError) {
        console.warn('[createStock] Failed to log stock history:', historyError);
        // Don't fail the entire request if history logging fails
      }
    }

    if (!result.rows || result.rows.length === 0) {
      console.error('[createStock] No rows returned from insert');
      return res.status(500).json({ error: 'Failed to create stock item - no result' });
    }

    if (!isProduction) console.log('[createStock] Stock item created successfully, ID:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('[createStock] Unexpected error:', isProduction ? error?.message : error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'SKU already exists' });
    }
    if (error.code === '23502') { // NOT NULL constraint violation
      return res.status(400).json({ error: 'Required field is missing' });
    }
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({ error: 'Invalid reference in data' });
    }
    const errorMsg = error.message || 'Failed to create stock item';
    if (!isProduction) console.error('[createStock] Sending error response:', errorMsg);
    res.status(500).json({ error: isProduction ? 'Failed to create stock item' : errorMsg });
  }
};

/**
 * Update stock item
 * PUT /api/client/stock/:id
 */
export const updateStock: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      console.error('[updateStock] No clientId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT * FROM client_stock_products WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    const parsedBody = validateBody(updateStockBodySchema, req.body);
    if (parsedBody.ok === false) return res.status(400).json({ error: parsedBody.message });

    const {
      name,
      sku,
      description,
      category,
      sizes,
      colors,
      unit_price,
      reorder_level,
      location,
      supplier_name,
      supplier_contact,
      status,
      shipping_mode,
      shipping_flat_fee,
      notes,
      images,
    } = parsedBody.data;

    const result = await pool.query(
      `UPDATE client_stock_products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        sizes = CASE WHEN $5::text[] IS NOT NULL THEN $5::text[] ELSE sizes END,
        colors = CASE WHEN $6::text[] IS NOT NULL THEN $6::text[] ELSE colors END,
        unit_price = COALESCE($7, unit_price),
        reorder_level = COALESCE($8, reorder_level),
        location = COALESCE($9, location),
        supplier_name = COALESCE($10, supplier_name),
        supplier_contact = COALESCE($11, supplier_contact),
        status = COALESCE($12, status),
        shipping_mode = COALESCE($13, shipping_mode),
        shipping_flat_fee = COALESCE($14, shipping_flat_fee),
        notes = COALESCE($15, notes),
        images = CASE WHEN $18::text[] IS NOT NULL THEN $18::text[] ELSE images END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16 AND client_id = $17
      RETURNING *`,
      [
        name ?? null,
        sku ?? null,
        description ?? null,
        category ?? null,
        Array.isArray(sizes) ? sizes : null,
        Array.isArray(colors) ? colors : null,
        unit_price ?? null,
        reorder_level ?? null,
        location ?? null,
        supplier_name ?? null,
        supplier_contact ?? null,
        status ?? null,
        shipping_mode ?? null,
        shipping_flat_fee ?? null,
        notes ?? null,
        id,
        clientId,
        Array.isArray(images) ? images : null,
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[updateStock] error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: 'Failed to update stock item' });
  }
};

/**
 * Adjust stock quantity with history tracking
 * POST /api/client/stock/:id/adjust
 */
export const adjustStockQuantity: RequestHandler = async (req, res) => {
  let pool: any;
  let client: any;
  let inTransaction = false;
  try {
    pool = await ensureConnection();
    client = await pool.connect();
    const clientId = (req as any).user?.id;
    const { id } = req.params;
    const parsedBody = validateBody(adjustStockBodySchema, req.body);
    if (parsedBody.ok === false) return res.status(400).json({ error: parsedBody.message });
    const { adjustment, reason, notes } = parsedBody.data;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const reasonText = String(reason).trim();
    const adjustmentNum = adjustment as number;

    await client.query('BEGIN');
    inTransaction = true;

    // Get current stock (lock row to avoid races)
    const stockResult = await client.query(
      'SELECT * FROM client_stock_products WHERE id = $1 AND client_id = $2 FOR UPDATE',
      [id, clientId]
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    const currentStock = stockResult.rows[0];
    const newQuantity = currentStock.quantity + adjustmentNum;

    if (newQuantity < 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({ error: 'Insufficient stock for this adjustment' });
    }

    // Update quantity
    const updateResult = await client.query(
      `UPDATE client_stock_products 
       SET quantity = $1, 
           status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
      [newQuantity, id, clientId]
    );

    // Log adjustment in history
    await client.query(
      `INSERT INTO client_stock_history (
        stock_id, client_id, quantity_before, quantity_after, 
        adjustment, reason, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, clientId, currentStock.quantity, newQuantity,
        adjustmentNum, reasonText, notes || null, clientId
      ]
    );

    await client.query('COMMIT');
    inTransaction = false;

    res.json(updateResult.rows[0]);
  } catch (error) {
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('[adjustStockQuantity] error:', error);
    res.status(500).json({ error: 'Failed to adjust stock quantity' });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

/**
 * Get stock adjustment history
 * GET /api/client/stock/:id/history
 */
export const getStockHistory: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    const { id } = req.params;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT id FROM client_stock_products WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    const result = await pool.query(
      `SELECT 
        h.*,
        COALESCE(s.name, c.name) as adjusted_by_name
      FROM client_stock_history h
      LEFT JOIN staff s ON h.created_by = s.id
      LEFT JOIN clients c ON h.created_by = c.id
      WHERE h.stock_id = $1 AND h.client_id = $2
      ORDER BY h.created_at DESC`,
      [id, clientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[getStockHistory] error:', error);
    res.status(500).json({ error: 'Failed to fetch stock history' });
  }
};

/**
 * Get stock variants for a stock item
 * GET /api/client/stock/:id/variants
 */
export const getClientStockVariants: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = Number((req as any).user?.id);
    if (!clientId) return res.status(401).json({ error: 'Not authenticated' });

    const stockId = StockIdSchema.parse((req.params as any).id);

    const owns = await pool.query(
      'SELECT 1 FROM client_stock_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [stockId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Stock item not found' });

    try {
      const result = await pool.query(
        `SELECT id, color, size, size2, variant_name, price, stock_quantity, images, is_active, sort_order
         FROM client_stock_variants
         WHERE stock_id = $1 AND client_id = $2
         ORDER BY sort_order ASC, id ASC`,
        [stockId, clientId]
      );
      return res.json({ variants: result.rows });
    } catch (err: any) {
      // If migration not applied yet, behave safely.
      if (err?.code === '42P01') {
        return res.json({ variants: [] });
      }
      throw err;
    }
  } catch (error: any) {
    const msg = error?.message || 'Failed to fetch variants';
    res.status(400).json({ error: msg });
  }
};

/**
 * Upsert stock variants for a stock item
 * PUT /api/client/stock/:id/variants
 */
export const putClientStockVariants: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    const pool = await ensureConnection();
    const clientId = Number((req as any).user?.id);
    if (!clientId) return res.status(401).json({ error: 'Not authenticated' });

    const stockId = StockIdSchema.parse((req.params as any).id);
    const data = PutStockVariantsSchema.parse(req.body);

    client = await pool.connect();

    const owns = await client.query(
      'SELECT id, quantity FROM client_stock_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [stockId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Stock item not found' });

    await client.query('BEGIN');
    inTransaction = true;

    // Ensure table exists (migration may not yet be applied in dev)
    try {
      await client.query('SELECT 1 FROM client_stock_variants LIMIT 1');
    } catch (err: any) {
      if (err?.code === '42P01') {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Stock variants are not available yet (migration pending)' });
      }
      throw err;
    }

    const existing = await client.query(
      'SELECT id FROM client_stock_variants WHERE stock_id = $1 AND client_id = $2',
      [stockId, clientId]
    );
    const existingIds = new Set<number>(existing.rows.map((r: any) => Number(r.id)));
    const keepIds = new Set<number>();

    // Deduplicate incoming variants by (color,size,size2) case-insensitive to avoid unique index violations.
    const seenKey = new Set<string>();

    for (const v of data.variants) {
      const color = v.color != null && String(v.color).trim() ? String(v.color).trim() : null;
      const size = v.size != null && String(v.size).trim() ? String(v.size).trim() : null;
      const size2 = v.size2 != null && String(v.size2).trim() ? String(v.size2).trim() : null;
      const key = `${String(color || '').toLowerCase()}::${String(size || '').toLowerCase()}::${String(size2 || '').toLowerCase()}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);

      const variantName = computeVariantName({ color: color || undefined, size: size || undefined, size2: size2 || undefined, variant_name: v.variant_name });
      const price = v.price === undefined ? null : Number(v.price);
      const stockQty = Number(v.stock_quantity);
      const images = Array.isArray(v.images) ? v.images : null;
      const isActive = v.is_active === undefined ? true : Boolean(v.is_active);
      const sortOrder = v.sort_order === undefined ? 0 : Number(v.sort_order);

      if (v.id && existingIds.has(Number(v.id))) {
        keepIds.add(Number(v.id));
        await client.query(
          `UPDATE client_stock_variants
           SET color = $1,
               size = $2,
               size2 = $3,
               variant_name = $4,
               price = $5,
               stock_quantity = $6,
               images = $7,
               is_active = $8,
               sort_order = $9,
               updated_at = NOW()
           WHERE id = $10 AND stock_id = $11 AND client_id = $12`,
          [color, size, size2, variantName, price, stockQty, images, isActive, sortOrder, v.id, stockId, clientId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO client_stock_variants
           (client_id, stock_id, color, size, size2, variant_name, price, stock_quantity, images, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING id`,
          [clientId, stockId, color, size, size2, variantName, price, stockQty, images, isActive, sortOrder]
        );
        keepIds.add(Number(inserted.rows[0].id));
      }
    }

    const idsToDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (idsToDelete.length) {
      await client.query(
        'DELETE FROM client_stock_variants WHERE client_id = $1 AND stock_id = $2 AND id = ANY($3::bigint[])',
        [clientId, stockId, idsToDelete]
      );
    }

    // Keep stock product quantity in sync with active variants (sum)
    const sumRes = await client.query(
      `SELECT COALESCE(SUM(stock_quantity), 0)::int AS total
       FROM client_stock_variants
       WHERE client_id = $1 AND stock_id = $2 AND is_active = true`,
      [clientId, stockId]
    );
    const total = Number(sumRes.rows?.[0]?.total || 0);

    // Backward compatibility: also store distinct sizes/colors arrays on stock product.
    const optRes = await client.query(
      `SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT size), NULL) AS sizes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT color), NULL) AS colors
       FROM client_stock_variants
       WHERE client_id = $1 AND stock_id = $2 AND is_active = true`,
      [clientId, stockId]
    );
    const sizes = Array.isArray(optRes.rows?.[0]?.sizes) ? optRes.rows[0].sizes : [];
    const colors = Array.isArray(optRes.rows?.[0]?.colors) ? optRes.rows[0].colors : [];

    await client.query(
      `UPDATE client_stock_products
       SET quantity = $1,
           sizes = $2::text[],
           colors = $3::text[],
           status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE status END,
           updated_at = NOW()
       WHERE id = $4 AND client_id = $5`,
      [total, sizes, colors, stockId, clientId]
    );

    await client.query('COMMIT');
    inTransaction = false;

    const out = await pool.query(
      `SELECT id, color, size, size2, variant_name, price, stock_quantity, images, is_active, sort_order
       FROM client_stock_variants
       WHERE stock_id = $1 AND client_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [stockId, clientId]
    );

    res.json({ success: true, variants: out.rows, quantity: total, sizes, colors });
  } catch (error: any) {
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    const msg = error?.message || 'Failed to update variants';
    res.status(400).json({ error: msg });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

/**
 * Delete stock item
 * DELETE /api/client/stock/:id
 */
export const deleteStock: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      console.error('[deleteStock] No clientId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM client_stock_products WHERE id = $1 AND client_id = $2 RETURNING id',
      [id, clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    res.json({ message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('[deleteStock] error:', error);
    res.status(500).json({ error: 'Failed to delete stock item' });
  }
};

/**
 * Get low stock alerts
 * GET /api/client/stock/alerts/low-stock
 */
export const getLowStockAlerts: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT 
        id, name, sku, quantity, reorder_level, category, location,
        (reorder_level - quantity) as shortage
      FROM client_stock_products
      WHERE client_id = $1 
        AND status = 'active'
        AND quantity <= reorder_level
      ORDER BY shortage DESC, name ASC`,
      [clientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[getLowStockAlerts] error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
};

/**
 * Get stock categories for filtering
 * GET /api/client/stock/categories
 */
export const getStockCategories: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT DISTINCT category, COUNT(*) as count
       FROM client_stock_products
       WHERE client_id = $1 AND category IS NOT NULL
       GROUP BY category
       ORDER BY category ASC`,
      [clientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[getStockCategories] error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * Create a new stock category
 * POST /api/client/stock/categories
 */
export const createStockCategory: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    const parsedBody = validateBody(createCategoryBodySchema, req.body);
    if (parsedBody.ok === false) return res.status(400).json({ error: parsedBody.message });
    const { name, color, icon } = parsedBody.data;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const categoryName = String(name).trim();

    // Check if category already exists for this client
    const existingCheck = await pool.query(
      `SELECT id FROM client_stock_categories WHERE client_id = $1 AND LOWER(name) = LOWER($2)`,
      [clientId, categoryName]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    // Insert new category
    const result = await pool.query(
      `INSERT INTO client_stock_categories (client_id, name, color, icon, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, color, icon, created_at`,
      [clientId, categoryName, color || '#3b82f6', icon || '📦']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[createStockCategory] error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

/**
 * Delete a stock category
 * DELETE /api/client/stock/categories/:id
 */
export const deleteStockCategory: RequestHandler = async (req, res) => {
  let pool: any;
  let client: any;
  let inTransaction = false;
  try {
    pool = await ensureConnection();
    client = await pool.connect();
    const clientId = (req as any).user?.id;
    const categoryId = req.params.id;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get the category name first
    const categoryResult = await pool.query(
      `SELECT name FROM client_stock_categories WHERE id = $1 AND client_id = $2`,
      [categoryId, clientId]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryName = categoryResult.rows[0].name;

    await client.query('BEGIN');
    inTransaction = true;

    // Remove category from products (set to null)
    await client.query(
      `UPDATE client_stock_products SET category = NULL WHERE client_id = $1 AND category = $2`,
      [clientId, categoryName]
    );

    // Delete the category
    await client.query(
      `DELETE FROM client_stock_categories WHERE id = $1 AND client_id = $2`,
      [categoryId, clientId]
    );

    await client.query('COMMIT');
    inTransaction = false;

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('[deleteStockCategory] error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

/**
 * Get all stock categories with counts
 * GET /api/client/stock/categories/all
 */
export const getAllStockCategories: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get categories from the categories table with product counts and sample image
    const result = await pool.query(
      `SELECT 
         c.id, c.name, c.color, c.icon, c.created_at,
         COUNT(p.id) as product_count,
         (
           SELECT images[1]
           FROM client_stock_products
           WHERE client_id = c.client_id
             AND category = c.name
             AND images IS NOT NULL
             AND array_length(images, 1) > 0
           LIMIT 1
         ) as sample_image
       FROM client_stock_categories c
       LEFT JOIN client_stock_products p ON p.client_id = c.client_id AND p.category = c.name
       WHERE c.client_id = $1
       GROUP BY c.id, c.name, c.color, c.icon, c.created_at
       ORDER BY c.name ASC`,
      [clientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[getAllStockCategories] error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};
