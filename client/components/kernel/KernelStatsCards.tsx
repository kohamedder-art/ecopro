import { Activity, AlertTriangle, Eye, WifiOff, Ban, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { SummaryData } from "./types"

const STATS = [
  { key: "total", label: "Total Events (24h)", icon: Activity, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { key: "threats", label: "Real Threats", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
  { key: "probes", label: "Probes", icon: Eye, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
  { key: "noise", label: "Scanner Noise", icon: WifiOff, color: "text-gray-500 dark:text-zinc-400", bg: "bg-gray-100 dark:bg-zinc-800/50" },
  { key: "blocked", label: "Blocked IPs", icon: Ban, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
]

export default function KernelStatsCards({ summary }: { summary: SummaryData | null }) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  const values: Record<string, number> = {
    total: summary.threatCounts?.total ?? summary.events_today ?? 0,
    threats: summary.threatCounts?.real_threats ?? 0,
    probes: summary.threatCounts?.probes ?? 0,
    noise: summary.threatCounts?.scanner_noise ?? 0,
    blocked: summary.blocked_ips ?? 0,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {STATS.map((s) => (
        <Card key={s.key} className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{values[s.key]}</p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500 leading-tight mt-0.5">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
