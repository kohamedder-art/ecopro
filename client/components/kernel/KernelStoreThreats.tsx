import { Store, AlertTriangle, Zap, Globe, Shield, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StoreThreats = { badStores?: any[]; rapidOrders?: any[]; multiStoreIps?: any[] }

export default function KernelStoreThreats({ storeThreats }: { storeThreats: StoreThreats | null }) {
  if (!storeThreats) return <div className="k-card rounded-xl k-card-glow p-8 text-center k-dim text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin k-a-green" />Loading store threats...</div>

  const totalAlerts = (storeThreats.badStores?.length || 0) + (storeThreats.rapidOrders?.length || 0)

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <Store className="w-4 h-4 k-dim" />
        <span className="text-sm font-medium k-text">Store Threats</span>
        {totalAlerts > 0 && <Badge variant="outline" className="k-a-red text-[10px]">{totalAlerts} alerts</Badge>}
      </div>
      <div className="p-4 space-y-4">
        {storeThreats.badStores?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium k-dim mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 k-a-red" />High Cancellation/Fraud Rate (24h)</h4>
            <div className="space-y-1.5">
              {storeThreats.badStores.slice(0, 10).map((s: any) => (
                <div key={s.client_id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg k-bg2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate k-text">{s.store_name || s.store_slug}</span>
                    <span className="k-dim">{s.total_orders} orders</span>
                  </div>
                  <span className={cn("k-mono tabular-nums shrink-0", Number(s.bad_pct) > 50 ? "k-a-red" : "k-a-amber")}>{s.bad_pct}% bad</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {storeThreats.rapidOrders?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium k-dim mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3 k-a-amber" />Rapid-Fire Orders (5+ from same IP in 1h)</h4>
            <div className="space-y-1.5">
              {storeThreats.rapidOrders.slice(0, 10).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg k-bg2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="k-mono k-dim">{r.customer_ip}</span>
                    <span className="truncate k-muted">→ {r.store_name || r.store_slug}</span>
                  </div>
                  <span className="k-mono tabular-nums k-a-amber shrink-0">{r.orders_in_hour}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {storeThreats.multiStoreIps?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium k-dim mb-2 flex items-center gap-1.5"><Globe className="w-3 h-3 k-a-purple" />Same IP Across Multiple Stores (7d)</h4>
            <div className="space-y-1.5">
              {storeThreats.multiStoreIps.slice(0, 10).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg k-bg2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="k-mono k-dim">{m.customer_ip}</span>
                    <span className="k-dim">→ {m.store_count} stores</span>
                  </div>
                  <span className="k-dim truncate max-w-[200px]" title={m.store_names}>{m.store_names}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(!storeThreats.badStores?.length && !storeThreats.rapidOrders?.length && !storeThreats.multiStoreIps?.length) && (
          <div className="flex flex-col items-center justify-center h-24 k-dim text-xs"><Shield className="w-6 h-6 mb-1.5 opacity-30" />No store threats detected</div>
        )}
      </div>
    </div>
  )
}
