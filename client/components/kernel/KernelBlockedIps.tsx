import { Ban, Unlock } from "lucide-react"
import { timeAgo, countryFlag, getCsrfToken } from "./utils"
import type { BlockEntry } from "./types"

type Props = { blocks: BlockEntry[]; onUnblocked: () => void }

export default function KernelBlockedIps({ blocks, onUnblocked }: Props) {
  const handleUnblock = async (ip: string) => {
    try { await fetch(`/api/kernel/blocks/${encodeURIComponent(ip)}`, { method: "DELETE", headers: { "X-CSRF-Token": getCsrfToken() } }); onUnblocked() }
    catch { /* ignore */ }
  }

  if (blocks.length === 0) return (
    <div className="k-card rounded-xl k-card-glow p-8 text-center k-dim text-sm flex flex-col items-center gap-2">
      <Ban className="w-8 h-8 opacity-20" /> No IPs currently blocked
    </div>
  )

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <Ban className="w-4 h-4 k-a-red" />
        <span className="text-sm font-medium k-text">Blocked IPs</span>
        <span className="k-dim k-mono text-[10px] ml-1">({blocks.length})</span>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr className="k-tr">
            <th className="k-th">IP</th>
            <th className="k-th hidden sm:table-cell">Country</th>
            <th className="k-th">Reason</th>
            <th className="k-th hidden md:table-cell">Blocked</th>
            <th className="k-th text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y k-bdr">
            {blocks.map((b) => (
              <tr key={b.id} className="k-tr">
                <td className="k-td k-mono k-text">{b.ip}</td>
                <td className="k-td hidden sm:table-cell k-dim">{countryFlag(b.country_code)} {b.country_code || "—"}</td>
                <td className="k-td max-w-[200px] truncate k-muted">{b.reason || "—"}</td>
                <td className="k-td hidden md:table-cell k-dim k-mono">{timeAgo(b.blocked_at)}</td>
                <td className="k-td text-right">
                  <button onClick={() => handleUnblock(b.ip)} className="k-btn px-2 py-1 rounded k-mono k-a-green">
                    <Unlock className="w-3 h-3 mr-1 inline" /> Unblock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
