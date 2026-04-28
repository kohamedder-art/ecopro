-- Facebook/Instagram OAuth tokens for store owners
CREATE TABLE IF NOT EXISTS facebook_tokens (
  id                          SERIAL PRIMARY KEY,
  client_id                   INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  fb_user_id                  TEXT NOT NULL,
  user_access_token_encrypted TEXT NOT NULL,
  page_id                     TEXT NOT NULL,
  page_name                   TEXT,
  page_access_token_encrypted TEXT NOT NULL,
  instagram_account_id        TEXT,
  instagram_username          TEXT,
  scopes                      TEXT,
  token_expires_at            TIMESTAMP WITH TIME ZONE,
  last_refreshed_at           TIMESTAMP WITH TIME ZONE,
  is_active                   BOOLEAN DEFAULT TRUE,
  created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facebook_tokens_client ON facebook_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_facebook_tokens_page ON facebook_tokens(page_id);
