import { RequestHandler } from 'express';
import { pool } from '../utils/database';
import multer from 'multer';
import { jsonServerError } from '../utils/httpHelpers';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';

// Use memory storage for better Render deployment compatibility
// Images will be stored as base64 in the database instead of on disk
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function requireStoreSlugOwner(req: any, storeSlug: string): Promise<number> {
  const user = req.user as any;
  if (!user?.id) {
    const err: any = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }

  // Align with client-store.ts: admins must not manage client storefronts
  if (user.role === 'admin' || user.user_type === 'admin') {
    const err: any = new Error('Admins are not allowed to manage client storefronts');
    err.status = 403;
    throw err;
  }

  const store = await pool.query('SELECT client_id FROM client_store_settings WHERE store_slug = $1 LIMIT 1', [storeSlug]);
  if (store.rows.length === 0) {
    const err: any = new Error('Store not found');
    err.status = 404;
    throw err;
  }

  const ownerClientId = Number(store.rows[0].client_id);
  const requesterId = Number(user.id);
  if (!Number.isFinite(ownerClientId) || !Number.isFinite(requesterId) || ownerClientId !== requesterId) {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return ownerClientId;
}

const productBodySchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).optional().nullable(),
    price: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().finite().positive()),
    category: z.string().trim().max(100).optional().nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
  });

export const createProduct: RequestHandler = async (req, res) => {
  const { storeSlug } = req.params as any;
  try {
    const clientId = await requireStoreSlugOwner(req as any, String(storeSlug));
    const parsed = productBodySchema.safeParse(req.body);
    if (parsed.success === false) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { title, description, price, category, metadata } = parsed.data;

    const r = await pool.query(
      `INSERT INTO client_store_products (client_id, store_slug, title, description, price, category, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [clientId, storeSlug, title, description ?? null, price, category ?? null, metadata ?? {}]
    );
    res.json({ id: r.rows[0].id });
  } catch (e: any) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message || 'Request rejected' });
    }
    return jsonServerError(res, e, 'Failed to create product');
  }
};

export const updateProduct: RequestHandler = async (req, res) => {
  const { storeSlug, id } = req.params as any;
  try {
    const clientId = await requireStoreSlugOwner(req as any, String(storeSlug));
    const parsed = productBodySchema.safeParse(req.body);
    if (parsed.success === false) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { title, description, price, category, metadata: incomingMeta } = parsed.data;

    // Merge incoming metadata with existing to preserve fields like stock_id, alt_texts
    const existing = await pool.query(
      `SELECT metadata FROM client_store_products WHERE id=$2 AND store_slug=$1 AND client_id=$3`,
      [storeSlug, id, clientId]
    );
    const existingMeta = existing.rows[0]?.metadata && typeof existing.rows[0].metadata === 'object'
      ? existing.rows[0].metadata : {};
    const mergedMeta = incomingMeta && typeof incomingMeta === 'object'
      ? { ...existingMeta, ...incomingMeta }
      : existingMeta;

    await pool.query(
      `UPDATE client_store_products SET title=$3, description=$4, price=$5, category=$6, metadata=$7, updated_at=NOW()
       WHERE id=$2 AND store_slug=$1 AND client_id=$8`,
      [storeSlug, id, title, description ?? null, price, category ?? null, JSON.stringify(mergedMeta), clientId]
    );
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message || 'Request rejected' });
    }
    return jsonServerError(res, e, 'Failed to update product');
  }
};

export const deleteProduct: RequestHandler = async (req, res) => {
  const { storeSlug, id } = req.params as any;
  try {
    const clientId = await requireStoreSlugOwner(req as any, String(storeSlug));
    await pool.query(
      `DELETE FROM client_store_products WHERE id=$2 AND store_slug=$1 AND client_id=$3`,
      [storeSlug, id, clientId]
    );
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.status) {
      return res.status(e.status).json({ error: e.message || 'Request rejected' });
    }
    return jsonServerError(res, e, 'Failed to delete product');
  }
};

export const handleUploadImages = [
  upload.array('files', 6),
  (async (req: any, res: any) => {
    const { storeSlug, id } = req.params;
    try {
      const clientId = await requireStoreSlugOwner(req as any, String(storeSlug));
      // Convert uploaded files to base64 data URLs for persistent storage
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      const uploaded = req.files as Express.Multer.File[];
      const files: string[] = [];
      for (const f of uploaded) {
        const detected = await fileTypeFromBuffer(f.buffer);
        const mimeType = detected?.mime || f.mimetype;
        if (!mimeType || !allowed.has(mimeType)) {
          return res.status(400).json({ error: 'File type not allowed' });
        }
        const base64 = f.buffer.toString('base64');
        files.push(`data:${mimeType};base64,${base64}`);
      }
      
      const r = await pool.query(
        `SELECT images FROM client_store_products WHERE id=$2 AND store_slug=$1 AND client_id=$3`,
        [storeSlug, id, clientId]
      );
      const existing = Array.isArray(r.rows[0]?.images) ? r.rows[0].images : [];
      const next = [...existing, ...files].slice(0, 6);
      await pool.query(
        `UPDATE client_store_products SET images=$3, updated_at=NOW() WHERE id=$2 AND store_slug=$1 AND client_id=$4`,
        [storeSlug, id, next, clientId]
      );
      res.json({ images: next });
    } catch (e: any) {
      if (e?.status) {
        return res.status(e.status).json({ error: e.message || 'Request rejected' });
      }
      return jsonServerError(res, e, 'Failed to upload images');
    }
  })
];
