import { Ban, Lock } from "lucide-react"
import { getCsrfToken } from "./utils"
import { useState } from "react"

export default function KernelBlockIp({ onBlocked }: { onBlocked: () => void }) {
  const [blockIp, setBlockIp] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleBlock = async () => {
    if (!blockIp) return
    setLoading(true)
    try {
      const res = await fetch("/api/kernel/blocks", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ ip: blockIp.trim(), reason: blockReason || undefined }),
      })
      if (res.ok) { setBlockIp(""); setBlockReason(""); onBlocked() }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <Ban className="w-4 h-4 k-a-red" />
        <span className="text-sm font-medium k-text">Block IP</span>
      </div>
      <div className="p-4 space-y-2.5">
        <input value={blockIp} onChange={(e) => setBlockIp(e.target.value)} placeholder="IP address" className="k-input h-9 text-sm rounded-md px-3 w-full k-mono" />
        <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason (optional)" className="k-input h-9 text-sm rounded-md px-3 w-full" />
        <button onClick={handleBlock} disabled={!blockIp.trim() || loading}
          className="k-btn k-btn-danger w-full h-9 flex items-center justify-center gap-1.5"
        ><Lock className="w-3.5 h-3.5" />{loading ? "Blocking..." : "Block"}</button>
      </div>
    </div>
  )
}
