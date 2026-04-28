-- Admin Chat System Migration
-- Secure messaging between admin and clients for code requests

-- Drop existing tables if they exist (clean start)
DROP TABLE IF EXISTS code_statistics CASCADE;
DROP TABLE IF EXISTS code_validation_attempts CASCADE;
DROP TABLE IF EXISTS code_requests CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;

-- Create chats table for admin-client conversations
CREATE TABLE chats (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  seller_id BIGINT,
  store_id BIGINT,
  status VARCHAR(50) DEFAULT 'open', -- open, closed, archived
  tier VARCHAR(50), -- bronze, silver, gold for code requests
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create chat_messages table for individual messages
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL,
  sender_type VARCHAR(20) NOT NULL, -- 'client', 'admin', 'seller'
  message_content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'code_request', 'code_response', 'system', 'image'
  metadata JSONB, -- For storing code requests, responses, image URLs, etc.
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (sender_type IN ('client', 'admin', 'seller'))
);

-- Create code_requests table for code issuance tracking
CREATE TABLE code_requests (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT REFERENCES chats(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  code_tier VARCHAR(50) NOT NULL, -- bronze, silver, gold, etc.
  generated_code VARCHAR(255),
  expiry_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- pending, issued, used, expired, revoked
  payment_method VARCHAR(50), -- binance, redotpay, ccp, manual, etc.
  payment_confirmed_at TIMESTAMP,
  seller_notes TEXT,
  client_notes TEXT,
  redeemed_at TIMESTAMP,
  redeemed_by_client_id BIGINT,
  is_redeemable BOOLEAN DEFAULT true,
  expiry_warning_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  issued_at TIMESTAMP,
  used_at TIMESTAMP
);

-- Create code_validation_attempts table for rate limiting
CREATE TABLE code_validation_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type VARCHAR(20) NOT NULL, -- 'client', 'admin', 'seller'
  attempted_code VARCHAR(255),
  attempt_result VARCHAR(50), -- 'success', 'invalid', 'expired', 'already_used'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (user_type IN ('client', 'admin', 'seller'))
);

-- Create code_statistics table for tracking
CREATE TABLE code_statistics (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT,
  total_codes_generated INT DEFAULT 0,
  total_codes_redeemed INT DEFAULT 0,
  total_codes_expired INT DEFAULT 0,
  total_revenue_from_codes DECIMAL(10, 2) DEFAULT 0.00,
  payment_methods_used JSONB,
  last_code_issued_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_chats_client_id ON chats(client_id);
CREATE INDEX idx_chats_seller_id ON chats(seller_id);
CREATE INDEX idx_chats_store_id ON chats(store_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_sender_type ON chat_messages(sender_type);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX idx_chat_messages_message_type ON chat_messages(message_type);

CREATE INDEX idx_code_requests_client_id ON code_requests(client_id);
CREATE INDEX idx_code_requests_chat_id ON code_requests(chat_id);
CREATE INDEX idx_code_requests_status ON code_requests(status);
CREATE INDEX idx_code_requests_expiry_date ON code_requests(expiry_date);
CREATE INDEX idx_code_requests_generated_code ON code_requests(generated_code);
CREATE INDEX idx_code_requests_created_at ON code_requests(created_at DESC);

CREATE INDEX idx_code_validation_attempts_user ON code_validation_attempts(user_id, created_at DESC);
CREATE INDEX idx_code_validation_attempts_created_at ON code_validation_attempts(created_at);
CREATE INDEX idx_code_validation_attempts_code ON code_validation_attempts(attempted_code);

-- Function to clean up old validation attempts
CREATE OR REPLACE FUNCTION cleanup_old_validation_attempts() RETURNS void AS $$
BEGIN
  DELETE FROM code_validation_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_client_id ON chats(client_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller_id ON chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_chats_store_id ON chats(store_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_type ON chat_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON chat_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_code_requests_client_id ON code_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_code_requests_chat_id ON code_requests(chat_id);
CREATE INDEX IF NOT EXISTS idx_code_requests_status ON code_requests(status);
CREATE INDEX IF NOT EXISTS idx_code_requests_expiry_date ON code_requests(expiry_date);
CREATE INDEX IF NOT EXISTS idx_code_requests_generated_code ON code_requests(generated_code);
CREATE INDEX IF NOT EXISTS idx_code_requests_created_at ON code_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_validation_attempts_user ON code_validation_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_validation_attempts_created_at ON code_validation_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_code_validation_attempts_code ON code_validation_attempts(attempted_code);

-- Function to clean up old validation attempts
CREATE OR REPLACE FUNCTION cleanup_old_validation_attempts() RETURNS void AS $$
BEGIN
  DELETE FROM code_validation_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
