import { Globe } from "lucide-react"
import { countryFlag } from "./utils"
import type { SummaryData } from "./types"

export default function KernelTopOrigins({ summary }: { summary: SummaryData | null }) {
  const countries = summary?.top_countries
  if (!countries || countries.length === 0) return null

  const total = summary.events_today || 1

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <Globe className="w-4 h-4 k-dim" />
        <span className="text-sm font-medium k-text">Top Origins</span>
        <span className="k-dim k-mono text-[10px] ml-1">by country</span>
      </div>
      <div className="p-4 space-y-2.5">
        {countries.slice(0, 8).map((c) => {
          const pct = Math.round((c.count / total) * 100)
          return (
            <div key={c.country_code} className="flex items-center gap-2.5 group">
              <span className="text-lg">{countryFlag(c.country_code)}</span>
              <span className="text-xs k-dim w-6 k-mono">{c.country_code}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden k-bg2">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
              </div>
              <span className="text-xs k-dim tabular-nums w-12 text-right font-medium">{pct}%</span>
              <span className="text-[10px] k-dim tabular-nums w-10 text-right">{c.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
