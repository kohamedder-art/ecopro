/**
 * Delivery Pricing Routes
 * 
 * Allows sellers to set custom delivery prices per wilaya and delivery company.
 * Customers can fetch delivery prices at checkout.
 */

import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';
import { decryptData } from '../utils/encryption';

const router = Router();

const MAYSTRO_API_BASE = 'https://orders-management.maystro-delivery.com/api';

interface MaystroDeliveryOption {
  type: string;
  price: number;
}

async function fetchMaystroDeliveryOptions(token: string, communeId: number): Promise<MaystroDeliveryOption[]> {
  const url = `${MAYSTRO_API_BASE}/base/delivery-options/?commune=${encodeURIComponent(String(communeId))}`;
  const res = await fetch(url, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    throw new Error(`Maystro delivery-options failed (${res.status}) for commune ${communeId}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchMaystroCommunes(token: string, wilayaId: number): Promise<Array<{ id: number }>> {
  const url = `${MAYSTRO_API_BASE}/base/communes/?wilaya=${encodeURIComponent(String(wilayaId))}`;
  const res = await fetch(url, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    throw new Error(`Maystro communes failed (${res.status}) for wilaya ${wilayaId}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Type for delivery price
interface DeliveryPrice {
  id: number;
  client_id: number;
  wilaya_id: number;
  wilaya_name?: string;
  delivery_company_id: number | null;
  delivery_company_name?: string;
  home_delivery_price: number;
  desk_delivery_price: number | null;
  is_active: boolean;
  estimated_days: number;
  notes: string | null;
}

/**
 * GET /api/delivery-prices
 * Get all delivery prices for the authenticated client
 */
export const getDeliveryPrices: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pool = await ensureConnection();
    
    const result = await pool.query(
      `SELECT dp.*
       FROM delivery_prices dp
       WHERE dp.client_id = $1
       ORDER BY dp.wilaya_id ASC`,
      [clientId]
    );

    res.json({ prices: result.rows });
  } catch (error) {
    console.error('[DeliveryPrices] Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch delivery prices' });
  }
};

/**
 * POST /api/delivery-prices
 * Create or update a delivery price for a wilaya
 */
export const upsertDeliveryPrice: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      wilaya_id, 
      delivery_company_id, 
      home_delivery_price, 
      desk_delivery_price, 
      is_active, 
      estimated_days,
      notes 
    } = req.body;

    if (!wilaya_id || wilaya_id < 1 || wilaya_id > 58) {
      return res.status(400).json({ error: 'Invalid wilaya_id (must be 1-58)' });
    }

    if (home_delivery_price === undefined || home_delivery_price < 0) {
      return res.status(400).json({ error: 'home_delivery_price is required and must be >= 0' });
    }

    const pool = await ensureConnection();

    const companyId = delivery_company_id || null;

    // PostgreSQL UNIQUE constraint treats NULL != NULL so ON CONFLICT won't fire
    // for null delivery_company_id. Use UPDATE first, INSERT if no rows updated.
    let result;
    if (companyId === null) {
      const upd = await pool.query(
        `UPDATE delivery_prices SET
           home_delivery_price = $3, desk_delivery_price = $4,
           is_active = $5, estimated_days = $6, notes = $7, updated_at = NOW()
         WHERE client_id = $1 AND wilaya_id = $2 AND delivery_company_id IS NULL
         RETURNING *`,
        [clientId, wilaya_id, home_delivery_price, desk_delivery_price ?? null,
         is_active ?? true, estimated_days ?? 3, notes || null]
      );
      if (upd.rows.length > 0) {
        result = upd;
      } else {
        result = await pool.query(
          `INSERT INTO delivery_prices
             (client_id, wilaya_id, delivery_company_id, home_delivery_price,
              desk_delivery_price, is_active, estimated_days, notes, updated_at)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
          [clientId, wilaya_id, home_delivery_price, desk_delivery_price ?? null,
           is_active ?? true, estimated_days ?? 3, notes || null]
        );
      }
    } else {
      result = await pool.query(
        `INSERT INTO delivery_prices (
          client_id, wilaya_id, delivery_company_id, home_delivery_price,
          desk_delivery_price, is_active, estimated_days, notes, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (client_id, wilaya_id, delivery_company_id)
        DO UPDATE SET
          home_delivery_price = EXCLUDED.home_delivery_price,
          desk_delivery_price = EXCLUDED.desk_delivery_price,
          is_active = EXCLUDED.is_active,
          estimated_days = EXCLUDED.estimated_days,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *`,
        [clientId, wilaya_id, companyId, home_delivery_price,
         desk_delivery_price ?? null, is_active ?? true, estimated_days ?? 3, notes || null]
      );
    }

    res.json({ success: true, price: result.rows[0] });
  } catch (error) {
    console.error('[DeliveryPrices] Error upserting price:', error);
    res.status(500).json({ error: 'Failed to save delivery price' });
  }
};

/**
 * POST /api/delivery-prices/bulk
 * Bulk update delivery prices for multiple wilayas
 */
export const bulkUpdateDeliveryPrices: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { prices, delivery_company_id } = req.body;
    
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: 'prices array is required' });
    }

    const pool = await ensureConnection();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];
      // Use UPDATE+INSERT to handle NULL delivery_company_id
      // (PostgreSQL UNIQUE treats NULL != NULL, so ON CONFLICT won't fire for nulls)
      const companyId = delivery_company_id || null;

      for (const p of prices) {
        if (!p.wilaya_id || p.wilaya_id < 1 || p.wilaya_id > 58) continue;

        let row;
        if (companyId === null) {
          const upd = await client.query(
            `UPDATE delivery_prices SET
               home_delivery_price = $3, desk_delivery_price = $4,
               is_active = $5, estimated_days = $6, notes = $7, updated_at = NOW()
             WHERE client_id = $1 AND wilaya_id = $2 AND delivery_company_id IS NULL
             RETURNING *`,
            [clientId, p.wilaya_id, p.home_delivery_price ?? 0,
             p.desk_delivery_price ?? null, p.is_active ?? true,
             p.estimated_days ?? 3, p.notes || null]
          );
          if (upd.rows.length > 0) {
            row = upd.rows[0];
          } else {
            const ins = await client.query(
              `INSERT INTO delivery_prices
                 (client_id, wilaya_id, delivery_company_id, home_delivery_price,
                  desk_delivery_price, is_active, estimated_days, notes, updated_at)
               VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
              [clientId, p.wilaya_id, p.home_delivery_price ?? 0,
               p.desk_delivery_price ?? null, p.is_active ?? true,
               p.estimated_days ?? 3, p.notes || null]
            );
            row = ins.rows[0];
          }
        } else {
          const res2 = await client.query(
            `INSERT INTO delivery_prices (
               client_id, wilaya_id, delivery_company_id, home_delivery_price,
               desk_delivery_price, is_active, estimated_days, notes, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (client_id, wilaya_id, delivery_company_id)
             DO UPDATE SET
               home_delivery_price = EXCLUDED.home_delivery_price,
               desk_delivery_price = EXCLUDED.desk_delivery_price,
               is_active = EXCLUDED.is_active,
               estimated_days = EXCLUDED.estimated_days,
               notes = EXCLUDED.notes,
               updated_at = NOW()
             RETURNING *`,
            [clientId, p.wilaya_id, companyId, p.home_delivery_price ?? 0,
             p.desk_delivery_price ?? null, p.is_active ?? true,
             p.estimated_days ?? 3, p.notes || null]
          );
          row = res2.rows[0];
        }
        if (row) results.push(row);
      }

      await client.query('COMMIT');
      res.json({ success: true, count: results.length, prices: results });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DeliveryPrices] Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update prices' });
  }
};

/**
 * DELETE /api/delivery-prices/:id
 * Delete a specific delivery price
 */
export const deleteDeliveryPrice: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const pool = await ensureConnection();
    
    const result = await pool.query(
      `DELETE FROM delivery_prices WHERE id = $1 AND client_id = $2 RETURNING id`,
      [id, clientId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Price not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[DeliveryPrices] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete price' });
  }
};

/**
 * GET /api/storefront/:storeSlug/delivery-prices
 * Public endpoint: Get delivery prices for a store (for checkout)
 */
export const getStorefrontDeliveryPrices: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { wilaya_id } = req.query;

    const pool = await ensureConnection();

    // Get client ID from store slug
    const storeResult = await pool.query(
      `SELECT client_id
       FROM client_store_settings
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)`,
      [storeSlug]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const clientId = storeResult.rows[0].client_id;

    // If wilaya_id is provided, get specific price
    if (wilaya_id) {
      const priceResult = await pool.query(
        `SELECT dp.*
         FROM delivery_prices dp
         WHERE dp.client_id = $1 AND dp.wilaya_id = $2 AND dp.is_active = true
         ORDER BY dp.home_delivery_price ASC
         LIMIT 1`,
        [clientId, wilaya_id]
      );

      if (priceResult.rows.length === 0) {
        // Return default price if no specific price set
        return res.json({ 
          price: null, 
          message: 'No delivery price set for this wilaya',
          default_price: 500 // Fallback default
        });
      }

      return res.json({ price: priceResult.rows[0] });
    }

    // Get all active delivery prices for the store
    const result = await pool.query(
      `SELECT dp.wilaya_id, dp.home_delivery_price, dp.desk_delivery_price, 
              dp.estimated_days, dp.is_active
       FROM delivery_prices dp
       WHERE dp.client_id = $1 AND dp.is_active = true
       ORDER BY dp.wilaya_id ASC`,
      [clientId]
    );

    // If no prices configured yet, return a flag so the frontend can show a default
    if (result.rows.length === 0) {
      return res.json({ prices: [], default_price: 500, no_prices_configured: true });
    }

    res.json({ prices: result.rows });
  } catch (error) {
    console.error('[DeliveryPrices] Storefront fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery prices' });
  }
};

/**
 * POST /api/delivery-prices/import-from-company
 * Import delivery prices from a connected delivery company's API
 */
export const importFromDeliveryCompany: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deliveryCompanyId = Number(req.body?.delivery_company_id);
    if (!Number.isFinite(deliveryCompanyId) || deliveryCompanyId <= 0) {
      return res.status(400).json({ error: 'delivery_company_id is required' });
    }

    const pool = await ensureConnection();
    const integrationResult = await pool.query(
      `SELECT di.api_key_encrypted, dc.name
       FROM delivery_integrations di
       JOIN delivery_companies dc ON dc.id = di.delivery_company_id
       WHERE di.client_id = $1 AND di.delivery_company_id = $2 AND di.is_enabled = true
       LIMIT 1`,
      [clientId, deliveryCompanyId]
    );

    if (integrationResult.rows.length === 0) {
      return res.status(400).json({ error: 'Delivery integration not configured for this company' });
    }

    const companyName = String(integrationResult.rows[0].name || '').toLowerCase();
    if (!companyName.includes('maystro')) {
      return res.status(501).json({
        success: false,
        message: 'Auto-import is currently supported for Maystro Delivery only.',
      });
    }

    const token = decryptData(integrationResult.rows[0].api_key_encrypted || '');
    if (!token) {
      return res.status(400).json({ error: 'Missing Maystro API token in integration' });
    }

    const imported: Array<{ wilaya_id: number; home_delivery_price: number; desk_delivery_price: number | null }> = [];
    const failed: Array<{ wilaya_id: number; error: string }> = [];

    // Iterate through all Algerian wilayas (1..58) and infer default pricing
    // from the first commune returned by Maystro for each wilaya.
    for (let wilayaId = 1; wilayaId <= 58; wilayaId++) {
      try {
        const communes = await fetchMaystroCommunes(token, wilayaId);
        if (!communes.length || !communes[0]?.id) {
          failed.push({ wilaya_id: wilayaId, error: 'No communes returned by Maystro' });
          continue;
        }

        const communeId = Number(communes[0].id);
        const options = await fetchMaystroDeliveryOptions(token, communeId);
        const home = options.find((o: any) => String(o?.type || '').toLowerCase() === 'home');
        const desk = options.find((o: any) => String(o?.type || '').toLowerCase() === 'stopdesk');

        if (!home) {
          failed.push({ wilaya_id: wilayaId, error: 'Home delivery option not found' });
          continue;
        }

        const homePrice = Number(home.price);
        const deskPrice = desk ? Number(desk.price) : null;
        if (!Number.isFinite(homePrice) || homePrice < 0) {
          failed.push({ wilaya_id: wilayaId, error: 'Invalid home price from Maystro' });
          continue;
        }

        await pool.query(
          `INSERT INTO delivery_prices (
            client_id, wilaya_id, delivery_company_id, home_delivery_price,
            desk_delivery_price, is_active, estimated_days, notes, updated_at
          ) VALUES ($1, $2, $3, $4, $5, true, 3, $6, NOW())
          ON CONFLICT (client_id, wilaya_id, delivery_company_id)
          DO UPDATE SET
            home_delivery_price = EXCLUDED.home_delivery_price,
            desk_delivery_price = EXCLUDED.desk_delivery_price,
            is_active = true,
            updated_at = NOW()`,
          [
            clientId,
            wilayaId,
            deliveryCompanyId,
            homePrice,
            Number.isFinite(deskPrice as number) && (deskPrice as number) >= 0 ? deskPrice : null,
            `Imported from Maystro commune ${communeId}`,
          ]
        );

        imported.push({
          wilaya_id: wilayaId,
          home_delivery_price: homePrice,
          desk_delivery_price: Number.isFinite(deskPrice as number) ? (deskPrice as number) : null,
        });
      } catch (e: any) {
        failed.push({ wilaya_id: wilayaId, error: e?.message || 'Unknown import error' });
      }
    }

    res.json({
      success: imported.length > 0,
      importedCount: imported.length,
      failedCount: failed.length,
      imported,
      failed,
    });

  } catch (error) {
    console.error('[DeliveryPrices] Import error:', error);
    res.status(500).json({ error: 'Failed to import prices' });
  }
};

// Register routes
router.get('/', getDeliveryPrices);
router.post('/', upsertDeliveryPrice);
router.post('/bulk', bulkUpdateDeliveryPrices);
router.delete('/:id', deleteDeliveryPrice);
router.post('/import-from-company', importFromDeliveryCompany);

export default router;
