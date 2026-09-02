/**
 * Store Memory Worker — Daily snapshots + customer profile sync
 *
 * Runs once daily (or on-demand) to:
 * 1. Capture daily store metrics → store_daily_snapshots
 * 2. Build/update customer_profiles from order history
 * 3. Clean expired ai_store_memory entries
 */

import { ensureConnection } from './database';

const TABLES = [
  'store_daily_snapshots',
  'customer_profiles',
  'ai_store_memory',
  'weekly_insights',
];

async function tablesExist(p: any): Promise<boolean> {
  try {
    const res = await p.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'store_daily_snapshots' LIMIT 1`
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// DAILY SNAPSHOT — Capture today's metrics for a store
// ═══════════════════════════════════════════════════════════════

export async function captureDailySnapshot(clientId: number, date?: string): Promise<void> {
  const p = await ensureConnection();
  const snapshotDate = date || new Date().toISOString().slice(0, 10);

  try {
    const [ordersRes, revenueRes, productsRes, customersRes, deliveryRes] = await Promise.all([
      // Order counts by status
      p.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COUNT(*) FILTER (WHERE status = 'fake') as fake
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL
          AND DATE(created_at) = $2
      `, [clientId, snapshotDate]),

      // Revenue
      p.query(`
        SELECT COALESCE(SUM(total_price), 0) as revenue,
               COUNT(*) as order_count
        FROM store_orders
        WHERE client_id = $1 AND status != 'cancelled' AND deleted_at IS NULL
          AND DATE(created_at) = $2
      `, [clientId, snapshotDate]),

      // Product counts
      p.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'active' AND stock_quantity = 0) as out_of_stock,
          COUNT(*) FILTER (WHERE status = 'active' AND stock_quantity > 0 AND stock_quantity <= 5) as low_stock
        FROM client_store_products
        WHERE client_id = $1
      `, [clientId]),

      // Customer metrics (new vs returning on this date)
      p.query(`
        WITH today_customers AS (
          SELECT customer_phone, MIN(created_at) as first_order
          FROM store_orders
          WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone IS NOT NULL
          GROUP BY customer_phone
        )
        SELECT
          COUNT(*) FILTER (WHERE first_order::date = $2) as new_customers,
          COUNT(*) FILTER (WHERE first_order::date < $2) as returning_customers,
          COUNT(DISTINCT customer_phone) as unique_phones
        FROM today_customers
        WHERE customer_phone IN (
          SELECT DISTINCT customer_phone FROM store_orders
          WHERE client_id = $1 AND deleted_at IS NULL AND DATE(created_at) = $2 AND customer_phone IS NOT NULL
        )
      `, [clientId, snapshotDate]),

      // Delivery type breakdown
      p.query(`
        SELECT
          COUNT(*) FILTER (WHERE delivery_type = 'home') as home,
          COUNT(*) FILTER (WHERE delivery_type = 'desk') as desk
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL AND DATE(created_at) = $2
      `, [clientId, snapshotDate]),
    ]);

    const o = ordersRes.rows[0];
    const r = revenueRes.rows[0];
    const pr = productsRes.rows[0];
    const c = customersRes.rows[0];
    const d = deliveryRes.rows[0];
    const avgOrder = Number(r.order_count) > 0 ? Number(r.revenue) / Number(r.order_count) : 0;

    await p.query(`
      INSERT INTO store_daily_snapshots (
        client_id, snapshot_date,
        total_orders, pending_orders, delivered_orders, cancelled_orders, fake_orders,
        revenue, avg_order_value,
        active_products, out_of_stock, low_stock,
        new_customers, returning_customers, unique_phones,
        home_deliveries, desk_deliveries
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (client_id, snapshot_date) DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        pending_orders = EXCLUDED.pending_orders,
        delivered_orders = EXCLUDED.delivered_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        fake_orders = EXCLUDED.fake_orders,
        revenue = EXCLUDED.revenue,
        avg_order_value = EXCLUDED.avg_order_value,
        active_products = EXCLUDED.active_products,
        out_of_stock = EXCLUDED.out_of_stock,
        low_stock = EXCLUDED.low_stock,
        new_customers = EXCLUDED.new_customers,
        returning_customers = EXCLUDED.returning_customers,
        unique_phones = EXCLUDED.unique_phones,
        home_deliveries = EXCLUDED.home_deliveries,
        desk_deliveries = EXCLUDED.desk_deliveries
      `, [
        clientId, snapshotDate,
        o.total, o.pending, o.delivered, o.cancelled, o.fake,
        r.revenue, avgOrder,
        pr.active, pr.out_of_stock, pr.low_stock,
        c.new_customers, c.returning_customers, c.unique_phones,
        d.home, d.desk,
      ]);

    console.log(`[StoreMemory] Snapshot captured for client ${clientId} on ${snapshotDate}`);
  } catch (err) {
    console.error(`[StoreMemory] Snapshot error for client ${clientId}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER PROFILE SYNC — Build 360° customer view from orders
// ═══════════════════════════════════════════════════════════════

export async function syncCustomerProfiles(clientId: number): Promise<number> {
  const p = await ensureConnection();

  try {
    // Aggregate order history into customer_profiles
    const result = await p.query(`
      WITH customer_stats AS (
        SELECT
          customer_phone,
          customer_name,
          COUNT(*) as total_orders,
          SUM(total_price) as total_spent,
          AVG(total_price) as avg_order_value,
          MIN(created_at) as first_order,
          MAX(created_at) as last_order,
          MODE() WITHIN GROUP (ORDER BY wilaya) as preferred_wilaya
        FROM store_orders
        WHERE client_id = $1
          AND deleted_at IS NULL
          AND customer_phone IS NOT NULL
          AND customer_phone != ''
        GROUP BY customer_phone, customer_name
      ),
      order_gaps AS (
        SELECT
          customer_phone,
          AVG(gap) as avg_days_between
        FROM (
          SELECT
            customer_phone,
            created_at - LAG(created_at) OVER (PARTITION BY customer_phone ORDER BY created_at) as gap
          FROM store_orders
          WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone IS NOT NULL
        ) sub
        WHERE gap IS NOT NULL
        GROUP BY customer_phone
      ),
      category_prefs AS (
        SELECT
          o.customer_phone,
          ARRAY_AGG(DISTINCT p.category) FILTER (WHERE p.category IS NOT NULL) as categories
        FROM store_orders o
        JOIN client_store_products p ON o.product_id = p.id AND p.client_id = $1
        WHERE o.client_id = $1 AND o.deleted_at IS NULL AND o.customer_phone IS NOT NULL
        GROUP BY o.customer_phone
      )
      INSERT INTO customer_profiles (
        client_id, store_id, customer_phone, customer_name,
        total_orders, total_spent, avg_order_value,
        first_order_date, last_order_date, days_between_orders,
        preferred_wilaya, preferred_categories,
        engagement_score, segment, lifetime_value,
        updated_at
      )
      SELECT
        $1,
        (SELECT id FROM client_store_settings WHERE client_id = $1 LIMIT 1),
        cs.customer_phone,
        cs.customer_name,
        cs.total_orders,
        cs.total_spent,
        cs.avg_order_value,
        cs.first_order,
        cs.last_order,
        COALESCE(og.avg_days_between, NULL),
        cs.preferred_wilaya,
        COALESCE(cp.categories, '{}'),
        -- Engagement: based on recency and frequency
        GREATEST(0, LEAST(100,
          CASE
            WHEN cs.last_order > NOW() - INTERVAL '7 days' THEN 90
            WHEN cs.last_order > NOW() - INTERVAL '30 days' THEN 70
            WHEN cs.last_order > NOW() - INTERVAL '90 days' THEN 40
            ELSE 10
          END +
          GREATEST(0, LEAST(30, cs.total_orders * 3))
        )),
        -- Segment
        CASE
          WHEN cs.total_orders >= 10 AND cs.total_spent > 50000 THEN 'vip'
          WHEN cs.last_order < NOW() - INTERVAL '60 days' THEN 'at_risk'
          WHEN cs.last_order < NOW() - INTERVAL '120 days' THEN 'dormant'
          WHEN cs.total_orders >= 3 THEN 'regular'
          ELSE 'new'
        END,
        cs.total_spent,
        NOW()
      FROM customer_stats cs
      LEFT JOIN order_gaps og ON og.customer_phone = cs.customer_phone
      LEFT JOIN category_prefs cp ON cp.customer_phone = cs.customer_phone
      ON CONFLICT (client_id, customer_phone) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        total_orders = EXCLUDED.total_orders,
        total_spent = EXCLUDED.total_spent,
        avg_order_value = EXCLUDED.avg_order_value,
        first_order_date = EXCLUDED.first_order_date,
        last_order_date = EXCLUDED.last_order_date,
        days_between_orders = EXCLUDED.days_between_orders,
        preferred_wilaya = EXCLUDED.preferred_wilaya,
        preferred_categories = EXCLUDED.preferred_categories,
        engagement_score = EXCLUDED.engagement_score,
        segment = EXCLUDED.segment,
        lifetime_value = EXCLUDED.lifetime_value,
        updated_at = NOW()
    `, [clientId]);

    const count = result.rowCount || 0;
    console.log(`[StoreMemory] Synced ${count} customer profiles for client ${clientId}`);
    return count;
  } catch (err) {
    console.error(`[StoreMemory] Profile sync error for client ${clientId}:`, err);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// TREND ANALYSIS — Compare periods for the AI to use
// ═══════════════════════════════════════════════════════════════

export interface TrendData {
  revenueThisWeek: number;
  revenueLastWeek: number;
  revenueChangePct: number;
  ordersThisWeek: number;
  ordersLastWeek: number;
  ordersChangePct: number;
  topProductsThisWeek: { title: string; orders: number; revenue: number }[];
  topCustomersThisWeek: { phone: string; name: string; orders: number; spent: number }[];
  avgOrderValue: number;
  conversionTrend: 'up' | 'down' | 'stable';
}

export async function getStoreTrends(clientId: number): Promise<TrendData | null> {
  const p = await ensureConnection();

  try {
    const [thisWeek, lastWeek, topProducts, topCustomers] = await Promise.all([
      p.query(`
        SELECT COUNT(*) as orders, COALESCE(SUM(total_price), 0) as revenue
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL AND status != 'cancelled'
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      `, [clientId]),
      p.query(`
        SELECT COUNT(*) as orders, COALESCE(SUM(total_price), 0) as revenue
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL AND status != 'cancelled'
          AND created_at >= CURRENT_DATE - INTERVAL '14 days'
          AND created_at < CURRENT_DATE - INTERVAL '7 days'
      `, [clientId]),
      p.query(`
        SELECT p.title, COUNT(o.id) as orders, SUM(o.total_price) as revenue
        FROM store_orders o
        JOIN client_store_products p ON o.product_id = p.id AND p.client_id = $1
        WHERE o.client_id = $1 AND o.deleted_at IS NULL AND o.status != 'cancelled'
          AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY p.title ORDER BY revenue DESC LIMIT 5
      `, [clientId]),
      p.query(`
        SELECT customer_phone, customer_name, COUNT(*) as orders, SUM(total_price) as spent
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL AND status != 'cancelled'
          AND customer_phone IS NOT NULL
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY customer_phone, customer_name
        ORDER BY spent DESC LIMIT 5
      `, [clientId]),
    ]);

    const tw = thisWeek.rows[0];
    const lw = lastWeek.rows[0];
    const revChange = Number(lw.revenue) > 0 ? ((Number(tw.revenue) - Number(lw.revenue)) / Number(lw.revenue)) * 100 : 0;
    const ordChange = Number(lw.orders) > 0 ? ((Number(tw.orders) - Number(lw.orders)) / Number(lw.orders)) * 100 : 0;
    const avgOrder = Number(tw.orders) > 0 ? Number(tw.revenue) / Number(tw.orders) : 0;

    return {
      revenueThisWeek: Number(tw.revenue),
      revenueLastWeek: Number(lw.revenue),
      revenueChangePct: Math.round(revChange * 10) / 10,
      ordersThisWeek: Number(tw.orders),
      ordersLastWeek: Number(lw.orders),
      ordersChangePct: Math.round(ordChange * 10) / 10,
      topProductsThisWeek: topProducts.rows,
      topCustomersThisWeek: topCustomers.rows,
      avgOrderValue: Math.round(avgOrder),
      conversionTrend: revChange > 5 ? 'up' : revChange < -5 ? 'down' : 'stable',
    };
  } catch (err) {
    console.error(`[StoreMemory] Trend error for client ${clientId}:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// MEMORY CRUD — Store/retrieve AI-learned facts
// ═══════════════════════════════════════════════════════════════

export async function setMemory(
  clientId: number,
  category: string,
  key: string,
  value: string,
  confidence: number = 0.8,
  source: string = 'observed'
): Promise<void> {
  const p = await ensureConnection();
  await p.query(`
    INSERT INTO ai_store_memory (client_id, category, key, value, confidence, source, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (client_id, category, key) DO UPDATE SET
      value = EXCLUDED.value,
      confidence = GREATEST(ai_store_memory.confidence, EXCLUDED.confidence),
      source = EXCLUDED.source,
      updated_at = NOW()
  `, [clientId, category, key, value, confidence, source]);
}

export async function getMemory(
  clientId: number,
  category?: string
): Promise<{ key: string; value: string; confidence: number; source: string }[]> {
  const p = await ensureConnection();
  let sql = `SELECT key, value, confidence, source FROM ai_store_memory WHERE client_id = $1`;
  const params: any[] = [clientId];

  if (category) {
    sql += ` AND category = $2`;
    params.push(category);
  }

  sql += ` ORDER BY confidence DESC, updated_at DESC`;
  const res = await p.query(sql, params);
  return res.rows;
}

// ═══════════════════════════════════════════════════════════════
// RUN FOR ALL STORES — Called by scheduler
// ═══════════════════════════════════════════════════════════════

export async function runDailySnapshots(): Promise<void> {
  const p = await ensureConnection();

  if (!(await tablesExist(p))) {
    console.log('[StoreMemory] Tables not yet created, skipping');
    return;
  }

  const clients = await p.query(`SELECT id FROM clients WHERE status = 'active'`);
  console.log(`[StoreMemory] Capturing daily snapshots for ${clients.rows.length} stores`);

  for (const row of clients.rows) {
    await captureDailySnapshot(row.id);
    await syncCustomerProfiles(row.id);
  }

  console.log('[StoreMemory] Daily snapshot run complete');
}
