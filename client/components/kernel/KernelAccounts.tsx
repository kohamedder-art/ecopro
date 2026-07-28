import { useState, useCallback, useEffect } from "react"
import { User, Search, Smartphone, Monitor, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function KernelAccounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any>(null)
  const [acts, setActs] = useState<any[]>([])

  const fetchAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("filter", filter)
      if (search) params.set("search", search)
      const res = await fetch(`/api/kernel/accounts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
        setMeta({ total: data.total, suspicious: data.suspicious })
      }
    } catch { /* ignore */ }
  }, [filter, search])

  const fetchActs = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/kernel/accounts/${userId}/acts`)
      if (res.ok) setActs((await res.json()).acts || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
            Accounts
            <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 ml-1">
              {meta?.total ?? '…'} total
            </span>
            {meta?.suspicious > 0 && (
              <Badge variant="outline" className="text-[10px] border-red-500 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30">
                {meta.suspicious} flagged
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-zinc-600" />
              <Input
                placeholder="Search accounts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-36 text-xs pl-7 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
              />
            </div>
            <div className="flex gap-1">
              {[
                { key: "all", label: "All" },
                { key: "suspicious", label: "Suspicious" },
                { key: "tracked", label: "Tracked" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                    filter === tab.key
                      ? "bg-gray-900 text-white dark:bg-white dark:text-black"
                      : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {selected ? (
          <div>
            <button
              onClick={() => { setSelected(null); setActs([]); }}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 px-4 py-2 border-b border-gray-200 dark:border-zinc-800"
            >
              ← Back to accounts
            </button>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">{selected.name || selected.email}</div>
                  <div className="text-xs text-gray-500 dark:text-zinc-500">{selected.email} · {selected.user_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.is_suspicious && (
                    <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-0">Suspicious</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <div className="text-gray-400 dark:text-zinc-600 mb-0.5">IP</div>
                  <div className="font-mono text-gray-700 dark:text-zinc-300">{selected.last_ip || '—'}</div>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <div className="text-gray-400 dark:text-zinc-600 mb-0.5">Device</div>
                  <div className="text-gray-700 dark:text-zinc-300 truncate" title={selected.last_user_agent || ''}>{selected.device_info || '—'}</div>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <div className="text-gray-400 dark:text-zinc-600 mb-0.5">Location</div>
                  <div className="text-gray-700 dark:text-zinc-300">
                    {[selected.last_country, selected.last_region, selected.last_city].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
              </div>
              {selected.suspicious_flags?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-1.5">Suspicious Flags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.suspicious_flags.map((f: string) => (
                      <span key={f} className="px-2 py-0.5 text-[10px] font-mono rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {acts.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-1.5">Suspicious Activity</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {acts.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded bg-gray-50 dark:bg-zinc-800/50 font-mono">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            a.severity === 'error' || a.severity === 'critical' ? 'bg-red-500' :
                            a.severity === 'warn' ? 'bg-orange-500' : 'bg-gray-400'
                          )} />
                          <span className="text-gray-500 dark:text-zinc-500">{a.event_type}</span>
                          <span className="text-gray-400 dark:text-zinc-600">{a.path}</span>
                        </div>
                        <span className="text-gray-400 dark:text-zinc-600 shrink-0 ml-2">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-400 dark:text-zinc-600 text-xs">No accounts found</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 text-[10px] text-gray-400 dark:text-zinc-600">
                    <th className="text-left px-4 py-2 font-medium">Account</th>
                    <th className="text-left px-2 py-2 font-medium">IP</th>
                    <th className="text-left px-2 py-2 font-medium">Device</th>
                    <th className="text-left px-2 py-2 font-medium">Location</th>
                    <th className="text-right px-4 py-2 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a: any) => (
                    <tr
                      key={a.id}
                      onClick={() => { setSelected(a); fetchActs(a.id); }}
                      className={cn(
                        "border-b border-gray-100 dark:border-zinc-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors",
                        a.is_suspicious && "bg-red-50/50 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                            a.user_type === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'
                          )}>
                            {(a.name || a.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-700 dark:text-zinc-300 truncate max-w-28">{a.name || a.email}</div>
                            <div className="text-gray-400 dark:text-zinc-600 truncate max-w-28">{a.email}</div>
                          </div>
                          {a.is_suspicious && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Suspicious" />}
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-gray-500 dark:text-zinc-500">{a.last_ip || '—'}</td>
                      <td className="px-2 py-2 text-gray-500 dark:text-zinc-500">
                        <div className="flex items-center gap-1">
                          {a.device_info === 'iPhone' || a.device_info === 'Android' || a.device_info === 'Mobile'
                            ? <Smartphone className="w-3 h-3" />
                            : <Monitor className="w-3 h-3" />
                          }
                          <span>{a.device_info || '—'}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-500 dark:text-zinc-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400 dark:text-zinc-600" />
                          <span>{a.last_country || a.last_region || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 dark:text-zinc-600 font-mono">
                        {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : (a.created_at ? 'Never' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
