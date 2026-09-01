import type { Request, Response, NextFunction } from 'express';
import { ensureConnection } from './database';

/**
 * Middleware that resolves the active store for the current request.
 * Sets req.activeStoreId (the store's id) and req.activeStore (the full row).
 *
 * Reads from X-Store-Id header (set by frontend store switcher).
 * Falls back to ?store_id query param.
 * If neither is set, falls back to the user's first (default) store.
 */
export async function resolveActiveStore(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return next();

  const clientId = user.id;
  const pool = await ensureConnection();

  try {
    // 1. Explicit header/param
    const headerStoreId = req.headers['x-store-id'];
    const queryStoreId = req.query.store_id;
    const requestedStoreId = (headerStoreId as string) || (queryStoreId as string) || null;

    let storeId: number | null = null;

    if (requestedStoreId) {
      // Verify ownership
      const r = await pool.query(
        'SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2',
        [Number(requestedStoreId), clientId]
      );
      if (r.rows.length > 0) {
        storeId = Number(requestedStoreId);
      }
    }

    // 2. Fallback: user's first store
    if (!storeId) {
      const r = await pool.query(
        'SELECT id FROM client_store_settings WHERE client_id = $1 ORDER BY id ASC LIMIT 1',
        [clientId]
      );
      if (r.rows.length > 0) {
        storeId = r.rows[0].id;
      }
    }

    if (storeId) {
      (req as any).activeStoreId = storeId;
      (req as any).activeClientId = clientId;
    }
  } catch (e) {
    console.error('[resolveActiveStore] error:', (e as Error)?.message);
  }

  next();
}
