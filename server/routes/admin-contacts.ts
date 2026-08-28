import { Router } from "express";
import { pool } from "../utils/database";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// ── Admin CRUD (auth required) ──────────────────────────────────────

router.get("/", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM platform_admin_contacts ORDER BY sort_order ASC, id ASC"
    );
    res.json({ contacts: result.rows });
  } catch (error) {
    console.error("Error fetching admin contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { platform, label, url, icon_url, sort_order } = req.body;
    if (!platform || !label || !url) {
      return res.status(400).json({ error: "platform, label, and url are required" });
    }
    const result = await pool.query(
      `INSERT INTO platform_admin_contacts (platform, label, url, icon_url, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [platform, label, url, icon_url || null, sort_order ?? 0]
    );
    res.json({ contact: result.rows[0] });
  } catch (error) {
    console.error("Error creating admin contact:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, label, url, icon_url, is_active, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE platform_admin_contacts
       SET platform = COALESCE($1, platform),
           label = COALESCE($2, label),
           url = COALESCE($3, url),
           icon_url = $4,
           is_active = COALESCE($5, is_active),
           sort_order = COALESCE($6, sort_order),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [platform, label, url, icon_url ?? null, is_active, sort_order, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json({ contact: result.rows[0] });
  } catch (error) {
    console.error("Error updating admin contact:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM platform_admin_contacts WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting admin contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// ── Public endpoint (no auth) ───────────────────────────────────────

router.get("/public", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT platform, label, url, icon_url FROM platform_admin_contacts WHERE is_active = true ORDER BY sort_order ASC, id ASC"
    );
    res.json({ contacts: result.rows });
  } catch (error) {
    console.error("Error fetching public admin contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

export default router;
