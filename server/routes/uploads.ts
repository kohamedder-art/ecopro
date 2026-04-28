
import { RequestHandler } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import { scanFileForMalware } from '../utils/malware-scan';
import { isSafeUploadName, signUploadPath, verifyUploadSignature } from '../utils/upload-signing';
import { isCloudinaryConfigured, uploadToCloudinary } from '../utils/cloudinary';

const isProduction = process.env.NODE_ENV === 'production';

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads');

const TMP_DIR = path.join(UPLOAD_DIR, 'tmp');

const MAX_UPLOAD_BYTES = (() => {
  const raw = process.env.MAX_UPLOAD_BYTES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  // Default to 100MB (supports video uploads)
  return 100 * 1024 * 1024;
})();

// Allowlist MIME types (validated again via magic bytes)
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

async function ensureDirs() {
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// Multer stores to a private tmp dir; we verify magic bytes then rename
const storage = multer.diskStorage({
  destination: async function (_req, _file, cb) {
    try {
      await ensureDirs();
      cb(null, TMP_DIR);
    } catch (e) {
      cb(e as any, TMP_DIR);
    }
  },
  filename: function (_req, file, cb) {
    const id = crypto.randomUUID();
    const safeOrig = String(file.originalname || '').replace(/[^a-z0-9._-]/gi, '_').slice(0, 120);
    cb(null, `${id}__${safeOrig || 'upload'}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('File type not allowed'));
    }
    cb(null, true);
  },
});

// POST /api/upload (multipart/form-data)
export const uploadImage: RequestHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Magic-byte detection (server-trusts file contents, not client headers)
    const detected = await fileTypeFromFile(req.file.path);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      await fs.unlink(req.file.path).catch(() => null);
      return res.status(400).json({ error: 'File contents not allowed' });
    }

    // Malware scan (ClamAV)
    const scan = await scanFileForMalware(req.file.path);
    if (scan.ok === false) {
      await fs.unlink(req.file.path).catch(() => null);
      return res.status(400).json({ error: scan.reason });
    }

    // If Cloudinary is configured, upload there (persistent storage)
    if (isCloudinaryConfigured()) {
      try {
        const clientId = req.user.id;
        const result = await uploadToCloudinary(req.file.path, {
          folder: `ecopro/client_${clientId}`,
          resourceType: detected.mime.startsWith('video/') ? 'video' : 'image',
        });

        // Clean up temp file
        await fs.unlink(req.file.path).catch(() => null);

        return res.status(200).json({
          url: result.url,
          filename: result.publicId.split('/').pop() || result.publicId,
          size: result.bytes,
          mimetype: detected.mime,
          cloudinary: true,
        });
      } catch (cloudErr) {
        console.error('[uploadImage] Cloudinary upload failed:', cloudErr);
        // Fall through to local storage as fallback
      }
    }

    // Local storage fallback (development or if Cloudinary fails)
    await ensureDirs();
    const finalName = `${crypto.randomUUID()}.${detected.ext}`;
    const finalPath = path.join(UPLOAD_DIR, finalName);
    await fs.rename(req.file.path, finalPath);

    // Return clean URL without signature (files are publicly accessible)
    const publicUrl = `/uploads/${finalName}`;

    return res.status(200).json({
      url: publicUrl,
      filename: finalName,
      size: req.file.size,
      mimetype: detected.mime,
    });
  } catch (err) {
    console.error('[uploadImage] Caught error:', isProduction ? (err as any)?.message : err);
    return res.status(500).json(isProduction ? { error: 'Upload failed' } : { error: 'Upload failed' });
  }
};

// GET /uploads/:filename?exp=..&sig=..
export const serveSignedUpload: RequestHandler = async (req, res) => {
  try {
    const filename = String((req.params as any).filename || '');

    if (!isSafeUploadName(filename)) return res.status(404).end();

    // Allow public access to uploaded files (logos, banners, product images)
    // These are user-uploaded content that should be publicly accessible
    const filePath = path.join(UPLOAD_DIR, filename);
    
    // Prevent path traversal
    if (!filePath.startsWith(UPLOAD_DIR)) return res.status(404).end();

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).end();
    }

    return res.sendFile(filePath, {
      headers: {
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (e) {
    return res.status(404).end();
  }
};

// GET /api/client/images - List all images for a client with usage info
import { ensureConnection } from '../utils/database';

export const listClientImages: RequestHandler = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const clientId = req.user.id;
    const pool = await ensureConnection();
    
    // Get all image references from the database for THIS CLIENT ONLY
    // 1. Product images
    const productImagesResult = await pool.query(
      `SELECT id, title, images, slug FROM client_store_products WHERE client_id = $1`,
      [clientId]
    );
    
    // 2. Store settings (logo, banner, hero images)
    const settingsResult = await pool.query(
      `SELECT store_logo, banner_url, hero_main_url, hero_tile1_url, hero_tile2_url, store_images
       FROM client_store_settings WHERE client_id = $1`,
      [clientId]
    );
    
    // 3. Stock images
    const stockImagesResult = await pool.query(
      `SELECT id, name, images FROM client_stock_products WHERE client_id = $1`,
      [clientId]
    );
    
    // Build a map of image URL -> usage info
    const imageUsage: Record<string, { type: string; name: string; id?: number }[]> = {};
    // Track all image URLs that belong to this client
    const clientImageUrls = new Set<string>();
    
    // Process product images
    for (const product of productImagesResult.rows) {
      const images = product.images || [];
      for (const imgUrl of images) {
        if (!imgUrl) continue;
        clientImageUrls.add(imgUrl);
        if (!imageUsage[imgUrl]) imageUsage[imgUrl] = [];
        imageUsage[imgUrl].push({
          type: 'product',
          name: product.title || `Product #${product.id}`,
          id: product.id
        });
      }
    }
    
    // Process stock images
    for (const stock of stockImagesResult.rows) {
      const images = stock.images || [];
      for (const imgUrl of images) {
        if (!imgUrl) continue;
        clientImageUrls.add(imgUrl);
        if (!imageUsage[imgUrl]) imageUsage[imgUrl] = [];
        imageUsage[imgUrl].push({
          type: 'stock',
          name: stock.name || `Stock #${stock.id}`,
          id: stock.id
        });
      }
    }
    
    // Process store settings images
    if (settingsResult.rows.length > 0) {
      const settings = settingsResult.rows[0];
      
      if (settings.store_logo) {
        clientImageUrls.add(settings.store_logo);
        if (!imageUsage[settings.store_logo]) imageUsage[settings.store_logo] = [];
        imageUsage[settings.store_logo].push({ type: 'store', name: 'Store Logo' });
      }
      
      if (settings.banner_url) {
        clientImageUrls.add(settings.banner_url);
        if (!imageUsage[settings.banner_url]) imageUsage[settings.banner_url] = [];
        imageUsage[settings.banner_url].push({ type: 'store', name: 'Banner' });
      }
      
      if (settings.hero_main_url) {
        clientImageUrls.add(settings.hero_main_url);
        if (!imageUsage[settings.hero_main_url]) imageUsage[settings.hero_main_url] = [];
        imageUsage[settings.hero_main_url].push({ type: 'store', name: 'Hero Main' });
      }
      
      if (settings.hero_tile1_url) {
        clientImageUrls.add(settings.hero_tile1_url);
        if (!imageUsage[settings.hero_tile1_url]) imageUsage[settings.hero_tile1_url] = [];
        imageUsage[settings.hero_tile1_url].push({ type: 'store', name: 'Hero Tile 1' });
      }
      
      if (settings.hero_tile2_url) {
        clientImageUrls.add(settings.hero_tile2_url);
        if (!imageUsage[settings.hero_tile2_url]) imageUsage[settings.hero_tile2_url] = [];
        imageUsage[settings.hero_tile2_url].push({ type: 'store', name: 'Hero Tile 2' });
      }
      
      // Process store_images array
      const storeImages = settings.store_images || [];
      for (let i = 0; i < storeImages.length; i++) {
        const imgUrl = storeImages[i];
        if (!imgUrl) continue;
        clientImageUrls.add(imgUrl);
        if (!imageUsage[imgUrl]) imageUsage[imgUrl] = [];
        imageUsage[imgUrl].push({ type: 'store', name: `Store Gallery Image ${i + 1}` });
      }
    }
    
    // Read actual files from uploads directory
    await ensureDirs();
    const files = await fs.readdir(UPLOAD_DIR);
    const imageFiles = files.filter(f => 
      !f.startsWith('.') && 
      f !== 'tmp' && 
      /\.(jpg|jpeg|png|gif|webp|mp4)$/i.test(f)
    );
    
    // Build list of ALL images from database references + uploaded files
    // Include external URLs too (not just /uploads/)
    const allImages: {
      filename: string;
      url: string;
      size: number | null;
      createdAt: Date | null;
      modifiedAt: Date | null;
      usedIn: { type: string; name: string; id?: number }[];
      isOrphaned: boolean;
      isExternal: boolean;
    }[] = [];
    
    // Process uploaded files that belong to this client
    for (const filename of imageFiles) {
      const url = `/uploads/${filename}`;
      if (clientImageUrls.has(url)) {
        const filePath = path.join(UPLOAD_DIR, filename);
        try {
          const stats = await fs.stat(filePath);
          allImages.push({
            filename,
            url,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            usedIn: imageUsage[url] || [],
            isOrphaned: !imageUsage[url] || imageUsage[url].length === 0,
            isExternal: false
          });
        } catch {
          // File doesn't exist on disk but is referenced - still include it
          allImages.push({
            filename,
            url,
            size: null,
            createdAt: null,
            modifiedAt: null,
            usedIn: imageUsage[url] || [],
            isOrphaned: false,
            isExternal: false
          });
        }
      }
    }
    
    // Also include ALL database-referenced URLs that weren't found on disk
    // This handles: external URLs (http/https) AND /uploads/ paths not on local disk
    const addedUrls = new Set(allImages.map(img => img.url));
    
    for (const url of clientImageUrls) {
      // Skip if already added from disk files
      if (addedUrls.has(url)) continue;
      
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // External URL
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'external-image';
        
        allImages.push({
          filename: filename.substring(0, 50) + (filename.length > 50 ? '...' : ''),
          url,
          size: null,
          createdAt: null,
          modifiedAt: null,
          usedIn: imageUsage[url] || [],
          isOrphaned: false,
          isExternal: true
        });
      } else if (url.startsWith('/uploads/')) {
        // Local upload path not found on disk (e.g., on Render server)
        const filename = url.replace('/uploads/', '');
        
        allImages.push({
          filename,
          url,
          size: null,
          createdAt: null,
          modifiedAt: null,
          usedIn: imageUsage[url] || [],
          isOrphaned: false,
          isExternal: false
        });
      }
    }
    
    // Sort by date (newest first), external images last
    allImages.sort((a, b) => {
      if (a.isExternal && !b.isExternal) return 1;
      if (!a.isExternal && b.isExternal) return -1;
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    res.json({
      images: allImages,
      total: allImages.length,
      orphaned: allImages.filter(i => i.isOrphaned).length,
      inUse: allImages.filter(i => !i.isOrphaned).length
    });
  } catch (err) {
    console.error('[listClientImages] Error:', isProduction ? (err as any)?.message : err);
    res.status(500).json({ error: 'Failed to list images' });
  }
};

// DELETE /api/client/images/:filename - Delete an image from EVERYWHERE in account
export const deleteClientImage: RequestHandler = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // The filename could be a full URL or just a filename
    let imageUrl = String(req.params.filename || '');
    
    // If it's URL-encoded, decode it
    try {
      imageUrl = decodeURIComponent(imageUrl);
    } catch {}
    
    // If it's not a full URL, treat it as an upload filename
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      if (!isSafeUploadName(imageUrl)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      imageUrl = `/uploads/${imageUrl}`;
    }
    
    const clientId = req.user.id;
    const pool = await ensureConnection();
    
    // Remove from products - update images array to exclude this URL
    await pool.query(
      `UPDATE client_store_products 
       SET images = array_remove(images, $2),
           updated_at = NOW()
       WHERE client_id = $1 AND $2 = ANY(images)`,
      [clientId, imageUrl]
    );
    
    // Remove from stock - update images array to exclude this URL
    await pool.query(
      `UPDATE client_stock_products 
       SET images = array_remove(images, $2),
           updated_at = NOW()
       WHERE client_id = $1 AND $2 = ANY(images)`,
      [clientId, imageUrl]
    );
    
    // Remove from store settings - set to null if matches
    await pool.query(
      `UPDATE client_store_settings 
       SET 
         store_logo = CASE WHEN store_logo = $2 THEN NULL ELSE store_logo END,
         banner_url = CASE WHEN banner_url = $2 THEN NULL ELSE banner_url END,
         hero_main_url = CASE WHEN hero_main_url = $2 THEN NULL ELSE hero_main_url END,
         hero_tile1_url = CASE WHEN hero_tile1_url = $2 THEN NULL ELSE hero_tile1_url END,
         hero_tile2_url = CASE WHEN hero_tile2_url = $2 THEN NULL ELSE hero_tile2_url END,
         store_images = array_remove(store_images, $2),
         updated_at = NOW()
       WHERE client_id = $1`,
      [clientId, imageUrl]
    );
    
    // If it's a local upload, delete the file too
    if (imageUrl.startsWith('/uploads/')) {
      const filename = imageUrl.replace('/uploads/', '');
      const filePath = path.join(UPLOAD_DIR, filename);
      
      if (filePath.startsWith(UPLOAD_DIR)) {
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
        } catch {
          // File might not exist, that's ok
        }
      }
    }
    
    res.json({ ok: true, message: 'Image deleted from all locations' });
  } catch (err) {
    console.error('[deleteClientImage] Error:', isProduction ? (err as any)?.message : err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};
