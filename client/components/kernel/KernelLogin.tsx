import { useState } from "react"
import { Shield, User, KeyRound, XCircle, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getCsrfToken } from "./utils"

export default function KernelLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("root")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    try {
      const res = await fetch("/api/kernel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Login failed"); return }
      onLogin()
    } catch { setError("Network error") } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 k-bg">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10" style={{ background: '#34d399', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10" style={{ background: '#3b82f6', filter: 'blur(80px)' }} />
      </div>
      <div className="w-full max-w-sm px-6 relative">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ background: '#34d399', boxShadow: '0 0 30px #34d39940' }}>
            <Shield className="w-8 h-8" style={{ color: '#111827' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight k-text">Kernel Security</h1>
          <p className="text-sm mt-1.5 k-dim">Root access required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider k-dim">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 k-dim" />
              <Input
                value={username} onChange={(e) => setUsername(e.target.value)}
                className="pl-9 h-11 text-sm k-input"
                placeholder="root"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider k-dim">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 k-dim" />
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-11 text-sm k-input"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg k-a-red">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full h-11 font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all k-btn-primary"
            style={loading ? { opacity: 0.7 } : {}}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Authenticating..." : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  )
}
