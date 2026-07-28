import { useState, useCallback, useEffect } from "react"
import { User, Search, Smartphone, Monitor, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
      if (res.ok) { const d = await res.json(); setAccounts(d.accounts || []); setMeta({ total: d.total, suspicious: d.suspicious }) }
    } catch { /* ignore */ }
  }, [filter, search])

  const fetchActs = useCallback(async (userId: string) => {
    try { const res = await fetch(`/api/kernel/accounts/${userId}/acts`); if (res.ok) setActs((await res.json()).acts || []) }
    catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 k-dim" />
            <span className="text-sm font-medium k-text">Accounts</span>
            <span className="k-dim k-mono text-[10px] ml-1">{meta?.total ?? '…'} total</span>
            {meta?.suspicious > 0 && <Badge variant="outline" className="k-a-red text-[10px]">{meta.suspicious} flagged</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 k-dim" />
              <input placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} className="k-input h-7 w-32 text-xs rounded-md pl-7" />
            </div>
            <div className="flex gap-1">
              {[{ key: "all", label: "All" }, { key: "suspicious", label: "Suspicious" }, { key: "tracked", label: "Tracked" }].map((tab) => (
                <button key={tab.key} onClick={() => setFilter(tab.key)}
                  className={cn("px-2 py-1 text-[10px] font-medium rounded transition-colors k-mono",
                    filter === tab.key ? "k-btn-primary" : "k-btn-ghost"
                  )}
                >{tab.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="p-0">
        {selected ? (
          <div>
            <button onClick={() => { setSelected(null); setActs([]) }} className="flex items-center gap-1 text-xs k-dim hover:k-muted px-4 py-2 border-b k-bdr">← Back to accounts</button>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium k-text">{selected.name || selected.email}</div>
                  <div className="text-xs k-dim">{selected.email} · {selected.user_type}</div>
                </div>
                {selected.is_suspicious && <Badge className="k-a-red text-[10px] border-0">Suspicious</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg p-2.5 k-bg2">
                  <div className="k-dim mb-0.5">IP</div>
                  <div className="k-mono k-text">{selected.last_ip || '—'}</div>
                </div>
                <div className="rounded-lg p-2.5 k-bg2">
                  <div className="k-dim mb-0.5">Device</div>
                  <div className="truncate k-dim" title={selected.last_user_agent || ''}>{selected.device_info || '—'}</div>
                </div>
                <div className="rounded-lg p-2.5 k-bg2">
                  <div className="k-dim mb-0.5">Location</div>
                  <div className="k-dim">{[selected.last_country, selected.last_region, selected.last_city].filter(Boolean).join(', ') || '—'}</div>
                </div>
              </div>
              {selected.suspicious_flags?.length > 0 && (
                <div>
                  <div className="text-xs font-medium k-dim mb-1.5">Suspicious Flags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.suspicious_flags.map((f: string) => (
                      <span key={f} className="px-2 py-0.5 text-[10px] k-mono rounded k-a-red">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {acts.length > 0 && (
                <div>
                  <div className="text-xs font-medium k-dim mb-1.5">Suspicious Activity</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto k-scroll">
                    {acts.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded k-mono k-bg2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.severity === 'error' || a.severity === 'critical' ? 'bg-red-400' : a.severity === 'warn' ? 'bg-amber-400' : 'bg-gray-400')} />
                          <span className="k-dim">{a.event_type}</span>
                          <span className="k-dim">{a.path}</span>
                        </div>
                        <span className="k-dim shrink-0 ml-2">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto k-scroll">
            {accounts.length === 0 ? (
              <div className="flex items-center justify-center h-20 k-dim text-xs">No accounts found</div>
            ) : (
              <table className="w-full">
                <thead><tr className="k-tr">
                  <th className="k-th">Account</th>
                  <th className="k-th">IP</th>
                  <th className="k-th">Device</th>
                  <th className="k-th">Location</th>
                  <th className="k-th text-right">Last Seen</th>
                </tr></thead>
                <tbody className="divide-y k-bdr">
                  {accounts.map((a: any) => (
                    <tr key={a.id} onClick={() => { setSelected(a); fetchActs(a.id) }}
                      className={cn("k-tr cursor-pointer", a.is_suspicious && "bg-red-500/10")}>
                      <td className="k-td">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 k-mono",
                            a.user_type === 'admin' ? "k-a-purple" : "k-muted"
                          )}>{(a.name || a.email || '?')[0].toUpperCase()}</div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-28 k-text">{a.name || a.email}</div>
                            <div className="k-dim truncate max-w-28">{a.email}</div>
                          </div>
                          {a.is_suspicious && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Suspicious" />}
                        </div>
                      </td>
                      <td className="k-td k-mono k-dim">{a.last_ip || '—'}</td>
                      <td className="k-td k-dim">{a.last_ip ? <span className="flex items-center gap-1">{a.device_info === 'iPhone' || a.device_info === 'Mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}{a.device_info || '—'}</span> : '—'}</td>
                      <td className="k-td k-dim"><span className="flex items-center gap-1"><MapPin className="w-3 h-3 k-dim" />{a.last_country || a.last_region || '—'}</span></td>
                      <td className="k-td text-right k-dim k-mono">{a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : (a.created_at ? 'Never' : '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
