import { useState, useEffect, useRef, useCallback } from "react"
import { Shield, Activity, Ban, AlertTriangle, Terminal, RefreshCw, Globe, Lock, Unlock, Trash2, LogOut, XCircle, User, KeyRound, Loader2, Eye } from "lucide-react"
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
  unknown: "Unknown",
}

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

function Dashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [blocks, setBlocks] = useState<BlockEntry[]>([])
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [blockIp, setBlockIp] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [loading, setLoading] = useState(true)
  const esRef = useRef<EventSource | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const [sRes, eRes, bRes] = await Promise.all([
        fetch("/api/kernel/security/summary?days=1"),
        fetch("/api/kernel/security/events?limit=50"),
        fetch("/api/kernel/blocks"),
      ])
      if (sRes.ok) setSummary(await sRes.json())
      if (eRes.ok) setEvents((await eRes.json()).events || [])
      if (bRes.ok) setBlocks(await bRes.json())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

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
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSummary}
              className="text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 h-8 px-2"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Exit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Events Today", value: summary?.events_today ?? 0, icon: Activity, color: "text-blue-600 dark:text-blue-400" },
            { label: "Blocked IPs", value: summary?.blocked_ips ?? 0, icon: Ban, color: "text-red-600 dark:text-red-400" },
            { label: "Active Threats", value: summary?.active_threats ?? 0, icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400" },
            { label: "Watchlist", value: summary?.watchlist_count ?? 0, icon: Eye, color: "text-yellow-600 dark:text-yellow-400" },
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

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
              <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-row items-center justify-between">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearEvents}
                  className="text-gray-500 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 h-7 text-xs px-2"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {feed.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 dark:text-zinc-600 text-sm">
                    <Shield className="w-8 h-8 mr-2 opacity-30" />
                    No events recorded
                  </div>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                      {feed.map((e) => {
                        const tool = (e.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(e.user_agent)
                        return (
                          <div
                            key={e.id}
                            className={cn(
                              "px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors",
                              e.severity === "critical" && "bg-red-50 dark:bg-red-950/10"
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_DOT[e.severity] || "bg-gray-400 dark:bg-zinc-600")} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] h-5 px-1.5 font-mono border",
                                    SEVERITY_COLORS[e.severity] || "border-gray-300 text-gray-600 bg-gray-50 dark:border-zinc-700 dark:text-zinc-400 dark:bg-zinc-800/30"
                                  )}
                                >
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
            {/* Block IP */}
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
                <Button
                  onClick={handleBlock}
                  disabled={!blockIp.trim()}
                  size="sm"
                  className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white h-9"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Block
                </Button>
              </CardContent>
            </Card>

            {/* Top Countries */}
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
                          <div
                            className="h-full bg-red-500/60 dark:bg-red-700/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
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
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-500 hidden sm:table-cell">
                          {countryFlag(b.country_code)} {b.country_code || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400">{b.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-zinc-600 hidden md:table-cell">{timeAgo(b.blocked_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblock(b.ip)}
                            className="h-7 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 dark:text-zinc-500 dark:hover:text-green-400 dark:hover:bg-green-950/20"
                          >
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
