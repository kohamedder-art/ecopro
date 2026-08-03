import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, HeartPulse, Database, Activity, Cpu, MemoryStick, Users, Server, HardDrive, Wifi, Clock, AlertTriangle } from 'lucide-react';

interface ServerHealth {
  ok: boolean;
  uptimeSec: number;
  node: { version: string; pid: number; env?: string };
  process: { memory: { rss: number; heapUsed: number; heapTotal: number }; cpu: { user: number; system: number } };
  os: { platform: string; arch: string; loadavg: number[]; totalmem: number; freemem: number; hostname: string; cpuModel?: string; cpuCount?: number };
  htop?: { cpu?: { totalPct?: number }; memory?: { pctUsed?: number; usedBytes?: number; totalBytes?: number } };
  cgroup?: { cpu?: { cpus?: number }; memory?: { limitBytes?: number } };
  derived?: { rssPctOfLimit?: number; heapPctOfHeapTotal?: number; memoryLimitBytes?: number };
  eventLoop?: { utilization?: number; active?: number; idle?: number };
  disk?: { uploads?: { total?: number; available?: number; used?: number } };
  network?: { totals?: { rxBps?: number; txBps?: number } };
  db: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
    pool?: { totalCount?: number; idleCount?: number; waitingCount?: number };
    render?: { cpuPercentage?: number; memoryPct?: number; memoryMB?: number; connectionsActive?: number; connectionsMax?: number; latencyMs50?: number; latencyMs95?: number; diskUsedMb?: number; diskCapacityMb?: number; replicationLag?: number; pgVersion?: string };
  };
  service?: { serviceName?: string; cpuPct?: number; memoryPct?: number; memoryMb?: number; instanceCount?: number; bandwidthBps?: number; latestDeployStatus?: string; latestDeployDuration?: number; latestDeployAt?: string };
  users?: { total?: number; recent15m?: number };
  alerts?: string[];
  recommendations?: { severity: string; code: string; message: string }[];
  trend?: { points: number; series: { dbLatencyMs?: number; rssPct?: number; elu?: number; load1PerCpu?: number; heapPct?: number }[]; summary?: any };
  thresholds?: any;
}

interface ActiveUsers {
  active?: { total?: number; authenticated?: number; anonymous?: number; breakdown?: { admins?: number; clients?: number; visitors?: number } };
  traffic?: { requestsPerSecond?: number };
  visitors?: { displayName?: string; requestCount?: number; activeFor?: number }[];
}

function formatBytes(b: number): string {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(0) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
  return b + ' B';
}

function formatBps(bps: number | null): string {
  if (bps == null) return '-';
  if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(1) + ' Mbps';
  if (bps >= 1_000) return (bps / 1_000).toFixed(1) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function safeMinMax(vals: number[]): { min: number; max: number } {
  if (vals.length === 0) return { min: 0, max: 1 };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] < min) min = vals[i];
    if (vals[i] > max) max = vals[i];
  }
  return { min, max };
}

function Sparkline({ data, color, w = 120, h = 32 }: { data: (number | null)[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(v => v ?? 0);
  const { min: mn, max: mx } = safeMinMax(vals);
  const range = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - mn) / range) * (h - 4) - 2}`).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <polyline points={fillPts} fill={`${color}15`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  );
}

function getHealthColor(pct: number | null, warn = 50, crit = 80): string {
  if (pct == null) return '#94a3b8';
  if (pct > crit) return '#ef4444';
  if (pct > warn) return '#f59e0b';
  return '#22c55e';
}

function GaugeBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      {label && <div className="flex justify-between text-[9px] font-mono text-gray-500 dark:text-slate-500 mb-0.5"><span>{label}</span><span style={{ color }}>{pct.toFixed(1)}%</span></div>}
      <div className="h-1.5 bg-gray-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function HealthTab() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsers | null>(null);
  const [capacity, setCapacity] = useState<any>(null);
  const aliveRef = useRef(true);

  const fetchHealth = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (aliveRef.current) setHealth(data);
    } catch (e: any) {
      if (aliveRef.current) setError(e?.message || 'Failed to load');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/active-users?window=30&details=true');
      if (res.ok && aliveRef.current) setActiveUsers(await res.json());
    } catch {}
  }, []);

  const fetchCapacity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/capacity');
      if (res.ok && aliveRef.current) setCapacity(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    fetchHealth(true);
    fetchActiveUsers();
    fetchCapacity();

    const healthId = setInterval(() => fetchHealth(), 5000);
    const usersId = setInterval(() => fetchActiveUsers(), 5000);
    const capId = setInterval(() => fetchCapacity(), 15000);

    return () => {
      aliveRef.current = false;
      clearInterval(healthId);
      clearInterval(usersId);
      clearInterval(capId);
    };
  }, [fetchHealth, fetchActiveUsers, fetchCapacity]);

  if (!health) {
    return (
      <div className="flex items-center justify-center py-20">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading server health...</span>
          </div>
        ) : error ? (
          <div className="text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => fetchHealth(true)} className="text-xs text-blue-400 hover:text-blue-300 underline">Retry</button>
          </div>
        ) : null}
      </div>
    );
  }

  const cpuPct = health.htop?.cpu?.totalPct ?? null;
  const rssPct = health.derived?.rssPctOfLimit ?? null;
  const dbMs = health.db.latencyMs ?? null;
  const eluPct = health.eventLoop?.utilization != null ? health.eventLoop.utilization * 100 : null;
  const heapPct = health.derived?.heapPctOfHeapTotal ?? null;
  const load1 = health.os.loadavg?.[0] ?? null;
  const cpuCount = health.os.cpuCount ?? 1;
  const loadPerCpu = load1 != null ? load1 / cpuCount : null;
  const activeNow = activeUsers?.active?.total ?? 0;
  const trend = health.trend?.series;

  const isDegraded = !health.db.ok;
  const statusColor = isDegraded ? '#f59e0b' : '#22c55e';
  const statusText = isDegraded ? 'DEGRADED' : 'OPERATIONAL';
  const alerts = health.alerts ?? [];

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-50 border border-red-200 dark:border-red-200 rounded-xl p-3 text-red-700 dark:text-red-600 text-xs font-medium">{error}</div>
      )}

      {/* ── Status Header ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${statusColor}15` }}>
              <HeartPulse className="w-5 h-5" style={{ color: statusColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Server Health</h2>
                <StatusDot color={statusColor} />
                <span className="text-[10px] font-bold font-mono tracking-wider" style={{ color: statusColor }}>{statusText}</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-500 font-mono mt-0.5">
                Uptime {formatDuration(health.uptimeSec)} · Node v{health.node.version} · {health.os.platform}/{health.os.arch}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-50 text-amber-600 dark:text-amber-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-200">
                <AlertTriangle className="w-3 h-3" /> {alerts.length}
              </span>
            )}
            <button onClick={() => fetchHealth(true)} disabled={loading}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick status row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          {[
            { label: 'CPU', value: cpuPct != null ? `${cpuPct.toFixed(1)}%` : '-', color: getHealthColor(cpuPct) },
            { label: 'RAM', value: rssPct != null ? `${rssPct.toFixed(1)}%` : '-', color: getHealthColor(rssPct) },
            { label: 'DB', value: dbMs != null ? `${dbMs.toFixed(0)}ms` : '-', color: getHealthColor(dbMs, 200, 500) },
            { label: 'Load', value: loadPerCpu != null ? loadPerCpu.toFixed(2) : '-', color: getHealthColor(loadPerCpu != null ? loadPerCpu * 100 : null, 70, 100) },
            { label: 'ELU', value: eluPct != null ? `${eluPct.toFixed(1)}%` : '-', color: getHealthColor(eluPct, 48, 80) },
            { label: 'Active', value: `${activeNow}`, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              <span className="text-gray-500 dark:text-slate-500">{s.label}</span>
              <span className="font-bold text-gray-900 dark:text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'CPU', icon: <Cpu className="w-3.5 h-3.5" />, value: cpuPct?.toFixed(1) ?? '-', unit: '%', color: getHealthColor(cpuPct), sub: `${health.os.cpuModel?.split(' ')[0] ?? ''} ×${cpuCount}`, spark: trend?.map(s => s.load1PerCpu != null ? s.load1PerCpu * 100 : null) ?? [], sparkColor: '#3b82f6' },
          { label: 'MEMORY', icon: <MemoryStick className="w-3.5 h-3.5" />, value: rssPct?.toFixed(1) ?? '-', unit: '%', color: getHealthColor(rssPct), sub: `${formatBytes(health.process.memory.rss)} / ${formatBytes(health.derived?.memoryLimitBytes ?? health.os.totalmem)}`, spark: trend?.map(s => s.rssPct) ?? [], sparkColor: '#22c55e' },
          { label: 'DATABASE', icon: <Database className="w-3.5 h-3.5" />, value: dbMs?.toFixed(0) ?? '-', unit: 'ms', color: getHealthColor(dbMs, 200, 500), sub: `pool ${health.db.pool?.totalCount ?? '-'} · wait ${health.db.pool?.waitingCount ?? 0}`, spark: trend?.map(s => s.dbLatencyMs) ?? [], sparkColor: '#a855f7' },
          { label: 'USERS', icon: <Users className="w-3.5 h-3.5" />, value: `${activeNow}`, unit: '', color: '#22c55e', sub: `${health.users?.total ?? 0} registered · ${health.users?.recent15m ?? 0} recent` },
        ].map(m => (
          <div key={m.label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700/60 p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${m.color}12`, color: m.color }}>{m.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-500">{m.label}</span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-white font-mono">{m.value}<span className="text-xs font-normal text-gray-400 dark:text-slate-400 ml-0.5">{m.unit}</span></div>
            <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5 truncate">{m.sub}</p>
            {m.spark && m.spark.length > 1 && (
              <div className="mt-2 h-7 -mx-1"><Sparkline data={m.spark} color={m.sparkColor} /></div>
            )}
          </div>
        ))}
      </div>

      {/* ── Database + Web Service ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Database */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Database</h3>
            {health.db.render?.pgVersion && <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono ml-auto">PG {health.db.render.pgVersion}</span>}
          </div>
          {health.db.render ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <GaugeBar value={health.db.render.cpuPercentage ?? 0} max={100} color={getHealthColor(health.db.render.cpuPercentage ?? null)} label="CPU" />
                </div>
                <div>
                  <GaugeBar value={health.db.render.memoryPct ?? 0} max={100} color={getHealthColor(health.db.render.memoryPct ?? null)} label="RAM" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 dark:text-white font-bold">{health.db.render.connectionsActive ?? '-'}/{health.db.render.connectionsMax ?? '?'}</div>
                  <div className="text-gray-500 dark:text-slate-500">Connections</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 dark:text-white font-bold">{health.db.render.latencyMs50?.toFixed(0) ?? '-'}ms</div>
                  <div className="text-gray-500 dark:text-slate-500">p50</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 dark:text-white font-bold">{health.db.render.latencyMs95?.toFixed(0) ?? '-'}ms</div>
                  <div className="text-gray-500 dark:text-slate-500">p95</div>
                </div>
              </div>
              {health.db.render.diskUsedMb != null && health.db.render.diskCapacityMb != null && (
                <GaugeBar value={health.db.render.diskUsedMb} max={health.db.render.diskCapacityMb} color={getHealthColor(null, 70, 85)} label={`Disk ${formatBytes(health.db.render.diskUsedMb * 1048576)} / ${formatBytes(health.db.render.diskCapacityMb * 1048576)}`} />
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Set RENDER_API_KEY + RENDER_DATABASE_ID</p>
          )}
        </div>

        {/* Web Service */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Web Service</h3>
            {health.service?.serviceName && <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono ml-auto truncate max-w-[180px]" title={health.service.serviceName}>{health.service.serviceName}</span>}
          </div>
          {health.service ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <GaugeBar value={health.service.cpuPct ?? 0} max={100} color={getHealthColor(health.service.cpuPct ?? null)} label="CPU" />
                </div>
                <div>
                  <GaugeBar value={health.service.memoryPct ?? 0} max={100} color={getHealthColor(health.service.memoryPct ?? null)} label="RAM" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 dark:text-white font-bold">{health.service.instanceCount ?? '-'}</div>
                  <div className="text-gray-500 dark:text-slate-500">Instances</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 dark:text-white font-bold">{formatBps(health.service.bandwidthBps)}</div>
                  <div className="text-gray-500 dark:text-slate-500">Bandwidth</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                  <div className={`font-bold ${health.service.latestDeployStatus === 'live' ? 'text-emerald-500' : 'text-amber-500'}`}>{health.service.latestDeployStatus ?? '-'}</div>
                  <div className="text-gray-500 dark:text-slate-500">Deploy</div>
                </div>
              </div>
              {health.service.latestDeployAt && (
                <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                  Last deploy: {new Date(health.service.latestDeployAt).toLocaleString()} · {health.service.latestDeployDuration?.toFixed(0)}s
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Set RENDER_API_KEY + RENDER_SERVICE_ID</p>
          )}
        </div>
      </div>

      {/* ── More Metrics + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Extra metrics */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">System Metrics</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Event Loop', value: eluPct?.toFixed(1) ?? '-', unit: '%', color: getHealthColor(eluPct, 48, 80), spark: trend?.map(s => s.elu != null ? s.elu * 100 : null) ?? [], sparkColor: '#f59e0b' },
              { label: 'Heap', value: heapPct?.toFixed(1) ?? '-', unit: '%', color: getHealthColor(heapPct, 70, 90), sub: `${formatBytes(health.process.memory.heapUsed)} / ${formatBytes(health.process.memory.heapTotal)}`, spark: trend?.map(s => s.heapPct) ?? [], sparkColor: '#f59e0b' },
              { label: 'Disk', value: health.disk?.uploads ? `${((1 - (health.disk.uploads.available ?? 0) / (health.disk.uploads.total || 1)) * 100).toFixed(1)}` : '-', unit: '%', color: getHealthColor(health.disk?.uploads ? (1 - (health.disk.uploads.available ?? 0) / (health.disk.uploads.total || 1)) * 100 : null, 70, 85), sub: health.disk?.uploads ? `${formatBytes(health.disk.uploads.available)} free` : '' },
              { label: 'Network', value: health.network?.totals ? (((health.network.totals.rxBps ?? 0) + (health.network.totals.txBps ?? 0)) * 8 / 1_000_000).toFixed(1) : '-', unit: 'Mbps', color: '#6366f1', sub: health.network?.totals ? `RX ${formatBps(health.network.totals.rxBps)} / TX ${formatBps(health.network.totals.txBps)}` : '' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-1">{m.label}</div>
                <div className="text-lg font-black text-gray-900 dark:text-white font-mono">{m.value}<span className="text-[10px] font-normal text-gray-400 dark:text-slate-400 ml-0.5">{m.unit}</span></div>
                {m.sub && <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{m.sub}</div>}
                {m.spark && m.spark.length > 1 && <div className="mt-1.5 h-6"><Sparkline data={m.spark} color={m.sparkColor} /></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Alerts</h3>
            {alerts.length > 0 && <span className="ml-auto bg-red-50 dark:bg-red-50 text-red-600 dark:text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{alerts.length}</span>}
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-1.5">
              {alerts.slice(0, 6).map((a, i) => (
                <div key={i} className="text-[10px] font-mono bg-red-50 dark:bg-red-50 text-red-600 dark:text-red-500 rounded-lg px-2 py-1.5 border border-red-100 dark:border-red-100">{a}</div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-2xl mb-1">&#10003;</div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500">No active alerts</p>
            </div>
          )}
          {health.recommendations && health.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">Recommendations</div>
              {health.recommendations.slice(0, 3).map((r, i) => (
                <div key={i} className={`text-[10px] leading-tight mb-1 ${r.severity === 'critical' ? 'text-red-500' : r.severity === 'warn' ? 'text-amber-500' : 'text-gray-500 dark:text-slate-400'}`}>
                  [{r.code}] {r.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Active Users ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Active Users</h3>
          <StatusDot color="#22c55e" />
          <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 font-mono">LIVE</span>
        </div>
        {activeUsers ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'ACTIVE', value: activeUsers.active?.total ?? 0, color: '#22c55e', border: 'border-emerald-200 dark:border-emerald-500/20' },
                { label: 'LOGGED IN', value: activeUsers.active?.authenticated ?? 0, color: '#3b82f6', border: 'border-blue-200 dark:border-blue-500/20' },
                { label: 'VISITORS', value: activeUsers.active?.anonymous ?? 0, color: '#64748b', border: 'border-gray-200 dark:border-slate-600/30' },
                { label: 'REQ/S', value: activeUsers.traffic?.requestsPerSecond ?? 0, color: '#f59e0b', border: 'border-amber-200 dark:border-amber-500/20' },
              ].map(s => (
                <div key={s.label} className={`text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border ${s.border}`}>
                  <div className="text-xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
            {activeUsers.active?.breakdown && (
              <div className="flex gap-4 text-[10px] font-mono text-gray-500 dark:text-slate-500">
                <span>admins <span className="text-purple-500 dark:text-purple-400 font-bold">{activeUsers.active.breakdown.admins ?? 0}</span></span>
                <span>clients <span className="text-cyan-500 dark:text-cyan-400 font-bold">{activeUsers.active.breakdown.clients ?? 0}</span></span>
                <span>other <span className="text-gray-400 dark:text-slate-400 font-bold">{activeUsers.active.breakdown.visitors ?? 0}</span></span>
              </div>
            )}
            {activeUsers.visitors && activeUsers.visitors.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {activeUsers.visitors.filter((v: any) => v.displayName).slice(0, 8).map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[9px] font-mono text-gray-500 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/30 rounded-lg px-2.5 py-1">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{v.displayName}</span>
                    <span>{v.requestCount} req · {v.activeFor}s</span>
                  </div>
                ))}
              </div>
            )}
            {capacity && (
              <div>
                <div className="flex justify-between text-[9px] font-mono text-gray-500 dark:text-slate-500 mb-0.5">
                  <span>Capacity</span>
                  <span><span className="text-emerald-500 dark:text-emerald-400 font-bold">{activeUsers.active?.total ?? 0}</span> / {capacity.capacity?.estimated?.toLocaleString() ?? '?'}</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((activeUsers.active?.total ?? 0) / (capacity.capacity?.estimated ?? 1)) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center py-4">Loading active users...</p>
        )}
      </div>

      {/* ── Trend Sparklines ── */}
      {trend && trend.length > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Trends</h3>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono ml-auto">{health.trend?.points ?? 0} points</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'DB Latency', data: trend.map(s => s.dbLatencyMs), color: '#a855f7' },
              { label: 'Memory', data: trend.map(s => s.rssPct), color: '#22c55e' },
              { label: 'Event Loop', data: trend.map(s => s.elu != null ? s.elu * 100 : null), color: '#f59e0b' },
              { label: 'Load/CPU', data: trend.map(s => s.load1PerCpu != null ? s.load1PerCpu * 100 : null), color: '#3b82f6' },
            ].map(t => (
              <div key={t.label}>
                <div className="text-[9px] font-bold text-gray-500 dark:text-slate-500 mb-1">{t.label}</div>
                <div className="h-8 bg-gray-50 dark:bg-slate-800/30 rounded-lg p-1"><Sparkline data={t.data as any} color={t.color} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
