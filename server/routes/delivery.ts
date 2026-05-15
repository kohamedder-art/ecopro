// Delivery API Routes
import { Router, RequestHandler } from 'express';
import { pool } from '../utils/database';
import { DeliveryService } from '../services/delivery';
import {
  AssignDeliverySchema,
  GenerateLabelSchema,
  ConfigureIntegrationSchema,
} from '../types/delivery';
import { encryptData } from '../utils/encryption';

export const deliveryRouter = Router();

/**
 * GET /api/delivery/companies
 * Get list of available delivery companies with integration status for current user
 */
export const getDeliveryCompanies: RequestHandler = async (req, res) => {
  try {
    const clientId = req.user?.id;
    
    // Get all active companies and check if user has configured integration
    const result = await pool.query(
      `SELECT dc.id, dc.name, dc.features, dc.is_active,
              CASE WHEN di.id IS NOT NULL AND di.is_enabled THEN true ELSE false END as is_configured,
              CASE WHEN di.api_key_encrypted IS NOT NULL THEN true ELSE false END as has_api_key
       FROM delivery_companies dc
       LEFT JOIN delivery_integrations di ON dc.id = di.delivery_company_id AND di.client_id = $1
       WHERE dc.is_active = true 
       ORDER BY 
         CASE WHEN di.id IS NOT NULL AND di.is_enabled THEN 0 ELSE 1 END,
         dc.name`,
      [clientId || 0]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('[Delivery] getDeliveryCompanies error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery companies' });
  }
};

/**
 * POST /api/delivery/integrations
 * Configure delivery integration for a client
 */
export const configureDeliveryIntegration: RequestHandler = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const clientId = req.user?.id || (req.body.client_id as number);
    if (!clientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validation = ConfigureIntegrationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid input',
        ...(!isProduction ? { details: validation.error } : {}),
      });
      return;
    }

    const { delivery_company_id, api_key, api_secret, account_number, merchant_id, webhook_secret } =
      validation.data;

    // Verify company exists
    const companyCheck = await pool.query(
      'SELECT id FROM delivery_companies WHERE id = $1',
      [delivery_company_id]
    );

    if (companyCheck.rows.length === 0) {
      res.status(404).json({ error: 'Delivery company not found' });
      return;
    }

    // Upsert integration
    const encryptedKey = encryptData(api_key);
    const encryptedSecret = api_secret ? encryptData(api_secret) : null;
    const encryptedWebhookSecret = webhook_secret ? encryptData(webhook_secret) : null;

    const result = await pool.query(
      `INSERT INTO delivery_integrations
       (client_id, delivery_company_id, api_key_encrypted, api_secret_encrypted, account_number, merchant_id, webhook_secret_encrypted, configured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (client_id, delivery_company_id)
       DO UPDATE SET
         api_key_encrypted = $3,
         api_secret_encrypted = $4,
         account_number = $5,
         merchant_id = $6,
         webhook_secret_encrypted = $7,
         updated_at = NOW()
       RETURNING id`,
      [clientId, delivery_company_id, encryptedKey, encryptedSecret, account_number, merchant_id, encryptedWebhookSecret]
    );

    res.json({ success: true, integration_id: result.rows[0].id });
  } catch (error: any) {
    console.error('[Delivery] configureDeliveryIntegration error:', error);
    res.status(500).json({ error: 'Failed to configure integration' });
  }
};

/**
 * GET /api/delivery/integrations
 * List enabled/disabled integrations for the authenticated client.
 * Note: Does NOT return any secrets.
 */
export const listDeliveryIntegrations: RequestHandler = async (req, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT delivery_company_id,
              is_enabled,
              (api_key_encrypted IS NOT NULL AND api_key_encrypted <> '') AS has_api_key,
              (api_secret_encrypted IS NOT NULL AND api_secret_encrypted <> '') AS has_api_secret,
              configured_at,
              updated_at
       FROM delivery_integrations
       WHERE client_id = $1
       ORDER BY updated_at DESC NULLS LAST, configured_at DESC NULLS LAST`,
      [clientId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('[Delivery] listDeliveryIntegrations error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
};

/**
 * POST /api/orders/:id/assign-delivery
 * Assign delivery company to an order
 */
export const assignDeliveryToOrder: RequestHandler = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const clientId = req.user?.id;
    const { delivery_company_id, cod_amount } = req.body;

    if (!clientId || !delivery_company_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await DeliveryService.assignDeliveryCompany(orderId, clientId as number, Number(delivery_company_id), cod_amount);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Mark as at_delivery
    await pool.query(
      `UPDATE store_orders SET status = 'at_delivery', updated_at = NOW()
       WHERE id = $1 AND client_id = $2 AND COALESCE(status, '') NOT IN ('delivered','completed','cancelled','failed','returned','refunded')`,
      [orderId, clientId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Delivery] assignDeliveryToOrder error:', error);
    res.status(500).json({ error: 'Failed to assign delivery' });
  }
};

/**
 * POST /api/orders/:id/generate-label
 * Generate shipping label for an order
 */
export const generateShippingLabel: RequestHandler = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const clientId = req.user?.id;
    const { delivery_company_id } = req.body;

    if (!clientId || !delivery_company_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await DeliveryService.generateLabel(orderId, clientId as number, Number(delivery_company_id));

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      tracking_number: result.tracking_number,
      label_url: result.label_url,
    });
  } catch (error: any) {
    console.error('[Delivery] generateShippingLabel error:', error);
    res.status(500).json({ error: 'Failed to generate label' });
  }
};

/**
 * GET /api/orders/:id/tracking
 * Get delivery tracking information
 */
export const getOrderTracking: RequestHandler = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const clientId = req.user?.id;

    if (!clientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await DeliveryService.getDeliveryStatus(orderId, parseInt(clientId));

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Delivery] getOrderTracking error:', error);
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
};

/**
 * GET /api/delivery/orders/:id/label
 * Download/stream the shipping label (PDF) for an order.
 * - For Noest: proxied from Noest API using stored encrypted credentials.
 */
export const downloadShippingLabel: RequestHandler = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const clientId = req.user?.id;

    if (!clientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderResult = await pool.query(
      `SELECT so.id, so.client_id, so.delivery_company_id, so.tracking_number, so.courier_response, dc.name as company_name
       FROM store_orders so
       JOIN delivery_companies dc ON dc.id = so.delivery_company_id
       WHERE so.id = $1 AND so.client_id = $2`,
      [orderId, clientId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderResult.rows[0];
    const companyName = String(order.company_name || '').trim().toLowerCase();
    const tracking = String(order.tracking_number || '').trim();

    if (!tracking) {
      res.status(400).json({ error: 'No tracking number on this order' });
      return;
    }

    // Label proxy is supported for couriers that require authenticated PDF fetches.
    const supportedLabelCouriers = [
      'noest',
      'noest express',
      'dhd',
      'dhd livraison',
      'dhd livraison express',
      'dolivroo',
      'maystro',
      'maystro delivery',
    ];
    if (!supportedLabelCouriers.includes(companyName)) {
      res.status(400).json({ error: 'Label download not supported for this courier' });
      return;
    }

    // Load integration credentials
    const integrationResult = await pool.query(
      `SELECT api_key_encrypted, api_secret_encrypted
       FROM delivery_integrations
       WHERE client_id = $1 AND delivery_company_id = $2 AND is_enabled = true`,
      [clientId, Number(order.delivery_company_id)]
    );

    if (integrationResult.rows.length === 0) {
      res.status(400).json({ error: 'Delivery integration not configured for this company' });
      return;
    }

    // Decrypt token and fetch label via courier service
    const { decryptData } = await import('../utils/encryption');
    const { getCourierService } = await import('../services/courier-service');
    const token = decryptData(integrationResult.rows[0].api_key_encrypted);
    const secondaryCredential = integrationResult.rows[0].api_secret_encrypted
      ? decryptData(integrationResult.rows[0].api_secret_encrypted)
      : undefined;

    const service = getCourierService(order.company_name);
    if (!service || typeof (service as any).getLabelPdf !== 'function') {
      res.status(400).json({ error: 'Courier label service unavailable' });
      return;
    }

    const dolivrooCompanyCode = companyName === 'dolivroo'
      ? String(order.courier_response?.company_code || order.courier_response?.provider || '').trim() || 'auto'
      : undefined;

    const maystroDisplayId = companyName.includes('maystro')
      ? String(
          order.courier_response?.display_id_order ||
          order.courier_response?.display_id ||
          order.courier_response?.displayId ||
          order.courier_response?.tracking ||
          order.tracking_number ||
          ''
        ).trim() || undefined
      : undefined;

    const labelResult = await (service as any).getLabelPdf(
      tracking,
      token,
      secondaryCredential,
      dolivrooCompanyCode || maystroDisplayId
    );
    if (!labelResult?.ok) {
      res.status(400).json({ error: labelResult?.error || 'Failed to fetch label' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-order-${orderId}.pdf"`);
    res.send(labelResult.pdf);
  } catch (error: any) {
    console.error('[Delivery] downloadShippingLabel error:', error);
    res.status(500).json({ error: 'Failed to download label' });
  }
};

/**
 * POST /api/webhooks/delivery/:company
 * Receive webhook updates from courier
 */
export const handleDeliveryWebhook: RequestHandler = async (req, res) => {
  try {
    const companyName = req.params.company;
    const signature = req.headers['x-signature'] as string | undefined;
    const payload = req.body;

    const result = await DeliveryService.handleWebhook(companyName, payload, signature);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Delivery] handleDeliveryWebhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * POST /api/delivery/orders/bulk-assign
 * Bulk assign delivery company to multiple orders and generate labels
 */
export const bulkAssignDelivery: RequestHandler = async (req, res) => {
  try {
    const clientId = req.user?.id;
    const { order_ids, delivery_company_id, generate_labels } = req.body;

    if (!clientId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      res.status(400).json({ error: 'No orders selected' });
      return;
    }

    if (!delivery_company_id) {
      res.status(400).json({ error: 'Delivery company is required' });
      return;
    }

    // Determine whether this company supports API shipment creation.
    const companyInfo = await pool.query(
      'SELECT name, features FROM delivery_companies WHERE id = $1 AND is_active = true',
      [delivery_company_id]
    );
    if (companyInfo.rows.length === 0) {
      res.status(404).json({ error: 'Delivery company not found or inactive' });
      return;
    }

    const companyName = String(companyInfo.rows[0]?.name || '');
    const companyFeatures = companyInfo.rows[0]?.features || {};
    const supportsApiUpload =
      companyName.trim().toLowerCase().includes('noest') ||
      Boolean(companyFeatures?.supports_tracking) ||
      Boolean(companyFeatures?.supports_labels) ||
      Boolean(companyFeatures?.supports_webhooks) ||
      Boolean(companyFeatures?.requires_credentials);

    // If we need to talk to the courier API (upload and/or labels), ensure integration exists first.
    if (supportsApiUpload) {
      const integrationCheck = await pool.query(
        `SELECT di.id, dc.name as company_name
         FROM delivery_integrations di
         JOIN delivery_companies dc ON dc.id = di.delivery_company_id
         WHERE di.client_id = $1 AND di.delivery_company_id = $2 AND di.is_enabled = true`,
        [clientId, delivery_company_id]
      );

      if (integrationCheck.rows.length === 0) {
        res.status(400).json({ 
          error: 'Delivery integration not configured',
          details: 'You need to configure API credentials for this delivery company in Settings → Delivery Companies before uploading orders.'
        });
        return;
      }
    }

    const results: { orderId: number; success: boolean; error?: string; tracking_number?: string; label_url?: string }[] = [];

    // Process each order
    for (const orderId of order_ids) {
      try {
        // Get order details for COD amount + save previous status for rollback
        const orderResult = await pool.query(
          'SELECT total_price, status, delivery_company_id, delivery_status, cod_amount FROM store_orders WHERE id = $1 AND client_id = $2',
          [orderId, clientId]
        );

        if (orderResult.rows.length === 0) {
          results.push({ orderId, success: false, error: 'Order not found' });
          continue;
        }

        const codAmount = orderResult.rows[0].total_price;
        const previousStatus = orderResult.rows[0].status;
        const previousDeliveryCompanyId = orderResult.rows[0].delivery_company_id;
        const previousDeliveryStatus = orderResult.rows[0].delivery_status;
        const previousCodAmount = orderResult.rows[0].cod_amount;

        // Assign delivery company
        const assignResult = await DeliveryService.assignDeliveryCompany(
          orderId,
          clientId as number,
          Number(delivery_company_id),
          codAmount
        );

        if (!assignResult.success) {
          results.push({ orderId, success: false, error: assignResult.error });
          continue;
        }

        // Upload shipment to courier API (if supported). Labels are optional.
        if (supportsApiUpload) {
          let apiSuccess = false;
          let apiError = '';
          let tracking_number: string | undefined;
          let label_url: string | undefined;

          if (generate_labels) {
            const labelResult = await DeliveryService.generateLabel(
              orderId,
              clientId as number,
              Number(delivery_company_id)
            );
            if (labelResult.success) {
              apiSuccess = true;
              tracking_number = labelResult.tracking_number;
              label_url = labelResult.label_url;
            } else {
              apiError = labelResult.error || 'Failed to upload to courier';
            }
          } else {
            const uploadResult = await DeliveryService.createShipment(
              orderId,
              clientId as number,
              Number(delivery_company_id)
            );
            if (uploadResult.success) {
              apiSuccess = true;
              tracking_number = uploadResult.tracking_number;
            } else {
              apiError = uploadResult.error || 'Failed to upload to courier';
            }
          }

          if (apiSuccess) {
            // Only mark as at_delivery if API upload succeeded
            await pool.query(
              `UPDATE store_orders SET status = 'at_delivery', updated_at = NOW()
               WHERE id = $1 AND client_id = $2 AND COALESCE(status, '') NOT IN ('delivered','completed','cancelled','failed','returned','refunded')`,
              [orderId, clientId]
            );
            results.push({ orderId, success: true, tracking_number, label_url });
          } else {
            // API call failed — rollback delivery assignment
            await pool.query(
              `UPDATE store_orders SET delivery_company_id = NULL, delivery_status = NULL, updated_at = NOW()
               WHERE id = $1 AND client_id = $2`,
              [orderId, clientId]
            );
            results.push({ orderId, success: false, error: apiError });
          }
        } else {
          // Manual/non-API couriers: assignment only — mark as at_delivery
          await pool.query(
            `UPDATE store_orders SET status = 'at_delivery', updated_at = NOW()
             WHERE id = $1 AND client_id = $2 AND COALESCE(status, '') NOT IN ('delivered','completed','cancelled','failed','returned','refunded')`,
            [orderId, clientId]
          );
          results.push({ orderId, success: true });
        }
      } catch (err: any) {
        results.push({ orderId, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `${successCount} orders assigned successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results,
      successCount,
      failCount,
    });
  } catch (error: any) {
    console.error('[Delivery] bulkAssignDelivery error:', error);
    res.status(500).json({ error: 'Failed to process bulk assignment' });
  }
};

// Register routes
deliveryRouter.get('/companies', getDeliveryCompanies);
deliveryRouter.get('/integrations', listDeliveryIntegrations);
deliveryRouter.post('/integrations', configureDeliveryIntegration);
deliveryRouter.post('/orders/bulk-assign', bulkAssignDelivery);
deliveryRouter.post('/orders/:id/assign', assignDeliveryToOrder);
deliveryRouter.post('/orders/:id/generate-label', generateShippingLabel);
deliveryRouter.get('/orders/:id/tracking', getOrderTracking);
deliveryRouter.get('/orders/:id/label', downloadShippingLabel);
deliveryRouter.post('/webhooks/:company', handleDeliveryWebhook);

export default deliveryRouter;
