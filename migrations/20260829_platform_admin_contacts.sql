CREATE TABLE IF NOT EXISTS platform_admin_contacts (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
