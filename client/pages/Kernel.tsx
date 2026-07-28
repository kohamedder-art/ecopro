import { useState, useEffect, useRef, useCallback } from "react"
import { Shield, Activity, Terminal, User, Store, Ban, BrainCircuit, RefreshCw, LogOut, Loader2, Sliders } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "../styles/kernel.css"
import KernelLogin from "@/components/kernel/KernelLogin"
import KernelStatsCards from "@/components/kernel/KernelStatsCards"
import KernelTimeline from "@/components/kernel/KernelTimeline"
import KernelLiveFeed from "@/components/kernel/KernelLiveFeed"
import KernelEventDetail from "@/components/kernel/KernelEventDetail"
import KernelBlockIp from "@/components/kernel/KernelBlockIp"
import KernelBlockedIps from "@/components/kernel/KernelBlockedIps"
import KernelTopOrigins from "@/components/kernel/KernelTopOrigins"
import KernelStoreThreats from "@/components/kernel/KernelStoreThreats"
import KernelAccounts from "@/components/kernel/KernelAccounts"
import KernelIntelligence from "@/components/kernel/KernelIntelligence"
import KernelSettings from "@/components/kernel/KernelSettings"
import { getToolFromUA, classifyThreat } from "@/components/kernel/utils"
import type { SecurityEvent, SummaryData, BlockEntry } from "@/components/kernel/types"

type Tab = "overview" | "feed" | "accounts" | "store-threats" | "blocks" | "intelligence" | "settings"

const TABS: { key: Tab; label: string; icon: typeof Activity }[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "feed", label: "Live Feed", icon: Terminal },
  { key: "accounts", label: "Accounts", icon: User },
  { key: "store-threats", label: "Store Threats", icon: Store },
  { key: "blocks", label: "IP Blocks", icon: Ban },
  { key: "intelligence", label: "Intelligence", icon: BrainCircuit },
  { key: "settings", label: "Settings", icon: Sliders },
]

function KernelDashboard() {
  const [tab, setTab] = useState<Tab>("overview")
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [blocks, setBlocks] = useState<BlockEntry[]>([])
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([])
  const [storeThreats, setStoreThreats] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    let es: EventSource | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      es?.close()
      try { es = new EventSource("/api/kernel/events/stream") } catch { scheduleReconnect(); return }
      esRef.current = es
      es.onopen = () => { setConnected(true); if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = undefined } }
      es.onerror = () => { setConnected(false); es?.close(); if (!destroyed) scheduleReconnect() }
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data || "{}")
          if (d.type === "heartbeat") return
          const tool = getToolFromUA(d.user_agent || null)
          const threat = classifyThreat(d.event_type || "unknown", d.path || "", d.user_agent || "", d.metadata)
          const e: SecurityEvent = {
            id: d.id || Date.now(), created_at: d.created_at || new Date().toISOString(),
            event_type: d.event_type || "unknown", severity: d.severity || "info",
            method: d.method || null, path: d.path || null, status_code: d.status_code ?? null,
            ip: d.ip || null, country_code: d.country_code || null, fingerprint: d.fingerprint || null,
            user_agent: d.user_agent || null, user_id: d.user_id || null,
            metadata: { ...(d.metadata || {}), detected_tool: tool, threat_class: threat },
          }
          setLiveEvents((prev) => [e, ...prev].slice(0, 100))
        } catch { /* ignore */ }
      }
    }

    function scheduleReconnect() { if (!destroyed) { reconnectTimer.current = setTimeout(connect, 3000) } }
    connect()
    return () => { destroyed = true; es?.close(); esRef.current = null; setConnected(false); if (reconnectTimer.current) clearTimeout(reconnectTimer.current) }
  }, [])

  const handleClearEvents = async () => {
    try {
      await fetch("/api/kernel/security/events", { method: "DELETE", headers: { "X-CSRF-Token": document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)?.[1] ?? "" } })
      setEvents([]); setLiveEvents([])
    } catch { /* ignore */ }
  }

  const handleLogout = async () => { await fetch("/api/kernel/logout", { method: "POST" }); window.location.reload() }

  const allEvents = [...liveEvents, ...events]
  const feedEvents = liveEvents.length > 0 ? liveEvents : events

  if (loading) return <div className="k-bg flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin k-a-green" /></div>

  return (
    <div className="min-h-screen k-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg k-a-green" style={{ boxShadow: '0 0 20px #34d39930' }}>
                <Shield className="w-4 h-4" style={{ color: '#111827' }} />
              </div>
              <h1 className="text-lg font-bold tracking-tight k-text">Kernel Security</h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs k-dim border-l k-bdr pl-3 ml-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "k-dot-critical animate-pulse" : "bg-gray-500")} />
              <span className="k-muted">{connected ? "LIVE" : "RECONNECTING..."}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs k-dim k-mono">{feedEvents.length} events</div>
            <Button variant="ghost" size="sm" onClick={fetchData} className="k-btn k-btn-ghost h-8 w-8 p-0" title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
            <button onClick={handleLogout} className="k-btn k-btn-ghost h-8 px-2 flex items-center gap-1.5" title="Exit kernel portal">
              <LogOut className="w-4 h-4" /> <span className="text-xs hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b k-bdr overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon; const isActive = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} title={t.label}
                className={cn("flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap -mb-[1px] k-mono",
                  isActive ? "k-tab-active" : "k-tab-inactive hover:k-muted"
                )}
              ><Icon className="w-3.5 h-3.5" />{t.label}</button>
            )
          })}
        </div>

        {/* Tab Content */}
        {tab === "overview" && (
          <>
            <KernelStatsCards summary={summary} />
            <KernelTimeline events={allEvents} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <KernelStoreThreats storeThreats={storeThreats} />
                {blocks.length > 0 && <KernelBlockedIps blocks={blocks} onUnblocked={fetchData} />}
              </div>
              <div className="space-y-4">
                <KernelBlockIp onBlocked={fetchData} />
                <KernelTopOrigins summary={summary} />
              </div>
            </div>
          </>
        )}
        {tab === "feed" && <KernelLiveFeed events={events} liveEvents={liveEvents} connected={connected} onSelectEvent={setSelectedEvent} onClear={handleClearEvents} />}
        {tab === "accounts" && <KernelAccounts />}
        {tab === "store-threats" && <KernelStoreThreats storeThreats={storeThreats} />}
        {tab === "blocks" && <KernelBlockedIps blocks={blocks} onUnblocked={fetchData} />}
        {tab === "intelligence" && <KernelIntelligence />}
        {tab === "settings" && <KernelSettings />}
      </div>
      {selectedEvent && <KernelEventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  )
}

export default function Kernel() {
  const [state, setState] = useState<"loading" | "login" | "dashboard">("loading")
  useEffect(() => {
    fetch("/api/kernel/status", { credentials: "include" })
      .then((r) => setState(r.ok ? "dashboard" : "login"))
      .catch(() => setState("login"))
  }, [])
  if (state === "loading") return <div className="k-bg flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin k-a-green" /></div>
  if (state === "login") return <KernelLogin onLogin={() => setState("dashboard")} />
  return <KernelDashboard />
}
