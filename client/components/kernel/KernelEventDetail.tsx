import { X, ExternalLink, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmt, countryFlag, SEVERITY_COLORS, EVENT_LABELS, getToolFromUA } from "./utils"
import ToolBadge from "./ToolBadge"
import type { SecurityEvent } from "./types"

export default function KernelEventDetail({ event, onClose }: { event: SecurityEvent; onClose: () => void }) {
  const tool = (event.metadata as { detected_tool?: string } | null)?.detected_tool || getToolFromUA(event.user_agent)
  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="font-mono text-xs">{event.id}</span>],
    ["Time", fmt(event.created_at)],
    ["Event Type", <Badge variant="outline" className={cn("text-[11px] font-mono border", SEVERITY_COLORS[event.severity] || "")}>{EVENT_LABELS[event.event_type] || event.event_type}</Badge>],
    ["Severity", <span className="capitalize font-medium">{event.severity}</span>],
    ["IP", event.ip ? <span className="font-mono text-xs flex items-center gap-1">{countryFlag(event.country_code)} {event.ip}</span> : "—"],
    ["Country", event.country_code || "—"],
    ["Method", event.method ? <span className="font-mono text-xs">{event.method}</span> : "—"],
    ["Path", event.path ? <span className="font-mono text-xs break-all bg-gray-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded">{event.method} {event.path}</span> : "—"],
    ["Status Code", event.status_code ? <span className="font-mono text-xs">{event.status_code}</span> : "—"],
    ["User Agent", event.user_agent ? <span className="font-mono text-[11px] break-all max-h-20 overflow-y-auto block">{event.user_agent}</span> : "—"],
    ["Fingerprint", event.fingerprint ? <span className="font-mono text-xs">{event.fingerprint}</span> : "—"],
    ["Tool", tool ? <ToolBadge tool={tool} /> : "—"],
    ["Auth Session", event.user_id ? <Badge variant="outline" className="border-cyan-300 text-cyan-700 bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:bg-cyan-950/30 text-[11px]"><User className="w-3 h-3 mr-1" /> User #{event.user_id}</Badge> : <span className="text-gray-400">No</span>],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            Event #{event.id}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[65vh]">
            <div className="divide-y divide-gray-100 dark:divide-zinc-800/50">
              {rows.map(([label, value]) => (
                <div key={label} className="px-4 py-2.5 flex items-start gap-4 hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                  <span className="text-xs text-gray-500 dark:text-zinc-500 w-24 shrink-0 font-medium">{label}</span>
                  <div className="flex-1 text-xs text-gray-900 dark:text-zinc-200 min-w-0 break-all">{value}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
