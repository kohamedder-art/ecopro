import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TOOL_STYLES } from "./utils"

export default function ToolBadge({ tool }: { tool: string | null }) {
  if (!tool || tool === "unknown") return null
  const c = TOOL_STYLES[tool.toLowerCase()] || "k-muted"
  return <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 k-mono border", c)}>{tool}</Badge>
}
