-- AI auto-cancel merchant toggle (Meta review: cancellations must be merchant-enabled).
-- When FALSE, the AI never auto-cancels orders even if the customer asks.
-- Default TRUE preserves existing behavior; merchants opt out in AI Settings.
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS auto_cancel_orders BOOLEAN DEFAULT TRUE;
