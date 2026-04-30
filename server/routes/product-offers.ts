import { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../utils/database';

const ProductIdSchema = z.preprocess((v) => Number(v), z.number().int().positive());

const OfferSchema = z
  .object({
    id: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : Number(v)),
      z.number().int().positive()
    ).optional(),
    quantity: z.preprocess((v) => Number(v), z.number().int().positive().max(100)),
    bundle_price: z.preprocess((v) => Number(v), z.number().nonnegative()),
    compare_price: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().nonnegative()
    ).optional(),
    free_delivery: z.preprocess((v) => (v === undefined ? false : Boolean(v)), z.boolean()),
    label: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().max(200)
    ).optional(),
    image_url: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v === null ? undefined : v),
      z.string().max(2000)
    ).optional(),
    sort_order: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().int()
    ).optional(),
    is_active: z.preprocess(
      (v) => (v === undefined ? undefined : Boolean(v)),
      z.boolean()
    ).optional(),
  })
  .strict();

const PutOffersSchema = z
  .object({
    offers: z.array(OfferSchema).max(10),
  })
  .strict();

/** GET /api/client/store/products/:id/offers — list offers for a product (authenticated client) */
export const getClientProductOffers: RequestHandler = async (req, res) => {
  try {
    const clientId = Number((req as any).user?.id);
    const productId = ProductIdSchema.parse((req.params as any).id);

    const owns = await pool.query(
      'SELECT 1 FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [productId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Product not found' });

    const result = await pool.query(
      `SELECT id, quantity, bundle_price, compare_price, free_delivery, label, sort_order, is_active, image_url
       FROM product_offers
       WHERE product_id = $1 AND client_id = $2
       ORDER BY sort_order ASC, quantity ASC`,
      [productId, clientId]
    );

    res.json({ offers: result.rows });
  } catch (error) {
    console.error('[getClientProductOffers] Error:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

/** PUT /api/client/store/products/:id/offers — upsert offers for a product (authenticated client) */
export const putClientProductOffers: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    const clientId = Number((req as any).user?.id);
    const productId = ProductIdSchema.parse((req.params as any).id);
    const data = PutOffersSchema.parse(req.body);

    client = await pool.connect();

    const owns = await client.query(
      'SELECT 1 FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [productId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Product not found' });

    // Check for duplicate quantities in the input
    const qtys = data.offers.map((o) => o.quantity);
    if (new Set(qtys).size !== qtys.length) {
      return res.status(400).json({ error: 'Duplicate quantity levels in offers' });
    }

    await client.query('BEGIN');
    inTransaction = true;

    const existing = await client.query(
      'SELECT id FROM product_offers WHERE product_id = $1 AND client_id = $2',
      [productId, clientId]
    );
    const existingIds = new Set<number>(existing.rows.map((r: any) => Number(r.id)));
    const keepIds = new Set<number>();

    for (const o of data.offers) {
      const bundlePrice = Number(o.bundle_price);
      const comparePrice = o.compare_price === undefined ? null : Number(o.compare_price);
      const freeDelivery = o.free_delivery ?? false;
      const label = o.label?.trim() || null;
      const imageUrl = o.image_url?.trim() || null;
      const isActive = o.is_active ?? true;
      const sortOrder = o.sort_order ?? 0;

      if (o.id && existingIds.has(Number(o.id))) {
        keepIds.add(Number(o.id));
        await client.query(
          `UPDATE product_offers
           SET quantity = $1, bundle_price = $2, compare_price = $3,
               free_delivery = $4, label = $5, sort_order = $6, is_active = $7, image_url = $8, updated_at = NOW()
           WHERE id = $9 AND product_id = $10 AND client_id = $11`,
          [o.quantity, bundlePrice, comparePrice, freeDelivery, label, sortOrder, isActive, imageUrl, o.id, productId, clientId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO product_offers
           (client_id, product_id, quantity, bundle_price, compare_price, free_delivery, label, sort_order, is_active, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [clientId, productId, o.quantity, bundlePrice, comparePrice, freeDelivery, label, sortOrder, isActive, imageUrl]
        );
        keepIds.add(Number(inserted.rows[0].id));
      }
    }

    // Delete removed offers
    const idsToDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (idsToDelete.length) {
      await client.query(
        'DELETE FROM product_offers WHERE client_id = $1 AND product_id = $2 AND id = ANY($3::bigint[])',
        [clientId, productId, idsToDelete]
      );
    }

    await client.query('COMMIT');
    inTransaction = false;

    const out = await pool.query(
      `SELECT id, quantity, bundle_price, compare_price, free_delivery, label, sort_order, is_active, image_url
       FROM product_offers
       WHERE product_id = $1 AND client_id = $2
       ORDER BY sort_order ASC, quantity ASC`,
      [productId, clientId]
    );

    res.json({ offers: out.rows });
  } catch (error) {
    if (inTransaction && client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('[putClientProductOffers] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid offer data' });
    }
    res.status(500).json({ error: 'Failed to save offers' });
  } finally {
    if (client) client.release();
  }
};

/** GET /api/storefront/:storeSlug/products/:productId/offers — public offers fetch */
export const getPublicProductOffers: RequestHandler = async (req, res) => {
  try {
    const { storeSlug, productId } = req.params as any;
    const pid = ProductIdSchema.parse(productId);

    // Resolve client_id from store slug
    const cs = await pool.query(
      `SELECT client_id FROM client_store_settings
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
      [storeSlug]
    );
    if (!cs.rows.length) return res.status(404).json({ error: 'Store not found' });
    const clientId = cs.rows[0].client_id;

    // Verify product belongs to this store
    const prod = await pool.query(
      'SELECT 1 FROM client_store_products WHERE id = $1 AND client_id = $2 AND status = $3 LIMIT 1',
      [pid, clientId, 'active']
    );
    if (!prod.rowCount) return res.status(404).json({ error: 'Product not found' });

    const result = await pool.query(
      `SELECT id, quantity, bundle_price, compare_price, free_delivery, label, image_url
       FROM product_offers
       WHERE product_id = $1 AND client_id = $2 AND is_active = true
       ORDER BY sort_order ASC, quantity ASC`,
      [pid, clientId]
    );

    res.json({ offers: result.rows });
  } catch (error) {
    console.error('[getPublicProductOffers] Error:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};
