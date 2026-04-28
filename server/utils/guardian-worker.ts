/**
 * Guardian Worker
 * Background worker that scans every registered store every 30 minutes,
 * detects health issues, and persists AI-generated alerts via AlertService.
 *
 * - Runs server-side only
 * - Each alert is deduplicated within a 6-hour window (no spam)
 * - LLM is called only when a new alert passes deduplication (cost-efficient)
 * - Tenant-isolated: each client only sees their own alerts
 * - Admin account is never scanned (no store, no orders)
 */

import type { Pool } from 'pg';
import { generateText } from '../services/gemini';
import {
  checkAndInsertAlert,
  ensureDefaultThresholds,
  getThresholds,
} from './alert-service';
import { ensureConnection } from './database';

const WORKER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let workerInterval: NodeJS.Timeout | null = null;

// ─── Guardian prompt builder ────────────────────────────────────────────────

function buildGuardianPrompt(
  type: string,
  storeName: string,
  metadata: Record<string, unknown>
): string {
  const metaStr = Object.entries(metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return `You are EcoPro Business Guardian. Write a short, friendly 2-sentence alert for a store owner.
Rules:
- Be specific — use the exact numbers provided.
- End with one clear dashboard action they can take RIGHT NOW (e.g. "Go to your Orders page to confirm them.").
- No technical jargon. No mentions of APIs, databases, or code.
- Do NOT start with "Alert:" or any label.
- Respond in French (default for Algerian market). If the store name is in Arabic or Darija, switch to Arabic/Darija accordingly.

Store name: "${storeName}"
Alert type: ${type}
Data: ${metaStr}

Write the alert message now:`;
}

// ─── Core scan for a single client ─────────────────────────────────────────

async function scanClient(
  pool: Pool,
  clientId: number,
  storeName: string
): Promise<void> {
  // Seed default thresholds if this client has never been scanned before
  await ensureDefaultThresholds(pool, clientId).catch(() => {});
  const thresholds = await getThresholds(pool, clientId).catch(() => ({
    stale_pending_hours: 24,
    fake_order_week: 5,
    low_stock_enabled: 1,
    sub_expiry_days: 5,
  }));

  // Run all 7 checks in parallel
  const [
    stalePendingRes,
    outOfStockRes,
    lowStockRes,
    subRes,
    fakeOrderRes,
    botRes,
    deliveryGapRes,
  ] = await Promise.all([
    // 1. Stale pending orders
    pool.query(
      `SELECT COUNT(*) as count FROM store_orders
       WHERE client_id = $1 AND status = 'pending' AND deleted_at IS NULL
         AND created_at < NOW() - ($2 || ' hours')::INTERVAL`,
      [clientId, String(thresholds.stale_pending_hours)]
    ).catch(() => ({ rows: [{ count: 0 }] })),

    // 2. Out-of-stock active products
    pool.query(
      `SELECT COUNT(*) as count FROM store_products
       WHERE client_id = $1 AND stock = 0 AND status = 'active'`,
      [clientId]
    ).catch(() => ({ rows: [{ count: 0 }] })),

    // 3. Inventory items below reorder level (only if feature enabled)
    thresholds.low_stock_enabled
      ? pool.query(
          `SELECT COUNT(*) as count FROM client_stock_products
           WHERE client_id = $1 AND quantity > 0 AND quantity <= reorder_level AND status = 'active'`,
          [clientId]
        ).catch(() => ({ rows: [{ count: 0 }] }))
      : Promise.resolve({ rows: [{ count: 0 }] }),

    // 4. Subscription expiry
    pool.query(
      `SELECT status, trial_ends_at, current_period_end
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [clientId]
    ).catch(() => ({ rows: [] as any[] })),

    // 5. Fake/duplicate order spike this week
    pool.query(
      `SELECT COUNT(*) as count FROM store_orders
       WHERE client_id = $1 AND deleted_at IS NULL
         AND status IN ('fake','duplicate')
         AND created_at > NOW() - INTERVAL '7 days'`,
      [clientId]
    ).catch(() => ({ rows: [{ count: 0 }] })),

    // 6. Bot disabled while orders are arriving
    pool.query(
      `SELECT
         (SELECT enabled FROM bot_settings WHERE client_id = $1 LIMIT 1) AS bot_enabled,
         (SELECT COUNT(*) FROM store_orders
          WHERE client_id = $1 AND deleted_at IS NULL
            AND created_at > NOW() - INTERVAL '24 hours') AS recent_orders`,
      [clientId]
    ).catch(() => ({ rows: [{ bot_enabled: true, recent_orders: 0 }] })),

    // 7. Delivery price gaps (wilayas with recent orders but no delivery price)
    pool.query(
      `SELECT COUNT(DISTINCT so.wilaya_id) as count
       FROM store_orders so
       WHERE so.client_id = $1
         AND so.deleted_at IS NULL
         AND so.created_at > NOW() - INTERVAL '7 days'
         AND so.wilaya_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM delivery_prices dp
           WHERE dp.client_id = $1 AND dp.wilaya_id = so.wilaya_id AND dp.is_active = true
         )`,
      [clientId]
    ).catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  // ── Process each check ─────────────────────────────────────────────────

  // 1. Stale pending orders
  const stalePending = parseInt(String(stalePendingRes.rows[0]?.count ?? 0));
  if (stalePending > 0) {
    const meta = { count: stalePending, threshold_hours: thresholds.stale_pending_hours };
    await checkAndInsertAlert(
      pool, clientId, 'stale_orders', 'warning', meta,
      '/dashboard/orders?status=pending',
      () => generateText('store_owner', buildGuardianPrompt('stale_orders', storeName, meta), { storeName }),
      `${stalePending} pending orders older than ${thresholds.stale_pending_hours}h`
    ).catch(() => {});
  }

  // 2. Out-of-stock
  const outOfStock = parseInt(String(outOfStockRes.rows[0]?.count ?? 0));
  if (outOfStock > 0) {
    const meta = { count: outOfStock };
    await checkAndInsertAlert(
      pool, clientId, 'out_of_stock', 'warning', meta,
      '/dashboard/products',
      () => generateText('store_owner', buildGuardianPrompt('out_of_stock', storeName, meta), { storeName }),
      `${outOfStock} active products with stock = 0`
    ).catch(() => {});
  }

  // 3. Low stock
  const lowStock = parseInt(String(lowStockRes.rows[0]?.count ?? 0));
  if (lowStock > 0) {
    const meta = { count: lowStock };
    await checkAndInsertAlert(
      pool, clientId, 'low_stock', 'info', meta,
      '/dashboard/stock',
      () => generateText('store_owner', buildGuardianPrompt('low_stock', storeName, meta), { storeName }),
      `${lowStock} inventory items below reorder level`
    ).catch(() => {});
  }

  // 4. Subscription expiry
  const sub = subRes.rows[0];
  if (sub) {
    const endDate = sub.status === 'trial'
      ? (sub.trial_ends_at ? new Date(sub.trial_ends_at) : null)
      : (sub.current_period_end ? new Date(sub.current_period_end) : null);
    if (endDate) {
      const daysLeft = Math.floor((endDate.getTime() - Date.now()) / 86_400_000);
      if (daysLeft >= 0 && daysLeft <= thresholds.sub_expiry_days) {
        const meta = { daysLeft, tier: sub.status };
        await checkAndInsertAlert(
          pool, clientId, 'subscription_expiry', 'urgent', meta,
          '/dashboard/billing',
          () => generateText('store_owner', buildGuardianPrompt('subscription_expiry', storeName, meta), { storeName }),
          `${sub.status} expires in ${daysLeft} days`
        ).catch(() => {});
      }
    }
  }

  // 5. Fake/duplicate spike
  const fakeCount = parseInt(String(fakeOrderRes.rows[0]?.count ?? 0));
  if (fakeCount >= thresholds.fake_order_week) {
    const meta = { count: fakeCount, threshold: thresholds.fake_order_week };
    await checkAndInsertAlert(
      pool, clientId, 'fake_order_spike', 'warning', meta,
      '/dashboard/orders',
      () => generateText('store_owner', buildGuardianPrompt('fake_order_spike', storeName, meta), { storeName }),
      `${fakeCount} fake/duplicate orders in last 7 days (threshold: ${thresholds.fake_order_week})`
    ).catch(() => {});
  }

  // 6. Bot disabled with active orders
  const botEnabled  = botRes.rows[0]?.bot_enabled ?? true;
  const recentOrders = parseInt(String(botRes.rows[0]?.recent_orders ?? 0));
  if (!botEnabled && recentOrders > 0) {
    const meta = { recent_orders: recentOrders };
    await checkAndInsertAlert(
      pool, clientId, 'bot_disabled', 'warning', meta,
      '/dashboard/bot',
      () => generateText('store_owner', buildGuardianPrompt('bot_disabled', storeName, meta), { storeName }),
      `Bot disabled, ${recentOrders} orders in last 24h`
    ).catch(() => {});
  }

  // 7. Delivery gaps
  const gapWilayas = parseInt(String(deliveryGapRes.rows[0]?.count ?? 0));
  if (gapWilayas > 0) {
    const meta = { missing_wilayas: gapWilayas };
    await checkAndInsertAlert(
      pool, clientId, 'delivery_gap', 'info', meta,
      '/dashboard/delivery',
      () => generateText('store_owner', buildGuardianPrompt('delivery_gap', storeName, meta), { storeName }),
      `${gapWilayas} wilaya(s) placing orders with no delivery price configured`
    ).catch(() => {});
  }
}

// ─── Worker tick ────────────────────────────────────────────────────────────

async function runGuardianCycle(): Promise<void> {
  let pool: any;
  try {
    pool = await ensureConnection();
  } catch {
    console.error('[Guardian] Cannot reach database — skipping cycle');
    return;
  }

  // Fetch all registered client accounts (store owners only, not admins)
  let clients: { id: number; store_name: string }[] = [];
  try {
    const res = await pool.query(
      `SELECT c.id, COALESCE(css.store_name, c.name, 'My Store') AS store_name
       FROM clients c
       LEFT JOIN client_store_settings css ON css.client_id = c.id
       ORDER BY c.id ASC`
    );
    clients = res.rows;
  } catch (err) {
    console.error('[Guardian] Failed to fetch clients:', err);
    return;
  }

  if (clients.length === 0) return;
  console.log(`[Guardian] Scanning ${clients.length} store(s)…`);

  // Scan clients sequentially to avoid hammering the DB + Gemini rate limits
  for (const client of clients) {
    try {
      await scanClient(pool, client.id, client.store_name);
    } catch (err) {
      // One failing client should never abort the entire cycle
      console.error(`[Guardian] Error scanning client ${client.id}:`, err);
    }
  }

  console.log('[Guardian] Cycle complete.');
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function startGuardianWorker(): void {
  if (workerInterval) return; // already running
  console.log('[Guardian] Worker started (interval: 30 min)');
  // Run once immediately at startup, then every 30 minutes
  void runGuardianCycle();
  workerInterval = setInterval(() => { void runGuardianCycle(); }, WORKER_INTERVAL_MS);
}

export function stopGuardianWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Guardian] Worker stopped');
  }
}
