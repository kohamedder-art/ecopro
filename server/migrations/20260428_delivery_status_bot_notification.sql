-- Add delivery status notification template to bot_settings
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS delivery_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_status_template TEXT DEFAULT NULL;

-- Default template will fall back to the one in code if NULL
SELECT 'Migration applied: 20260428_delivery_status_bot_notification.sql' AS status;
