import { Router, RequestHandler } from "express";
import { randomBytes } from "crypto";
import { pool, ensureMigrationsReady } from "../utils/database";
import { sendBotMessagesForOrder } from "./order-confirmation";
import { createOrderTelegramLink } from "../utils/telegram";
import { replaceTemplateVariables, sendTelegramMessage } from "../utils/bot-messaging";
import { assessOrderRisk, getHighRiskOrders } from "../utils/fraud-detection";
import { z } from 'zod';
import { ensureSystemOrderStatuses } from '../utils/client-provisioning';

const isProduction = process.env.NODE_ENV === 'production';

const isMissingSchemaError = (err: any): boolean => {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column'));
};

async function getStoreOrdersColumns(): Promise<Set<string>> {
  const res = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'store_orders'`
  );
  return new Set<string>(res.rows.map((r: any) => String(r.column_name)));
}

export const ordersRouter = Router();

const createOrderBodySchema = z
  .object({
    product_id: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().positive()).optional(),
    variant_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v),
      z.number().int().positive()
    ).optional(),
    client_id: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().positive()).optional(),
    store_slug: z.string().trim().min(1).max(100).optional(),
    quantity: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().positive().max(9999)),
    // Client-provided total_price is accepted for backward-compatibility but ignored.
    // Total is computed server-side from the current product price.
    total_price: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().finite().positive().max(1_000_000_000)).optional(),
    delivery_fee: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().finite().nonnegative().max(1_000_000_000)).optional(),
    delivery_type: z.enum(['home', 'desk']).optional(),
    customer_name: z.string().trim().min(1).max(255),
    customer_email: z.string().trim().email().max(255).optional().nullable(),
    customer_phone: z.string().trim().min(7).max(50),
    customer_address: z.string().trim().max(1000).optional().nullable(),
    shipping_wilaya_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v),
      z.number().int().positive()
    ).optional().nullable(),
    shipping_commune_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v),
      z.number().int().positive()
    ).optional().nullable(),
    shipping_hai: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

async function resolveDeliveryFee(params: {
  clientId: number;
  wilayaId?: number | null;
  deliveryType?: 'home' | 'desk';
}): Promise<{ deliveryFee: number; deliveryType: 'home' | 'desk' }>{
  const deliveryType = params.deliveryType || 'home';
  const wilayaId = params.wilayaId ? Number(params.wilayaId) : null;

  if (!wilayaId || !Number.isFinite(wilayaId) || wilayaId <= 0) {
    return { deliveryFee: 0, deliveryType };
  }

  const res = await pool.query(
    `SELECT home_delivery_price, desk_delivery_price
     FROM delivery_prices
     WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true
     ORDER BY home_delivery_price ASC
     LIMIT 1`,
    [params.clientId, wilayaId]
  );

  if (res.rows.length === 0) {
    return { deliveryFee: 500, deliveryType };
  }

  const row = res.rows[0];
  const home = Number(row.home_delivery_price ?? 0);
  const desk = row.desk_delivery_price == null ? null : Number(row.desk_delivery_price);
  const chosen = deliveryType === 'desk' && desk != null ? desk : home;
  return { deliveryFee: Number.isFinite(chosen) && chosen >= 0 ? chosen : 0, deliveryType };
}

/**
 * Create a new order from a buyer
 * POST /api/orders/create
 */
export const createOrder: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    const parsed = createOrderBodySchema.safeParse(req.body);
    if (parsed.success === false) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const {
      product_id,
      variant_id,
      client_id,
      store_slug,
      quantity,
      total_price: _ignoredTotalPrice,
      delivery_fee: _ignoredDeliveryFee,
      delivery_type,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      shipping_wilaya_id,
      shipping_commune_id,
      shipping_hai,
    } = parsed.data;

    const normalizedPhone = String(customer_phone).replace(/\s/g, '');
    if (!/^\+?[0-9]{7,}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    
    if (!isProduction) {
      console.log(`[Orders] Attempting to resolve client_id from product_id=${product_id} or store_slug=${store_slug}`);
    }
    
    let resolvedClientId: number | null = null;

    // Resolve owner from store_slug first (if given)
    if (store_slug) {
      if (!isProduction) console.log(`[Orders] Looking up store_slug in client_store_settings...`);
      const cs = await pool.query(
        `SELECT client_id
         FROM client_store_settings
         WHERE store_slug = $1
            OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)
         LIMIT 1`,
        [store_slug]
      );
      if (cs.rows.length > 0) {
        resolvedClientId = Number(cs.rows[0].client_id);
        if (!isProduction) console.log(`[Orders] Found in client_store_settings, client_id=${resolvedClientId}`);
      } else {
        return res.status(404).json({ error: 'Store not found' });
      }
    }

    // Resolve owner + pricing from product_id (and cross-check if store_slug was provided)
    const productRes = await pool.query(
      'SELECT client_id, price, stock_quantity, status FROM client_store_products WHERE id = $1 LIMIT 1',
      [product_id]
    );
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productRow = productRes.rows[0];
    const productClientId = Number(productRow.client_id);
    if (!resolvedClientId) {
      resolvedClientId = productClientId;
      if (!isProduction) console.log(`[Orders] Resolved client_id from product: ${resolvedClientId}`);
    } else if (resolvedClientId !== productClientId) {
      return res.status(400).json({ error: 'Product does not belong to store' });
    }

    if (String(productRow.status || 'active') !== 'active') {
      return res.status(400).json({ error: 'Product is not available' });
    }

    let variantRow: any | null = null;
    if (variant_id) {
      const vRes = await pool.query(
        `SELECT id, color, size, variant_name, price, stock_quantity, is_active
         FROM product_variants
         WHERE id = $1 AND product_id = $2 AND client_id = $3 AND is_active = true
         LIMIT 1`,
        [Number(variant_id), product_id, productClientId]
      );
      if (vRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid variant' });
      }
      variantRow = vRes.rows[0];
      const vStock = Number(variantRow.stock_quantity ?? 0);
      if (!Number.isFinite(vStock) || vStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
    }

    const unitPrice = variantRow && variantRow.price != null ? Number(variantRow.price) : Number(productRow.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ error: 'Invalid product price' });
    }

    if (!variantRow) {
      const availableStock = Number(productRow.stock_quantity ?? 0);
      if (!Number.isFinite(availableStock) || availableStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
    }

    const { deliveryFee, deliveryType } = await resolveDeliveryFee({
      clientId: Number(resolvedClientId),
      wilayaId: shipping_wilaya_id ?? null,
      deliveryType: delivery_type,
    });

    const expectedTotalPrice = (unitPrice * Number(quantity)) + deliveryFee;

    if (!resolvedClientId) {
      return res.status(400).json({ error: 'Could not determine store owner' });
    }

    if (client_id && Number(client_id) !== Number(resolvedClientId)) {
      return res.status(400).json({ error: 'client_id mismatch' });
    }

    // Create order with pending status + atomically decrement stock
    client = await pool.connect();
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

    addCol('product_id', product_id || null);
    addCol('client_id', resolvedClientId);
    addCol('quantity', quantity);
    addCol('total_price', expectedTotalPrice);
    addCol('delivery_fee', deliveryFee);
    addCol('delivery_type', deliveryType);
    addCol('variant_id', variantRow ? Number(variantRow.id) : null);
    addCol('variant_color', variantRow ? (variantRow.color || null) : null);
    addCol('variant_size', variantRow ? (variantRow.size || null) : null);
    addCol('variant_name', variantRow ? (variantRow.variant_name || null) : null);
    addCol('unit_price', unitPrice);
    addCol('customer_name', customer_name);
    addCol('customer_email', customer_email || null);
    addCol('customer_phone', normalizedPhone || null);
    addCol('shipping_address', customer_address || null);
    addCol('shipping_wilaya_id', shipping_wilaya_id || null);
    addCol('shipping_commune_id', shipping_commune_id || null);
    addCol('shipping_hai', shipping_hai || null);
    addCol('status', 'pending');
    addCol('payment_status', 'unpaid');
    addCol('created_at', new Date());

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await client.query(
      `INSERT INTO store_orders (${insertCols.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      insertVals
    );

    if (variantRow) {
      const vUpdate = await client.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND product_id = $3 AND client_id = $4 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, Number(variantRow.id), product_id, resolvedClientId]
      );
      const pUpdate = await client.query(
        'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, product_id, resolvedClientId]
      );
      if (vUpdate.rows.length === 0 || pUpdate.rows.length === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Insufficient stock' });
      }
    } else {
      const stockUpdate = await client.query(
        'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
        [quantity, product_id, resolvedClientId]
      );
      if (stockUpdate.rows.length === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Insufficient stock' });
      }
    }

    await client.query('COMMIT');
    inTransaction = false;

    // Create Telegram deep-link for this order (optional for the customer)
    const telegram = await createOrderTelegramLink({
      orderId: Number(result.rows[0].id),
      clientId: Number(resolvedClientId),
      customerPhone: normalizedPhone,
      customerName: String(customer_name),
    }).catch(() => ({ startToken: '', startUrl: null } as any));

    res.status(201).json({
      success: true,
      order: result.rows[0],
      message: 'Order created successfully',
      telegramStartUrl: telegram?.startUrl || null,
      telegramUrls: telegram?.startUrl ? [telegram.startUrl] : [],
    });
    // Broadcast order creation
    if (global.broadcastOrderUpdate) {
      global.broadcastOrderUpdate(result.rows[0]);
    }

    // Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs(actor_type, actor_id, action, target_type, target_id, details, created_at)
         VALUES($1,$2,$3,$4,$5,$6,NOW())`,
        ['system', resolvedClientId || null, 'create_order', 'order', result.rows[0]?.id || null, JSON.stringify({ product_id, customer_name })]
      );
    } catch {}

    // Fire-and-forget bot messaging (Telegram instant + scheduled confirmation with buttons)
    const order = result.rows[0];
    const toPhone = normalizedPhone;
    if (toPhone) {
      const storeRow = (await pool.query(
        'SELECT store_name, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1',
        [resolvedClientId]
      )).rows?.[0];
      const storeName = storeRow?.store_name || 'EcoPro Store';
      const storeSlug = store_slug || storeRow?.store_slug || String(resolvedClientId);

      if (storeSlug) {
        const productTitle = (await pool.query(
          'SELECT title FROM client_store_products WHERE id = $1 LIMIT 1',
          [product_id]
        )).rows?.[0]?.title || 'Product';

        try {
          // If Telegram is enabled for this store, try to send instant messages when connected,
          // and always schedule a confirmation message with buttons.
          const botRes = await pool.query(
            `SELECT telegram_bot_token, template_instant_order, template_pin_instructions,
                    telegram_delay_minutes, template_order_confirmation
             FROM bot_settings
             WHERE client_id = $1 AND enabled = true AND telegram_bot_token IS NOT NULL
             LIMIT 1`,
            [resolvedClientId]
          );

          const bot = botRes.rows[0];
          const botToken: string | undefined = bot?.telegram_bot_token;

          // Default templates (same spirit as public-store.ts)
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

          const defaultConfirmationTemplate = `مرحباً {customerName}! 🌟

هل تؤكد طلبك من {storeName}؟

📦 المنتج: {productName}
💰 السعر: {totalPrice} دج
📍 العنوان: {address}

اضغط على أحد الأزرار للتأكيد أو الإلغاء:`;

          const orderVars = {
            customerName: customer_name,
            productName: productTitle,
            totalPrice: String(order.total_price ?? expectedTotalPrice),
            price: String(order.total_price ?? expectedTotalPrice),
            quantity: quantity,
            orderId: order.id,
            customerPhone: customer_phone || normalizedPhone,
            address: customer_address || 'غير محدد',
            storeName: storeName,
            companyName: storeName,
          };

          // Check if customer is already linked (phone -> chat mapping)
          let telegramChatId: string | null = null;
          const chatRes = await pool.query(
            `SELECT telegram_chat_id FROM customer_messaging_ids
             WHERE client_id = $1 AND customer_phone = $2 AND telegram_chat_id IS NOT NULL
             LIMIT 1`,
            [resolvedClientId, normalizedPhone]
          );
          if (chatRes.rows.length && chatRes.rows[0]?.telegram_chat_id) {
            telegramChatId = String(chatRes.rows[0].telegram_chat_id);
          }

          // If connected, send the immediate messages now and bind chat to this order.
          if (botToken && telegramChatId) {
            await pool.query(
              `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, created_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id`,
              [order.id, resolvedClientId, telegramChatId]
            );

            const instantOrderTemplate = bot.template_instant_order || defaultInstantOrder;
            const pinTemplate = bot.template_pin_instructions || defaultPinInstructions;
            const orderMessage = replaceTemplateVariables(String(instantOrderTemplate), orderVars);

            const sent = await sendTelegramMessage(botToken, telegramChatId, orderMessage);
            if (sent.success) {
              await sendTelegramMessage(botToken, telegramChatId, String(pinTemplate));
            }
          }

          // Schedule non-Telegram bot messages (Messenger) regardless of Telegram connection.
          // Telegram is handled above (instant) + via scheduled_messages (confirmation with buttons).
          sendBotMessagesForOrder(
            order.id,
            Number(resolvedClientId),
            toPhone,
            customer_name,
            storeName,
            productTitle,
            Number(order.total_price ?? expectedTotalPrice),
            storeSlug,
            { skipTelegram: true }
          ).catch(() => {/* swallow errors */});

          // Always schedule confirmation message with buttons (worker will wait for chat link if needed)
          if (botToken) {
            const delayMinutes = bot?.telegram_delay_minutes || 5;
            console.log(`[Orders] Scheduling confirmation for order ${order.id} in ${delayMinutes} minutes`);
            const confirmationTemplate = bot?.template_order_confirmation || defaultConfirmationTemplate;
            const confirmationMessage = replaceTemplateVariables(String(confirmationTemplate), orderVars);

            // Use PostgreSQL NOW() + INTERVAL to avoid timezone issues between JS and DB
            await pool.query(
              `INSERT INTO scheduled_messages
               (client_id, order_id, telegram_chat_id, message_content, message_type, scheduled_at, status)
               VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::INTERVAL, 'pending')
               ON CONFLICT DO NOTHING`,
              [resolvedClientId, order.id, telegramChatId, confirmationMessage, 'order_confirmation', delayMinutes]
            );
          }
        } catch (e) {
          // Fall back to the old flow (bot_messages) if anything above fails
          sendBotMessagesForOrder(
            order.id,
            Number(resolvedClientId),
            toPhone,
            customer_name,
            storeName,
            productTitle,
            Number(order.total_price ?? expectedTotalPrice),
            storeSlug
          ).catch(() => {/* swallow errors */});
        }
      }
    }
  } catch (error) {
    if (isMissingSchemaError(error) && !(req as any).__migrationsRetried) {
      (req as any).__migrationsRetried = true;
      try {
        await ensureMigrationsReady('createOrder missing schema');
        return createOrder(req, res, () => undefined);
      } catch (e) {
        console.error('[Orders] Migration retry failed:', (e as any)?.message || e);
      }
    }
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

/**
 * Manually create an order from the dashboard (authenticated client)
 * POST /api/client/orders
 */
export const createClientOrder: RequestHandler = async (req, res) => {
  const clientId = (req as any).user?.id;
  if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    customer_name,
    customer_phone,
    customer_address,
    product_id,
    quantity = 1,
    total_price,
    notes,
  } = req.body as any;

  const trimName = typeof customer_name === 'string' ? customer_name.trim() : '';
  const trimPhone = typeof customer_phone === 'string' ? customer_phone.trim().replace(/\s/g, '') : '';
  if (!trimName) return res.status(400).json({ error: 'Customer name is required' });
  if (!trimPhone) return res.status(400).json({ error: 'Phone number is required' });
  if (!/^\+?[0-9]{7,}$/.test(trimPhone)) return res.status(400).json({ error: 'Invalid phone number' });

  try {
    const storeOrderColumns = await getStoreOrdersColumns();
    const insertCols: string[] = [];
    const insertVals: any[] = [];
    const addCol = (col: string, val: any) => {
      if (!storeOrderColumns.has(col)) return;
      insertCols.push(col);
      insertVals.push(val);
    };

    // Resolve product if given, otherwise use a manual total_price
    let unitPrice = 0;
    let resolvedProductId: number | null = product_id ? Number(product_id) : null;
    if (resolvedProductId) {
      const pRes = await pool.query(
        `SELECT id, price FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1`,
        [resolvedProductId, clientId]
      );
      if (pRes.rows.length === 0) return res.status(404).json({ error: 'Product not found in your store' });
      unitPrice = Number(pRes.rows[0].price);
    }

    const orderTotal = Number.isFinite(Number(total_price)) && Number(total_price) > 0
      ? Number(total_price)
      : unitPrice * Number(quantity);

    addCol('client_id', clientId);
    addCol('product_id', resolvedProductId);
    addCol('quantity', Number(quantity) || 1);
    addCol('total_price', orderTotal);
    addCol('unit_price', unitPrice);
    addCol('customer_name', trimName);
    addCol('customer_phone', trimPhone);
    addCol('shipping_address', typeof customer_address === 'string' ? customer_address.trim() || null : null);
    addCol('notes', typeof notes === 'string' ? notes.trim() || null : null);
    addCol('status', 'pending');
    addCol('payment_status', 'unpaid');
    addCol('delivery_type', 'home');
    addCol('created_at', new Date());

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `INSERT INTO store_orders (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      insertVals
    );
    clearOrdersCache(Number(clientId));
    return res.status(201).json({ success: true, order: result.rows[0] });
  } catch (err: any) {
    console.error('[createClientOrder]', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
};

// In-memory cache for orders (per-client)
const ordersCache = new Map<number, { data: any; timestamp: number }>();
const ORDERS_CACHE_TTL = 5 * 1000; // 5 seconds cache - orders need to be more real-time

// Clear orders cache when an order is modified
export function clearOrdersCache(clientId: number) {
  ordersCache.delete(clientId);
}

/**
 * Get all orders for a client (dashboard)
 * GET /api/client/orders
 * Query params: limit (default 100), offset (default 0)
 */
export const getClientOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Get pagination params
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500); // Max 500 to prevent huge queries
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Check cache (only for initial page loads with no offset)
    const cacheKey = Number((req.user as any).id);
    if (Number.isFinite(cacheKey) && offset === 0 && limit === 100) {
      const cached = ordersCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ORDERS_CACHE_TTL) {
        return res.json(cached.data);
      }
    }

    // Optimized query using Promise.all for parallel execution
    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT 
          o.id,
          o.product_id,
          o.client_id,
          o.quantity,
          o.total_price,
          o.status,
          o.variant_id,
          o.variant_color,
          o.variant_size,
          o.variant_name,
          o.unit_price,
          o.customer_name,
          o.customer_email,
          o.customer_phone,
          o.shipping_address,
          o.shipping_wilaya_id,
          o.shipping_commune_id,
          o.shipping_hai,
          o.delivery_type,
          o.delivery_fee,
          o.cod_amount,
          o.created_at,
          o.updated_at,
          o.delivery_company_id,
          o.tracking_number,
          o.delivery_status,
          o.shipping_label_url,
          COALESCE(cp.title, 'Deleted Product') as product_title,
          COALESCE(cp.price, 0) as product_price,
          COALESCE(cp.images, '{}') as product_images
        FROM store_orders o
        LEFT JOIN client_store_products cp ON o.product_id = cp.id
        WHERE o.client_id = $1
          AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) as total FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL',
        [req.user.id]
      )
    ]);

    const responseData = {
      orders: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    };

    // Cache the response for default pagination
    if (Number.isFinite(cacheKey) && offset === 0 && limit === 100) {
      ordersCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    }

    res.json(responseData);
  } catch (error) {
    console.error("Get client orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/**
 * Store product data for checkout (temporary session data)
 * POST /api/checkout/save-product
 * Stores product in database instead of localStorage
 */
export const saveProductForCheckout: RequestHandler = async (req, res) => {
  try {
    const { product_id, product_data, store_slug } = req.body;

    if (!product_id || !product_data) {
      res.status(400).json({ error: "Missing product_id or product_data" });
      return;
    }

    // Store in a temporary checkout_sessions table
    // This persists across page refreshes and browser restarts
    const sessionId = `${product_id}-${Date.now()}-${randomBytes(16).toString('base64url')}`;
    
    const result = await pool.query(
      `INSERT INTO checkout_sessions (session_id, product_id, product_data, store_slug, created_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')
       RETURNING session_id`,
      [sessionId, product_id, JSON.stringify(product_data), store_slug || null]
    );

    res.json({
      success: true,
      sessionId: result.rows[0].session_id
    });
  } catch (error) {
    console.error("Save product for checkout error:", error);
    res.status(500).json({ error: "Failed to save product" });
  }
};

/**
 * Retrieve product data for checkout
 * GET /api/checkout/get-product/:sessionId
 * Retrieves product from database instead of localStorage
 */
export const getProductForCheckout: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM checkout_sessions 
       WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Checkout session not found or expired" });
      return;
    }

    res.json({
      success: true,
      product: result.rows[0].product_data,
      store_slug: result.rows[0].store_slug
    });
  } catch (error) {
    console.error("Get product for checkout error:", error);
    res.status(500).json({ error: "Failed to retrieve product" });
  }
};

/**
 * Delete an order (soft delete)
 * DELETE /api/client/orders/:id
 */
export const deleteOrder: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    const orderId = parseInt(req.params.id, 10);
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }
    // Soft delete: set deleted_at timestamp
    const result = await pool.query(
      `UPDATE store_orders SET deleted_at = NOW() WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL RETURNING id`,
      [orderId, clientId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found or already deleted" });
      return;
    }
    clearOrdersCache(clientId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

// Register the delete order route
ordersRouter.delete('/api/client/orders/:id', deleteOrder);

/**
 * Update order status
 * PATCH /api/client/orders/:id/status
 */
export const updateOrderStatus: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { id } = req.params;
    const { status: rawStatus } = req.body;
    const status = rawStatus?.trim();
    
    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }
    
    if (!isProduction) console.log('[updateOrderStatus] User:', req.user.id, 'Order:', id, 'Status:', status);

    // Built-in valid statuses
    const builtInStatuses = [
      'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
      'completed', 'failed', 'at_delivery', 'no_answer_1', 'no_answer_2', 'no_answer_3',
      'waiting_callback', 'postponed', 'line_closed', 'fake', 'duplicate', 'returned'
    ];
    
    // Check if status is a built-in status OR a custom status for this client
    let isValidStatus = builtInStatuses.includes(status);
    
    if (!isValidStatus) {
      // Check custom statuses in the database
      if (!isProduction) console.log('[updateOrderStatus] Checking custom status for client_id:', req.user.id, 'status:', status);
      const customStatusCheck = await pool.query(
        'SELECT id FROM order_statuses WHERE client_id = $1 AND name = $2',
        [req.user.id, status]
      );
      if (!isProduction) console.log('[updateOrderStatus] Custom status query result:', customStatusCheck.rows);
      isValidStatus = customStatusCheck.rows.length > 0;
    }
    
    if (!isValidStatus) {
      if (!isProduction) console.log('[updateOrderStatus] Invalid status rejected');
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const result = await pool.query(
      `UPDATE store_orders 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
      [status, id, req.user.id]
    );
    
    if (!isProduction) console.log('[updateOrderStatus] Update result rows:', result.rows.length);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json(result.rows[0]);
    // Broadcast order status update
    if (global.broadcastOrderUpdate) {
      global.broadcastOrderUpdate(result.rows[0]);
    }

    // Telegram tracking updates (fire-and-forget)
    // Send if we have a telegram_bot_token, regardless of provider setting
    try {
      const settingsRes = await pool.query(
        `SELECT enabled, provider, telegram_bot_token, template_shipping
         FROM bot_settings WHERE client_id = $1 LIMIT 1`,
        [req.user.id]
      );
      const settings = settingsRes.rows[0];
      if (settings?.enabled && settings?.telegram_bot_token) {
        const orderRow = result.rows[0];
        const shouldNotify = ['processing', 'shipped', 'delivered', 'cancelled'].includes(String(status));
        if (shouldNotify) {
          const msg = replaceTemplateVariables(
            String(settings.template_shipping || 'Order #{orderId} status updated: {status}'),
            {
              orderId: orderRow.id,
              status: String(status),
              trackingNumber: '',
            }
          );
          await pool.query(
            `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
             VALUES ($1,$2,$3,'telegram',$4,NULL,NOW())`,
            [orderRow.id, req.user.id, orderRow.customer_phone || '', msg]
          );
        }
      }
    } catch {
      // ignore bot tracking failures
    }
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

const updateClientOrderSchema = z
  .object({
    customer_name: z
      .preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1).max(255))
      .optional(),
    customer_email: z
      .preprocess((v) => {
        if (v === '' || v === null || v === undefined) return undefined;
        if (typeof v === 'string') return v.trim();
        return v;
      }, z.string().email().max(255))
      .optional()
      .nullable(),
    customer_phone: z
      .preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(7).max(50))
      .optional(),
    shipping_address: z
      .preprocess((v) => {
        if (v === '' || v === null || v === undefined) return undefined;
        if (typeof v === 'string') return v.trim();
        return v;
      }, z.string().max(1000))
      .optional()
      .nullable(),
    shipping_wilaya_id: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v), z.number().int().positive())
      .optional()
      .nullable(),
    shipping_commune_id: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v), z.number().int().positive())
      .optional()
      .nullable(),
    shipping_hai: z
      .preprocess((v) => {
        if (v === '' || v === null || v === undefined) return undefined;
        if (typeof v === 'string') return v.trim();
        return v;
      }, z.string().max(120))
      .optional()
      .nullable(),
    delivery_type: z.enum(['home', 'desk']).optional(),
    quantity: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v), z.number().int().positive().max(9999))
      .optional(),
    variant_id: z
      .preprocess((v) => {
        if (v === '' || v === undefined) return undefined;
        if (v === null) return null;
        if (typeof v === 'string') return Number(v);
        return v;
      }, z.union([z.number().int().positive(), z.null()]))
      .optional(),
  })
  .strict();

/**
 * Update order details (store owner)
 * PATCH /api/client/orders/:id
 */
export const updateClientOrder: RequestHandler = async (req, res) => {
  let client: any;
  let inTransaction = false;
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'Invalid order id' });
      return;
    }

    const parsed = updateClientOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const clientId = Number(req.user.id);

    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;

    const orderRes = await client.query(
      `SELECT id, client_id, product_id, quantity,
              variant_id, unit_price,
              customer_name, customer_email, customer_phone,
              shipping_address, shipping_wilaya_id, shipping_commune_id, shipping_hai,
              delivery_type
       FROM store_orders
       WHERE id = $1 AND client_id = $2
       FOR UPDATE`,
      [orderId, clientId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const existing = orderRes.rows[0];
    const productId = Number(existing.product_id);
    const oldQuantity = Number(existing.quantity ?? 1);
    const oldVariantId = existing.variant_id == null ? null : Number(existing.variant_id);

    const body = parsed.data;

    const newQuantity = body.quantity != null ? Number(body.quantity) : oldQuantity;
    const newVariantId = body.variant_id !== undefined ? body.variant_id : oldVariantId;
    const newDeliveryType = body.delivery_type || (existing.delivery_type as any) || 'home';

    const newWilayaId = body.shipping_wilaya_id !== undefined ? body.shipping_wilaya_id : existing.shipping_wilaya_id;
    const newCommuneId = body.shipping_commune_id !== undefined ? body.shipping_commune_id : existing.shipping_commune_id;
    const newHai = body.shipping_hai !== undefined ? body.shipping_hai : existing.shipping_hai;

    const newCustomerName = body.customer_name !== undefined ? body.customer_name : existing.customer_name;
    const newCustomerEmail = body.customer_email !== undefined ? body.customer_email : existing.customer_email;
    const newCustomerPhone = body.customer_phone !== undefined ? body.customer_phone : existing.customer_phone;
    const newShippingAddress = body.shipping_address !== undefined ? body.shipping_address : existing.shipping_address;

    if (!newCustomerName || !String(newCustomerName).trim()) {
      await client.query('ROLLBACK');
      inTransaction = false;
      res.status(400).json({ error: 'customer_name is required' });
      return;
    }

    if (newCustomerPhone) {
      const normalizedPhone = String(newCustomerPhone).replace(/\s/g, '');
      if (!/^\+?[0-9]{7,}$/.test(normalizedPhone)) {
        await client.query('ROLLBACK');
        inTransaction = false;
        res.status(400).json({ error: 'Invalid phone number' });
        return;
      }
    }

    // Load product pricing + validate
    const productRes = await client.query(
      'SELECT id, client_id, price, stock_quantity, status FROM client_store_products WHERE id = $1 AND client_id = $2 LIMIT 1',
      [productId, clientId]
    );
    if (productRes.rows.length === 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const productRow = productRes.rows[0];
    if (String(productRow.status || 'active') !== 'active') {
      await client.query('ROLLBACK');
      inTransaction = false;
      res.status(400).json({ error: 'Product is not available' });
      return;
    }

    let variantRow: any | null = null;
    if (newVariantId != null) {
      const vRes = await client.query(
        `SELECT id, color, size, variant_name, price, stock_quantity, is_active
         FROM product_variants
         WHERE id = $1 AND product_id = $2 AND client_id = $3 AND is_active = true
         LIMIT 1`,
        [Number(newVariantId), productId, clientId]
      );
      if (vRes.rows.length === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        res.status(400).json({ error: 'Invalid variant' });
        return;
      }
      variantRow = vRes.rows[0];
    }

    const unitPrice = variantRow && variantRow.price != null ? Number(variantRow.price) : Number(productRow.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      res.status(400).json({ error: 'Invalid product price' });
      return;
    }

    // Recompute delivery fee from current shipping_wilaya_id
    const { deliveryFee, deliveryType } = await resolveDeliveryFee({
      clientId,
      wilayaId: newWilayaId ?? null,
      deliveryType: newDeliveryType,
    });

    const expectedTotalPrice = (unitPrice * Number(newQuantity)) + deliveryFee;

    const variantChanged = (oldVariantId ?? null) !== (newVariantId ?? null);
    const quantityChanged = Number(oldQuantity) !== Number(newQuantity);
    if (variantChanged || quantityChanged) {
      // Restore previous stock
      if (oldVariantId != null) {
        await client.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND product_id = $3 AND client_id = $4',
          [oldQuantity, oldVariantId, productId, clientId]
        );
      }

      await client.query(
        'UPDATE client_store_products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND client_id = $3',
        [oldQuantity, productId, clientId]
      );

      // Decrement new stock (with guards)
      if (newVariantId != null) {
        const vUpdate = await client.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND product_id = $3 AND client_id = $4 AND stock_quantity >= $1 RETURNING stock_quantity',
          [newQuantity, Number(newVariantId), productId, clientId]
        );
        const pUpdate = await client.query(
          'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
          [newQuantity, productId, clientId]
        );
        if (vUpdate.rows.length === 0 || pUpdate.rows.length === 0) {
          await client.query('ROLLBACK');
          inTransaction = false;
          res.status(400).json({ error: 'Insufficient stock' });
          return;
        }
      } else {
        const pUpdate = await client.query(
          'UPDATE client_store_products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND client_id = $3 AND stock_quantity >= $1 RETURNING stock_quantity',
          [newQuantity, productId, clientId]
        );
        if (pUpdate.rows.length === 0) {
          await client.query('ROLLBACK');
          inTransaction = false;
          res.status(400).json({ error: 'Insufficient stock' });
          return;
        }
      }
    }

    const updateRes = await client.query(
      `UPDATE store_orders
       SET customer_name = $1,
           customer_email = $2,
           customer_phone = $3,
           shipping_address = $4,
           shipping_wilaya_id = $5,
           shipping_commune_id = $6,
           shipping_hai = $7,
           delivery_type = $8,
           delivery_fee = $9,
           variant_id = $10,
           variant_color = $11,
           variant_size = $12,
           variant_name = $13,
           unit_price = $14,
           quantity = $15,
           total_price = $16,
           cod_amount = $16,
           updated_at = NOW()
       WHERE id = $17 AND client_id = $18
       RETURNING *`,
      [
        String(newCustomerName),
        newCustomerEmail || null,
        newCustomerPhone ? String(newCustomerPhone).replace(/\s/g, '') : null,
        newShippingAddress || null,
        newWilayaId ?? null,
        newCommuneId ?? null,
        newHai ?? null,
        deliveryType,
        deliveryFee,
        newVariantId == null ? null : Number(newVariantId),
        variantRow ? (variantRow.color || null) : null,
        variantRow ? (variantRow.size || null) : null,
        variantRow ? (variantRow.variant_name || null) : null,
        unitPrice,
        newQuantity,
        expectedTotalPrice,
        orderId,
        clientId,
      ]
    );

    await client.query('COMMIT');
    inTransaction = false;

    clearOrdersCache(clientId);

    const updated = updateRes.rows[0];
    res.json(updated);
    if (global.broadcastOrderUpdate) {
      global.broadcastOrderUpdate(updated);
    }
  } catch (error) {
    if (inTransaction && client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  } finally {
    try {
      if (client) client.release();
    } catch {}
  }
};

/**
 * Restore a preset system status that was previously removed.
 * POST /api/client/order-statuses/restore-preset
 */
export const restorePresetStatus: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { key } = req.body;

    const PRESET_CATALOG: Record<string, { name: string; color: string; icon: string; sort_order: number; counts_as_revenue: boolean }> = {
      cancelled:       { name: 'Cancelled',        color: '#ef4444', icon: '✕',  sort_order: 5,  counts_as_revenue: false },
      failed:          { name: 'Failed',            color: '#ef4444', icon: '✕',  sort_order: 21, counts_as_revenue: false },
      delivered:       { name: 'Delivered',        color: '#10b981', icon: '✓',  sort_order: 11, counts_as_revenue: true  },
      declined:        { name: 'Declined',          color: '#ef4444', icon: '✕',  sort_order: 20, counts_as_revenue: false },
      failed:          { name: 'Failed',            color: '#ef4444', icon: '✕',  sort_order: 21, counts_as_revenue: false },
      delivery_failed: { name: 'Delivery Failed',   color: '#ef4444', icon: '🚫', sort_order: 22, counts_as_revenue: false },
      returned:        { name: 'Returned',          color: '#f97316', icon: '↩️', sort_order: 23, counts_as_revenue: false },
      didnt_pickup:    { name: "Didn't Pickup",     color: '#f97316', icon: '⛔', sort_order: 24, counts_as_revenue: false },
      no_answer_1:     { name: 'No Answer (1st)',   color: '#f59e0b', icon: '📞', sort_order: 30, counts_as_revenue: false },
      no_answer_2:     { name: 'No Answer (2nd)',   color: '#f59e0b', icon: '📞', sort_order: 31, counts_as_revenue: false },
      no_answer_3:     { name: 'No Answer (3rd)',   color: '#f59e0b', icon: '📞', sort_order: 32, counts_as_revenue: false },
      waiting_callback:{ name: 'Waiting Callback',  color: '#3b82f6', icon: '📱', sort_order: 33, counts_as_revenue: false },
      postponed:       { name: 'Postponed',         color: '#6366f1', icon: '⏰', sort_order: 34, counts_as_revenue: false },
      fake:            { name: 'Fake',              color: '#dc2626', icon: '⚠️', sort_order: 40, counts_as_revenue: false },
      duplicate:       { name: 'Duplicate',         color: '#9ca3af', icon: '📋', sort_order: 41, counts_as_revenue: false },
    };

    const preset = PRESET_CATALOG[key];
    if (!preset) { res.status(400).json({ error: 'Unknown preset key' }); return; }

    // Check not already exists
    const existing = await pool.query(
      'SELECT id FROM order_statuses WHERE client_id = $1 AND key = $2 LIMIT 1',
      [clientId, key]
    );
    if (existing.rows.length) { res.status(409).json({ error: 'Status already exists' }); return; }

    const result = await pool.query(
      `INSERT INTO order_statuses (client_id, name, key, color, icon, sort_order, is_default, is_system, counts_as_revenue)
       VALUES ($1, $2, $3, $4, $5, $6, false, true, $7)
       RETURNING id, name, key, color, icon, sort_order, is_default, is_system, counts_as_revenue`,
      [clientId, preset.name, key, preset.color, preset.icon, preset.sort_order, preset.counts_as_revenue]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Restore preset status error:', error);
    res.status(500).json({ error: 'Failed to restore status' });
  }
};

/**
 * Get custom order statuses for a client
 * GET /api/client/order-statuses
 */
export const getOrderStatuses: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Backfill missing system/bot statuses for existing accounts as well.
    // This keeps the UI and bots aligned even if the account was created before new statuses were added.
    try {
      await ensureSystemOrderStatuses(Number(clientId));
    } catch (e) {
      console.warn('[getOrderStatuses] Failed to ensure system statuses:', (e as any)?.message || e);
    }

    let result = await pool.query(
      `SELECT id, name, key, color, icon, sort_order, is_default, is_system, counts_as_revenue 
       FROM order_statuses 
       WHERE client_id = $1 
       ORDER BY sort_order ASC, id ASC`,
      [clientId]
    );

    const allowedSystemKeys = new Set([
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'at_delivery',
      // bot-used
      'declined',
      'delivered',
      'didnt_pickup',
      'delivery_failed',
      'failed',
      'returned',
      // call-center / quality control
      'fake',
      'duplicate',
      'no_answer_1',
      'no_answer_2',
      'no_answer_3',
      'waiting_callback',
      'postponed',
    ]);

    const filtered = (result.rows || []).filter((s: any) => {
      if (!s?.is_system) return true;
      const key = String(s.key || '').trim();
      return allowedSystemKeys.has(key);
    });

    res.json(filtered);
  } catch (error) {
    console.error("Get order statuses error:", error);
    res.status(500).json({ error: "Failed to fetch order statuses" });
  }
};

/**
 * Create a custom order status
 * POST /api/client/order-statuses
 */
export const createOrderStatus: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { name, key, color, icon, counts_as_revenue } = req.body;
    const trimmedName = name?.trim();
    if (!trimmedName) {
      res.status(400).json({ error: "Status name is required" });
      return;
    }

    // Generate a safe key if none provided. Keys must be stable english identifiers
    // and not null — a null key becomes the string "null" in translations which
    // humanizes to "Null" in the UI. Create a snake_case key from the name.
    const makeKeyFromName = (s: string) =>
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]+/g, '')
        .replace(/[\s-]+/g, '_')
        .replace(/^_+|_+$/g, '') || `custom_status_${Date.now()}`;

    let newKey = (key || '').toString().trim();
    if (!newKey) {
      newKey = makeKeyFromName(trimmedName);
    }

    // Ensure key uniqueness for this client by appending a numeric suffix if needed.
    let uniqueKey = newKey;
    let suffix = 1;
    while (true) {
      const exists = await pool.query(
        'SELECT 1 FROM order_statuses WHERE client_id = $1 AND key = $2 LIMIT 1',
        [clientId, uniqueKey]
      );
      if (!exists.rows.length) break;
      uniqueKey = `${newKey}_${suffix++}`;
    }

    // Get max sort_order
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM order_statuses WHERE client_id = $1',
      [clientId]
    );

    const result = await pool.query(
      `INSERT INTO order_statuses (client_id, name, key, color, icon, sort_order, counts_as_revenue)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, key, color, icon, sort_order, is_default, counts_as_revenue`,
      [clientId, trimmedName, uniqueKey, color || '#6b7280', icon || '●', (maxOrder.rows[0].max_order || 0) + 1, counts_as_revenue || false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Create order status error:", error);
    res.status(500).json({ error: "Failed to create order status" });
  }
};

/**
 * Update a custom order status
 * PATCH /api/client/order-statuses/:id
 */
export const updateCustomOrderStatus: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    const statusId = req.params.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { name, color, icon, sort_order, counts_as_revenue } = req.body;

    const result = await pool.query(
      `UPDATE order_statuses 
       SET name = COALESCE($1, name),
           color = COALESCE($2, color),
           icon = COALESCE($3, icon),
           sort_order = COALESCE($4, sort_order),
           counts_as_revenue = COALESCE($5, counts_as_revenue),
           updated_at = NOW()
       WHERE id = $6 AND client_id = $7
       RETURNING id, name, color, icon, sort_order, is_default, counts_as_revenue`,
      [name, color, icon, sort_order, counts_as_revenue, statusId, clientId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Status not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

/**
 * Delete a custom order status
 * DELETE /api/client/order-statuses/:id
 */
export const deleteOrderStatus: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    const statusId = req.params.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // The 4 core statuses are permanently locked; all others (including restored presets) can be removed
    const CORE_LOCKED = ['pending', 'confirmed', 'at_delivery', 'completed'];

    const checkResult = await pool.query(
      'SELECT is_system, key FROM order_statuses WHERE id = $1 AND client_id = $2',
      [statusId, clientId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Status not found" });
      return;
    }

    const { is_system, key } = checkResult.rows[0];
    if (is_system && CORE_LOCKED.includes(key)) {
      res.status(400).json({ error: "Core statuses (pending, confirmed, at_delivery, completed) cannot be removed." });
      return;
    }

    const result = await pool.query(
      'DELETE FROM order_statuses WHERE id = $1 AND client_id = $2 RETURNING id',
      [statusId, clientId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Status not found or cannot delete system status" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete order status error:", error);
    res.status(500).json({ error: "Failed to delete order status" });
  }
};

/**
 * Get count of new orders since a given timestamp
 * GET /api/orders/new-count?since=ISO_TIMESTAMP
 */
export const getNewOrdersCount: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const since = req.query.since as string | undefined;
    
    let query: string;
    let params: any[];

    if (since) {
      // Count orders created since the given timestamp
      query = `SELECT COUNT(*)::int AS count FROM store_orders WHERE client_id = $1 AND created_at > $2`;
      params = [clientId, since];
    } else {
      // Count all pending orders if no timestamp provided
      query = `SELECT COUNT(*)::int AS count FROM store_orders WHERE client_id = $1 AND status = 'pending'`;
      params = [clientId];
    }

    const result = await pool.query(query, params);
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (error) {
    console.error("Get new orders count error:", error);
    res.status(500).json({ error: "Failed to get new orders count" });
  }
};

/**
 * Assess fraud risk for a specific order
 * GET /api/orders/:id/risk
 */
export const getOrderRisk: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT customer_phone, customer_address FROM store_orders WHERE id = $1 AND client_id = $2`,
      [orderId, clientId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const order = orderResult.rows[0];
    const risk = await assessOrderRisk(clientId, order.customer_phone, order.customer_address);

    res.json({
      order_id: orderId,
      ...risk
    });
  } catch (error) {
    console.error("Get order risk error:", error);
    res.status(500).json({ error: "Failed to assess order risk" });
  }
};

/**
 * Get all high-risk pending orders
 * GET /api/orders/high-risk
 */
export const getHighRiskOrdersHandler: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawOrders = await getHighRiskOrders(clientId);
    
    // Calculate full risk assessment for each order
    const ordersWithRisk = await Promise.all(
      rawOrders.map(async (order) => {
        const risk = await assessOrderRisk(clientId, order.customer_phone, order.customer_address);
        return {
          order_id: order.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          total_price: order.total_price,
          created_at: order.created_at,
          risk: {
            score: risk.score,
            level: risk.level,
            flags: risk.flags,
            recommendation: risk.recommendation,
            history: {
              total_orders: risk.phoneHistory.totalOrders,
              fake_orders: risk.phoneHistory.fakeOrders,
              returned_orders: risk.phoneHistory.returnedOrders,
              cancelled_orders: risk.phoneHistory.cancelledOrders,
              no_answer_orders: risk.phoneHistory.noAnswerOrders,
              completed_orders: risk.phoneHistory.completedOrders,
            }
          }
        };
      })
    );

    // Filter to only return orders with risk score > 25
    const highRiskOnly = ordersWithRisk.filter(o => o.risk.score > 25);
    
    res.json({ orders: highRiskOnly });
  } catch (error) {
    console.error("Get high-risk orders error:", error);
    res.status(500).json({ error: "Failed to get high-risk orders" });
  }
};

/**
 * Assess risk for a phone number (without creating order)
 * POST /api/orders/check-risk
 */
export const checkPhoneRisk: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { phone, address } = req.body;
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    const risk = await assessOrderRisk(clientId, phone.trim(), address?.trim() || null);
    res.json(risk);
  } catch (error) {
    console.error("Check phone risk error:", error);
    res.status(500).json({ error: "Failed to check risk" });
  }
};
