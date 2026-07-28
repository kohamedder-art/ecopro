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
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/kernel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Login failed")
        return
      }
      onLogin()
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-black dark:via-zinc-950 dark:to-black flex items-center justify-center z-50">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 mb-5">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Kernel Security</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1.5">Enter root credentials to access the security dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-zinc-500 font-semibold uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9 bg-white dark:bg-zinc-900/80 border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:border-green-500 dark:focus:border-green-700/50 focus:ring-green-500/30 h-11 text-sm"
                placeholder="root"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-zinc-500 font-semibold uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 bg-white dark:bg-zinc-900/80 border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:border-green-500 dark:focus:border-green-700/50 focus:ring-green-500/30 h-11 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-3 py-2.5 rounded-lg">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-600 dark:hover:to-emerald-600 text-white h-11 font-medium text-sm rounded-xl shadow-lg shadow-green-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading ? "Authenticating..." : "Authenticate"}
          </Button>
        </form>
      </div>
    </div>
  )
}
