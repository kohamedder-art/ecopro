// Google Sheets API Routes
// Handles OAuth, import, and mapping operations

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../utils/database';
import { googleSheetsService, sheetsCallbackUrl } from '../services/google-sheets';
import {
  GoogleConnectSchema,
  ImportMappingSchema,
  ImportRequestSchema,
} from '../types/google-sheets';
import { ZodError } from 'zod';
import { jsonServerError } from '../utils/httpHelpers';

const router = Router();

// Middleware to require authentication
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req.user as any)?.clientId || (req.user as any)?.id;
  if (!clientId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  (req as any).clientId = clientId;
  next();
};

/**
 * GET /api/google/auth-url
 * Get OAuth authorization URL
 */
router.get('/auth-url', (req: Request, res: Response) => {
  try {
    const url = googleSheetsService.getAuthorizationUrl();
    res.json({ url });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to generate authorization URL');
  }
});

/**
 * POST /api/google/connect
 * OAuth callback - exchange code for tokens and save
 */
router.post('/connect', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    const { code, state } = GoogleConnectSchema.parse(req.body);

    // Exchange code for tokens
    const tokens = await googleSheetsService.getTokensFromCode(code);

    // Save tokens to database
    await googleSheetsService.saveTokens(clientId, tokens);

    res.json({
      success: true,
      message: 'Google account connected successfully',
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    return jsonServerError(res, error, 'Failed to connect Google account');
  }
});

/**
 * GET /api/google/status
 * Check if Google account is connected
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    const result = await pool.query(
      `SELECT client_id, is_active, expires_at, updated_at 
       FROM google_tokens 
       WHERE client_id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    const token = result.rows[0];
    res.json({
      connected: token.is_active,
      expiresAt: token.expires_at,
      lastUpdated: token.updated_at,
    });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to check connection status');
  }
});

/**
 * GET /api/google/sheets/:spreadsheetId
 * List sheets in a spreadsheet
 */
router.get('/sheets/:spreadsheetId', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const { spreadsheetId } = req.params;

  try {
    const accessToken = await googleSheetsService.getValidTokens(clientId);
    const metadata = await googleSheetsService.listSheets(accessToken, spreadsheetId);

    res.json(metadata);
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to list sheets');
  }
});

/**
 * POST /api/google/preview
 * Preview data from a sheet range
 */
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    const { spreadsheetId, range, limit = 10 } = req.body;

    if (!spreadsheetId || !range) {
      return res.status(400).json({
        error: 'spreadsheetId and range are required',
      });
    }

    const accessToken = await googleSheetsService.getValidTokens(clientId);
    const rows = await googleSheetsService.readRange(
      accessToken,
      spreadsheetId,
      range
    );

    res.json({
      total: rows.length,
      preview: rows.slice(0, limit),
      headers: rows.length > 0 ? Object.keys(rows[0]) : [],
    });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to preview sheet data');
  }
});

/**
 * POST /api/google/mappings
 * Save or update a column mapping
 */
router.post('/mappings', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    const data = ImportMappingSchema.parse(req.body);

    await pool.query(
      `INSERT INTO import_mappings 
       (client_id, mapping_name, import_type, column_mapping, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (client_id, mapping_name)
       DO UPDATE SET column_mapping = $4, updated_at = NOW()`,
      [clientId, data.mapping_name, data.import_type, JSON.stringify(data.column_mapping)]
    );

    res.json({
      success: true,
      message: 'Mapping saved successfully',
      mapping_name: data.mapping_name,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid mapping',
        details: error.errors,
      });
    }
    return jsonServerError(res, error, 'Failed to save mapping');
  }
});

/**
 * GET /api/google/mappings
 * Get all saved mappings for the client
 */
router.get('/mappings', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const { importType } = req.query;

  try {
    let query = `SELECT mapping_name, import_type, column_mapping, created_at, updated_at
                 FROM import_mappings
                 WHERE client_id = $1`;
    const params: any[] = [clientId];

    if (importType) {
      query += ` AND import_type = $2`;
      params.push(importType);
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await pool.query(query, params);

    const mappings = result.rows.map((row) => ({
      mapping_name: row.mapping_name,
      import_type: row.import_type,
      column_mapping: row.column_mapping,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json(mappings);
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to fetch mappings');
  }
});

/**
 * POST /api/google/import
 * Start an import job
 */
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    const data = ImportRequestSchema.parse(req.body);

    // Get access token
    const accessToken = await googleSheetsService.getValidTokens(clientId);

    // Read sheet data
    const rows = await googleSheetsService.readRange(
      accessToken,
      data.spreadsheet_id,
      data.data_range || 'A:Z'
    );

    if (rows.length === 0) {
      return res.json({
        success: false,
        message: 'No data found in sheet',
        totalRows: 0,
        successfulImports: 0,
        failedRows: 0,
      });
    }

    // Map and validate rows based on import type
    let validRows: any[] = [];
    let errorMap = new Map<number, string>();

    if (data.import_type === 'orders') {
      const result = googleSheetsService.mapRowsToOrders(rows, data.column_mapping);
      validRows = result.valid;
      errorMap = result.errors;
    } else if (data.import_type === 'customers') {
      const result = googleSheetsService.mapRowsToCustomers(rows, data.column_mapping);
      validRows = result.valid;
      errorMap = result.errors;
    } else if (data.import_type === 'products') {
      const result = googleSheetsService.mapRowsToProducts(rows, data.column_mapping);
      validRows = result.valid;
      errorMap = result.errors;
    }

    // Create import job record
    const jobResult = await pool.query(
      `INSERT INTO import_jobs 
       (client_id, import_type, spreadsheet_id, sheet_range, total_rows, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), NOW())
       RETURNING id`,
      [
        clientId,
        data.import_type,
        data.spreadsheet_id,
        data.data_range || 'A:Z',
        rows.length,
      ]
    );

    const jobId = jobResult.rows[0].id;

    // Log import details
    await pool.query(
      `UPDATE import_jobs 
       SET successful_imports = $1, failed_rows = $2, error_details = $3
       WHERE id = $4`,
      [validRows.length, errorMap.size, JSON.stringify(Array.from(errorMap)), jobId]
    );

    // Log each row (optionally - could be deferred for large imports)
    if (validRows.length > 0) {
      const values = validRows
        .map(
          (row, idx) =>
            `(${jobId}, ${idx + 1}, 'success', '${JSON.stringify(row).replace(/'/g, "''")}')`
        )
        .join(',');

      await pool.query(
        `INSERT INTO import_logs (import_job_id, row_number, status, mapped_data)
         VALUES ${values}`
      );
    }

    res.json({
      success: validRows.length > 0,
      jobId,
      totalRows: rows.length,
      successfulImports: validRows.length,
      failedRows: errorMap.size,
      errors: errorMap.size > 0 ? Object.fromEntries(errorMap) : null,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid import request',
        details: error.errors,
      });
    }
    return jsonServerError(res, error, 'Import failed');
  }
});

/**
 * GET /api/google/imports
 * Get import history for the client
 */
router.get('/imports', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const { limit = 20, offset = 0, importType } = req.query;

  try {
    let query = `SELECT id, import_type, total_rows, successful_imports, failed_rows, status, created_at
                 FROM import_jobs
                 WHERE client_id = $1`;
    const params: any[] = [clientId];

    if (importType) {
      query += ` AND import_type = $${params.length + 1}`;
      params.push(importType);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query(query, params);

    res.json({
      imports: result.rows,
      total: result.rows.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to fetch import history');
  }
});

/**
 * GET /api/google/imports/:jobId
 * Get details of a specific import job
 */
router.get('/imports/:jobId', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const { jobId } = req.params;

  try {
    const jobResult = await pool.query(
      `SELECT id, import_type, total_rows, successful_imports, failed_rows, status, error_details, created_at
       FROM import_jobs
       WHERE id = $1 AND client_id = $2`,
      [jobId, clientId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    const job = jobResult.rows[0];

    // Get log details
    const logsResult = await pool.query(
      `SELECT row_number, status, mapped_data, error_message
       FROM import_logs
       WHERE import_job_id = $1
       ORDER BY row_number`,
      [jobId]
    );

    res.json({
      ...job,
      logs: logsResult.rows,
    });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to fetch import details');
  }
});

/**
 * POST /api/google/disconnect
 * Disconnect Google account
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;

  try {
    await pool.query(
      `UPDATE google_tokens
       SET is_active = false, updated_at = NOW()
       WHERE client_id = $1`,
      [clientId]
    );

    res.json({
      success: true,
      message: 'Google account disconnected',
    });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to disconnect Google account');
  }
});

/**
 * POST /api/google/export-orders
 * Upload the store's orders into a Google Sheet (appends rows).
 * Body: { spreadsheet_id: string, sheet_name?: string }
 */
router.post('/export-orders', requireAuth, async (req: Request, res: Response) => {
  const clientId = (req as any).clientId;
  const activeStoreId = (req as any).activeStoreId;

  try {
    const rawInput = String(req.body?.spreadsheet_id || '').trim();
    // Accept either the bare ID or a full docs.google.com URL pasted in
    const urlMatch = rawInput.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = urlMatch ? urlMatch[1] : rawInput;
    const sheetName = String(req.body?.sheet_name || 'Orders').trim() || 'Orders';
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'spreadsheet_id is required' });
    }

    const accessToken = await googleSheetsService.getValidTokens(clientId);

    const storeFilter = activeStoreId ? 'o.store_id' : 'o.client_id';
    const storeIdVal = activeStoreId || clientId;
    const result = await pool.query(
      `SELECT
         o.id, o.created_at, o.customer_name, o.customer_phone,
         o.shipping_address, o.shipping_wilaya_id, o.shipping_commune_id,
         o.quantity, o.total_price, o.delivery_fee, o.status, o.delivery_type,
         o.tracking_number, o.notes, o.variant_name, o.variant_color, o.variant_size,
         COALESCE(cp.title, '') as product_title
       FROM store_orders o
       LEFT JOIN client_store_products cp ON o.product_id = cp.id
       WHERE ${storeFilter} = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT 5000`,
      [storeIdVal]
    );

    // Wilaya id -> Arabic name for readable sheets
    let wilayaName = (id: any) => String(id ?? '');
    try {
      const wilayas = (await import('../../client/data/algeria-geo/wilayas.json')).default as any[];
      const map = new Map(wilayas.map((w: any) => [Number(w.code ?? w.id), w.arabic_name || w.name]));
      wilayaName = (id: any) => map.get(Number(id)) || String(id ?? '');
    } catch { /* fallback to raw id */ }

    const header = ['Order ID', 'Date', 'Customer', 'Phone', 'Wilaya', 'Address', 'Product', 'Variant', 'Qty', 'Product Total', 'Delivery Fee', 'Grand Total', 'Status', 'Delivery Type', 'Tracking', 'Notes'];
    const rows = result.rows.map((o: any) => {
      const variant = o.variant_name || [o.variant_color, o.variant_size].filter(Boolean).join(' / ') || '';
      const total = Number(o.total_price || 0);
      const fee = Number(o.delivery_fee || 0);
      return [
        o.id,
        o.created_at ? new Date(o.created_at).toISOString().slice(0, 16).replace('T', ' ') : '',
        o.customer_name || '',
        String(o.customer_phone || ''),
        wilayaName(o.shipping_wilaya_id),
        o.shipping_address || '',
        o.product_title || '',
        variant,
        Number(o.quantity || 0),
        total,
        fee,
        total + fee,
        o.status || '',
        o.delivery_type || '',
        o.tracking_number || '',
        o.notes || '',
      ];
    });

    if (rows.length === 0) {
      return res.json({ success: true, exported: 0, message: 'No orders to export' });
    }

    const exported = await googleSheetsService.appendRows(accessToken, spreadsheetId, sheetName, header, rows);
    res.json({ success: true, exported });
  } catch (error: any) {
    // Known-safe classified messages (auth, permissions, missing sheet) are
    // shown as-is; anything else stays a generic 500 in production.
    const msg = error instanceof Error ? error.message : String(error || '');
    if (/reconnect|not found|not enabled|No Google tokens|spreadsheet_id is required/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    return jsonServerError(res, error, 'Order export failed');
  }
});

/**
 * GET /api/google/connect-url?return_to=/dashboard/orders
 * Host-aware consent URL for the Sheets flow (works on localhost AND
 * production, as long as each /api/google/sheets-callback URI is
 * whitelisted in Google Cloud Console).
 */
router.get('/connect-url', requireAuth, async (req: Request, res: Response) => {
  try {
    const proto = String((req.headers['x-forwarded-proto'] as string) || req.protocol || 'http').split(',')[0].trim();
    const host = String(req.get('host') || '');
    const redirectUri = sheetsCallbackUrl(proto, host);
    let returnTo = String(req.query.return_to || '/dashboard/orders');
    if (!returnTo.startsWith('/')) returnTo = '/dashboard/orders';
    const url = googleSheetsService.getSheetsAuthUrl(redirectUri, returnTo);
    res.json({ url });
  } catch (error: any) {
    return jsonServerError(res, error, 'Failed to generate consent URL');
  }
});

/**
 * GET /api/google/sheets-callback?code=...&state=/dashboard/orders
 * Server-side OAuth callback (same working pattern as login):
 * exchanges the code, saves tokens, redirects back to the dashboard.
 */
router.get('/sheets-callback', async (req: Request, res: Response) => {
  const clientId = (req.user as any)?.clientId || (req.user as any)?.id;
  const fail = (to: string) => res.redirect(`${to}${to.includes('?') ? '&' : '?'}google_error=auth_failed`);
  try {
    let returnTo = typeof req.query.state === 'string' && req.query.state.startsWith('/') ? req.query.state : '/dashboard/orders';
    const code = req.query.code;
    if (!clientId) return fail('/login');
    if (!code || typeof code !== 'string') return fail(returnTo);
    const proto = String((req.headers['x-forwarded-proto'] as string) || req.protocol || 'http').split(',')[0].trim();
    const host = String(req.get('host') || '');
    const redirectUri = sheetsCallbackUrl(proto, host);
    const tokens = await googleSheetsService.getTokensFromCode(code, redirectUri);
    await googleSheetsService.saveTokens(Number(clientId), tokens);
    res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}google_connected=1`);
  } catch (error: any) {
    console.error('[Sheets] OAuth callback failed:', error?.message || error);
    const returnTo = typeof req.query.state === 'string' && req.query.state.startsWith('/') ? req.query.state : '/dashboard/orders';
    fail(returnTo);
  }
});

export default router;
