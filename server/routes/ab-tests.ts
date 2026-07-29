import { RequestHandler } from "express";
import { ensureConnection } from "../utils/database";

function generateTrackingCode(): string {
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 4);
}

// ── Create A/B Test ──
export const createTest: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Test name required" });

    const result = await pool.query(
      `INSERT INTO ab_tests (client_id, name, public_id) VALUES ($1, $2, $3) RETURNING *`,
      [clientId, name.trim(), generateTrackingCode()]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[AB createTest] error:", error);
    res.status(500).json({ error: "Failed to create test" });
  }
};

// ── List A/B Tests ──
export const listTests: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const result = await pool.query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM ab_test_variants WHERE test_id = t.id) as variant_count,
        (SELECT COALESCE(SUM(impressions), 0) FROM ab_test_variants WHERE test_id = t.id) as total_impressions,
        (SELECT COALESCE(SUM(orders), 0) FROM ab_test_variants WHERE test_id = t.id) as total_orders,
        (SELECT COALESCE(SUM(revenue), 0) FROM ab_test_variants WHERE test_id = t.id) as total_revenue
       FROM ab_tests t
       WHERE t.client_id = $1
       ORDER BY t.created_at DESC`,
      [clientId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("[AB listTests] error:", error);
    res.status(500).json({ error: "Failed to list tests" });
  }
};

// ── Get Single Test ──
export const getTest: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;

    const test = await pool.query(
      `SELECT * FROM ab_tests WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
    if (!test.rows.length) return res.status(404).json({ error: "Test not found" });

    const variants = await pool.query(
      `SELECT v.*, p.title as product_name, p.slug as product_slug, p.price as product_price
       FROM ab_test_variants v
       LEFT JOIN client_store_products p ON p.id = v.product_id
       WHERE v.test_id = $1
       ORDER BY v.id`,
      [id]
    );

    const store = await pool.query(
      `SELECT store_slug, subdomain FROM client_store_settings WHERE client_id = $1`,
      [clientId]
    );

    res.json({
      ...test.rows[0],
      store_slug: store.rows[0]?.store_slug,
      store_subdomain: store.rows[0]?.subdomain,
      variants: variants.rows,
    });
  } catch (error) {
    console.error("[AB getTest] error:", error);
    res.status(500).json({ error: "Failed to get test" });
  }
};

// ── Update Test ──
export const updateTest: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;
    const { name, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === "running") { updates.push(`started_at = NOW()`); }
      if (status === "completed" || status === "paused") { updates.push(`ended_at = NOW()`); }
    }

    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });

    values.push(id, clientId);
    const result = await pool.query(
      `UPDATE ab_tests SET ${updates.join(", ")} WHERE id = $${idx++} AND client_id = $${idx} RETURNING *`,
      values
    );

    if (!result.rows.length) return res.status(404).json({ error: "Test not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[AB updateTest] error:", error);
    res.status(500).json({ error: "Failed to update test" });
  }
};

// ── Delete Test ──
export const deleteTest: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM ab_tests WHERE id = $1 AND client_id = $2 RETURNING id`,
      [id, clientId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Test not found" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[AB deleteTest] error:", error);
    res.status(500).json({ error: "Failed to delete test" });
  }
};

// ── Add Variant ──
export const addVariant: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;
    const { label, image_url, product_id, headline, cta_text } = req.body;

    if (!image_url) return res.status(400).json({ error: "Image URL required" });

    const test = await pool.query(
      `SELECT id FROM ab_tests WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
    if (!test.rows.length) return res.status(404).json({ error: "Test not found" });

    const count = await pool.query(
      `SELECT COUNT(*) FROM ab_test_variants WHERE test_id = $1`,
      [id]
    );
    const variantLabel = label || `Variant ${String.fromCharCode(65 + parseInt(count.rows[0].count))}`;
    const trackingCode = generateTrackingCode();

    const result = await pool.query(
      `INSERT INTO ab_test_variants (test_id, label, image_url, product_id, headline, cta_text, tracking_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, variantLabel, image_url, product_id || null, headline || null, cta_text || "Shop Now", trackingCode]
    );

    const variant = result.rows[0];
    if (variant.product_id) {
      const prod = await pool.query(
        `SELECT name, slug, unit_price FROM client_store_products WHERE id = $1`,
        [variant.product_id]
      );
      if (prod.rows.length) {
        variant.product_name = prod.rows[0].name;
        variant.product_slug = prod.rows[0].slug;
        variant.product_price = prod.rows[0].unit_price;
      }
    }

    res.json(variant);
  } catch (error) {
    console.error("[AB addVariant] error:", error);
    res.status(500).json({ error: "Failed to add variant" });
  }
};

// ── Update Variant ──
export const updateVariant: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id, vid } = req.params;
    const { label, image_url, product_id, headline, cta_text } = req.body;

    const check = await pool.query(
      `SELECT v.id FROM ab_test_variants v
       JOIN ab_tests t ON t.id = v.test_id
       WHERE v.id = $1 AND v.test_id = $2 AND t.client_id = $3`,
      [vid, id, clientId]
    );
    if (!check.rows.length) return res.status(404).json({ error: "Variant not found" });

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (label !== undefined) { updates.push(`label = $${idx++}`); values.push(label); }
    if (image_url !== undefined) { updates.push(`image_url = $${idx++}`); values.push(image_url); }
    if (product_id !== undefined) { updates.push(`product_id = $${idx++}`); values.push(product_id); }
    if (headline !== undefined) { updates.push(`headline = $${idx++}`); values.push(headline); }
    if (cta_text !== undefined) { updates.push(`cta_text = $${idx++}`); values.push(cta_text); }

    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });

    values.push(vid);
    const result = await pool.query(
      `UPDATE ab_test_variants SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("[AB updateVariant] error:", error);
    res.status(500).json({ error: "Failed to update variant" });
  }
};

// ── Delete Variant ──
export const deleteVariant: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id, vid } = req.params;

    const check = await pool.query(
      `SELECT v.id FROM ab_test_variants v
       JOIN ab_tests t ON t.id = v.test_id
       WHERE v.id = $1 AND v.test_id = $2 AND t.client_id = $3`,
      [vid, id, clientId]
    );
    if (!check.rows.length) return res.status(404).json({ error: "Variant not found" });

    await pool.query(`DELETE FROM ab_test_variants WHERE id = $1`, [vid]);
    res.json({ ok: true });
  } catch (error) {
    console.error("[AB deleteVariant] error:", error);
    res.status(500).json({ error: "Failed to delete variant" });
  }
};

// ── Get Results (for charts) ──
export const getResults: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;

    const test = await pool.query(
      `SELECT * FROM ab_tests WHERE id = $1 AND client_id = $2`,
      [id, clientId]
    );
    if (!test.rows.length) return res.status(404).json({ error: "Test not found" });

    const variants = await pool.query(
      `SELECT * FROM ab_test_variants WHERE test_id = $1 ORDER BY id`,
      [id]
    );

    const events = await pool.query(
      `SELECT DATE(created_at) as date, variant_id, event_type, COUNT(*) as count, COALESCE(SUM(revenue), 0) as revenue
       FROM ab_test_events WHERE test_id = $1
       GROUP BY DATE(created_at), variant_id, event_type ORDER BY date`,
      [id]
    );

    res.json({ test: test.rows[0], variants: variants.rows, events: events.rows });
  } catch (error) {
    console.error("[AB getResults] error:", error);
    res.status(500).json({ error: "Failed to get results" });
  }
};

async function getVariantRedirect(code: string, pool: any) {
  const variant = await pool.query(
    `SELECT v.*, t.client_id, t.name as test_name
     FROM ab_test_variants v
     JOIN ab_tests t ON t.id = v.test_id
     WHERE v.tracking_code = $1 AND t.status = 'running'`,
    [code]
  );
  if (!variant.rows.length) return "/";
  const v = variant.rows[0];

  // Record impression
  await pool.query(
    `UPDATE ab_test_variants SET impressions = impressions + 1 WHERE id = $1`,
    [v.id]
  );

  let redirectUrl = "/";
  if (v.product_id) {
    const product = await pool.query(
      `SELECT p.slug, s.store_slug, s.subdomain
       FROM client_store_products p
       LEFT JOIN client_store_settings s ON s.client_id = p.client_id
       WHERE p.id = $1`,
      [v.product_id]
    );
    if (product.rows.length) {
      const p = product.rows[0];
      if (p.subdomain) {
        redirectUrl = `https://${p.subdomain}.sahla4eco.com/${p.slug}`;
      } else {
        redirectUrl = `/store/${p.store_slug || "store"}/${p.slug}`;
      }
    }
  }
  return { url: redirectUrl, variantId: v.id };
}

// ── PUBLIC: API Redirect (returns JSON, for SPA use) ──
// GET /api/ab/redirect/:code → JSON with redirect URL
export const apiRedirect: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const { code } = req.params;
    const result = await getVariantRedirect(code, pool);
    if (typeof result === "string") {
      return res.json({ url: result });
    }
    res.cookie("eco_ab_v", String(result.variantId), {
      maxAge: 3 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });
    res.json({ url: result.url });
  } catch (error) {
    console.error("[AB apiRedirect] error:", error);
    res.json({ url: "/" });
  }
};

// ── PUBLIC: Server Redirect (302, for direct browser hits) ──
// GET /r/:code → track visit → 302 redirect to product page
export const redirectTrack: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const { code } = req.params;
    const result = await getVariantRedirect(code, pool);
    if (typeof result === "string") {
      return res.redirect(302, result);
    }
    res.cookie("eco_ab_v", String(result.variantId), {
      maxAge: 3 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });
    res.redirect(302, result.url);
  } catch (error) {
    console.error("[AB redirectTrack] error:", error);
    res.redirect(302, "/");
  }
};

// ── PUBLIC: Track Event ──
export const trackEvent: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const { variantId, eventType, orderId, revenue } = req.body;
    const visitorId = req.cookies?.eco_ab_v || req.headers["x-visitor-id"] as string;

    if (!variantId || !eventType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (eventType === "click") {
      await pool.query(
        `UPDATE ab_test_variants SET clicks = clicks + 1 WHERE id = $1`,
        [variantId]
      );
    } else if (eventType === "order") {
      await pool.query(
        `UPDATE ab_test_variants SET orders = orders + 1, revenue = revenue + $1 WHERE id = $2`,
        [revenue || 0, variantId]
      );
    }

    const variant = await pool.query(
      `SELECT test_id FROM ab_test_variants WHERE id = $1`,
      [variantId]
    );

    if (variant.rows.length) {
      await pool.query(
        `INSERT INTO ab_test_events (test_id, variant_id, visitor_id, event_type, order_id, revenue)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [variant.rows[0].test_id, variantId, visitorId || null, eventType, orderId || null, revenue || 0]
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("[AB trackEvent] error:", error);
    res.status(500).json({ error: "Failed to track event" });
  }
};
