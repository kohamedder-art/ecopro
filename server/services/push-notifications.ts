import axios from 'axios';
import { ensureConnection } from '../utils/database';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const NTFY_BASE = 'https://ntfy.sh';

interface PushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

export async function sendPushNotification(clientId: number, title: string, body: string, data?: Record<string, any>) {
  try {
    const pool = await ensureConnection();
    const devices = await pool.query(
      'SELECT push_token FROM push_devices WHERE client_id = $1',
      [clientId]
    );

    if (devices.rows.length === 0) return;

    const messages: PushMessage[] = devices.rows.map((d: any) => ({
      to: d.push_token,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
    }));

    console.log(`[push] sending to ${devices.rows.length} device(s) for client ${clientId}`);
    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });

    const tickets = response.data?.data;
    console.log(`[push] Expo response status: ${response.status}, tickets:`, JSON.stringify(tickets));
    if (tickets) {
      const errors = tickets.filter((t: any) => t.status === 'error');
      if (errors.length > 0) {
        console.error('[push] Expo push errors:', JSON.stringify(errors));
        const invalidTokens: string[] = [];
        for (const ticket of errors) {
          if (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials') {
            invalidTokens.push(ticket.details.expoPushToken || '');
          }
        }
        if (invalidTokens.length > 0) {
          pool.query(
            'DELETE FROM push_devices WHERE push_token = ANY($1)',
            [invalidTokens.filter(Boolean)]
          ).catch((e: any) => console.error('[push] cleanup error:', e));
        }
      } else {
        console.log('[push] all tickets ok');
      }
    } else {
      console.warn('[push] no tickets in response, full response:', JSON.stringify(response.data));
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
    sendPushNotification(clientId, title, body, { type: 'new_order', order_id: orderId }),
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
    sendPushNotification(clientId, title, body, { type: 'status_update', order_id: orderId }),
    sendNtfyNotification(clientId, title, body),
  ]);
}
