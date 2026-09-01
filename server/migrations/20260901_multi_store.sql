-- Multi-Store: allow one account to own multiple stores.
-- Phase 0: Schema changes + backfill existing data.
-- Strategy: add store_id columns, backfill from client_id, then drop old UNIQUE constraints.

-- ============================================================
-- 1. Drop the UNIQUE constraint on client_store_settings.client_id
-- ============================================================
ALTER TABLE client_store_settings DROP CONSTRAINT IF EXISTS client_store_settings_client_id_key;

-- ============================================================
-- 2. Add store_id columns to store-owned tables (where missing)
--    store_id references client_store_settings(id)
-- ============================================================

-- Products & inventory
ALTER TABLE client_store_products ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE product_economics ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Stock
ALTER TABLE client_stock_products ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE client_stock_history ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE client_stock_variants ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE client_stock_categories ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Orders (store_id exists but is all NULL — backfill below)
-- order_status_history
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Delivery
ALTER TABLE delivery_prices ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE delivery_labels ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE delivery_integrations ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE delivery_errors ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Messaging & bots
ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE message_campaigns ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE bot_messages ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE order_confirmations ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE order_telegram_chats ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE order_telegram_links ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE order_messenger_chats ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE messenger_preconnect_tokens ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE customer_messaging_ids ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE customer_preconnect_tokens ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE messenger_subscribers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_subscribers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- AI
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_customer_insights ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_product_knowledge ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_training_examples ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_usage_quotas ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE store_owner_conversations ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE store_daily_snapshots ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE weekly_insights ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE ai_store_memory ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE proactive_actions ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Customers
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE customer_conversations ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE customer_conversation_facts ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Analytics
ALTER TABLE ab_tests ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE analytic_sessions ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE analytic_session_touches ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE creative_catalog ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE creative_spend_entries ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE historical_import_jobs ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Facebook tokens, QR auth
ALTER TABLE facebook_tokens ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE qr_auth_tokens ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Fraud, push
ALTER TABLE fraud_signals ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE mobile_notifications ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Subscriptions (move from user_id to store_id)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- Store owner facts
ALTER TABLE store_owner_facts ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Backfill store_id from client_id
--    For each table, join on client_id to find the store_id
--    from client_store_settings where client_store_settings.client_id = table.client_id
-- ============================================================

-- Products
UPDATE client_store_products csp SET store_id = css.id FROM client_store_settings css WHERE csp.client_id = css.client_id AND csp.store_id IS NULL;
UPDATE product_variants pv SET store_id = css.id FROM client_store_settings css WHERE pv.client_id = css.client_id AND pv.store_id IS NULL;
UPDATE product_offers po SET store_id = css.id FROM client_store_settings css WHERE po.client_id = css.client_id AND po.store_id IS NULL;
UPDATE product_economics pe SET store_id = css.id FROM client_store_settings css WHERE pe.client_id = css.client_id AND pe.store_id IS NULL;

-- Stock
UPDATE client_stock_products csp SET store_id = css.id FROM client_store_settings css WHERE csp.client_id = css.client_id AND csp.store_id IS NULL;
UPDATE client_stock_history csh SET store_id = css.id FROM client_store_settings css WHERE csh.client_id = css.client_id AND csh.store_id IS NULL;
UPDATE client_stock_variants csv SET store_id = css.id FROM client_store_settings css WHERE csv.client_id = css.client_id AND csv.store_id IS NULL;
UPDATE client_stock_categories csc SET store_id = css.id FROM client_store_settings css WHERE csc.client_id = css.client_id AND csc.store_id IS NULL;

-- Orders (store_id exists but is all NULL)
UPDATE store_orders so SET store_id = css.id FROM client_store_settings css WHERE so.client_id = css.client_id AND so.store_id IS NULL;
UPDATE order_status_history osh SET store_id = css.id FROM client_store_settings css WHERE osh.client_id = css.client_id AND osh.store_id IS NULL;

-- Delivery
UPDATE delivery_prices dp SET store_id = css.id FROM client_store_settings css WHERE dp.client_id = css.client_id AND dp.store_id IS NULL;
UPDATE delivery_labels dl SET store_id = css.id FROM client_store_settings css WHERE dl.client_id = css.client_id AND dl.store_id IS NULL;
UPDATE delivery_events de SET store_id = css.id FROM client_store_settings css WHERE de.client_id = css.client_id AND de.store_id IS NULL;
UPDATE delivery_integrations di SET store_id = css.id FROM client_store_settings css WHERE di.client_id = css.client_id AND di.store_id IS NULL;
UPDATE delivery_errors derr SET store_id = css.id FROM client_store_settings css WHERE derr.client_id = css.client_id AND derr.store_id IS NULL;

-- Messaging
UPDATE scheduled_messages sm SET store_id = css.id FROM client_store_settings css WHERE sm.client_id = css.client_id AND sm.store_id IS NULL;
UPDATE message_campaigns mc SET store_id = css.id FROM client_store_settings css WHERE mc.client_id = css.client_id AND mc.store_id IS NULL;
UPDATE message_logs ml SET store_id = css.id FROM client_store_settings css WHERE ml.client_id = css.client_id AND ml.store_id IS NULL;
UPDATE bot_messages bm SET store_id = css.id FROM client_store_settings css WHERE bm.client_id = css.client_id AND bm.store_id IS NULL;
UPDATE bot_settings bs SET store_id = css.id FROM client_store_settings css WHERE bs.client_id = css.client_id AND bs.store_id IS NULL;
UPDATE order_confirmations oc SET store_id = css.id FROM client_store_settings css WHERE oc.client_id = css.client_id AND oc.store_id IS NULL;
UPDATE confirmation_links cl SET store_id = css.id FROM client_store_settings css WHERE cl.client_id = css.client_id AND cl.store_id IS NULL;
UPDATE order_telegram_chats otc SET store_id = css.id FROM client_store_settings css WHERE otc.client_id = css.client_id AND otc.store_id IS NULL;
UPDATE order_telegram_links otl SET store_id = css.id FROM client_store_settings css WHERE otl.client_id = css.client_id AND otl.store_id IS NULL;
UPDATE order_messenger_chats omc SET store_id = css.id FROM client_store_settings css WHERE omc.client_id = css.client_id AND omc.store_id IS NULL;
UPDATE messenger_preconnect_tokens mpt SET store_id = css.id FROM client_store_settings css WHERE mpt.client_id = css.client_id AND mpt.store_id IS NULL;
UPDATE customer_messaging_ids cmi SET store_id = css.id FROM client_store_settings css WHERE cmi.client_id = css.client_id AND cmi.store_id IS NULL;
UPDATE customer_preconnect_tokens cpt SET store_id = css.id FROM client_store_settings css WHERE cpt.client_id = css.client_id AND cpt.store_id IS NULL;
UPDATE messenger_subscribers ms SET store_id = css.id FROM client_store_settings css WHERE ms.client_id = css.client_id AND ms.store_id IS NULL;
UPDATE whatsapp_subscribers ws SET store_id = css.id FROM client_store_settings css WHERE ws.client_id = css.client_id AND ws.store_id IS NULL;

-- AI
UPDATE ai_settings ais SET store_id = css.id FROM client_store_settings css WHERE ais.client_id = css.client_id AND ais.store_id IS NULL;
UPDATE ai_personas aip SET store_id = css.id FROM client_store_settings css WHERE aip.client_id = css.client_id AND aip.store_id IS NULL;
UPDATE ai_customer_insights aci SET store_id = css.id FROM client_store_settings css WHERE aci.client_id = css.client_id AND aci.store_id IS NULL;
UPDATE ai_product_knowledge apk SET store_id = css.id FROM client_store_settings css WHERE apk.client_id = css.client_id AND apk.store_id IS NULL;
UPDATE ai_training_examples ate SET store_id = css.id FROM client_store_settings css WHERE ate.client_id = css.client_id AND ate.store_id IS NULL;
UPDATE ai_usage_quotas auq SET store_id = css.id FROM client_store_settings css WHERE auq.client_id = css.client_id AND auq.store_id IS NULL;
UPDATE ai_usage_logs aul SET store_id = css.id FROM client_store_settings css WHERE aul.client_id = css.client_id AND aul.store_id IS NULL;
UPDATE store_owner_conversations soc SET store_id = css.id FROM client_store_settings css WHERE soc.client_id = css.client_id AND soc.store_id IS NULL;
UPDATE store_daily_snapshots sds SET store_id = css.id FROM client_store_settings css WHERE sds.client_id = css.client_id AND sds.store_id IS NULL;
UPDATE weekly_insights wi SET store_id = css.id FROM client_store_settings css WHERE wi.client_id = css.client_id AND wi.store_id IS NULL;
UPDATE ai_store_memory asm SET store_id = css.id FROM client_store_settings css WHERE asm.client_id = css.client_id AND asm.store_id IS NULL;
UPDATE proactive_actions pa SET store_id = css.id FROM client_store_settings css WHERE pa.client_id = css.client_id AND pa.store_id IS NULL;

-- Customers
UPDATE customer_profiles cp SET store_id = css.id FROM client_store_settings css WHERE cp.client_id = css.client_id AND cp.store_id IS NULL;
UPDATE customer_conversations cc SET store_id = css.id FROM client_store_settings css WHERE cc.client_id = css.client_id AND cc.store_id IS NULL;
UPDATE customer_conversation_facts ccf SET store_id = css.id FROM client_store_settings css WHERE ccf.client_id = css.client_id AND ccf.store_id IS NULL;

-- Analytics
UPDATE ab_tests abt SET store_id = css.id FROM client_store_settings css WHERE abt.client_id = css.client_id AND abt.store_id IS NULL;
UPDATE analytic_sessions ans SET store_id = css.id FROM client_store_settings css WHERE ans.client_id = css.client_id AND ans.store_id IS NULL;
UPDATE analytic_session_touches ast SET store_id = css.id FROM client_store_settings css WHERE ast.client_id = css.client_id AND ast.store_id IS NULL;
UPDATE creative_catalog cc SET store_id = css.id FROM client_store_settings css WHERE cc.client_id = css.client_id AND cc.store_id IS NULL;
UPDATE creative_spend_entries cse SET store_id = css.id FROM client_store_settings css WHERE cse.client_id = css.client_id AND cse.store_id IS NULL;
UPDATE historical_import_jobs hij SET store_id = css.id FROM client_store_settings css WHERE hij.client_id = css.client_id AND hij.store_id IS NULL;

-- Staff
UPDATE staff s SET store_id = css.id FROM client_store_settings css WHERE s.client_id = css.client_id AND s.store_id IS NULL;

-- Facebook, QR
UPDATE facebook_tokens ft SET store_id = css.id FROM client_store_settings css WHERE ft.client_id = css.client_id AND ft.store_id IS NULL;
UPDATE qr_auth_tokens qat SET store_id = css.id FROM client_store_settings css WHERE qat.client_id = css.client_id AND qat.store_id IS NULL;

-- Fraud, push
UPDATE fraud_signals fs SET store_id = css.id FROM client_store_settings css WHERE fs.client_id = css.client_id AND fs.store_id IS NULL;
UPDATE push_devices pd SET store_id = css.id FROM client_store_settings css WHERE pd.client_id = css.client_id AND pd.store_id IS NULL;
UPDATE mobile_notifications mn SET store_id = css.id FROM client_store_settings css WHERE mn.client_id = css.client_id AND mn.store_id IS NULL;

-- Subscriptions
UPDATE subscriptions s SET store_id = css.id FROM client_store_settings css WHERE s.user_id = css.client_id AND s.store_id IS NULL;
UPDATE payments p SET store_id = css.id FROM client_store_settings css WHERE p.user_id = css.client_id AND p.store_id IS NULL;

-- Store owner facts
UPDATE store_owner_facts sof SET store_id = css.id FROM client_store_settings css WHERE sof.client_id = css.client_id AND sof.store_id IS NULL;

-- ============================================================
-- 4. Drop UNIQUE constraints on client_id for 1:1 tables
--    (now they become 1:N via store_id)
-- ============================================================
ALTER TABLE bot_settings DROP CONSTRAINT IF EXISTS bot_settings_client_id_key;
ALTER TABLE ai_settings DROP CONSTRAINT IF EXISTS ai_settings_client_id_key;
ALTER TABLE ai_personas DROP CONSTRAINT IF EXISTS ai_personas_client_id_key;
ALTER TABLE facebook_tokens DROP CONSTRAINT IF EXISTS facebook_tokens_client_id_key;
ALTER TABLE qr_auth_tokens DROP CONSTRAINT IF EXISTS qr_auth_tokens_client_id_key;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;
ALTER TABLE store_owner_facts DROP CONSTRAINT IF EXISTS store_owner_facts_client_id_key;

-- ============================================================
-- 5. Add indexes on store_id for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_client_store_products_store_id ON client_store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON product_variants(store_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_store_id ON product_offers(store_id);
CREATE INDEX IF NOT EXISTS idx_product_economics_store_id ON product_economics(store_id);
CREATE INDEX IF NOT EXISTS idx_client_stock_products_store_id ON client_stock_products(store_id);
CREATE INDEX IF NOT EXISTS idx_client_stock_history_store_id ON client_stock_history(store_id);
CREATE INDEX IF NOT EXISTS idx_client_stock_variants_store_id ON client_stock_variants(store_id);
CREATE INDEX IF NOT EXISTS idx_client_stock_categories_store_id ON client_stock_categories(store_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_store_id ON store_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_store_id ON order_status_history(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_prices_store_id ON delivery_prices(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_labels_store_id ON delivery_labels(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_store_id ON delivery_events(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_integrations_store_id ON delivery_integrations(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_errors_store_id ON delivery_errors(store_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_store_id ON scheduled_messages(store_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_store_id ON message_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_store_id ON message_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_store_id ON bot_messages(store_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_store_id ON bot_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_store_id ON ai_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_personas_store_id ON ai_personas(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_store_id ON customer_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_id ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store_id ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_store_id ON ab_tests(store_id);
CREATE INDEX IF NOT EXISTS idx_analytic_sessions_store_id ON analytic_sessions(store_id);
