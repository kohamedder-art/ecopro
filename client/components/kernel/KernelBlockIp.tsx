import { useState } from "react"
import { Ban, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCsrfToken } from "./utils"

export default function KernelBlockIp({ onBlocked }: { onBlocked: () => void }) {
  const [blockIp, setBlockIp] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleBlock = async () => {
    if (!blockIp) return
    setLoading(true)
    try {
      const res = await fetch("/api/kernel/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ ip: blockIp.trim(), reason: blockReason || undefined }),
      })
      if (res.ok) {
        setBlockIp("")
        setBlockReason("")
        onBlocked()
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ban className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          Block IP
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2.5">
        <Input
          value={blockIp}
          onChange={(e) => setBlockIp(e.target.value)}
          placeholder="IP address"
          className="bg-white dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 h-9 text-sm font-mono"
        />
        <Input
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="Reason (optional)"
          className="bg-white dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 h-9 text-sm"
        />
        <Button
          onClick={handleBlock}
          disabled={!blockIp.trim() || loading}
          size="sm"
          className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white h-9"
        >
          <Lock className="w-3.5 h-3.5 mr-1.5" />
          {loading ? "Blocking..." : "Block"}
        </Button>
      </CardContent>
    </Card>
  )
}
