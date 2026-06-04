// ZR Express Courier Service (Official API)
// API documentation: https://docs.zrexpress.app/reference
// Base URL: https://api.zrexpress.app/api/v1
// Note: This is the official ZR Express API, different from the Procolis-based zr-express.ts

import { CourierService } from '../courier-service';
import { CourierShipmentResponse, CourierStatusResponse, ShipmentInput } from '../../types/delivery';
import crypto from 'crypto';

interface ZRExpressParcelResponse {
  id: string;
  trackingNumber?: string;
}

interface ZRExpressTerritory {
  id: string;
  code: number;
  name: string;
  postalCode: string;
  level: string; // 'wilaya' or 'commune'
  parentId: string | null;
}

// Cache for territory lookups
let territoriesCache: ZRExpressTerritory[] | null = null;
let territoriesCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export class ZRExpressOfficialService implements CourierService {
  private readonly apiUrl = 'https://api.zrexpress.app/api/v1';

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

  /**
   * Fetch territories (wilayas and communes) from ZR Express
   * tenantId comes from apiSecret parameter
   */
  private async fetchTerritories(apiKey: string, tenantId: string): Promise<ZRExpressTerritory[]> {
    const now = Date.now();
    if (territoriesCache && (now - territoriesCacheTime) < CACHE_TTL) {
      return territoriesCache;
    }

    let allItems: ZRExpressTerritory[] = [];
    let page = 1;
    const pageSize = 1000;

    try {
      while (true) {
        const response = await fetch(`${this.apiUrl}/territories/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Api-Key': apiKey,
            'X-Tenant': tenantId,
          },
          body: JSON.stringify({
            pageNumber: page,
            pageSize,
            orderBy: ['code asc'],
          }),
        });

        const { json, text } = await this.readApiResponse(response);
        if (!json?.items || json.items.length === 0) break;

        allItems = allItems.concat(json.items);

        // Stop if we got fewer items than page size (last page)
        if (json.items.length < pageSize) break;
        page++;
      }

      console.log(`[ZRExpress] Fetched ${allItems.length} territories (${page} pages)`);
      if (allItems.length > 0) {
        territoriesCache = allItems;
        territoriesCacheTime = now;
      }
      return allItems;
    } catch (error) {
      console.error('[ZRExpress] Failed to fetch territories:', error);
      return [];
    }
  }

  /**
   * Normalize a territory name for comparison:
   * - lowercase, strip diacritics (é→e, ï→i, etc.), collapse whitespace/hyphens,
   *   and map common Algerian transliteration variants so "Tamanrasset" matches "Tamanghasset", etc.
   */
  private normalizeName(name: string): string {
    let s = (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .toLowerCase()
      .replace(/[''`]/g, '')          // remove apostrophes
      .replace(/[-_]/g, ' ')          // hyphens → spaces
      .replace(/\s+/g, ' ')
      .trim();
    // Common Algerian transliteration equivalences
    s = s.replace(/gh/g, '')          // tamanghasset → tamanasset
         .replace(/ou/g, 'u')         // oum → um
         .replace(/ch/g, 'sh')        // bechar → beshar
         .replace(/dj/g, 'j')         // djelfa → jelfa
         .replace(/ph/g, 'f');
    return s;
  }

  /** Check if two territory names likely refer to the same place */
  private namesMatch(a: string, b: string): boolean {
    const na = this.normalizeName(a);
    const nb = this.normalizeName(b);
    if (!na || !nb) return false;
    // Exact match after normalization
    if (na === nb) return true;
    // One contains the other (handles "Ain Bouchekif" vs "Aïn Bouchekif")
    if (na.includes(nb) || nb.includes(na)) return true;
    // Match if the longer string starts with the shorter (Alger vs Alger Centre)
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;
    if (longer.startsWith(shorter)) return true;
    return false;
  }

  /** Map our wilaya name to its numeric code (1-58) for code-based fallback */
  private static readonly WILAYA_CODES: Record<string, number> = {
    'adrar': 1, 'chlef': 2, 'laghouat': 3, 'oum el bouaghi': 4, 'batna': 5,
    'bejaia': 6, 'biskra': 7, 'bechar': 8, 'blida': 9, 'bouira': 10,
    'tamanrasset': 11, 'tebessa': 12, 'tlemcen': 13, 'tiaret': 14, 'tizi ouzou': 15,
    'alger': 16, 'djelfa': 17, 'jijel': 18, 'setif': 19, 'saida': 20,
    'skikda': 21, 'sidi bel abbes': 22, 'annaba': 23, 'guelma': 24, 'constantine': 25,
    'medea': 26, 'mostaganem': 27, 'msila': 28, 'mascara': 29, 'ouargla': 30,
    'oran': 31, 'el bayadh': 32, 'illizi': 33, 'bordj bou arreridj': 34, 'boumerdes': 35,
    'el tarf': 36, 'tindouf': 37, 'tissemsilt': 38, 'el oued': 39, 'khenchela': 40,
    'souk ahras': 41, 'tipaza': 42, 'mila': 43, 'ain defla': 44, 'naama': 45,
    'ain temouchent': 46, 'ghardaia': 47, 'relizane': 48,
    'el mghair': 49, 'el meniaa': 50, 'ouled djellal': 51, 'bordj badji mokhtar': 52,
    'beni abbes': 53, 'timimoun': 54, 'touggourt': 55, 'djanet': 56,
    'in salah': 57, 'in guezzam': 58,
    // Common alternate spellings
    'tamanghasset': 11, 'béjaïa': 6, 'béchar': 8, 'tébessa': 12,
    'sétif': 19, 'saïda': 20, 'médéa': 26, "m'sila": 28, 'ghardaïa': 47,
    'naâma': 45, 'aïn defla': 44, 'aïn témouchent': 46,
  };

  /**
   * Find territory IDs for a wilaya/commune combination.
   * Uses progressive matching: exact → normalized → wilaya-code fallback.
   */
  private async findTerritoryIds(
    wilayaName: string,
    communeName: string,
    apiKey: string,
    tenantId: string
  ): Promise<{ cityTerritoryId: string | null; districtTerritoryId: string | null }> {
    const territories = await this.fetchTerritories(apiKey, tenantId);
    const wilayas = territories.filter(t => t.level === 'wilaya');

    console.log(`[ZRExpress] Matching wilaya "${wilayaName}" against ${wilayas.length} wilayas`);

    // 1) Try exact lowercase match
    let wilaya = wilayas.find(t => t.name.toLowerCase() === wilayaName.toLowerCase());
    if (wilaya) console.log(`[ZRExpress] Wilaya matched via exact: ${wilaya.name} (code=${wilaya.code})`);

    // 2) Try normalized fuzzy match
    if (!wilaya) {
      wilaya = wilayas.find(t => this.namesMatch(t.name, wilayaName));
      if (wilaya) console.log(`[ZRExpress] Wilaya matched via namesMatch: ${wilaya.name} (code=${wilaya.code})`);
    }

    // 3) Fallback: match by wilaya code (most reliable)
    if (!wilaya) {
      const normalizedInput = wilayaName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const code = ZRExpressOfficialService.WILAYA_CODES[normalizedInput]
        || ZRExpressOfficialService.WILAYA_CODES[normalizedInput.replace(/-/g, ' ')]
        || Object.entries(ZRExpressOfficialService.WILAYA_CODES).find(([k]) =>
            this.normalizeName(k) === this.normalizeName(wilayaName)
          )?.[1];
      if (code) {
        wilaya = wilayas.find(t => t.code === code);
        if (wilaya) console.log(`[ZRExpress] Wilaya matched via code fallback: ${wilaya.name} (code=${wilaya.code})`);
      }
    }

    if (!wilaya) {
      console.warn(`[ZRExpress] Wilaya not found: "${wilayaName}" — available: ${wilayas.map(w => `${w.code}:${w.name}`).slice(0, 15).join(', ')}...`);
      return { cityTerritoryId: null, districtTerritoryId: null };
    }

    // Find commune under this wilaya
    const communes = territories.filter(t => t.level === 'commune' && t.parentId === wilaya!.id);
    console.log(`[ZRExpress] Matching commune "${communeName}" among ${communes.length} communes under ${wilaya.name}`);

    let commune = communes.find(t => t.name.toLowerCase() === communeName.toLowerCase());
    if (commune) console.log(`[ZRExpress] Commune matched via exact: ${commune.name}`);
    if (!commune) {
      commune = communes.find(t => this.namesMatch(t.name, communeName));
      if (commune) console.log(`[ZRExpress] Commune matched via namesMatch: ${commune.name}`);
    }

    if (!commune && communes.length > 0) {
      console.warn(`[ZRExpress] Commune "${communeName}" not found under ${wilaya.name}. Falling back to first: ${communes[0].name}`);
      commune = communes[0];
    }

    if (!commune) {
      console.warn(`[ZRExpress] No commune found or available for "${communeName}" under ${wilaya.name}. Using wilaya territory ID as fallback for district.`);
    }

    return {
      cityTerritoryId: wilaya.id,
      districtTerritoryId: commune?.id || wilaya.id,
    };
  }

  /**
   * ZR Express uses X-Api-Key and X-Tenant headers
   * apiKey = API key
   * apiSecret = Tenant ID
   */
  async createShipment(
    shipment: ShipmentInput,
    apiKey: string,
    tenantId?: string
  ): Promise<CourierShipmentResponse> {
    try {
      if (!tenantId) {
        return {
          success: false,
          tracking_number: '',
          error: 'Tenant ID (apiSecret) is required for ZR Express',
        };
      }

      // Get territory IDs for wilaya/commune
      const { cityTerritoryId, districtTerritoryId } = await this.findTerritoryIds(
        shipment.wilaya || 'Alger',
        shipment.commune || 'Alger Centre',
        apiKey,
        tenantId
      );

      if (!cityTerritoryId || !districtTerritoryId) {
        return {
          success: false,
          tracking_number: '',
          error: `Could not find territory IDs for ${shipment.wilaya}/${shipment.commune}. Please verify wilaya and commune names.`,
        };
      }

      // Generate a random customer ID (UUID format)
      const customerId = crypto.randomUUID();

      // Parse phone number to international format
      let phone = shipment.customer_phone || '';
      if (phone.startsWith('0')) {
        phone = '+213' + phone.slice(1);
      } else if (!phone.startsWith('+')) {
        phone = '+213' + phone;
      }

      const payload = {
        customer: {
          customerId,
          name: shipment.customer_name || 'Customer',
          phone: {
            number1: phone,
            number2: '',
          },
        },
        deliveryAddress: {
          street: shipment.delivery_address || '',
          city: shipment.wilaya || 'Alger',
          district: shipment.commune || 'Alger Centre',
          postalCode: '',
          country: 'algeria',
          cityTerritoryId,
          districtTerritoryId,
        },
        orderedProducts: [
          {
            productName: shipment.product_description || 'Products',
            unitPrice: shipment.cod_amount || 0,
            quantity: 1,
            length: 20,
            width: 15,
            height: 10,
            weight: shipment.weight || 1,
            stockType: 'none', // No stock management
          },
        ],
        amount: shipment.cod_amount || 0,
        description: shipment.product_description || `Order ${shipment.reference_id}`,
        deliveryType: 'home',
        ExternalId: shipment.reference_id || `ORD-${Date.now()}`,
      };

      const response = await fetch(`${this.apiUrl}/parcels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Api-Key': apiKey,
          'X-Tenant': tenantId,
        },
        body: JSON.stringify(payload),
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        const snippet = text.slice(0, 400);
        console.error('[ZRExpress] Create parcel error:', {
          status: response.status,
          contentType,
          bodySnippet: snippet,
          data,
        });
        
        // Parse validation errors
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((e: any) => e.description || e.code).join('; ');
          return {
            success: false,
            tracking_number: '',
            error: errorMessages || data.detail || `API Error ${response.status}`,
          };
        }
        
        return {
          success: false,
          tracking_number: '',
          error: data.detail || data.message || data.error || `API Error ${response.status}`,
        };
      }

      if (!json) {
        return {
          success: false,
          tracking_number: '',
          error: `API returned non-JSON success response (${contentType || 'unknown'}): ${text.slice(0, 200)}`,
        };
      }

      // Try trackingNumber first, fall back to parcel UUID
      const trackingNumber = json.trackingNumber || json.tracking_number || json.id;

      if (!trackingNumber) {
        console.error('[ZRExpress] No tracking number in response:', json);
        return {
          success: false,
          tracking_number: '',
          error: 'No tracking number returned',
        };
      }

      return {
        success: true,
        tracking_number: trackingNumber,
        reference_id: shipment.reference_id,
      };
    } catch (error: any) {
      console.error('[ZRExpress] createShipment exception:', error);
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
    tenantId?: string
  ): Promise<CourierStatusResponse> {
    try {
      if (!tenantId) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: 'Tenant ID (apiSecret) is required for ZR Express',
        };
      }

      // ZR Express uses parcel search to find status
      // We search by tracking number or external ID
      const response = await fetch(`${this.apiUrl}/parcels/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Api-Key': apiKey,
          'X-Tenant': tenantId,
        },
        body: JSON.stringify({
          pageNumber: 1,
          pageSize: 1,
          advancedSearch: {
            fields: ['trackingNumber', 'externalId'],
            keyword: trackingNumber,
          },
        }),
      });

      const { json, text, contentType } = await this.readApiResponse(response);
      const data = json ?? {};

      if (!response.ok) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: data.detail || data.message || `Failed to fetch status: HTTP ${response.status}`,
        };
      }

      if (!json || !json.items || json.items.length === 0) {
        return {
          tracking_number: trackingNumber,
          status: 'unknown',
          error: 'Parcel not found',
        };
      }

      const parcel = json.items[0];

      return {
        tracking_number: parcel.trackingNumber || trackingNumber,
        status: this.mapStatus(parcel.state?.name || 'unknown'),
        last_update: parcel.updatedAt,
        location: parcel.deliveryAddress?.city,
        events: [], // Would need separate state-history call
      };
    } catch (error: any) {
      return {
        tracking_number: trackingNumber,
        status: 'unknown',
        error: error.message || 'Status fetch failed',
      };
    }
  }

  async cancelShipment(
    trackingNumber: string,
    apiKey: string,
    tenantId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!tenantId) {
        return {
          success: false,
          error: 'Tenant ID (apiSecret) is required for ZR Express',
        };
      }

      // ZR Express cancellation is done by updating parcel state to cancelled state ID
      // This requires knowing the cancelled state ID from their workflow
      // For now, return not supported - would need state IDs
      return {
        success: false,
        error: 'Cancel via API requires cancelled state ID - please cancel through ZR Express dashboard',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Cancel request failed',
      };
    }
  }

  /**
   * ZR Express uses Svix for webhooks with signing secret verification
   * Simplified verification - for production consider using svix npm package
   */
  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    try {
      // Svix sends signatures in format: v1,<base64-signature>
      // The signature is HMAC-SHA256 of timestamp.payload
      if (!signature || !secret) return false;
      
      // For Svix webhooks, you would parse the svix-signature header
      // and verify against the signing secret. Simplified implementation:
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(JSON.stringify(payload)).digest('base64');
      return signature.includes(digest);
    } catch {
      return false;
    }
  }

  parseWebhookPayload(payload: any) {
    // ZR Express webhook event types:
    // - parcel.state.updated
    // - parcel.state.situation.created
    // - parcel.isReturn.updated
    
    const data = payload.data || payload;
    const eventType = payload.eventType || payload.type || 'parcel.state.updated';
    const stateName = data.state?.name || data.newStateName || eventType;
    
    return {
      tracking_number: data.trackingNumber || data.tracking_number,
      event_type: eventType,
      status: this.mapStatus(stateName),
      timestamp: payload.occurredAt || payload.timestamp || data.updatedAt,
      location: data.wilaya || data.location,
      description: stateName,
    };
  }

  private mapStatus(zrStatus: string): string {
    let statusLower = (zrStatus || '').toLowerCase().trim();
    
    // Normalize: replace spaces with underscores for multi-word statuses
    statusLower = statusLower.replace(/\s+/g, '_');
    
    const statusMap: Record<string, string> = {
      // French status names
      'nouveau': 'pending',
      'en_attente': 'pending',
      'pret_a_expedier': 'pending',
      'pret_à_expédier': 'pending',
      'ramasse': 'picked_up',
      'ramassé': 'picked_up',
      'en_transit': 'in_transit',
      'au_hub': 'in_transit',
      'en_livraison': 'out_for_delivery',
      'livre': 'delivered',
      'livré': 'delivered',
      'retourne': 'returned',
      'retourné': 'returned',
      'retour_au_hub': 'returned',
      'returned_to_hub': 'returned',
      'annule': 'cancelled',
      'annulé': 'cancelled',
      'echec': 'failed',
      'échec': 'failed',
      // English status names
      'new': 'pending',
      'pending': 'pending',
      'ready_to_ship': 'pending',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'at_hub': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'on_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'returned': 'returned',
      'cancelled': 'cancelled',
      'failed': 'failed',
      // Arabic status names (from ZR Express dashboard)
      'تم_استلام_الطلب': 'pending',
      'الطلب_قيد_المعالجة': 'pending',
      'مكالمة_تأكيد': 'pending',
      'تم_تأكيد_الطلب': 'pending',
      'جاهز_للشحن': 'pending',
      'مؤكد_في_المكتب': 'pending',
      'توزيع_داخل_الولاية': 'in_transit',
      'إلى_الولاية': 'in_transit',
      'قيد_التوصيل': 'out_for_delivery',
      'خارج_للتوصيل_مرة_أخرى': 'out_for_delivery',
      'تم_التوصيل': 'delivered',
      'تم_التحصيل': 'delivered',
      'تم_الاسترداد': 'returned',
    };

    return statusMap[statusLower] || statusMap[zrStatus] || 'unknown';
  }
}
