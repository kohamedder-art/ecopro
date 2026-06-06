// Ecom Delivery Courier Service
// API: https://ecom-dz.net/Api_v1/Colis
// Auth: Key + Token in headers

import crypto from 'crypto';
import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';

const BASE_URL = 'https://ecom-dz.net';

export class EcomDeliveryService implements CourierService {

  private async readJson(res: Response): Promise<any> {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    token?: string
  ): Promise<CourierShipmentResponse> {
    try {
      if (!token) {
        return { success: false, tracking_number: '', error: 'Ecom Delivery requires Token (secondary credential)' };
      }

      const wilayaId = Number((shipment as any).wilaya_id) || 16;

      const payload = {
        Colis: [{
          Echange: 0,
          Stopdesk: 0,
          NomComplet: shipment.customer_name || 'Client',
          Mobile_1: shipment.customer_phone || '',
          Mobile_2: '',
          Adresse: shipment.delivery_address || '',
          Wilaya: String(wilayaId),
          Commune: shipment.commune || 'Alger Centre',
          Article: shipment.product_description || 'Produit',
          Ref_Article: shipment.reference_id || '',
          NoteFournisseur: shipment.notes || '',
          Total: String(shipment.cod_amount || 0),
          ID_Externe: shipment.reference_id || '',
          Source: 'Ecopro',
        }],
      };

      const response = await fetch(`${BASE_URL}/Api_v1/Colis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Key': apiKey,
          'Token': token,
        },
        body: JSON.stringify(payload),
      });

      const data = await this.readJson(response);

      if (!response.ok || !data) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || `Ecom Delivery API error ${response.status}`,
        };
      }

      const colis = data?.Colis?.[0];
      const tracking = colis?.Tracking || '';
      if (!tracking) {
        return {
          success: false,
          tracking_number: '',
          error: data?.message || 'No tracking number returned',
        };
      }

      return {
        success: true,
        tracking_number: tracking,
        label_url: colis?.label || undefined,
        reference_id: shipment.reference_id,
      };
    } catch (error: any) {
      console.error('[EcomDelivery] createShipment error:', error);
      return { success: false, tracking_number: '', error: error.message };
    }
  }

  async getStatus(
    trackingNumber: string,
    apiKey: string,
    token?: string
  ): Promise<CourierStatusResponse> {
    try {
      const response = await fetch(`${BASE_URL}/Api_v1/Colis/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'Key': apiKey,
          'Token': token || '',
        },
      });

      const data = await this.readJson(response);
      if (!response.ok || !data) {
        return { tracking_number: trackingNumber, status: 'unknown', error: `Ecom Delivery API error ${response.status}` };
      }

      const colis = data?.Colis?.[0] || data;
      return {
        tracking_number: trackingNumber,
        status: this.mapStatus(colis?.Situation || colis?.Avancement || ''),
        events: [],
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
      tracking_number: payload?.Tracking || payload?.tracking,
      event_type: this.mapStatus(payload?.Situation || ''),
      status: payload?.Situation || '',
      timestamp: payload?.Date_Action_D || new Date().toISOString(),
      location: '',
      description: payload?.Avancement || '',
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      'EnCours': 'in_transit',
      'En Préparation': 'pending',
      'Livré': 'delivered',
      'Retourné': 'returned',
      'Annulé': 'cancelled',
      'Echec': 'failed',
    };
    return map[status] || 'pending';
  }

  async testCredentials(apiKey: string, token?: string): Promise<import('../courier-service').CourierTestResult> {
    try {
      const response = await fetch(`${BASE_URL}/Api_v1/Colis/TEST`, {
        method: 'GET',
        headers: { 'Key': apiKey, 'Token': token || '' },
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid Ecom Delivery credentials — access denied' };
      }
      if (!response.ok) {
        const data = await this.readJson(response);
        return { success: false, message: data?.message || `Ecom Delivery API error ${response.status}` };
      }
      return { success: true, message: 'Ecom Delivery credentials verified successfully' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to connect to Ecom Delivery API' };
    }
  }
}
