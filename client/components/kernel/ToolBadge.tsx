import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TOOL_COLORS } from "./utils"

export default function ToolBadge({ tool }: { tool: string | null }) {
  if (!tool || tool === "unknown") return null
  const c = TOOL_COLORS[tool.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40"
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-mono border", c)}>
      {tool}
    </Badge>
  )
}
