import { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../utils/database';

const ProductIdSchema = z.preprocess((v) => Number(v), z.number().int().positive());

const VariantSchema = z
  .object({
    id: z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().positive()).optional(),
    color: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(160)).optional(),
    size: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(80)).optional(),
    variant_name: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(160)).optional(),
    price: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().positive())
      .optional(),
    stock_quantity: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
    images: z.array(z.string().min(1).max(2000)).optional(),
    is_active: z.preprocess((v) => (v === undefined ? undefined : Boolean(v)), z.boolean()).optional(),
    sort_order: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int()).optional(),
  })
  .strict();

const PutVariantsSchema = z
  .object({
    variants: z.array(VariantSchema),
  })
  .strict();

function computeVariantName(v: { color?: string; size?: string; variant_name?: string }) {
  const explicit = String(v.variant_name || '').trim();
  if (explicit) return explicit;
  const parts = [String(v.color || '').trim(), String(v.size || '').trim()].filter(Boolean);
  return parts.join(' / ') || null;
}

export const getClientProductVariants: RequestHandler = async (req, res) => {
  try {
    const clientId = Number((req as any).user?.id);
    const productId = ProductIdSchema.parse((req.params as any).id);

    const owns = await pool.query(
      'SELECT 1 FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [productId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Product not found' });

    const result = await pool.query(
      `SELECT id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
       FROM product_variants
       WHERE product_id = $1 AND client_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [productId, clientId]
    );

    res.json({ variants: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
};

export const putClientProductVariants: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    const clientId = Number((req as any).user?.id);
    const productId = ProductIdSchema.parse((req.params as any).id);
    const data = PutVariantsSchema.parse(req.body);

    client = await pool.connect();

    const owns = await client.query(
      'SELECT 1 FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [productId, clientId]
    );
    if (!owns.rowCount) return res.status(404).json({ error: 'Product not found' });

    await client.query('BEGIN');
    inTransaction = true;

    const existing = await client.query(
      'SELECT id FROM product_variants WHERE product_id = $1 AND client_id = $2',
      [productId, clientId]
    );
    const existingIds = new Set<number>(existing.rows.map((r: any) => Number(r.id)));
    const keepIds = new Set<number>();

    for (const v of data.variants) {
      const color = v.color != null && String(v.color).trim() ? String(v.color).trim() : null;
      const size = v.size != null && String(v.size).trim() ? String(v.size).trim() : null;
      const variantName = computeVariantName({ color: color || undefined, size: size || undefined, variant_name: v.variant_name });
      const price = v.price === undefined ? null : Number(v.price);
      const stockQty = Number(v.stock_quantity);
      const images = Array.isArray(v.images) ? v.images : null;
      const isActive = v.is_active === undefined ? true : Boolean(v.is_active);
      const sortOrder = v.sort_order === undefined ? 0 : Number(v.sort_order);

      if (v.id && existingIds.has(Number(v.id))) {
        keepIds.add(Number(v.id));
        await client.query(
          `UPDATE product_variants
           SET color = $1,
               size = $2,
               variant_name = $3,
               price = $4,
               stock_quantity = $5,
               images = $6,
               is_active = $7,
               sort_order = $8,
               updated_at = NOW()
           WHERE id = $9 AND product_id = $10 AND client_id = $11`,
          [color, size, variantName, price, stockQty, images, isActive, sortOrder, v.id, productId, clientId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO product_variants
           (client_id, product_id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [clientId, productId, color, size, variantName, price, stockQty, images, isActive, sortOrder]
        );
        keepIds.add(Number(inserted.rows[0].id));
      }
    }

    // Delete removed variants
    const idsToDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (idsToDelete.length) {
      await client.query(
        'DELETE FROM product_variants WHERE client_id = $1 AND product_id = $2 AND id = ANY($3::bigint[])',
        [clientId, productId, idsToDelete]
      );
    }

    // Keep product stock_quantity in sync with active variants (sum)
    const sumRes = await client.query(
      `SELECT COALESCE(SUM(stock_quantity), 0)::int AS total
       FROM product_variants
       WHERE client_id = $1 AND product_id = $2 AND is_active = true`,
      [clientId, productId]
    );
    const total = Number(sumRes.rows?.[0]?.total || 0);
    await client.query(
      'UPDATE client_store_products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3',
      [total, productId, clientId]
    );

    await client.query('COMMIT');
    inTransaction = false;

    const out = await pool.query(
      `SELECT id, color, size, variant_name, price, stock_quantity, images, is_active, sort_order
       FROM product_variants
       WHERE product_id = $1 AND client_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [productId, clientId]
    );

    res.json({ success: true, variants: out.rows, stock_quantity: total });
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
