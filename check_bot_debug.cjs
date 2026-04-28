const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
  ssl: false
});

async function test() {
  try {
    // Check bot settings for client 2
    const settings = await pool.query(
      'SELECT enabled, telegram_bot_token, fb_page_access_token, provider, messenger_enabled, telegram_delay_minutes FROM bot_settings WHERE client_id = 2'
    );
    console.log('\n=== Bot Settings for test@gmail.com (client 2) ===');
    if (settings.rows.length > 0) {
      const s = settings.rows[0];
      console.log(`Enabled: ${s.enabled}`);
      console.log(`Has Telegram Token: ${!!s.telegram_bot_token}`);
      console.log(`Has Messenger Token: ${!!s.fb_page_access_token}`);
      console.log(`Provider: ${s.provider}`);
      console.log(`Messenger Enabled: ${s.messenger_enabled}`);
      console.log(`Telegram Delay: ${s.telegram_delay_minutes} min`);
    } else {
      console.log('NO BOT SETTINGS FOUND');
    }

    // Check bot messages
    const botMsgs = await pool.query(
      'SELECT id, order_id, message_type, status, send_at, error_message FROM bot_messages WHERE client_id = 2 ORDER BY created_at DESC LIMIT 10'
    );
    console.log('\n=== Recent Bot Messages ===');
    console.log(`Found: ${botMsgs.rows.length} messages`);
    botMsgs.rows.forEach(r => {
      console.log(`  ID ${r.id}: Order ${r.order_id}, Type: ${r.message_type}, Status: ${r.status}, SendAt: ${r.send_at}, Error: ${r.error_message || 'none'}`);
    });

    // Check scheduled messages
    const scheduled = await pool.query(
      'SELECT id, order_id, status, scheduled_at FROM scheduled_messages WHERE client_id = 2 ORDER BY created_at DESC LIMIT 10'
    );
    console.log('\n=== Scheduled Messages ===');
    console.log(`Found: ${scheduled.rows.length} messages`);
    scheduled.rows.forEach(r => {
      console.log(`  ID ${r.id}: Order ${r.order_id}, Status: ${r.status}, Scheduled: ${r.scheduled_at}`);
    });

    // Check recent orders
    const orders = await pool.query(
      'SELECT id, customer_name, status, created_at FROM store_orders WHERE client_id = 2 ORDER BY created_at DESC LIMIT 5'
    );
    console.log('\n=== Recent Orders ===');
    console.log(`Found: ${orders.rows.length} orders`);
    orders.rows.forEach(r => {
      console.log(`  Order ${r.id}: Customer: ${r.customer_name}, Status: ${r.status}, Created: ${r.created_at}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
