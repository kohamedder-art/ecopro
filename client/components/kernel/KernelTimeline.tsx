import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { computeTimeline } from "./utils"

type TimelineProps = { events: { created_at: string }[] }

export default function KernelTimeline({ events }: TimelineProps) {
  const data = useMemo(() => computeTimeline(events), [events])
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          24h Event Timeline
          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 font-normal ml-1">
            {data.reduce((a, b) => a + b.count, 0)} events
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-end gap-[3px] h-28">
          {data.map((d) => {
            const h = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 8 : 0)
            return (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 bg-white dark:bg-zinc-900 px-1 rounded">
                  {d.count}
                </span>
                <div
                  className={cn(
                    "w-full rounded-sm transition-all duration-300",
                    d.count > 0
                      ? "bg-gradient-to-t from-red-500 to-red-400 dark:from-red-600 dark:to-red-500 hover:from-red-600 hover:to-red-500"
                      : "bg-gray-100 dark:bg-zinc-800"
                  )}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-gray-400 dark:text-zinc-600 font-mono mt-auto">{d.hour}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
