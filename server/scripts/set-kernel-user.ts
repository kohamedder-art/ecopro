import 'dotenv/config';
import crypto from 'crypto';
import { ensureConnection, initializeDatabase, runPendingMigrations } from '../utils/database';
import { hashKernelPassword } from '../utils/security';

function randomPassword(): string {
  return (
    'K-' +
    crypto.randomBytes(12).toString('hex') +
    '-' +
    crypto.randomBytes(4).toString('hex')
  );
}

async function main() {
  const username = (process.env.KERNEL_USERNAME || 'root').trim();
  const password = (process.env.KERNEL_PASSWORD || randomPassword()).trim();

  await initializeDatabase();
  await runPendingMigrations();

  const pool = await ensureConnection();

  const passwordHash = hashKernelPassword(password);

  await pool.query(
    `INSERT INTO kernel_users (username, password_hash, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                  is_active = true,
                  updated_at = NOW()`,
    [username, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ username, password }));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
