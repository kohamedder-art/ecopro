import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { computeTimeline } from "./utils"

type Props = { events: { created_at: string }[] }

export default function KernelTimeline({ events }: Props) {
  const data = useMemo(() => computeTimeline(events), [events])
  const max = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((a, b) => a + b.count, 0)

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <BarChart3 className="w-4 h-4 k-dim" />
        <span className="text-sm font-medium k-text">24h Event Timeline</span>
        <span className="k-dim k-mono text-[10px] ml-1">{total} events</span>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-[3px] h-28">
          {data.map((d) => {
            const h = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 8 : 0)
            return (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                <span className="k-dim k-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 px-1 rounded k-bg2">{d.count}</span>
                <div className={cn("w-full rounded-sm transition-all duration-300", d.count > 0 ? "k-glow-green" : "")}
                  style={{ height: `${h}%`, background: d.count > 0 ? 'linear-gradient(to top, #059669, #34d399)' : '#374151' }}
                />
                <span className="k-dim k-mono text-[9px] mt-auto">{d.hour}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
