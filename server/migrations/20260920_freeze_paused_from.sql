-- Remember which status a freeze came from (trial vs active) so resume restores it.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_from VARCHAR(20);
