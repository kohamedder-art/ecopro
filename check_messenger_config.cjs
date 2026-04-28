const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
  ssl: false
});

async function test() {
  try {
    // Check bot settings
    const settings = await pool.query(
      'SELECT fb_page_access_token, provider FROM bot_settings WHERE client_id = 2'
    );
    console.log('Bot Settings (Messenger config):');
    if (settings.rows[0]) {
      const s = settings.rows[0];
      console.log(`  Has Facebook Token: ${!!s.fb_page_access_token}`);
      console.log(`  Provider: ${s.provider}`);
    }

    // Check messenger PSIDs
    const psids = await pool.query(
      'SELECT COUNT(*) FROM customer_messaging_ids WHERE client_id = 2 AND messenger_psid IS NOT NULL'
    );
    console.log(`\nMessenger PSIDs registered: ${psids.rows[0].count}`);

    // Check order messenger chats
    const orderChats = await pool.query(
      'SELECT COUNT(*) FROM order_messenger_chats WHERE client_id = 2'
    );
    console.log(`Order Messenger Chats: ${orderChats.rows[0].count}`);

    // Check why messages are marked as waiting
    const waiting = await pool.query(
      'SELECT DISTINCT error_message FROM bot_messages WHERE client_id = 2 AND error_message IS NOT NULL LIMIT 5'
    );
    console.log(`\nError messages found:`);
    waiting.rows.forEach(r => console.log(`  - ${r.error_message}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
