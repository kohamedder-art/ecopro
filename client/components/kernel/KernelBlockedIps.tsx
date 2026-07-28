import { Ban, Unlock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { timeAgo, countryFlag, getCsrfToken } from "./utils"
import type { BlockEntry } from "./types"

type Props = {
  blocks: BlockEntry[]
  onUnblocked: () => void
}

export default function KernelBlockedIps({ blocks, onUnblocked }: Props) {
  const handleUnblock = async (ip: string) => {
    try {
      await fetch(`/api/kernel/blocks/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": getCsrfToken() },
      })
      onUnblocked()
    } catch {
      /* ignore */
    }
  }

  if (blocks.length === 0) {
    return (
      <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
        <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Ban className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            Blocked IPs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-gray-400 dark:text-zinc-600 text-sm">
          No IPs currently blocked
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ban className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          Blocked IPs
          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 font-normal ml-1">({blocks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
                <th className="text-left text-[11px] text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">IP</th>
                <th className="text-left text-[11px] text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5 hidden sm:table-cell">Country</th>
                <th className="text-left text-[11px] text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">Reason</th>
                <th className="text-left text-[11px] text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5 hidden md:table-cell">Blocked</th>
                <th className="text-right text-[11px] text-gray-500 dark:text-zinc-600 font-medium px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
              {blocks.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-zinc-300">{b.ip}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-500 hidden sm:table-cell">{countryFlag(b.country_code)} {b.country_code || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400 max-w-[200px] truncate">{b.reason || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-zinc-600 hidden md:table-cell font-mono">{timeAgo(b.blocked_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleUnblock(b.ip)} className="h-7 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 dark:text-zinc-500 dark:hover:text-green-400 dark:hover:bg-green-950/20">
                      <Unlock className="w-3 h-3 mr-1" />
                      Unblock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
