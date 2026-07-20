/**
 * AI Bridge Server
 *
 * Sits on top of `opencode serve`. Each store owner on Sahla4Eco
 * gets their own opencode session. Messages are routed through
 * opencode's HTTP API using free models (big-pickle, hy3-free).
 *
 * Usage:
 *   # Terminal 1: start opencode headless server
 *   OPENCODE_SERVER_PASSWORD=your-pass opencode serve --port 4096
 *
 *   # Terminal 2: start this bridge
 *   BRIDGE_API_KEY=sk-bridge PRODUCTION_URL=https://sahla4eco.com node server.js
 */

import http from 'node:http';
import { randomBytes } from 'node:crypto';

const OPENCODE_HOST = process.env.OPENCODE_HOST || '127.0.0.1';
const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT || '4096');
const OPENCODE_USER = process.env.OPENCODE_USER || 'opencode';
const OPENCODE_PASS = process.env.OPENCODE_PASS || 'sahla4eco-bridge';
const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '3456');
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || 'sk-bridge-dev';
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'http://localhost:8080';

const OPENCODE_BASE = `http://${OPENCODE_HOST}:${OPENCODE_PORT}`;
const DEFAULT_AGENT = 'build';
const DEFAULT_MODEL = { providerID: 'opencode', modelID: 'big-pickle' };
const AUTH_HEADER = 'Basic ' + Buffer.from(`${OPENCODE_USER}:${OPENCODE_PASS}`).toString('base64');

// ─── Helpers ───────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': PRODUCTION_URL });
  res.end(JSON.stringify(data));
}

function auth(req, res) {
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (key !== BRIDGE_API_KEY) { json(res, 401, { error: 'Unauthorized' }); return false; }
  return true;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
  });
}

async function ocFetch(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  const opts = {
    method,
    headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
    signal: controller.signal,
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${OPENCODE_BASE}${path}`, opts);
    const text = await res.text();
    if (!res.ok) throw new Error(`opencode ${path}: ${res.status} ${text.slice(0, 200)}`);
    try { return JSON.parse(text); }
    catch { return text; }
  } finally {
    clearTimeout(timer);
  }
}

// In-memory session store: clientId -> opencode sessionId
const sessions = new Map();

// ─── Server ────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': PRODUCTION_URL,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // ── Health ────────────────────────────────────────────
    if (path === '/health' && req.method === 'GET') {
      // Check if opencode server is alive
      try {
        await ocFetch('GET', '/global/health');
        return json(res, 200, { status: 'ok', sessions: sessions.size, opencode: 'connected' });
      } catch (e) {
        return json(res, 200, { status: 'degraded', sessions: sessions.size, opencode: e.message });
      }
    }

    // ── All other endpoints require auth ──────────────────
    if (!auth(req, res)) return;

    // ── Send a message (create session if needed) ─────────
    // POST /ai/chat
    //   Production: { client_id, question, system_prompt?, history?, store_context?, agent? }
    //   Internal:   { prompt, system_prompt, history?, temperature?, max_tokens? }
    if (path === '/ai/chat' && req.method === 'POST') {
      const body = await parseBody(req);

      // Normalise: callAI format uses `prompt`, production uses `question`
      const question = body.question || body.prompt;
      let clientId = body.client_id;

      // No client_id => internal callAI call, derive from system_prompt hash
      if (!clientId) {
        clientId = 'internal-' + (body.system_prompt ? body.system_prompt.slice(0, 8).replace(/\s/g, '') : 'default');
        body.client_id = clientId;
      }

      if (!question) {
        return json(res, 400, { error: 'client_id and question (or prompt) are required' });
      }

      let sessionId = sessions.get(body.client_id);

      // Create session if first time
      if (!sessionId) {
        const session = await ocFetch('POST', '/session', {
          title: `Sahla4Eco - Store #${body.client_id}`,
        });
        sessionId = session.id;
        sessions.set(body.client_id, sessionId);
        console.log(`[Bridge] Created session ${sessionId} for client ${body.client_id}`);

        // Give it a brief context about who they are
        const contextMsg = body.store_context || body.system_prompt || `أنت مساعد متجر على Sahla4Eco. معرف المتجر: ${body.client_id}. أنت خبير تجارة إلكترونية في السوق الجزائري. جاوب بالعربية الفصحى فقط.`;
        await ocFetch('POST', `/session/${sessionId}/message`, {
          parts: [{ type: 'text', text: contextMsg }],
          agent: DEFAULT_AGENT,
          model: DEFAULT_MODEL,
          noReply: true,
        });
      }

      // Send the user's question
      const model = body.model || DEFAULT_MODEL;
      const reply = await ocFetch('POST', `/session/${sessionId}/message`, {
        parts: [{ type: 'text', text: question }],
        agent: DEFAULT_AGENT,
        model,
      });

      // Extract text from response parts
      const textParts = reply.parts?.filter(p => p.type === 'text').map(p => p.text) || [];
      let answer = textParts.join('\n');

      // If no text parts, check for tool calls / results
      if (!answer && reply.info?.summary?.diffs) {
        answer = JSON.stringify(reply.info.summary);
      }

      return json(res, 200, {
        answer,
        session_id: sessionId,
        usage: reply.usage || null,
      });
    }

    // ── List active sessions ──────────────────────────────
    // GET /sessions
    if (path === '/sessions' && req.method === 'GET') {
      const list = [];
      for (const [clientId, sessionId] of sessions) {
        list.push({ client_id: clientId, session_id: sessionId });
      }
      return json(res, 200, { sessions: list });
    }

    // ── Delete a session ──────────────────────────────────
    // DELETE /sessions/:client_id
    const delMatch = path.match(/^\/sessions\/(\d+)$/);
    if (delMatch && req.method === 'DELETE') {
      const clientId = parseInt(delMatch[1]);
      const sessionId = sessions.get(clientId);
      if (!sessionId) return json(res, 404, { error: 'Session not found' });

      try { await ocFetch('DELETE', `/session/${sessionId}`); }
      catch (e) { console.warn(`[Bridge] Delete failed: ${e.message}`); }
      sessions.delete(clientId);
      return json(res, 200, { deleted: true });
    }

    // ── 404 ───────────────────────────────────────────────
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Bridge]', err.message);
    json(res, 502, { error: err.message });
  }
});

server.listen(BRIDGE_PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   AI Bridge Server                   ║
  ║   Port: ${BRIDGE_PORT}                        ║
  ║   opencode: ${OPENCODE_HOST}:${OPENCODE_PORT}            ║
  ║   Sessions: ${sessions.size} active              ║
  ╚══════════════════════════════════════╝

  POST /ai/chat     Send a message  { client_id, question, ... }
  GET  /sessions    List sessions
  DELETE /sessions/:id  Remove session
  GET  /health      Bridge status

  Auth: X-Api-Key header
  CORS: ${PRODUCTION_URL}
  `);

  // Warm up: pre-create a session so the first user request isn't slow
  (async () => {
    try {
      const warm = await ocFetch('POST', '/session', { title: 'bridge-warmup' });
      await ocFetch('POST', `/session/${warm.id}/message`, {
        parts: [{ type: 'text', text: 'مرحبا' }],
        agent: DEFAULT_AGENT,
        model: DEFAULT_MODEL,
        noReply: true,
      });
      console.log('  🔥 Warm-up complete, model is loaded');
    } catch (e) {
      console.log('  Warm-up skipped (first request may be slow):', e.message.slice(0, 60));
    }
  })();
});
