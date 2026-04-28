const https = require('https');

function getUpdates(botToken) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkPendingUpdates() {
  const botToken = '8532648906:AAHW75CAh-_QNh902hp91QlaKepcg0vxar4';
  
  try {
    console.log('🔍 Checking for pending Telegram updates...\n');
    const result = await getUpdates(botToken);
    
    if (!result.ok) {
      console.log('❌ Error:', result.description);
      return;
    }

    const updates = result.result;
    console.log(`Found ${updates.length} pending updates\n`);
    
    updates.forEach(update => {
      console.log(`Update ID: ${update.update_id}`);
      if (update.message) {
        console.log(`  Type: Message`);
        console.log(`  From: ${update.message.from?.username || update.message.from?.id || 'Unknown'}`);
        console.log(`  Chat: ${update.message.chat?.id}`);
        console.log(`  Text: ${update.message.text}\n`);
      }
      if (update.callback_query) {
        console.log(`  Type: Button callback`);
        console.log(`  From: ${update.callback_query.from?.username || update.callback_query.from?.id}`);
        console.log(`  Data: ${update.callback_query.data}\n`);
      }
    });

    if (updates.length === 0) {
      console.log('✅ No pending updates - webhook is working or no messages received yet');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkPendingUpdates();
