// Delivery Management Service
// Main business logic for handling delivery operations

import { pool } from '../utils/database';
import { encryptData, decryptData } from '../utils/encryption';
import { generateRequestId, logDeliveryEvent } from '../utils/delivery-logging';
import { getCourierService } from './courier-service';
import { registerCourierService } from './courier-service';
import { CourierShipmentResponse, DeliveryStatus } from '../types/delivery';
import { getAlgeriaCommuneNameById, getAlgeriaWilayaNameById, getDefaultCommuneNameForWilayaId } from '../utils/algeria-geo';

// Import real courier services (verified APIs only)
import { YalidineService } from './couriers/yalidine';
import { GuepexService } from './couriers/guepex';
import { EcotrackService } from './couriers/ecotrack';
import { NoestService } from './couriers/noest';
import { ZRExpressOfficialService } from './couriers/zrexpress';
import { MaystroService } from './couriers/maystro';
import { DolivrooService } from './couriers/dolivroo';
import { ZimouExpressService } from './couriers/zimou-express';
import { AndersonService } from './couriers/anderson';
import { DhdService } from './couriers/dhd';

// ========================================
// REGISTER REAL ALGERIAN DELIVERY PROVIDERS
// Only services with verified public APIs
// ========================================
registerCourierService('yalidine', YalidineService);
registerCourierService('yalidine express', YalidineService);
registerCourierService('guepex', GuepexService);
registerCourierService('ecotrack', EcotrackService);
// Noest uses token + GUID; implement its own header scheme.
registerCourierService('noest', NoestService);
registerCourierService('noest express', NoestService);
// ZR Express - Official API (docs.zrexpress.app)
registerCourierService('zr express', ZRExpressOfficialService);
registerCourierService('zr-express', ZRExpressOfficialService);
registerCourierService('zrexpress', ZRExpressOfficialService);
registerCourierService('zr express official', ZRExpressOfficialService);
registerCourierService('maystro', MaystroService);
registerCourierService('maystro delivery', MaystroService);
registerCourierService('dolivroo', DolivrooService); // Aggregator - recommended
// Zimou Express - Algerian delivery company
registerCourierService('zimou', ZimouExpressService);
registerCourierService('zimou express', ZimouExpressService);
registerCourierService('zimou-express', ZimouExpressService);
// Anderson - Uses Ecotrack platform
registerCourierService('anderson', AndersonService);
registerCourierService('anderson ecommerce', AndersonService);
registerCourierService('anderson-ecommerce', AndersonService);
// DHD Livraison Express - Ecotrack-powered, 55 wilayas
registerCourierService('dhd', DhdService);
registerCourierService('dhd livraison', DhdService);
registerCourierService('dhd livraison express', DhdService);
registerCourierService('dhd-livraison', DhdService);

export class DeliveryService {
  /**
   * Upload an order to the courier (create shipment) without requiring/storing a label.
   * This is what the UI calls "Upload to Delivery" when labels are not requested.
   */
  static async createShipment(
    orderId: number,
    clientId: number,
    companyId: number
  ): Promise<{ success: boolean; tracking_number?: string; label_url?: string; courier_response?: any; error?: string }> {
    const requestId = generateRequestId();

    try {
      const orderResult = await pool.query(
        `SELECT so.*, dc.name as company_name, cp.title as product_title
         FROM store_orders so
         LEFT JOIN delivery_companies dc ON so.delivery_company_id = dc.id
         LEFT JOIN client_store_products cp ON cp.id = so.product_id
         WHERE so.id = $1 AND so.client_id = $2`,
        [orderId, clientId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      const productTitle = String((order as any)?.product_title || '').trim();
      const variantLabel =
        String(order.variant_name || '').trim() ||
        [order.variant_color, order.variant_size].filter((v: any) => v != null && String(v).trim().length > 0).join(' / ');
      const productDescription = (() => {
        const base = productTitle || 'Products';
        const withVariant = variantLabel ? `${base} (${variantLabel})` : base;
        const full = `Order #${orderId} - ${withVariant}`;
        // Keep it reasonably short for courier APIs
        return full.length > 140 ? full.slice(0, 137) + '...' : full;
      })();
      const notes = (() => {
        const parts = [variantLabel ? `Variant: ${variantLabel}` : null].filter(Boolean);
        const s = parts.join(' | ');
        return s.length ? s : undefined;
      })();

      const integrationResult = await pool.query(
        `SELECT id, api_key_encrypted, api_secret_encrypted
         FROM delivery_integrations
         WHERE client_id = $1 AND delivery_company_id = $2 AND is_enabled = true`,
        [clientId, companyId]
      );

      if (integrationResult.rows.length === 0) {
        throw new Error('Delivery integration not configured for this company');
      }

      const integration = integrationResult.rows[0];
      const apiKey = decryptData(integration.api_key_encrypted);
      const secondaryCredential = integration.api_secret_encrypted
        ? decryptData(integration.api_secret_encrypted)
        : undefined;

      const service = getCourierService(order.company_name);
      if (!service) {
        throw new Error(`No service found for ${order.company_name}`);
      }


      // Validate required fields for Anderson and similar couriers
      if (order.company_name.toLowerCase().includes('anderson')) {
        const missingFields = [];
        if (!order.customer_name || String(order.customer_name).trim().length === 0) missingFields.push('customer_name');
        if (!order.customer_phone || String(order.customer_phone).trim().length === 0) missingFields.push('customer_phone');
        if (!order.shipping_address || String(order.shipping_address).trim().length === 0) missingFields.push('shipping_address');
        if (!order.shipping_wilaya_id) missingFields.push('shipping_wilaya_id');
        if (!order.shipping_commune_id) missingFields.push('shipping_commune_id');
        if (!order.cod_amount) missingFields.push('cod_amount');
        if (missingFields.length > 0) {
          await logDeliveryEvent(
            orderId,
            clientId,
            companyId,
            'upload_failed',
            `Missing required fields for Anderson: ${missingFields.join(', ')}`,
            requestId
          );
          return {
            success: false,
            error: `Missing required fields: ${missingFields.join(', ')}`,
          };
        }
      }

      const shipmentResponse = await service.createShipment(
        {
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          delivery_address: order.shipping_address,
          wilaya: (() => {
            const wilayaName = getAlgeriaWilayaNameById(order.shipping_wilaya_id);
            return wilayaName || undefined;
          })(),
          commune: (() => {
            const byId = getAlgeriaCommuneNameById(order.shipping_commune_id);
            if (byId) return byId;
            const fallback = getDefaultCommuneNameForWilayaId(order.shipping_wilaya_id);
            return fallback || undefined;
          })(),
          ...(order.shipping_wilaya_id ? { wilaya_id: Number(order.shipping_wilaya_id) } : {}),
          ...(order.shipping_commune_id ? { commune_id: Number(order.shipping_commune_id) } : {}),
          product_description: productDescription,
          quantity: order.quantity,
          cod_amount: order.cod_amount,
          reference_id: `ORDER-${orderId}`,
          ...(notes ? { notes } : {}),
        },
        apiKey,
        secondaryCredential
      );

      let trackingNumber = shipmentResponse.tracking_number;
      // If Anderson, and no tracking number, poll status endpoint
      if (
        order.company_name.toLowerCase().includes('anderson') &&
        (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim() === '') &&
        shipmentResponse.success && shipmentResponse.reference_id
      ) {
        try {
          // Use AndersonService.getStatus to fetch tracking number
          const andersonService = service as AndersonService;
          const statusResp = await andersonService.getStatus(shipmentResponse.reference_id, apiKey, secondaryCredential);
          if (statusResp && statusResp.tracking_number) {
            trackingNumber = statusResp.tracking_number;
          }
        } catch (e) {
          // Log but do not throw
          await logDeliveryEvent(
            orderId,
            clientId,
            companyId,
            'status_poll_failed',
            `Failed to poll Anderson status for tracking number: ${e?.message || e}`,
            requestId
          );
        }
      }

      if (!shipmentResponse.success || !trackingNumber) {
        // Do NOT update status if upload failed or tracking number missing
        await logDeliveryEvent(
          orderId,
          clientId,
          companyId,
          'upload_failed',
          `Failed to upload to ${order.company_name}: ${shipmentResponse.error || 'No tracking number returned'}`,
          requestId
        );
        await pool.query(
          `UPDATE store_orders
           SET delivery_status = $1,
               status = 'pending',
               courier_response = $2::jsonb,
               updated_at = NOW()
           WHERE id = $3 AND client_id = $4`,
          [
            DeliveryStatus.FAILED,
            JSON.stringify(shipmentResponse),
            orderId,
            clientId,
          ]
        );
        return {
          success: false,
          error: shipmentResponse.error || 'Failed to create shipment',
          courier_response: shipmentResponse,
        };
      }

      await pool.query(
        `UPDATE store_orders
         SET tracking_number = $1,
             delivery_status = $2,
             status = CASE
               WHEN COALESCE(status, '') IN ('delivered','completed','cancelled','failed','returned','refunded') THEN status
               ELSE 'at_delivery'
             END,
             shipping_label_url = COALESCE($3, shipping_label_url),
             courier_response = $4::jsonb,
             updated_at = NOW()
         WHERE id = $5 AND client_id = $6`,
        [
          trackingNumber,
          DeliveryStatus.IN_TRANSIT,
          shipmentResponse.label_url || null,
          JSON.stringify(shipmentResponse),
          orderId,
          clientId,
        ]
      );

      await logDeliveryEvent(
        orderId,
        clientId,
        companyId,
        'uploaded',
        `Shipment created with ${order.company_name}`,
        requestId
      );

      return {
        success: true,
        tracking_number: trackingNumber,
        label_url: shipmentResponse.label_url,
        courier_response: shipmentResponse,
      };
    } catch (error: any) {
      console.error(`[DeliveryService] createShipment failed:`, error);
      await this.logError(orderId, clientId, companyId, 'shipment_create_failed', error.message, requestId);
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign a delivery company to an order
   */
  static async assignDeliveryCompany(
    orderId: number,
    clientId: number,
    companyId: number,
    codAmount?: number
  ): Promise<{ success: boolean; error?: string }> {
    const requestId = generateRequestId();

    try {
      const orderResult = await pool.query(
        'SELECT id FROM store_orders WHERE id = $1 AND client_id = $2',
        [orderId, clientId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const companyResult = await pool.query(
        'SELECT id, name FROM delivery_companies WHERE id = $1 AND is_active = true',
        [companyId]
      );

      if (companyResult.rows.length === 0) {
        throw new Error('Delivery company not found or inactive');
      }

      await pool.query(
        `UPDATE store_orders 
         SET delivery_company_id = $1, 
             delivery_status = $2,
             status = CASE
               WHEN COALESCE(status, '') IN ('delivered','completed','cancelled','failed','returned','refunded') THEN status
               ELSE 'at_delivery'
             END,
             cod_amount = $3,
             updated_at = NOW()
         WHERE id = $4 AND client_id = $5`,
        [companyId, DeliveryStatus.ASSIGNED, codAmount || null, orderId, clientId]
      );

      await logDeliveryEvent(
        orderId,
        clientId,
        companyId,
        'assigned',
        `Delivery company assigned: ${companyResult.rows[0].name}`,
        requestId
      );

      return { success: true };
    } catch (error: any) {
      console.error(`[DeliveryService] assignDeliveryCompany failed:`, error);
      await this.logError(orderId, clientId, null, 'assignment_failed', error.message, requestId);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate shipping label for an order
   */
  static async generateLabel(
    orderId: number,
    clientId: number,
    companyId: number
  ): Promise<{ success: boolean; tracking_number?: string; label_url?: string; error?: string }> {
    const requestId = generateRequestId();

    try {
      const shipmentResult = await this.createShipment(orderId, clientId, companyId);
      if (!shipmentResult.success) {
        throw new Error(shipmentResult.error || 'Failed to create shipment');
      }

      const trackingNumber = shipmentResult.tracking_number;
      // Only insert label if trackingNumber is present
      if (!trackingNumber) {
        throw new Error('No tracking number returned from courier; cannot generate label.');
      }

      // Serve token-gated label endpoints through our authenticated proxy.
      const companyRow = await pool.query('SELECT name FROM delivery_companies WHERE id = $1', [companyId]);
      const companyName = String(companyRow.rows?.[0]?.name || '').trim().toLowerCase();
      const proxyLabelCompanies = new Set([
        'noest',
        'noest express',
        'dhd',
        'dhd livraison',
        'dhd livraison express',
        'dolivroo',
      ]);
      const labelUrl = proxyLabelCompanies.has(companyName)
        ? `/api/delivery/orders/${orderId}/label`
        : shipmentResult.label_url || null;

      await pool.query(
        `INSERT INTO delivery_labels 
         (order_id, client_id, delivery_company_id, tracking_number, label_url, generated_at, label_format)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [orderId, clientId, companyId, trackingNumber, labelUrl, 'pdf']
      );

      // createShipment already updated tracking/status; only ensure label fields are stamped.
      await pool.query(
        `UPDATE store_orders
         SET shipping_label_url = $1,
             label_generated_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND client_id = $3`,
        [labelUrl, orderId, clientId]
      );

      await logDeliveryEvent(
        orderId,
        clientId,
        companyId,
        'label_generated',
        `Label generated with tracking: ${trackingNumber}`,
        requestId
      );

      return {
        success: true,
        tracking_number: trackingNumber,
        label_url: labelUrl || undefined,
      };
    } catch (error: any) {
      console.error(`[DeliveryService] generateLabel failed:`, error);
      await this.logError(orderId, clientId, companyId, 'label_generation_failed', error.message, requestId);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get delivery status for an order
   */
  static async getDeliveryStatus(
    orderId: number,
    clientId: number
  ): Promise<{ success: boolean; status?: string; tracking_number?: string; events?: any[]; error?: string }> {
    try {
      const orderResult = await pool.query(
        `SELECT so.*, dc.name as company_name
         FROM store_orders so
         LEFT JOIN delivery_companies dc ON so.delivery_company_id = dc.id
         WHERE so.id = $1 AND so.client_id = $2`,
        [orderId, clientId]
      );

      if (orderResult.rows.length === 0) {
        return { success: false, error: 'Order not found' };
      }

      const order = orderResult.rows[0];

      if (!order.tracking_number) {
        return { success: false, error: 'No tracking information for this order' };
      }

      // Get events from database
      const eventsResult = await pool.query(
        `SELECT event_type, event_status, description, location, created_at
         FROM delivery_events
         WHERE order_id = $1
         ORDER BY created_at DESC`,
        [orderId]
      );

      return {
        success: true,
        status: order.delivery_status,
        tracking_number: order.tracking_number,
        events: eventsResult.rows,
      };
    } catch (error: any) {
      console.error(`[DeliveryService] getDeliveryStatus failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming webhook from courier
   */
  static async handleWebhook(
    companyName: string,
    payload: any,
    signature?: string
  ): Promise<{ success: boolean; error?: string }> {
    const requestId = generateRequestId();

    try {
      // Get delivery company
      const companyResult = await pool.query(
        'SELECT id FROM delivery_companies WHERE name = $1',
        [companyName]
      );

      if (companyResult.rows.length === 0) {
        throw new Error(`Delivery company not found: ${companyName}`);
      }

      const companyId = companyResult.rows[0].id;

      // Get courier service
      const service = getCourierService(companyName);
      if (!service) {
        throw new Error(`No service for ${companyName}`);
      }

      // Parse webhook
      const event = service.parseWebhookPayload(payload);
      const trackingNumber = event.tracking_number;

      // Find order by tracking number
      const orderResult = await pool.query(
        'SELECT id, client_id FROM store_orders WHERE tracking_number = $1',
        [trackingNumber]
      );

      if (orderResult.rows.length === 0) {
        console.warn(`[Webhook] No order found for tracking: ${trackingNumber}`);
        return { success: true }; // Don't fail, just log
      }

      const { id: orderId, client_id: clientId } = orderResult.rows[0];

      // Save event
      const eventInsert = await pool.query(
        `INSERT INTO delivery_events
         (order_id, client_id, delivery_company_id, tracking_number, event_type, event_status, description, location, webhook_payload, webhook_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
         RETURNING id`,
        [
          orderId,
          clientId,
          companyId,
          trackingNumber,
          event.event_type,
          'completed',
          event.description,
          event.location,
          JSON.stringify(payload),
          signature ? true : false,
        ]
      );

      // Update order delivery status if final state
      if (['delivered', 'failed', 'returned'].includes(event.event_type)) {
        await pool.query(
          `UPDATE store_orders
           SET delivery_status = $1, updated_at = NOW()
           WHERE id = $2`,
          [event.event_type, orderId]
        );
      }

      console.log(`[Webhook] Event processed for order ${orderId}: ${event.event_type}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[DeliveryService] handleWebhook failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // Helper function
  private static async logError(
    orderId: number,
    clientId: number | null,
    companyId: number | null,
    errorType: string,
    errorMessage: string,
    requestId: string
  ) {
    try {
      await pool.query(
        `INSERT INTO delivery_errors
         (client_id, order_id, delivery_company_id, error_type, error_message, request_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [clientId, orderId, companyId, errorType, errorMessage, requestId]
      );
    } catch (err) {
      console.error('Failed to log delivery error', err);
    }
  }
}
