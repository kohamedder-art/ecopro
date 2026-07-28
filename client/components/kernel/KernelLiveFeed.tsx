import { useState, useMemo } from "react"
import { Terminal, Trash2, Search, X, Shield, User, Bug, Radar, Zap, Siren } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { timeAgo, countryFlag, SEVERITY_STYLES, SEVERITY_DOT, EVENT_LABELS, getToolFromUA } from "./utils"
import ToolBadge from "./ToolBadge"
import type { SecurityEvent } from "./types"

type Props = {
  events: SecurityEvent[]
  liveEvents: SecurityEvent[]
  connected: boolean
  onSelectEvent: (e: SecurityEvent) => void
  onClear: () => void
}

const THREAT_ICONS: Record<string, typeof Bug> = {
  attack: Zap, probe: Radar, noise: Siren,
}

const THREAT_COLORS: Record<string, string> = {
  attack: "k-a-red", probe: "k-a-amber", noise: "k-muted",
}

export default function KernelLiveFeed({ events, liveEvents, connected, onSelectEvent, onClear }: Props) {
  const feed = liveEvents.length > 0 ? liveEvents : events
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [threatClass, setThreatClass] = useState("all")

  const allTypes = Object.keys(EVENT_LABELS)

  const filtered = useMemo(() => {
    return feed.filter((e) => {
      if (search) {
        const q = search.toLowerCase()
        if (!e.ip?.toLowerCase().includes(q) && !e.fingerprint?.toLowerCase().includes(q) && !e.user_agent?.toLowerCase().includes(q) && !e.path?.toLowerCase().includes(q)) return false
      }
      if (filterType !== "all" && e.event_type !== filterType) return false
      if (filterSeverity !== "all" && e.severity !== filterSeverity) return false
      return true
    })
  }, [feed, search, filterType, filterSeverity])

  const tc = (e: SecurityEvent) => (e.metadata as any)?.threat_class || "noise"

  const tabs = [
    { key: "all", label: "All", color: "k-text", count: feed.length },
    { key: "attack", label: "Attacks", color: "k-a-red", count: feed.filter((e) => tc(e) === 'attack').length },
    { key: "probe", label: "Probes", color: "k-a-amber", count: feed.filter((e) => tc(e) === 'probe').length },
    { key: "noise", label: "Noise", color: "k-muted", count: feed.filter((e) => tc(e) === 'noise').length },
  ]

  const hasFilters = search || filterType !== "all" || filterSeverity !== "all"

  return (
    <div className="k-card rounded-xl k-card-glow">
      {/* Header */}
      <div className="px-4 py-3 border-b k-bdr flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 k-a-green" />
            <span className="text-sm font-medium k-text">Live Attack Feed</span>
            <div className={cn("k-mono text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1", connected ? "k-a-green" : "k-a-red")}>
              <span className={cn("w-1 h-1 rounded-full", connected ? "bg-emerald-400" : "bg-red-400")} />
              {connected ? "LIVE" : "OFFLINE"}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="k-btn k-btn-ghost h-7 text-xs px-2">
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>

        {/* Threat Tabs */}
        <div className="flex items-center gap-1 border-b k-bdr -mb-3">
          {tabs.map((tab) => {
            const Icon = THREAT_ICONS[tab.key] || Bug
            return (
              <button key={tab.key} onClick={() => setThreatClass(tab.key)}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px] k-mono",
                  threatClass === tab.key ? cn(tab.color, "border-b-2") : "k-tab-inactive hover:k-muted"
                )}
                style={threatClass === tab.key ? { borderBottomColor: tab.key === 'attack' ? '#ef4444' : tab.key === 'probe' ? '#fbbf24' : '#6b7280' } : {}}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
                <span className="text-[10px] opacity-60 ml-0.5">{tab.count}</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 k-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IP, path, UA..." className="k-input h-8 text-xs rounded-md pl-8 w-full k-mono" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="k-select h-8 text-xs rounded-md px-2 k-mono">
            <option value="all">All Types</option>
            {allTypes.map((t) => <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>)}
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="k-select h-8 text-xs rounded-md px-2 k-mono">
            <option value="all">All Levels</option>
            {["critical", "error", "warn", "info"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setFilterType("all"); setFilterSeverity("all") }} className="k-btn k-btn-ghost h-8 text-xs px-2 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="k-dim k-mono text-[11px]">{filtered.length}/{feed.length}</span>
        </div>
      </div>

      {/* Event List */}
      <div className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 k-dim text-sm">
            <Shield className="w-10 h-10 mb-2 opacity-20" />
            {feed.length === 0 ? "No events recorded" : "No matches found"}
          </div>
        ) : (
          <ScrollArea className="h-[520px] k-scroll">
            <div className="divide-y k-bdr">
              {filtered.map((e) => {
                const tool = (e.metadata as any)?.detected_tool || getToolFromUA(e.user_agent)
                const threat = (e.metadata as any)?.threat_class || "noise"
                return (
                  <div key={e.id} onClick={() => onSelectEvent(e)}
                    className={cn("px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-white/5",
                      e.severity === "critical" && "bg-red-500/10"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_DOT[e.severity] || "k-muted")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 k-mono border", SEVERITY_STYLES[e.severity] || "k-muted")}>
                          {EVENT_LABELS[e.event_type] || e.event_type}
                        </Badge>
                        {threat !== "noise" && (
                          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 k-mono border", THREAT_COLORS[threat] || "k-muted")}>
                            {threat}
                          </Badge>
                        )}
                        {e.user_id && <Badge variant="outline" className="k-a-cyan text-[10px] h-5 px-1.5 k-mono"><User className="w-2.5 h-2.5 mr-0.5" />AUTH</Badge>}
                        <ToolBadge tool={tool} />
                        {e.ip && <span className="text-xs k-mono k-muted">{countryFlag(e.country_code)} {e.ip}</span>}
                        {e.method && e.path && <span className="text-xs k-dim k-mono truncate hidden sm:inline max-w-[200px]">{e.method} {e.path}</span>}
                      </div>
                      <div className="text-[11px] k-dim mt-0.5 flex flex-wrap gap-x-3">
                        <span>{timeAgo(e.created_at)}</span>
                        {e.status_code && <span>status {e.status_code}</span>}
                        {e.fingerprint && <span className="k-mono">{e.fingerprint.slice(0, 16)}...</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
