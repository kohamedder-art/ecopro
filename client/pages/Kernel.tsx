import { useState, useEffect, useRef, useCallback } from "react"
import { Shield, Activity, Ban, AlertTriangle, Terminal, RefreshCw, Globe, Lock, Unlock, Trash2, LogOut, Wifi, WifiOff, Clock, Eye, EyeOff, Network, XCircle, User, KeyRound, Loader2 } from "lucide-react"
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
  critical: "bg-red-500/20 text-red-400 border-red-500/40",
  error: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/40",
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
  unknown: "Unknown",
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
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/30 border border-green-700/50 mb-4">
            <Shield className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Kernel Security</h1>
          <p className="text-sm text-zinc-500 mt-1">Root access required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-green-700/50 focus:ring-green-900/30 h-10"
                placeholder="root"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-green-700/50 focus:ring-green-900/30 h-10"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-3 py-2 rounded-lg">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 text-white h-10 font-medium"
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
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-green-400" />
              <h1 className="text-lg font-semibold tracking-tight text-white">Kernel Security</h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 border-l border-zinc-800 pl-3 ml-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-red-500")} />
              {connected ? "Live" : "Disconnected"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-600 font-mono">
              {feed.length} events
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSummary}
              className="text-zinc-500 hover:text-zinc-300 h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-500 hover:text-red-400 h-8 px-2"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Exit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Events Today", value: summary?.events_today ?? 0, icon: Activity, color: "text-blue-400" },
            { label: "Blocked IPs", value: summary?.blocked_ips ?? 0, icon: Ban, color: "text-red-400" },
            { label: "Active Threats", value: summary?.active_threats ?? 0, icon: AlertTriangle, color: "text-orange-400" },
            { label: "Watchlist", value: summary?.watchlist_count ?? 0, icon: Eye, color: "text-yellow-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-zinc-900/60 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-800/50">
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white tabular-nums">{stat.value}</p>
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="px-4 py-3 border-b border-zinc-800 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  Live Attack Feed
                  {connected && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-green-800 text-green-400 bg-green-950/30">
                      <span className="w-1 h-1 rounded-full bg-green-500 mr-1 inline-block" />
                      STREAMING
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearEvents}
                  className="text-zinc-500 hover:text-red-400 h-7 text-xs px-2"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {feed.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
                    <Shield className="w-8 h-8 mr-2 opacity-30" />
                    No events recorded
                  </div>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-zinc-800/50">
                      {feed.map((e) => (
                        <div
                          key={e.id}
                          className={cn(
                            "px-4 py-2.5 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors",
                            e.severity === "critical" && "bg-red-950/10"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_DOT[e.severity] || "bg-zinc-600")} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-5 px-1.5 font-mono border",
                                  SEVERITY_COLORS[e.severity] || "border-zinc-700 text-zinc-400 bg-zinc-800/30"
                                )}
                              >
                                {EVENT_LABELS[e.event_type] || e.event_type}
                              </Badge>
                              {e.ip && (
                                <span className="text-xs font-mono text-zinc-400">
                                  {countryFlag(e.country_code)} {e.ip}
                                </span>
                              )}
                              {e.method && e.path && (
                                <span className="text-xs text-zinc-600 font-mono truncate hidden sm:inline">
                                  {e.method} {e.path}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-600 mt-0.5">
                              {timeAgo(e.created_at)}
                              {e.status_code && <span className="ml-2">status {e.status_code}</span>}
                              {e.fingerprint && <span className="ml-2 font-mono">{e.fingerprint.slice(0, 16)}...</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Block IP */}
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="px-4 py-3 border-b border-zinc-800">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ban className="w-4 h-4 text-zinc-400" />
                  Block IP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Input
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  placeholder="IP address"
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm font-mono"
                />
                <Input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
                />
                <Button
                  onClick={handleBlock}
                  disabled={!blockIp.trim()}
                  size="sm"
                  className="w-full bg-red-700 hover:bg-red-600 text-white h-9"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Block
                </Button>
              </CardContent>
            </Card>

            {/* Top Countries */}
            {hasTopCountries && (
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="px-4 py-3 border-b border-zinc-800">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-zinc-400" />
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
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-700/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 tabular-nums w-8 text-right">{pct}%</span>
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
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="w-4 h-4 text-zinc-400" />
                Blocked IPs ({blocks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-xs text-zinc-600 font-medium px-4 py-2.5">IP</th>
                      <th className="text-left text-xs text-zinc-600 font-medium px-4 py-2.5 hidden sm:table-cell">Country</th>
                      <th className="text-left text-xs text-zinc-600 font-medium px-4 py-2.5">Reason</th>
                      <th className="text-left text-xs text-zinc-600 font-medium px-4 py-2.5 hidden md:table-cell">Blocked</th>
                      <th className="text-right text-xs text-zinc-600 font-medium px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {blocks.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{b.ip}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500 hidden sm:table-cell">
                          {countryFlag(b.country_code)} {b.country_code || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400">{b.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600 hidden md:table-cell">{timeAgo(b.blocked_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblock(b.ip)}
                            className="h-7 text-xs text-zinc-500 hover:text-green-400 hover:bg-green-950/20"
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
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    )
  }

  if (state === "login") {
    return <LoginScreen onLogin={() => setState("dashboard")} />
  }

  return <Dashboard />
}
