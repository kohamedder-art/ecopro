const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
  ssl: false
});

(async () => {
  try {
    const r = await pool.query('UPDATE bot_settings SET messenger_enabled = false WHERE client_id = 2');
    console.log('Updated:', r.rowCount, 'rows');
  } catch(e) { console.error(e.message); }
  finally { pool.end(); }
})();
