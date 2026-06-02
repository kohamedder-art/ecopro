import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ensureConnection } from '../utils/database';

const NTFY_BASE = 'https://ntfy.sh';
const FCM_PROJECT_ID = 'sahla4eco-push-b5203';
const FCM_API_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function getServiceAccount(): any {
  const path = join(__dirname, '..', 'firebase-service-account.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const sa = getServiceAccount();
  const nowSec = Math.floor(now / 1000);

  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });

  const res = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: token,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  cachedAccessToken = res.data.access_token;
  tokenExpiresAt = now + (res.data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function sendFcmMessage(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
  try {
    const accessToken = await getAccessToken();
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
    };

    const res = await axios.post(FCM_API_URL, { message }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (error: any) {
    if (error.response?.data) {
      const fcmError = error.response.data.error;
      if (fcmError?.message?.includes('UNREGISTERED') || fcmError?.message?.includes('NOT_FOUND')) {
        return { error: 'unregistered', token: fcmToken };
      }
      console.error('[fcm] error:', fcmError?.message || error.response.data);
    } else {
      console.error('[fcm] send error:', error.message);
    }
    return { error: error.message };
  }
}

export async function sendPushNotification(clientId: number, title: string, body: string, data?: Record<string, any>) {
  try {
    const pool = await ensureConnection();
    const devices = await pool.query(
      'SELECT push_token, platform FROM push_devices WHERE client_id = $1',
      [clientId]
    );

    if (devices.rows.length === 0) {
      console.log(`[push] no devices registered for client ${clientId}`);
      return;
    }

    const dataStr: Record<string, string> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        dataStr[k] = String(v);
      }
    }

    console.log(`[push] sending FCM to ${devices.rows.length} device(s) for client ${clientId}`);

    const invalidTokens: string[] = [];
    for (const device of devices.rows) {
      const token = device.push_token;
      const result = await sendFcmMessage(token, title, body, dataStr);
      if (result.error === 'unregistered') {
        invalidTokens.push(token);
      }
    }

    if (invalidTokens.length > 0) {
      await pool.query(
        'DELETE FROM push_devices WHERE push_token = ANY($1)',
        [invalidTokens]
      );
      console.log(`[push] cleaned up ${invalidTokens.length} invalid token(s)`);
    }
  } catch (error) {
    console.error('[push] send error:', error);
  }
}

export async function insertInAppNotification(
  clientId: number, type: string, title: string, body: string, orderId?: number
) {
  try {
    const pool = await ensureConnection();
    await pool.query(
      `INSERT INTO mobile_notifications (client_id, type, title, body, order_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [clientId, type, title, body, orderId || null]
    );
  } catch (error) {
    console.error('[push] insert notification error:', error);
  }
}

export async function sendNtfyNotification(clientId: number, title: string, body: string) {
  try {
    const topic = `sahla4eco-${clientId}`;
    await axios.post(`${NTFY_BASE}/${topic}`, body, {
      headers: {
        'Title': title,
        'Priority': 'high',
        'Tags': 'bell',
      },
      timeout: 5000,
    });
    console.log(`[ntfy] sent to topic ${topic}`);
  } catch (error) {
    console.error(`[ntfy] send error for client ${clientId}:`, error);
  }
}

export async function notifyOrderCreated(clientId: number, orderId: number, customerName: string) {
  const title = 'طلب جديد';
  const body = `تم استلام طلب جديد من ${customerName}`;
  await Promise.all([
    insertInAppNotification(clientId, 'new_order', title, body, orderId),
    sendPushNotification(clientId, title, body, { type: 'new_order', order_id: String(orderId) }),
    sendNtfyNotification(clientId, title, body),
  ]);
}

export async function notifyOrderStatusChanged(clientId: number, orderId: number, status: string, customerName: string) {
  const statusLabels: Record<string, string> = {
    confirmed: 'تأكيد الطلب',
    processing: 'قيد التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'إلغاء الطلب',
    returned: 'إرجاع الطلب',
  };
  const label = statusLabels[status] || status;
  const title = 'تحديث الطلب';
  const body = `الطلب رقم #${orderId}: ${label}`;
  await Promise.all([
    insertInAppNotification(clientId, 'status_update', title, body, orderId),
    sendPushNotification(clientId, title, body, { type: 'status_update', order_id: String(orderId) }),
    sendNtfyNotification(clientId, title, body),
  ]);
}
