import { X, ExternalLink, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmt, countryFlag, SEVERITY_STYLES, EVENT_LABELS, getToolFromUA } from "./utils"
import ToolBadge from "./ToolBadge"
import type { SecurityEvent } from "./types"

export default function KernelEventDetail({ event, onClose }: { event: SecurityEvent; onClose: () => void }) {
  const tool = (event.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(event.user_agent)
  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="k-mono k-dim">{event.id}</span>],
    ["Time", <span className="k-text">{fmt(event.created_at)}</span>],
    ["Event Type", <Badge variant="outline" className={cn("text-[11px] k-mono border", SEVERITY_STYLES[event.severity] || "k-muted")}>{EVENT_LABELS[event.event_type] || event.event_type}</Badge>],
    ["Severity", <span className="capitalize font-medium" style={{ color: event.severity === 'critical' || event.severity === 'error' ? '#f87171' : event.severity === 'warn' ? '#fbbf24' : '#60a5fa' }}>{event.severity}</span>],
    ["IP", event.ip ? <span className="k-mono text-xs flex items-center gap-1 k-text">{countryFlag(event.country_code)} {event.ip}</span> : <span className="k-dim">—</span>],
    ["Country", event.country_code || <span className="k-dim">—</span>],
    ["Method", event.method ? <span className="k-mono k-text">{event.method}</span> : <span className="k-dim">—</span>],
    ["Path", event.path ? <span className="k-mono text-xs break-all px-1.5 py-0.5 rounded k-bg2 k-text">{event.method} {event.path}</span> : <span className="k-dim">—</span>],
    ["Status Code", event.status_code ? <span className="k-mono k-text">{event.status_code}</span> : <span className="k-dim">—</span>],
    ["User Agent", event.user_agent ? <span className="k-mono text-[11px] break-all max-h-20 overflow-y-auto block k-dim">{event.user_agent}</span> : <span className="k-dim">—</span>],
    ["Fingerprint", event.fingerprint ? <span className="k-mono k-text">{event.fingerprint}</span> : <span className="k-dim">—</span>],
    ["Tool", tool ? <ToolBadge tool={tool} /> : <span className="k-dim">—</span>],
    ["Auth Session", event.user_id ? <Badge variant="outline" className="k-a-cyan text-[11px]"><User className="w-3 h-3 mr-1" /> User #{event.user_id}</Badge> : <span className="k-dim">No</span>],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg k-card rounded-xl k-card-glow" style={{ borderColor: '#4b5563' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b k-bdr flex items-center justify-between">
          <div className="text-sm font-medium flex items-center gap-2 k-text">
            <ExternalLink className="w-4 h-4 k-dim" />
            Event #{event.id}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="k-btn k-btn-ghost h-7 w-7 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-0 max-h-[65vh] overflow-y-auto k-scroll">
          <div className="divide-y k-bdr">
            {rows.map(([label, value]) => (
              <div key={label} className="px-4 py-2.5 flex items-start gap-4 hover:bg-white/5">
                <span className="text-xs k-dim w-24 shrink-0 font-medium">{label}</span>
                <div className="flex-1 text-xs min-w-0 break-all k-text">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
