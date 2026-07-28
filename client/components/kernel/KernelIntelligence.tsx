import { useEffect, useState } from "react"
import { BrainCircuit, Database, ShieldCheck, AlertTriangle, Eye, Loader2 } from "lucide-react"
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
    fetch("/api/intel/admin/stats?days=1").then((r) => r.ok ? r.json() : null).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="k-card rounded-xl k-card-glow p-8 text-center k-dim text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin k-a-green" />Loading intelligence...</div>

  const cache = data?.cache; const decisions = data?.decisions || []; const fps = data?.fingerprints; const riskDist = data?.risk_distribution || []

  return (
    <div className="space-y-4">
      <div className="k-card rounded-xl k-card-glow">
        <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
          <Database className="w-4 h-4 k-dim" />
          <span className="text-sm font-medium k-text">IP Intelligence Cache</span>
        </div>
        <div className="p-4">
          {cache ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Cached", value: cache.total_cached, accent: "k-a-blue" },
                { label: "VPNs Detected", value: cache.vpn_count, accent: "k-a-amber" },
                { label: "Proxies", value: cache.proxy_count, accent: "k-a-amber" },
                { label: "Tor Nodes", value: cache.tor_count, accent: "k-a-purple" },
                { label: "Blacklisted", value: cache.blacklisted_count, accent: "k-a-red" },
                { label: "Checked Today", value: cache.checked_today, accent: "k-a-green" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center k-bg2">
                  <div className={cn("text-2xl font-bold tabular-nums", s.accent)}>{s.value}</div>
                  <div className="text-[10px] k-dim mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-center k-dim text-sm py-4">Cache data unavailable</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {riskDist.length > 0 && (
          <div className="k-card rounded-xl k-card-glow">
            <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 k-dim" />
              <span className="text-sm font-medium k-text">Risk Distribution</span>
            </div>
            <div className="p-4 space-y-2">
              {riskDist.map((r) => {
                const total = riskDist.reduce((a, b) => a + b.count, 0) || 1
                const pct = Math.round((r.count / total) * 100)
                const colors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", unknown: "#6b7280" }
                return (
                  <div key={r.risk_level} className="flex items-center gap-2.5">
                    <span className="text-xs font-medium k-dim capitalize w-16">{r.risk_level}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden k-bg2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[r.risk_level] || '#6b7280' }} />
                    </div>
                    <span className="text-xs k-dim tabular-nums w-10 text-right k-mono">{r.count}</span>
                    <span className="text-[10px] k-dim tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {decisions.length > 0 && (
          <div className="k-card rounded-xl k-card-glow">
            <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 k-dim" />
              <span className="text-sm font-medium k-text">Security Decisions</span>
            </div>
            <div className="p-4 space-y-2">
              {decisions.map((d) => {
                const total = decisions.reduce((a, b) => a + b.count, 0) || 1
                const pct = Math.round((d.count / total) * 100)
                const colors: Record<string, string> = { block: "#ef4444", challenge: "#f59e0b", flag: "#fbbf24", allow: "#34d399" }
                return (
                  <div key={d.decision} className="flex items-center gap-2.5">
                    <span className="text-xs font-medium k-dim capitalize w-16">{d.decision}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden k-bg2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[d.decision] || '#6b7280' }} />
                    </div>
                    <span className="text-xs k-dim tabular-nums w-10 text-right k-mono">{d.count}</span>
                    <span className="text-[10px] k-dim tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {fps && (
          <div className="k-card rounded-xl k-card-glow">
            <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
              <Eye className="w-4 h-4 k-dim" />
              <span className="text-sm font-medium k-text">Client Fingerprints</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: fps.total, accent: "k-a-blue" },
                  { label: "WebRTC Leaks", value: fps.webrtc_leaks, accent: "k-a-red" },
                  { label: "Incognito", value: fps.incognito_users, accent: "k-a-amber" },
                  { label: "Unique Visitors", value: fps.unique_visitors, accent: "k-a-green" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center k-bg2">
                    <div className={cn("text-2xl font-bold tabular-nums", s.accent)}>{s.value}</div>
                    <div className="text-[10px] k-dim mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
