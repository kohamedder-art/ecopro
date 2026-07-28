export type SecurityEvent = {
  id: number
  created_at: string
  event_type: string
  severity: string
  method: string | null
  path: string | null
  status_code: number | null
  ip: string | null
  country_code: string | null
  fingerprint: string | null
  user_agent: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
}

export type SummaryData = {
  events_today: number
  blocked_ips: number
  active_threats: number
  watchlist_count: number
  top_countries: { country_code: string; count: number }[]
  threatCounts?: { total: number; real_threats: number; probes: number; info: number; scanner_noise: number }
}

export type BlockEntry = {
  id: number
  ip: string
  reason: string | null
  blocked_at: string
  expires_at: string | null
  country_code: string | null
}
