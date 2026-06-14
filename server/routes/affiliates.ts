import { Router, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../utils/database';
import { jsonError, jsonServerError } from '../utils/httpHelpers';
import { requireAdmin } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const AFFILIATE_COOKIE = 'affiliate_token';

const affiliateLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// AFFILIATE AUTH MIDDLEWARE
// ============================================================

interface AffiliatePayload {
  id: number;
  email: string;
  voucher_code: string;
  type: 'affiliate';
}

export const authenticateAffiliate: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[AFFILIATE_COOKIE] || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return jsonError(res, 401, 'Not authenticated');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AffiliatePayload;
    if (decoded.type !== 'affiliate') {
      return jsonError(res, 401, 'Invalid token type');
    }

    // Verify affiliate still exists and is active
    const result = await pool.query(
      'SELECT id, email, name, voucher_code, status FROM affiliates WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || result.rows[0].status !== 'active') {
      return jsonError(res, 401, 'Affiliate account not found or disabled');
    }

    (req as any).affiliate = result.rows[0];
    next();
  } catch (error) {
    return jsonError(res, 401, 'Invalid or expired token');
  }
};

// ============================================================
// AFFILIATE AUTH ROUTES
// ============================================================

// POST /api/affiliates/login
router.post('/login', affiliateLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return jsonError(res, 400, 'Email and password required');
    }

    const result = await pool.query(
      'SELECT * FROM affiliates WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return jsonError(res, 401, 'Invalid credentials');
    }

    const affiliate = result.rows[0];

    if (affiliate.status !== 'active') {
      return jsonError(res, 403, 'Account is disabled');
    }

    const validPassword = await bcrypt.compare(password, affiliate.password_hash);
    if (!validPassword) {
      return jsonError(res, 401, 'Invalid credentials');
    }

    // Update last login
    await pool.query(
      'UPDATE affiliates SET last_login_at = NOW() WHERE id = $1',
      [affiliate.id]
    );

    const token = jwt.sign(
      {
        id: affiliate.id,
        email: affiliate.email,
        voucher_code: affiliate.voucher_code,
        type: 'affiliate',
      } as AffiliatePayload,
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie(AFFILIATE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        voucher_code: affiliate.voucher_code,
      },
      token,
    });
  } catch (error) {
    console.error('[Affiliate] Login error:', error);
    return jsonServerError(res, 'Login failed');
  }
});

// POST /api/affiliates/logout
router.post('/logout', (req, res) => {
  res.clearCookie(AFFILIATE_COOKIE);
  res.json({ success: true });
});

// GET /api/affiliates/me - Get current affiliate profile
router.get('/me', authenticateAffiliate, async (req, res) => {
  try {
    const affiliate = (req as any).affiliate;
    
    const result = await pool.query(
      `SELECT id, name, email, phone, voucher_code, payment_amount, earn_per_referral,
              commission_months, status, total_referrals, total_paid_referrals,
              total_commission_earned, total_commission_paid, created_at
       FROM affiliates WHERE id = $1`,
      [affiliate.id]
    );

    if (!result.rows.length) {
      return jsonError(res, 404, 'Affiliate not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Affiliate] Get profile error:', error);
    return jsonServerError(res, 'Failed to get profile');
  }
});

// GET /api/affiliates/stats - Get affiliate dashboard stats
router.get('/stats', authenticateAffiliate, async (req, res) => {
  try {
    const affiliate = (req as any).affiliate;

    // Get referral stats
    const referralsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN ar.user_id IN (SELECT user_id FROM payments WHERE status = 'completed') THEN 1 END) as paid_referrals
       FROM affiliate_referrals ar
       WHERE ar.affiliate_id = $1`,
      [affiliate.id]
    );

    // Get commission stats
    const commissionsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_amount
       FROM affiliate_commissions
       WHERE affiliate_id = $1`,
      [affiliate.id]
    );

    // Get recent referrals (last 30 days)
    const recentReferrals = await pool.query(
      `SELECT 
        DATE(ar.created_at) as date,
        COUNT(*) as count
       FROM affiliate_referrals ar
       WHERE ar.affiliate_id = $1 AND ar.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(ar.created_at)
       ORDER BY date DESC`,
      [affiliate.id]
    );

    // Get monthly earnings (last 6 months)
    const monthlyEarnings = await pool.query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(commission_amount) as amount
       FROM affiliate_commissions
       WHERE affiliate_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC`,
      [affiliate.id]
    );

    res.json({
      referrals: {
        total: parseInt(referralsResult.rows[0]?.total_referrals || '0'),
        paid: parseInt(referralsResult.rows[0]?.paid_referrals || '0'),
      },
      commissions: {
        totalEarned: parseFloat(commissionsResult.rows[0]?.total_earned || '0'),
        totalPaid: parseFloat(commissionsResult.rows[0]?.total_paid || '0'),
        pending: parseFloat(commissionsResult.rows[0]?.pending_amount || '0'),
      },
      recentReferrals: recentReferrals.rows,
      monthlyEarnings: monthlyEarnings.rows,
    });
  } catch (error) {
    console.error('[Affiliate] Get stats error:', error);
    return jsonServerError(res, 'Failed to get stats');
  }
});

// GET /api/affiliates/referrals - Get list of referrals
router.get('/referrals', authenticateAffiliate, async (req, res) => {
  try {
    const affiliate = (req as any).affiliate;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT 
        ar.id,
        ar.created_at as referred_at,
        ar.voucher_code_used,
        ar.discount_applied,
        c.name as user_name,
        c.email as user_email,
        s.status as subscription_status,
        (SELECT COUNT(*) FROM affiliate_commissions ac WHERE ac.referral_id = ar.id) as commission_count,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions ac WHERE ac.referral_id = ar.id) as total_commission
       FROM affiliate_referrals ar
       JOIN clients c ON c.id = ar.user_id
       LEFT JOIN subscriptions s ON s.user_id = ar.user_id
       WHERE ar.affiliate_id = $1
       ORDER BY ar.created_at DESC
       LIMIT $2 OFFSET $3`,
      [affiliate.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = $1',
      [affiliate.id]
    );

    res.json({
      referrals: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('[Affiliate] Get referrals error:', error);
    return jsonServerError(res, 'Failed to get referrals');
  }
});

// GET /api/affiliates/commissions - Get commission history
router.get('/commissions', authenticateAffiliate, async (req, res) => {
  try {
    const affiliate = (req as any).affiliate;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let query = `
      SELECT 
        ac.id,
        ac.payment_month,
        ac.user_paid_amount,
        ac.platform_revenue,
        ac.commission_percent,
        ac.commission_amount,
        ac.status,
        ac.paid_at,
        ac.created_at,
        c.name as user_name,
        c.email as user_email
       FROM affiliate_commissions ac
       JOIN clients c ON c.id = ac.user_id
       WHERE ac.affiliate_id = $1
    `;
    const params: any[] = [affiliate.id];

    if (status && ['pending', 'approved', 'paid', 'cancelled'].includes(status)) {
      query += ` AND ac.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY ac.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = status 
      ? 'SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = $1';
    const countParams = status ? [affiliate.id, status] : [affiliate.id];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      commissions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('[Affiliate] Get commissions error:', error);
    return jsonServerError(res, 'Failed to get commissions');
  }
});

// ============================================================
// ADMIN ROUTES FOR MANAGING AFFILIATES
// ============================================================

// GET /api/affiliates/admin/list - List all affiliates (admin only)
router.get('/admin/list', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let query = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = a.id) as referral_count,
        (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id = a.id AND status = 'pending') as pending_commissions
       FROM affiliates a
       WHERE 1=1
    `;
    const params: any[] = [];

    if (status && ['active', 'disabled', 'suspended'].includes(status)) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.name ILIKE $${params.length} OR a.email ILIKE $${params.length} OR a.voucher_code ILIKE $${params.length})`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM affiliates WHERE 1=1';
    const countParams: any[] = [];
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (name ILIKE $${countParams.length} OR email ILIKE $${countParams.length} OR voucher_code ILIKE $${countParams.length})`;
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      affiliates: result.rows.map(a => ({
        ...a,
        password_hash: undefined, // Never expose password
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('[Affiliate Admin] List error:', error);
    return jsonServerError(res, 'Failed to list affiliates');
  }
});

// POST /api/affiliates/admin/create - Create new affiliate (admin only)
router.post('/admin/create', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, voucher_code, payment_amount, earn_per_referral, commission_months, notes } = req.body;

    if (!name || !email || !password || !voucher_code) {
      return jsonError(res, 400, 'Name, email, password, and voucher code are required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email or voucher code already exists in affiliates table
    const existing = await pool.query(
      'SELECT id FROM affiliates WHERE email = $1 OR voucher_code = $2',
      [normalizedEmail, voucher_code.toUpperCase().trim()]
    );

    if (existing.rows.length) {
      return jsonError(res, 400, 'Email or voucher code already exists');
    }

    // Check if email exists as a regular client/admin - warn about conflicts
    const existingClient = await pool.query(
      'SELECT id, role, user_type FROM clients WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingClient.rows.length) {
      const userRole = existingClient.rows[0].role || existingClient.rows[0].user_type;
      console.warn(`[Affiliate Admin] Creating affiliate with email that exists as ${userRole} client: ${normalizedEmail}`);
      // Note: We allow this but the user will have two separate login systems
    }

    if (existing.rows.length) {
      return jsonError(res, 400, 'Email or voucher code already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO affiliates (name, email, password_hash, phone, voucher_code, payment_amount, earn_per_referral, commission_months, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, phone, voucher_code, payment_amount, earn_per_referral, commission_months, status, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        password_hash,
        phone || null,
        voucher_code.toUpperCase().trim(),
        payment_amount || 0,
        earn_per_referral || 0,
        commission_months || 12,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      affiliate: result.rows[0],
    });
  } catch (error) {
    console.error('[Affiliate Admin] Create error:', error);
    return jsonServerError(res, 'Failed to create affiliate');
  }
});

// PATCH /api/affiliates/admin/:id - Update affiliate (admin only)
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, phone, voucher_code, payment_amount, earn_per_referral, commission_months, status, notes } = req.body;

    // Check affiliate exists
    const existing = await pool.query('SELECT id FROM affiliates WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return jsonError(res, 404, 'Affiliate not found');
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email.toLowerCase().trim());
    }
    if (password) {
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(await bcrypt.hash(password, 12));
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone || null);
    }
    if (voucher_code !== undefined) {
      updates.push(`voucher_code = $${paramIndex++}`);
      params.push(voucher_code.toUpperCase().trim());
    }
    if (payment_amount !== undefined) {
      updates.push(`payment_amount = $${paramIndex++}`);
      params.push(payment_amount);
    }
    if (earn_per_referral !== undefined) {
      updates.push(`earn_per_referral = $${paramIndex++}`);
      params.push(earn_per_referral);
    }
    if (commission_months !== undefined) {
      updates.push(`commission_months = $${paramIndex++}`);
      params.push(commission_months);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (updates.length === 0) {
      return jsonError(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE affiliates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json({
      success: true,
      affiliate: {
        ...result.rows[0],
        password_hash: undefined,
      },
    });
  } catch (error) {
    console.error('[Affiliate Admin] Update error:', error);
    return jsonServerError(res, 'Failed to update affiliate');
  }
});

// DELETE /api/affiliates/admin/:id - Delete affiliate (admin only)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM affiliates WHERE id = $1 RETURNING id',
      [id]
    );

    if (!result.rows.length) {
      return jsonError(res, 404, 'Affiliate not found');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Affiliate Admin] Delete error:', error);
    return jsonServerError(res, 'Failed to delete affiliate');
  }
});

// GET /api/affiliates/admin/:id/details - Get full affiliate details (admin only)
router.get('/admin/:id/details', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const affiliate = await pool.query(
      `SELECT a.*, 
        (SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = a.id) as total_referrals,
        (SELECT COUNT(*) FROM affiliate_referrals ar 
         WHERE ar.affiliate_id = a.id 
         AND ar.user_id IN (SELECT user_id FROM payments WHERE status = 'completed')) as paid_referrals,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE affiliate_id = a.id) as total_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE affiliate_id = a.id AND status = 'paid') as paid_commission,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE affiliate_id = a.id AND status = 'pending') as pending_commission
       FROM affiliates a WHERE a.id = $1`,
      [id]
    );

    if (!affiliate.rows.length) {
      return jsonError(res, 404, 'Affiliate not found');
    }

    // Get recent referrals
    const referrals = await pool.query(
      `SELECT ar.*, c.name as user_name, c.email as user_email, s.status as subscription_status
       FROM affiliate_referrals ar
       JOIN clients c ON c.id = ar.user_id
       LEFT JOIN subscriptions s ON s.user_id = ar.user_id
       WHERE ar.affiliate_id = $1
       ORDER BY ar.created_at DESC
       LIMIT 20`,
      [id]
    );

    // Get pending commissions
    const pendingCommissions = await pool.query(
      `SELECT ac.*, c.name as user_name, c.email as user_email
       FROM affiliate_commissions ac
       JOIN clients c ON c.id = ac.user_id
       WHERE ac.affiliate_id = $1 AND ac.status = 'pending'
       ORDER BY ac.created_at DESC`,
      [id]
    );

    res.json({
      affiliate: {
        ...affiliate.rows[0],
        password_hash: undefined,
      },
      referrals: referrals.rows,
      pendingCommissions: pendingCommissions.rows,
    });
  } catch (error) {
    console.error('[Affiliate Admin] Get details error:', error);
    return jsonServerError(res, 'Failed to get affiliate details');
  }
});

// POST /api/affiliates/admin/commissions/:id/pay - Mark commission as paid (admin only)
router.post('/admin/commissions/:id/pay', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req.user as any)?.id;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE affiliate_commissions 
       SET status = 'paid', paid_at = NOW(), paid_by = $2, notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, adminId, notes]
    );

    if (!result.rows.length) {
      return jsonError(res, 404, 'Commission not found or already paid');
    }

    // Update affiliate totals
    await pool.query(
      `UPDATE affiliates 
       SET total_commission_paid = total_commission_paid + $2, updated_at = NOW()
       WHERE id = $1`,
      [result.rows[0].affiliate_id, result.rows[0].commission_amount]
    );

    res.json({ success: true, commission: result.rows[0] });
  } catch (error) {
    console.error('[Affiliate Admin] Pay commission error:', error);
    return jsonServerError(res, 'Failed to mark commission as paid');
  }
});

// POST /api/affiliates/admin/commissions/bulk-pay - Bulk pay commissions (admin only)
router.post('/admin/commissions/bulk-pay', requireAdmin, async (req, res) => {
  try {
    const { affiliate_id, notes, payment_method, reference } = req.body;
    const adminId = (req.user as any)?.id;

    if (!affiliate_id) {
      return jsonError(res, 400, 'Affiliate ID required');
    }

    // Get all pending commissions for this affiliate
    const pendingResult = await pool.query(
      `SELECT id, commission_amount FROM affiliate_commissions 
       WHERE affiliate_id = $1 AND status = 'pending'`,
      [affiliate_id]
    );

    if (!pendingResult.rows.length) {
      return jsonError(res, 400, 'No pending commissions found');
    }

    const totalAmount = pendingResult.rows.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0);
    const commissionIds = pendingResult.rows.map(c => c.id);

    // Mark all as paid
    await pool.query(
      `UPDATE affiliate_commissions 
       SET status = 'paid', paid_at = NOW(), paid_by = $2, notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = ANY($1)`,
      [commissionIds, adminId, notes]
    );

    // Update affiliate totals
    await pool.query(
      `UPDATE affiliates 
       SET total_commission_paid = total_commission_paid + $2, updated_at = NOW()
       WHERE id = $1`,
      [affiliate_id, totalAmount]
    );

    // Create payout record
    await pool.query(
      `INSERT INTO affiliate_payouts (affiliate_id, amount, payment_method, reference, notes, paid_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [affiliate_id, totalAmount, payment_method || null, reference || null, notes || null, adminId]
    );

    res.json({
      success: true,
      paidCount: commissionIds.length,
      totalAmount,
    });
  } catch (error) {
    console.error('[Affiliate Admin] Bulk pay error:', error);
    return jsonServerError(res, 'Failed to process bulk payment');
  }
});

// GET /api/affiliates/admin/stats - Get overall affiliate program stats (admin only)
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM affiliates) as total_affiliates,
        (SELECT COUNT(*) FROM affiliates WHERE status = 'active') as active_affiliates,
        (SELECT COUNT(*) FROM affiliate_referrals) as total_referrals,
        (SELECT COUNT(*) FROM affiliate_referrals ar 
         WHERE ar.user_id IN (SELECT user_id FROM payments WHERE status = 'completed')) as paid_referrals,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions) as total_commission_earned,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE status = 'paid') as total_commission_paid,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE status = 'pending') as total_commission_pending
    `);

    // Top affiliates by referrals
    const topByReferrals = await pool.query(`
      SELECT a.id, a.name, a.voucher_code, COUNT(ar.id) as referral_count
      FROM affiliates a
      LEFT JOIN affiliate_referrals ar ON ar.affiliate_id = a.id
      GROUP BY a.id, a.name, a.voucher_code
      ORDER BY referral_count DESC
      LIMIT 5
    `);

    // Top affiliates by earnings
    const topByEarnings = await pool.query(`
      SELECT a.id, a.name, a.voucher_code, COALESCE(SUM(ac.commission_amount), 0) as total_earned
      FROM affiliates a
      LEFT JOIN affiliate_commissions ac ON ac.affiliate_id = a.id
      GROUP BY a.id, a.name, a.voucher_code
      ORDER BY total_earned DESC
      LIMIT 5
    `);

    res.json({
      ...stats.rows[0],
      topByReferrals: topByReferrals.rows,
      topByEarnings: topByEarnings.rows,
    });
  } catch (error) {
    console.error('[Affiliate Admin] Get stats error:', error);
    return jsonServerError(res, 'Failed to get stats');
  }
});

// ============================================================
// PUBLIC ROUTES
// ============================================================

// GET /api/affiliates/validate/:code - Validate voucher code (public)
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT voucher_code, name as affiliate_name
       FROM affiliates 
       WHERE voucher_code = $1 AND status = 'active'`,
      [code.toUpperCase().trim()]
    );

    if (!result.rows.length) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      code: result.rows[0].voucher_code,
    });
  } catch (error) {
    console.error('[Affiliate] Validate code error:', error);
    return res.json({ valid: false });
  }
});

// GET /api/affiliates/admin/client/:clientId - Get client's affiliate info (admin only)
// Used to show discount info in chat when admin is about to generate code
router.get('/admin/client/:clientId', requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!clientId) {
      return jsonError(res, 400, 'Invalid client ID');
    }

    // Get client's affiliate referral info
    const result = await pool.query(`
      SELECT 
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.referred_by_affiliate_id,
        c.referral_voucher_code,
        a.id as affiliate_id,
        a.name as affiliate_name,
        a.email as affiliate_email,
        a.payment_amount,
        a.earn_per_referral,
        a.commission_months,
        ar.created_at as referral_date
      FROM clients c
      LEFT JOIN affiliates a ON a.id = c.referred_by_affiliate_id
      LEFT JOIN affiliate_referrals ar ON ar.user_id = c.id AND ar.affiliate_id = a.id
      WHERE c.id = $1
    `, [clientId]);

    if (!result.rows.length) {
      return jsonError(res, 404, 'Client not found');
    }

    const client = result.rows[0];
    const hasAffiliate = !!client.affiliate_id;

    res.json({
      client_id: client.client_id,
      client_name: client.client_name,
      client_email: client.client_email,
      has_affiliate: hasAffiliate,
      affiliate: hasAffiliate ? {
        id: client.affiliate_id,
        name: client.affiliate_name,
        email: client.affiliate_email,
        voucher_code: client.referral_voucher_code,
        payment_amount: parseFloat(client.payment_amount || '0'),
        earn_per_referral: parseFloat(client.earn_per_referral || '0'),
        commission_months: client.commission_months,
      } : null,
      referral_date: client.referral_date,
    });
  } catch (error) {
    console.error('[Affiliate Admin] Get client affiliate info error:', error);
    return jsonServerError(res, 'Failed to get client affiliate info');
  }
});

// POST /api/affiliates/admin/record-payment - Record a manual payment for affiliate commission
// Called when admin issues a code for a referred client
router.post('/admin/record-payment', requireAdmin, async (req, res) => {
  try {
    const { client_id, amount_paid, payment_method, notes } = req.body;

    if (!client_id || !amount_paid) {
      return jsonError(res, 400, 'client_id and amount_paid are required');
    }

    // Get client's affiliate info
    const clientResult = await pool.query(`
      SELECT 
        c.id, c.referred_by_affiliate_id, c.referral_voucher_code,
        a.earn_per_referral, a.commission_months,
        ar.id as referral_id
      FROM clients c
      LEFT JOIN affiliates a ON a.id = c.referred_by_affiliate_id
      LEFT JOIN affiliate_referrals ar ON ar.user_id = c.id AND ar.affiliate_id = a.id
      WHERE c.id = $1
    `, [client_id]);

    if (!clientResult.rows.length) {
      return jsonError(res, 404, 'Client not found');
    }

    const client = clientResult.rows[0];

    if (!client.referred_by_affiliate_id) {
      return res.json({ 
        success: true, 
        commission_recorded: false,
        message: 'Payment recorded but client has no affiliate referral' 
      });
    }

    // Count existing payments to determine payment month
    const paymentCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM affiliate_commissions 
      WHERE user_id = $1 AND affiliate_id = $2
    `, [client_id, client.referred_by_affiliate_id]);
    
    const paymentMonth = parseInt(paymentCountResult.rows[0].count) + 1;

    // Check if within commission period
    if (paymentMonth > client.commission_months) {
      return res.json({
        success: true,
        commission_recorded: false,
        message: `Payment is month ${paymentMonth}, beyond commission period of ${client.commission_months} months`
      });
    }

    // Calculate commission (fixed amount)
    const commissionAmount = parseFloat(client.earn_per_referral) || 0;

    // Create commission record
    const commissionResult = await pool.query(`
      INSERT INTO affiliate_commissions 
        (affiliate_id, referral_id, user_id, payment_id, payment_month, 
         user_paid_amount, platform_revenue, commission_percent, commission_amount, status)
      VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, 'pending')
      RETURNING id, commission_amount
    `, [
      client.referred_by_affiliate_id,
      client.referral_id,
      client_id,
      paymentMonth,
      amount_paid,
      amount_paid,
      0,
      commissionAmount
    ]);

    // Update affiliate totals
    await pool.query(`
      UPDATE affiliates 
      SET total_commission_earned = total_commission_earned + $1,
          total_paid_referrals = (
            SELECT COUNT(DISTINCT user_id) FROM affiliate_commissions WHERE affiliate_id = $2
          )
      WHERE id = $2
    `, [commissionAmount, client.referred_by_affiliate_id]);

    res.json({
      success: true,
      commission_recorded: true,
      commission_id: commissionResult.rows[0].id,
      commission_amount: commissionAmount,
      payment_month: paymentMonth,
      affiliate_id: client.referred_by_affiliate_id,
      message: `Commission of ${commissionAmount.toFixed(0)} دج recorded for month ${paymentMonth}`
    });
  } catch (error) {
    console.error('[Affiliate Admin] Record payment error:', error);
    return jsonServerError(res, 'Failed to record payment');
  }
});

// ============================================================
// CLIENT ROUTES (for logged-in users)
// ============================================================

// POST /api/affiliates/apply-code - Apply affiliate code to current user
// Allows users who signed up without a code to add one later
router.post('/apply-code', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id || !user.email) {
      return jsonError(res, 401, 'Not authenticated');
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return jsonError(res, 400, 'Voucher code is required');
    }

    const voucherCode = code.toUpperCase().trim();

    // Look up client by email (since users and clients tables have different IDs)
    const userResult = await pool.query(
      'SELECT id, referred_by_affiliate_id, referral_voucher_code FROM clients WHERE LOWER(email) = LOWER($1)',
      [user.email]
    );

    if (!userResult.rows.length) {
      return jsonError(res, 404, 'User not found');
    }

    const clientId = userResult.rows[0].id;

    if (userResult.rows[0].referred_by_affiliate_id) {
      return jsonError(res, 400, `You already have an affiliate code applied: ${userResult.rows[0].referral_voucher_code}`);
    }

    // Check if user has made any payments (can only apply before first payment)
    // Use client_id to check subscriptions as that's what the payments system uses
    const paymentsResult = await pool.query(
      `SELECT COUNT(*) as count FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       WHERE s.user_id = $1 AND p.status = 'completed'`,
      [clientId]
    );

    if (parseInt(paymentsResult.rows[0].count) > 0) {
      return jsonError(res, 400, 'Cannot apply affiliate code after making a payment');
    }

    // Validate the affiliate code
    const affiliateResult = await pool.query(
      `SELECT id, name, voucher_code, earn_per_referral, commission_months
       FROM affiliates 
       WHERE voucher_code = $1 AND status = 'active'`,
      [voucherCode]
    );

    if (!affiliateResult.rows.length) {
      return jsonError(res, 400, 'Invalid or inactive voucher code');
    }

    const affiliate = affiliateResult.rows[0];

    // Update user with affiliate info
    await pool.query(
      `UPDATE clients 
       SET referred_by_affiliate_id = $1, referral_voucher_code = $2 
       WHERE id = $3`,
      [affiliate.id, voucherCode, clientId]
    );

    // Create referral record
    await pool.query(
      `INSERT INTO affiliate_referrals (affiliate_id, user_id, voucher_code_used, discount_applied)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [affiliate.id, clientId, voucherCode]
    );

    // Update affiliate referral count
    await pool.query(
      `UPDATE affiliates SET total_referrals = total_referrals + 1 WHERE id = $1`,
      [affiliate.id]
    );

    res.json({
      success: true,
      message: 'Affiliate code applied successfully',
      affiliate: {
        name: affiliate.name,
        voucher_code: affiliate.voucher_code,
      },
    });
  } catch (error) {
    console.error('[Affiliate] Apply code error:', error);
    return jsonServerError(res, 'Failed to apply affiliate code');
  }
});

// GET /api/affiliates/my-referral - Get current user's affiliate referral info
router.get('/my-referral', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id || !user.email) {
      return jsonError(res, 401, 'Not authenticated');
    }

    // Look up client by email (since users and clients tables have different IDs)
    const result = await pool.query(`
      SELECT 
        c.referred_by_affiliate_id,
        c.referral_voucher_code,
        a.name as affiliate_name,
        a.earn_per_referral,
        ar.created_at as referral_date
      FROM clients c
      LEFT JOIN affiliates a ON a.id = c.referred_by_affiliate_id
      LEFT JOIN affiliate_referrals ar ON ar.user_id = c.id AND ar.affiliate_id = a.id
      WHERE LOWER(c.email) = LOWER($1)
    `, [user.email]);

    if (!result.rows.length) {
      return res.json({ has_referral: false });
    }

    const row = result.rows[0];

    if (!row.referred_by_affiliate_id) {
      return res.json({ has_referral: false });
    }

    res.json({
      has_referral: true,
      affiliate_name: row.affiliate_name,
      voucher_code: row.referral_voucher_code,
      earn_per_referral: parseFloat(row.earn_per_referral || '0'),
      referral_date: row.referral_date,
    });
  } catch (error) {
    console.error('[Affiliate] Get my referral error:', error);
    return jsonServerError(res, 'Failed to get referral info');
  }
});

export default router;
