// Color Intelligence API Routes
// Handles AI-powered color analysis and recommendations for store owners

import { Router, Request, Response } from 'express';
import { colorIntelligenceService } from '../services/color-intelligence';
import { pool } from '../utils/database';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/color-intelligence/products/analyze
 * Analyze all store products and extract color palette
 */
router.get('/products/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const storeId = parseInt(req.query.storeId as string);

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    // Get all products for this store
    const productsResult = await pool.query(
      `SELECT id, title, images FROM client_store_products 
       WHERE client_id = $1 
       LIMIT 50`,
      [user.id]
    );

    const products = productsResult.rows;
    let analyzed = 0;
    let failed = 0;

    // Analyze each product image
    for (const product of products) {
      try {
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          // Use first image
          const imageUrl = typeof product.images[0] === 'string'
            ? product.images[0]
            : product.images[0].url;

          await colorIntelligenceService.analyzeProductImage(
            product.id,
            storeId,
            imageUrl
          );
          analyzed++;
        }
      } catch (error) {
        console.error(`Failed to analyze product ${product.id}:`, error);
        failed++;
      }
    }

    // Get store color palette
    const palette = await colorIntelligenceService.getStoreColorPalette(storeId);

    res.json({
      success: true,
      analyzed,
      failed,
      totalProducts: products.length,
      palette,
      message: `Analyzed ${analyzed} products. ${failed} failed.`,
    });
  } catch (error: any) {
    console.error('Error in analyze products:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * GET /api/color-intelligence/palette
 * Get store's aggregate color palette
 */
export const getColorPalette: RequestHandler = async (req, res) => {
  try {
    const { storeId } = req.params as any;
    if (!storeId) {
      res.status(400).json({ error: 'storeId is required' });
      return;
    }
    const palette = await colorIntelligenceService.getStoreColorPalette(storeId);
    res.json({ success: true, palette });
  } catch (error: any) {
    console.error('Error in getColorPalette:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

/**
 * GET /api/color-intelligence/palette
 * Get store's aggregate color palette
 */
router.get('/palette', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const storeId = parseInt(req.query.storeId as string);

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    const palette = await colorIntelligenceService.getStoreColorPalette(storeId);

    res.json({
      success: true,
      palette,
      count: palette.length,
    });
  } catch (error: any) {
    console.error('Error getting palette:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * GET /api/color-intelligence/segments
 * Get customer segments for store
 */
router.get('/segments', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const storeId = parseInt(req.query.storeId as string);

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    const segments = await colorIntelligenceService.getSegments(storeId);

    res.json({
      success: true,
      segments,
      count: segments.length,
    });
  } catch (error: any) {
    console.error('Error getting segments:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * POST /api/color-intelligence/recommend
 * Generate color recommendations for store
 */
router.post('/recommend', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const { storeId } = req.body;

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    // Generate recommendation
    const recommendation = await colorIntelligenceService.generateColorRecommendation(storeId);

    res.json({
      success: true,
      recommendation,
    });
  } catch (error: any) {
    console.error('Error generating recommendation:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * POST /api/color-intelligence/apply
 * Apply color recommendation to store
 */
router.post('/apply', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const { storeId, recommendationId } = req.body;

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    // Apply recommendation
    await colorIntelligenceService.applyColorRecommendation(storeId, recommendationId, user.id);

    res.json({
      success: true,
      message: 'Colors applied successfully!',
    });
  } catch (error: any) {
    console.error('Error applying recommendation:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * GET /api/color-intelligence/versions
 * Get color version history (for undo/redo)
 */
router.get('/versions', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const storeId = parseInt(req.query.storeId as string);

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    const versionsResult = await pool.query(
      `SELECT * FROM store_color_versions WHERE store_id = $1 ORDER BY version_number DESC`,
      [storeId]
    );

    const versions = versionsResult.rows.map((row) => ({
      versionNumber: row.version_number,
      appliedBy: row.applied_by,
      reason: row.reason,
      status: row.status,
      colors: row.colors_config,
      metricsBefore: row.metrics_before,
      metricsAfter: row.metrics_after,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      versions,
      count: versions.length,
    });
  } catch (error: any) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * POST /api/color-intelligence/undo
 * Revert to previous color version
 */
router.post('/undo', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const { storeId, versionNumber } = req.body;

    // Verify store ownership
    const storeResult = await pool.query(
      `SELECT * FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length) {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    // Get version to revert to
    const versionResult = await pool.query(
      `SELECT * FROM store_color_versions WHERE store_id = $1 AND version_number = $2`,
      [storeId, versionNumber]
    );

    if (!versionResult.rows.length) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const version = versionResult.rows[0];
    const colors = version.colors_config;

    // Apply colors
    await pool.query(
      `UPDATE client_store_settings 
       SET header_bg_color = $1, button_color = $2, text_color = $3, 
           secondary_color = $4, background_color = $5, updated_at = NOW()
       WHERE id = $6`,
      [
        colors.headerBg,
        colors.button,
        colors.text,
        colors.accent,
        colors.background,
        storeId,
      ]
    );

    // Create new version for this undo action
    const currentVersionResult = await pool.query(
      `SELECT MAX(version_number) as max_version FROM store_color_versions WHERE store_id = $1`,
      [storeId]
    );
    const nextVersion = (currentVersionResult.rows[0].max_version || 0) + 1;

    await pool.query(
      `INSERT INTO store_color_versions 
       (store_id, version_number, colors_config, applied_by, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        storeId,
        nextVersion,
        JSON.stringify(colors),
        'StoreOwner',
        `Reverted to version ${versionNumber}`,
        'active',
      ]
    );

    res.json({
      success: true,
      message: `Reverted to version ${versionNumber}`,
      newVersion: nextVersion,
    });
  } catch (error: any) {
    console.error('Error undoing version:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

/**
 * POST /api/color-intelligence/update-segment-metrics
 * Update customer segment metrics (called from analytics)
 */
router.post('/update-segment-metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req.user as any);
    const { storeId, segment } = req.body;

    // Verify store ownership (admin only or store owner)
    const storeResult = await pool.query(
      `SELECT id FROM client_store_settings WHERE id = $1 AND client_id = $2`,
      [storeId, user.id]
    );

    if (!storeResult.rows.length && user.role !== 'admin') {
      return res.status(403).json({ error: 'Store not found or unauthorized' });
    }

    await colorIntelligenceService.updateSegmentMetrics(storeId, segment);

    res.json({
      success: true,
      message: 'Segment metrics updated',
    });
  } catch (error: any) {
    console.error('Error updating segment metrics:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

export default router;
