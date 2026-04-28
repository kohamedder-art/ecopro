const pg = require('pg');
const https = require('https');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
});

// Get from database
async function resendOrderMessages(orderId) {
  try {
    console.log(`\n🔄 Attempting to resend messages for Order #${orderId}...\n`);

    // Get order details
    const orderRes = await pool.query(
      `SELECT so.id, so.client_id, so.customer_name, so.customer_phone, so.total_price, so.shipping_address,
              csp.title as product_title,
              css.store_name,
              bs.telegram_bot_token
       FROM store_orders so
       JOIN client_store_settings css ON so.client_id = css.client_id
       LEFT JOIN client_store_products csp ON so.product_id = csp.id
       LEFT JOIN bot_settings bs ON so.client_id = bs.client_id
       WHERE so.id = $1`,
      [orderId]
    );

    if (!orderRes.rows.length) {
      console.log('❌ Order not found');
      return;
    }

    const order = orderRes.rows[0];
    console.log(`✅ Found order:`);
    console.log(`   Customer: ${order.customer_name} (${order.customer_phone})`);
    console.log(`   Product: ${order.product_title}`);
    console.log(`   Price: ${order.total_price} دج`);
    console.log(`   Store: ${order.store_name}`);

    if (!order.telegram_bot_token) {
      console.log('\n❌ Bot not configured for this store');
      return;
    }

    // Check if customer has a telegram chat_id
    const chatRes = await pool.query(
      `SELECT telegram_chat_id FROM customer_messaging_ids
       WHERE client_id = $1 AND customer_phone = $2 AND telegram_chat_id IS NOT NULL
       LIMIT 1`,
      [order.client_id, order.customer_phone]
    );

    if (!chatRes.rows.length) {
      console.log('\n❌ Customer has not connected to Telegram yet');
      console.log('   Next step: Customer should click the Telegram link from their order and send /start');
      return;
    }

    const chatId = chatRes.rows[0].telegram_chat_id;
    console.log(`\n✅ Customer connected! Chat ID: ${chatId}`);

    // Generate the message
    const message = `📦 تأكيد استلام طلبك #${order.id}

تم استقبال طلبك بنجاً ${order.customer_name}! ✅

المنتج: ${order.product_title}
السعر: ${order.total_price} دج
العنوان: ${order.shipping_address || 'قريباً'}

سيتم التأكيد والتوصيل قريباً... 🚚`;

    console.log(`\n📨 Sending message...`);
    console.log(message);

    // Send via Telegram
    const sendResult = await sendTelegramMessage(order.telegram_bot_token, chatId, message);
    
    if (sendResult.success) {
      console.log('\n✅ Message sent successfully!');
    } else {
      console.log('\n❌ Failed to send message:', sendResult.error);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

// Helper to send Telegram message
function sendTelegramMessage(botToken, chatId, text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ chat_id: String(chatId), text });
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ success: result.ok, error: result.description });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    req.write(payload);
    req.end();
  });
}

// Get order ID from command line or use latest order
const orderId = process.argv[2] ? parseInt(process.argv[2]) : null;

if (orderId) {
  resendOrderMessages(orderId);
} else {
  console.log('Usage: node resend-order.cjs <orderId>');
  console.log('Example: node resend-order.cjs 30');
}
