// Zimou Express Courier Service
// API documentation: https://zimou.express/docs
// Base URL: https://zimou.express/api/v1

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

interface ZimouPackageResponse {
  id: number;
  tracking: string;
  name: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  address: string;
  wilaya: string;
  commune: string;
  price: number;
  weight: number;
  status: string;
  created_at: string;
}

interface ZimouStatusResponse {
  tracking: string;
  status: string;
  status_label?: string;
  updated_at?: string;
}

export class ZimouExpressService implements CourierService {
  private readonly apiUrl = 'https://zimou.express/api/v1';

  /**
   * Zimou Express uses Bearer token authentication
   * apiKey = Bearer token from login
   */
  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    _apiSecret?: string
  ): Promise<CourierShipmentResponse> {
    try {
      // Parse customer name into first and last name
      const nameParts = (shipment.customer_name || 'Customer').split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || firstName;

      const payload = {
        name: shipment.product_description || `Order ${shipment.reference_id}`,
        client_first_name: firstName,
        client_last_name: lastName,
        client_phone: shipment.customer_phone || '',
        client_phone2: '',
        address: shipment.delivery_address || '',
        commune: shipment.commune || 'Alger Centre',
        wilaya: shipment.wilaya || 'Alger',
        order_id: shipment.reference_id || `ORD-${Date.now()}`,
        weight: (shipment.weight || 1) * 1000, // Convert kg to grams
        delivery_type: 'express',
        price: shipment.cod_amount || 0,
        free_delivery: shipment.cod_amount === 0 ? 1 : 0,
        can_be_opened: 1,
        type: 'ecommerce',
        observation: shipment.notes || '',
      };

      const response = await fetch(`${this.apiUrl}/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: any;
      
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[ZimouExpress] Non-JSON response:', text.slice(0, 500));
        return {
          success: false,
          tracking_number: '',
          error: `Invalid response from server: ${text.slice(0, 200)}`,
        };
      }

      if (!response.ok) {
        console.error('[ZimouExpress] Create package error:', data);
        return {
          success: false,
          tracking_number: '',
          error: data.message || data.error || `API Error ${response.status}`,
        };
      }

      // Response format: { error: 0, data: { tracking_code: "ZIM-xxx", bordereau: "url" } }
      const tracking = data.data?.tracking_code || data.tracking_code || data.tracking || data.data?.tracking;
      const labelUrl = data.data?.bordereau || data.bordereau;

      if (!tracking) {
        console.error('[ZimouExpress] No tracking in response:', data);
        return {
          success: false,
          tracking_number: '',
          error: 'No tracking number returned',
        };
      }

      return {
        success: true,
        tracking_number: tracking,
        label_url: labelUrl,
        reference_id: shipment.reference_id,
      };
    } catch (error: any) {
      console.error('[ZimouExpress] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Package creation failed',
      };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    _apiSecret?: string
  ): Promise<CourierStatusResponse> {
    try {
      // Get status using the packages/status endpoint with array parameter
      const response = await fetch(
        `${this.apiUrl}/packages/status?packages[]=${encodeURIComponent(trackingNumber)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      const text = await response.text();
      let data: any;
      
      try {
        data = JSON.parse(text);
      } catch {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: 'Invalid response from server',
        };
      }

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data.message || data.error || `API Error ${response.status}`,
        };
      }

      // Response is an array of package statuses
      const packageStatus = Array.isArray(data) ? data[0] : data;
      const status = packageStatus?.status || 'unknown';

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(status),
        last_update: packageStatus?.updated_at,
      };
    } catch (error: any) {
      console.error('[ZimouExpress] getStatus exception:', error);
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error.message || 'Status check failed',
      };
    }
  }

  async cancelShipment(
    trackingNumber: string,
    apiKey: string,
    _apiSecret?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Zimou Express API doesn't document a cancel endpoint
    // Return not supported
    return {
      success: false,
      error: 'Cancel not supported via API - contact Zimou Express directly',
    };
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking || payload.tracking_number,
      event_type: this.mapStatus(payload.status),
      status: payload.status,
      timestamp: payload.updated_at || payload.timestamp,
      location: payload.wilaya || payload.location,
      description: payload.status_label || payload.description,
    };
  }

  private mapStatus(zimouStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'en_attente': 'pending',
      'picked_up': 'picked_up',
      'ramasse': 'picked_up',
      'in_transit': 'in_transit',
      'en_cours': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'en_livraison': 'out_for_delivery',
      'delivered': 'delivered',
      'livre': 'delivered',
      'returned': 'returned',
      'retourne': 'returned',
      'cancelled': 'cancelled',
      'annule': 'cancelled',
    };

    return statusMap[zimouStatus.toLowerCase()] || zimouStatus;
  }

  async testCredentials(apiKey: string, _apiSecret?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${this.apiUrl}/packages/status?packages[]=TEST`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid Zimou Express API token — access denied' };
      }
      if (!response.ok) {
        const text = await response.text();
        let data: any; try { data = JSON.parse(text); } catch { data = {}; }
        return { success: false, message: data?.message || data?.error || `Zimou API error ${response.status}` };
      }
      return { success: true, message: 'Zimou Express credentials verified successfully' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Zimou Express API' };
    }
  }
}
