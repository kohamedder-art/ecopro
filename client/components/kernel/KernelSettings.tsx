import { useState, useEffect } from "react"
import { Sliders, Save, Loader2, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Settings = Record<string, string>

const SETTING_META: Record<string, { label: string; desc: string; type: "toggle" | "number" }> = {
  auto_block_enabled: { label: "Auto-Blocking", desc: "Automatically block IPs that trigger threat thresholds", type: "toggle" },
  admin_probe_threshold: { label: "Admin Probe Threshold", desc: "Failed admin/kernel hits before auto-block", type: "number" },
  suspicious_probe_threshold: { label: "Suspicious Probe Threshold", desc: "Suspicious path probes before auto-block", type: "number" },
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
      if (res.ok) { const data = await res.json(); setSettings(data); setDirty({}) }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchSettings() }, [])

  const update = (key: string, value: string) => { setDirty((prev) => ({ ...prev, [key]: value })); setMessage(null) }

  const save = async (key: string) => {
    const value = dirty[key]
    if (value === undefined) return
    setSaving(key); setMessage(null)
    try {
      const res = await fetch("/api/kernel/settings", {
        method: "PUT", headers: { "Content-Type": "application/json", "X-CSRF-Token": document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/)?.[1] ?? "" },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSettings(updated)
        const { [key]: _, ...rest } = dirty; setDirty(rest)
        setMessage({ type: "success", text: `${SETTING_META[key]?.label || key} updated` })
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to save" }))
        setMessage({ type: "error", text: err.error || "Failed to save" })
      }
    } catch { setMessage({ type: "error", text: "Network error" }) } finally { setSaving(null) }
  }

  if (loading) return <div className="k-card rounded-xl k-card-glow p-8 text-center k-dim text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin k-a-green" />Loading settings...</div>

  const current = { ...settings, ...dirty }

  return (
    <div className="k-card rounded-xl k-card-glow">
      <div className="px-4 py-3 border-b k-bdr flex items-center gap-2">
        <Sliders className="w-4 h-4 k-dim" />
        <span className="text-sm font-medium k-text">Security Settings</span>
      </div>
      <div className="p-4 space-y-4">
        {message && (
          <div className={cn("flex items-center gap-2 text-sm px-3 py-2 rounded-lg border", message.type === "success" ? "k-a-green" : "k-a-red")}>
            {message.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}
        {Object.entries(SETTING_META).map(([key, meta]) => {
          const isDirty = key in dirty
          const val = current[key] ?? ""
          return (
            <div key={key} className="flex items-start justify-between gap-4 p-3 rounded-xl border k-bg2 k-bdr">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium k-text">{meta.label}</span>
                  {isDirty && <span className="text-[10px] k-mono k-a-amber">modified</span>}
                </div>
                <p className="text-[11px] k-dim mt-0.5">{meta.desc}</p>
                <div className="mt-2">
                  {meta.type === "toggle" ? (
                    <button onClick={() => update(key, val === "true" ? "false" : "true")}
                      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", val === "true" ? "bg-emerald-500" : "bg-gray-600")}
                    ><span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", val === "true" ? "translate-x-6" : "translate-x-1")} /></button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" value={val} onChange={(e) => update(key, e.target.value)}
                        className="k-input w-24 h-8 text-xs rounded-md px-2.5 k-mono" min="1" />
                      {isDirty && <span className="text-[10px] k-dim k-mono">was {settings[key]}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {isDirty && (
                  <button onClick={() => save(key)} disabled={saving === key}
                    className="k-btn k-btn-primary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                  >{saving === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
