/**
 * Autonomous Actions — AI-initiated actions with owner approval
 *
 * The AI can suggest or auto-execute actions based on what it learns.
 * High-risk actions require owner approval via push notification.
 * Low-risk actions execute automatically (configurable per store).
 */

import { ensureConnection } from './database';
import { sendPushNotification } from '../services/push-notifications';
import { getMemory, setMemory } from './store-memory';

const WORKER_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes
let workerTimer: ReturnType<typeof setInterval> | null = null;

// ═══════════════════════════════════════════════════════════════
// AUTO-CONFIRM — Low-risk orders can be auto-confirmed
// ═══════════════════════════════════════════════════════════════

interface AutoConfirmResult {
  orderId: number;
  reason: string;
  confidence: number;
}

async function findAutoConfirmCandidates(clientId: number, p: any): Promise<AutoConfirmResult[]> {
  const results: AutoConfirmResult[] = [];

  try {
    // Get store's auto-confirm setting
    const settingsRes = await p.query(`
      SELECT value FROM ai_store_memory
      WHERE client_id = $1 AND category = 'owner_preference' AND key = 'auto_confirm_enabled'
    `, [clientId]);

    const autoConfirmEnabled = settingsRes.rows[0]?.value === 'true';
    if (!autoConfirmEnabled) return results;

    // Find pending orders that are low-risk:
    // - Customer has ordered before (not first-time)
    // - Order value < 5000 DZD (low financial risk)
    // - No fraud flags
    // - Phone number matches previous orders
    const candidates = await p.query(`
      SELECT o.id, o.customer_phone, o.total_price, o.customer_name,
        cp.total_orders as customer_orders,
        o.fraud_score
      FROM store_orders o
      LEFT JOIN customer_profiles cp ON cp.client_id = o.client_id AND cp.customer_phone = o.customer_phone
      WHERE o.client_id = $1
        AND o.status = 'pending'
        AND o.deleted_at IS NULL
        AND o.total_price < 5000
        AND (o.fraud_score IS NULL OR o.fraud_score < 20)
        AND cp.total_orders >= 2
      ORDER BY o.created_at ASC
      LIMIT 5
    `, [clientId]);

    for (const row of candidates.rows) {
      results.push({
        orderId: row.id,
        reason: `زبون عائد (${row.customer_orders} طلب سابق) | مبلغ منخفض (${Number(row.total_price).toLocaleString('ar-DZ')} دج) | لا علامات احتيال`,
        confidence: 0.85,
      });
    }
  } catch {}

  return results;
}

async function executeAutoConfirm(clientId: number, orderId: number, reason: string): Promise<boolean> {
  const p = await ensureConnection();

  try {
    await p.query('BEGIN');

    // Update order status
    await p.query(
      `UPDATE store_orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND client_id = $2 AND status = 'pending'`,
      [orderId, clientId]
    );

    // Log the action
    await p.query(`
      INSERT INTO proactive_actions (client_id, action_type, action_data, ai_reasoning, status, executed_at)
      VALUES ($1, 'auto_confirm', $2, $3, 'executed', NOW())
    `, [clientId, JSON.stringify({ orderId }), reason]);

    await p.query('COMMIT');
    console.log(`[Autonomous] Auto-confirmed order #${orderId} for client ${clientId}: ${reason}`);
    return true;
  } catch (err) {
    await p.query('ROLLBACK').catch(() => {});
    console.error(`[Autonomous] Auto-confirm failed for order #${orderId}:`, err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// RE-ENGAGEMENT — Auto-send messages to dormant customers
// ═══════════════════════════════════════════════════════════════

async function findReengagementCandidates(clientId: number, p: any): Promise<{ phone: string; name: string; lastOrder: Date; segment: string }[]> {
  try {
    const res = await p.query(`
      SELECT customer_phone, customer_name, last_order_date, segment
      FROM customer_profiles
      WHERE client_id = $1
        AND segment = 'vip'
        AND last_order_date < NOW() - INTERVAL '45 days'
        AND last_order_date > NOW() - INTERVAL '120 days'
        AND (ai_notes IS NULL OR ai_notes NOT LIKE '%reengagement_sent%')
      ORDER BY lifetime_value DESC
      LIMIT 3
    `, [clientId]);

    return res.rows;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// STOCK ALERT — Auto-alert when stock is critical
// ═══════════════════════════════════════════════════════════════

async function detectCriticalStock(clientId: number, p: any): Promise<{ title: string; stock: number }[]> {
  try {
    const res = await p.query(`
      SELECT title, stock_quantity
      FROM client_store_products
      WHERE client_id = $1
        AND status = 'active'
        AND stock_quantity IS NOT NULL
        AND stock_quantity = 0
      LIMIT 5
    `, [clientId]);

    return res.rows;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCAN LOOP
// ═══════════════════════════════════════════════════════════════

async function runAutonomousScan(): Promise<void> {
  const p = await ensureConnection();

  try {
    // Check if tables exist
    const tableCheck = await p.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'proactive_actions' LIMIT 1`
    );
    if (tableCheck.rows.length === 0) return;

    const clients = await p.query(`SELECT id FROM clients WHERE status = 'active'`);

    for (const client of clients.rows) {
      const clientId = client.id;

      try {
        // 1. Auto-confirm eligible orders
        const candidates = await findAutoConfirmCandidates(clientId, p);
        for (const c of candidates) {
          // Check if already attempted today
          const alreadyDone = await p.query(`
            SELECT 1 FROM proactive_actions
            WHERE client_id = $1 AND action_type = 'auto_confirm'
              AND action_data->>'orderId' = $2
              AND created_at > CURRENT_DATE
          `, [clientId, String(c.orderId)]);

          if (alreadyDone.rows.length === 0) {
            const success = await executeAutoConfirm(clientId, c.orderId, c.reason);
            if (success) {
              await sendPushNotification(clientId, {
                title: 'تم تأكيد طلب تلقائياً',
                body: `الطلب #${c.orderId} — ${c.reason}`,
              }).catch(() => {});
            }
          }
        }

        // 2. Detect critical stock (0 items) — notify owner
        const criticalStock = await detectCriticalStock(clientId, p);
        if (criticalStock.length > 0) {
          // Deduplicate — only alert once per day per product
          for (const item of criticalStock) {
            const memKey = `stock_alert_${item.title.replace(/\s/g, '_')}`;
            const existing = await getMemory(clientId, 'stock_alert');
            const alreadyAlerted = existing.some(m => m.key === memKey);

            if (!alreadyAlerted) {
              await setMemory(clientId, 'stock_alert', memKey, 'notified', 0.9);
              await sendPushNotification(clientId, {
                title: 'مخزون منطف — ' + item.title,
                body: 'المنتج نفد من المخزون. أضف مخزون بسرعة.',
              }).catch(() => {});
            }
          }
        }

        // 3. VIP re-engagement — suggest messaging dormant VIPs
        const dormantVIPs = await findReengagementCandidates(clientId, p);
        if (dormantVIPs.length > 0) {
          const key = `reengagement_${dormantVIPs.map(v => v.phone).join(',')}`;
          const existing = await getMemory(clientId, 'reengagement');
          const alreadySuggested = existing.some(m => m.key === key);

          if (!alreadySuggested) {
            await setMemory(clientId, 'reengagement', key, 'suggested', 0.8);
            await p.query(`
              INSERT INTO proactive_actions (client_id, action_type, action_data, ai_reasoning, status)
              VALUES ($1, 'reengagement', $2, $3, 'pending')
            `, [
              clientId,
              JSON.stringify({ customers: dormantVIPs.map(v => ({ phone: v.phone, name: v.name })) }),
              `${dormantVIPs.length} زبون VIP لم يطلب منذ 45+ يوم. اتصل بهم بعرض خاص.`,
            ]);

            await sendPushNotification(clientId, {
              title: 'زبائن VIP ينتظرون',
              body: `${dormantVIPs.length} زبون ممتاز لم يطلب منذ فترة. تواصل معهم!`,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[Autonomous] Error scanning client ${clientId}:`, err);
      }
    }
  } catch (err) {
    console.error('[Autonomous] Scan loop error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// APPROVAL API — Owner approves/rejects pending actions
// ═══════════════════════════════════════════════════════════════

export async function approveAction(actionId: number, clientId: number): Promise<{ success: boolean; message: string }> {
  const p = await ensureConnection();

  try {
    const res = await p.query(
      `SELECT * FROM proactive_actions WHERE id = $1 AND client_id = $2 AND status = 'pending'`,
      [actionId, clientId]
    );

    if (!res.rows.length) {
      return { success: false, message: 'الإجراء غير موجود أو تم تنفيذه بالفعل' };
    }

    const action = res.rows[0];

    // Execute based on type
    if (action.action_type === 'reengagement') {
      // Mark customers as reengagement_sent
      const customers = action.action_data?.customers || [];
      for (const c of customers) {
        await p.query(
          `UPDATE customer_profiles SET ai_notes = COALESCE(ai_notes, '') || ' | reengagement_sent ' || NOW()::date
           WHERE client_id = $1 AND customer_phone = $2`,
          [clientId, c.phone]
        );
      }
    }

    await p.query(
      `UPDATE proactive_actions SET status = 'executed', executed_at = NOW() WHERE id = $1`,
      [actionId]
    );

    return { success: true, message: 'تم تنفيذ الإجراء بنجاح' };
  } catch (err) {
    return { success: false, message: 'خطأ في التنفيذ' };
  }
}

export async function rejectAction(actionId: number, clientId: number): Promise<{ success: boolean; message: string }> {
  const p = await ensureConnection();

  try {
    await p.query(
      `UPDATE proactive_actions SET status = 'rejected' WHERE id = $1 AND client_id = $2 AND status = 'pending'`,
      [actionId, clientId]
    );
    return { success: true, message: 'تم رفض الإجراء' };
  } catch {
    return { success: false, message: 'خطأ' };
  }
}

export async function getPendingActions(clientId: number): Promise<any[]> {
  const p = await ensureConnection();

  try {
    const res = await p.query(
      `SELECT id, action_type, action_data, ai_reasoning, created_at
       FROM proactive_actions
       WHERE client_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 20`,
      [clientId]
    );
    return res.rows;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// START/STOP
// ═══════════════════════════════════════════════════════════════

export function startAutonomousWorker(): void {
  if (workerTimer) return;
  console.log('[Autonomous] Starting autonomous actions worker');

  setTimeout(() => {
    void runAutonomousScan();
  }, 120_000); // 2 min after server start

  workerTimer = setInterval(() => {
    void runAutonomousScan();
  }, WORKER_INTERVAL_MS);
}

export function stopAutonomousWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
