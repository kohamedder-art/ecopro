const { Pool } = require('pg');

// Use the environment variable directly
const pool = new Pool({
  connectionString: 'postgresql://ecopro_user:FjNvyTrXpQvKwLmZ@render.postgresql.com:5432/ecopro_production',
  ssl: { rejectUnauthorized: false }
});

pool.query(
  'SELECT id, order_id, client_id, status FROM bot_messages WHERE client_id = 2 LIMIT 5',
  (err, res) => {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('Bot messages found:', res.rows.length);
      res.rows.forEach(r => console.log(r));
    }
    pool.end();
  }
);
