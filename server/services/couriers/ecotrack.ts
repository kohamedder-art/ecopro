// Ecotrack Courier Service
// Auth: Bearer token (api_token from account settings)

import crypto from 'crypto';
import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const DEFAULT_BASE_URL = 'https://mono2.ecotrack.dz';

const CAPITALS: Record<number, string> = {
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

export class EcotrackService implements CourierService {

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

  private getBaseUrl(accountId?: string): string {
    const custom = accountId?.startsWith('http') ? accountId.replace(/\/$/, '') : null;
    return custom || process.env.ECOTRACK_API_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL;
  }

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    accountId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      const baseUrl = this.getBaseUrl(accountId);
      const wilayaId = Number((shipment as any).wilaya_id) || 16;
      const commune = shipment.commune || CAPITALS[wilayaId] || 'Alger Centre';

      const params = new URLSearchParams({
        nom_client: shipment.customer_name || 'Client',
        telephone: shipment.customer_phone || '',
        adresse: shipment.delivery_address || '',
        commune,
        code_wilaya: String(wilayaId),
        montant: String(shipment.cod_amount || 0),
        type: '1',
      });

      if (shipment.reference_id) params.set('reference', shipment.reference_id);
      if ((shipment as any).customer_phone2) params.set('telephone_2', (shipment as any).customer_phone2);
      if (shipment.notes) params.set('remarque', shipment.notes);
      if (shipment.product_description) params.set('produit', shipment.product_description);

      const response = await fetch(`${baseUrl}/create/order?${params.toString()}`, {
        method: 'POST',
        headers: this.headers(apiKey),
      });

      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || `Ecotrack API error ${response.status}`,
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
      console.error('[Ecotrack] createShipment error:', error);
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    accountId?: string
  ): Promise<CourierStatusResponse> {
    try {
      const baseUrl = this.getBaseUrl(accountId);
      const url = `${baseUrl}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingNumber)}`;
      const response = await fetch(url, { method: 'GET', headers: this.headers(apiKey) });
      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data?.message || `Ecotrack API error ${response.status}`,
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
          type: 'update',
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
}
