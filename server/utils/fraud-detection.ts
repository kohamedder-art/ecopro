import { ensureConnection } from './database';
import { getIPIntelligence } from '../services/ip-intelligence';

export interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  phoneHistory: {
    totalOrders: number;
    cancelledOrders: number;
    fakeOrders: number;
    noAnswerOrders: number;
    completedOrders: number;
    returnedOrders: number;
  };
  recommendation: string;
}

export interface FraudSignals {
  customerIp?: string;
  browserFingerprint?: string;
  formFillTimeMs?: number;
}

const ALGERIAN_PREFIXES = ['05', '06', '07'];

function isValidAlgerianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return ALGERIAN_PREFIXES.some(p => clean.startsWith(p)) && clean.length === 10;
}

export async function assessOrderRisk(
  clientId: number,
  customerPhone: string,
  address?: string,
  extraSignals?: FraudSignals
): Promise<RiskAssessment> {
  const pool = await ensureConnection();
  const flags: string[] = [];
  let score = 0;

  const q = async (sql: string, params: any[]): Promise<any> => {
    try {
      return await pool.query(sql, params);
    } catch (e: any) {
      console.error('[FRAUD] Query error:', e?.message?.slice(0, 200));
      return { rows: [] };
    }
  };
  const normalizedPhone = customerPhone.replace(/\D/g, '').slice(-10);

  // ── 1. Phone history ──
  const historyRes = await q(`
    SELECT status, COUNT(*) as count
    FROM store_orders
    WHERE client_id = $1
      AND REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), '+', '') LIKE '%' || $2
    GROUP BY status
  `, [clientId, normalizedPhone]);

  const history = {
    totalOrders: 0,
    cancelledOrders: 0,
    fakeOrders: 0,
    noAnswerOrders: 0,
    completedOrders: 0,
    returnedOrders: 0,
  };

  for (const row of historyRes.rows) {
    const count = parseInt(row.count);
    history.totalOrders += count;
    switch (row.status) {
      case 'cancelled': history.cancelledOrders += count; break;
      case 'fake': history.fakeOrders += count; break;
      case 'no_answer_1': case 'no_answer_2': case 'no_answer_3': history.noAnswerOrders += count; break;
      case 'completed': case 'delivered': history.completedOrders += count; break;
      case 'returned': history.returnedOrders += count; break;
    }
  }

  if (history.fakeOrders > 0) {
    score += 50 + (history.fakeOrders - 1) * 10;
    flags.push(`⚠️ ${history.fakeOrders} طلب/طلبات وهمية سابقة`);
  }

  if (history.returnedOrders > 0 && history.totalOrders > 0) {
    const rate = history.returnedOrders / history.totalOrders;
    if (rate > 0.5) { score += 30; flags.push(`🔄 معدل إرجاع مرتفع ${Math.round(rate * 100)}%`); }
    else if (rate > 0.3) { score += 15; flags.push(`🔄 معدل إرجاع ${Math.round(rate * 100)}%`); }
  }

  if (history.cancelledOrders > 0 && history.totalOrders > 0) {
    const rate = history.cancelledOrders / history.totalOrders;
    if (rate > 0.5) { score += 25; flags.push(`❌ معدل إلغاء مرتفع ${Math.round(rate * 100)}%`); }
    else if (rate > 0.3) { score += 10; flags.push(`❌ معدل إلغاء ${Math.round(rate * 100)}%`); }
  }

  if (history.noAnswerOrders >= 3) { score += 20; flags.push(`📵 ${history.noAnswerOrders} طلبات بدون رد`); }
  else if (history.noAnswerOrders >= 2) { score += 10; flags.push(`📵 ${history.noAnswerOrders} طلبات بدون رد`); }

  // ── 2. Phone velocity (24h) ──
  const velocityRes = await q(`
    SELECT COUNT(*) as cnt FROM store_orders
    WHERE client_id = $1
      AND REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), '+', '') LIKE '%' || $2
      AND created_at > NOW() - INTERVAL '24 hours'
  `, [clientId, normalizedPhone]);
  const recentOrders = parseInt(velocityRes.rows[0]?.cnt || '0');
  if (recentOrders >= 5) { score += 25; flags.push(`🚨 ${recentOrders} طلبات في آخر 24 ساعة`); }
  else if (recentOrders >= 3) { score += 10; flags.push(`⚡ ${recentOrders} طلبات في آخر 24 ساعة`); }

  // ── 3. Address quality ──
  if (address) {
    const a = address.trim();
    if (/^[\d\s.\-]+$/.test(a)) { score += 20; flags.push('📍 عنوان أرقام فقط'); }
  }

  // ── 4. Blacklist ──
  const blacklistRes = await q(`
    SELECT 1 FROM customer_blacklist WHERE client_id = $1 AND phone LIKE '%' || $2 LIMIT 1
  `, [clientId, normalizedPhone]);
  if (blacklistRes.rows.length > 0) { score += 60; flags.push('🚫 الرقم في القائمة السوداء'); }

  // ── 5. IP-based signals ──
  const ip = extraSignals?.customerIp?.trim();
  const fp = extraSignals?.browserFingerprint?.trim();
  const fillTime = extraSignals?.formFillTimeMs;

  if (ip) {
    const ipVelocityRes = await q(`
      SELECT COUNT(*) as cnt FROM store_orders
      WHERE client_id = $1 AND customer_ip = $2
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [clientId, ip]);
    const ipOrders = parseInt(ipVelocityRes.rows[0]?.cnt || '0');
    if (ipOrders >= 5) {
      score += 25;
      flags.push(`🌐 ${ipOrders} طلب من نفس العنوان IP في آخر ساعة`);
    } else if (ipOrders >= 3) {
      score += 15;
      flags.push(`🌐 ${ipOrders} طلب من نفس الـ IP`);
    }

    const ipMismatchRes = await q(`
      SELECT COUNT(DISTINCT customer_phone) as phones FROM store_orders
      WHERE client_id = $1 AND customer_ip = $2
        AND customer_phone IS NOT NULL AND customer_phone != ''
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [clientId, ip]);
    const distinctPhones = parseInt(ipMismatchRes.rows[0]?.phones || '0');
    if (distinctPhones >= 3) {
      score += 20;
      flags.push(`👥 ${distinctPhones} أرقام مختلفة من نفس الـ IP`);
    }

    try {
      const intel = await getIPIntelligence(ip);
      if (intel.is_vpn || intel.is_proxy || intel.is_tor) {
        score += 25;
        flags.push('🛡️ اتصال عبر VPN أو بروكسي');
      }
      if (intel.is_datacenter) {
        score += 15;
        flags.push('🏢 عنوان IP لمركز بيانات (غير معتاد)');
      }
      if (intel.fraud_score >= 70) {
        score += 20;
        flags.push(`⚠️ نقاط احتيال IP: ${intel.fraud_score}`);
      }
    } catch (e: any) {
      console.error('[FRAUD] IP intelligence error:', e?.message?.slice(0, 200));
    }
  }

  // ── 6. Browser fingerprint signals ──
  if (fp) {
    const fpPhonesRes = await q(`
      SELECT COUNT(DISTINCT customer_phone) as phones FROM store_orders
      WHERE client_id = $1 AND browser_fingerprint = $2
        AND customer_phone IS NOT NULL AND customer_phone != ''
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [clientId, fp]);
    const fpPhones = parseInt(fpPhonesRes.rows[0]?.phones || '0');
    if (fpPhones >= 3) {
      score += 20;
      flags.push(`🖥️ بصمة متصفح مشتركة مع ${fpPhones} أرقام مختلفة`);
    }

    const fpVelocityRes = await q(`
      SELECT COUNT(*) as cnt FROM store_orders
      WHERE client_id = $1 AND browser_fingerprint = $2
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [clientId, fp]);
    const fpOrders = parseInt(fpVelocityRes.rows[0]?.cnt || '0');
    if (fpOrders >= 5) {
      score += 25;
      flags.push(`🖥️ ${fpOrders} طلب من نفس البصمة في آخر ساعة`);
    } else if (fpOrders >= 3) {
      score += 10;
      flags.push(`🖥️ ${fpOrders} طلب من نفس البصمة`);
    }

    const fpCrossStoreRes = await q(`
      SELECT COUNT(DISTINCT client_id) as stores FROM store_orders
      WHERE browser_fingerprint = $1
        AND client_id != $2
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [fp, clientId]);
    const fpStores = parseInt(fpCrossStoreRes.rows[0]?.stores || '0');
    if (fpStores >= 1) {
      score += 15;
      flags.push(`🏪 نفس البصمة استعملت في ${fpStores} متجر آخر`);
    }
  }

  // ── 7. Form fill time ──
  if (fillTime != null && fillTime >= 0) {
    if (fillTime < 1000) {
      score += 35;
      flags.push(`⚡ طلب فوري خلال ${fillTime}ms (بوت مؤكد)`);
    } else if (fillTime < 3000) {
      score += 25;
      flags.push(`⚡ طلب سريع جداً خلال ${(fillTime / 1000).toFixed(1)}ث (احتمال بوت)`);
    } else if (fillTime < 8000) {
      score += 15;
      flags.push(`⚡ طلب سريع خلال ${(fillTime / 1000).toFixed(1)}ث`);
    }
  }

  // ── 9. Sequential phone detection (e.g., 0555000001, 0555000002) ──
  const phoneSuffix = normalizedPhone.slice(-4);
  if (/^\d{4}$/.test(phoneSuffix)) {
    const seqRes = await q(`
      SELECT COUNT(*) as cnt FROM store_orders
      WHERE client_id = $1
        AND RIGHT(REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), '+', ''), 4)::int
          BETWEEN $2::int - 2 AND $2::int + 2
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [clientId, phoneSuffix]);
    const seqCount = parseInt(seqRes.rows[0]?.cnt || '0') - 1; // exclude self
    if (seqCount >= 3) {
      score += 40;
      flags.push(`🔢 رقم هاتف متسلسل مع ${seqCount} أرقام أخرى (بوت)`);
    } else if (seqCount >= 2) {
      score += 25;
      flags.push(`🔢 رقم هاتف متسلسل مع ${seqCount} أرقام أخرى`);
    } else if (seqCount >= 1) {
      score += 15;
      flags.push(`🔢 رقم هاتف قريب من ${seqCount} أرقام أخرى`);
    }
  }

  // ── 11. Positive signals ──
  if (history.completedOrders > 0) {
    const successRate = history.completedOrders / history.totalOrders;
    if (successRate > 0.7) { score -= 20; flags.push(`✅ عميل موثوق: ${history.completedOrders} طلبات ناجحة`); }
    else if (history.completedOrders >= 2) { score -= 10; flags.push(`✅ ${history.completedOrders} طلبات ناجحة سابقة`); }
  }

  score = Math.max(0, Math.min(100, score));

  let level: RiskAssessment['level'];
  let recommendation: string;

  if (score >= 70) {
    level = 'critical';
    recommendation = '🚨 خطر عالي جداً - يُنصح برفض الطلب';
  } else if (score >= 50) {
    level = 'high';
    recommendation = '⚠️ خطر عالي - تحقق من العميل قبل التأكيد';
  } else if (score >= 25) {
    level = 'medium';
    recommendation = '⚡ خطر متوسط - تأكد من صحة المعلومات';
  } else {
    level = 'low';
    recommendation = '✅ خطر منخفض - يمكن المتابعة';
  }

  if (history.totalOrders === 0) {
    const hasIPFlag = flags.some(f => f.includes('طلب من') || f.includes('أرقام مختلفة'));
    if (!hasIPFlag) flags.push('🆕 عميل جديد - لا يوجد سجل سابق');
  }

  return { score, level, flags, phoneHistory: history, recommendation };
}

export async function logFraudSignal(
  clientId: number,
  orderId: number | undefined,
  signalType: string,
  signalValue: string,
  riskScore: number,
  details?: Record<string, any>
): Promise<void> {
  try {
    const pool = await ensureConnection();
    await pool.query(
      `INSERT INTO fraud_signals(client_id, order_id, signal_type, signal_value, risk_score, details, created_at)
       VALUES($1,$2,$3,$4,$5,$6,NOW())`,
      [clientId, orderId || null, signalType, signalValue, riskScore, details ? JSON.stringify(details) : null]
    );
  } catch {
    // non-critical
  }
}

export async function getHighRiskOrders(clientId: number, limit = 50): Promise<any[]> {
  const pool = await ensureConnection();
  const result = await pool.query(`
    WITH phone_stats AS (
      SELECT customer_phone,
        COUNT(*) FILTER (WHERE status = 'fake') as fake_count,
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'returned')) as bad_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'delivered')) as good_count,
        COUNT(*) as total_count
      FROM store_orders WHERE client_id = $1
      GROUP BY customer_phone
      HAVING COUNT(*) FILTER (WHERE status = 'fake') > 0
         OR COUNT(*) FILTER (WHERE status IN ('cancelled', 'returned')) > COUNT(*) FILTER (WHERE status IN ('completed', 'delivered'))
    )
    SELECT o.*, ps.fake_count, ps.bad_count, ps.good_count, ps.total_count
    FROM store_orders o
    JOIN phone_stats ps ON o.customer_phone = ps.customer_phone
    WHERE o.client_id = $1 AND o.status = 'pending'
    ORDER BY ps.fake_count DESC, ps.bad_count DESC
    LIMIT $2
  `, [clientId, limit]);
  return result.rows;
}

export async function flagSuspiciousOrders(clientId: number): Promise<number> {
  const pool = await ensureConnection();
  const pendingRes = await pool.query(`
    SELECT id, customer_phone, customer_address, customer_ip, browser_fingerprint
    FROM store_orders
    WHERE client_id = $1 AND status = 'pending'
    ORDER BY created_at DESC LIMIT 100
  `, [clientId]);

  let flaggedCount = 0;
  for (const order of pendingRes.rows) {
    const risk = await assessOrderRisk(
      clientId,
      order.customer_phone,
      order.customer_address,
      { customerIp: order.customer_ip, browserFingerprint: order.browser_fingerprint }
    );
    if (risk.level === 'critical' || risk.level === 'high') {
      await pool.query(`
        UPDATE store_orders
        SET notes = COALESCE(notes, '') || E'\n\n🚨 تحذير تلقائي: ' || $1
        WHERE id = $2
      `, [risk.recommendation + '\n' + risk.flags.join('\n'), order.id]);
      flaggedCount++;
    }
  }
  return flaggedCount;
}
