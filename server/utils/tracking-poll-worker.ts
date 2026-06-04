/**
 * Tracking Poll Worker
 * Background worker that polls courier APIs for delivery status updates.
 * Used for couriers that DON'T support webhooks (Anderson, Ecotrack, DHD, Noest, Maystro, MDM, Ecom, Elogistia).
 *
 * Runs every 10 minutes, queries active shipments, and updates delivery_status.
 */

import { pool } from './database';
import { decryptData } from './encryption';
import { getCourierService } from '../services/courier-service';
import { sendDeliveryStatusNotification } from './bot-messaging';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let pollWorkerInterval: NodeJS.Timeout | null = null;

// Couriers that support webhooks (no polling needed)
const WEBHOOK_COURIERS = new Set([
  'yalidine',
  'yalidine express',
  'guepex',
  'zr express',
  'zr-express',
  'zrexpress',
  'zr express official',
  'zimou',
  'zimou express',
  'zimou-express',
  'dolivroo',
]);

interface PollableOrder {
  order_id: number;
  client_id: number;
  tracking_number: string;
  delivery_status: string | null;
  company_name: string;
  customer_phone: string | null;
  customer_name: string | null;
}

/**
 * Fetch all orders that have a tracking number and use a non-webhook courier
 */
async function fetchPollableOrders(): Promise<PollableOrder[]> {
  const result = await pool.query(`
    SELECT
      so.id AS order_id,
      so.client_id,
      so.tracking_number,
      so.delivery_status,
      dc.name AS company_name,
      so.customer_phone,
      so.customer_name
    FROM store_orders so
    JOIN delivery_companies dc ON dc.id = so.delivery_company_id
    WHERE so.tracking_number IS NOT NULL
      AND so.tracking_number != ''
      AND dc.features->>'supports_webhooks' = 'false'
      AND so.status NOT IN ('cancelled', 'returned', 'delivered', 'completed')
      AND so.delivery_status NOT IN ('delivered', 'returned', 'cancelled', 'failed')
  `);
  return result.rows;
}

/**
 * Get API credentials for a client + company
 */
async function getCredentials(clientId: number, companyName: string): Promise<{ apiKey: string; secondary?: string } | null> {
  const result = await pool.query(`
    SELECT api_key_encrypted, api_secret_encrypted, account_number, merchant_id
    FROM delivery_integrations di
    JOIN delivery_companies dc ON dc.id = di.delivery_company_id
    WHERE di.client_id = $1 AND dc.name = $2 AND di.is_enabled = true
    LIMIT 1
  `, [clientId, companyName]);

  if (!result.rows.length) return null;

  const row = result.rows[0];
  try {
    const apiKey = decryptData(row.api_key_encrypted);
    // Secondary credential: account_number (Noest GUID), merchant_id (Maystro Store ID), or api_secret
    const secondary = row.account_number || row.merchant_id || (row.api_secret_encrypted ? decryptData(row.api_secret_encrypted) : undefined);
    return { apiKey, secondary };
  } catch {
    return null;
  }
}

/**
 * Poll a single order's status
 */
async function pollOrderStatus(order: PollableOrder): Promise<void> {
  try {
    const service = getCourierService(order.company_name);
    if (!service) {
      console.warn(`[TrackingPoll] No service for company: ${order.company_name}`);
      return;
    }

    const creds = await getCredentials(order.client_id, order.company_name);
    if (!creds) {
      console.warn(`[TrackingPoll] No credentials for order ${order.order_id}, company ${order.company_name}`);
      return;
    }

    // Get status from courier API
    const statusResponse = await service.getStatus(
      order.tracking_number,
      creds.apiKey,
      creds.secondary
    );

    if (statusResponse.error) {
      console.warn(`[TrackingPoll] Status error for order ${order.order_id}: ${statusResponse.error}`);
      return;
    }

    const newStatus = statusResponse.status;
    if (!newStatus || newStatus === 'unknown') return;

    // Only update if status changed
    if (newStatus === order.delivery_status) return;

    console.log(`[TrackingPoll] Order ${order.order_id}: ${order.delivery_status} → ${newStatus}`);

    // Update delivery_status
    await pool.query(
      `UPDATE store_orders SET delivery_status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, order.order_id]
    );

    // Save delivery event
    await pool.query(
      `INSERT INTO delivery_events
       (order_id, client_id, tracking_number, event_type, event_status, description, location, created_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, $6, NOW())`,
      [
        order.order_id,
        order.client_id,
        order.tracking_number,
        newStatus,
        statusResponse.description || statusResponse.status,
        statusResponse.location || null,
      ]
    );

    // Send customer notification (fire-and-forget)
    if (order.customer_phone) {
      sendDeliveryStatusNotification({
        orderId: order.order_id,
        clientId: order.client_id,
        customerPhone: order.customer_phone,
        customerName: order.customer_name || '',
        trackingNumber: order.tracking_number,
        eventType: newStatus,
        description: statusResponse.description,
        location: statusResponse.location,
      }).catch(err => console.error(`[TrackingPoll] Notification failed for order ${order.order_id}:`, err?.message));
    }

    // Notify store owner
    try {
      await pool.query(
        `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
         VALUES ($1, $2, $3, 'telegram', $4, NOW())`,
        [
          order.order_id,
          order.client_id,
          order.customer_phone || '',
          `📦 تحديث حالة التتبع — الطلب #${order.order_id}\n\nالحالة: ${newStatus}\n${statusResponse.description || ''}\n${statusResponse.location ? `الموقع: ${statusResponse.location}` : ''}\nرقم التتبع: ${order.tracking_number}`,
        ]
      );
    } catch (notifyErr) {
      console.error(`[TrackingPoll] Owner notification failed for order ${order.order_id}:`, notifyErr);
    }
  } catch (err: any) {
    console.error(`[TrackingPoll] Failed to poll order ${order.order_id}:`, err?.message || err);
  }
}

/**
 * Main polling loop — fetch all pollable orders and poll each one
 */
async function pollAllOrders(): Promise<void> {
  try {
    const orders = await fetchPollableOrders();
    if (orders.length === 0) return;

    console.log(`[TrackingPoll] Polling ${orders.length} orders...`);

    // Process in batches of 5 to avoid rate limiting
    for (let i = 0; i < orders.length; i += 5) {
      const batch = orders.slice(i, i + 5);
      await Promise.allSettled(batch.map(order => pollOrderStatus(order)));
    }

    console.log(`[TrackingPoll] Polling complete`);
  } catch (err: any) {
    console.error('[TrackingPoll] Poll cycle error:', err?.message || err);
  }
}

/**
 * Start the tracking poll worker
 */
export function startTrackingPollWorker(options?: { intervalMs?: number }): void {
  if (pollWorkerInterval) {
    console.log('[TrackingPoll] Worker already running');
    return;
  }

  const intervalMs = Math.max(60_000, Number(options?.intervalMs ?? POLL_INTERVAL_MS));
  console.log(`[TrackingPoll] Starting worker (${Math.round(intervalMs / 1000)}s interval)`);

  // Run immediately on start
  pollAllOrders().catch(err => console.error('[TrackingPoll] Worker error:', err));

  pollWorkerInterval = setInterval(() => {
    pollAllOrders().catch(err => console.error('[TrackingPoll] Worker error:', err));
  }, intervalMs);
}

/**
 * Stop the tracking poll worker
 */
export function stopTrackingPollWorker(): void {
  if (!pollWorkerInterval) return;
  clearInterval(pollWorkerInterval);
  pollWorkerInterval = null;
  console.log('[TrackingPoll] Worker stopped');
}
