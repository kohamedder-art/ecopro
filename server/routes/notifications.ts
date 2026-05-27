import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';

const router = Router();

const registerDevice: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { push_token, platform } = req.body;
    if (!push_token) { res.status(400).json({ error: 'push_token is required' }); return; }
    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      res.status(400).json({ error: 'platform must be ios, android, or web' }); return;
    }

    await pool.query(
      `INSERT INTO push_devices (client_id, push_token, platform, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (client_id, push_token)
       DO UPDATE SET platform = $3, updated_at = NOW()`,
      [clientId, push_token, platform]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[notifications] register device error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
};

const unregisterDevice: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { push_token } = req.body;
    if (!push_token) { res.status(400).json({ error: 'push_token is required' }); return; }

    await pool.query(
      'DELETE FROM push_devices WHERE client_id = $1 AND push_token = $2',
      [clientId, push_token]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[notifications] unregister device error:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
};

router.post('/register-device', registerDevice);
router.post('/unregister-device', unregisterDevice);

export default router;
