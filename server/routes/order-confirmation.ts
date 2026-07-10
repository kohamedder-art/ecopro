import { RequestHandler } from "express";
import { pool } from "../utils/database";
import { createConfirmationLink, sendOrderConfirmationMessages } from "../utils/bot-messaging";
import { z, ZodError } from 'zod';
import { getPublicBaseUrl } from '../utils/public-url';

const isProduction = process.env.NODE_ENV === 'production';

const StoreSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => v !== 'null' && v !== 'undefined', { message: 'Invalid store ID' });

const OrderIdSchema = z.preprocess((v) => Number(v), z.number().int().positive());

const ConfirmationTokenSchema = z.string().trim().min(10).max(200);

const UpdateOrderDetailsSchema = z
  .object({
    customer_name: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().min(1).max(120)
    ),
    customer_email: z
      .preprocess(
        (v) => {
          if (v === null || v === undefined) return undefined;
          if (typeof v !== 'string') return v;
          const t = v.trim();
          return t === '' ? undefined : t;
        },
        z.string().email()
      )
      .optional(),
    customer_phone: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().min(7).max(32)
    ),
    shipping_address: z
      .preprocess(
        (v) => {
          if (v === null || v === undefined) return undefined;
          if (typeof v !== 'string') return v;
          const t = v.trim();
          return t === '' ? undefined : t;
        },
        z.string().max(500)
      )
      .optional(),
    quantity: z.preprocess((v) => Number(v), z.number().int().positive().max(999)),
  })
  .strict();

async function resolvePendingConfirmableOrder(args: { storeSlug: string; orderId: number }) {
  const { storeSlug, orderId } = args;
  const result = await pool.query(
    `SELECT o.id, o.client_id, o.product_id, o.status, o.quantity, o.total_price,
            o.variant_id, o.variant_color, o.variant_size, o.variant_size2, o.variant_name, o.unit_price,
            p.title as product_title, p.price as product_price,
            s.store_name
     FROM store_orders o
     INNER JOIN client_store_settings s ON o.client_id = s.client_id
     LEFT JOIN client_store_products p ON o.product_id = p.id
     WHERE o.id = $1
       AND (s.store_slug = $2
         OR LOWER(REGEXP_REPLACE(s.store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($2))
       AND o.status = 'pending'
     LIMIT 1`,
    [orderId, storeSlug]
  );
  return result.rows[0] as any | undefined;
}

async function assertValidConfirmationLink(args: { orderId: number; token: string }) {
  const linkResult = await pool.query(
    `SELECT order_id, client_id, expires_at
     FROM confirmation_links
     WHERE order_id = $1 AND link_token = $2
     LIMIT 1`,
    [args.orderId, args.token]
  );
  const row = linkResult.rows[0] as any | undefined;
  if (!row) return undefined;
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    return { ...row, _expired: true };
  }
  return row;
}

function getTokenFromReq(req: any): string | undefined {
  const q = req?.query || {};
  const raw = q.t ?? q.token;
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length ? t : undefined;
}

/**
 * GET /api/storefront/:storeSlug/order/:orderId
 * Load order details for confirmation page
 */
export const getOrderForConfirmation: RequestHandler = async (req, res) => {
  try {
    let storeSlug: string;
    let orderId: number;
    try {
      storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
      orderId = OrderIdSchema.parse(req.params.orderId);
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }

    let token: string;
    try {
      token = ConfirmationTokenSchema.parse(getTokenFromReq(req));
    } catch {
      return res.status(400).json({ error: 'Missing or invalid confirmation token' });
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT o.*, p.title as product_title, s.store_name, s.store_slug
       FROM store_orders o
       LEFT JOIN client_store_products p ON o.product_id = p.id
       LEFT JOIN client_store_settings s ON o.client_id = s.client_id
       WHERE o.id = $1
         AND (s.store_slug = $2
           OR LOWER(REGEXP_REPLACE(s.store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($2))
         AND o.status = 'pending'`,
      [orderId, storeSlug]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or already confirmed" });
    }

    const order = orderResult.rows[0];

    // Check confirmation link validity (token-bound)
    const linkRow = await assertValidConfirmationLink({ orderId, token });
    if (!linkRow) {
      return res.status(404).json({ error: "Order not found or link expired" });
    }
    if ((linkRow as any)._expired) {
      return res.status(410).json({ error: "Confirmation link expired" });
    }

    // Update accessed count (token-bound)
    await pool.query(
      `UPDATE confirmation_links
       SET accessed_count = accessed_count + 1, accessed_at = NOW()
       WHERE order_id = $1 AND link_token = $2`,
      [orderId, token]
    );

    res.json({
      order: {
        id: order.id,
        product_title: order.product_title,
        variant_id: order.variant_id || null,
        variant_name: order.variant_name || null,
        variant_color: order.variant_color || null,
        variant_size: order.variant_size || null,
        variant_size2: order.variant_size2 || null,
        unit_price: order.unit_price || null,
        quantity: order.quantity,
        total_price: order.total_price,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address,
        store_name: order.store_name
      }
    });
  } catch (error) {
    console.error("Get order for confirmation error:", error);
    res.status(500).json({ error: "Failed to load order" });
  }
};

/**
 * POST /api/storefront/:storeSlug/order/:orderId/confirm
 * Customer confirms, declines, or changes order
 */
export const confirmOrder: RequestHandler = async (req, res) => {
  try {
    let storeSlug: string;
    let orderId: number;
    try {
      storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
      orderId = OrderIdSchema.parse(req.params.orderId);
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }

    let token: string;
    try {
      token = ConfirmationTokenSchema.parse(getTokenFromReq(req));
    } catch {
      return res.status(400).json({ error: 'Missing or invalid confirmation token' });
    }

    const action = typeof req.body?.action === 'string' ? String(req.body.action) : '';

    // Validate confirmation link + order tenant binding
    const linkRow = await assertValidConfirmationLink({ orderId, token });
    if (!linkRow) {
      return res.status(404).json({ error: 'Order not found or link expired' });
    }
    if ((linkRow as any)._expired) {
      return res.status(410).json({ error: 'Confirmation link expired' });
    }

    const orderRow = await resolvePendingConfirmableOrder({ storeSlug, orderId });
    if (!orderRow) {
      return res.status(404).json({ error: 'Order not found or already confirmed' });
    }

    // Defense-in-depth: confirmation link must match order tenant
    if (linkRow.client_id != null && Number(linkRow.client_id) !== Number(orderRow.client_id)) {
      return res.status(403).json({ error: 'Invalid confirmation link' });
    }

    const clientId = Number(orderRow.client_id);

    if (action === "approve") {
      // Update order status to confirmed
      const updateResult = await pool.query(
        `UPDATE store_orders SET status = 'confirmed', updated_at = NOW()
         WHERE id = $1 AND client_id = $2 AND status = 'pending'
         RETURNING *`,
        [orderId, clientId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Record confirmation
      await pool.query(
        `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
         VALUES ($1, $2, 'approved', 'link', NOW())`,
        [orderId, clientId]
      );

      res.json({ success: true, message: "Order confirmed" });
    } else if (action === "decline") {
      // Mark order as cancelled
      const updateResult = await pool.query(
        `UPDATE store_orders SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND client_id = $2 AND status = 'pending'
         RETURNING *`,
        [orderId, clientId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Record confirmation
      await pool.query(
        `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
         VALUES ($1, $2, 'declined', 'link', NOW())`,
        [orderId, clientId]
      );

      if ((global as any).broadcastOrderUpdate) {
        (global as any).broadcastOrderUpdate(updateResult.rows[0]);
      }

      res.json({ success: true, message: "Order cancelled" });
    } else {
      res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Confirm order error:", error);
    res.status(500).json({ error: "Failed to confirm order" });
  }
};

/**
 * PATCH /api/storefront/:storeSlug/order/:orderId/update
 * Customer updates order details before confirming
 */
export const updateOrderDetails: RequestHandler = async (req, res) => {
  try {
    let storeSlug: string;
    let orderId: number;
    try {
      storeSlug = StoreSlugSchema.parse(req.params.storeSlug);
      orderId = OrderIdSchema.parse(req.params.orderId);
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }

    let token: string;
    try {
      token = ConfirmationTokenSchema.parse(getTokenFromReq(req));
    } catch {
      return res.status(400).json({ error: 'Missing or invalid confirmation token' });
    }

    // Verify confirmation link is still valid
    const linkRow = await assertValidConfirmationLink({ orderId, token });
    if (!linkRow) {
      return res.status(404).json({ error: 'Order not found or link expired' });
    }
    if ((linkRow as any)._expired) {
      return res.status(410).json({ error: 'Confirmation link expired' });
    }

    let data: z.infer<typeof UpdateOrderDetailsSchema>;
    try {
      data = UpdateOrderDetailsSchema.parse(req.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid request' });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }

    const normalizedPhone = String(data.customer_phone).replace(/\s/g, '');
    if (!/^\+?[0-9]{7,}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Ensure order belongs to store + still pending
    const orderRow = await resolvePendingConfirmableOrder({ storeSlug, orderId });
    if (!orderRow) {
      return res.status(404).json({ error: 'Order not found or already confirmed' });
    }

    // Defense-in-depth: confirmation link must match order tenant
    if (linkRow.client_id != null && Number(linkRow.client_id) !== Number(orderRow.client_id)) {
      return res.status(403).json({ error: 'Invalid confirmation link' });
    }

    const clientId = Number(orderRow.client_id);
    const unitPrice = Number(orderRow.product_price || 0);
    const expectedTotal = unitPrice > 0
      ? unitPrice * Number(data.quantity)
      : Number(orderRow.total_price ?? 0);

    // Update order
    const updateResult = await pool.query(
      `UPDATE store_orders 
       SET customer_name = $1, customer_email = $2, customer_phone = $3, 
           shipping_address = $4, quantity = $5, total_price = $6, updated_at = NOW()
       WHERE id = $7 AND client_id = $8 AND status = 'pending'
       RETURNING *`,
      [
        data.customer_name,
        data.customer_email || null,
        normalizedPhone,
        data.shipping_address || null,
        data.quantity,
        expectedTotal,
        orderId,
        clientId,
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or already confirmed" });
    }

    res.json({
      success: true,
      order: updateResult.rows[0]
    });
  } catch (error) {
    console.error("Update order details error:", isProduction ? (error instanceof Error ? error.message : String(error)) : error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

/**
 * Helper: Send bot messages when order is created
 */
export async function sendBotMessagesForOrder(
  orderId: number,
  clientId: number,
  customerPhone: string,
  customerName: string,
  storeName: string,
  productName: string,
  price: number,
  storeSlug: string,
  options?: { skipTelegram?: boolean; quantity?: number; address?: string }
): Promise<void> {
  try {
    // Reuse existing unexpired link token if possible (prevents duplicates)
    let confirmationToken: string | null = null;
    try {
      const existing = await pool.query(
        `SELECT link_token
         FROM confirmation_links
         WHERE order_id = $1 AND client_id = $2 AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId, clientId]
      );
      if (existing.rows.length && existing.rows[0]?.link_token) {
        confirmationToken = String(existing.rows[0].link_token);
      }
    } catch {}

    if (!confirmationToken) {
      confirmationToken = await createConfirmationLink(orderId, clientId);
    }

    const baseUrl = getPublicBaseUrl();
    const confirmationLink = `${baseUrl}/store/${storeSlug}/order/${orderId}/confirm?t=${encodeURIComponent(String(confirmationToken))}`;

    // Send bot messages
    await sendOrderConfirmationMessages(
      orderId,
      clientId,
      customerPhone,
      customerName,
      storeName,
      productName,
      price,
      confirmationLink,
      options
    );

    console.log(`[Orders] Bot messages scheduled for order ${orderId}`);
  } catch (error) {
    console.error(`Error sending bot messages for order ${orderId}:`, error);
    // Don't throw - order should still be created even if bot fails
  }
}
