-- Subscription freeze (pause) support
-- Account-level: one subscription per user covers ALL their stores.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
-- status='paused' marks a frozen account; resume extends current_period_end day-for-day.
