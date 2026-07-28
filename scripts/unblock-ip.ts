import { getPool } from '../server/utils/database';
import { clearSecurityBlockCache } from '../server/utils/security';

const ip = process.argv[2];
if (!ip) {
  console.error('Usage: npx tsx scripts/unblock-ip.ts <IP_ADDRESS>');
  console.error('       npx tsx scripts/unblock-ip.ts --list');
  process.exit(1);
}

async function main() {
  const pool = await getPool();

  if (ip === '--list') {
    const r = await pool.query('SELECT ip, reason, created_at FROM security_ip_blocks WHERE is_active = true ORDER BY created_at DESC');
    if (r.rows.length === 0) {
      console.log('No blocked IPs found.');
    } else {
      console.log('Blocked IPs:');
      for (const row of r.rows) {
        console.log(`  ${row.ip}  (${row.reason || 'no reason'})  ${row.created_at}`);
      }
    }
      process.exit(0);
  }

  const r = await pool.query(
    `UPDATE security_ip_blocks SET is_active = false, updated_at = NOW() WHERE ip = $1 AND is_active = true RETURNING ip, reason`,
    [ip]
  );

  if (r.rows.length === 0) {
    console.log(`IP ${ip} was not found in active blocks. Check --list for current blocks.`);
  } else {
    console.log(`Unblocked ${r.rows[0].ip} (was: ${r.rows[0].reason || 'no reason'})`);
    clearSecurityBlockCache();
    console.log('Block cache cleared — change takes effect immediately.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
