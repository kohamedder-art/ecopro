const https = require('https');

async function checkTelegramWebhook(botToken) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// The bot token from the database
const TOKEN = '8532648906:AAHW75CAh4Ft_U6xVcUTMg1tOlvnPNw3gsk';

console.log('🔍 Checking Telegram webhook status...\n');

checkTelegramWebhook(TOKEN)
  .then(result => {
    if (!result.ok) {
      console.log('❌ Error from Telegram:', result.description);
      return;
    }
    
    const info = result.result;
    console.log('✅ Webhook Info:');
    console.log(`  • URL: ${info.url || 'NOT SET'}`);
    console.log(`  • Has secret: ${!!info.secret_token_set}`);
    console.log(`  • Pending updates: ${info.pending_update_count || 0}`);
    console.log(`  • Last error: ${info.last_error_message || 'None'}`);
    if (info.last_error_date) console.log(`  • Last error date: ${new Date(info.last_error_date * 1000).toISOString()}`);
    
    if (!info.url) {
      console.log('\n❌ PROBLEM: Webhook is NOT registered!');
      console.log('   The bot will not receive /start commands.');
    } else if (info.pending_update_count > 0) {
      console.log(`\n⚠️  There are ${info.pending_update_count} pending updates from Telegram`);
      console.log('   The bot needs to retrieve them.');
    } else if (info.last_error_message) {
      console.log('\n❌ PROBLEM: The webhook is failing!');
      console.log(`   Error: ${info.last_error_message}`);
    } else {
      console.log('\n✅ Webhook is properly registered and working!');
    }
  })
  .catch(err => {
    console.error('❌ Failed to check webhook:', err.message);
  });
