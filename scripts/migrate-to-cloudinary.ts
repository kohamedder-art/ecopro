/**
 * Migrate all local /uploads/ images to Cloudinary and update database URLs.
 * 
 * Usage: npx ts-node scripts/migrate-to-cloudinary.ts
 * 
 * Requires env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, DATABASE_URL
 */

import { v2 as cloudinary } from 'cloudinary';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const PROJECT_ROOT = process.cwd();

// Load .env.local
dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env.local') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const DATABASE_URL = process.env.DATABASE_URL!;
const UPLOADS_DIR = path.resolve(PROJECT_ROOT, 'uploads');

const pool = new Pool({ connectionString: DATABASE_URL });

// Track URL mappings: old -> new
const urlMap: Record<string, string> = {};
let uploaded = 0;
let skipped = 0;
let failed = 0;

async function uploadFile(localPath: string, filename: string): Promise<string | null> {
  try {
    const ext = path.extname(filename).replace('.', '');
    const baseName = path.basename(filename, path.extname(filename));
    
    const result = await cloudinary.uploader.upload(localPath, {
      folder: 'ecopro',
      public_id: baseName,
      resource_type: 'auto',
      overwrite: false,
      unique_filename: false,
    });
    
    return result.secure_url;
  } catch (err: any) {
    // If already exists, get existing URL
    if (err?.http_code === 409 || err?.message?.includes('already exists')) {
      const baseName = path.basename(filename, path.extname(filename));
      try {
        const existing = await cloudinary.api.resource(`ecopro/${baseName}`);
        return existing.secure_url;
      } catch {
        return null;
      }
    }
    console.error(`  ✗ Failed to upload ${filename}:`, err.message || err);
    return null;
  }
}

async function step1_uploadFiles() {
  console.log('\n═══ Step 1: Upload local files to Cloudinary ═══\n');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('uploads/ directory not found');
    return;
  }
  
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico'].includes(ext);
  });
  
  console.log(`Found ${files.length} image files to upload\n`);
  
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const localPath = path.join(UPLOADS_DIR, filename);
    const oldUrl = `/uploads/${filename}`;
    
    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);
    
    const cloudinaryUrl = await uploadFile(localPath, filename);
    if (cloudinaryUrl) {
      urlMap[oldUrl] = cloudinaryUrl;
      uploaded++;
      console.log(`✓ ${cloudinaryUrl}`);
    } else {
      failed++;
      console.log('✗ FAILED');
    }
  }
  
  console.log(`\nUpload complete: ${uploaded} uploaded, ${failed} failed`);
}

async function step2_updateDatabase() {
  console.log('\n═══ Step 2: Update database URLs ═══\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Update client_store_products.images (text[] array)
    const products = await client.query(
      `SELECT id, images FROM client_store_products WHERE images::text LIKE '%/uploads/%'`
    );
    let productUpdates = 0;
    for (const row of products.rows) {
      const newImages = (row.images || []).map((url: string) => urlMap[url] || url);
      await client.query(
        `UPDATE client_store_products SET images = $1 WHERE id = $2`,
        [newImages, row.id]
      );
      productUpdates++;
    }
    console.log(`  client_store_products: ${productUpdates} rows updated`);
    
    // 2. Update client_stock_products.images (text[] array)
    const stockProducts = await client.query(
      `SELECT id, images FROM client_stock_products WHERE images::text LIKE '%/uploads/%'`
    );
    let stockUpdates = 0;
    for (const row of stockProducts.rows) {
      const newImages = (row.images || []).map((url: string) => urlMap[url] || url);
      await client.query(
        `UPDATE client_stock_products SET images = $1 WHERE id = $2`,
        [newImages, row.id]
      );
      stockUpdates++;
    }
    console.log(`  client_stock_products: ${stockUpdates} rows updated`);
    
    // 3. Update client_store_settings text columns
    const settingsCols = ['store_logo', 'logo_url', 'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'template_bg_image', 'template_hotspot_image'];
    for (const col of settingsCols) {
      const res = await client.query(
        `SELECT id, ${col} FROM client_store_settings WHERE ${col} LIKE '/uploads/%'`
      );
      for (const row of res.rows) {
        const newUrl = urlMap[row[col]] || row[col];
        if (newUrl !== row[col]) {
          await client.query(`UPDATE client_store_settings SET ${col} = $1 WHERE id = $2`, [newUrl, row.id]);
          console.log(`  client_store_settings.${col}: id=${row.id} updated`);
        }
      }
    }
    
    // 4. Update client_store_settings.store_images (JSONB/text[])
    const storeImgs = await client.query(
      `SELECT id, store_images FROM client_store_settings WHERE store_images::text LIKE '%/uploads/%'`
    );
    for (const row of storeImgs.rows) {
      if (Array.isArray(row.store_images)) {
        const newImages = row.store_images.map((url: string) => urlMap[url] || url);
        await client.query(
          `UPDATE client_store_settings SET store_images = $1 WHERE id = $2`,
          [JSON.stringify(newImages), row.id]
        );
        console.log(`  client_store_settings.store_images: id=${row.id} updated`);
      }
    }
    
    // 5. Update clients.avatar_url
    const avatars = await client.query(
      `SELECT id, avatar_url FROM clients WHERE avatar_url LIKE '/uploads/%'`
    );
    for (const row of avatars.rows) {
      const newUrl = urlMap[row.avatar_url] || row.avatar_url;
      if (newUrl !== row.avatar_url) {
        await client.query(`UPDATE clients SET avatar_url = $1 WHERE id = $2`, [newUrl, row.id]);
        console.log(`  clients.avatar_url: id=${row.id} updated`);
      }
    }
    
    // 6. Update seller_store_settings
    const sellerCols = ['store_logo', 'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url'];
    for (const col of sellerCols) {
      const res = await client.query(
        `SELECT id, ${col} FROM seller_store_settings WHERE ${col} LIKE '/uploads/%'`
      );
      for (const row of res.rows) {
        const newUrl = urlMap[row[col]] || row[col];
        if (newUrl !== row[col]) {
          await client.query(`UPDATE seller_store_settings SET ${col} = $1 WHERE id = $2`, [newUrl, row.id]);
          console.log(`  seller_store_settings.${col}: id=${row.id} updated`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✓ Database updated successfully');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Database update failed, rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function step3_updateRenderDB() {
  console.log('\n═══ Step 3: Update Render database URLs ═══\n');
  
  const renderUrl = process.argv.includes('--render-url') 
    ? process.argv[process.argv.indexOf('--render-url') + 1]
    : null;
    
  if (!renderUrl) {
    console.log('Skipping Render DB update (no --render-url provided)');
    console.log('To update Render DB too, re-run with: --render-url "postgresql://..."');
    return;
  }
  
  const renderPool = new Pool({ connectionString: renderUrl, ssl: { rejectUnauthorized: false } });
  const client = await renderPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Same updates but on Render DB
    // Products
    const products = await client.query(
      `SELECT id, images FROM client_store_products WHERE images::text LIKE '%/uploads/%'`
    );
    for (const row of products.rows) {
      const newImages = (row.images || []).map((url: string) => urlMap[url] || url);
      await client.query(`UPDATE client_store_products SET images = $1 WHERE id = $2`, [newImages, row.id]);
    }
    console.log(`  Render client_store_products: ${products.rows.length} rows updated`);
    
    // Stock products
    const stockProducts = await client.query(
      `SELECT id, images FROM client_stock_products WHERE images::text LIKE '%/uploads/%'`
    );
    for (const row of stockProducts.rows) {
      const newImages = (row.images || []).map((url: string) => urlMap[url] || url);
      await client.query(`UPDATE client_stock_products SET images = $1 WHERE id = $2`, [newImages, row.id]);
    }
    console.log(`  Render client_stock_products: ${stockProducts.rows.length} rows updated`);
    
    // Settings columns
    const settingsCols = ['store_logo', 'logo_url', 'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'template_bg_image', 'template_hotspot_image'];
    for (const col of settingsCols) {
      const res = await client.query(
        `SELECT id, ${col} FROM client_store_settings WHERE ${col} LIKE '/uploads/%'`
      );
      for (const row of res.rows) {
        const newUrl = urlMap[row[col]] || row[col];
        if (newUrl !== row[col]) {
          await client.query(`UPDATE client_store_settings SET ${col} = $1 WHERE id = $2`, [newUrl, row.id]);
        }
      }
      if (res.rows.length) console.log(`  Render client_store_settings.${col}: ${res.rows.length} updated`);
    }
    
    // Avatars
    const avatars = await client.query(`SELECT id, avatar_url FROM clients WHERE avatar_url LIKE '/uploads/%'`);
    for (const row of avatars.rows) {
      const newUrl = urlMap[row.avatar_url] || row.avatar_url;
      if (newUrl !== row.avatar_url) {
        await client.query(`UPDATE clients SET avatar_url = $1 WHERE id = $2`, [newUrl, row.id]);
      }
    }
    if (avatars.rows.length) console.log(`  Render clients.avatar_url: ${avatars.rows.length} updated`);
    
    await client.query('COMMIT');
    console.log('\n✓ Render database updated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Render DB update failed, rolled back:', err);
  } finally {
    client.release();
    await renderPool.end();
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Migrate Images: Local → Cloudinary      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\nCloudinary: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  
  await step1_uploadFiles();
  await step2_updateDatabase();
  await step3_updateRenderDB();
  
  console.log('\n══════════════════════════════════════');
  console.log(`Total: ${uploaded} uploaded, ${failed} failed, ${skipped} skipped`);
  console.log(`URL mappings: ${Object.keys(urlMap).length}`);
  console.log('══════════════════════════════════════\n');
  
  await pool.end();
}

main().catch(console.error);
