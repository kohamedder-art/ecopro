import { Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { countryFlag } from "./utils"
import type { SummaryData } from "./types"

export default function KernelTopOrigins({ summary }: { summary: SummaryData | null }) {
  const countries = summary?.top_countries
  if (!countries || countries.length === 0) return null

  const total = summary.events_today || 1

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          Top Origins
          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 font-normal ml-1">by country</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2.5">
        {countries.slice(0, 8).map((c) => {
          const pct = Math.round((c.count / total) * 100)
          return (
            <div key={c.country_code} className="flex items-center gap-2.5 group">
              <span className="text-lg">{countryFlag(c.country_code)}</span>
              <span className="text-xs text-gray-500 dark:text-zinc-500 w-6 font-mono">{c.country_code}</span>
              <div className="flex-1 h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-400 dark:from-red-700 dark:to-red-600 rounded-full transition-all duration-500 group-hover:from-red-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums w-12 text-right font-medium">{pct}%</span>
              <span className="text-[10px] text-gray-400 dark:text-zinc-600 tabular-nums w-10 text-right">{c.count}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
