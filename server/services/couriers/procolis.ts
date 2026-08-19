// ProColis Courier Service
// API Docs: https://procolis.com/api_v1
// Auth: Token + Key headers

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import wilayasRaw from '../../../client/data/algeria-geo/wilayas.json';

const BASE_URL = 'https://procolis.com/api_v1';

// Build wilaya name → ID mapping (case-insensitive)
const WILAYA_NAME_TO_ID: Record<string, number> = {};
for (const w of wilayasRaw as any[]) {
  const id = Number(w.id || w.code);
  const name = String(w.name || '').trim().toLowerCase();
  const arName = String(w.arabic_name || '').trim().toLowerCase();
  if (id > 0 && name) WILAYA_NAME_TO_ID[name] = id;
  if (id > 0 && arName) WILAYA_NAME_TO_ID[arName] = id;
}

function resolveWilayaId(wilaya: string | undefined): string {
  if (!wilaya) return '16'; // default to Algiers
  // Already a number → return as-is
  const num = Number(wilaya);
  if (Number.isFinite(num) && num >= 1 && num <= 58) return String(num);
  // Try name lookup (case-insensitive)
  const id = WILAYA_NAME_TO_ID[wilaya.trim().toLowerCase()];
  return id ? String(id) : '16';
}

interface ProColisParcel {
  Tracking: string;
  TypeLivraison: string; // "0" = domicile, "1" = stopdesk
  TypeColis: string;     // "0" = standard, "1" = exchange
  Confrimee: string;     // "1" = auto-confirm
  Client: string;
  MobileA: string;
  MobileB: string;
  Adresse: string;
  IDWilaya: string;
  Commune: string;
  Total: string;
  Note: string;
  TProduit: string;
  id_Externe: string;
  Source: string;
}

interface ProColisReadResponse {
  Tracking: string;
  Situational?: string;
  Status?: string;
  [key: string]: any;
}

export class ProColisService implements CourierService {
  private headers(token: string, key: string) {
    return {
      'Content-Type': 'application/json',
      'token': token,
      'key': key,
    };
  }

  /**
   * Create shipment(s) with ProColis
   * POST /add_colis
   */
  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    apiSecret?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const tracking = shipment.reference_id || `PRO-${Date.now()}`;
      const wilayaId = resolveWilayaId(shipment.wilaya);

      // ProColis /add_colis rejects these wilayas (API-side issue, confirmed 2026-08-19)
      const UNSUPPORTED_WILAYAS = new Set(['6', '7', '8', '9']);
      if (UNSUPPORTED_WILAYAS.has(wilayaId)) {
        return {
          success: false,
          tracking_number: '',
          error: 'ProColis لا يقبل حالياً ولايات: بجاية، بسكرة، بشار، البليدة. يرجى التواصل مع ProColis أو اختيار شركة توصيل أخرى لهذه الولايات.',
        };
      }

      const parcel: ProColisParcel = {
        Tracking: tracking,
        TypeLivraison: shipment.is_stopdesk ? '1' : '0',
        TypeColis: '0',
        Confrimee: '1', // auto-confirm so parcel appears on ProColis website
        Client: shipment.customer_name || '',
        MobileA: shipment.customer_phone || '',
        MobileB: '',
        Adresse: shipment.delivery_address || '',
        IDWilaya: wilayaId,
        Commune: shipment.commune || '',
        Total: String(shipment.cod_amount || 0),
        Note: shipment.notes || '',
        TProduit: shipment.product_description || 'Product',
        id_Externe: shipment.reference_id || '',
        Source: '',
      };

      const response = await fetch(`${BASE_URL}/add_colis`, {
        method: 'POST',
        headers: this.headers(apiKey, apiSecret || ''),
        body: JSON.stringify({ Colis: [parcel] }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[ProColis] /add_colis response:', response.status, JSON.stringify(data));

      // ProColis returns HTTP 200 with IDRetour != "0" to signal an error
      const result = Array.isArray(data) ? data[0] : data;
      const retourCode = String(result?.IDRetour ?? '');
      if (!response.ok || (retourCode && retourCode !== '0')) {
        const retourMsg = result?.MessageRetour || data?.message || data?.error || `API Error ${response.status}`;
        console.error('[ProColis] Create shipment error:', response.status, retourCode, retourMsg);
        return {
          success: false,
          tracking_number: '',
          error: retourCode === '5' ? 'ProColis رفض الولاية (Wilaya Erreur)' : `ProColis: ${retourMsg}`,
        };
      }

      const returnedTracking = result?.Tracking || result?.tracking || tracking;
      console.log('[ProColis] Created parcel, tracking:', returnedTracking);

      // Also call /pret to ensure parcel is marked ready-to-ship
      try {
        const pretResponse = await fetch(`${BASE_URL}/pret`, {
          method: 'POST',
          headers: this.headers(apiKey, apiSecret || ''),
          body: JSON.stringify({ Colis: [{ Tracking: returnedTracking }] }),
        });
        const pretData = await pretResponse.json().catch(() => ({}));
        console.log('[ProColis] /pret response:', pretResponse.status, JSON.stringify(pretData));
      } catch (pretErr) {
        console.warn('[ProColis] /pret call failed (non-critical):', pretErr);
      }

      return {
        success: true,
        tracking_number: returnedTracking,
        reference_id: shipment.reference_id,
      };
    } catch (error: any) {
      console.error('[ProColis] createShipment exception:', error);
      return {
        success: false,
        tracking_number: '',
        error: error.message || 'Shipment creation failed',
      };
    }
  }

  /**
   * Get delivery status for a parcel
   * POST /lire
   */
  async getStatus(
    trackingNumber: string,
    apiKey: string,
    apiSecret?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(`${BASE_URL}/lire`, {
        method: 'POST',
        headers: this.headers(apiKey, apiSecret || ''),
        body: JSON.stringify({ Colis: [{ Tracking: trackingNumber }] }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[ProColis] /lire response:', response.status, JSON.stringify(data));

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data?.message || `API Error ${response.status}`,
        };
      }

      const parcel: ProColisReadResponse = Array.isArray(data) ? data[0] : data;
      const status = this.mapProColisStatus(parcel.Situational || parcel.Status || '');

      return {
        tracking_number: trackingNumber,
        status,
        last_update: undefined,
        location: undefined,
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
   * Mark parcel(s) as ready to ship
   * POST /pret
   */
  async markReadyToShip(
    trackingNumbers: string[],
    apiKey: string,
    apiSecret?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${BASE_URL}/pret`, {
        method: 'POST',
        headers: this.headers(apiKey, apiSecret || ''),
        body: JSON.stringify({
          Colis: trackingNumbers.map(t => ({ Tracking: t })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data?.message || `API Error ${response.status}` };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pricing from ProColis
   * GET /tarification
   */
  async getTarification(
    apiKey: string,
    apiSecret?: string
  ): Promise<any> {
    try {
      const response = await fetch(`${BASE_URL}/tarification`, {
        method: 'GET',
        headers: this.headers(apiKey, apiSecret || ''),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  verifyWebhook(_payload: any, _signature: string, _secret: string): boolean {
    // ProColis doesn't document webhook signature verification
    return true;
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload?.Tracking || payload?.tracking || '',
      event_type: this.mapProColisStatus(payload?.Situational || payload?.Status || ''),
      status: payload?.Situational || payload?.Status || '',
      timestamp: payload?.updated_at || payload?.timestamp,
      location: payload?.location,
      description: payload?.Situational || payload?.Status,
    };
  }

  async testCredentials(apiKey: string, apiSecret?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      console.log('[ProColis] Testing credentials with /token endpoint');
      const response = await fetch(`${BASE_URL}/token`, {
        method: 'GET',
        headers: this.headers(apiKey, apiSecret || ''),
      });

      const data = await response.json().catch(() => ({}));
      console.log('[ProColis] /token response:', response.status, JSON.stringify(data));

      if (!response.ok) {
        return {
          success: false,
          message: data?.message || data?.error || `ProColis API error ${response.status}`,
        };
      }

      const accountName = data?.name || data?.company || data?.Nom || undefined;
      return {
        success: true,
        message: accountName ? `ProColis connected — ${accountName}` : 'ProColis connected successfully',
        accountName,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Failed to connect to ProColis API',
      };
    }
  }

  /**
   * Map ProColis status strings to standard status
   * ProColis uses French status labels (Situational field)
   */
  private mapProColisStatus(status: string): string {
    const s = status.toLowerCase().trim();
    const statusMap: Record<string, string> = {
      // ProColis status labels
      'en attente': 'pending',
      'en préparation': 'pending',
      'en preparation': 'pending',
      'expédiée': 'in_transit',
      'expediee': 'in_transit',
      'en transit': 'in_transit',
      'au centre': 'in_transit',
      'en cours de livraison': 'out_for_delivery',
      'sortie en livraison': 'out_for_delivery',
      'livrée': 'delivered',
      'livree': 'delivered',
      'échec': 'failed',
      'echec': 'failed',
      'échec de livraison': 'failed',
      'echec de livraison': 'failed',
      'retournée': 'returned',
      'retournee': 'returned',
      'retour expéditeur': 'returned',
      'retour expediteur': 'returned',
      'prête au retrait': 'ready_for_pickup',
      'prete au retrait': 'ready_for_pickup',
      'annulée': 'failed',
      'annulee': 'failed',
    };

    return statusMap[s] || 'pending';
  }
}
