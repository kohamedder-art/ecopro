const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
});

async function test() {
  try {
    console.log('🔍 Checking order_telegram_links (unused start tokens)...\n');
    const linksRes = await pool.query(
      `SELECT start_token, order_id, client_id, customer_phone, created_at, used_at
       FROM order_telegram_links
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log(`Found ${linksRes.rows.length} telegram links\n`);
    linksRes.rows.forEach(row => {
      console.log(`  • Order #${row.order_id}: ${row.customer_phone}`);
      console.log(`    Token: ${row.start_token.substring(0, 16)}...`);
      console.log(`    Created: ${row.created_at.toISOString()}, Used: ${row.used_at ? row.used_at.toISOString() : 'NOT YET'}\n`);
    });

    console.log('🔍 Checking bot_messages (queued messages)...\n');
    const msgsRes = await pool.query(
      `SELECT id, order_id, customer_phone, message_type, status, error_message, created_at
       FROM bot_messages
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log(`Found ${msgsRes.rows.length} bot messages\n`);
    msgsRes.rows.forEach(row => {
      console.log(`  • Message ${row.id}: Order #${row.order_id}`);
      console.log(`    Type: ${row.message_type}, Status: ${row.status}`);
      if (row.error_message) console.log(`    Error: ${row.error_message}`);
      console.log();
    });

    console.log('🔍 Checking webhook status...\n');
    const botRes = await pool.query(
      `SELECT telegram_bot_username, telegram_bot_token, telegram_webhook_secret 
       FROM bot_settings WHERE client_id = 2`
    );
    const bot = botRes.rows[0];
    if (bot) {
      console.log(`  • Bot username: @${bot.telegram_bot_username}`);
      console.log(`  • Bot token (first 20 chars): ${bot.telegram_bot_token.substring(0, 20)}...`);
      console.log(`  • Webhook secret: ${bot.telegram_webhook_secret.substring(0, 16)}...`);
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
