import { RequestHandler } from "express";
import { ensureConnection } from "../utils/database";

export const handleHealth: RequestHandler = async (_req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const devDbInit = String(process.env.DEV_DB_INIT || '').toLowerCase();
    const devDbInitEnabled = devDbInit === '1' || devDbInit === 'true' || devDbInit === 'yes';

    // In local dev, Render Postgres can be slow/unreachable.
    // Keep health fast unless the developer explicitly opts in.
    if (!isProduction && !devDbInitEnabled) {
      return res.json({ status: 'ok' });
    }

    // Verify DB connectivity so the health check reflects readiness.
    await ensureConnection(2);

    // Public health response stays minimal so it can't be used to fingerprint
    // the runtime (no commit hash, asset paths, db latency, or AI reachability).
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
};
