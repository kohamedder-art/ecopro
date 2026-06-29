CREATE TABLE IF NOT EXISTS account_tracking (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  user_type TEXT,

  last_ip TEXT,
  last_user_agent TEXT,
  device_info TEXT,
  last_country TEXT,
  last_region TEXT,
  last_city TEXT,
  last_path TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_requests INTEGER DEFAULT 0,

  is_suspicious BOOLEAN DEFAULT false,
  suspicious_flags JSONB DEFAULT '[]'::jsonb,
  last_suspicious_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_tracking_suspicious ON account_tracking(is_suspicious);
CREATE INDEX IF NOT EXISTS idx_account_tracking_last_seen ON account_tracking(last_seen_at DESC);
