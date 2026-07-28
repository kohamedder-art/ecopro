import { useState, useEffect } from "react"
import { Sliders, Save, Loader2, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Settings = Record<string, string>

const SETTING_META: Record<string, { label: string; desc: string; type: "toggle" | "number" }> = {
  auto_block_enabled: { label: "Auto-Blocking", desc: "Automatically block IPs that trigger threat thresholds", type: "toggle" },
  admin_probe_threshold: { label: "Admin Probe Threshold", desc: "Failed admin/kernel hits within window before auto-block", type: "number" },
  suspicious_probe_threshold: { label: "Suspicious Probe Threshold", desc: "Suspicious path probes within window before auto-block", type: "number" },
  probe_window_minutes: { label: "Probe Window (minutes)", desc: "Time window for counting probes", type: "number" },
  event_retention_days: { label: "Event Retention (days)", desc: "Days to keep security events before auto-purge", type: "number" },
}

export default function KernelSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [dirty, setDirty] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/kernel/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setDirty({})
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSettings() }, [])

  const update = (key: string, value: string) => {
    setDirty((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  const save = async (key: string) => {
    const value = dirty[key]
    if (value === undefined) return
    setSaving(key)
    setMessage(null)
    try {
      const res = await fetch("/api/kernel/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)?.[1] ?? "" },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSettings(updated)
        setDirty((prev) => { const { [key]: _, ...rest } = prev; return rest })
        setMessage({ type: "success", text: `${SETTING_META[key]?.label || key} updated` })
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to save" }))
        setMessage({ type: "error", text: err.error || "Failed to save" })
      }
    } catch {
      setMessage({ type: "error", text: "Network error" })
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
        <CardContent className="p-8 text-center text-gray-400 dark:text-zinc-600 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
        </CardContent>
      </Card>
    )
  }

  const current = { ...settings, ...dirty }

  return (
    <Card className="bg-white border-gray-200 dark:bg-zinc-900/60 dark:border-zinc-800">
      <CardHeader className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sliders className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
          Security Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {message && (
          <div className={cn(
            "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border",
            message.type === "success" ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900/40" :
            "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/40"
          )}>
            {message.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

        {Object.entries(SETTING_META).map(([key, meta]) => {
          const isDirty = key in dirty
          const val = current[key] ?? ""

          return (
            <div key={key} className="flex items-start justify-between gap-4 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">{meta.label}</span>
                  {isDirty && <span className="text-[10px] text-orange-500 font-mono">modified</span>}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">{meta.desc}</p>
                <div className="mt-2">
                  {meta.type === "toggle" ? (
                    <button
                      onClick={() => update(key, val === "true" ? "false" : "true")}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        val === "true" ? "bg-green-600" : "bg-gray-300 dark:bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        val === "true" ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => update(key, e.target.value)}
                        className="w-24 h-8 text-xs font-mono rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-gray-900 dark:text-white px-2.5"
                        min="1"
                      />
                      {isDirty && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-mono">was {settings[key]}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {isDirty && (
                  <Button
                    size="sm"
                    onClick={() => save(key)}
                    disabled={saving === key}
                    className="h-8 text-xs bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                  >
                    {saving === key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    Save
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
