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

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
  error: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40",
  warn: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40",
  info: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40",
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  warn: "bg-yellow-500",
  info: "bg-blue-500",
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

const TOOL_COLORS: Record<string, string> = {
  nmap: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/40",
  sqlmap: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
  ffuf: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/40",
  gobuster: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40",
  nuclei: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40",
  masscan: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
  nikto: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
  metasploit: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
  burp: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/40",
  zap: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/40",
  curl: "bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/40",
  wget: "bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/40",
  python: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40",
  "go-http": "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/40",
  java: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40",
  "linux-scanner": "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40",
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
  ]
  for (const [re, name] of patterns) if (re.test(ua)) return name
  if (/Linux/i.test(ua) && !/Android/i.test(ua) && !/Mozilla/i.test(ua)) return "linux-scanner"
  return null
}

type TimelineEvent = { created_at: string }

function computeTimeline(events: TimelineEvent[]): { hour: string; count: number }[] {
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
  SEVERITY_COLORS, SEVERITY_DOT, EVENT_LABELS, EVENT_TYPES, TOOL_COLORS,
  getToolFromUA, computeTimeline,
}
