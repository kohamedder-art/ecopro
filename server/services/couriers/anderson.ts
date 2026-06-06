// Anderson Ecommerce Courier Service
// Anderson runs on the Ecotrack platform: https://anderson-ecommerce.ecotrack.dz
// Same API structure as Ecotrack — only the base URL differs.

import crypto from 'crypto';
import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const BASE_URL = 'https://anderson-ecommerce.ecotrack.dz/api/v1';

// Anderson endpoint mapping (differs slightly from base Ecotrack)
const ENDPOINTS = {
  createOrder: '/create/order',
  trackingInfo: '/get/tracking/info',
  wilayas: '/get/wilayas',
};

interface EcotrackTrackingActivity {
  reason: string;
  details: string;
  station: string;
  driver: string;
  date: string;
  time: string;
  postponed_to: string | null;
}

interface EcotrackTrackingInfo {
  tracking: string;
  status: string;
  activity: EcotrackTrackingActivity[];
}

export class AndersonService implements CourierService {

  private headers(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private async readJson(res: Response): Promise<any> {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    _accountId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const wilayaId = Number(shipment.wilaya_id) || 16;

      const capitals: Record<number, string> = {
        1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum El Bouaghi', 5: 'Batna',
        6: 'Bejaia', 7: 'Biskra', 8: 'Bechar', 9: 'Blida', 10: 'Bouira',
        11: 'Tamanrasset', 12: 'Tebessa', 13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou',
        16: 'Alger Centre', 17: 'Djelfa', 18: 'Jijel', 19: 'Setif', 20: 'Saida',
        21: 'Skikda', 22: 'Sidi Bel Abbes', 23: 'Annaba', 24: 'Guelma', 25: 'Constantine',
        26: 'Medea', 27: 'Mostaganem', 28: 'Msila', 29: 'Mascara', 30: 'Ouargla',
        31: 'Oran', 32: 'El Bayadh', 33: 'Illizi', 34: 'Bordj Bou Arreridj', 35: 'Boumerdes',
        36: 'El Tarf', 37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
        41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Ain Defla', 45: 'Naama',
        46: 'Ain Temouchent', 47: 'Ghardaia', 48: 'Relizane', 49: 'Timimoun',
        50: 'Bordj Badji Mokhtar', 51: 'Ouled Djellal', 52: 'Beni Abbes', 53: 'In Salah',
        54: 'In Guezzam', 55: 'Touggourt', 56: 'Djanet', 57: 'El Mghaier', 58: 'El Meniaa',
      };
      const commune = shipment.commune || capitals[wilayaId] || 'Alger Centre';

      // Sanitize phone: strip spaces, dashes, parentheses, leading +
      const rawPhone = String(shipment.customer_phone || '').replace(/[\s\-().+]/g, '');
      if (rawPhone.length < 9) {
        return {
          success: false,
          tracking_number: '',
          error: `Phone number "${shipment.customer_phone}" is too short for Anderson (minimum 9 digits)`,
        };
      }

      const params = new URLSearchParams({
        nom_client: shipment.customer_name || 'Client',
        telephone: rawPhone,
        adresse: shipment.delivery_address || '',
        commune,
        code_wilaya: String(wilayaId),
        montant: String(shipment.cod_amount || 0),
        type: '1',
      });

      if (shipment.reference_id) params.set('reference', shipment.reference_id);
      if (shipment.customer_phone2) params.set('telephone_2', shipment.customer_phone2);
      if (shipment.notes) params.set('remarque', shipment.notes);
      if (shipment.product_description) params.set('produit', shipment.product_description);

      const url = `${BASE_URL}${ENDPOINTS.createOrder}?${params.toString()}`;
      const response = await fetch(url, { method: 'POST', headers: this.headers(apiKey) });

      let data: any = null;
      try { data = JSON.parse(await response.text()); } catch { /* not json */ }

      if (!response.ok) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || `Anderson API error ${response.status}`,
        };
      }

      const tracking = data?.tracking || data?.data?.tracking || data?.numero_suivi || '';
      if (!tracking) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || 'No tracking number returned',
        };
      }

      return { success: true, tracking_number: tracking, reference_id: shipment.reference_id };
    } catch (error: any) {
      console.error('[Anderson] createShipment error:', error);
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    _accountId?: string
  ): Promise<CourierStatusResponse> {
    try {
      const url = `${BASE_URL}${ENDPOINTS.trackingInfo}?tracking=${encodeURIComponent(trackingNumber)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers(apiKey),
      });

      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data?.message || `Anderson API error ${response.status}`,
        };
      }

      const info: EcotrackTrackingInfo = data;
      const lastActivity = info.activity?.[info.activity.length - 1];

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(info.status),
        last_update: lastActivity ? `${lastActivity.date} ${lastActivity.time}` : undefined,
        location: lastActivity?.station,
        events: (info.activity || []).map(a => ({
          timestamp: `${a.date} ${a.time}`,
          description: [a.reason, a.details].filter(Boolean).join(' — '),
          location: a.station,
        })),
      };
    } catch (error: any) {
      return { tracking_number: trackingNumber, status: 'unknown', error: error.message };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(JSON.stringify(payload)).digest('hex');
      return digest === signature;
    } catch {
      return false;
    }
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking,
      event_type: this.mapStatus(payload.status),
      status: payload.status,
      timestamp: payload.date || new Date().toISOString(),
      location: payload.station || '',
      description: payload.reason || payload.status,
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      'prete_a_expedier': 'pending',
      'en_ramassage': 'pending',
      'en_preparation_stock': 'pending',
      'vers_hub': 'in_transit',
      'en_hub': 'in_transit',
      'vers_wilaya': 'in_transit',
      'en_preparation': 'in_transit',
      'en_livraison': 'out_for_delivery',
      'suspendu': 'failed',
      'livre_non_encaisse': 'delivered',
      'encaisse_non_paye': 'delivered',
      'paiements_prets': 'delivered',
      'paye_et_archive': 'delivered',
      'retour_chez_livreur': 'returned',
      'retour_transit_entrepot': 'returned',
      'retour_en_traitement': 'returned',
      'retour_recu': 'returned',
      'retour_archive': 'returned',
      'annule': 'cancelled',
      'order_information_received_by_carrier': 'pending',
      'picked': 'in_transit',
      'accepted_by_carrier': 'in_transit',
      'dispatched_to_driver': 'out_for_delivery',
      'attempt_delivery': 'failed',
      'return_asked': 'returned',
      'return_in_transit': 'returned',
      'Return_received': 'returned',
      'livred': 'delivered',
      'encaissed': 'delivered',
      'payed': 'delivered',
    };
    return map[status] || 'pending';
  }

  async testCredentials(apiKey: string, _accountId?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${BASE_URL}${ENDPOINTS.trackingInfo}?tracking=TEST`, {
        method: 'GET',
        headers: this.headers(apiKey),
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid Anderson API token — access denied' };
      }
      if (!response.ok) {
        const data = await this.readJson(response);
        return { success: false, message: data?.message || `Anderson API error ${response.status}` };
      }
      return { success: true, message: 'Anderson credentials verified successfully' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Anderson API' };
    }
  }
}
