import { Store, AlertTriangle, Zap, Globe, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StoreThreats = {
  badStores?: any[]
  rapidOrders?: any[]
  multiStoreIps?: any[]
}

export default function KernelStoreThreats({ storeThreats }: { storeThreats: StoreThreats | null }) {
  if (!storeThreats) {
    return (
      <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
        <CardContent className="p-8 text-center text-gray-400 dark:text-zinc-600 text-sm">Loading store threats...</CardContent>
      </Card>
    )
  }

  const totalAlerts = (storeThreats.badStores?.length || 0) + (storeThreats.rapidOrders?.length || 0)

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Store className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          Store Threats
          {totalAlerts > 0 && (
            <Badge variant="outline" className="text-[10px] border-red-500 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30">
              {totalAlerts} alerts
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {storeThreats.badStores?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              High Cancellation/Fraud Rate (24h)
            </h4>
            <div className="space-y-1.5">
              {storeThreats.badStores.slice(0, 10).map((s: any) => (
                <div key={s.client_id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-700 dark:text-zinc-300 truncate">{s.store_name || s.store_slug}</span>
                    <span className="text-gray-400 dark:text-zinc-600">{s.total_orders} orders</span>
                  </div>
                  <span className={cn("font-mono tabular-nums shrink-0", Number(s.bad_pct) > 50 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400")}>
                    {s.bad_pct}% bad
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {storeThreats.rapidOrders?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-orange-500" />
              Rapid-Fire Orders (5+ from same IP in 1h)
            </h4>
            <div className="space-y-1.5">
              {storeThreats.rapidOrders.slice(0, 10).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-gray-500 dark:text-zinc-400">{r.customer_ip}</span>
                    <span className="text-gray-700 dark:text-zinc-300 truncate">→ {r.store_name || r.store_slug}</span>
                  </div>
                  <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 shrink-0">{r.orders_in_hour}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {storeThreats.multiStoreIps?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-purple-500" />
              Same IP Across Multiple Stores (7d)
            </h4>
            <div className="space-y-1.5">
              {storeThreats.multiStoreIps.slice(0, 10).map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-gray-500 dark:text-zinc-400">{m.customer_ip}</span>
                    <span className="text-gray-400 dark:text-zinc-600">→ {m.store_count} stores</span>
                  </div>
                  <span className="text-gray-500 dark:text-zinc-400 truncate max-w-[200px]" title={m.store_names}>{m.store_names}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!storeThreats.badStores?.length && !storeThreats.rapidOrders?.length && !storeThreats.multiStoreIps?.length && (
          <div className="flex flex-col items-center justify-center h-24 text-gray-400 dark:text-zinc-600 text-xs">
            <Shield className="w-6 h-6 mb-1.5 opacity-30" />
            No store threats detected
          </div>
        )}
      </CardContent>
    </Card>
  )
}
