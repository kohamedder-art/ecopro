function getCsrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)
  return m?.[1] ?? ""
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return "🌐"
  const offset = 0x1f1e6
  const a = code.charCodeAt(0) - 65 + offset
  const b = code.charCodeAt(1) - 65 + offset
  return String.fromCodePoint(a, b)
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString()
}

/* ── Severity / Event / Tool colors for SOC theme ── */
const SEVERITY_STYLES: Record<string, string> = {
  critical: "k-a-red",
  error: "k-a-red",
  warn: "k-a-amber",
  info: "k-a-blue",
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "k-dot-critical",
  error: "k-dot-error",
  warn: "k-dot-warn",
  info: "k-dot-info",
}

const EVENT_LABELS: Record<string, string> = {
  rate_limit_hit: "Rate Limit",
  suspicious_request: "Suspicious",
  auth_failure: "Auth Failure",
  sql_injection: "SQL Injection",
  prompt_injection: "Prompt Injection",
  auth_login_failed: "Login Failed",
  trap_hit: "Trap Hit",
  blocked_request: "Blocked",
  known_bot: "Known Bot",
  honeypot_trap: "Honeypot",
  geo_block: "Geo Block",
  ip_block: "IP Block",
  suspicious_path: "Suspicious Path",
  unknown: "Unknown",
}

const EVENT_TYPES = Object.keys(EVENT_LABELS)

const TOOL_STYLES: Record<string, string> = {
  nmap: "k-a-purple", sqlmap: "k-a-red", ffuf: "k-a-red",
  gobuster: "k-a-amber", nuclei: "k-a-amber", masscan: "k-a-purple",
  nikto: "k-a-red", metasploit: "k-a-red", burp: "k-a-cyan",
  zap: "k-a-blue", curl: "k-a-green", wget: "k-a-green",
  python: "k-a-blue", "go-http": "k-a-cyan", java: "k-a-amber",
  "linux-scanner": "k-muted",
}

function getToolFromUA(ua: string | null): string | null {
  if (!ua) return null
  const patterns: [RegExp, string][] = [
    [/nmap/i, "nmap"], [/sqlmap/i, "sqlmap"], [/ffuf|fuzz\//i, "ffuf"],
    [/gobuster|dirbuster/i, "gobuster"], [/nuclei/i, "nuclei"], [/masscan/i, "masscan"],
    [/^curl\//i, "curl"], [/^wget\//i, "wget"], [/python-requests|aiohttp|urllib/i, "python"],
    [/Go-http-client/i, "go-http"], [/^Java\//i, "java"], [/nikto/i, "nikto"],
    [/metasploit|msf/i, "metasploit"], [/burp/i, "burp"], [/ZAP/i, "zap"],
    [/Postman/i, "postman"], [/HTTPie/i, "httpie"], [/^Mozilla.*Googlebot/i, "googlebot"],
    [/facebookexternalhit/i, "facebook"], [/Twitterbot/i, "twitter"],
    [/^Mozilla.*AhrefsBot|semrush|majestic|rogerbot/i, "seo-bot"],
    [/masscan/i, "masscan"], [/HTTP request|networking|node|axios/i, "http-lib"],
  ]
  for (const [re, name] of patterns) if (re.test(ua)) return name
  if (/Linux/i.test(ua) && !/Android/i.test(ua) && !/Mozilla/i.test(ua)) return "linux-scanner"
  if (/bot|crawl|spider|scrape/i.test(ua)) return "bot"
  return null
}

/* ── Threat classification ── */
function classifyThreat(eventType: string, path: string, ua: string, metadata: any): string {
  if (eventType === 'geo_block' || eventType === 'rate_limit_hit') return 'noise'
  if (eventType === 'auth_failure' || eventType === 'auth_login_failed' || eventType === 'brute_force_attack') return 'attack'
  if (eventType === 'sql_injection' || eventType === 'prompt_injection') return 'attack'
  if (eventType === 'honeypot_trap' || eventType === 'trap_hit') {
    if (/wp-|wp-content|wp-admin|wp-includes|wp-login|xmlrpc/i.test(path)) return 'attack'
    if (/\.env|\.git|config|backup|dump|sql|admin/i.test(path)) return 'attack'
    if (/shell|cmd|exec|eval|phpmyadmin/i.test(path)) return 'attack'
    return 'probe'
  }
  if (eventType === 'ip_block') return 'attack'
  if (eventType === 'suspicious_path') {
    if (/sql|select|union|drop|insert|--|'/i.test(path)) return 'attack'
    if (/fuzz|\.php|\.asp|\.jsp|\.cfm/i.test(path)) return 'probe'
    if (/\.env|\.git|config\.php|wp-config/i.test(path)) return 'attack'
    if (/\.bak|\.old|\.zip|\.tar|dump/i.test(path)) return 'probe'
    return 'probe'
  }
  if (/nmap|sqlmap|masscan|gobuster|nikto|metasploit|burp|ffuf|nuclei/i.test(ua)) return 'attack'
  if (/curl|wget|python/i.test(ua) && !/Mozilla/i.test(ua)) return 'probe'
  return 'noise'
}

function computeTimeline(events: { created_at: string }[]): { hour: string; count: number }[] {
  const buckets = new Map<string, number>()
  const now = Date.now()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600000)
    buckets.set(String(d.getUTCHours()).padStart(2, '0') + ":00", 0)
  }
  for (const e of events) {
    const d = new Date(e.created_at)
    if (now - d.getTime() > 24 * 3600000) continue
    const k = String(d.getUTCHours()).padStart(2, '0') + ":00"
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + 1)
  }
  return Array.from(buckets.entries()).map(([hour, count]) => ({ hour, count }))
}

export {
  getCsrfToken, timeAgo, countryFlag, fmt,
  SEVERITY_STYLES, SEVERITY_DOT, EVENT_LABELS, EVENT_TYPES, TOOL_STYLES,
  getToolFromUA, classifyThreat, computeTimeline,
}
