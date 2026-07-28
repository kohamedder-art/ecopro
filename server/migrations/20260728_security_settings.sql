-- Security settings table for kernel portal configuration
-- Stores runtime-adjustable security parameters

CREATE TABLE IF NOT EXISTS security_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings (inserted only if not present)
INSERT INTO security_settings (key, value) VALUES
  ('auto_block_enabled', 'true'),
  ('admin_probe_threshold', '12'),
  ('suspicious_probe_threshold', '3'),
  ('probe_window_minutes', '10'),
  ('event_retention_days', '90')
ON CONFLICT (key) DO NOTHING;
