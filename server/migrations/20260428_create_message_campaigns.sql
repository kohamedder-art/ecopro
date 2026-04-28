-- Create message_campaigns and message_logs tables for the Updates Bot campaigns feature

CREATE TABLE IF NOT EXISTS message_campaigns (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  target_category VARCHAR(50) NOT NULL DEFAULT 'all',
  channel         VARCHAR(50) NOT NULL DEFAULT 'telegram',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  recipients_count INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_campaigns_client_id ON message_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status);

CREATE TABLE IF NOT EXISTS message_logs (
  id              SERIAL PRIMARY KEY,
  campaign_id     INTEGER REFERENCES message_campaigns(id) ON DELETE CASCADE,
  client_id       INTEGER NOT NULL,
  customer_phone  VARCHAR(50),
  customer_email  VARCHAR(255),
  customer_name   VARCHAR(255),
  order_id        INTEGER,
  channel         VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_campaign_id ON message_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON message_logs(client_id);

SELECT 'Migration applied: 20260428_create_message_campaigns.sql' AS status;
