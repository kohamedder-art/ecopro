-- Add fraud detection columns to store_orders
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS customer_ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS browser_fingerprint VARCHAR(255),
  ADD COLUMN IF NOT EXISTS form_fill_time_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_store_orders_customer_ip ON store_orders(customer_ip);
CREATE INDEX IF NOT EXISTS idx_store_orders_browser_fingerprint ON store_orders(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_store_orders_ip_created ON store_orders(customer_ip, created_at);

-- Table for tracking known fraud patterns
CREATE TABLE IF NOT EXISTS fraud_signals (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  order_id INTEGER REFERENCES store_orders(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_client ON fraud_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_type ON fraud_signals(signal_type, signal_value);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_created ON fraud_signals(created_at);
