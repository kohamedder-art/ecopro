import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';
import { notifyOrderStatusChanged } from '../services/push-notifications';

const router = Router();

const getStats: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const today = new Date().toISOString().slice(0, 10);
    const [statsRes, pendingRes, lowStockRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total_price), 0) as revenue, COUNT(*)::int as orders
         FROM store_orders WHERE client_id = $1 AND created_at::date = $2 AND deleted_at IS NULL
         AND status NOT IN ('cancelled','returned','fake','duplicate')`,
        [clientId, today]
      ),
      pool.query(
        `SELECT COUNT(*)::int as count FROM store_orders WHERE client_id = $1 AND status = 'pending' AND deleted_at IS NULL`,
        [clientId]
      ),
      pool.query(
        `SELECT COUNT(*)::int as count FROM client_stock_products
         WHERE client_id = $1 AND status = 'active' AND quantity <= reorder_level`,
        [clientId]
      ),
    ]);

    res.json({
      today_revenue: parseFloat(statsRes.rows[0]?.revenue || '0'),
      today_orders: statsRes.rows[0]?.orders || 0,
      pending_count: pendingRes.rows[0]?.count || 0,
      low_stock: lowStockRes.rows[0]?.count || 0,
    });
  } catch (error) {
    console.error('[mobile] stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

const getOrders: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string || '50');
    let where = 'o.client_id = $1 AND o.deleted_at IS NULL';
    const params: any[] = [clientId];
    if (status && status !== 'all') {
      where += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    const result = await pool.query(
      `SELECT o.id, o.customer_name, o.customer_phone, o.total_price,
              o.status, o.quantity, o.created_at, o.shipping_wilaya_id,
              o.order_source, o.source_platform, o.delivery_type, o.tracking_number,
              COALESCE(p.title, 'منتج محذوف') as product_title
       FROM store_orders o
       LEFT JOIN client_store_products p ON o.product_id = p.id
       WHERE ${where}
       ORDER BY o.created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    const statusLabels: Record<string, string> = {
      pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز',
      shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي',
      returned: 'مرتجع', fake: 'مزيف', duplicate: 'مكرر',
    };

    const sourceLabels: Record<string, string> = {
      manual: 'يدوي', ai_customer: 'محادثة ذكية', import: 'استيراد', api: 'API',
    };
    const platformLabels: Record<string, string> = {
      telegram: 'تلغرام', messenger: 'ماسنجر', instagram: 'انستغرام', web: 'الموقع',
    };

    res.json(result.rows.map(r => ({
      id: r.id, customer_name: r.customer_name, customer_phone: r.customer_phone,
      total_price: parseFloat(r.total_price), currency: 'DZD',
      status: r.status, status_label: statusLabels[r.status] || r.status,
      quantity: r.quantity, created_at: r.created_at,
      wilaya_id: r.shipping_wilaya_id, product_title: r.product_title,
      order_source: r.order_source, source_platform: r.source_platform,
      order_source_label: sourceLabels[r.order_source] || r.order_source,
      source_platform_label: platformLabels[r.source_platform] || r.source_platform,
      delivery_type: r.delivery_type, tracking_number: r.tracking_number,
    })));
  } catch (error) {
    console.error('[mobile] orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const getOrderDetail: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const id = parseInt(req.params.id);
    if (!id) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const result = await pool.query(
      `SELECT o.id, o.customer_name, o.customer_phone, o.total_price,
              o.status, o.quantity, o.created_at, o.notes,
              o.shipping_wilaya_id, o.shipping_commune_id, o.shipping_address,
              o.variant_name, o.delivery_type, o.tracking_number,
              o.order_source, o.source_platform,
              COALESCE(p.title, 'منتج محذوف') as product_title
       FROM store_orders o
       LEFT JOIN client_store_products p ON o.product_id = p.id
       WHERE o.id = $1 AND o.client_id = $2 AND o.deleted_at IS NULL`,
      [id, clientId]
    );

    if (result.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

    const order = result.rows[0];
    const statusLabels: Record<string, string> = {
      pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز',
      shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي',
      returned: 'مرتجع', fake: 'مزيف', duplicate: 'مكرر',
    };
    const sourceLabels: Record<string, string> = {
      manual: 'يدوي', ai_customer: 'محادثة ذكية', import: 'استيراد', api: 'API',
    };
    const platformLabels: Record<string, string> = {
      telegram: 'تلغرام', messenger: 'ماسنجر', instagram: 'انستغرام', web: 'الموقع',
    };

    let timeline: any[] = [];
    try {
      const historyRes = await pool.query(
        `SELECT old_status, new_status, created_at FROM order_status_history
         WHERE order_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      timeline = historyRes.rows.map((h, i, arr) => ({
        status: h.new_status,
        label: statusLabels[h.new_status] || h.new_status,
        timestamp: h.created_at,
        active: i === arr.length - 1,
      }));
    } catch { /* optional */ }

    res.json({
      id: order.id, customer_name: order.customer_name, customer_phone: order.customer_phone,
      product_title: order.product_title, total_price: parseFloat(order.total_price),
      currency: 'DZD', status: order.status,
      status_label: statusLabels[order.status] || order.status,
      wilaya_id: order.shipping_wilaya_id, commune_id: order.shipping_commune_id,
      address: order.shipping_address, quantity: order.quantity,
      variant_name: order.variant_name, notes: order.notes,
      delivery_type: order.delivery_type, tracking_number: order.tracking_number,
      order_source: order.order_source, source_platform: order.source_platform,
      order_source_label: sourceLabels[order.order_source] || order.order_source,
      source_platform_label: platformLabels[order.source_platform] || order.source_platform,
      created_at: order.created_at, timeline,
    });
  } catch (error) {
    console.error('[mobile] order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order detail' });
  }
};

const updateOrderStatus: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const id = parseInt(req.params.id);
    const { status } = req.body;
    const allowed = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }

    const ownerCheck = await pool.query(
      'SELECT id, status, customer_name FROM store_orders WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL',
      [id, clientId]
    );
    if (ownerCheck.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

    const oldStatus = ownerCheck.rows[0].status;
    const customerName = ownerCheck.rows[0].customer_name;
    await pool.query('UPDATE store_orders SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

    try {
      await pool.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, client_id)
         VALUES ($1, $2, $3, 'mobile_app', $4)`,
        [id, oldStatus, status, clientId]
      );
    } catch { /* optional */ }

    notifyOrderStatusChanged(clientId, id, status, customerName || '');

    res.json({ success: true });
  } catch (error) {
    console.error('[mobile] update status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

const getNotifications: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const result = await pool.query(
      `SELECT id, type, title, body, order_id, is_read, created_at
       FROM mobile_notifications
       WHERE client_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [clientId]
    );

    res.json(result.rows.map(r => ({
      id: r.id, type: r.type, title: r.title, body: r.body,
      order_id: r.order_id, read: r.is_read, created_at: r.created_at,
    })));
  } catch (error) {
    console.error('[mobile] notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const markNotificationsRead: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    await pool.query(
      'UPDATE mobile_notifications SET is_read = true WHERE client_id = $1 AND is_read = false',
      [clientId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[mobile] mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
};

router.get('/stats', getStats);
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetail);
router.post('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/status', updateOrderStatus);
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markNotificationsRead);

// Public: get latest app download URL
router.get('/download', async (_req, res) => {
  try {
    const pool = await ensureConnection();
    const result = await pool.query(
      `SELECT download_url, version, created_at FROM app_downloads
       WHERE platform = 'android' ORDER BY created_at DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.json({ download_url: null });
    }
    const row = result.rows[0];
    res.json({ download_url: row.download_url, version: row.version, updated_at: row.created_at });
  } catch {
    res.json({ download_url: null });
  }
});

// Admin: update app download URL
router.post('/download', async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    // Only super admin can update
    const { download_url, version, platform = 'android' } = req.body;
    if (!download_url) return res.status(400).json({ error: 'download_url required' });

    await pool.query(
      `INSERT INTO app_downloads (platform, download_url, version, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [platform, download_url, version || 'latest']
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update' });
  }
});

export default router;
