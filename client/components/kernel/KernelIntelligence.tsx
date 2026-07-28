import { useEffect, useState } from "react"
import { BrainCircuit, Database, ShieldCheck, AlertTriangle, Eye, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type IntelStats = {
  cache?: { total_cached: number; vpn_count: number; proxy_count: number; tor_count: number; blacklisted_count: number; checked_today: number }
  decisions?: { decision: string; count: number }[]
  fingerprints?: { total: number; webrtc_leaks: number; incognito_users: number; unique_visitors: number }
  risk_distribution?: { risk_level: string; count: number }[]
}

export default function KernelIntelligence() {
  const [data, setData] = useState<IntelStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/intel/admin/stats?days=1")
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
        <CardContent className="p-8 text-center text-gray-400 dark:text-zinc-600 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading intelligence...
        </CardContent>
      </Card>
    )
  }

  const cache = data?.cache
  const decisions = data?.decisions || []
  const fps = data?.fingerprints
  const riskDist = data?.risk_distribution || []

  return (
    <div className="space-y-4">
      {/* IP Intelligence Cache */}
      <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
        <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            IP Intelligence Cache
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {cache ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Cached", value: cache.total_cached, color: "text-blue-600" },
                { label: "VPNs Detected", value: cache.vpn_count, color: "text-orange-600" },
                { label: "Proxies", value: cache.proxy_count, color: "text-yellow-600" },
                { label: "Tor Nodes", value: cache.tor_count, color: "text-purple-600" },
                { label: "Blacklisted", value: cache.blacklisted_count, color: "text-red-600" },
                { label: "Checked Today", value: cache.checked_today, color: "text-green-600" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                  <div className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</div>
                  <div className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-4">Cache data unavailable</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Distribution */}
        {riskDist.length > 0 && (
          <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {riskDist.map((r) => {
                const total = riskDist.reduce((a, b) => a + b.count, 0) || 1
                const pct = Math.round((r.count / total) * 100)
                const colors: Record<string, string> = {
                  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-500", unknown: "bg-gray-400",
                }
                return (
                  <div key={r.risk_level} className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-gray-600 dark:text-zinc-400 capitalize w-16">{r.risk_level}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", colors[r.risk_level] || "bg-gray-400")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums w-10 text-right font-mono">{r.count}</span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600 tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Decision Summary */}
        {decisions.length > 0 && (
          <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Security Decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {decisions.map((d) => {
                const total = decisions.reduce((a, b) => a + b.count, 0) || 1
                const pct = Math.round((d.count / total) * 100)
                const colors: Record<string, string> = {
                  block: "bg-red-500", challenge: "bg-orange-500", flag: "bg-yellow-500", allow: "bg-green-500",
                }
                return (
                  <div key={d.decision} className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-gray-600 dark:text-zinc-400 capitalize w-16">{d.decision}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", colors[d.decision] || "bg-gray-400")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums w-10 text-right font-mono">{d.count}</span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600 tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Fingerprint Stats */}
        {fps && (
          <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
            <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                Client Fingerprints
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: fps.total, color: "text-blue-600" },
                  { label: "WebRTC Leaks", value: fps.webrtc_leaks, color: "text-red-600" },
                  { label: "Incognito", value: fps.incognito_users, color: "text-orange-600" },
                  { label: "Unique Visitors", value: fps.unique_visitors, color: "text-green-600" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <div className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</div>
                    <div className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
