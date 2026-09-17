-- AI Day Pass (200 DZD / 24h): paid extension after monthly allowance is used up.
-- A pass grants unlimited AI (within daily abuse caps) until ends_at.
-- Activated by the RedotPay webhook (metadata.type = 'ai_day_pass').

CREATE TABLE IF NOT EXISTS ai_passes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 200,
  currency VARCHAR(3) NOT NULL DEFAULT 'DZD',
  payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  checkout_session_id BIGINT REFERENCES checkout_sessions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'refunded'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_passes_client_ends ON ai_passes(client_id, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_passes_status ON ai_passes(status);
