import { Activity, AlertTriangle, Eye, WifiOff, Ban, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SummaryData } from "./types"

const STATS = [
  { key: "total", label: "Total Events (24h)", icon: Activity, accent: "k-a-blue" },
  { key: "threats", label: "Real Threats", icon: AlertTriangle, accent: "k-a-red" },
  { key: "probes", label: "Probes", icon: Eye, accent: "k-a-amber" },
  { key: "noise", label: "Scanner Noise", icon: WifiOff, accent: "k-muted" },
  { key: "blocked", label: "Blocked IPs", icon: Ban, accent: "k-a-red" },
]

export default function KernelStatsCards({ summary }: { summary: SummaryData | null }) {
  if (!summary) return <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin k-a-green" /></div>

  const values: Record<string, number> = {
    total: summary.threatCounts?.total ?? summary.events_today ?? 0,
    threats: summary.threatCounts?.real_threats ?? 0,
    probes: summary.threatCounts?.probes ?? 0,
    noise: summary.threatCounts?.scanner_noise ?? 0,
    blocked: summary.blocked_ips ?? 0,
  }

  const desc: Record<string, string> = {
    total: "All security events in the last 24 hours",
    threats: "Confirmed malicious traffic requiring attention",
    probes: "Reconnaissance attempts scanning for vulnerabilities",
    noise: "Low-risk scanner traffic from bots and crawlers",
    blocked: "IPs currently blocked from accessing the platform",
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {STATS.map((s) => (
        <div key={s.key} title={desc[s.key]} className="k-card rounded-xl p-4 flex items-center gap-3 k-card-glow transition-all hover:-translate-y-0.5">
          <div className={cn("p-2.5 rounded-xl", s.accent)}><s.icon className="w-4 h-4" /></div>
          <div>
            <p className="text-2xl font-bold tracking-tight tabular-nums k-text">{values[s.key]}</p>
            <p className="text-[11px] leading-tight mt-0.5 k-dim">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
