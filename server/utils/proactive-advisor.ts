/**
 * Proactive Advisor — The AI store manager's brain
 *
 * Runs periodically to detect opportunities and generate advice.
 * Unlike Guardian (which only watches for problems), this looks for:
 * - Revenue trends and anomalies
 * - Customer behavior patterns
 * - Product performance insights
 * - Pricing opportunities
 * - Restock needs
 * - Re-engagement candidates
 */

import { ensureConnection } from './database';
import { generateText } from '../services/gemini';
import { setMemory, getMemory, getStoreTrends, syncCustomerProfiles } from './store-memory';
import { sendPushNotification } from '../services/push-notifications';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Every hour
let checkTimer: ReturnType<typeof setInterval> | null = null;

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY DETECTION — What the AI looks for
// ═══════════════════════════════════════════════════════════════

interface Opportunity {
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action?: string;  // suggested action for the owner
  data?: any;
}

// 1. Revenue anomaly — sudden drop or spike
async function detectRevenueAnomaly(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      WITH daily AS (
        SELECT DATE(created_at) as day, SUM(total_price) as rev
        FROM store_orders
        WHERE client_id = $1 AND status != 'cancelled' AND deleted_at IS NULL
          AND created_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY DATE(created_at)
      ),
      stats AS (
        SELECT AVG(rev) as avg_rev, STDDEV(rev) as std_rev
        FROM daily WHERE day < CURRENT_DATE
      )
      SELECT day, rev, avg_rev, std_rev
      FROM daily, stats
      WHERE day = CURRENT_DATE - 1
    `, [clientId]);

    if (res.rows.length) {
      const { day, rev, avg_rev, std_rev } = res.rows[0];
      if (Number(avg_rev) > 0 && Number(std_rev) > 0) {
        const zScore = (Number(rev) - Number(avg_rev)) / Number(std_rev);

        if (zScore < -2) {
          opps.push({
            type: 'revenue_drop',
            title: 'انخفاض غير عادي في الإيرادات',
            description: `إيرادات أمس ${Number(rev).toLocaleString('ar-DZ')} دج — أقل بمعدل ${Math.abs(Math.round(zScore))}x من المعدل.`,
            priority: 'high',
            action: 'تحقق من الطلبات الملغاة أو تحقق من حالة المتجر',
          });
        } else if (zScore > 2) {
          opps.push({
            type: 'revenue_spike',
            title: 'ارتفاع ملحوظ في الإيرادات',
            description: `إيرادات أمس ${Number(rev).toLocaleString('ar-DZ')} دج — أعلى بمعدل ${Math.round(zScore)}x من المعدل. تأكد من توفر المخزون.`,
            priority: 'medium',
            action: 'راجع المخزون وتأكد من جاهزية التوصيل',
          });
        }
      }
    }
  } catch {}

  return opps;
}

// 2. Customer re-engagement — customers who went quiet
async function detectDormantCustomers(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      SELECT customer_phone, customer_name, total_orders, total_spent, last_order_date
      FROM customer_profiles
      WHERE client_id = $1
        AND segment IN ('regular', 'vip')
        AND last_order_date < NOW() - INTERVAL '30 days'
        AND last_order_date > NOW() - INTERVAL '90 days'
      ORDER BY total_spent DESC
      LIMIT 5
    `, [clientId]);

    if (res.rows.length > 0) {
      const names = res.rows.map((r: any) => r.customer_name || r.customer_phone).join('، ');
      opps.push({
        type: 'dormant_customers',
        title: `${res.rows.length} زبون عاد / VIP لم يطلب منذ 30+ يوم`,
        description: `الزبائن: ${names}. هؤلاء زبائن ممتازون يحتاجون تذكير.`,
        priority: 'medium',
        action: 'أرسل رسالة تذكير أو عرض خاص لهؤلاء الزبائن',
        data: { customers: res.rows },
      });
    }
  } catch {}

  return opps;
}

// 3. Low stock approaching
async function detectRestockNeeds(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      SELECT title, stock_quantity, stock_quantity as reorder_level,
        (SELECT COUNT(*) FROM store_orders o WHERE o.product_id = p.id AND o.created_at >= NOW() - INTERVAL '30 days' AND o.status != 'cancelled') as monthly_sales
      FROM client_store_products p
      WHERE p.client_id = $1 AND p.status = 'active'
        AND p.stock_quantity IS NOT NULL AND p.stock_quantity <= 10
      ORDER BY p.stock_quantity ASC
      LIMIT 5
    `, [clientId]);

    for (const product of res.rows) {
      const monthlySales = Number(product.monthly_sales) || 0;
      const stock = Number(product.stock_quantity) || 0;
      if (monthlySales > 0 && stock <= Math.ceil(monthlySales / 4)) {
        opps.push({
          type: 'restock_needed',
          title: `مخزون منخفض: ${product.title}`,
          description: `المخزون: ${stock} | المبيعات الشهرية: ${monthlySales}. سينفد خلال ${Math.round(stock / (monthlySales / 30)) || '?'} يوم.`,
          priority: stock === 0 ? 'urgent' : 'high',
          action: 'أضف مخزون جديد قبل النفاد',
          data: { product },
        });
      }
    }
  } catch {}

  return opps;
}

// 4. Pricing opportunity — products with high demand but low price
async function detectPricingOpportunities(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      SELECT p.title, p.price, p.stock_quantity,
        COUNT(o.id) as recent_orders,
        AVG(o.total_price) as avg_order_val
      FROM client_store_products p
      JOIN store_orders o ON o.product_id = p.id AND o.client_id = $1
      WHERE p.client_id = $1 AND p.status = 'active'
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.status != 'cancelled'
      GROUP BY p.id, p.title, p.price, p.stock_quantity
      HAVING COUNT(o.id) >= 5
      ORDER BY recent_orders DESC
      LIMIT 3
    `, [clientId]);

    for (const product of res.rows) {
      if (Number(product.recent_orders) >= 10 && Number(product.price) < 3000) {
        opps.push({
          type: 'pricing_opportunity',
          title: `فرصة سعرية: ${product.title}`,
          description: `يُباع بسرعة (${product.recent_orders} طلب/شهر) بسعر ${Number(product.price).toLocaleString('ar-DZ')} دج. يمكن تقييم زيادة السعر.`,
          priority: 'low',
          action: 'راجع سعر هذا المنتج — الطلب عليه عالي',
          data: { product },
        });
      }
    }
  } catch {}

  return opps;
}

// 5. Pending orders aging
async function detectStalePendingOrders(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      SELECT COUNT(*) as count,
        MIN(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as oldest_hours
      FROM store_orders
      WHERE client_id = $1 AND status = 'pending' AND deleted_at IS NULL
    `, [clientId]);

    const { count, oldest_hours } = res.rows[0];
    if (Number(count) > 3 && Number(oldest_hours) > 6) {
      opps.push({
        type: 'stale_pending',
        title: `${count} طلبات معلقة منذ ${Math.round(Number(oldest_hours))}+ ساعة`,
        description: 'الطلبات المعلقة الطويلة تفقد الزبائن. تأكد من تأكيد أو رفض الطلبات بسرعة.',
        priority: 'high',
        action: 'راجع الطلبات المعلقة وتأكد منها أو اتصل بالزبائن',
      });
    }
  } catch {}

  return opps;
}

// 6. Best day/time to advertise
async function detectAdTiming(clientId: number, p: any): Promise<Opportunity[]> {
  const opps: Opportunity[] = [];

  try {
    const res = await p.query(`
      SELECT
        EXTRACT(DOW FROM created_at) as dow,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as orders
      FROM store_orders
      WHERE client_id = $1 AND deleted_at IS NULL AND status != 'cancelled'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY dow, hour
      ORDER BY orders DESC
      LIMIT 1
    `, [clientId]);

    if (res.rows.length) {
      const { dow, hour, orders } = res.rows[0];
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = days[Number(dow)] || 'اليوم';
      opps.push({
        type: 'ad_timing',
        title: `أفضل وقت للإعلان: ${dayName} الساعة ${Number(hour)}:00`,
        description: `في هذا الوقت يتم تسجيل أعلى عدد طلبات (${orders} طلب خلال 30 يوم).`,
        priority: 'low',
        action: `حدد إعلاناتك للنشر في ${dayName} حوالي الساعة ${Number(hour)}:00`,
      });
    }
  } catch {}

  return opps;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCAN — Run all checks and generate advice
// ═══════════════════════════════════════════════════════════════

async function scanStore(clientId: number): Promise<Opportunity[]> {
  const p = await ensureConnection();
  const opps: Opportunity[] = [];

  // Run all detection in parallel
  const [revenueOpps, dormantOpps, restockOpps, pricingOpps, staleOpps, timingOpps] = await Promise.all([
    detectRevenueAnomaly(clientId, p),
    detectDormantCustomers(clientId, p),
    detectRestockNeeds(clientId, p),
    detectPricingOpportunities(clientId, p),
    detectStalePendingOrders(clientId, p),
    detectAdTiming(clientId, p),
  ]);

  opps.push(...revenueOpps, ...dormantOpps, ...restockOpps, ...pricingOpps, ...staleOpps, ...timingOpps);

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  opps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return opps;
}

// ═══════════════════════════════════════════════════════════════
// AI NARRATIVE — Turn raw opportunities into natural advice
// ═══════════════════════════════════════════════════════════════

async function generateAdvisorNarrative(
  clientId: number,
  opportunities: Opportunity[],
  storeName: string
): Promise<string | null> {
  if (opportunities.length === 0) return null;

  const oppsText = opportunities.map(o =>
    `- [${o.priority}] ${o.title}: ${o.description}${o.action ? ` → اقترح: ${o.action}` : ''}`
  ).join('\n');

  const prompt = `أنت مستشار تجارة إلكترونية لمتجر "${storeName}" في الجزائر.

هذه الفرص والمشاكل المكتشفة اليوم:
${oppsText}

اكتب نصيحة عملية مختصرة (3-5 جمل) بالعربية الفصحى. رتبها حسب الأولوية. لا تستخدم إيموجي. لا تقل "مرحباً" — ابدأ مباشرة بالنصيحة.`;

  try {
    const response = await generateText('store_owner', prompt, {
      storeId: clientId,
      storeName,
      clientId,
      userType: 'owner',
    });
    return response;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION — Send insights to the owner
// ═══════════════════════════════════════════════════════════════

async function notifyOwner(clientId: number, narrative: string, opps: Opportunity[]): Promise<void> {
  const p = await ensureConnection();

  // Store as proactive action
  const highPriority = opps.filter(o => o.priority === 'urgent' || o.priority === 'high');
  if (highPriority.length > 0) {
    await p.query(`
      INSERT INTO proactive_actions (client_id, action_type, action_data, ai_reasoning, status)
      VALUES ($1, 'advisor_insight', $2, $3, 'pending')
    `, [clientId, JSON.stringify({ opportunities: opps }), narrative]);
  }

  // Send push notification if there are urgent items
  if (opps.some(o => o.priority === 'urgent')) {
    await sendPushNotification(clientId, {
      title: 'تنبيه عاجل من مدير المتجر AI',
      body: opps.find(o => o.priority === 'urgent')?.title || 'لديك تنبيه عاجل',
    }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER LOOP
// ═══════════════════════════════════════════════════════════════

async function runAdvisorScan(): Promise<void> {
  const p = await ensureConnection();

  try {
    // Check if table exists
    const tableCheck = await p.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'store_daily_snapshots' LIMIT 1`
    );
    if (tableCheck.rows.length === 0) return;

    const clients = await p.query(`SELECT id, store_name FROM client_store_settings`);

    for (const client of clients.rows) {
      try {
        // First sync customer profiles
        await syncCustomerProfiles(client.id);

        // Then scan for opportunities
        const opps = await scanStore(client.id);

        if (opps.length > 0) {
          // Store individual insights in memory
          for (const opp of opps) {
            await setMemory(client.id, 'advisor_alert', opp.type, opp.description, 0.9, 'observed');
          }

          // Generate AI narrative
          const narrative = await generateAdvisorNarrative(client.id, opps, client.store_name || 'المتجر');
          if (narrative) {
            await notifyOwner(client.id, narrative, opps);
            console.log(`[ProactiveAdvisor] Client ${client.id}: ${opps.length} opportunities found`);
          }
        }
      } catch (err) {
        console.error(`[ProactiveAdvisor] Error scanning client ${client.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[ProactiveAdvisor] Scan loop error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY REPORT — Comprehensive weekly insight
// ═══════════════════════════════════════════════════════════════

export async function generateWeeklyReport(clientId: number): Promise<void> {
  const p = await ensureConnection();

  try {
    const trends = await getStoreTrends(clientId);
    if (!trends) return;

    const storeRes = await p.query(`SELECT store_name FROM client_store_settings WHERE client_id = $1`, [clientId]);
    const storeName = storeRes.rows[0]?.store_name || 'المتجر';

    const prompt = `أنت مستشار تجارة إلكترونية لمتجر "${storeName}" في الجزائر.

إحصائيات هذا الأسبوع:
- الإيرادات: ${trends.revenueThisWeek.toLocaleString('ar-DZ')} دج (${trends.revenueChangePct > 0 ? '+' : ''}${trends.revenueChangePct}%)
- الطلبات: ${trends.ordersThisWeek} (${trends.ordersChangePct > 0 ? '+' : ''}${trends.ordersChangePct}%)
- متوسط الطلب: ${trends.avgOrderValue.toLocaleString('ar-DZ')} دج

الأكثر مبيعاً:
${trends.topProductsThisWeek.map(p => `- ${p.title}: ${p.orders} طلب | ${Number(p.revenue).toLocaleString('ar-DZ')} دج`).join('\n') || 'لا توجد بيانات'}

اكتب تقريراً أسبوعياً مختصراً (5-8 جمل) بالعربية الفصحى:
1. ملخص الأداء
2. ماذا نجح وماذا لم ينجح
3. 2-3 نصائح عملية للأسبوع القادم
لا تستخدم إيموجي. ابدأ مباشرة بالملخص.`;

    const narrative = await generateText('store_owner', prompt, {
      storeId: clientId,
      storeName,
      clientId,
      userType: 'owner',
    });

    // Store the report
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    await p.query(`
      INSERT INTO weekly_insights (
        client_id, week_start, week_end,
        total_revenue, revenue_change_pct,
        total_orders, orders_change_pct,
        summary_ar, top_products, top_customers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (client_id, week_start) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        revenue_change_pct = EXCLUDED.revenue_change_pct,
        total_orders = EXCLUDED.total_orders,
        orders_change_pct = EXCLUDED.orders_change_pct,
        summary_ar = EXCLUDED.summary_ar,
        top_products = EXCLUDED.top_products,
        top_customers = EXCLUDED.top_customers
    `, [
      clientId,
      weekStart.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10),
      trends.revenueThisWeek,
      trends.revenueChangePct,
      trends.ordersThisWeek,
      trends.ordersChangePct,
      narrative,
      JSON.stringify(trends.topProductsThisWeek),
      JSON.stringify(trends.topCustomersThisWeek),
    ]);

    // Send to owner
    await sendPushNotification(clientId, {
      title: `تقرير ${storeName} الأسبوعي`,
      body: narrative.slice(0, 200) + '...',
    }).catch(() => {});

    console.log(`[ProactiveAdvisor] Weekly report generated for client ${clientId}`);
  } catch (err) {
    console.error(`[ProactiveAdvisor] Weekly report error for client ${clientId}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════
// START/STOP
// ═══════════════════════════════════════════════════════════════

export function startProactiveAdvisor(): void {
  if (checkTimer) return;
  console.log('[ProactiveAdvisor] Starting advisor worker');

  // Run immediately on start (after 60s delay to let server settle)
  setTimeout(() => {
    void runAdvisorScan();
  }, 60_000);

  checkTimer = setInterval(() => {
    void runAdvisorScan();
  }, CHECK_INTERVAL_MS);
}

export function stopProactiveAdvisor(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
