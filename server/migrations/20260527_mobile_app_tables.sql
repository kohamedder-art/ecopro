-- Create mobile app infrastructure tables

-- Order status history for timeline display
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  changed_by VARCHAR(100) DEFAULT 'system',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_client_id ON order_status_history(client_id);

-- Mobile push notification device registration
CREATE TABLE IF NOT EXISTS push_devices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_client_id ON push_devices(client_id);

-- Mobile in-app notification history
CREATE TABLE IF NOT EXISTS mobile_notifications (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT,
  body TEXT,
  order_id INTEGER REFERENCES store_orders(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_notifications_client_id ON mobile_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_mobile_notifications_unread ON mobile_notifications(client_id, is_read) WHERE is_read = false;

-- QR auth tokens for mobile app login
CREATE TABLE IF NOT EXISTS qr_auth_tokens (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_auth_tokens_token ON qr_auth_tokens(token);
