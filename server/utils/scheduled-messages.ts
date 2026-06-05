/**
 * Scheduled Message Worker
 * Processes scheduled messages (like delayed order confirmations with buttons)
 * Runs on a timer and sends messages when their scheduled time arrives
 */

import { ensureConnection } from './database';
import { sendTelegramMessage } from './bot-messaging';

const PLATFORM_TELEGRAM_BOT_TOKEN = String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim();
const PLATFORM_TELEGRAM_BOT_USERNAME = String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim();
const PLATFORM_TELEGRAM_AVAILABLE = !!PLATFORM_TELEGRAM_BOT_TOKEN && !!PLATFORM_TELEGRAM_BOT_USERNAME;

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Process all pending scheduled messages that are ready to be sent
 */
export async function processScheduledMessages(): Promise<void> {
  try {
    const pool = await ensureConnection();
    
    // Reset any messages stuck in 'processing' from a previous crash (older than 5 minutes)
    await pool.query(
      `UPDATE scheduled_messages SET status = 'pending', updated_at = NOW()
       WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'`
    );

    // Get all pending messages that are past their scheduled time
    // Skip messages older than 24 hours (stale from a previous session / crash)
    const result = await pool.query(
      `SELECT sm.*, COALESCE(bs.telegram_bot_token, $1) AS telegram_bot_token
       FROM scheduled_messages sm
       JOIN bot_settings bs ON sm.client_id = bs.client_id AND bs.enabled = true
       WHERE sm.status = 'pending'
         AND sm.scheduled_at <= NOW()
         AND sm.scheduled_at > NOW() - INTERVAL '24 hours'
         AND (bs.telegram_bot_token IS NOT NULL OR $1 <> '')
       ORDER BY sm.scheduled_at ASC
       LIMIT 50`,
      [PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : '']
    );
    
    if (result.rows.length === 0) {
      return;
    }

    // Claim all fetched messages so they aren't re-processed if the server restarts mid-batch
    const msgIds = result.rows.map((m: any) => m.id);
    await pool.query(
      `UPDATE scheduled_messages SET status = 'processing', updated_at = NOW() WHERE id = ANY($1)`,
      [msgIds]
    );
    
    console.log(`[ScheduledMessages] Processing ${result.rows.length} pending messages`);
    
    for (const msg of result.rows) {
      console.log(`[ScheduledMessages] Processing msg ${msg.id} for order ${msg.order_id}, scheduled_at: ${msg.scheduled_at}, now: ${new Date().toISOString()}`);
      try {
        // If the client is subscription-locked / subscription ended, bots must be OFF.
        // Cancel the message instead of sending.
        try {
          const lockRes = await pool.query(
            `SELECT is_locked, locked_reason, lock_type FROM clients WHERE id = $1`,
            [msg.client_id]
          );
          if (lockRes.rows.length) {
            const row = lockRes.rows[0];
            const lockType = row.lock_type || (typeof row.locked_reason === 'string' && /(subscription|expired|payment|trial|billing)/i.test(row.locked_reason)
              ? 'payment'
              : 'critical');
            if (row.is_locked && lockType === 'payment') {
              await pool.query(
                `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
                [msg.client_id]
              );
              await pool.query(
                `UPDATE scheduled_messages
                 SET status = 'cancelled', error_message = $1, updated_at = NOW()
                 WHERE id = $2`,
                ['ACCOUNT_LOCKED', msg.id]
              );
              continue;
            }
          }

          const subRes = await pool.query(
            `SELECT status, trial_ends_at, current_period_end
             FROM subscriptions
             WHERE user_id = $1`,
            [msg.client_id]
          );
          if (subRes.rows.length) {
            const sub = subRes.rows[0];
            const now = new Date();
            const trialEndOk = sub.status === 'trial' && sub.trial_ends_at && now < new Date(sub.trial_ends_at);
            const activeEndOk = sub.status === 'active' && (!sub.current_period_end || now < new Date(sub.current_period_end));
            const hasAccess = trialEndOk || activeEndOk;

            if (!hasAccess) {
              await pool.query(
                `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
                [msg.client_id]
              );
              await pool.query(
                `UPDATE scheduled_messages
                 SET status = 'cancelled', error_message = $1, updated_at = NOW()
                 WHERE id = $2`,
                ['SUBSCRIPTION_ENDED', msg.id]
              );
              continue;
            }
          }
        } catch (err) {
          console.warn('[ScheduledMessages] Access check failed; proceeding with enabled flag only:', (err as any)?.message || err);
        }

        // Resolve chat id lazily (order can be linked after message is scheduled)
        let chatId: string | null = msg.telegram_chat_id ? String(msg.telegram_chat_id) : null;
        if (!chatId && msg.order_id) {
          const chatRes = await pool.query(
            `SELECT telegram_chat_id
             FROM order_telegram_chats
             WHERE order_id = $1 AND client_id = $2 AND telegram_chat_id IS NOT NULL
             LIMIT 1`,
            [msg.order_id, msg.client_id]
          );
          if (chatRes.rows.length && chatRes.rows[0]?.telegram_chat_id) {
            chatId = String(chatRes.rows[0].telegram_chat_id);
            await pool.query(
              `UPDATE scheduled_messages
               SET telegram_chat_id = $1, updated_at = NOW()
               WHERE id = $2`,
              [chatId, msg.id]
            );
          }
        }

        if (!chatId) {
          // Customer hasn't linked Telegram yet; retry later instead of failing.
          await pool.query(
            `UPDATE scheduled_messages
             SET error_message = $1,
                 scheduled_at = NOW() + INTERVAL '5 minutes',
                 updated_at = NOW()
             WHERE id = $2`,
            ['WAITING_FOR_TELEGRAM_CHAT', msg.id]
          );
          continue;
        }

        // For order confirmation messages, add confirm/cancel buttons
        let replyMarkup: any = undefined;
        
        if (msg.message_type === 'order_confirmation' && msg.order_id) {
          const confirmCallback = `confirm_order_${msg.order_id}_${msg.client_id}`;
          const cancelCallback = `cancel_order_${msg.order_id}_${msg.client_id}`;
          
          replyMarkup = {
            inline_keyboard: [
              [
                { text: '✅ تأكيد الطلب', callback_data: confirmCallback },
                { text: '❌ إلغاء الطلب', callback_data: cancelCallback }
              ]
            ]
          };
        }
        
        // Send the message
        const sendResult = await sendTelegramMessage(
          msg.telegram_bot_token,
          chatId,
          msg.message_content,
          replyMarkup ? { reply_markup: replyMarkup } : undefined
        );
        
        if (sendResult.success) {
          // Mark as sent
          await pool.query(
            `UPDATE scheduled_messages 
             SET status = 'sent', sent_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );
          console.log(`[ScheduledMessages] Sent message ${msg.id} for order ${msg.order_id}`);
        } else {
          // Mark as failed, increment retry count
          const newRetryCount = (msg.retry_count || 0) + 1;
          const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';
          
          // If still pending, reschedule for 1 minute later
          const rescheduleAt = newStatus === 'pending' 
            ? new Date(Date.now() + 60 * 1000).toISOString() 
            : msg.scheduled_at;
          
          await pool.query(
            `UPDATE scheduled_messages 
             SET status = $1, error_message = $2, retry_count = $3, 
                 scheduled_at = $4, updated_at = NOW()
             WHERE id = $5`,
            [newStatus, sendResult.error, newRetryCount, rescheduleAt, msg.id]
          );
          console.log(`[ScheduledMessages] Failed to send message ${msg.id}: ${sendResult.error}`);
        }
      } catch (error) {
        console.error(`[ScheduledMessages] Error processing message ${msg.id}:`, error);
        
        // Mark as failed
        await pool.query(
          `UPDATE scheduled_messages 
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [error instanceof Error ? error.message : String(error), msg.id]
        );
      }
    }
  } catch (error) {
    console.error('[ScheduledMessages] Worker error:', error);
  }
}

/**
 * Process expired orders - auto-change to "didnt_pickup" if:
 * - Order is still "pending"
 * - Confirmation message was sent more than X hours ago
 * - Owner hasn't changed the status
 */
export async function processExpiredOrders(): Promise<void> {
  try {
    const pool = await ensureConnection();
    
    // Get all clients with their auto_expire_hours settings
    const clientsResult = await pool.query(
      `SELECT client_id, auto_expire_hours 
       FROM bot_settings 
       WHERE enabled = true AND auto_expire_hours IS NOT NULL AND auto_expire_hours > 0`
    );
    
    if (clientsResult.rows.length === 0) {
      return;
    }
    
    for (const client of clientsResult.rows) {
      const expireHours = client.auto_expire_hours || 24;
      
      // Find orders that:
      // 1. Belong to this client
      // 2. Are still "pending"
      // 3. Have a confirmation message that was sent more than X hours ago
      const expiredOrders = await pool.query(
        `SELECT so.id, so.customer_name, sm.sent_at
         FROM store_orders so
         INNER JOIN scheduled_messages sm ON so.id = sm.order_id
         WHERE so.client_id = $1
           AND so.status = 'pending'
           AND sm.status = 'sent'
           AND sm.message_type = 'order_confirmation'
           AND sm.sent_at < NOW() - INTERVAL '1 hour' * $2`,
        [client.client_id, expireHours]
      );
      
      if (expiredOrders.rows.length > 0) {
        console.log(`[AutoExpire] Found ${expiredOrders.rows.length} expired orders for client ${client.client_id}`);
        
        for (const order of expiredOrders.rows) {
          // Update order status to "didnt_pickup"
          await pool.query(
            `UPDATE store_orders SET status = 'didnt_pickup', updated_at = NOW() WHERE id = $1`,
            [order.id]
          );
          console.log(`[AutoExpire] Order ${order.id} auto-expired to didnt_pickup (no response after ${expireHours}h)`);
        }
      }
    }
  } catch (error) {
    console.error('[AutoExpire] Error processing expired orders:', error);
  }
}

/**
 * Start the scheduled message worker
 * Runs every 30 seconds to check for messages to send
 * Also checks for expired orders every 5 minutes
 */
let expireCheckCounter = 0;

export function startScheduledMessageWorker(): void {
  if (workerInterval) {
    console.log('[ScheduledMessages] Worker already running');
    return;
  }
  
  console.log('[ScheduledMessages] Starting worker (30s interval)');
  
  // Run immediately on start
  processScheduledMessages().catch(console.error);
  processExpiredOrders().catch(console.error);
  
  // Then run every 30 seconds
  workerInterval = setInterval(() => {
    processScheduledMessages().catch(console.error);
    
    // Check for expired orders every 10 intervals (5 minutes)
    expireCheckCounter++;
    if (expireCheckCounter >= 10) {
      expireCheckCounter = 0;
      processExpiredOrders().catch(console.error);
    }
  }, 30 * 1000);
}

/**
 * Stop the scheduled message worker
 */
export function stopScheduledMessageWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[ScheduledMessages] Worker stopped');
  }
}

/**
 * Cancel a scheduled message (e.g., if order is already confirmed/cancelled)
 */
export async function cancelScheduledMessage(orderId: number): Promise<void> {
  try {
    const pool = await ensureConnection();
    await pool.query(
      `UPDATE scheduled_messages 
       SET status = 'cancelled', updated_at = NOW()
       WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );
    console.log(`[ScheduledMessages] Cancelled pending messages for order ${orderId}`);
  } catch (error) {
    console.error(`[ScheduledMessages] Error cancelling messages for order ${orderId}:`, error);
  }
}
