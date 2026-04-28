/**
 * Maystro Delivery Courier Service Integration
 * Features: Warehousing (3K+ stores), 600+ drivers, packaging, call center
 * API: https://api.maystro-delivery.com/v1
 */

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

/**
 * Response structure from Maystro API for order/shipment
 */
interface MaystroOrderResponse {
  id: number;
  tracking_id: string;
  external_id: string;
  status: string;
  status_label: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    wilaya: string;
    commune: string;
  };
  order: {
    product: string;
    cod: number;
    shipping_fee: number;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Maystro courier service implementation
 * Handles shipment creation, tracking, and webhook verification
 */
export class MaystroService implements CourierService {
  private readonly apiUrl = 'https://api.maystro-delivery.com/v1';

  /**
   * Create a shipment/order on Maystro platform
   */
  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    storeId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const payload = {
        external_id: shipment.reference_id || `ORD-${Date.now()}`,
        customer: {
          name: shipment.customer_name || 'Customer',
          phone: shipment.customer_phone || '',
          address: shipment.delivery_address || '',
          wilaya: shipment.wilaya || 'Alger',
          commune: shipment.commune || 'Alger Centre',
        },
        order: {
          product: shipment.product_description || 'Products',
          cod: shipment.cod_amount || 0,
          weight: shipment.weight || 1,
          note: shipment.notes || '',
        },
      };

      const response = await fetch(`${this.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Store-ID': storeId || '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Maystro] Create order error:', data);
        return {
          success: false,
          tracking_number: '',
          error: data.message || data.error || `API Error ${response.status}`,
        };
      }

      const order: MaystroOrderResponse = data;

      return {
        success: true,
        tracking_number: order.tracking_id,
        reference_id: order.external_id,
      };
    } catch (error: any) {
      console.error('[Maystro] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Order creation failed',
      };
    }
  }

  /**
   * Get shipment status from Maystro API
   */
  async getStatus(
    trackingNumber: string,
    apiKey: string,
    storeId?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/orders/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Store-ID': storeId || '',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data.message || 'Failed to fetch status',
        };
      }

      const order: MaystroOrderResponse = data;

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(order.status),
        last_update: order.updated_at,
        location: order.customer.wilaya,
        events: [],
      };
    } catch (error: any) {
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error.message || 'Status fetch failed',
      };
    }
  }

  /**
   * Verify webhook authenticity using HMAC-SHA256
   */
  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  /**
   * Parse incoming webhook payload and normalize to standard format
   */
  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking_id || payload.tracking_number,
      event_type: this.mapStatus(payload.status),
      status: payload.status,
      timestamp: payload.updated_at || payload.timestamp,
      location: payload.customer?.wilaya || payload.location,
      description: payload.status_label || payload.description,
    };
  }

  /**
   * Map Maystro delivery statuses to platform-standard statuses
   */
  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'pending',
      'picked_up': 'in_transit',
      'in_transit': 'in_transit',
      'at_hub': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'failed': 'failed',
      'returned': 'returned',
      'cancelled': 'cancelled',
    };
    return statusMap[status] || 'pending';
  }
}
