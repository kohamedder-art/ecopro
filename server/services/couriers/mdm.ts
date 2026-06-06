// MDM Express Courier Service
// API: https://api.mdm.express
// Auth: Bearer token

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const API_BASE = 'https://api.mdm.express';

// Map Algeria wilaya number (01-58) to MDM default city ID
function wilayaToCityId(wilayaId?: number, address?: string): string {
  let code: string | undefined;

  if (wilayaId) {
    code = String(wilayaId).padStart(2, '0');
  } else if (address) {
    // Try to extract wilaya number from address like "35 - بومرداس" or "07 - بسكرة"
    const match = address.match(/^(\d{1,2})\s*[-–]/);
    if (match) code = match[1].padStart(2, '0');
  }

  if (!code) return 'DZA161601'; // fallback: Alger Centre
  return `DZA${code}${code}01`;
}

interface MdmOrderResponse {
  trackingId: string;
  status: string;
  statusDate: string;
  destination?: {
    cityId: string;
    cityName: string;
    stateName: string;
  };
}

interface MdmStatusHistoryResponse {
  list: Array<{
    date: string;
    status: string;
    notes: string | null;
  }>;
}

export class MdmService implements CourierService {
  /**
   * Create order via POST /api/v2/orders
   * apiKey = MDM x-api-key
   * storeId = MDM store trackingId (required, stored as merchant_id)
   * secondaryCredential = MDM default product trackingId (stored as api_secret)
   */
  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    storeId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      if (!storeId) {
        return { success: false, tracking_number: '', error: 'MDM storeId is required (set as merchant_id in integration)' };
      }

      // storeId may be passed as "STORE_ID|PRODUCT_ID"
      let mdmStoreId = storeId;
      let mdmProductId = '';
      if (storeId.includes('|')) {
        [mdmStoreId, mdmProductId] = storeId.split('|');
      }

      const nameParts = (shipment.customer_name || '').trim().split(' ');
      const firstName = nameParts[0] || 'Client';
      const lastName = nameParts.slice(1).join(' ') || '-';

      // Map wilaya to MDM cityId
      const cityId = wilayaToCityId(
        (shipment as any).wilaya_id ? Number((shipment as any).wilaya_id) : undefined,
        shipment.delivery_address
      );

      // MDM product trackingId can be passed via shipment fields as fallback
      // The user should configure their MDM product trackingId in the integration
      mdmProductId = mdmProductId || (shipment as any).mdm_product_id || '';

      if (!mdmProductId) {
        return {
          success: false,
          tracking_number: '',
          error:
            'MDM product trackingId is required. Set it in Delivery Integration as Product Tracking ID or use STORE_ID|PRODUCT_ID format.',
        };
      }

      const payload: Record<string, any> = {
        storeId: mdmStoreId,
        totalPrice: Number(shipment.cod_amount ?? 0),
        notes: shipment.notes || shipment.product_description || '',
        client: {
          firstName,
          lastName,
          phone: shipment.customer_phone || '',
        },
        destination: {
          cityId,
          streetAddress: shipment.delivery_address || '',
        },
        products: [
          {
            trackingId: mdmProductId,
            quantity: Number(shipment.quantity || 1),
            price: Number(shipment.cod_amount ?? 0),
            displayName: shipment.product_description || 'Product',
          },
        ],
        freeShipping: !shipment.cod_amount,
        confirmed: true,
        confirmedByUs: false,
      };

      const response = await fetch(`${API_BASE}/api/v2/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || data?.error || `MDM API error ${response.status}`,
        };
      }

      return {
        success: true,
        tracking_number: data.trackingId,
        reference_id: data.trackingId,
      };
    } catch (error: any) {
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  /**
   * Get order status via GET /api/v2/orders/{trackingId}
   */
  async getStatus(
    trackingNumber: string,
    apiKey: string
  ): Promise<CourierStatusResponse> {
    try {
      const [orderRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/v2/orders/${trackingNumber}`, {
          headers: { 'x-api-key': apiKey },
        }),
        fetch(`${API_BASE}/api/v2/orders/${trackingNumber}/status-history`, {
          headers: { 'x-api-key': apiKey },
        }),
      ]);

      if (!orderRes.ok) {
        return { tracking_number: trackingNumber, status: 'unknown', error: `MDM API error ${orderRes.status}` };
      }

      const order: MdmOrderResponse = await orderRes.json();
      const history: MdmStatusHistoryResponse = historyRes.ok ? await historyRes.json() : { list: [] };

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(order.status),
        last_update: order.statusDate,
        location: order.destination?.cityName,
        events: history.list.map(e => ({
          type: this.mapStatus(e.status),
          timestamp: e.date,
          description: e.notes || e.status,
        })),
      };
    } catch (error: any) {
      return { tracking_number: trackingNumber, status: 'unknown', error: error.message };
    }
  }

  verifyWebhook(_payload: any, _signature: string, _secret: string): boolean {
    return true; // MDM docs don't specify webhook signature verification
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.trackingId || payload.tracking_number || '',
      event_type: this.mapStatus(payload.status),
      status: payload.status || '',
      timestamp: payload.statusDate || payload.updatedAt,
      description: payload.status,
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'pending',
      confirmed: 'pending',
      processing: 'in_transit',
      shipped: 'in_transit',
      in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      failed: 'failed',
      returned: 'returned',
      cancelled: 'failed',
    };
    return map[status?.toLowerCase()] || 'pending';
  }

  async testCredentials(apiKey: string, _storeId?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${API_BASE}/api/v2/orders/TEST`, {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid MDM API key — access denied' };
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data?.message || `MDM API error ${response.status}` };
      }
      return { success: true, message: 'MDM Express credentials verified successfully' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to MDM Express API' };
    }
  }
}
