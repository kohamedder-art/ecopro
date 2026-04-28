const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ecopro_user:ecopro_local_2026@localhost:5432/ecopro_dev',
});

async function test() {
  try {
    console.log('🔍 Checking all stores...\n');
    const storesRes = await pool.query(
      `SELECT id, client_id, store_name, store_slug FROM client_store_settings ORDER BY created_at DESC`
    );
    console.log(`Found ${storesRes.rows.length} stores\n`);
    storesRes.rows.forEach(row => {
      console.log(`  • ${row.store_name} (client_id: ${row.client_id})`);
    });

    console.log('\n🔍 Checking all recent orders...\n');
    const ordersRes = await pool.query(
      `SELECT id, client_id, customer_name, customer_phone, status, created_at
       FROM store_orders
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log(`Found ${ordersRes.rows.length} orders\n`);
    ordersRes.rows.forEach(row => {
      console.log(`  • Order #${row.id}: ${row.customer_name} (${row.customer_phone})`);
      console.log(`    Client: ${row.client_id}, Status: ${row.status}, Created: ${row.created_at.toISOString()}\n`);
    });

    console.log('✅ Done!');
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
