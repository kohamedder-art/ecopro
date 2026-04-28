import { Pool } from 'pg';
import https from 'https';
import { sendTelegramMessage, replaceTemplateVariables } from './bot-messaging';
import { parseSimpleCallback } from '../routes/telegram';
import { ensureConnection } from './database';

const isProduction = process.env.NODE_ENV === 'production';

let pollerInterval: NodeJS.Timeout | null = null;
let lastUpdateId = -1; // -1 = not initialized yet
let isPolling = false;

interface TelegramUpdate {
  update_id: number;
  message?: any;
  callback_query?: any;
}

/**
 * Answer a Telegram callback queryros 
 */
async function answerTelegramCallbackQuery(opts: { botToken: string; callbackQueryId: string; text?: string }): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${opts.botToken}/answerCallbackQuery`;
    const payload = JSON.stringify({
      callback_query_id: opts.callbackQueryId,
      text: opts.text || 'تم',
      show_alert: false,
    });

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // Acknowledge without error handling
      });
    });

    req.on('error', () => {
      // Ignore errors
    });
    req.write(payload);
    req.end();
  } catch (e) {
    // Ignore
  }
}

/**
 * Fetch pending updates from Telegram using getUpdates
 * This is a fallback when webhooks are not working
 */
async function getTelegramUpdates(botToken: string, offset?: number): Promise<TelegramUpdate[]> {
  return new Promise((resolve) => {
    let url = `https://api.telegram.org/bot${botToken}/getUpdates`;
    if (offset) {
      url += `?offset=${offset}&timeout=0`;
    }

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok && Array.isArray(result.result)) {
            resolve(result.result);
          } else {
            resolve([]);
          }
        } catch (e) {
          console.error('[TelegramPoller] Parse error:', (e as any).message);
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.error('[TelegramPoller] Network error:', err.message);
      resolve([]);
    });
  });
}

/**
 * Process a single Telegram update
 */
async function processTelegramUpdate(pool: Pool, update: TelegramUpdate, botToken: string): Promise<void> {
  try {
    const msg = update.message;
    const cb = update.callback_query;

    if (!msg && !cb) return;

    const chatId = msg?.chat?.id || cb?.message?.chat?.id;
    if (!chatId) return;

    // Handle callback queries (button presses)
    if (cb) {
      const callbackId = cb.id;
      const data = cb.data as string | undefined;

      // Try simple callback format (confirm_order_ID_CLIENTID)
      const simpleCallback = parseSimpleCallback(data);
      if (simpleCallback) {
        const { action, orderId, clientId: cbClientId } = simpleCallback;

        if (action === 'confirm') {
          const upd = await pool.query(
            `UPDATE store_orders SET status = 'confirmed', updated_at = NOW()
             WHERE id = $1 AND client_id = $2 AND status = 'pending'
             RETURNING *`,
            [orderId, cbClientId]
          );

          if (upd.rows.length) {
            await pool.query(
              `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
               VALUES ($1, $2, 'approved', 'telegram', NOW())
               ON CONFLICT DO NOTHING`,
              [orderId, cbClientId]
            );

            if ((global as any).broadcastOrderUpdate) {
              (global as any).broadcastOrderUpdate(upd.rows[0]);
            }

            await answerTelegramCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم التأكيد ✅' });
            await sendTelegramMessage(botToken, String(chatId), '✅ تم تأكيد طلبك!\n\nسنتواصل معك قريباً لترتيب التوصيل. شكراً لثقتك! 🙏');
          }
        }

        if (action === 'cancel') {
          const upd = await pool.query(
            `UPDATE store_orders SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND client_id = $2 AND status = 'pending'
             RETURNING *`,
            [orderId, cbClientId]
          );

          if (upd.rows.length) {
            await pool.query(
              `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
               VALUES ($1, $2, 'declined', 'telegram', NOW())
               ON CONFLICT DO NOTHING`,
              [orderId, cbClientId]
            );

            if ((global as any).broadcastOrderUpdate) {
              (global as any).broadcastOrderUpdate(upd.rows[0]);
            }

            await answerTelegramCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم الإلغاء ❌' });
            await sendTelegramMessage(botToken, String(chatId), '❌ تم إلغاء الطلب.\n\nإذا غيرت رأيك، يمكنك الطلب مجدداً من المتجر.');
          }
        }
      }
      return;
    }

    // Handle regular messages (text)
    if (msg && msg.text) {
      const text = msg.text as string;
      const telegramUserId = msg.from?.id ? String(msg.from.id) : null;

      // Handle /start command with token
      if (text.trim().startsWith('/start')) {
        const parts = text.split(/\s+/);
        const token = parts[1];

        if (token) {
          // First check preconnect tokens (customer connecting before placing order)
          const preconnectRes = await pool.query(
            `SELECT client_id, customer_phone FROM customer_preconnect_tokens
             WHERE token = $1 AND expires_at > NOW()
             LIMIT 1`,
            [token]
          );

          if (preconnectRes.rows.length) {
            const { client_id: preClientId, customer_phone: prePhone } = preconnectRes.rows[0];
            await pool.query(
              `INSERT INTO customer_messaging_ids (client_id, customer_phone, telegram_chat_id, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               ON CONFLICT (client_id, customer_phone)
               DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()`,
              [preClientId, prePhone, String(chatId)]
            );
            await pool.query(
              `UPDATE customer_preconnect_tokens SET used_at = NOW() WHERE token = $1`,
              [token]
            );
            const storeRes = await pool.query(
              `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
              [preClientId]
            );
            const storeName = storeRes.rows[0]?.store_name || 'Store';
            const tplRes = await pool.query(
              `SELECT template_greeting FROM bot_settings WHERE client_id = $1 AND enabled = true LIMIT 1`,
              [preClientId]
            );
            const connectMsg = replaceTemplateVariables(
              String(tplRes.rows[0]?.template_greeting || `مرحباً بك في {storeName}! 🎉\n\n✅ تم ربط تيليجرام بنجاح.\n\nيمكنك الآن إتمام طلبك وسنرسل لك التأكيد هنا! 📦`),
              { storeName, customerName: 'Customer', orderId: 0 }
            );
            await sendTelegramMessage(botToken, String(chatId), connectMsg);
            console.log(`[TelegramPoller] Preconnect /start for client ${preClientId}, phone ${prePhone}`);
            return;
          }

          // Check order-specific link
          const linkRes = await pool.query(
            `SELECT order_id, client_id, customer_phone, customer_name
             FROM order_telegram_links
             WHERE start_token = $1 AND used_at IS NULL
             LIMIT 1`,
            [token]
          );

          if (linkRes.rows.length) {
            const link = linkRes.rows[0];

            // Save connection
            await pool.query(
              `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, created_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id`,
              [link.order_id, link.client_id, String(chatId)]
            );

            await pool.query(
              `INSERT INTO customer_messaging_ids (client_id, customer_phone, telegram_chat_id, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               ON CONFLICT (client_id, customer_phone)
               DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()`,
              [link.client_id, link.customer_phone, String(chatId)]
            );

            await pool.query(
              `UPDATE order_telegram_links SET used_at = NOW() WHERE start_token = $1`,
              [token]
            );

            console.log(`[TelegramPoller] Processed /start for Order #${link.order_id}`);

            // Send welcome message
            const botRes = await pool.query(
              `SELECT template_greeting FROM bot_settings WHERE client_id = $1 AND enabled = true LIMIT 1`,
              [link.client_id]
            );

            const greeting = botRes.rows[0]?.template_greeting || `مرحباً ${link.customer_name}! ✅\n\nتم ربط حسابك بنجاح. سنرسل لك تحديثات طلبك هنا 🚚`;
            await sendTelegramMessage(botToken, String(chatId), greeting);

            // Send order details immediately (late-connect backfill)
            try {
              const orderRes = await pool.query(
                `SELECT o.id, o.customer_name, o.customer_phone, o.shipping_address, o.quantity, o.total_price,
                        p.title AS product_title, s.store_name
                 FROM store_orders o
                 INNER JOIN client_store_settings s ON o.client_id = s.client_id
                 LEFT JOIN client_store_products p ON o.product_id = p.id
                 WHERE o.id = $1 AND o.client_id = $2 LIMIT 1`,
                [link.order_id, link.client_id]
              );
              const row = orderRes.rows[0];
              if (row) {
                const tplRes = await pool.query(
                  `SELECT template_instant_order, template_pin_instructions FROM bot_settings WHERE client_id = $1 AND enabled = true LIMIT 1`,
                  [link.client_id]
                );
                const defaultInstant = `🎉 شكراً لك، ${row.customer_name}!\n\nتم استلام طلبك بنجاح ✅\n\n📦 رقم الطلب: #${row.id}\n📱 المنتج: ${row.product_title || 'Product'}\n💰 السعر: ${row.total_price} دج\n📍 الكمية: ${row.quantity}\n📞 الهاتف: ${row.customer_phone}\n🏠 العنوان: ${row.shipping_address || 'غير محدد'}\n\n⭐ من ${row.store_name}`;
                const defaultPin = `📌 نصيحة مهمة:\n\nاضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!`;
                const orderMsg = replaceTemplateVariables(
                  String(tplRes.rows[0]?.template_instant_order || defaultInstant),
                  {
                    customerName: row.customer_name, productName: row.product_title || 'Product',
                    totalPrice: row.total_price, quantity: row.quantity, orderId: row.id,
                    customerPhone: row.customer_phone, address: row.shipping_address || 'غير محدد',
                    storeName: row.store_name, companyName: row.store_name,
                  }
                );
                await sendTelegramMessage(botToken, String(chatId), orderMsg);
                await sendTelegramMessage(botToken, String(chatId), String(tplRes.rows[0]?.template_pin_instructions || defaultPin));
              }
            } catch (e) {
              console.warn('[TelegramPoller] Failed to send order details after /start:', (e as any).message);
            }
          }
        } else {
          // Plain /start with no token — look up by previous chat_id connection
          const connRes = await pool.query(
            `SELECT DISTINCT client_id, customer_phone FROM customer_messaging_ids
             WHERE telegram_chat_id = $1 LIMIT 1`,
            [String(chatId)]
          );
          if (connRes.rows.length) {
            const { client_id: connClientId, customer_phone: connPhone } = connRes.rows[0];
            const ordersRes = await pool.query(
              `SELECT id, total_price, status FROM store_orders
               WHERE client_id = $1 AND customer_phone = $2
                 AND status IN ('pending', 'confirmed')
                 AND created_at > NOW() - INTERVAL '7 days'
               ORDER BY created_at DESC LIMIT 5`,
              [connClientId, connPhone]
            );
            if (ordersRes.rows.length) {
              const ordersMsg = `📦 طلباتك الحالية:\n\n${ordersRes.rows.map(o =>
                `• الطلب #${o.id} - ${o.total_price} دج (${o.status === 'pending' ? '⏳ قيد الانتظار' : '✅ مؤكد'})`
              ).join('\n')}\n\nسنرسل لك تحديثات قريباً! 🚚`;
              await sendTelegramMessage(botToken, String(chatId), ordersMsg);
            } else {
              await sendTelegramMessage(botToken, String(chatId), 'مرحباً! ✅\n\nلا توجد طلبات نشطة حالياً. يمكنك الطلب من المتجر وسنرسل لك التأكيد هنا.');
            }
          } else {
            await sendTelegramMessage(botToken, String(chatId), 'مرحباً! ✅\n\nلربط طلباتك، يرجى العودة إلى صفحة الدفع في المتجر والضغط على زر ربط تيليجرام.');
          }
        }
      }
    }
  } catch (err) {
    console.error('[TelegramPoller] Error processing update:', (err as any).message);
  }
}

/**
 * Poll for updates from Telegram
 */
async function pollTelegramUpdates(): Promise<void> {
  if (isPolling) return;
  isPolling = true;

  try {
    const pool = await ensureConnection();

    // On first run, initialize lastUpdateId from DB so restarts don't reprocess old updates
    if (lastUpdateId === -1) {
      try {
        const stored = await pool.query(`SELECT value FROM bot_poller_state WHERE key = 'last_update_id' LIMIT 1`);
        lastUpdateId = stored.rows.length ? parseInt(stored.rows[0].value, 10) : 0;
        console.log(`[TelegramPoller] Resumed from update_id ${lastUpdateId}`);
      } catch {
        lastUpdateId = 0;
      }
    }

    const botsRes = await pool.query(
      `SELECT DISTINCT telegram_bot_token FROM bot_settings WHERE enabled = true AND telegram_bot_token IS NOT NULL`
    );

    for (const botRow of botsRes.rows) {
      const botToken = botRow.telegram_bot_token;

      try {
        const updates = await getTelegramUpdates(botToken, lastUpdateId + 1);

        if (updates.length > 0) {
          console.log(`[TelegramPoller] Got ${updates.length} updates for bot`);

          for (const update of updates) {
            await processTelegramUpdate(pool, update, botToken);
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
          }

          // Persist lastUpdateId so restarts resume correctly
          try {
            await pool.query(
              `INSERT INTO bot_poller_state (key, value, updated_at) VALUES ('last_update_id', $1, NOW())
               ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
              [String(lastUpdateId)]
            );
          } catch {
            // Table may not exist yet; non-fatal
          }
        }
      } catch (err) {
        console.error('[TelegramPoller] Error polling bot:', (err as any).message);
      }
    }
  } catch (err) {
    console.error('[TelegramPoller] Error:', (err as any).message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start polling for Telegram updates
 */
export function startTelegramUpdatePoller(options?: { intervalMs?: number }): void {
  if (pollerInterval) {
    console.log('[TelegramPoller] Already running');
    return;
  }

  const intervalMs = options?.intervalMs || 5000; // 5 seconds
  console.log(`[TelegramPoller] Starting (${intervalMs}ms interval)`);

  // Poll immediately, then every interval
  pollTelegramUpdates().catch(console.error);

  pollerInterval = setInterval(() => {
    pollTelegramUpdates().catch(console.error);
  }, intervalMs);
}

/**
 * Stop polling
 */
export function stopTelegramUpdatePoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[TelegramPoller] Stopped');
  }
}
