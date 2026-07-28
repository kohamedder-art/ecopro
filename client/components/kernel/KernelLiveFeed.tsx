import { useState, useMemo } from "react"
import { Terminal, Trash2, Search, X, Shield, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { timeAgo, countryFlag, SEVERITY_COLORS, SEVERITY_DOT, EVENT_LABELS, getToolFromUA } from "./utils"
import ToolBadge from "./ToolBadge"
import type { SecurityEvent } from "./types"

type Props = {
  events: SecurityEvent[]
  liveEvents: SecurityEvent[]
  connected: boolean
  onSelectEvent: (e: SecurityEvent) => void
  onClear: () => void
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
      if (threatClass !== "all" && (e as any).threat_class !== threatClass) return false
      return true
    })
  }, [feed, search, filterType, filterSeverity, threatClass])

  const tabs = [
    { key: "all", label: "All", color: "text-gray-700 dark:text-zinc-300", count: feed.length },
    { key: "attack", label: "Attacks", color: "text-red-600 dark:text-red-400", count: feed.filter((e: any) => e.threat_class === 'attack').length },
    { key: "probe", label: "Probes", color: "text-orange-600 dark:text-orange-400", count: feed.filter((e: any) => e.threat_class === 'probe').length },
    { key: "noise", label: "Noise", color: "text-gray-400 dark:text-zinc-500", count: feed.filter((e: any) => e.threat_class === 'noise').length },
  ]

  const hasFilters = search || filterType !== "all" || filterSeverity !== "all"

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            Live Attack Feed
            <Badge variant="outline" className={cn(
              "text-[10px] h-5 px-1.5",
              connected ? "border-green-500 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950/30" : "border-red-500 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30"
            )}>
              <span className={cn("w-1 h-1 rounded-full mr-1 inline-block", connected ? "bg-green-500" : "bg-red-500")} />
              {connected ? "LIVE" : "OFFLINE"}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear} className="text-gray-500 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 h-7 text-xs px-2">
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800 -mb-3">
          {tabs.map((tab) => (
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
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
            {allTypes.map((t) => <option key={t} value={t}>{EVENT_LABELS[t] || t}</option>)}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="h-8 text-xs rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-900 dark:text-white px-2"
          >
            <option value="all">All Severities</option>
            {["critical", "error", "warn", "info"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          {hasFilters && (
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
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-zinc-600 text-sm">
            <Shield className="w-10 h-10 mb-2 opacity-20" />
            {feed.length === 0 ? "No events recorded" : "No matches"}
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <div className="divide-y divide-gray-100 dark:divide-zinc-800/50">
              {filtered.map((e) => {
                const tool = (e.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(e.user_agent)
                return (
                  <div
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    className={cn(
                      "px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer",
                      e.severity === "critical" && "bg-red-50/50 dark:bg-red-950/10"
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
                          <span className="text-xs text-gray-400 dark:text-zinc-600 font-mono truncate hidden sm:inline max-w-[200px]">
                            {e.method} {e.path}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-zinc-600 mt-0.5 flex flex-wrap gap-x-3">
                        <span>{timeAgo(e.created_at)}</span>
                        {e.status_code && <span>status {e.status_code}</span>}
                        {e.fingerprint && <span className="font-mono">{e.fingerprint.slice(0, 16)}...</span>}
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
  )
}
