import { RequestHandler } from "express";
import { ensureConnection } from "../utils/database";

// ── PUBLIC: Assign Visitor to A/B Variant ──
// GET /api/ab/assign/:testId
// Reads eco_ab_v cookie for sticky assignment, or picks a random variant
export const assignVariant: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const { testId } = req.params;

    // Verify test exists and is running
    const test = await pool.query(
      `SELECT id FROM ab_tests WHERE public_id = $1 AND status = 'running'`,
      [testId]
    );
    if (!test.rows.length) {
      return res.json({ variant: null });
    }
    const testIdNum = test.rows[0].id;

    // Check for existing assignment via cookie
    const existingVariantId = req.cookies?.eco_ab_v
      ? Number(req.cookies.eco_ab_v)
      : null;

    if (existingVariantId) {
      const existing = await pool.query(
        `SELECT id, image_url, label, product_id, headline, cta_text
         FROM ab_test_variants
         WHERE id = $1 AND test_id = $2`,
        [existingVariantId, testIdNum]
      );
      if (existing.rows.length) {
        // Increment impressions for returning visitor
        pool.query(
          `UPDATE ab_test_variants SET impressions = impressions + 1 WHERE id = $1`,
          [existingVariantId]
        ).catch(() => {});
        return res.json({ variant: existing.rows[0] });
      }
    }

    // Pick a random active variant
    const variants = await pool.query(
      `SELECT id, image_url, label, product_id, headline, cta_text
       FROM ab_test_variants
       WHERE test_id = $1
       ORDER BY RANDOM()`,
      [testIdNum]
    );

    if (!variants.rows.length) {
      return res.json({ variant: null });
    }

    const chosen = variants.rows[0];

    // Set sticky cookie (3 days)
    res.cookie("eco_ab_v", String(chosen.id), {
      maxAge: 3 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });

    // Increment impressions
    pool.query(
      `UPDATE ab_test_variants SET impressions = impressions + 1 WHERE id = $1`,
      [chosen.id]
    ).catch(() => {});

    // Log assignment
    const visitorId = req.cookies?.eco_ab_v || req.headers["x-visitor-id"] || null;
    pool.query(
      `INSERT INTO ab_test_assignments (visitor_id, test_id, variant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (visitor_id, test_id) DO UPDATE SET variant_id = $3`,
      [visitorId || 'anonymous', testIdNum, chosen.id]
    ).catch(() => {});

    res.json({ variant: chosen });
  } catch (error) {
    console.error("[AB assignVariant] error:", error);
    res.json({ variant: null });
  }
};
