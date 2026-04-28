// DHD Livraison Express Courier Service
// DHD runs on the Ecotrack platform: https://app.dhd-dz.com
// Auth: api_token + user_guid sent in request body (Ecotrack public API pattern)

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const BASE_URL = (process.env.DHD_API_URL || 'https://app.dhd-dz.com').replace(/\/$/, '');

interface EcotrackTrackingActivity {
  reason: string;
  details: string;
  station: string;
  driver: string;
  date: string;
  time: string;
  postponed_to: string | null;
}

export class DhdService implements CourierService {

  private async readJson(res: Response): Promise<any> {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
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
          error: 'DHD requires GUID (secondary credential)',
        };
      }

      const wilayaId = Number(shipment.wilaya_id) || 16;

      const payload = {
        api_token: apiKey,
        user_guid: guid,
        reference: shipment.reference_id || `ORD-${Date.now()}`,
        client: shipment.customer_name || 'Client',
        phone: String(shipment.customer_phone || '').replace(/\D/g, ''),
        phone_2: '',
        adresse: shipment.delivery_address || '',
        commune: shipment.commune || '',
        wilaya_id: wilayaId,
        montant: String(shipment.cod_amount || 0),
        produit: shipment.product_description || 'Produit',
        type_id: 1,
        can_open: 1,
        fragile: 0,
        remarque: shipment.notes || '',
        stop_desk: 0,
        stock: 0,
      };

      const response = await fetch(`${BASE_URL}/api/public/create/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || `DHD API error ${response.status}`,
        };
      }

      const tracking = data?.tracking || data?.data?.tracking || data?.tracking_code || '';
      if (!tracking) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || 'No tracking number returned',
        };
      }

      // Validate order (DHD/Noest pattern — non-fatal if it fails)
      try {
        await fetch(`${BASE_URL}/api/public/validate/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ api_token: apiKey, user_guid: guid, tracking }),
        });
      } catch { /* non-fatal */ }

      return {
        success: true,
        tracking_number: tracking,
        reference_id: payload.reference,
      };
    } catch (error: any) {
      console.error('[DHD] createShipment error:', error);
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    _guid?: string
  ): Promise<CourierStatusResponse> {
    try {
      const url = `${BASE_URL}/api/public/get/tracking/info?tracking=${encodeURIComponent(trackingNumber)}&api_token=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data?.message || `DHD API error ${response.status}`,
        };
      }

      const lastActivity: EcotrackTrackingActivity | undefined =
        data.activity?.[data.activity.length - 1];

      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(data.status),
        last_update: lastActivity ? `${lastActivity.date} ${lastActivity.time}` : undefined,
        location: lastActivity?.station,
        events: (data.activity || []).map((a: EcotrackTrackingActivity) => ({
          timestamp: `${a.date} ${a.time}`,
          description: [a.reason, a.details].filter(Boolean).join(' — '),
          location: a.station,
        })),
      };
    } catch (error: any) {
      return { tracking_number: trackingNumber, status: 'unknown', error: error.message };
    }
  }

  verifyWebhook(_payload: any, _signature: string, _secret: string): boolean {
    return true;
  }

  parseWebhookPayload(payload: any) {
    return {
      tracking_number: payload.tracking || payload.tracking_code,
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
