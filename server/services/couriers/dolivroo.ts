// Dolivroo Aggregator Service
// Unified API for multiple Algerian delivery providers
// Website: https://dolivroo.com

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

interface DolivrooStatusEvent {
  status?: string;
  state?: string;
  event?: string;
  timestamp?: string;
  created_at?: string;
  updated_at?: string;
  location?: string;
  wilaya?: string;
  commune?: string;
  description?: string;
  message?: string;
}

interface DolivrooParcelRecord {
  tracking_id?: string;
  tracking_number?: string;
  reference?: string;
  status?: string;
  status_label?: string;
  label_url?: string;
  provider?: string;
  company_code?: string;
  created_at?: string;
  updated_at?: string;
  recipient?: {
    name?: string;
    phone?: string;
    address?: string;
    wilaya?: string;
    commune?: string;
  };
  order?: {
    reference?: string;
    destination?: {
      wilaya?: string;
      commune?: string;
    };
    customer?: {
      address?: string;
    };
  };
  parcel?: {
    label_url?: string;
  };
  label?: {
    url?: string;
  };
  events?: DolivrooStatusEvent[];
  history?: DolivrooStatusEvent[];
  timeline?: DolivrooStatusEvent[];
  [key: string]: any;
}

export class DolivrooService implements CourierService {
  private readonly apiUrl = 'https://dolivroo.com/api/v1/unified';

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

  private buildHeaders(
    apiKey: string,
    connectionLabel?: string,
    includeJsonContentType = true,
    accept = 'application/json'
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: accept,
    };

    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }

    if (connectionLabel) {
      headers['X-Connection-ID'] = connectionLabel;
    }

    return headers;
  }

  private normalizeCompanyCode(provider?: string): string {
    const raw = String(provider || '').trim().toLowerCase();
    if (!raw || raw === 'dolivroo' || raw === 'aggregator') return 'auto';

    const aliases: Record<string, string> = {
      auto: 'auto',
      yalidine: 'yalidine',
      'yalidine express': 'yalidine',
      ecotrack: 'ecotrack',
      maystro: 'maystro',
      'maystro delivery': 'maystro',
      'zr express': 'zr-express',
      'zr-express': 'zr-express',
      zrexpress: 'zr-express',
      noest: 'noest',
      dhd: 'dhd',
    };

    return aliases[raw] || raw;
  }

  private buildLookupUrl(path: string, companyCode?: string): string {
    const url = new URL(`${this.apiUrl}${path}`);
    url.searchParams.set('company_code', this.normalizeCompanyCode(companyCode));
    return url.toString();
  }

  private splitCustomerName(fullName: string): { first_name: string; last_name: string } {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { first_name: 'Customer', last_name: '' };
    }

    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(' '),
    };
  }

  private getResponsePayload<T extends Record<string, any>>(json: any): T {
    if (json?.data && typeof json.data === 'object') {
      return json.data as T;
    }

    return (json || {}) as T;
  }

  private getParcelRecord(json: any): DolivrooParcelRecord {
    const payload = this.getResponsePayload<Record<string, any>>(json);
    if (payload?.parcel && typeof payload.parcel === 'object') {
      return payload.parcel as DolivrooParcelRecord;
    }

    return payload as DolivrooParcelRecord;
  }

  private getTrackingNumber(parcel: DolivrooParcelRecord): string {
    return String(
      parcel?.tracking_id ||
        parcel?.tracking_number ||
        parcel?.id ||
        ''
    ).trim();
  }

  private getLabelUrl(parcel: DolivrooParcelRecord): string | undefined {
    const labelUrl = String(
      parcel?.label_url ||
        parcel?.parcel?.label_url ||
        parcel?.label?.url ||
        ''
    ).trim();

    return labelUrl || undefined;
  }

  private getReference(parcel: DolivrooParcelRecord): string | undefined {
    const reference = String(parcel?.reference || parcel?.order?.reference || '').trim();
    return reference || undefined;
  }

  private getLocation(source: Partial<DolivrooParcelRecord & DolivrooStatusEvent> | undefined): string | undefined {
    if (!source) return undefined;

    const direct = String(source.location || '').trim();
    if (direct) return direct;

    const commune = String(source.commune || '').trim();
    const wilaya = String(source.wilaya || '').trim();
    const joined = [commune, wilaya].filter(Boolean).join(', ');
    return joined || undefined;
  }

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    connectionLabel?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const normalizedConnectionLabel = String(connectionLabel || '').trim() || undefined;
      const companyCode = this.normalizeCompanyCode(shipment.provider);
      const customerName = this.splitCustomerName(shipment.customer_name || 'Customer');
      const payload = {
        company_code: companyCode,
        ...(normalizedConnectionLabel ? { connection_label: normalizedConnectionLabel } : {}),
        order: {
          reference: shipment.reference_id || `ORDER-${Date.now()}`,
          customer: {
            first_name: customerName.first_name,
            last_name: customerName.last_name,
            phone: shipment.customer_phone || '',
            address: shipment.delivery_address || '',
            ...(shipment.customer_email ? { email: shipment.customer_email } : {}),
          },
          destination: {
            wilaya: shipment.wilaya || 'Alger',
            commune: shipment.commune || 'Alger Centre',
          },
          package: {
            products: shipment.product_description || shipment.notes || 'Products',
            weight: shipment.weight || 1,
          },
          payment: {
            amount: shipment.cod_amount || 0,
            free_shipping: !shipment.cod_amount,
          },
          options: {
            delivery_type: shipment.is_stopdesk ? 'stopdesk' : 'home',
            exchange: false,
          },
        },
      };

      const response = await fetch(`${this.apiUrl}/parcels`, {
        method: 'POST',
        headers: this.buildHeaders(apiKey, normalizedConnectionLabel),
        body: JSON.stringify(payload),
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        const snippet = text.slice(0, 400);
        console.error('[Dolivroo] Create parcel error:', {
          status: response.status,
          contentType,
          bodySnippet: snippet,
          data,
        });

        return {
          success: false,
          tracking_number: '',
          error:
            (data?.message || data?.error || data?.hint) ??
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

      const parcel = this.getParcelRecord(json);
      const trackingNumber = this.getTrackingNumber(parcel);

      if (!trackingNumber) {
        return {
          success: false,
          tracking_number: '',
          error: 'Dolivroo did not return a tracking number',
        };
      }

      return {
        success: true,
        tracking_number: trackingNumber,
        label_url: this.getLabelUrl(parcel),
        reference_id: this.getReference(parcel),
        company_code: String(parcel.company_code || parcel.provider || companyCode || '').trim() || companyCode,
        provider: String(parcel.provider || parcel.company_code || companyCode || '').trim() || companyCode,
      };
    } catch (error: any) {
      console.error('[Dolivroo] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Parcel creation failed',
      };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    connectionLabel?: string,
    companyCode?: string
  ): Promise<CourierStatusResponse> {
    try {
      const normalizedConnectionLabel = String(connectionLabel || '').trim() || undefined;
      const response = await fetch(this.buildLookupUrl(`/parcels/${encodeURIComponent(trackingNumber)}`, companyCode), {
        method: 'GET',
        headers: this.buildHeaders(apiKey, normalizedConnectionLabel, false),
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error:
            (data?.message || data?.error || data?.hint) ??
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

      const parcel = this.getParcelRecord(json);
      const sourceEvents = [
        ...(Array.isArray(parcel.events) ? parcel.events : []),
        ...(Array.isArray(parcel.history) ? parcel.history : []),
        ...(Array.isArray(parcel.timeline) ? parcel.timeline : []),
      ];

      const events = sourceEvents
        .map((event) => ({
          type: this.mapStatus(String(event.status || event.state || event.event || 'pending')),
          timestamp: String(event.timestamp || event.created_at || event.updated_at || parcel.updated_at || parcel.created_at || '').trim(),
          location: this.getLocation(event),
          description: String(event.description || event.message || event.status || event.state || event.event || '').trim() || undefined,
        }))
        .filter((event) => event.timestamp);

      return {
        tracking_number: this.getTrackingNumber(parcel) || trackingNumber,
        status: this.mapStatus(String(parcel.status || data?.status || 'pending')),
        last_update: String(parcel.updated_at || data?.updated_at || '').trim() || undefined,
        location:
          this.getLocation(parcel.recipient) ||
          this.getLocation(parcel.order?.destination) ||
          undefined,
        events,
      };
    } catch (error: any) {
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error.message || 'Status fetch failed',
      };
    }
  }

  async getLabelPdf(
    trackingNumber: string,
    apiKey: string,
    connectionLabel?: string,
    companyCode?: string
  ): Promise<{ ok: boolean; pdf?: Buffer; error?: string }> {
    try {
      const normalizedConnectionLabel = String(connectionLabel || '').trim() || undefined;
      const response = await fetch(this.buildLookupUrl(`/parcels/${encodeURIComponent(trackingNumber)}/label`, companyCode), {
        method: 'GET',
        headers: this.buildHeaders(apiKey, normalizedConnectionLabel, false, 'application/pdf'),
      });

      if (!response.ok) {
        const { json, text, contentType } = await this.readApiResponse(response);
        const data = json ?? {};
        return {
          ok: false,
          error:
            (data?.message || data?.error || data?.hint) ??
            `Failed to fetch label: HTTP ${response.status} (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const { json, text } = await this.readApiResponse(response);
        const parcel = this.getParcelRecord(json);
        const labelUrl = this.getLabelUrl(parcel);
        if (!labelUrl) {
          return {
            ok: false,
            error: `Label endpoint returned JSON without a downloadable label URL: ${text.slice(0, 200)}`,
          };
        }

        const labelResponse = await fetch(labelUrl, { method: 'GET' });
        if (!labelResponse.ok) {
          return {
            ok: false,
            error: `Failed to fetch label URL returned by Dolivroo: HTTP ${labelResponse.status}`,
          };
        }

        const labelBuffer = Buffer.from(await labelResponse.arrayBuffer());
        return { ok: true, pdf: labelBuffer };
      }

      const pdf = Buffer.from(await response.arrayBuffer());
      return { ok: true, pdf };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'Label fetch failed',
      };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  parseWebhookPayload(payload: any) {
    const parcel = this.getParcelRecord(payload);
    const latestEvent = Array.isArray(parcel.events) && parcel.events.length > 0
      ? parcel.events[parcel.events.length - 1]
      : payload;
    const rawStatus = String(
      latestEvent?.status || latestEvent?.state || latestEvent?.event || parcel.status || payload?.status || 'pending'
    ).trim();

    return {
      tracking_number: this.getTrackingNumber(parcel) || String(payload?.tracking_id || payload?.tracking_number || '').trim(),
      event_type: this.mapStatus(rawStatus),
      status: rawStatus,
      timestamp: String(
        latestEvent?.timestamp || latestEvent?.created_at || latestEvent?.updated_at || parcel.updated_at || payload?.timestamp || ''
      ).trim() || undefined,
      location:
        this.getLocation(latestEvent) ||
        this.getLocation(parcel.recipient) ||
        this.getLocation(parcel.order?.destination) ||
        undefined,
      description: String(
        latestEvent?.description || latestEvent?.message || parcel.status_label || payload?.description || rawStatus
      ).trim() || undefined,
    };
  }

  private mapStatus(status: string): string {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'pending';

    const statusMap: Record<string, string> = {
      pending: 'pending',
      confirmed: 'pending',
      created: 'pending',
      validated: 'pending',
      queued: 'pending',
      pickup_scheduled: 'pending',
      picked_up: 'in_transit',
      pickup: 'in_transit',
      in_transit: 'in_transit',
      transit: 'in_transit',
      sorting: 'in_transit',
      at_hub: 'in_transit',
      at_origin_hub: 'in_transit',
      at_destination_hub: 'in_transit',
      shipped: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      on_delivery: 'out_for_delivery',
      en_livraison: 'out_for_delivery',
      delivered: 'delivered',
      completed: 'delivered',
      success: 'delivered',
      failed: 'failed',
      refused: 'failed',
      rejected: 'failed',
      undeliverable: 'failed',
      delivery_exception: 'failed',
      returned: 'returned',
      retour: 'returned',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    };

    return statusMap[normalized] || normalized;
  }
}
