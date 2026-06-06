// Guepex Courier Service
// Real API integration - Similar structure to Yalidine
// Coverage: 160+ bureaus across 58 wilayas

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

interface GuepexParcelResponse {
  id: number;
  tracking: string;
  order_id: string;
  from_wilaya_name: string;
  to_wilaya_name: string;
  to_commune_name: string;
  price: number;
  delivery_fee: number;
  cod_to_pay: number;
  status: string;
  status_label: string;
  pdf_label: string;
  firstname: string;
  familyname: string;
  contact_phone: string;
  address: string;
}

export class GuepexService implements CourierService {
  private readonly apiUrl = 'https://api.guepex.app/v1';

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    apiToken?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const nameParts = (shipment.customer_name || '').trim().split(' ');
      const firstname = nameParts[0] || 'Customer';
      const familyname = nameParts.slice(1).join(' ') || '';

      const payload = {
        order_id: shipment.reference_id || `ORD-${Date.now()}`,
        firstname,
        familyname,
        contact_phone: shipment.customer_phone || '',
        address: shipment.delivery_address || '',
        to_commune_name: shipment.commune || 'Alger Centre',
        to_wilaya_name: shipment.wilaya || 'Alger',
        product_list: shipment.product_description || 'Products',
        price: shipment.cod_amount || 0,
        freeshipping: !shipment.cod_amount,
        is_stopdesk: shipment.is_stopdesk || false,
        weight: shipment.weight || 1,
      };

      const response = await fetch(`${this.apiUrl}/parcels/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
          'X-API-TOKEN': apiToken || apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Guepex] Create shipment error:', data);
        return {
          success: false,
          tracking_number: '',
          error: data.message || data.error || `API Error ${response.status}`,
        };
      }

      const parcel: GuepexParcelResponse = data;

      return {
        success: true,
        tracking_number: parcel.tracking,
        label_url: parcel.pdf_label,
        reference_id: parcel.order_id,
      };
    } catch (error: any) {
      console.error('[Guepex] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Shipment creation failed',
      };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    apiToken?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/parcels/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'X-API-TOKEN': apiToken || apiKey,
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

      const parcel: GuepexParcelResponse = data;

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(parcel.status),
        location: parcel.to_wilaya_name,
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
      location: payload.to_wilaya_name || payload.location,
      description: payload.status_label || payload.description,
    };
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'En preparation': 'pending',
      'Expediee': 'in_transit',
      'Au centre': 'in_transit',
      'En attente du client': 'out_for_delivery',
      'Sortie en livraison': 'out_for_delivery',
      'Livree': 'delivered',
      'Echec livraison': 'failed',
      'Retournee': 'returned',
      'Prete au retrait': 'ready_for_pickup',
    };
    return statusMap[status] || 'pending';
  }

  async testCredentials(apiKey: string, apiToken?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${this.apiUrl}/wilayas/`, {
        method: 'GET',
        headers: { 'X-API-KEY': apiKey, 'X-API-TOKEN': apiToken || apiKey },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data?.message || data?.error || `Guepex API error ${response.status}` };
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, message: 'Unexpected response from Guepex API' };
      }
      return { success: true, message: `Guepex connected — ${data.length} wilayas available` };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Guepex API' };
    }
  }
}
