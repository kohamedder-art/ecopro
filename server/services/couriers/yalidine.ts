// Yalidine Express Courier Service
// Real API integration based on Yalidine API documentation
// API Docs: https://yalidine.app/app/dev/docs/api/

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

// Yalidine API response types
interface YalidineParcelResponse {
  id: number;
  tracking: string;
  order_id: string;
  from_wilaya_name: string;
  to_wilaya_name: string;
  to_commune_name: string;
  has_exchange: boolean;
  product_to_collect: string | null;
  is_stopdesk: boolean;
  stopdesk_id: number | null;
  price: number;
  freeshipping: boolean;
  do_insurance: boolean;
  declared_value: number | null;
  product_list: string;
  height: number;
  width: number;
  length: number;
  weight: number;
  firstname: string;
  familyname: string;
  contact_phone: string;
  address: string;
  delivery_fee: number | null;
  cod_to_pay: number;
  status: string;
  status_label: string;
  pdf_label: string;
}

interface YalidineWilaya {
  id: number;
  name: string;
}

interface YalidineCommune {
  id: number;
  name: string;
  wilaya_id: number;
}

interface YalidineCreateParcelPayload {
  order_id: string;
  firstname: string;
  familyname: string;
  contact_phone: string;
  address: string;
  to_commune_name: string;
  to_wilaya_name: string;
  product_list: string;
  price: number;
  freeshipping?: boolean;
  is_stopdesk?: boolean;
  stopdesk_id?: number;
  has_exchange?: boolean;
  product_to_collect?: string;
  do_insurance?: boolean;
  declared_value?: number;
  height?: number;
  width?: number;
  length?: number;
  weight?: number;
}

export class YalidineService implements CourierService {
  // Real Yalidine API endpoint
  private readonly apiUrl = 'https://api.yalidine.app/v1';

  /**
   * Create shipment using Yalidine API
   * POST /v1/parcels/
   */
  async createShipment(
    shipment: ShipmentInput, 
    apiKey: string,
    apiId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      // Parse customer name into first/last name
      const nameParts = (shipment.customer_name || '').trim().split(' ');
      const firstname = nameParts[0] || 'Customer';
      const familyname = nameParts.slice(1).join(' ') || '';

      // Build Yalidine parcel payload
      const payload: YalidineCreateParcelPayload = {
        order_id: shipment.reference_id || `ORD-${Date.now()}`,
        firstname,
        familyname,
        contact_phone: shipment.customer_phone || '',
        address: shipment.delivery_address || '',
        to_commune_name: shipment.commune || 'Alger Centre', // Default commune
        to_wilaya_name: shipment.wilaya || 'Alger', // Default wilaya
        product_list: shipment.product_description || 'Products',
        price: shipment.cod_amount || 0, // COD amount in DZD
        freeshipping: !shipment.cod_amount, // Free shipping if no COD
        is_stopdesk: shipment.is_stopdesk || false,
        weight: shipment.weight || 1,
      };

      // API request with proper headers
      const response = await fetch(`${this.apiUrl}/parcels/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        console.error('[Yalidine] Create shipment error:', data);
        return {
          success: false,
          tracking_number: '',
          error: data.message || data.error || `API Error ${response.status}`,
        };
      }

      // Success - extract tracking info
      const parcel: YalidineParcelResponse = data;
      
      return {
        success: true,
        tracking_number: parcel.tracking,
        label_url: parcel.pdf_label,
        reference_id: parcel.order_id,
        estimated_delivery: undefined, // Yalidine doesn't provide this directly
      };
    } catch (error: any) {
      console.error('[Yalidine] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Shipment creation failed',
      };
    }
  }

  /**
   * Get parcel status using Yalidine API
   * GET /v1/parcels/{tracking}
   */
  async getStatus(
    trackingNumber: string, 
    apiKey: string,
    apiId?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/parcels/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
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

      const parcel: YalidineParcelResponse = data;

      return {
        tracking_number: trackingNumber,
        status: this.mapYalidineStatus(parcel.status),
        last_update: undefined,
        location: parcel.to_wilaya_name,
        events: [], // History endpoint needed for full events
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
   * Get all wilayas (provinces) from Yalidine
   * GET /v1/wilayas/
   */
  async getWilayas(apiKey: string, apiId?: string): Promise<YalidineWilaya[]> {
    try {
      const response = await fetch(`${this.apiUrl}/wilayas/`, {
        method: 'GET',
        headers: {
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
        },
      });
      
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Get communes for a wilaya
   * GET /v1/communes/?wilaya_id={id}
   */
  async getCommunes(wilayaId: number, apiKey: string, apiId?: string): Promise<YalidineCommune[]> {
    try {
      const response = await fetch(`${this.apiUrl}/communes/?wilaya_id=${wilayaId}`, {
        method: 'GET',
        headers: {
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
        },
      });
      
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Calculate delivery fees
   * GET /v1/deliveryfees/?from_wilaya_id={id}&to_wilaya_id={id}&weight={weight}&is_stopdesk={bool}
   */
  async getDeliveryFees(
    fromWilayaId: number,
    toWilayaId: number,
    weight: number,
    isStopdesk: boolean,
    apiKey: string,
    apiId?: string
  ): Promise<{ home_fee: number; desk_fee: number } | null> {
    try {
      const params = new URLSearchParams({
        from_wilaya_id: fromWilayaId.toString(),
        to_wilaya_id: toWilayaId.toString(),
        weight: weight.toString(),
        is_stopdesk: isStopdesk.toString(),
      });
      
      const response = await fetch(`${this.apiUrl}/deliveryfees/?${params}`, {
        method: 'GET',
        headers: {
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
        },
      });
      
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Generate shipping label PDF
   * GET /v1/labels/{tracking}/
   */
  async getLabel(trackingNumber: string, apiKey: string, apiId?: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiUrl}/labels/${trackingNumber}/`, {
        method: 'GET',
        headers: {
          'X-API-ID': apiId || apiKey,
          'X-API-TOKEN': apiKey,
        },
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.pdf_label || null;
    } catch {
      return null;
    }
  }

  /**
   * Verify webhook signature from Yalidine
   */
  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  /**
   * Parse Yalidine webhook payload
   */
  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking || payload.tracking_number,
      event_type: this.mapYalidineStatus(payload.status),
      status: payload.status,
      timestamp: payload.updated_at || payload.timestamp,
      location: payload.to_wilaya_name || payload.location,
      description: payload.status_label || payload.description,
    };
  }

  /**
   * Map Yalidine status codes to standard status
   */
  private mapYalidineStatus(status: string): string {
    const statusMap: Record<string, string> = {
      // Yalidine status codes
      'En preparation': 'pending',
      'Expediee': 'in_transit',
      'Au centre': 'in_transit',
      'En attente du client': 'out_for_delivery',
      'Sortie en livraison': 'out_for_delivery',
      'Livree': 'delivered',
      'Echec livraison': 'failed',
      'Retournee': 'returned',
      'Retournee expediteur': 'returned',
      'Prete au retrait': 'ready_for_pickup',
    };
    
    return statusMap[status] || 'pending';
  }

  async testCredentials(apiKey: string, apiId?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${this.apiUrl}/wilayas/`, {
        method: 'GET',
        headers: { 'X-API-ID': apiId || apiKey, 'X-API-TOKEN': apiKey },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data?.message || data?.error || `Yalidine API error ${response.status}` };
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, message: 'Unexpected response from Yalidine API' };
      }
      return { success: true, message: `Yalidine connected — ${data.length} wilayas available` };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Yalidine API' };
    }
  }
}
