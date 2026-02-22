// DHD Livraison Express Courier Service
// Website: https://dhd-dz.com
// DHD is an Ecotrack-powered delivery company covering 55 wilayas in Algeria
// Founded in March 2019, specializing in express home delivery
// Services: Livraison, Stockage, Emballage, Ramassage, Échange, COD
// Contact: commercialedhd@gmail.com | 0770 064 917 | 0770 072 154
// HQ: Zone Industrielle, Ouled Yaich, Blida

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

interface DhdOrderResponse {
  id: number;
  tracking_code: string;
  tracking?: string;
  reference: string;
  status: string;
  status_label: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  wilaya: string;
  commune: string;
  cod_amount: number;
  delivery_fee: number;
  label_url?: string;
  created_at: string;
  updated_at: string;
}

export class DhdService implements CourierService {
  // DHD uses an Ecotrack-powered platform
  private readonly baseUrl = (process.env.DHD_API_URL || 'https://app.dhd-dz.com').replace(/\/$/, '');

  private async readApiResponse(response: Response): Promise<{ json: any | null; text: string; contentType: string }> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    const looksJson = contentType.includes('application/json') || /^[\s\r\n]*[\[{]/.test(text);
    if (!looksJson) {
      return { json: null, text, contentType };
    }

    try {
      return { json: JSON.parse(text), text, contentType };
    } catch {
      return { json: null, text, contentType };
    }
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    guid?: string
  ): Promise<CourierShipmentResponse> {
    try {
      if (!guid) {
        return {
          success: false,
          tracking_number: '',
          error: 'DHD requires user_guid (secondary credential) in the integration',
        };
      }

      const reference = shipment.reference_id || `ORD-${Date.now()}`;
      const wilayaFromExtra = Number((shipment as any)?.wilaya_id);
      const wilayaFromShipment = Number((shipment as any)?.wilaya);
      const wilayaId = Number.isFinite(wilayaFromExtra) && wilayaFromExtra > 0
        ? wilayaFromExtra
        : Number.isFinite(wilayaFromShipment) && wilayaFromShipment > 0
          ? wilayaFromShipment
          : 16; // Default to Alger

      const communeName = String((shipment as any)?.commune || '').trim() || 'Alger Centre';
      const communeId = Number((shipment as any)?.commune_id);

      // DHD Ecotrack API payload - follows same structure as Noest/Anderson Ecotrack APIs
      const payload = {
        api_token: apiKey,
        user_guid: guid,
        reference,
        client: shipment.customer_name || 'Customer',
        phone: this.normalizePhone(shipment.customer_phone || ''),
        adresse: shipment.delivery_address || '',
        wilaya_id: wilayaId,
        commune: Number.isFinite(communeId) && communeId > 0 ? communeId : communeName,
        montant: shipment.cod_amount ?? 0,
        remarque: shipment.notes || '',
        produit: shipment.product_description || `Order ${reference}`,
        type_id: 1, // Standard delivery
        poids: Math.max(1, Math.round(Number(shipment.weight ?? 1))),
        stop_desk: shipment.is_stopdesk ? 1 : 0,
        stock: 0,
      };

      const response = await fetch(`${this.baseUrl}/api/public/create/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        const snippet = text.slice(0, 400);
        console.error('[DHD] Create order error:', {
          status: response.status,
          contentType,
          bodySnippet: snippet,
          data,
        });
        return {
          success: false,
          tracking_number: '',
          error:
            (data?.message || data?.error) ??
            `API Error ${response.status} (${contentType || 'unknown content-type'}): ${snippet || 'empty response'}`,
        };
      }

      if (!json) {
        return {
          success: false,
          tracking_number: '',
          error: `API returned non-JSON success response (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      // Extract tracking from response - handle both Ecotrack field patterns
      const tracking =
        data?.tracking ||
        data?.tracking_code ||
        data?.data?.tracking ||
        data?.data?.tracking_code ||
        '';

      if (!tracking) {
        console.error('[DHD] No tracking in response:', data);
        return {
          success: false,
          tracking_number: '',
          error: 'No tracking number returned from DHD',
        };
      }

      // Try to validate the order if the API requires it (Ecotrack pattern)
      try {
        await this.validateOrder(tracking, apiKey, guid);
      } catch (validationErr: any) {
        console.warn('[DHD] Order validation step failed (non-fatal):', validationErr?.message);
      }

      return {
        success: true,
        tracking_number: tracking,
        label_url: data?.label_url || data?.data?.label_url,
        reference_id: reference,
      };
    } catch (error: any) {
      console.error('[DHD] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Order creation failed',
      };
    }
  }

  /**
   * Validate/confirm an order (Ecotrack pattern: created orders must be validated to become visible)
   */
  private async validateOrder(tracking: string, apiKey: string, guid: string): Promise<void> {
    const payload = {
      api_token: apiKey,
      user_guid: guid,
      tracking,
    };

    const response = await fetch(`${this.baseUrl}/api/public/validate/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const { text } = await this.readApiResponse(response);
      throw new Error(`Validate failed: HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    guid?: string
  ): Promise<CourierStatusResponse> {
    try {
      // Ecotrack-style status endpoint
      const url = new URL(`${this.baseUrl}/api/public/get/order/status`);
      url.searchParams.set('api_token', apiKey);
      url.searchParams.set('tracking', trackingNumber);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error:
            (data?.message || data?.error) ??
            `Failed to fetch status: HTTP ${response.status} (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      if (!json) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: `API returned non-JSON success response (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      const status = data?.status || data?.data?.status || 'unknown';

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(status),
        last_update: data?.updated_at || data?.data?.updated_at,
        location: data?.wilaya || data?.data?.wilaya,
        events: [],
      };
    } catch (error: any) {
      console.error('[DHD] getStatus exception:', error);
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error.message || 'Status fetch failed',
      };
    }
  }

  /**
   * Fetch a PDF label from DHD (Ecotrack pattern)
   */
  async getLabelPdf(tracking: string, apiKey: string): Promise<{ ok: true; pdf: Buffer } | { ok: false; error: string }> {
    try {
      const url = new URL(`${this.baseUrl}/api/public/get/order/label`);
      url.searchParams.set('api_token', apiKey);
      url.searchParams.set('tracking', tracking);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/pdf,application/octet-stream,application/json;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        const { json, text, contentType } = await this.readApiResponse(response);
        const data = json ?? {};
        return {
          ok: false,
          error:
            (data as any)?.message ||
            (data as any)?.error ||
            `DHD label fetch failed: HTTP ${response.status} (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      const ab = await response.arrayBuffer();
      const pdf = Buffer.from(new Uint8Array(ab));
      if (!pdf.length) {
        return { ok: false, error: 'DHD label fetch returned empty body' };
      }

      return { ok: true, pdf };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'DHD label fetch failed' };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking_code || payload.tracking || payload.tracking_number,
      event_type: this.mapStatus(payload.status),
      status: payload.status,
      timestamp: payload.updated_at || payload.timestamp,
      location: payload.wilaya || payload.location,
      description: payload.status_label || payload.description,
    };
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      // French status labels (DHD uses French)
      'en_attente': 'pending',
      'en attente': 'pending',
      'nouveau': 'pending',
      'confirme': 'pending',
      'confirmed': 'pending',
      'pending': 'pending',
      // Picked up
      'ramasse': 'in_transit',
      'picked_up': 'in_transit',
      'pris_en_charge': 'in_transit',
      // In transit
      'en_cours': 'in_transit',
      'en cours': 'in_transit',
      'in_transit': 'in_transit',
      'au_hub': 'in_transit',
      'at_hub': 'in_transit',
      'transfere': 'in_transit',
      // Out for delivery
      'en_livraison': 'out_for_delivery',
      'en livraison': 'out_for_delivery',
      'out_for_delivery': 'out_for_delivery',
      'sorti': 'out_for_delivery',
      // Delivered
      'livre': 'delivered',
      'livré': 'delivered',
      'delivered': 'delivered',
      // Failed
      'echec': 'failed',
      'échoué': 'failed',
      'failed': 'failed',
      'tentative': 'failed',
      // Returned
      'retourne': 'returned',
      'retourné': 'returned',
      'returned': 'returned',
      // Cancelled
      'annule': 'cancelled',
      'annulé': 'cancelled',
      'cancelled': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'pending';
  }
}
