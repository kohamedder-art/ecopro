import { RequestHandler } from "express";
import { pool } from "../utils/database";

// Cache store_orders columns existence checks (schema rarely changes at runtime)
const storeOrdersColumnCache = new Map<string, boolean>();

async function storeOrdersHasColumn(columnName: string): Promise<boolean> {
  const key = String(columnName);
  if (storeOrdersColumnCache.has(key)) return storeOrdersColumnCache.get(key)!;
  const res = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'store_orders' AND column_name = $1
     LIMIT 1`,
    [key]
  );
  const has = res.rows.length > 0;
  storeOrdersColumnCache.set(key, has);
  return has;
}

// GET /api/dashboard/stats
// Aggregated metrics for the client/vendor dashboard
export const getDashboardStats: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);
    const dateFilter = `AND created_at >= NOW() - INTERVAL '${days} days'`;

    // Revenue calculation: unit_price * quantity (matches Orders page logic)
    // This excludes delivery fees and any adjustments, showing pure product revenue
    const revenueExpr = '(COALESCE(unit_price, 0) * COALESCE(quantity, 1))';
    
    // Get custom statuses that count as revenue
    const revenueStatusesRes = await pool.query(
      `SELECT key, name FROM order_statuses WHERE client_id = $1 AND counts_as_revenue = true`,
      [clientId]
    );
    const revenueStatuses = revenueStatusesRes.rows.map(r => r.key || r.name);
    // Include built-in 'completed' status (مكتملة) for revenue calculation
    revenueStatuses.push('completed');
    
    const [productsRes, ordersRes, revenueRes, pendingRes, completedRes, adSpendRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS products FROM client_store_products WHERE client_id = $1 AND status = 'active'`,
        [clientId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS orders FROM store_orders WHERE client_id = $1 ${dateFilter}`,
        [clientId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(${revenueExpr}),0)::float AS revenue FROM store_orders WHERE client_id = $1 AND status = ANY($2) ${dateFilter}`,
        [clientId, revenueStatuses]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS pending FROM store_orders WHERE status = 'pending' AND client_id = $1 ${dateFilter}`,
        [clientId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS completed FROM store_orders WHERE client_id = $1 AND status = ANY($2) ${dateFilter}`,
        [clientId, revenueStatuses]
      ),
      pool.query(
        `SELECT COALESCE(SUM(spend),0)::float AS ad_spend FROM creative_spend_entries WHERE client_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '${days} days'`,
        [clientId]
      ),
    ]);

    // Get store page views count for the selected date range
    const viewsRes = await pool.query(
      `SELECT COALESCE(SUM(views), 0)::int AS total_views FROM client_store_daily_views WHERE client_id = $1 AND view_date >= CURRENT_DATE - INTERVAL '${days} days'`,
      [clientId]
    );

    const stats = {
      products: productsRes.rows[0]?.products ?? 0,
      orders: ordersRes.rows[0]?.orders ?? 0,
      revenue: revenueRes.rows[0]?.revenue ?? 0,
      pendingOrders: pendingRes.rows[0]?.pending ?? 0,
      completedOrders: completedRes.rows[0]?.completed ?? 0,
      visitors: viewsRes.rows[0]?.total_views ?? 0,
      adSpend: adSpendRes.rows[0]?.ad_spend ?? 0,
    };

    res.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      products: 0,
      orders: 0,
      revenue: 0,
      pendingOrders: 0,
      completedOrders: 0,
      visitors: 0,
      error: "Failed to fetch dashboard stats"
    });
  }
};

// In-memory cache for dashboard analytics (per-client)
const analyticsCache = new Map<number, { data: any; timestamp: number }>();
const ANALYTICS_CACHE_TTL = 10 * 1000; // 10 seconds cache

// GET /api/dashboard/analytics
// Rich analytics data for dashboard
export const getDashboardAnalytics: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);
    const dateFilter = `AND created_at >= NOW() - INTERVAL '${days} days'`;
    const dateFilterO = `AND o.created_at >= NOW() - INTERVAL '${days} days'`;
    
    // Check cache first (include days in cache key)
    const cacheKey = `${clientId}_${days}`;
    const cached = analyticsCache.get(cacheKey as any);
    if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL) {
      return res.json(cached.data);
    }
    
    // Get revenue statuses first (needed for other queries)
    const revenueStatusesRes = await pool.query(
      `SELECT key, name FROM order_statuses WHERE client_id = $1 AND counts_as_revenue = true`,
      [clientId]
    );
    const revenueStatuses = revenueStatusesRes.rows.map(r => r.key || r.name);
    revenueStatuses.push('completed');

    // Revenue calculation: unit_price * quantity (matches Orders page logic)
    // This excludes delivery fees and any adjustments, showing pure product revenue
    const revenueExpr = '(COALESCE(unit_price, 0) * COALESCE(quantity, 1))';
    const revenueExprO = '(COALESCE(o.unit_price, 0) * COALESCE(o.quantity, 1))';

    // Run ALL analytics queries in parallel for maximum speed
    const [
      customStatusesRes,
      dailyRevenueRes,
      dailyViewsRes,
      todayRes,
      yesterdayRes,
      thisWeekRes,
      lastWeekRes,
      thisMonthRes,
      lastMonthRes,
      allTimeRes,
      topProductsRes,
      recentOrdersRes,
      statusBreakdownRes,
      cityBreakdownRes
    ] = await Promise.all([
      // Custom statuses
      pool.query(
        `SELECT key, name, color, icon FROM order_statuses WHERE client_id = $1 ORDER BY sort_order`,
        [clientId]
      ),
      // Daily orders & revenue for selected day range
      pool.query(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as orders,
          COALESCE(SUM(${revenueExpr}), 0)::float as total_value,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 ${dateFilter}
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [clientId, revenueStatuses]
      ),
      // Daily page views
      pool.query(
        `SELECT view_date as date, views
         FROM client_store_daily_views
         WHERE client_id = $1 AND view_date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY view_date ASC`,
        [clientId]
      ),
      // Today
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [clientId, revenueStatuses]
      ),
      // Yesterday
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`,
        [clientId, revenueStatuses]
      ),
      // This week
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`,
        [clientId, revenueStatuses]
      ),
      // Last week
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 
           AND created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
           AND created_at < DATE_TRUNC('week', CURRENT_DATE)`,
        [clientId, revenueStatuses]
      ),
      // This month
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [clientId, revenueStatuses]
      ),
      // Last month
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
           AND created_at < DATE_TRUNC('month', CURRENT_DATE)`,
        [clientId, revenueStatuses]
      ),
      
      // All Time
      pool.query(
        `SELECT 
          COUNT(*)::int as orders,
          COALESCE(SUM(CASE WHEN status = ANY($2) THEN ${revenueExpr} ELSE 0 END), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1`,
        [clientId, revenueStatuses]
      ),
      // Top products
      pool.query(
        `SELECT 
          p.id, p.title, p.price, 
          COALESCE(p.images[1], '') as image_url,
          COUNT(o.id)::int as total_orders,
          COALESCE(SUM(o.quantity), 0)::int as total_quantity,
          COALESCE(SUM(CASE WHEN o.status = ANY($2) THEN ${revenueExprO} ELSE 0 END), 0)::float as total_revenue
         FROM client_store_products p
         LEFT JOIN store_orders o ON o.product_id = p.id AND o.client_id = $1 ${dateFilterO}
         WHERE p.client_id = $1
         GROUP BY p.id, p.title, p.price, p.images
         ORDER BY total_orders DESC
         LIMIT 5`,
        [clientId, revenueStatuses]
      ),
      // Recent orders
      pool.query(
        `SELECT 
          o.id, o.customer_name, o.customer_phone, o.total_price, o.status, o.created_at,
          COALESCE(p.title, 'Unknown Product') as product_title
         FROM store_orders o
         LEFT JOIN client_store_products p ON o.product_id = p.id
         WHERE o.client_id = $1 ${dateFilter.replace('created_at', 'o.created_at')}
         ORDER BY o.created_at DESC 
         LIMIT 10`,
        [clientId]
      ),
      // Status breakdown
      pool.query(
        `SELECT 
          status,
          COUNT(*)::int as count,
          COALESCE(SUM(${revenueExpr}), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 ${dateFilter}
         GROUP BY status
         ORDER BY count DESC`,
        [clientId]
      ),
      // City breakdown
      pool.query(
        `SELECT 
          CASE 
            WHEN shipping_wilaya_id IS NOT NULL THEN shipping_wilaya_id::text
            ELSE 'Not specified'
          END as city,
          shipping_wilaya_id,
          COUNT(*)::int as count,
          COALESCE(SUM(${revenueExpr}), 0)::float as revenue
         FROM store_orders 
         WHERE client_id = $1 ${dateFilter}
         GROUP BY shipping_wilaya_id
         ORDER BY count DESC
         LIMIT 10`,
        [clientId]
      )
    ]);

    // Map wilaya IDs to names
    const algeriaWilayas: Record<number, string> = {
      1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum El Bouaghi', 5: 'Batna',
      6: 'Béjaïa', 7: 'Biskra', 8: 'Béchar', 9: 'Blida', 10: 'Bouira',
      11: 'Tamanrasset', 12: 'Tébessa', 13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou',
      16: 'Alger', 17: 'Djelfa', 18: 'Jijel', 19: 'Sétif', 20: 'Saïda',
      21: 'Skikda', 22: 'Sidi Bel Abbès', 23: 'Annaba', 24: 'Guelma', 25: 'Constantine',
      26: 'Médéa', 27: 'Mostaganem', 28: 'M\'Sila', 29: 'Mascara', 30: 'Ouargla',
      31: 'Oran', 32: 'El Bayadh', 33: 'Illizi', 34: 'Bordj Bou Arréridj', 35: 'Boumerdès',
      36: 'El Tarf', 37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
      41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Aïn Defla', 45: 'Naâma',
      46: 'Aïn Témouchent', 47: 'Ghardaïa', 48: 'Relizane', 49: 'Timimoun', 50: 'Bordj Badji Mokhtar',
      51: 'Ouled Djellal', 52: 'Béni Abbès', 53: 'In Salah', 54: 'In Guezzam', 55: 'Touggourt',
      56: 'Djanet', 57: 'El M\'Ghair', 58: 'El Meniaa'
    };

    const cityBreakdown = cityBreakdownRes.rows.map(row => ({
      city: row.shipping_wilaya_id ? (algeriaWilayas[row.shipping_wilaya_id] || `Wilaya ${row.shipping_wilaya_id}`) : 'Not specified',
      count: row.count,
      revenue: row.revenue
    }));

    // Calculate growth percentages
    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const today = todayRes.rows[0] || { orders: 0, revenue: 0 };
    const yesterday = yesterdayRes.rows[0] || { orders: 0, revenue: 0 };
    const thisWeek = thisWeekRes.rows[0] || { orders: 0, revenue: 0 };
    const lastWeek = lastWeekRes.rows[0] || { orders: 0, revenue: 0 };
    const thisMonth = thisMonthRes.rows[0] || { orders: 0, revenue: 0 };
    const lastMonth = lastMonthRes.rows[0] || { orders: 0, revenue: 0 };
    const allTime = allTimeRes.rows[0] || { orders: 0, revenue: 0 };

    const responseData = {
      dailyRevenue: dailyRevenueRes.rows,
      dailyViews: dailyViewsRes.rows,
      customStatuses: customStatusesRes.rows,
      comparisons: {
        today: {
          orders: today.orders,
          revenue: today.revenue,
          ordersGrowth: calcGrowth(today.orders, yesterday.orders),
          revenueGrowth: calcGrowth(today.revenue, yesterday.revenue),
        },
        thisWeek: {
          orders: thisWeek.orders,
          revenue: thisWeek.revenue,
          ordersGrowth: calcGrowth(thisWeek.orders, lastWeek.orders),
          revenueGrowth: calcGrowth(thisWeek.revenue, lastWeek.revenue),
        },
                thisMonth: {
          orders: thisMonth.orders,
          revenue: thisMonth.revenue,
          ordersGrowth: calcGrowth(thisMonth.orders, lastMonth.orders),
          revenueGrowth: calcGrowth(thisMonth.revenue, lastMonth.revenue),
        },
        allTime: {
          orders: allTime.orders,
          revenue: allTime.revenue,
          ordersGrowth: 0,
          revenueGrowth: 0,
        }
      },
      topProducts: topProductsRes.rows,
      recentOrders: recentOrdersRes.rows,
      statusBreakdown: statusBreakdownRes.rows,
      cityBreakdown: cityBreakdown,
    };

    // Cache the response (keyed by client + days)
    analyticsCache.set(cacheKey as any, { data: responseData, timestamp: Date.now() });
    
    res.json(responseData);
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};
