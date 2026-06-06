// Noest Courier Service
// Per NOEST PDF (API SPECIFICATION – ECOTRACK):
// - Base URL: https://app.noest-dz.com
// - Auth is passed as body fields: api_token + user_guid
// - Order flow: create -> validate (created order is not visible until validated)

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

interface NoestCreateOrderResponse {
  success?: boolean;
  tracking?: string;
  [key: string]: any;
}

export class NoestService implements CourierService {
  private readonly baseUrl = (process.env.NOEST_API_URL || 'https://app.noest-dz.com').replace(/\/$/, '');

  // Fetch a PDF label from Noest (API SPECIFICATION – ECOTRACK)
  // GET /api/public/get/order/label?api_token=...&tracking=...
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
            `Noest label fetch failed: HTTP ${response.status} (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      const ab = await response.arrayBuffer();
      const pdf = Buffer.from(new Uint8Array(ab));
      if (!pdf.length) {
        return { ok: false, error: 'Noest label fetch returned empty body' };
      }

      return { ok: true, pdf };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Noest label fetch failed' };
    }
  }

  private async readApiResponse(response: Response): Promise<{ json: any | null; text: string; contentType: string }> {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    const looksJson = contentType.includes('application/json') || /^[\s\r\n]*[\[{]/.test(text);
    if (!looksJson) return { json: null, text, contentType };

    try {
      return { json: JSON.parse(text), text, contentType };
    } catch {
      return { json: null, text, contentType };
    }
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private getDefaultWilayaId(): number {
    const envValue = Number(process.env.NOEST_DEFAULT_WILAYA_ID);
    if (Number.isFinite(envValue) && envValue > 0) return envValue;
    // Fallback to a common wilaya id seen in the PDF examples (16).
    return 16;
  }

  private getDefaultCommune(): string {
    // Use a commonly accepted commune name.
    return (process.env.NOEST_DEFAULT_COMMUNE || 'Alger Centre').trim() || 'Alger Centre';
  }

  private async postJson(path: string, payload: any): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async createShipment(shipment: ShipmentInput, apiKey: string, guid?: string): Promise<CourierShipmentResponse> {
    try {
      if (!guid) {
        return {
          success: false,
          tracking_number: '',
          error: 'Noest requires user_guid (secondary credential) in the integration',
        };
      }

      const reference = shipment.reference_id || `ORDER-${Date.now()}`;
      const wilayaFromExtra = Number((shipment as any)?.wilaya_id);
      const wilayaFromShipment = Number((shipment as any)?.wilaya);
      const wilayaId = Number.isFinite(wilayaFromExtra) && wilayaFromExtra > 0
        ? wilayaFromExtra
        : Number.isFinite(wilayaFromShipment) && wilayaFromShipment > 0
          ? wilayaFromShipment
          : this.getDefaultWilayaId();

      const communeName = String((shipment as any)?.commune || '').trim();
      const communeId = Number((shipment as any)?.commune_id);

      const basePayload = {
        api_token: apiKey,
        user_guid: guid,
        reference,
        client: shipment.customer_name || 'Customer',
        phone: this.normalizePhone(shipment.customer_phone || ''),
        adresse: shipment.delivery_address || '',
        wilaya_id: wilayaId,
        montant: shipment.cod_amount ?? 0,
        remarque: shipment.notes || '',
        produit: shipment.product_description || `Order ${reference}`,
        type_id: 1,
        poids: Math.max(1, Math.round(Number(shipment.weight ?? 1))),
        stop_desk: 0,
        stock: 0,
      };

      const tryCreate = async (communeValue: string | number) => {
        const payload = { ...basePayload, commune: communeValue };
        const response = await this.postJson('/api/public/create/order', payload);
        const parsed = await this.readApiResponse(response);
        const data = (parsed.json ?? {}) as NoestCreateOrderResponse;
        return { response, parsed, data };
      };

      const candidates: Array<string | number> = [];
      if (communeName) candidates.push(communeName);
      // If we have a numeric commune ID, keep it as a retry candidate (some validations expect IDs).
      if (Number.isFinite(communeId) && communeId > 0) candidates.push(communeId);
      candidates.push(this.getDefaultCommune());

      // De-dup while preserving order.
      const seen = new Set<string>();
      const deduped = candidates.filter((c) => {
        const key = typeof c === 'number' ? `n:${c}` : `s:${c}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let lastError: { response: Response; parsed: { json: any | null; text: string; contentType: string }; data: NoestCreateOrderResponse } | null = null;
      let created: { response: Response; parsed: { json: any | null; text: string; contentType: string }; data: NoestCreateOrderResponse } | null = null;

      for (const communeValue of deduped) {
        const attempt = await tryCreate(communeValue);
        if (attempt.response.ok) {
          created = attempt;
          break;
        }
        lastError = attempt;

        const errors = (attempt.data as any)?.errors;
        const communeErrors = errors?.commune;
        const isCommuneInvalid = Array.isArray(communeErrors) && communeErrors.length > 0;
        if (!isCommuneInvalid) break; // Not a commune validation issue; don't retry.
      }

      if (!created) {
        const err = lastError;
        const snippet = (err?.parsed.text || '').slice(0, 400);
        console.error('[Noest] Create order error:', {
          url: `${this.baseUrl}/api/public/create/order`,
          status: err?.response.status,
          contentType: err?.parsed.contentType,
          bodySnippet: snippet,
          data: err?.data,
        });

        return {
          success: false,
          tracking_number: '',
          error:
            (err?.data as any)?.message ||
            (err?.data as any)?.error ||
            `API Error ${err?.response.status || 0} (${err?.parsed.contentType || 'unknown content-type'}): ${snippet || 'empty response'}`,
        };
      }

      const { response, parsed, data } = created;
      const { json, text, contentType } = parsed;

      if (!json) {
        return {
          success: false,
          tracking_number: '',
          error: `API returned non-JSON success response (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      if (!data?.success) {
        return {
          success: false,
          tracking_number: '',
          error: (data as any)?.message || (data as any)?.error || 'Noest create order failed',
        };
      }

      const tracking = String(data?.tracking || '').trim();
      if (!tracking) {
        return {
          success: false,
          tracking_number: '',
          error: 'Noest create order succeeded but no tracking was returned',
        };
      }

      return {
        success: true,
        tracking_number: tracking,
        reference_id: reference,
      };
    } catch (error: any) {
      console.error('[Noest] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error?.message || 'Order creation failed',
      };
    }
  }

  async getStatus(trackingNumber: string, apiKey: string, guid?: string): Promise<CourierStatusResponse> {
    try {
      if (!guid) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: 'Noest requires user_guid (secondary credential) in the integration',
        };
      }

      // PDF: POST /api/public/get/trackings/info with { api_token, user_guid, trackings: [] }
      const response = await this.postJson('/api/public/get/trackings/info', {
        api_token: apiKey,
        user_guid: guid,
        trackings: [trackingNumber],
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

      const entry = (data as any)?.[trackingNumber] || (data as any)?.data?.[trackingNumber];
      const status = String(entry?.OrderInfo?.status || entry?.OrderInfo?.status_label || entry?.status || 'unknown');
      return { tracking_number: trackingNumber, status, events: [] };
    } catch (error: any) {
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error?.message || 'Status fetch failed',
      };
    }
  }

  verifyWebhook(): boolean {
    // Noest webhooks not implemented.
    return false;
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload?.tracking_number || payload?.tracking_code,
      event_type: payload?.event_type || 'in_transit',
      status: payload?.status || 'unknown',
      timestamp: payload?.timestamp,
      location: payload?.location,
      description: payload?.description,
    };
  }

  async testCredentials(apiKey: string, guid?: string): Promise<import('../courier-service').CourierTestResult> {
    if (!guid) {
      return { success: false, message: 'Noest requires GUID (second field)' };
    }
    try {
      const response = await this.postJson('/api/public/get/trackings/info', {
        api_token: apiKey,
        user_guid: guid,
        trackings: ['TEST'],
      });
      const { json } = await this.readApiResponse(response);
      const data = json ?? {};
      // Noest returns error messages for invalid tokens
      if (data?.message && /invalid|unauthorized|token|expired/i.test(String(data.message))) {
        return { success: false, message: `Noest: ${data.message}` };
      }
      if (!response.ok && response.status >= 400 && response.status < 500) {
        return { success: false, message: data?.message || data?.error || `Noest API error ${response.status}` };
      }
      // 200 with any response = credentials are valid
      return { success: true, message: 'Noest credentials verified successfully' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Noest API' };
    }
  }
}
