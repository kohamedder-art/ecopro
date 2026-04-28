const https = require('https');
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
});

async function processUpdate(updateId, chatId, text) {
  try {
    // Extract token from /start command
    const parts = text.split(/\s+/);
    const token = parts[1];

    console.log(`\n🔄 Processing update ${updateId}`);
    console.log(`   Chat: ${chatId}, Text: ${text}`);
    
    if (!token) {
      console.log('   ❌ No token found');
      return;
    }

    console.log(`   Token: ${token.substring(0, 16)}...`);

    // Look up the token to find the order
    const linkRes = await pool.query(
      `SELECT order_id, client_id, customer_phone, customer_name
       FROM order_telegram_links
       WHERE start_token = $1
       LIMIT 1`,
      [token]
    );

    if (!linkRes.rows.length) {
      console.log('   ❌ Token not found in database');
      return;
    }

    const link = linkRes.rows[0];
    console.log(`   ✅ Found: Order #${link.order_id}, Customer: ${link.customer_name}`);

    // Save the connection
    await pool.query(
      `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id`,
      [link.order_id, link.client_id, chatId]
    );

    // Save phone mapping
    await pool.query(
      `INSERT INTO customer_messaging_ids (client_id, customer_phone, telegram_chat_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (client_id, customer_phone)
       DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()`,
      [link.client_id, link.customer_phone, chatId]
    );

    // Mark link as used
    await pool.query(
      `UPDATE order_telegram_links SET used_at = NOW() WHERE start_token = $1`,
      [token]
    );

    console.log('   ✅ Connection saved!');
    console.log(`   ✅ Now send a message to chat ${chatId}...`);

  } catch (err) {
    console.error('   ❌ Error:', err.message);
  }
}

async function main() {
  try {
    // Process the updates
    const updates = [
      { id: 657934137, chat: 5941629106, text: '/start dcebd7e8049fe35ba65148737369d342' },
      { id: 657934139, chat: 5941629106, text: '/start fdc2aea3082ca4c1b3f70fef95a17603' },
    ];

    console.log('🔄 Processing pending Telegram updates...');

    for (const update of updates) {
      await processUpdate(update.id, update.chat, update.text);
    }

    console.log('\n✅ All updates processed!');
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
