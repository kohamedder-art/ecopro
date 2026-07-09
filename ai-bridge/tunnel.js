/**
 * Tunnel script – exposes the bridge server to the internet
 * so sahla4eco.com can reach your local PC.
 *
 * Requirements:
 *   npm install -g localtunnel    (simplest, no account needed)
 *   OR
 *   npm install -g ngrok          (more reliable, needs free account)
 *
 * Usage:
 *   node tunnel.js
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PORT = process.env.PORT || 3456;
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'sahla4eco-ai';

async function tryNgrok() {
  try {
    execSync('ngrok --version', { stdio: 'pipe' });
    console.log('[Tunnel] Starting ngrok...');
    const ngrok = spawn('ngrok', ['http', String(PORT), '--host-header=rewrite'], {
      stdio: 'inherit',
      shell: true,
    });
    console.log(`\n  ngrok dashboard: http://127.0.0.1:4040`);
    console.log(`  Get your URL from the dashboard or use:\n`);
    console.log(`    curl http://127.0.0.1:4040/api/tunnels\n`);
    return ngrok;
  } catch {
    return null;
  }
}

async function tryLocaltunnel() {
  try {
    execSync('lt --version', { stdio: 'pipe' });
    console.log('[Tunnel] Starting localtunnel...');
    const lt = spawn('npx', ['lt', '--port', String(PORT), '--subdomain', SUBDOMAIN], {
      stdio: 'inherit',
      shell: true,
    });
    return lt;
  } catch {
    return null;
  }
}

async function tryCloudflared() {
  try {
    execSync('cloudflared --version', { stdio: 'pipe' });
    console.log('[Tunnel] Starting cloudflared...');
    const cf = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], {
      stdio: 'inherit',
      shell: true,
    });
    return cf;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n  🔗 AI Bridge Tunnel`);
  console.log(`  ──────────────────`);
  console.log(`  Bridge port: ${PORT}`);
  console.log(`  Trying cloudflared → localtunnel → ngrok...\n`);

  let tunnel = await tryCloudflared();
  if (!tunnel) tunnel = await tryLocaltunnel();
  if (!tunnel) tunnel = await tryNgrok();

  if (!tunnel) {
    console.log('\n  ❌ No tunnel tool found. Install one:\n');
    console.log('    npm install -g localtunnel    (easiest)');
    console.log('    npm install -g ngrok           (most reliable)');
    console.log('    cloudflared tunnel --url ...   (fastest)');
    console.log(`\n  Or manually expose port ${PORT} via your router.\n`);
    process.exit(1);
  }

  tunnel.on('exit', (code) => {
    console.log(`[Tunnel] exited with code ${code}`);
    process.exit(code);
  });
}

main();
