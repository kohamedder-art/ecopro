import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const { rows } = await pool.query(
    `UPDATE security_ip_blocks SET is_active = false, updated_at = NOW() WHERE is_active = true RETURNING ip, reason`
  );
  console.log(`Unblocked ${rows.length} IP(s):`);
  for (const r of rows) console.log(`  ${r.ip}  (${r.reason || 'no reason'})`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
