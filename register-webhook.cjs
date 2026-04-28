const https = require('https');
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
});

async function setWebhook(botToken, webhookUrl, secretToken) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      drop_pending_updates: false,
    });

    const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const postData = `curl -X POST "${url}" -H "Content-Type: application/json" -d '${payload}'`;

    console.log('Making request to Telegram API...');
    console.log(`URL: ${url}`);
    console.log(`Webhook URL: ${webhookUrl}`);
    console.log(`Secret token: ${secretToken.substring(0, 16)}...`);

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          console.error('Failed to parse JSON:', data);
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    // Get bot settings
    const botRes = await pool.query(
      `SELECT telegram_bot_token, telegram_webhook_secret 
       FROM bot_settings WHERE client_id = 2`
    );

    if (!botRes.rows[0]) {
      console.log('❌ Bot not found');
      process.exit(1);
    }

    const botToken = botRes.rows[0].telegram_bot_token;
    const secretToken = botRes.rows[0].telegram_webhook_secret;

    console.log('🔍 Attempting to register Telegram webhook...\n');

    // Try local dev webhook first
    let webhookUrl = 'http://localhost:8080/api/telegram/webhook';
    console.log('Trying local dev URL:', webhookUrl);
    let result = await setWebhook(botToken, webhookUrl, secretToken);
    
    if (!result.ok) {
      console.log('Local URL failed (expected, Telegram can\'t reach localhost)');
      console.log('Trying production URL...\n');
      
      // Try production URL
      webhookUrl = 'https://ecopro.render.com/api/telegram/webhook';
      result = await setWebhook(botToken, webhookUrl, secretToken);
    }

    console.log('\n📋 Telegram Response:');
    if (result.ok) {
      console.log('✅ SUCCESS! Webhook registered.');
      console.log('Details:', result.result);
    } else {
      console.log('❌ FAILED:', result.description);
      console.log('Full response:', JSON.stringify(result, null, 2));
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
