import { RequestHandler } from "express";
import { ensureConnection } from "../utils/database";

async function getSpaAssets(): Promise<null | { styles: string[]; scripts: string[] }> {
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    const candidates = [
      path.join(__dirname, '../../spa/index.html'),
      path.join(__dirname, '../spa/index.html'),
      path.join(process.cwd(), 'dist/spa/index.html'),
      path.join(process.cwd(), 'spa/index.html'),
    ];

    let html: string | null = null;
    for (const p of candidates) {
      try {
        html = await fs.readFile(p, 'utf8');
        break;
      } catch {
        // try next
      }
    }

    if (!html) return null;

    const styles = Array.from(
      html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)
    ).map((m) => m[1]);
    const scripts = Array.from(
      html.matchAll(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)
    ).map((m) => m[1]);

    return { styles, scripts };
  } catch {
    return null;
  }
}

export const handleHealth: RequestHandler = async (_req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const devDbInit = String(process.env.DEV_DB_INIT || '').toLowerCase();
    const devDbInitEnabled = devDbInit === '1' || devDbInit === 'true' || devDbInit === 'yes';

    const commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null;
    const spa_assets = await getSpaAssets();

    // In local dev, Render Postgres can be slow/unreachable.
    // Keep health fast unless the developer explicitly opts in.
    if (!isProduction && !devDbInitEnabled) {
      return res.json({ status: 'ok', commit, spa_assets, db: { connected: false, skipped: true } });
    }

    const dbStart = Date.now();
    await ensureConnection(2);
    const dbLatency = Date.now() - dbStart;

    // Quick AI API ping — lightweight models endpoint check only in production
    let ai: { reachable: boolean; latency?: number } = { reachable: false };
    if (isProduction && process.env.DEEPINFRA_API_KEY) {
      const aiStart = Date.now();
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const aiRes = await fetch('https://api.deepinfra.com/v1/openai/models', {
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        ai = { reachable: aiRes.ok, latency: Date.now() - aiStart };
      } catch {
        ai = { reachable: false };
      }
    }

    res.json({
      status: 'ok',
      commit,
      spa_assets,
      db: { connected: true, latency: dbLatency },
      ai,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction ? 'unknown' : (err?.message || 'unknown');
    const commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null;
    const spa_assets = await getSpaAssets();
    res.status(500).json({ status: 'error', commit, spa_assets, db: { connected: false, error: message } });
  }
};