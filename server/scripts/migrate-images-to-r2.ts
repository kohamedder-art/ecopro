/**
 * Migration: Upload local /uploads/ images to R2 and update DB URLs.
 * Run: npx tsx server/scripts/migrate-images-to-r2.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

import { existsSync } from 'fs';
import path from 'path';

// Dynamic imports AFTER dotenv so r2-storage reads correct env vars
const { ensureConnection } = await import('../utils/database');
const { isR2Configured, uploadToR2 } = await import('../utils/r2-storage');

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
};

async function main() {
  if (!isR2Configured()) {
    console.error('❌ R2 not configured. Check R2_* vars in .env.local');
    process.exit(1);
  }

  const pool = await ensureConnection();
  console.log('🔄 Scanning for /uploads/ image paths...\n');

  const queries = [
    { table: 'client_store_products', sql: `SELECT id, client_id, images FROM client_store_products WHERE images IS NOT NULL AND array_length(images, 1) > 0` },
    { table: 'store_products', sql: `SELECT id, client_id, images FROM store_products WHERE images IS NOT NULL AND array_length(images, 1) > 0` },
    { table: 'client_store_settings', sql: `SELECT id, client_id, store_logo, banner_url, hero_main_url, hero_tile1_url, hero_tile2_url, template_bg_image FROM client_store_settings WHERE store_logo LIKE '/uploads/%' OR banner_url LIKE '/uploads/%' OR hero_main_url LIKE '/uploads/%' OR hero_tile1_url LIKE '/uploads/%' OR hero_tile2_url LIKE '/uploads/%' OR template_bg_image LIKE '/uploads/%'` },
  ];

  const items: { table: string; id: number; field: string; localPath: string; clientId: number }[] = [];

  for (const q of queries) {
    const res = await pool.query(q.sql);
    console.log(`📋 ${q.table}: ${res.rows.length} rows`);
    for (const row of res.rows) {
      if (q.table === 'client_store_settings') {
        for (const field of ['store_logo', 'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'template_bg_image']) {
          const val = row[field];
          if (val && typeof val === 'string' && val.startsWith('/uploads/')) {
            items.push({ table: q.table, id: row.id, field, localPath: val, clientId: row.id });
          }
        }
      } else if (Array.isArray(row.images)) {
        for (let i = 0; i < row.images.length; i++) {
          if (row.images[i]?.startsWith('/uploads/')) {
            items.push({ table: q.table, id: row.id, field: `images[${i}]`, localPath: row.images[i], clientId: row.client_id });
          }
        }
      }
    }
  }

  console.log(`\n📦 Found ${items.length} images to migrate\n`);
  if (items.length === 0) { await pool.end(); return; }

  let ok = 0, fail = 0, skip = 0;

  for (const item of items) {
    const filename = item.localPath.replace('/uploads/', '');
    const localFile = path.join(UPLOADS_DIR, filename);

    if (!existsSync(localFile)) {
      console.log(`⚠️  SKIP ${item.localPath} — not found`);
      skip++;
      continue;
    }

    try {
      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const key = `uploads/${filename}`;

      const result = await uploadToR2(localFile, key, contentType);

      // Update DB
      if (item.table === 'client_store_settings') {
        await pool.query(`UPDATE client_store_settings SET ${item.field} = $1 WHERE id = $2`, [result.url, item.id]);
      } else {
        const res = await pool.query(`SELECT images FROM ${item.table} WHERE id = $1`, [item.id]);
        if (res.rows[0]?.images) {
          const images = [...res.rows[0].images];
          const idx = parseInt(item.field.match(/\[(\d+)\]/)?.[1] || '0');
          if (idx < images.length) {
            images[idx] = result.url;
            await pool.query(`UPDATE ${item.table} SET images = $1 WHERE id = $2`, [images, item.id]);
          }
        }
      }

      console.log(`✅ ${item.localPath} → ${result.url}`);
      ok++;
    } catch (err: any) {
      console.error(`❌ ${item.localPath}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n📊 Done: ${ok} uploaded, ${fail} failed, ${skip} skipped`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
