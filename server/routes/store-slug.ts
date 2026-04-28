/**
 * Store Slug Management Routes
 * 
 * Allows store owners to set a custom URL slug for their store.
 * Example: /store/matjar-ibda instead of /store/store-x1y2z3
 */

import { Router, Request, Response } from 'express';
import { pool } from '../utils/database';
import { authenticate, requireClient } from '../middleware/auth';

const router = Router();

/**
 * GET /api/store/slug
 * Get current store slug info
 */
router.get('/', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    
    const result = await pool.query(
      `SELECT store_slug, store_name, is_custom_slug 
       FROM client_store_settings 
       WHERE client_id = $1`,
      [clientId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const { store_slug, store_name, is_custom_slug } = result.rows[0];
    
    // Generate suggested slug from store name
    const suggestedSlug = await generateSlugFromName(store_name);
    
    res.json({
      currentSlug: store_slug,
      storeName: store_name,
      isCustom: is_custom_slug,
      suggestedSlug: suggestedSlug,
      fullUrl: `${req.protocol}://${req.get('host')}/store/${store_slug}`
    });
  } catch (error) {
    console.error('[StoreSlug] Error fetching slug:', error);
    res.status(500).json({ error: 'Failed to fetch store slug' });
  }
});

/**
 * POST /api/store/slug
 * Update store slug
 * Body: { slug: string }
 */
router.post('/', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    const { slug } = req.body;
    
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Slug is required' });
    }
    
    // Validate slug format
    const normalizedSlug = slug.toLowerCase().trim();
    
    if (!isValidSlug(normalizedSlug)) {
      return res.status(400).json({ 
        error: 'Invalid slug format. Use 3-50 lowercase letters, numbers, and hyphens only.',
        details: 'Slug must start and end with a letter or number, and cannot contain consecutive hyphens.'
      });
    }
    
    // Check if slug is reserved
    if (isReservedSlug(normalizedSlug)) {
      return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
    }
    
    // Check uniqueness (excluding current store)
    const existing = await pool.query(
      `SELECT client_id FROM client_store_settings WHERE store_slug = $1 AND client_id != $2`,
      [normalizedSlug, clientId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This slug is already taken. Please choose another.',
        suggestedAlternatives: generateAlternatives(normalizedSlug)
      });
    }
    
    // Update slug
    await pool.query(
      `UPDATE client_store_settings 
       SET store_slug = $1, is_custom_slug = true, updated_at = NOW()
       WHERE client_id = $2`,
      [normalizedSlug, clientId]
    );
    
    res.json({
      success: true,
      newSlug: normalizedSlug,
      fullUrl: `${req.protocol}://${req.get('host')}/store/${normalizedSlug}`,
      message: 'Store URL updated successfully'
    });
  } catch (error: any) {
    console.error('[StoreSlug] Error updating slug:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'This slug is already taken' });
    }
    res.status(500).json({ error: 'Failed to update store slug' });
  }
});

/**
 * POST /api/store/slug/check
 * Check if a slug is available
 * Body: { slug: string }
 */
router.post('/check', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    const { slug } = req.body;
    
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Slug is required' });
    }
    
    const normalizedSlug = slug.toLowerCase().trim();
    
    // Validate
    if (!isValidSlug(normalizedSlug)) {
      return res.json({
        available: false,
        valid: false,
        error: 'Invalid slug format'
      });
    }
    
    if (isReservedSlug(normalizedSlug)) {
      return res.json({
        available: false,
        valid: true,
        reserved: true,
        error: 'Reserved slug'
      });
    }
    
    // Check availability
    const existing = await pool.query(
      `SELECT client_id FROM client_store_settings WHERE store_slug = $1 AND client_id != $2`,
      [normalizedSlug, clientId]
    );
    
    const isAvailable = existing.rows.length === 0;
    
    res.json({
      available: isAvailable,
      valid: true,
      reserved: false,
      suggestions: isAvailable ? [] : generateAlternatives(normalizedSlug)
    });
  } catch (error) {
    console.error('[StoreSlug] Error checking slug:', error);
    res.status(500).json({ error: 'Failed to check slug availability' });
  }
});

// Helper functions
function isValidSlug(slug: string): boolean {
  // 3-50 characters
  if (slug.length < 3 || slug.length > 50) return false;
  
  // Only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  
  // Cannot start or end with hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) return false;
  
  // No consecutive hyphens
  if (slug.includes('--')) return false;
  
  return true;
}

function isReservedSlug(slug: string): boolean {
  const reserved = [
    'admin', 'api', 'store', 'dashboard', 'login', 'register', 'logout',
    'settings', 'profile', 'orders', 'products', 'cart', 'checkout',
    'payment', 'support', 'help', 'terms', 'privacy', 'about', 'contact',
    'blog', 'news', 'app', 'mobile', 'ios', 'android', 'www', 'mail',
    'ftp', 'smtp', 'pop', 'imap', 'cdn', 'static', 'assets', 'images',
    'css', 'js', 'api-v1', 'api-v2', 'graphql', 'rest', 'webhook'
  ];
  return reserved.includes(slug);
}

function generateAlternatives(baseSlug: string): string[] {
  const alternatives = [];
  const suffixes = ['shop', 'store', 'dz', 'algeria', '1', '2', '3'];
  
  for (const suffix of suffixes) {
    alternatives.push(`${baseSlug}-${suffix}`);
  }
  
  return alternatives.slice(0, 3);
}

async function generateSlugFromName(storeName: string): Promise<string> {
  if (!storeName) return '';
  
  // Simple transliteration
  let slug = storeName.toLowerCase();
  
  // Basic Arabic transliteration mapping
  const arabicMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ء': '', 'ئ': 'y', 'ؤ': 'w', 'ة': 'h',
    'ى': 'a'
  };
  
  for (const [arabic, latin] of Object.entries(arabicMap)) {
    slug = slug.split(arabic).join(latin);
  }
  
  // Replace non-alphanumeric with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  
  // Trim hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, '-');
  
  return slug.substring(0, 50);
}

export default router;
