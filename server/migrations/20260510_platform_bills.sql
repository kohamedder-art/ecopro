CREATE TABLE IF NOT EXISTS platform_bills (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'other',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  due_date DATE,
  paid_at TIMESTAMP,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_bills_category ON platform_bills(category);
CREATE INDEX IF NOT EXISTS idx_platform_bills_due_date ON platform_bills(due_date);
