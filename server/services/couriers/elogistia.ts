// Elogistia Courier Service
// API: https://api.elogistia.com
// Auth: apiKey as query parameter

import crypto from 'crypto';
import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const BASE_URL = 'https://api.elogistia.com';

const CAPITALS: Record<number, string> = {
  1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum el Bouaghi', 5: 'Batna',
  6: 'Bejaia', 7: 'Biskra', 8: 'Bechar', 9: 'Blida Centre', 10: 'Bouira',
  11: 'Tamanrasset', 12: 'Tebessa', 13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou',
  16: 'ALGER CENTRE', 17: 'Djelfa', 18: 'Jijel', 19: 'Setif', 20: 'Saida',
  21: 'Skikda', 22: 'Sidi bel Abbas', 23: 'Annaba', 24: 'Guelma', 25: 'Constantine',
  26: 'Medea', 27: 'Mostaganem', 28: 'MSila', 29: 'Mascara', 30: 'Ouargla',
  31: 'Oran', 32: 'El Bayadh', 33: 'Illizi', 34: 'Bordj Bou Arraridj', 35: 'Boumerdes',
  36: 'El Taref', 37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
  41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Ain Defla', 45: 'Naama',
  46: 'Ain Temouchent', 47: 'Ghardaia', 48: 'Relizane',
};

export class ElogistiaService implements CourierService {

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
      const wilayaId = Number((shipment as any).wilaya_id) || 16;
      const commune = shipment.commune || CAPITALS[wilayaId] || 'ALGER CENTRE';
      const nameParts = (shipment.customer_name || 'Client').trim().split(' ');
      const name = nameParts[0];
      const firstname = nameParts.slice(1).join(' ') || name;

      const params = new URLSearchParams({
        apiKey,
        name,
        firstname,
        mail: shipment.customer_email || 'noreply@sahla4eco.com',
        phone: shipment.customer_phone || '',
        address: shipment.delivery_address || '',
        commune,
        fraisDeLivraison: '0',
        remarque: shipment.notes || '',
        stop_desk: '1',
        wilaya: String(wilayaId),
        product: shipment.product_description || 'Produit',
        price: String(shipment.cod_amount || 0),
        modeDeLivraison: '1',
        IdCommande: shipment.reference_id || `ORDER-${Date.now()}`,
        poids: '1',
      });

      const response = await fetch(`${BASE_URL}/insertCommande/?${params.toString()}`, {
        method: 'POST',
      });

      const data = await this.readJson(response);

      if (!response.ok || !data?.success) {
        return {
          success: false,
          tracking_number: '',
          error: data?.Message || data?.error || `Elogistia API error ${response.status}`,
        };
      }

      return {
        success: true,
        tracking_number: String(data.success),
        reference_id: shipment.reference_id,
      };
    } catch (error: any) {
      console.error('[Elogistia] createShipment error:', error);
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    _accountId?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(
        `${BASE_URL}/getTracking/?apiKey=${encodeURIComponent(apiKey)}&tracking=${encodeURIComponent(trackingNumber)}`
      );
      const data = await this.readJson(response);

      if (!response.ok || !data?.body) {
        return { tracking_number: trackingNumber, status: 'unknown', error: `Elogistia API error ${response.status}` };
      }

      const latest = data.body[data.body.length - 1];
      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(latest?.Statut || ''),
        events: (data.body || []).map((e: any) => ({
          type: 'update',
          timestamp: e.Date,
          description: e.Statut,
          location: '',
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
      tracking_number: payload?.tracking || payload?.Tracking,
      event_type: this.mapStatus(payload?.Statut || ''),
      status: payload?.Statut || '',
      timestamp: payload?.Date || new Date().toISOString(),
      location: '',
      description: payload?.Statut || '',
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      'En préparation': 'pending',
      'En livraison': 'out_for_delivery',
      'En cours livraison': 'out_for_delivery',
      'Ramassée': 'in_transit',
      'En transit': 'in_transit',
      'Livré': 'delivered',
      'Retour': 'returned',
      'Retour remis': 'returned',
      'Annulé': 'cancelled',
    };
    return map[status] || 'pending';
  }
}
