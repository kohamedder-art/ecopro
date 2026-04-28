import { RequestHandler } from "express";
import { pool } from "../utils/database";

const COLUMNS = [
  "ai_chat_enabled",
  "guardian_enabled",
  "storefront_assistant",
  "auto_descriptions",
  "auto_pricing",
  "auto_alt_text",
  "image_analysis",
  "analytics_narration",
  "inventory_forecast",
  "order_suggestions",
  "order_priority",
  "churn_warning",
  "reply_suggestions",
  "broadcast_composer",
  "omni_intelligence",
  "action_order_status",
  "action_create_product",
  "action_edit_product",
  "action_delete_product",
  "action_store_design",
  "action_bot_control",
] as const;

type SettingsRow = Record<(typeof COLUMNS)[number], boolean>;

async function ensureRow(clientId: number): Promise<SettingsRow> {
  const existing = await pool.query(
    `SELECT * FROM ai_settings WHERE client_id = $1`,
    [clientId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const inserted = await pool.query(
    `INSERT INTO ai_settings (client_id) VALUES ($1) RETURNING *`,
    [clientId]
  );
  return inserted.rows[0];
}

export const getAISettings: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Unauthorized" });

    const row = await ensureRow(Number(clientId));
    const settings: Record<string, boolean | string> = {};
    for (const col of COLUMNS) {
      settings[col] = row[col] ?? true;
    }
    settings.ai_instructions = row.ai_instructions || '';
    return res.json(settings);
  } catch (err: any) {
    console.error("GET /api/ai-settings error:", err);
    return res.status(500).json({ error: "Failed to load AI settings" });
  }
};

export const updateAISettings: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Unauthorized" });

    await ensureRow(Number(clientId));

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const col of COLUMNS) {
      if (col in req.body && typeof req.body[col] === "boolean") {
        updates.push(`${col} = $${idx}`);
        values.push(req.body[col]);
        idx++;
      }
    }

    // Handle ai_instructions text field
    if ("ai_instructions" in req.body && typeof req.body.ai_instructions === "string") {
      updates.push(`ai_instructions = $${idx}`);
      values.push(req.body.ai_instructions);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    values.push(Number(clientId));
    await pool.query(
      `UPDATE ai_settings SET ${updates.join(", ")}, updated_at = NOW() WHERE client_id = $${idx}`,
      values
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/ai-settings error:", err);
    return res.status(500).json({ error: "Failed to update AI settings" });
  }
};
