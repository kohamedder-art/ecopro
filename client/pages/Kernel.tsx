import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Shield, Activity, Ban, AlertTriangle, Terminal, RefreshCw, Globe, Lock, Unlock, Trash2, LogOut, XCircle, User, KeyRound, Loader2, Eye, Search, X, Filter, BarChart3, Clock, Fingerprint, Wifi, WifiOff, Globe2, MapPin, Smartphone, Monitor, Code, ExternalLink, Copy, Store, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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
  const d = new Date(iso)
  return d.toLocaleString()
}

type SecurityEvent = {
  id: number
  created_at: string
  event_type: string
  severity: string
  method: string | null
  path: string | null
  status_code: number | null
  ip: string | null
  country_code: string | null
  fingerprint: string | null
  user_agent: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
}

type SummaryData = {
  events_today: number
  blocked_ips: number
  active_threats: number
  watchlist_count: number
  top_countries: { country_code: string; count: number }[]
  threatCounts?: { total: number; real_threats: number; probes: number; info: number; scanner_noise: number }
}

type BlockEntry = {
  id: number
  ip: string
  reason: string | null
  blocked_at: string
  expires_at: string | null
  country_code: string | null
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
  unknown: "Unknown",
}

const EVENT_TYPES = Object.keys(EVENT_LABELS)

function ToolBadge({ tool }: { tool: string | null }) {
  if (!tool || tool === "unknown") return null
  const colors: Record<string, string> = {
    nmap: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/40",
    sqlmap: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
    ffuf: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/40",
    gobuster: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40",
    nuclei: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40",
    masscan: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40",
    nikto: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
    metasploit: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
    burp: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/40",
  }
  const c = colors[tool.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40"
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-mono border", c)}>
      {tool}
    </Badge>
  )
}

function getToolFromUA(ua: string | null): string | null {
  if (!ua) return null
  const patterns: [RegExp, string][] = [
    [/nmap/i, "nmap"],
    [/sqlmap/i, "sqlmap"],
    [/ffuf|fuzz\//i, "ffuf"],
    [/gobuster|dirbuster/i, "gobuster"],
    [/nuclei/i, "nuclei"],
    [/masscan/i, "masscan"],
    [/^curl\//i, "curl"],
    [/^wget\//i, "wget"],
    [/python-requests|aiohttp|urllib/i, "python"],
    [/Go-http-client/i, "go-http"],
    [/^Java\//i, "java"],
    [/nikto/i, "nikto"],
    [/metasploit|msf/i, "metasploit"],
    [/burp/i, "burp"],
    [/ZAP/i, "zap"],
    [/Postman/i, "postman"],
    [/HTTPie/i, "httpie"],
    [/^Mozilla\/.*Googlebot/i, "googlebot"],
    [/facebookexternalhit/i, "facebook"],
    [/Twitterbot/i, "twitter"],
  ]
  for (const [re, name] of patterns) {
    if (re.test(ua)) return name
  }
  if (/Linux/i.test(ua) && !/Android/i.test(ua) && !/Mozilla/i.test(ua)) return "linux-scanner"
  return null
}

function computeTimeline(events: SecurityEvent[]): { hour: string; count: number }[] {
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

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("root")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/kernel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Login failed")
        return
      }
      onLogin()
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-black flex items-center justify-center z-50">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 mb-4">
            <Shield className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Kernel Security</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">Root access required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-zinc-500 font-medium uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9 bg-white dark:bg-zinc-900/80 border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:border-green-500 dark:focus:border-green-700/50 focus:ring-green-500/30 dark:focus:ring-green-900/30 h-10"
                placeholder="root"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-zinc-500 font-medium uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-white dark:bg-zinc-900/80 border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:border-green-500 dark:focus:border-green-700/50 focus:ring-green-500/30 dark:focus:ring-green-900/30 h-10"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-3 py-2 rounded-lg">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white h-10 font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate"}
          </Button>
        </form>
      </div>
    </div>
  )
}

function EventDetail({ event, onClose }: { event: SecurityEvent; onClose: () => void }) {
  const tool = (event.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(event.user_agent)
  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="font-mono text-xs">{event.id}</span>],
    ["Time", fmt(event.created_at)],
    ["Event Type", <Badge variant="outline" className={cn("text-[11px] font-mono border", SEVERITY_COLORS[event.severity] || "")}>{EVENT_LABELS[event.event_type] || event.event_type}</Badge>],
    ["Severity", <span className="capitalize">{event.severity}</span>],
    ["IP", event.ip ? <span className="font-mono text-xs">{countryFlag(event.country_code)} {event.ip}</span> : "—"],
    ["Country", event.country_code || "—"],
    ["Method", event.method || "—"],
    ["Path", event.path ? <span className="font-mono text-xs break-all">{event.method} {event.path}</span> : "—"],
    ["Status Code", event.status_code?.toString() || "—"],
    ["User Agent", event.user_agent ? <span className="font-mono text-[11px] break-all">{event.user_agent}</span> : "—"],
    ["Fingerprint", event.fingerprint ? <span className="font-mono text-xs">{event.fingerprint}</span> : "—"],
    ["Tool", tool ? <ToolBadge tool={tool} /> : "—"],
    ["Auth Session", event.user_id ? <Badge variant="outline" className="border-cyan-300 text-cyan-700 bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:bg-cyan-950/30 text-[11px]"><User className="w-3 h-3 mr-1" /> User #{event.user_id}</Badge> : "No"],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <Card className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            Event Details
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-gray-100 dark:divide-zinc-800/50">
              {rows.map(([label, value]) => (
                <div key={label} className="px-4 py-2.5 flex items-start gap-4">
                  <span className="text-xs text-gray-500 dark:text-zinc-500 w-24 shrink-0 font-medium">{label}</span>
                  <div className="flex-1 text-xs text-gray-900 dark:text-zinc-200 min-w-0">{value}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineChart({ events }: { events: SecurityEvent[] }) {
  const data = useMemo(() => computeTimeline(events), [events])
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          24h Event Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-end gap-[3px] h-24">
          {data.map((d) => {
            const h = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 8 : 0)
            return (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                  {d.count}
                </span>
                <div
                  className={cn(
                    "w-full rounded-sm transition-all",
                    d.count > 0
                      ? "bg-red-500/70 dark:bg-red-600/70 hover:bg-red-600 dark:hover:bg-red-500"
                      : "bg-gray-100 dark:bg-zinc-800"
                  )}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-gray-400 dark:text-zinc-600 font-mono mt-auto">{d.hour}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [blocks, setBlocks] = useState<BlockEntry[]>([])
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [blockIp, setBlockIp] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [threatClass, setThreatClass] = useState<string>("all")
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const [storeThreats, setStoreThreats] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountsMeta, setAccountsMeta] = useState<any>(null)
  const [accountFilter, setAccountFilter] = useState("all")
  const [accountSearch, setAccountSearch] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const [accountActs, setAccountActs] = useState<any[]>([])
  const esRef = useRef<EventSource | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const [sRes, eRes, bRes, stRes] = await Promise.all([
        fetch("/api/kernel/security/summary?days=1"),
        fetch("/api/kernel/security/events?limit=50"),
        fetch("/api/kernel/blocks"),
        fetch("/api/kernel/store-threats"),
      ])
      if (sRes.ok) setSummary(await sRes.json())
      if (eRes.ok) setEvents((await eRes.json()).events || [])
      if (bRes.ok) setBlocks(await bRes.json())
      if (stRes.ok) setStoreThreats(await stRes.json())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch accounts separately (heavier query, less frequent)
  const fetchAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (accountFilter !== "all") params.set("filter", accountFilter)
      if (accountSearch) params.set("search", accountSearch)
      const res = await fetch(`/api/kernel/accounts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
        setAccountsMeta({ total: data.total, suspicious: data.suspicious })
      }
    } catch { /* ignore */ }
  }, [accountFilter, accountSearch])

  const fetchAccountActs = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/kernel/accounts/${userId}/acts`)
      if (res.ok) setAccountActs((await res.json()).acts || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, 15000)
    return () => clearInterval(interval)
  }, [fetchSummary])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource("/api/kernel/events/stream")
    } catch {
      return
    }
    esRef.current = es
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data || "{}")
        if (d.type === "heartbeat") return
        const tool = getToolFromUA(d.user_agent || null)
        const e: SecurityEvent = {
          id: d.id || Date.now(),
          created_at: d.created_at || new Date().toISOString(),
          event_type: d.event_type || "unknown",
          severity: d.severity || "info",
          method: d.method || null,
          path: d.path || null,
          status_code: d.status_code ?? null,
          ip: d.ip || null,
          country_code: d.country_code || null,
          fingerprint: d.fingerprint || null,
          user_agent: d.user_agent || null,
          user_id: d.user_id || null,
          metadata: { ...(d.metadata || {}), detected_tool: tool },
        }
        setLiveEvents((prev) => [e, ...prev].slice(0, 100))
      } catch {
        /* ignore */
      }
    }
    return () => {
      es?.close()
      esRef.current = null
      setConnected(false)
    }
  }, [])

  const handleBlock = async () => {
    if (!blockIp) return
    try {
      const res = await fetch("/api/kernel/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ ip: blockIp.trim(), reason: blockReason || undefined }),
      })
      if (res.ok) {
        setBlockIp("")
        setBlockReason("")
        fetchSummary()
      }
    } catch {
      /* ignore */
    }
  }

  const handleUnblock = async (ip: string) => {
    try {
      await fetch(`/api/kernel/blocks/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": getCsrfToken() },
      })
      fetchSummary()
    } catch {
      /* ignore */
    }
  }

  const handleClearEvents = async () => {
    try {
      await fetch("/api/kernel/security/events", {
        method: "DELETE",
        headers: { "X-CSRF-Token": getCsrfToken() },
      })
      setEvents([])
      setLiveEvents([])
    } catch {
      /* ignore */
    }
  }

  const handleLogout = async () => {
    await fetch("/api/kernel/logout", { method: "POST" })
    window.location.reload()
  }

  const feed = liveEvents.length > 0 ? liveEvents : events
  const allEvents = useMemo(() => [...liveEvents, ...events], [liveEvents, events])

  const filtered = useMemo(() => {
    return feed.filter((e) => {
      if (search) {
        const q = search.toLowerCase()
        if (!e.ip?.toLowerCase().includes(q) && !e.fingerprint?.toLowerCase().includes(q) && !e.user_agent?.toLowerCase().includes(q) && !e.path?.toLowerCase().includes(q)) return false
      }
      if (filterType !== "all" && e.event_type !== filterType) return false
      if (filterSeverity !== "all" && e.severity !== filterSeverity) return false
      if (threatClass !== "all" && (e as any).threat_class !== threatClass) return false
      return true
    })
  }, [feed, search, filterType, filterSeverity, threatClass])

  const hasTopCountries = summary?.top_countries && summary.top_countries.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Kernel Security</h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-600 border-l border-gray-200 dark:border-zinc-800 pl-3 ml-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-red-500")} />
              {connected ? "Live" : "Disconnected"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 dark:text-zinc-600 font-mono">
              {feed.length} events
            </div>
            <Button variant="ghost" size="sm" onClick={fetchSummary} className="text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 h-8 w-8 p-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 h-8 px-2">
              <LogOut className="w-4 h-4 mr-1.5" />
              Exit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Events (24h)", value: summary?.threatCounts?.total ?? summary?.events_today ?? 0, icon: Activity, color: "text-blue-600 dark:text-blue-400" },
            { label: "Real Threats", value: summary?.threatCounts?.real_threats ?? 0, icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
            { label: "Probes", value: summary?.threatCounts?.probes ?? 0, icon: Eye, color: "text-orange-600 dark:text-orange-400" },
            { label: "Scanner Noise", value: summary?.threatCounts?.scanner_noise ?? 0, icon: WifiOff, color: "text-gray-400 dark:text-zinc-500" },
            { label: "Blocked IPs", value: summary?.blocked_ips ?? 0, icon: Ban, color: "text-red-600 dark:text-red-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800/50">
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Timeline */}
        <TimelineChart events={allEvents} />

        {/* Store Threats */}
        {storeThreats && (
          <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Store Threats
                {(storeThreats.badStores?.length > 0 || storeThreats.rapidOrders?.length > 0) && (
                  <Badge variant="outline" className="text-[10px] border-red-500 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30">
                    {((storeThreats.badStores?.length || 0) + (storeThreats.rapidOrders?.length || 0))} alerts
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* High bad-order rate stores */}
              {storeThreats.badStores?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    High Cancellation/Fraud Rate (24h)
                  </h4>
                  <div className="space-y-1.5">
                    {storeThreats.badStores.slice(0, 10).map((s: any) => (
                      <div key={s.client_id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-gray-700 dark:text-zinc-300 truncate">{s.store_name || s.store_slug}</span>
                          <span className="text-gray-400 dark:text-zinc-600">{s.total_orders} orders</span>
                        </div>
                        <span className={cn("font-mono tabular-nums shrink-0", Number(s.bad_pct) > 50 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400")}>
                          {s.bad_pct}% bad
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rapid orders same IP */}
              {storeThreats.rapidOrders?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-orange-500" />
                    Rapid-Fire Orders (5+ from same IP in 1h)
                  </h4>
                  <div className="space-y-1.5">
                    {storeThreats.rapidOrders.slice(0, 10).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-gray-500 dark:text-zinc-400">{r.customer_ip}</span>
                          <span className="text-gray-700 dark:text-zinc-300 truncate">→ {r.store_name || r.store_slug}</span>
                        </div>
                        <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 shrink-0">{r.orders_in_hour}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-store IPs */}
              {storeThreats.multiStoreIps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-purple-500" />
                    Same IP Across Multiple Stores (7d)
                  </h4>
                  <div className="space-y-1.5">
                    {storeThreats.multiStoreIps.slice(0, 10).map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-gray-500 dark:text-zinc-400">{m.customer_ip}</span>
                          <span className="text-gray-400 dark:text-zinc-600">→ {m.store_count} stores</span>
                        </div>
                        <span className="text-gray-500 dark:text-zinc-400 truncate max-w-[200px]" title={m.store_names}>{m.store_names}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!storeThreats.badStores?.length && !storeThreats.rapidOrders?.length && !storeThreats.multiStoreIps?.length) && (
                <div className="flex items-center justify-center h-16 text-gray-400 dark:text-zinc-600 text-xs">
                  <Shield className="w-4 h-4 ml-1.5 opacity-30" />
                  No store threats detected
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Accounts */}
        <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
          <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Accounts
                <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 ml-1">
                  {accountsMeta?.total ?? '…'} total
                </span>
                {accountsMeta?.suspicious > 0 && (
                  <Badge variant="outline" className="text-[10px] border-red-500 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30">
                    {accountsMeta.suspicious} flagged
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-zinc-600" />
                  <Input
                    placeholder="Search accounts…"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="h-7 w-40 text-xs pl-7 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                  />
                </div>
                <div className="flex gap-1">
                  {[
                    { key: "all", label: "All" },
                    { key: "suspicious", label: "Suspicious" },
                    { key: "tracked", label: "Tracked" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAccountFilter(tab.key)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                        accountFilter === tab.key
                          ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                          : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {selectedAccount ? (
              <div>
                <button
                  onClick={() => { setSelectedAccount(null); setAccountActs([]); }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-4 py-2 border-b border-gray-200 dark:border-zinc-800"
                >
                  ← Back to accounts
                </button>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">{selectedAccount.name || selectedAccount.email}</div>
                      <div className="text-xs text-gray-500 dark:text-zinc-500">{selectedAccount.email} · {selectedAccount.user_type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAccount.is_suspicious && (
                        <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-0">Suspicious</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                      <div className="text-gray-400 dark:text-zinc-600 mb-0.5">IP</div>
                      <div className="font-mono text-gray-700 dark:text-zinc-300">{selectedAccount.last_ip || '—'}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                      <div className="text-gray-400 dark:text-zinc-600 mb-0.5">Device</div>
                      <div className="text-gray-700 dark:text-zinc-300 truncate" title={selectedAccount.last_user_agent || ''}>{selectedAccount.device_info || '—'}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                      <div className="text-gray-400 dark:text-zinc-600 mb-0.5">Location</div>
                      <div className="text-gray-700 dark:text-zinc-300">
                        {[selectedAccount.last_country, selectedAccount.last_region, selectedAccount.last_city].filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                  </div>
                  {selectedAccount.suspicious_flags?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-1.5">Suspicious Flags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAccount.suspicious_flags.map((f: string) => (
                          <span key={f} className="px-2 py-0.5 text-[10px] font-mono rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {accountActs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-1.5">Suspicious Activity</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {accountActs.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded bg-gray-50 dark:bg-zinc-800/50 font-mono">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                a.severity === 'error' || a.severity === 'critical' ? 'bg-red-500' :
                                a.severity === 'warn' ? 'bg-orange-500' : 'bg-gray-400'
                              )} />
                              <span className="text-gray-500 dark:text-zinc-500">{a.event_type}</span>
                              <span className="text-gray-400 dark:text-zinc-600">{a.path}</span>
                            </div>
                            <span className="text-gray-400 dark:text-zinc-600 shrink-0 ml-2">{new Date(a.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!accountActs.length && selectedAccount.is_suspicious) && (
                    <div className="text-xs text-gray-400 dark:text-zinc-600 text-center py-4">No suspicious activity logged</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {accounts.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-gray-400 dark:text-zinc-600 text-xs">
                    No accounts found
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-zinc-800 text-[10px] text-gray-400 dark:text-zinc-600">
                        <th className="text-left px-4 py-2 font-medium">Account</th>
                        <th className="text-left px-2 py-2 font-medium">IP</th>
                        <th className="text-left px-2 py-2 font-medium">Device</th>
                        <th className="text-left px-2 py-2 font-medium">Location</th>
                        <th className="text-right px-4 py-2 font-medium">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a: any) => (
                        <tr
                          key={a.id}
                          onClick={() => { setSelectedAccount(a); fetchAccountActs(a.id); }}
                          className={cn(
                            "border-b border-gray-100 dark:border-zinc-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors",
                            a.is_suspicious && "bg-red-50/50 dark:bg-red-950/10"
                          )}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                a.user_type === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'
                              )}>
                                {(a.name || a.email || '?')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-700 dark:text-zinc-300 truncate max-w-32">{a.name || a.email}</div>
                                <div className="text-gray-400 dark:text-zinc-600 truncate max-w-32">{a.email}</div>
                              </div>
                              {a.is_suspicious && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Suspicious" />}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-500 dark:text-zinc-500">{a.last_ip || '—'}</td>
                          <td className="px-2 py-2 text-gray-500 dark:text-zinc-500">
                            <div className="flex items-center gap-1">
                              {a.device_info === 'iPhone' || a.device_info === 'Android' || a.device_info === 'Mobile'
                                ? <Smartphone className="w-3 h-3" />
                                : <Monitor className="w-3 h-3" />
                              }
                              <span>{a.device_info || '—'}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-gray-500 dark:text-zinc-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400 dark:text-zinc-600" />
                              <span>{a.last_country || a.last_region || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 dark:text-zinc-600 font-mono">
                            {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : (a.created_at ? 'Never' : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
              <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                    Live Attack Feed
                    {connected && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-green-500 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950/30">
                        <span className="w-1 h-1 rounded-full bg-green-500 mr-1 inline-block" />
                        STREAMING
                      </Badge>
                    )}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleClearEvents} className="text-gray-500 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 h-7 text-xs px-2">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
                {/* Threat Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800 -mb-3">
                  {[
                    { key: "all", label: "All", color: "text-gray-700 dark:text-zinc-300", count: feed.length },
                    { key: "attack", label: "Attacks", color: "text-red-600 dark:text-red-400", count: feed.filter((e: any) => e.threat_class === 'attack').length },
                    { key: "probe", label: "Probes", color: "text-orange-600 dark:text-orange-400", count: feed.filter((e: any) => e.threat_class === 'probe').length },
                    { key: "noise", label: "Noise", color: "text-gray-400 dark:text-zinc-500", count: feed.filter((e: any) => e.threat_class === 'noise').length },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setThreatClass(tab.key)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px]",
                        threatClass === tab.key
                          ? "border-gray-900 dark:border-white " + tab.color
                          : "border-transparent text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400"
                      )}
                    >
                      {tab.label}
                      <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
                    </button>
                  ))}
                </div>
                {/* Filters */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-600" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search IP, path, UA..."
                      className="pl-8 h-8 text-xs bg-white dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="h-8 text-xs rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-900 dark:text-white px-2"
                  >
                    <option value="all">All Types</option>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>)}
                  </select>
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="h-8 text-xs rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-900 dark:text-white px-2"
                  >
                    <option value="all">All Severities</option>
                    {["critical", "error", "warn", "info"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                  {(search || filterType !== "all" || filterSeverity !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterType("all"); setFilterSeverity("all") }} className="h-8 text-xs text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 px-2">
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                  <span className="text-[11px] text-gray-400 dark:text-zinc-600 font-mono whitespace-nowrap">
                    {filtered.length}/{feed.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 dark:text-zinc-600 text-sm">
                    <Shield className="w-8 h-8 mr-2 opacity-30" />
                    {feed.length === 0 ? "No events recorded" : "No matches"}
                  </div>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                      {filtered.map((e) => {
                        const tool = (e.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(e.user_agent)
                        return (
                          <div
                            key={e.id}
                            onClick={() => setSelectedEvent(e)}
                            className={cn(
                              "px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer",
                              e.severity === "critical" && "bg-red-50 dark:bg-red-950/10"
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_DOT[e.severity] || "bg-gray-400 dark:bg-zinc-600")} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-mono border", SEVERITY_COLORS[e.severity] || "border-gray-300 text-gray-600 bg-gray-50 dark:border-zinc-700 dark:text-zinc-400 dark:bg-zinc-800/30")}>
                                  {EVENT_LABELS[e.event_type] || e.event_type}
                                </Badge>
                                {e.user_id && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono border border-cyan-300 text-cyan-700 bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:bg-cyan-950/30">
                                    <User className="w-2.5 h-2.5 mr-0.5" />
                                    AUTH
                                  </Badge>
                                )}
                                <ToolBadge tool={tool} />
                                {e.ip && (
                                  <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">
                                    {countryFlag(e.country_code)} {e.ip}
                                  </span>
                                )}
                                {e.method && e.path && (
                                  <span className="text-xs text-gray-400 dark:text-zinc-600 font-mono truncate hidden sm:inline">
                                    {e.method} {e.path}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 dark:text-zinc-600 mt-0.5">
                                {timeAgo(e.created_at)}
                                {e.status_code && <span className="ml-2">status {e.status_code}</span>}
                                {e.fingerprint && <span className="ml-2 font-mono">{e.fingerprint.slice(0, 16)}...</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
              <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ban className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                  Block IP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Input
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  placeholder="IP address"
                  className="bg-white dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 h-9 text-sm font-mono"
                />
                <Input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="bg-white dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 h-9 text-sm"
                />
                <Button onClick={handleBlock} disabled={!blockIp.trim()} size="sm" className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white h-9">
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Block
                </Button>
              </CardContent>
            </Card>

            {hasTopCountries && (
              <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
                <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                    Top Origins
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {summary!.top_countries!.slice(0, 6).map((c) => {
                    const total = summary!.events_today || 1
                    const pct = Math.round((c.count / total) * 100)
                    return (
                      <div key={c.country_code} className="flex items-center gap-2">
                        <span className="text-sm">{countryFlag(c.country_code)}</span>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/60 dark:bg-red-700/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* IP Blocks Table */}
        {blocks.length > 0 && (
          <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Blocked IPs ({blocks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800">
                      <th className="text-left text-xs text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">IP</th>
                      <th className="text-left text-xs text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5 hidden sm:table-cell">Country</th>
                      <th className="text-left text-xs text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">Reason</th>
                      <th className="text-left text-xs text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5 hidden md:table-cell">Blocked</th>
                      <th className="text-right text-xs text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                    {blocks.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-zinc-300">{b.ip}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-500 hidden sm:table-cell">{countryFlag(b.country_code)} {b.country_code || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400">{b.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-zinc-600 hidden md:table-cell">{timeAgo(b.blocked_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleUnblock(b.ip)} className="h-7 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 dark:text-zinc-500 dark:hover:text-green-400 dark:hover:bg-green-950/20">
                            <Unlock className="w-3 h-3 mr-1" />
                            Unblock
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event Detail Overlay */}
      {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  )
}

export default function Kernel() {
  const [state, setState] = useState<"loading" | "login" | "dashboard">("loading")

  useEffect(() => {
    fetch("/api/kernel/status", { credentials: "include" })
      .then((r) => {
        if (r.ok) setState("dashboard")
        else setState("login")
      })
      .catch(() => setState("login"))
  }, [])

  if (state === "loading") {
    return (
      <div className="fixed inset-0 bg-white dark:bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-600" />
      </div>
    )
  }

  if (state === "login") {
    return <LoginScreen onLogin={() => setState("dashboard")} />
  }

  return <Dashboard />
}
