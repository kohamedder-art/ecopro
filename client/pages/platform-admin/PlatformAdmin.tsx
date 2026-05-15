import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { removeAuthToken } from '@/lib/auth';
import {
  Activity,
  AlertCircle,
  Brain,
  AlertTriangle,
  Award,
  Ban,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  Gauge,
  Gift,
  HeartPulse,
  Loader2,
  Lock,
  LogOut,
  MemoryStick,
  Package,
  PieChart as PieChartIcon,
  Pin,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  StickyNote,
  Store,
  Trash2,
  TrendingUp,
  Unlock,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { GradientCard } from '@/components/ui/GradientCard';
import { Button } from '@/components/ui/button';
import BigCarGauge from '@/components/platform-admin/BigCarGauge';
import GlobalAnnouncementsManager from '@/components/platform-admin/GlobalAnnouncementsManager';
import AdminAffiliatesPage from '@/pages/platform-admin/AdminAffiliatesPage';
import Header from '@/components/layout/Header';
import OverviewTab from '@/components/platform-admin/tabs/OverviewTab';
import UsersTab from '@/components/platform-admin/tabs/UsersTab';
import StoresTab from '@/components/platform-admin/tabs/StoresTab';
import ProductsTab from '@/components/platform-admin/tabs/ProductsTab';
import ErrorsTab from '@/components/platform-admin/tabs/ErrorsTab';
import SubscriptionsTab from '@/components/platform-admin/tabs/SubscriptionsTab';
import CodesTab from '@/components/platform-admin/tabs/CodesTab';
import AITab from '@/components/platform-admin/tabs/AITab';
import ToolsTab from '@/components/platform-admin/tabs/ToolsTab';
import SettingsTab from '@/components/platform-admin/tabs/SettingsTab';
import NotesTab from '@/components/platform-admin/tabs/NotesTab';
import BillsTab from '@/components/platform-admin/tabs/BillsTab';

interface AdminNote {
  id: number;
  admin_id: number;
  title: string;
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'red' | 'purple';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface PlatformStats {
  totalUsers: number;
  totalClients: number;
  totalAdmins: number;
  lockedAccounts: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  totalCodes: number;
  redeemedCodes: number;
  pendingCodes: number;
  expiredCodes: number;
  newSignupsWeek: number;
  newSignupsMonth: number;
  totalProducts?: number;
}

interface ServerHealth {
  ok: boolean;
  timestamp: string;
  uptimeSec: number;
  htop?: {
    cpu?: {
      totalPct: number | null;
      perCorePct: number[] | null;
      intervalMs: number | null;
      mode: 'delta' | 'avg' | 'cgroup' | null;
    };
    memory?: {
      totalBytes: number;
      usedBytes: number;
      availableBytes: number;
      pctUsed: number;
    };
    swap?: {
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      pctUsed: number;
    } | null;
  };
  node: {
    version: string;
    env: string | null;
    pid: number;
    ppid: number;
    versions: Record<string, string>;
  };
  process: {
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers?: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
    resourceUsage?: any;
    heap?: {
      statistics: any;
      spaces: any;
    };
  };
  os: {
    platform: string;
    arch: string;
    loadavg: number[];
    totalmem: number;
    freemem: number;
    uptime: number;
    cpuCount: number | null;
    hostname?: string;
    cpuModel?: string | null;
    cpuSpeedMhz?: number | null;
  };
  cgroup?: {
    memoryLimitBytes?: number | null;
    cpu?: {
      quota: number | null;
      period: number | null;
      cpus: number | null;
    };
  };
  derived?: {
    memoryLimitBytes: number;
    rssPctOfLimit: number | null;
    heapPctOfHeapTotal: number | null;
    loadPerCpu: number[] | null;
  };
  eventLoop?: {
    utilization: number;
    active: number;
    idle: number;
  };
  disk?: {
    cwd?: { path: string; total: number | null; free: number | null; available: number | null };
    uploads?: { path: string; total: number | null; free: number | null; available: number | null };
  };
  network?: {
    interfaces?: Array<{
      name: string;
      addresses: number;
      internal: boolean;
      rxBytes?: number | null;
      txBytes?: number | null;
      rxBps?: number | null;
      txBps?: number | null;
    }>;
    totals?: {
      rxBps: number | null;
      txBps: number | null;
      intervalSec: number | null;
    };
  };
  db: {
    ok: boolean;
    latencyMs: number | null;
    error: string | null;
    pool?: {
      totalCount: number | null;
      idleCount: number | null;
      waitingCount: number | null;
    };
    render?: {
      connectionsActive: number | null;
      connectionsMax: number | null;
      cpuPercentage: number | null;
      memoryMB: number | null;
      memoryPct: number | null;
      readIOPS: number | null;
      writeIOPS: number | null;
      pgVersion: string | null;
      pgPlan: string | null;
      pgRegion: string | null;
      latencyMs50: number | null;
      latencyMs95: number | null;
      diskUsedMb: number | null;
      diskCapacityMb: number | null;
      diskUsedPct: number | null;
      txVolume: number | null;
      replicationLag: number | null;
      latestBackupAt: string | null;
    } | null;
  };
  service?: {
    serviceId: string | null;
    serviceName: string | null;
    serviceType: string | null;
    serviceRegion: string | null;
    cpuPct: number | null;
    memoryMb: number | null;
    memoryPct: number | null;
    bandwidthBps: number | null;
    latestDeployDuration: number | null;
    latestDeployAt: string | null;
    latestDeployStatus: string | null;
    instanceCount: number | null;
  } | null;
  users?: {
    total: number;
    recent15m: number;
  };
  alerts?: string[];
  thresholds?: {
    dbSlowMs: number;
    memoryHighPct: number;
    eventLoopHighUtil: number;
    cpuPressureLoadPerCpu: number;
  };
  recommendations?: Array<{ severity: 'info' | 'warn' | 'critical'; code: string; message: string }>;
  trend?: {
    windowSec: number;
    points: number;
    fromTs: number | null;
    toTs: number | null;
    series: Array<{
      ts: number;
      rssPct: number | null;
      heapPct: number | null;
      elu: number;
      dbLatencyMs: number | null;
      load1PerCpu: number | null;
      dbPoolWaiting: number | null;
    }>;
    summary: {
      rssPct: { min: number | null; avg: number | null; max: number | null };
      heapPct: { min: number | null; avg: number | null; max: number | null };
      elu: { min: number | null; avg: number | null; max: number | null };
      dbLatencyMs: { min: number | null; avg: number | null; max: number | null };
      load1PerCpu: { min: number | null; avg: number | null; max: number | null };
      dbPoolWaiting: { min: number | null; avg: number | null; max: number | null };
    };
    delta: {
      rssPct: number | null;
      heapPct: number | null;
      elu: number | null;
      dbLatencyMs: number | null;
      load1PerCpu: number | null;
      dbPoolWaiting: number | null;
    };
  };
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  user_type: string;
  created_at: string;
  is_super?: boolean;
}

interface Product {
  id: number;
  title: string;
  price: number;
  seller_name: string;
  seller_email: string;
  status: string;
  views: number;
  created_at: string;
  images?: string[];
  flagged?: boolean;
  flag_reason?: string;
}

interface ActivityLog {
  id: number;
  client_id: number;
  staff_id?: number;
  action: string;
  resource_type: string;
  timestamp: string;
}

interface AdminAuditLog {
  id: number;
  actor_id: number;
  action: string;
  target_type: string;
  target_id?: number | null;
  details?: any;
  created_at: string;
}

interface Store {
  id: number;
  email: string;
  store_name: string;
  store_slug: string;
  subscription_status?: string;
  paid_until?: string;
  created_at: string;
}

interface StaffMember {
  id: number;
  store_id: number;
  email: string;
  role: string;
  status: string;
  store_name: string;
  owner_email: string;
  created_at: string;
}

interface LockedAccount {
  id: number;
  email: string;
  name: string;
  is_locked: boolean;
  locked_reason?: string;
  locked_at?: string;
  unlock_reason?: string;
  unlocked_at?: string;
  is_paid_temporarily?: boolean;
  subscription_extended_until?: string;
  subscription_ends_at?: string;
  subscription_status?: string;
  trial_ends_at?: string;
  current_period_end?: string;
  created_at: string;
}

// Locked Accounts Manager Component - Subscription Lock Management
function LockedAccountsManager() {
  const { t } = useTranslation();
  const [allAccounts, setAllAccounts] = useState<LockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'unlock' | 'lock'>('unlock');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'extend' | 'mark_paid'>('extend');
  const [extendDays, setExtendDays] = useState(30);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'locked' | 'active' | 'expiring' | 'hackers'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickProcessing, setQuickProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchAllAccounts();
  }, []);

  // Re-render periodically so countdown labels (e.g. "30d left") update.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  async function fetchAllAccounts() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/locked-accounts');
      const data = await response.json();
      setAllAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      alert(t('platformAdmin.alerts.failedFetchAccounts'));
    } finally {
      setLoading(false);
    }
  }

  // Calculate days until subscription ends
  const getDaysLeft = (account: LockedAccount) => {
    const endDate = account.subscription_extended_until || account.subscription_ends_at;
    if (!endDate) return null;
    const endMs = new Date(endDate).getTime();
    if (!Number.isFinite(endMs)) return null;
    const days = Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
    return days;
  };

  // Filter accounts
  const filteredAccounts = allAccounts.filter(acc => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!acc.email.toLowerCase().includes(query) && !acc.name?.toLowerCase().includes(query)) {
        return false;
      }
    }
    // Status filter
    if (filterStatus === 'all') return true;
    if (filterStatus === 'locked') return acc.is_locked && !acc.locked_reason?.includes('HONEYPOT');
    if (filterStatus === 'active') return !acc.is_locked;
    if (filterStatus === 'expiring') {
      const days = getDaysLeft(acc);
      return days !== null && days <= 7 && days > 0 && !acc.is_locked;
    }
    if (filterStatus === 'hackers') return acc.locked_reason?.includes('HONEYPOT');
    return true;
  });

  const lockedCount = allAccounts.filter(a => a.is_locked && !a.locked_reason?.includes('HONEYPOT')).length;
  const activeCount = allAccounts.filter(a => !a.is_locked).length;
  const expiringCount = allAccounts.filter(a => {
    const days = getDaysLeft(a);
    return days !== null && days <= 7 && days > 0 && !a.is_locked;
  }).length;
  const hackerCount = allAccounts.filter(a => a.locked_reason?.includes('HONEYPOT')).length;

  // Quick unlock single account
  async function quickUnlock(accountId: number) {
    setQuickProcessing(accountId);
    try {
      const response = await fetch('/api/admin/unlock-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: accountId,
          unlock_reason: 'Quick unlock from admin panel',
          action: 'extend',
          days: 30
        })
      });
      if (response.ok) {
        await fetchAllAccounts();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(t('platformAdmin.alerts.errorUnlocking'));
    } finally {
      setQuickProcessing(null);
    }
  }

  // Quick lock single account
  async function quickLock(accountId: number) {
    const lockReason = prompt(t('platformAdmin.alerts.enterLockReason'));
    if (!lockReason) return;
    
    setQuickProcessing(accountId);
    try {
      const response = await fetch('/api/admin/lock-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: accountId,
          reason: lockReason
        })
      });
      if (response.ok) {
        await fetchAllAccounts();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(t('platformAdmin.alerts.errorLocking'));
    } finally {
      setQuickProcessing(null);
    }
  }

  async function handleProcess() {
    if (selectedAccounts.length === 0) {
      alert(t('platformAdmin.alerts.selectAccounts'));
      return;
    }

    if (!reason.trim()) {
      alert(t('platformAdmin.alerts.enterReason'));
      return;
    }

    setProcessing(true);
    try {
      for (const clientId of selectedAccounts) {
        const endpoint = modalMode === 'unlock' ? '/api/admin/unlock-account' : '/api/admin/lock-account';
        const body = modalMode === 'unlock'
          ? {
              client_id: clientId,
              unlock_reason: reason,
              action,
              days: action === 'extend' ? extendDays : undefined
            }
          : {
              client_id: clientId,
              reason
            };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          const error = await response.json();
          alert(`Failed: ${error.error || 'Unknown error'}`);
          return;
        }
      }

      alert(modalMode === 'unlock' ? t('platformAdmin.alerts.successUnlocked', { count: selectedAccounts.length }) : t('platformAdmin.alerts.successLocked', { count: selectedAccounts.length }));
      setSelectedAccounts([]);
      setReason('');
      setShowModal(false);
      await fetchAllAccounts();
    } catch (err) {
      alert(t('platformAdmin.alerts.failedProcess'));
    } finally {
      setProcessing(false);
    }
  }

  function toggleSelectAll() {
    if (selectedAccounts.length === filteredAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(filteredAccounts.map(a => a.id));
    }
  }

  function toggleSelect(id: number) {
    setSelectedAccounts(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 'clamp(3rem, 8vh, 5rem)' }}>
        <div className="animate-spin">
          <Zap className="text-amber-400" style={{ width: 'clamp(2rem, 4vh, 3rem)', height: 'clamp(2rem, 4vh, 3rem)' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1rem, 2vh, 1.5rem)' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-xl border border-amber-500/20"
        style={{ padding: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <h2 className="font-bold text-amber-300 flex items-center" style={{ fontSize: 'clamp(1.25rem, 2.5vh, 1.5rem)', gap: 'clamp(0.5rem, 1vh, 0.75rem)', marginBottom: 'clamp(0.375rem, 0.75vh, 0.5rem)' }}>
          <Lock style={{ width: 'clamp(1.25rem, 2.5vh, 1.5rem)', height: 'clamp(1.25rem, 2.5vh, 1.5rem)' }} />
          {t('platformAdmin.subscription.title')}
        </h2>
        <p className="text-amber-200/80" style={{ fontSize: 'clamp(0.875rem, 1.75vh, 1rem)' }}>
          {t('platformAdmin.subscription.desc')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
        <div className="bg-white/40 dark:bg-slate-800/40 rounded-lg border border-gray-200/50 dark:border-slate-700/50" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="text-gray-500 dark:text-slate-400" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>{t('platformAdmin.subscription.total')}</div>
          <div className="font-bold text-gray-900 dark:text-white" style={{ fontSize: 'clamp(1.5rem, 3vh, 2rem)' }}>{allAccounts.length}</div>
        </div>
        <div className="bg-red-500/5 rounded-lg border border-red-500/20" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="text-red-300" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>🔒 {t('platformAdmin.subscription.locked')}</div>
          <div className="font-bold text-red-400" style={{ fontSize: 'clamp(1.5rem, 3vh, 2rem)' }}>{lockedCount}</div>
        </div>
        <div className="bg-green-500/5 rounded-lg border border-green-500/20" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="text-green-300" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>✅ {t('platformAdmin.subscription.active')}</div>
          <div className="font-bold text-green-400" style={{ fontSize: 'clamp(1.5rem, 3vh, 2rem)' }}>{activeCount}</div>
        </div>
        <div className={`rounded-lg border ${expiringCount > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/40 dark:bg-slate-800/40 border-gray-200/50 dark:border-slate-700/50'}`} style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="text-yellow-300" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>⚠️ {t('platformAdmin.subscription.expiring')}</div>
          <div className={`font-bold ${expiringCount > 0 ? 'text-yellow-400' : 'text-gray-500 dark:text-slate-500'}`} style={{ fontSize: 'clamp(1.5rem, 3vh, 2rem)' }}>{expiringCount}</div>
        </div>
        <div className={`rounded-lg border ${hackerCount > 0 ? 'bg-orange-500/10 border-orange-500/30 animate-pulse' : 'bg-white/40 dark:bg-slate-800/40 border-gray-200/50 dark:border-slate-700/50'}`} style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="text-orange-300" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>🚨 {t('platformAdmin.subscription.hackers')}</div>
          <div className={`font-bold ${hackerCount > 0 ? 'text-orange-400' : 'text-gray-500 dark:text-slate-500'}`} style={{ fontSize: 'clamp(1.5rem, 3vh, 2rem)' }}>{hackerCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center" style={{ gap: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)' }} />
          <input
            type="text"
            placeholder={t('platformAdmin.subscription.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/40 dark:bg-slate-800/40 border border-gray-200/50 dark:border-slate-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
            style={{ fontSize: 'clamp(0.875rem, 1.75vh, 1rem)', padding: 'clamp(0.5rem, 1vh, 0.75rem) clamp(0.5rem, 1vh, 0.75rem) clamp(0.5rem, 1vh, 0.75rem) clamp(2.5rem, 5vh, 3rem)' }}
          />
        </div>
        
        {/* Filter Buttons */}
        <div className="flex flex-wrap" style={{ gap: 'clamp(0.375rem, 0.75vh, 0.5rem)' }}>
          {[
            { key: 'all', label: t('platformAdmin.subscription.all'), count: allAccounts.length, color: 'cyan' },
            { key: 'locked', label: t('platformAdmin.subscription.locked'), count: lockedCount, color: 'red' },
            { key: 'active', label: t('platformAdmin.subscription.active'), count: activeCount, color: 'green' },
            { key: 'expiring', label: t('platformAdmin.subscription.expiring'), count: expiringCount, color: 'yellow' },
            { key: 'hackers', label: '🚨', count: hackerCount, color: 'orange' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key as any)}
              className={`rounded-lg font-medium transition-all ${
                filterStatus === f.key
                  ? `bg-${f.color}-600 text-gray-900 dark:text-white`
                  : 'bg-slate-700/30 text-gray-600 dark:text-slate-300 hover:bg-slate-600/30'
              }`}
              style={{ fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)', padding: 'clamp(0.375rem, 0.75vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)' }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAccounts.length > 0 && (
        <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg border border-cyan-500/20" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
            <span className="text-cyan-300 font-medium" style={{ fontSize: 'clamp(0.9rem, 1.8vh, 1.1rem)' }}>
              {t('platformAdmin.subscription.selected', { count: selectedAccounts.length })}
            </span>
            <div className="flex" style={{ gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
              <Button
                onClick={() => { setModalMode('unlock'); setShowModal(true); }}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', padding: 'clamp(0.375rem, 0.75vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2.25rem, 4.5vh, 2.75rem)' }}
              >
                <Unlock style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
                {t('platformAdmin.subscription.unlock')}
              </Button>
              <Button
                onClick={() => { setModalMode('lock'); setShowModal(true); }}
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
                style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', padding: 'clamp(0.375rem, 0.75vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2.25rem, 4.5vh, 2.75rem)' }}
              >
                <Lock style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
                {t('platformAdmin.subscription.lock')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700/50 bg-gray-100/50 dark:bg-slate-900/50">
                <th style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectedAccounts.length === filteredAccounts.length && filteredAccounts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-500/50"
                    style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)' }}
                  />
                </th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.table.status')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.table.account')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold hidden md:table-cell" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.table.subscription')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold hidden lg:table-cell" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.table.reason')}</th>
                <th className="text-right text-gray-600 dark:text-slate-300 font-semibold" style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)', fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 dark:text-slate-400" style={{ padding: 'clamp(2rem, 4vh, 3rem)' }}>
                    <CheckCircle className="mx-auto opacity-50" style={{ width: 'clamp(2rem, 4vh, 3rem)', height: 'clamp(2rem, 4vh, 3rem)', marginBottom: 'clamp(0.5rem, 1vh, 0.75rem)' }} />
                    <p style={{ fontSize: 'clamp(0.9rem, 1.8vh, 1.1rem)' }}>
                      {searchQuery ? t('platformAdmin.subscription.noMatchingAccounts') : filterStatus === 'locked' ? t('platformAdmin.subscription.noLockedAccounts') : filterStatus === 'hackers' ? t('platformAdmin.subscription.noHackers') : t('platformAdmin.subscription.noAccountsFound')}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(account => {
                  const isHoneypot = account.locked_reason?.includes('HONEYPOT');
                  const daysLeft = getDaysLeft(account);
                  const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
                  const isExpired = daysLeft !== null && daysLeft <= 0;
                  
                  return (
                    <tr
                      key={account.id}
                      className={`border-b border-gray-200/20 dark:border-slate-700/20 hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors ${
                        isHoneypot ? 'bg-orange-500/10' : account.is_locked ? 'bg-red-500/5' : isExpiring ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      <td style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem) clamp(0.75rem, 1.5vh, 1rem)' }}>
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(account.id)}
                          onChange={() => toggleSelect(account.id)}
className="rounded border-slate-500/50"
                          style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)' }}
                        />
                      </td>
                      <td style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                        {isHoneypot ? (
                          <Badge className="bg-orange-600 animate-pulse" style={{ fontSize: 'clamp(0.7rem, 1.4vh, 0.85rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)' }}>{t('platformAdmin.subscription.hacker')}</Badge>
                        ) : account.is_locked ? (
                          <Badge className="bg-red-600" style={{ fontSize: 'clamp(0.7rem, 1.4vh, 0.85rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)' }}>{t('platformAdmin.subscription.lockedBadge')}</Badge>
                        ) : isExpiring ? (
                          <Badge className="bg-yellow-600" style={{ fontSize: 'clamp(0.7rem, 1.4vh, 0.85rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)' }}>{t('platformAdmin.subscription.expiringBadge')}</Badge>
                        ) : (
                          <Badge className="bg-green-600" style={{ fontSize: 'clamp(0.7rem, 1.4vh, 0.85rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)' }}>{t('platformAdmin.subscription.activeBadge')}</Badge>
                        )}
                        {account.is_paid_temporarily && <Badge className="bg-blue-600 ml-1" style={{ fontSize: 'clamp(0.65rem, 1.3vh, 0.75rem)', padding: 'clamp(0.125rem, 0.25vh, 0.25rem) clamp(0.375rem, 0.75vh, 0.5rem)' }}>{t('platformAdmin.subscription.temp')}</Badge>}
                      </td>
                      <td style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                        <div className="text-gray-900 dark:text-white font-medium" style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)' }}>{account.name || t('platformAdmin.subscription.noName')}</div>
                        <div className="text-gray-500 dark:text-slate-400 font-mono" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>{account.email}</div>
                      </td>
                      <td className="hidden md:table-cell" style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                        {daysLeft !== null ? (
                          <div>
                            <div className={`font-medium ${isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-green-400'}`} style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)' }}>
                              {isExpired ? t('platformAdmin.subscription.expiredDaysAgo', { days: Math.abs(daysLeft) }) : t('platformAdmin.subscription.daysLeftLabel', { days: daysLeft })}
                            </div>
                            <div className="text-gray-500 dark:text-slate-500" style={{ fontSize: 'clamp(0.7rem, 1.4vh, 0.85rem)' }}>
                              {new Date(account.subscription_extended_until || account.subscription_ends_at || '').toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-slate-500" style={{ fontSize: 'clamp(0.8rem, 1.6vh, 0.95rem)' }}>{t('platformAdmin.subscription.noData')}</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell" style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem)', maxWidth: '180px' }}>
                        <div className="text-gray-500 dark:text-slate-400 truncate" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>
                          {account.is_locked ? account.locked_reason || t('platformAdmin.subscription.subExpired') : account.unlock_reason || '—'}
                        </div>
                      </td>
                      <td className="text-right" style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                        {quickProcessing === account.id ? (
                          <div className="animate-spin inline-block">
                            <Zap className="text-amber-400" style={{ width: 'clamp(1.25rem, 2.5vh, 1.5rem)', height: 'clamp(1.25rem, 2.5vh, 1.5rem)' }} />
                          </div>
                        ) : account.is_locked ? (
                          <Button
                            onClick={() => quickUnlock(account.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.9rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
                          >
                            <Unlock style={{ width: 'clamp(0.875rem, 1.75vh, 1rem)', height: 'clamp(0.875rem, 1.75vh, 1rem)', marginRight: 'clamp(0.25rem, 0.5vh, 0.375rem)' }} />
                            {t('platformAdmin.subscription.unlock')}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => quickLock(account.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.9rem)', padding: 'clamp(0.25rem, 0.5vh, 0.375rem) clamp(0.5rem, 1vh, 0.75rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
                          >
                            <Lock style={{ width: 'clamp(0.875rem, 1.75vh, 1rem)', height: 'clamp(0.875rem, 1.75vh, 1rem)', marginRight: 'clamp(0.25rem, 0.5vh, 0.375rem)' }} />
                            {t('platformAdmin.subscription.lock')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 flex items-center justify-center" style={{ padding: 'clamp(1rem, 2vh, 1.5rem)' }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/50 dark:border-slate-700/50 w-full" style={{ maxWidth: '480px', padding: 'clamp(1.25rem, 2.5vh, 1.75rem)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(1rem, 2vh, 1.25rem)' }}>
              <h3 className="font-bold text-gray-900 dark:text-white" style={{ fontSize: 'clamp(1.1rem, 2.2vh, 1.35rem)' }}>
                {modalMode === 'unlock' ? t('platformAdmin.modal.unlockAndExtend') : t('platformAdmin.modal.lockAccount')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white">
                <X style={{ width: 'clamp(1.25rem, 2.5vh, 1.5rem)', height: 'clamp(1.25rem, 2.5vh, 1.5rem)' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1rem, 2vh, 1.25rem)' }}>
              {modalMode === 'unlock' && (
                <>
                  {/* Action Selection */}
                  <div>
                    <label className="block font-medium text-gray-600 dark:text-slate-300" style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', marginBottom: 'clamp(0.5rem, 1vh, 0.75rem)' }}>{t('platformAdmin.modal.action')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                      <label className={`flex items-center gap-3 rounded-lg border border-gray-300/50 dark:border-slate-600/50 cursor-pointer hover:bg-gray-200/30 dark:hover:bg-gray-200/20 dark:hover:bg-slate-700/30 ${action === 'extend' ? 'bg-blue-500/10 border-blue-500/30' : ''}`}
                        style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
                        <input type="radio" checked={action === 'extend'} onChange={() => setAction('extend')} name="action" style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)' }} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white" style={{ fontSize: 'clamp(0.9rem, 1.8vh, 1.05rem)' }}>{t('platformAdmin.modal.extendSubscription')}</div>
                          <div className="text-gray-500 dark:text-slate-400" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>{t('platformAdmin.modal.addDays')}</div>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 rounded-lg border border-gray-300/50 dark:border-slate-600/50 cursor-pointer hover:bg-gray-200/30 dark:hover:bg-gray-200/20 dark:hover:bg-slate-700/30 ${action === 'mark_paid' ? 'bg-green-500/10 border-green-500/30' : ''}`}
                        style={{ padding: 'clamp(0.75rem, 1.5vh, 1rem)' }}>
                        <input type="radio" checked={action === 'mark_paid'} onChange={() => setAction('mark_paid')} name="action" style={{ width: 'clamp(1rem, 2vh, 1.25rem)', height: 'clamp(1rem, 2vh, 1.25rem)' }} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white" style={{ fontSize: 'clamp(0.9rem, 1.8vh, 1.05rem)' }}>{t('platformAdmin.modal.markAsPaid')}</div>
                          <div className="text-gray-500 dark:text-slate-400" style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)' }}>{t('platformAdmin.modal.grant30days')}</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Days Input */}
                  {action === 'extend' && (
                    <div>
                      <label className="block font-medium text-gray-600 dark:text-slate-300" style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', marginBottom: 'clamp(0.375rem, 0.75vh, 0.5rem)' }}>{t('platformAdmin.modal.daysToExtend')}</label>
                      <input
                        type="number"
                        value={extendDays}
                        onChange={(e) => setExtendDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                        min="1"
                        max="365"
                        className="w-full bg-gray-100/30 dark:bg-slate-900/30 border border-gray-300/50 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-white"
                        style={{ fontSize: 'clamp(0.9rem, 1.8vh, 1.05rem)', padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Reason */}
              <div>
                <label className="block font-medium text-gray-600 dark:text-slate-300" style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', marginBottom: 'clamp(0.375rem, 0.75vh, 0.5rem)' }}>
                  {modalMode === 'unlock' ? t('platformAdmin.modal.unlockReason') : t('platformAdmin.modal.lockReason')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={modalMode === 'unlock' ? t('platformAdmin.modal.unlockPlaceholder') : t('platformAdmin.modal.lockPlaceholder')}
                  className="w-full bg-gray-100/30 dark:bg-slate-900/30 border border-gray-300/50 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                  style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', padding: 'clamp(0.5rem, 1vh, 0.75rem)' }}
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex" style={{ gap: 'clamp(0.5rem, 1vh, 0.75rem)' }}>
                <Button onClick={() => setShowModal(false)} variant="ghost" className="flex-1" disabled={processing}
                  style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', height: 'clamp(2.5rem, 5vh, 3rem)' }}>
                  {t('platformAdmin.modal.cancel')}
                </Button>
                <Button
                  onClick={handleProcess}
                  className={`flex-1 ${modalMode === 'unlock' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-orange-600'}`}
                  disabled={processing || !reason.trim()}
                  style={{ fontSize: 'clamp(0.85rem, 1.7vh, 1rem)', height: 'clamp(2.5rem, 5vh, 3rem)' }}
                >
                  {processing ? t('platformAdmin.modal.processing') : modalMode === 'unlock' ? t('platformAdmin.modal.unlockCount', { count: selectedAccounts.length }) : t('platformAdmin.modal.lockCount', { count: selectedAccounts.length })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalClients: 0,
    totalAdmins: 0,
    lockedAccounts: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    expiredSubscriptions: 0,
    totalCodes: 0,
    redeemedCodes: 0,
    pendingCodes: 0,
    expiredCodes: 0,
    newSignupsWeek: 0,
    newSignupsMonth: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [logMode, setLogMode] = useState<'staff' | 'admin'>('staff');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'stores' | 'products' | 'activity' | 'errors' | 'health' | 'settings' | 'billing' | 'payment-failures' | 'codes' | 'tools' | 'affiliates' | 'notes' | 'ai' | 'bills'>('overview');

  const [platformErrorDays, setPlatformErrorDays] = useState(3);
  const [platformErrorSource, setPlatformErrorSource] = useState<'all' | 'client' | 'server'>('all');
  const [platformErrorsLoading, setPlatformErrorsLoading] = useState(false);
  const [platformErrorsError, setPlatformErrorsError] = useState<string | null>(null);
  const [platformErrors, setPlatformErrors] = useState<any[]>([]);
  const [platformErrorView, setPlatformErrorView] = useState<'active' | 'all'>('active');
  const [platformErrorActiveMinutes, setPlatformErrorActiveMinutes] = useState(60);
  const [platformErrorGroup, setPlatformErrorGroup] = useState(true);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [systemCapacity, setSystemCapacity] = useState<any>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any>(null);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);
  const [browserStorage, setBrowserStorage] = useState<{ usage: number | null; quota: number | null } | null>(null);
  const [browserDownlinkMbps, setBrowserDownlinkMbps] = useState<number | null>(null);
  const [billingMetrics, setBillingMetrics] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<any>(null);
  const [settingsForm, setSettingsForm] = useState({
    max_users: 1000,
    max_stores: 1000,
    subscription_price: 7,
    trial_days: 30,
  });
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [converting, setConverting] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [flaggedProductId, setFlaggedProductId] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagNotes, setFlagNotes] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [paymentFailures, setPaymentFailures] = useState<any[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState<number | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [bulkModeratingProducts, setBulkModeratingProducts] = useState(false);
  const [codesLoading, setCodesLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<any[]>([]);
  const [issuingCode, setIssuingCode] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<any>(null);
  const [expireClientEmail, setExpireClientEmail] = useState('');
  const [expiringClient, setExpiringClient] = useState(false);

  // Admin Notes state
  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<AdminNote | null>(null);
  const [noteForm, setNoteForm] = useState<{ title: string; content: string; color: 'yellow' | 'blue' | 'green' | 'red' | 'purple'; is_pinned: boolean }>({ title: '', content: '', color: 'yellow', is_pinned: false });
  const [savingNote, setSavingNote] = useState(false);

  const reloadPlatformErrors = useCallback(async () => {
    setPlatformErrorsLoading(true);
    setPlatformErrorsError(null);

    try {
      const params = new URLSearchParams();
      params.set('days', String(platformErrorDays));
      if (platformErrorSource && platformErrorSource !== 'all') {
        params.set('source', platformErrorSource);
      }
      params.set('limit', '200');

      const res = await fetch(`/api/telemetry/platform-errors?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to load errors (${res.status})`);
      }

      const data = text ? JSON.parse(text) : {};
      setPlatformErrors(Array.isArray(data?.events) ? data.events : []);
    } catch (e: any) {
      setPlatformErrorsError(e?.message || 'Failed to load errors');
      setPlatformErrors([]);
    } finally {
      setPlatformErrorsLoading(false);
    }
  }, [platformErrorDays, platformErrorSource]);

  const displayPlatformErrors = useMemo(() => {
    const now = Date.now();
    const cutoff = now - Math.max(1, platformErrorActiveMinutes) * 60 * 1000;

    const toMs = (v: any): number => {
      const t = new Date(v as any).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const toWhere = (ev: any): string =>
      ev?.path ? `${ev?.method || ''} ${ev?.path}`.trim() : String(ev?.url || '');

    const isActive = (ev: any): boolean => {
      if (platformErrorView !== 'active') return true;
      const ms = toMs(ev?.created_at);
      return ms >= cutoff;
    };

    if (!platformErrorGroup) {
      return (platformErrors || []).filter(isActive).map((ev) => ({ kind: 'event' as const, ev }));
    }

    type Group = {
      kind: 'group';
      key: string;
      count: number;
      firstSeenMs: number;
      lastSeenMs: number;
      sample: any;
    };

    const map = new Map<string, Group>();
    for (const ev of platformErrors || []) {
      const createdMs = toMs(ev?.created_at);
      const stackFirst = ev?.stack ? String(ev.stack).split('\n')[0].slice(0, 240) : '';
      const key = [
        String(ev?.source || ''),
        String(ev?.status_code ?? ''),
        String(ev?.message || '').slice(0, 800),
        toWhere(ev).slice(0, 800),
        stackFirst,
      ].join('|');

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          kind: 'group',
          key,
          count: 1,
          firstSeenMs: createdMs,
          lastSeenMs: createdMs,
          sample: ev,
        });
      } else {
        existing.count += 1;
        if (createdMs < existing.firstSeenMs) existing.firstSeenMs = createdMs;
        if (createdMs > existing.lastSeenMs) {
          existing.lastSeenMs = createdMs;
          existing.sample = ev;
        }
      }
    }

    const groups = Array.from(map.values());
    const filtered = platformErrorView === 'active'
      ? groups.filter((g) => g.lastSeenMs >= cutoff)
      : groups;
    filtered.sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    return filtered;
  }, [platformErrors, platformErrorView, platformErrorActiveMinutes, platformErrorGroup]);

  useEffect(() => {
    if (activeTab !== 'errors') return;
    void reloadPlatformErrors();
  }, [activeTab, reloadPlatformErrors]);

  useEffect(() => {
    loadPlatformData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'health') return;
    let alive = true;

    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch('/api/admin/health');
        if (!res.ok) return;
        const data = (await res.json()) as ServerHealth;
        if (alive) setServerHealth(data);
      } catch {
        // ignore background polling errors
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [activeTab]);

  // Load system capacity when health tab is active (every 10 seconds)
  useEffect(() => {
    if (activeTab !== 'health') return;
    loadSystemCapacity();
    const id = window.setInterval(loadSystemCapacity, 10000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  // Load active users when health tab is active (every 5 seconds for real-time feel)
  useEffect(() => {
    if (activeTab !== 'health') return;
    loadActiveUsers();
    const id = window.setInterval(loadActiveUsers, 5000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  // Client-side metrics for the health gauges (storage estimate + network downlink)
  useEffect(() => {
    if (activeTab !== 'health') return;

    let cancelled = false;

    const loadBrowserStorage = async () => {
      try {
        const storageAny = (navigator as any).storage;
        if (!storageAny || typeof storageAny.estimate !== 'function') {
          if (!cancelled) setBrowserStorage(null);
          return;
        }
        const estimate = await storageAny.estimate();
        const usage = typeof estimate?.usage === 'number' ? estimate.usage : null;
        const quota = typeof estimate?.quota === 'number' ? estimate.quota : null;
        if (!cancelled) setBrowserStorage({ usage, quota });
      } catch {
        if (!cancelled) setBrowserStorage(null);
      }
    };

    const loadBrowserConnection = () => {
      try {
        const conn = (navigator as any).connection;
        const downlink = conn && typeof conn.downlink === 'number' ? conn.downlink : null;
        if (!cancelled) setBrowserDownlinkMbps(downlink);
      } catch {
        if (!cancelled) setBrowserDownlinkMbps(null);
      }
    };

    void loadBrowserStorage();
    loadBrowserConnection();

    const connId = window.setInterval(loadBrowserConnection, 5000);
    const storageId = window.setInterval(() => void loadBrowserStorage(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(connId);
      window.clearInterval(storageId);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!platformSettings) return;
    setSettingsForm({
      max_users: Number(platformSettings.max_users ?? 1000) ?? 0,
      max_stores: Number(platformSettings.max_stores ?? 1000) ?? 0,
      subscription_price: Number(platformSettings.subscription_price ?? 7) ?? 0,
      trial_days: Number(platformSettings.trial_days ?? 30) ?? 0,
    });
  }, [platformSettings]);

  const loadPlatformData = async () => {
    try {
      const [usersRes, productsRes, statsRes, storesRes, activityRes, staffRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/products').catch(() => null),
        fetch('/api/admin/stats').catch(() => null),
        fetch('/api/admin/stores').catch(() => null),
        fetch('/api/admin/activity-logs').catch(() => null),
        fetch('/api/admin/staff').catch(() => null),
      ]);

      if (usersRes.status === 401 || usersRes.status === 403) {
        removeAuthToken();
        navigate('/login');
        return;
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);

        const clients = usersData.filter((u: User) => u.user_type === 'client').length;

        setStats(prev => ({
          ...prev,
          totalUsers: usersData.length,
          totalClients: clients,
        }));
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);

        const activeProducts = productsData.filter((p: Product) => p.status === 'active').length;

        setStats(prev => ({
          ...prev,
          totalProducts: productsData.length,
          activeProducts,
        }));
      }

      if (storesRes && storesRes.ok) {
        const storesData = await storesRes.json();
        setStores(storesData || []);
      } else if (storesRes) {
        console.error('Failed to load stores:', storesRes.status, storesRes.statusText);
      }

      if (activityRes && activityRes.ok) {
        const activityData = await activityRes.json();
        setActivityLogs(activityData || []);
      }

      if (staffRes && staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData || []);
      }

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(prev => ({
          ...prev,
          ...statsData,
        }));
      }
    } catch (error) {
      console.error('Failed to load platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes == null || !Number.isFinite(bytes)) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDuration = (totalSeconds: number | null | undefined) => {
    if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '-';
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number | null | undefined, digits = 2) => {
    if (value == null || !Number.isFinite(value)) return '-';
    return value.toFixed(digits);
  };

  const formatBps = (bps: number | null | undefined) => {
    if (bps == null || !Number.isFinite(bps)) return '-';
    // Use SI units for network speeds
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let value = bps;
    let unitIndex = 0;
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatBytesShort = (bytes: number | null | undefined) => {
    if (bytes == null || !Number.isFinite(bytes)) return '-';
    const abs = Math.max(0, bytes);
    const gib = abs / (1024 * 1024 * 1024);
    if (gib >= 1) return `${gib.toFixed(2)}G`;
    const mib = abs / (1024 * 1024);
    if (mib >= 1) return `${mib.toFixed(0)}M`;
    const kib = abs / 1024;
    if (kib >= 1) return `${kib.toFixed(0)}K`;
    return `${abs.toFixed(0)}B`;
  };

  const loadServerHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/admin/health');
      if (!res.ok) {
        setHealthError(`${res.status} ${res.statusText}`);
        setServerHealth(null);
        return;
      }
      const data = (await res.json()) as ServerHealth;
      setServerHealth(data);
    } catch (error) {
      console.error('Failed to load server health:', error);
      setHealthError(error instanceof Error ? error.message : 'Failed to load health');
      setServerHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadSystemCapacity = async () => {
    setCapacityLoading(true);
    try {
      const res = await fetch('/api/admin/capacity');
      if (res.ok) {
        const data = await res.json();
        setSystemCapacity(data);
      }
    } catch (error) {
      console.error('Failed to load system capacity:', error);
    } finally {
      setCapacityLoading(false);
    }
  };

  const loadActiveUsers = async () => {
    setActiveUsersLoading(true);
    try {
      const res = await fetch('/api/admin/active-users?window=30&details=true');
      if (res.ok) {
        const data = await res.json();
        setActiveUsers(data);
      }
    } catch (error) {
      console.error('Failed to load active users:', error);
    } finally {
      setActiveUsersLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    try {
      const res = await fetch('/api/admin/activity-logs');
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data || []);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  };

  const loadAdminAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAdminAuditLogs(data || []);
      }
    } catch (error) {
      console.error('Failed to load admin audit logs:', error);
    }
  };

  const loadBillingMetrics = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setBillingMetrics(data);
      }
    } catch (error) {
      console.error('Failed to load billing metrics:', error);
    } finally {
      setBillingLoading(false);
    }
  };

  const loadPlatformSettings = async () => {
    try {
      const res = await fetch('/api/billing/admin/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlatformSettings(data);
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error);
    }
  };

  const updatePlatformSettings = async (settings: Record<string, any>) => {
    const res = await fetch('/api/billing/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ settings }),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Failed to update settings');
    }
    return data;
  };

  const loadPaymentFailures = async () => {
    setFailuresLoading(true);
    try {
      const res = await fetch('/api/billing/admin/payment-failures');
      if (res.ok) {
        const data = await res.json();
        setPaymentFailures(data || []);
      }
    } catch (error) {
      console.error('Failed to load payment failures:', error);
    } finally {
      setFailuresLoading(false);
    }
  };

  const handlePaymentRetry = async (codeRequestId: number | string) => {
    if (!confirm(t('platformAdmin.codeRequests.confirmIssue'))) return;
    
    setRetryingPayment(codeRequestId as any);
    try {
      const res = await fetch('/api/billing/admin/retry-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId: codeRequestId }),
      });

      if (res.ok) {
        const data = await res.json();
        await loadPaymentFailures();
        alert(t('platformAdmin.alerts.codeIssued', { code: data.newCode }));
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedIssueCode'));
      }
    } catch (error) {
      console.error('Error issuing code:', error);
      alert(t('platformAdmin.alerts.errorIssuingCodeRequest'));
    } finally {
      setRetryingPayment(null);
    }
  };

  const loadCodes = async () => {
    setCodesLoading(true);
    try {
      const res = await fetch('/api/codes/admin/list');
      if (res.ok) {
        const data = await res.json();
        setGeneratedCodes(data || []);
      } else {
        console.error('Failed to load codes');
        setGeneratedCodes([]);
      }
    } catch (error) {
      console.error('Failed to load codes:', error);
      setGeneratedCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  // Admin Notes functions
  const loadAdminNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await fetch('/api/admin/notes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminNotes(data.notes || []);
      } else {
        console.error('Failed to load notes');
        setAdminNotes([]);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
      setAdminNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteForm.content.trim()) return;
    setSavingNote(true);
    try {
      const url = editingNote ? `/api/admin/notes/${editingNote.id}` : '/api/admin/notes';
      const method = editingNote ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(noteForm),
      });
      
      if (res.ok) {
        await loadAdminNotes();
        setShowNoteModal(false);
        setEditingNote(null);
        setNoteForm({ title: '', content: '', color: 'yellow', is_pinned: false });
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedSaveNote'));
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(t('platformAdmin.alerts.failedSaveNote'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm(t('platformAdmin.alerts.confirmDeleteNote'))) return;
    try {
      const res = await fetch(`/api/admin/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        await loadAdminNotes();
      } else {
        alert(t('platformAdmin.alerts.failedDeleteNote'));
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(t('platformAdmin.alerts.failedDeleteNote'));
    }
  };

  const handleTogglePin = async (note: AdminNote) => {
    try {
      const res = await fetch(`/api/admin/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      if (res.ok) {
        await loadAdminNotes();
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleIssueCode = async () => {
    if (issuingCode) return;
    
    setIssuingCode(true);
    try {
      const res = await fetch('/api/codes/admin/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tier: 'gold', // Single tier for all subscriptions
          payment_method: 'admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastGeneratedCode({
          code: data.code,
          tier: data.tier,
          expires_at: data.expires_at,
        });
        await loadCodes();
        await loadPlatformData(); // Refresh stats
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedGenerateCode'));
      }
    } catch (error) {
      console.error('Error generating code:', error);
      alert(t('platformAdmin.alerts.errorIssuingCode'));
    } finally {
      setIssuingCode(false);
    }
  };

  const handleExpireClientAccount = async () => {
    if (!expireClientEmail.trim()) {
      alert(t('platformAdmin.alerts.enterClientEmail'));
      return;
    }

    setExpiringClient(true);
    try {
      // First, find the client by email
      const searchRes = await fetch(`/api/users/search?email=${encodeURIComponent(expireClientEmail)}`, {
      });

      if (!searchRes.ok) {
        alert(t('platformAdmin.alerts.clientNotFound'));
        setExpiringClient(false);
        return;
      }

      const clientData = await searchRes.json();
      const clientId = clientData.id;

      // Now expire the subscription
      const res = await fetch('/api/billing/admin/expire-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          reason: 'Testing voucher code redemption'
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(t('platformAdmin.alerts.accountExpired', { email: data.client.email }));
        setExpireClientEmail('');
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedExpire'));
      }
    } catch (error) {
      console.error('Error expiring account:', error);
      alert(t('platformAdmin.alerts.errorExpiring'));
    } finally {
      setExpiringClient(false);
    }
  };


  const handleBulkRemoveProducts = async () => {
    if (selectedProducts.size === 0) {
      alert(t('platformAdmin.alerts.selectProductsToRemove'));
      return;
    }

    const confirmRemove = confirm(t('platformAdmin.alerts.confirmRemoveProducts', { count: selectedProducts.size }));
    if (!confirmRemove) return;

    setBulkModeratingProducts(true);
    try {
      const res = await fetch('/api/admin/bulk-remove-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds: Array.from(selectedProducts) }),
      });

      if (res.ok) {
        await loadPlatformData();
        setSelectedProducts(new Set());
        alert(t('platformAdmin.alerts.productsRemoved'));
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedRemoveProducts'));
      }
    } catch (error) {
      console.error('Error removing products:', error);
      alert(t('platformAdmin.alerts.failedRemoveProducts'));
    } finally {
      setBulkModeratingProducts(false);
    }
  };

  const handleBulkSuspendStores = async () => {
    // Get stores of selected products
    const storeEmails = new Set(
      Array.from(selectedProducts).map(productId => {
        const product = products.find(p => p.id === productId);
        return product?.seller_email;
      }).filter(Boolean)
    );

    if (storeEmails.size === 0) {
      alert(t('platformAdmin.alerts.selectProductsToSuspend'));
      return;
    }

    const confirmSuspend = confirm(t('platformAdmin.alerts.confirmSuspendStores', { count: storeEmails.size }));
    if (!confirmSuspend) return;

    setBulkModeratingProducts(true);
    try {
      const res = await fetch('/api/admin/bulk-suspend-stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sellerEmails: Array.from(storeEmails) }),
      });

      if (res.ok) {
        await loadPlatformData();
        setSelectedProducts(new Set());
        alert(t('platformAdmin.alerts.storesSuspended'));
      } else {
        const error = await res.json();
        alert(error.error || t('platformAdmin.alerts.failedSuspendStores'));
      }
    } catch (error) {
      console.error('Error suspending stores:', error);
      alert(t('platformAdmin.alerts.failedSuspendStores'));
    } finally {
      setBulkModeratingProducts(false);
    }
  };

  const handlePromoteToAdmin = async (userId: number) => {
    if (!confirm(t('platformAdmin.alerts.confirmPromote'))) return;

    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await loadPlatformData();
        alert(t('platformAdmin.alerts.promotedSuccess'));
      }
    } catch (error) {
      console.error('Failed to promote user:', error);
    }
  };

  const handleBlockUser = async (userId: number, userName: string) => {
    const reason = prompt(t('platformAdmin.alerts.blockAccount', { name: userName }));
    if (reason === null) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || t('platformAdmin.alerts.blockedByAdmin'), lock_type: 'critical' }),
      });

      if (res.ok) {
        await loadPlatformData();
        alert(t('platformAdmin.alerts.userBlocked'));
      } else {
        try {
          const data = await res.json();
          alert(t('platformAdmin.alerts.failedBlock'));
        } catch {
          alert(t('platformAdmin.alerts.failedBlock'));
        }
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      alert(t('platformAdmin.alerts.failedBlock'));
    }
  };

  const handleUnblockUser = async (userId: number, userName: string) => {
    const confirm_unblock = confirm(t('platformAdmin.alerts.confirmUnblock', { name: userName }));
    if (!confirm_unblock) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/unlock`, {
        method: 'POST',
      });

      if (res.ok) {
        await loadPlatformData();
        alert(t('platformAdmin.alerts.userUnblocked'));
      } else {
        try {
          const data = await res.json();
          alert(t('platformAdmin.alerts.failedUnblock'));
        } catch {
          alert(t('platformAdmin.alerts.failedUnblock'));
        }
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      alert(t('platformAdmin.alerts.failedUnblock'));
    }
  };

  const handleDeleteUser = async (userId: number, userEmail?: string, userType?: string) => {
    const confirmDelete = confirm(t('platformAdmin.alerts.confirmDelete'));
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: userEmail && userType ? JSON.stringify({ email: userEmail, user_type: userType }) : undefined,
      });

      if (res.ok) {
        await loadPlatformData();
        alert(t('platformAdmin.alerts.userDeleted'));
      } else {
        try {
          const data = await res.json();
          alert(t('platformAdmin.alerts.failedDelete'));
        } catch {
          const txt = await res.text();
          alert(t('platformAdmin.alerts.failedDelete'));
        }
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert(t('platformAdmin.alerts.failedDelete'));
    }
  };

  const handleConvertToSeller = async (userId: number) => {
    setConverting(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/convert-to-seller`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        await loadPlatformData();
        alert(t('platformAdmin.alerts.convertedToSeller', { pass: data.temp_password }));
      } else {
        const txt = await res.text();
        alert(t('platformAdmin.alerts.failedConvert'));
      }
    } catch (e) {
      console.error('Convert to seller failed:', e);
      alert(t('platformAdmin.alerts.failedConvert'));
    } finally {
      setConverting(null);
    }
  };

  const handleDeleteStaff = async (staffId: number) => {
    const confirmDelete = confirm(t('platformAdmin.alerts.confirmDeleteStaff'));
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadPlatformData();
        alert(t('platformAdmin.alerts.staffDeleted'));
      } else {
        const txt = await res.text();
        alert(t('platformAdmin.alerts.failedDeleteStaff'));
      }
    } catch (error) {
      console.error('Failed to delete staff:', error);
      alert(t('platformAdmin.alerts.failedDeleteStaff'));
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800">
          <div className="text-gray-900 dark:text-white text-lg font-semibold">{t('loading') || 'Loading...'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto max-w-7xl" style={{ padding: 'clamp(0.5rem, 1.2vh, 1rem) clamp(0.5rem, 1vh, 0.75rem)' }}>
        {/* Enhanced Navigation Tabs */}
        <div className="flex bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-lg border border-gray-200 dark:border-slate-700/50 shadow-md overflow-x-auto"
          style={{ gap: 'clamp(0.25rem, 0.5vh, 0.5rem)', marginBottom: 'clamp(1rem, 2vh, 1.25rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem)' }}>
          <Button
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('overview')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <BarChart3 style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.overview')}</span>
            <span className="sm:hidden">OVR</span>
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('users')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Users style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.users')}</span>
            <span className="sm:hidden">U</span>
          </Button>
          <Button
            variant={activeTab === 'stores' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('stores')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Store style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.stores')}</span>
            <span className="sm:hidden">S</span>
          </Button>
          <Button
            variant={activeTab === 'products' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('products')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Package style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.products')}</span>
            <span className="sm:hidden">P</span>
          </Button>
          <Button
            variant={activeTab === 'activity' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('activity')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Activity style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.activity')}</span>
            <span className="sm:hidden">A</span>
          </Button>
          <Button
            variant={activeTab === 'errors' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('errors')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <AlertTriangle style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.errors')}</span>
            <span className="sm:hidden">{t('platformAdmin.tabs.errorsShort')}</span>
          </Button>
          <Button
            variant={activeTab === 'billing' ? 'default' : 'ghost'}
            onClick={() => { 
              setActiveTab('billing');
              loadBillingMetrics();
              loadPlatformSettings();
            }}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <CreditCard style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.subscriptions')}</span>
            <span className="sm:hidden">B</span>
          </Button>
          <Button
            variant={activeTab === 'bills' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('bills')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Receipt style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden md:inline">{t('platformAdmin.tabs.bills')}</span>
            <span className="md:hidden">{t('platformAdmin.tabs.billsShort')}</span>
          </Button>
          <Button
            variant={activeTab === 'health' ? 'default' : 'ghost'}
            onClick={() => {
              setActiveTab('health');
              loadServerHealth();
            }}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <HeartPulse style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden md:inline">{t('platformAdmin.tabs.health')}</span>
            <span className="md:hidden">H</span>
          </Button>
          <Button
            variant={activeTab === 'codes' ? 'default' : 'ghost'}
            onClick={() => { 
              setActiveTab('codes');
              loadCodes();
            }}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Gift style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden md:inline">{t('platformAdmin.tabs.codes')}</span>
            <span className="md:hidden">C</span>
          </Button>
          <Button
            variant={activeTab === 'affiliates' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('affiliates')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <TrendingUp style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden md:inline">{t('platformAdmin.tabs.affiliates')}</span>
            <span className="md:hidden">{t('platformAdmin.tabs.affiliatesShort')}</span>
          </Button>
          <Button
            variant={activeTab === 'ai' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('ai')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Brain style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden md:inline">AI</span>
            <span className="md:hidden">AI</span>
          </Button>
          <Button
            variant={activeTab === 'tools' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('tools')}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Zap style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.tools')}</span>
            <span className="sm:hidden">{t('platformAdmin.tabs.toolsShort')}</span>
          </Button>
          <Button
            variant={activeTab === 'notes' ? 'default' : 'ghost'}
            onClick={() => { 
              setActiveTab('notes');
              loadAdminNotes();
            }}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <StickyNote style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.notes')}</span>
            <span className="sm:hidden">{t('platformAdmin.tabs.notesShort')}</span>
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'ghost'}
            onClick={() => { setActiveTab('settings'); loadPlatformSettings(); }}
            className="whitespace-nowrap text-gray-700 dark:text-slate-200"
            style={{ fontSize: 'clamp(0.75rem, 1.5vh, 0.875rem)', padding: 'clamp(0.375rem, 0.8vh, 0.5rem) clamp(0.75rem, 1.5vh, 1rem)', height: 'clamp(2rem, 4vh, 2.5rem)' }}
          >
            <Settings style={{ width: 'clamp(0.875rem, 1.8vh, 1rem)', height: 'clamp(0.875rem, 1.8vh, 1rem)', marginRight: 'clamp(0.375rem, 0.75vh, 0.5rem)' }} />
            <span className="hidden sm:inline">{t('platformAdmin.tabs.settings')}</span>
            <span className="sm:hidden">{t('platformAdmin.tabs.settingsShort')}</span>
          </Button>
        </div>

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <ErrorsTab
            errors={platformErrors}
            loading={platformErrorsLoading}
            error={platformErrorsError}
            onReload={reloadPlatformErrors}
            days={platformErrorDays}
            setDays={setPlatformErrorDays}
            source={platformErrorSource}
            setSource={setPlatformErrorSource}
          />
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} onNavigate={(tab) => setActiveTab(tab as any)} />
        )}


        {/* Users Tab */}
        {activeTab === 'users' && (
          <UsersTab users={users} onRefresh={loadPlatformData} loading={loading} />
        )}

        {/* Stores Tab */}
        {activeTab === 'stores' && (
          <StoresTab stores={stores} loading={loading} />
        )}

        {/* Code Requests Tab (was Payment Failures) */}
        {activeTab === 'payment-failures' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 backdrop-blur-md rounded-2xl border border-yellow-500/30 p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.codeRequests.pending')}</p>
                    <p className="text-3xl font-bold text-yellow-400">
                      {paymentFailures.filter(p => p.status === 'pending').length}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-yellow-500/40" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-md rounded-2xl border border-red-500/30 p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.codeRequests.expired')}</p>
                    <p className="text-3xl font-bold text-red-400">
                      {billingMetrics?.codes_expired || 0}
                    </p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-red-500/40" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-md rounded-2xl border border-blue-500/30 p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{t('platformAdmin.codeRequests.totalRequests')}</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {paymentFailures.length}
                    </p>
                  </div>
                  <CreditCard className="w-10 h-10 text-blue-500/40" />
                </div>
              </div>
            </div>

            {/* Code Requests List */}
            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700/50 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50/80 dark:bg-slate-900/80">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  {t('platformAdmin.codeRequests.title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{t('platformAdmin.codeRequests.subtitle')}</p>
              </div>

              {failuresLoading ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-slate-400">{t('platformAdmin.codeRequests.loading')}</p>
                </div>
              ) : paymentFailures.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">{t('platformAdmin.codeRequests.noPending')}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{t('platformAdmin.codeRequests.allProcessed')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
<tr className="border-b border-gray-200/30 dark:border-slate-700/30 bg-gray-100/20 dark:bg-slate-900/20">
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.codeRequests.id')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.codeRequests.client')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.codeRequests.tier')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.codeRequests.issue')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.table.status')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.codeRequests.requested')}</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 dark:text-slate-300">{t('platformAdmin.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700/30">
                      {paymentFailures.map((failure) => (
                        <tr key={failure.id} className="hover:bg-gray-200 dark:hover:bg-slate-700/20 transition-colors">
                          <td className="p-4 text-gray-600 dark:text-slate-300 text-sm font-mono">#{failure.id}</td>
                          <td className="p-4 text-sm">
                            <p className="text-gray-600 dark:text-slate-300">{failure.store_owner_name || t('platformAdmin.codeRequests.unknown')}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">{failure.store_owner_email}</p>
                          </td>
                          <td className="p-4 text-sm">
                            <Badge className={`${
                              failure.tier === 'gold' ? 'bg-yellow-600' :
                              failure.tier === 'silver' ? 'bg-slate-500' :
                              'bg-amber-700'
                            } text-gray-900 dark:text-white capitalize`}>
                              {failure.tier || t('platformAdmin.codeRequests.standard')}
                            </Badge>
                          </td>
                          <td className="p-4 text-gray-500 dark:text-slate-400 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              failure.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-red-500/20 text-red-300'
                            }`}>
                              {failure.failure_reason || t('platformAdmin.codeRequests.needsAttention')}
                            </span>
                          </td>
                          <td className="p-4 text-sm">
                            {failure.status === 'pending' && (
                              <Badge className="bg-yellow-600 text-white">{t('platformAdmin.codeRequests.pendingStatus')}</Badge>
                            )}
                            {(failure.status === 'failed' || failure.status === 'expired') && (
                              <Badge className="bg-red-600 text-white">{t('platformAdmin.codeRequests.expiredStatus')}</Badge>
                            )}
                          </td>
                          <td className="p-4 text-gray-500 dark:text-slate-400 text-sm">{new Date(failure.created_at).toLocaleDateString()}</td>
                          <td className="p-4 text-sm flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handlePaymentRetry(failure.id)}
                              disabled={retryingPayment === failure.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {retryingPayment === failure.id ? '...' : failure.status === 'pending' ? t('platformAdmin.codeRequests.issueCode') : t('platformAdmin.codeRequests.reissue')}
                            </Button>
                            {failure.chat_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-slate-500"
                                onClick={() => navigate('/platform-admin/chat')}
                              >
                                {t('platformAdmin.codeRequests.chat')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700/50 shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                {t('platformAdmin.codeFlow.title')}
              </h3>
              <div className="space-y-3 text-sm text-gray-500 dark:text-slate-400">
                <div className="flex items-center gap-3 p-3 bg-slate-700/20 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-400 text-xs">1</span>
                  <span>{t('platformAdmin.codeFlow.step1')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/20 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-400 text-xs">2</span>
                  <span>{t('platformAdmin.codeFlow.step2')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/20 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-400 text-xs">3</span>
                  <span>{t('platformAdmin.codeFlow.step3')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/20 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs">4</span>
                  <span>{t('platformAdmin.codeFlow.step4')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            loading={loading}
            onFlag={(id) => { setFlaggedProductId(id); setShowFlagModal(true); }}
            onDelete={async (id) => {
              if (!confirm(t('platformAdmin.alerts.confirmDeleteProduct'))) return;
              try {
                const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) { setProducts(products.filter(p => p.id !== id)); }
              } catch (e) { console.error(e); }
            }}
            onUnflag={async (id) => {
              try {
                const res = await fetch(`/api/admin/unflag-product/${id}`, { method: 'POST', credentials: 'include' });
                if (res.ok) { setProducts(products.map(p => p.id === id ? { ...p, flagged: false, flag_reason: null } : p)); }
              } catch (e) { console.error(e); }
            }}
          />
        )}

        {/* Announcement Tab (formerly Activity) */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <GlobalAnnouncementsManager />
          </div>
        )}

        {/* Health Tab — engineered visual dashboard */}
        {activeTab === 'health' && (
          <div className="space-y-3">
            {/* Error banner */}
            {healthError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs">{healthError}</div>
            )}

            {serverHealth && (() => {
              const cpuPct = serverHealth.htop?.cpu?.totalPct ?? null;
              const memPct = serverHealth.htop?.memory?.pctUsed ?? null;
              const dbMs = serverHealth.db.latencyMs ?? null;
              const dbOk = serverHealth.db.ok;
              const eluPct = serverHealth.eventLoop?.utilization != null ? serverHealth.eventLoop.utilization * 100 : null;
              const uploadsTotal = serverHealth.disk?.uploads?.total ?? null;
              const uploadsAvail = serverHealth.disk?.uploads?.available ?? null;
              const uploadsUsedPct = uploadsTotal != null && uploadsAvail != null && uploadsTotal > 0 ? (1 - uploadsAvail / uploadsTotal) * 100 : null;
              const rxBps = serverHealth.network?.totals?.rxBps ?? null;
              const txBps = serverHealth.network?.totals?.txBps ?? null;
              const totalMbps = rxBps != null && txBps != null ? ((rxBps + txBps) * 8) / 1_000_000 : null;
              const activeNow = activeUsers?.active?.total ?? null;
              const load1 = serverHealth.os.loadavg?.[0] ?? null;
              const cpuCount = serverHealth.os.cpuCount;
              const loadPerCpu = cpuCount && cpuCount > 0 && load1 != null ? load1 / cpuCount : null;
              const rssPct = serverHealth.derived?.rssPctOfLimit ?? null;

              const sparkW = 120; const sparkH = 32;
              const trend = serverHealth.trend?.series;
              const makeSpark = (data: (number | null)[] | undefined, color: string, baseline = 0) => {
                if (!data || data.length < 2) return null;
                const vals = data.map(v => v ?? baseline);
                const mn = Math.min(...vals); const mx = Math.max(...vals);
                const range = mx - mn || 1;
                const w = sparkW, h = sparkH;
                const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - mn) / range) * (h - 4) - 2}`).join(' ');
                const fillPts = `0,${h} ${pts} ${w},${h}`;
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                    <polyline points={fillPts} fill={`${color}15`} />
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                );
              };

              const ArcGauge = ({ pct, size = 80, stroke = 8, color = '#22c55e' }: { pct: number | null; size?: number; stroke?: number; color?: string }) => {
                const r = (size - stroke) / 2;
                const circ = 2 * Math.PI * r;
                const dash = pct != null ? (pct / 100) * circ * 0.75 : 0;
                return (
                  <svg width={size} height={size * 0.55} viewBox={`0 0 ${size} ${size * 0.55}`}>
                    <path d={`M ${stroke / 2} ${size * 0.55 - stroke / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size * 0.55 - stroke / 2}`} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth={stroke} strokeLinecap="round" />
                    <path d={`M ${stroke / 2} ${size * 0.55 - stroke / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size * 0.55 - stroke / 2}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ * 0.75}`} strokeDashoffset={circ * 0.75 * 0.25} style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dasharray 0.6s ease' }} />
                  </svg>
                );
              };

              const MetricCard = ({ label, value, unit, pct, color, sub, spark }: { label: string; value: string; unit?: string; pct?: number | null; color: string; sub?: string; spark?: React.ReactNode }) => (
                <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur rounded-xl border border-gray-200 dark:border-slate-700/60 p-3 hover:border-gray-300 dark:hover:border-slate-600/80 transition-all group" style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)` }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-[72px]">
                      <ArcGauge pct={pct} color={color} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-500">{label}</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white font-mono mt-0.5 leading-tight">{value}<span className="text-xs text-gray-400 dark:text-slate-400 font-normal ml-0.5">{unit}</span></div>
                      {sub && <div className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5 truncate">{sub}</div>}
                      {spark && <div className="mt-1 h-8 -mx-1">{spark}</div>}
                    </div>
                  </div>
                </div>
              );

              const BadgeDot = ({ color }: { color: string }) => (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: color }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
                </span>
              );

              return (
                <>
                  {/* Hero status bar */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/60 p-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.08),transparent_60%)]" />
                    <div className="flex items-center justify-between relative">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <HeartPulse className="w-5 h-5 text-red-400" />
                          <span className="text-sm font-bold text-white tracking-tight">SERVER HEALTH</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-[10px]">
                          <BadgeDot color={dbOk ? '#22c55e' : '#f59e0b'} />
                          <span className="text-slate-400 font-mono">{dbOk ? 'ONLINE' : 'DEGRADED'}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-500 font-mono">UP {formatDuration(serverHealth.uptimeSec)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!dbOk && <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">{t('platformAdmin.health.status.degraded')}</span>}
                        <button onClick={loadServerHealth} disabled={healthLoading} className="text-slate-500 hover:text-white transition-colors p-1">
                          <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {/* Quick status row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: cpuPct != null && cpuPct > 80 ? '#ef4444' : cpuPct != null && cpuPct > 50 ? '#f59e0b' : '#22c55e' }} /> CPU {cpuPct != null ? `${cpuPct.toFixed(1)}%` : '-'}</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: rssPct != null && rssPct > 80 ? '#ef4444' : rssPct != null && rssPct > 50 ? '#f59e0b' : '#22c55e' }} /> RAM {rssPct != null ? `${rssPct.toFixed(1)}%` : '-'}</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: dbMs != null && dbMs > 500 ? '#ef4444' : dbMs != null && dbMs > 200 ? '#f59e0b' : '#22c55e' }} /> DB {dbMs != null ? `${dbMs.toFixed(0)}ms` : '-'}</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: loadPerCpu != null && loadPerCpu > 1 ? '#ef4444' : loadPerCpu != null && loadPerCpu > 0.7 ? '#f59e0b' : '#22c55e' }} /> LOAD {loadPerCpu != null ? loadPerCpu.toFixed(2) : '-'}</span>
                      <span className="flex items-center gap-1"><BadgeDot color="#22c55e" /> {activeNow != null ? activeNow : '-'} USERS</span>
                    </div>
                  </div>

                  {/* SPLIT: Database (left) + Web Service (right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* ─── DATABASE ─── */}
                    <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-slate-700/60 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">DATABASE</span>
                        {serverHealth.db.render?.pgVersion && <span className="text-[10px] text-gray-500 dark:text-slate-500 font-mono">PG {serverHealth.db.render.pgVersion}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <BigCarGauge
                          title="CPU"
                          mainValue={serverHealth.db.render?.cpuPercentage ?? null}
                          mainLabel="Database CPU"
                          mainUnit="%"
                          icon={<Cpu className="w-4 h-4" />}
                          goodThreshold={50}
                          warnThreshold={80}
                        />
                        <BigCarGauge
                          title="RAM"
                          mainValue={serverHealth.db.render?.memoryPct ?? null}
                          mainLabel="Database RAM"
                          mainUnit="%"
                          secondaryValue={serverHealth.db.render?.memoryMB ?? null}
                          secondaryLabel="Used"
                          secondaryUnit=" MB"
                          icon={<MemoryStick className="w-4 h-4" />}
                          goodThreshold={50}
                          warnThreshold={80}
                        />
                      </div>
                      {serverHealth.db.render ? (
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 mt-3 pt-3 border-t border-slate-700/40">
                          {serverHealth.db.render.connectionsActive != null && <div>conn <span className="text-white">{serverHealth.db.render.connectionsActive}/{serverHealth.db.render.connectionsMax ?? '?'}</span></div>}
                          {serverHealth.db.render.latencyMs50 != null && <div>p50 <span className="text-white">{serverHealth.db.render.latencyMs50.toFixed(0)}ms</span></div>}
                          {serverHealth.db.render.latencyMs95 != null && <div>p95 <span className="text-white">{serverHealth.db.render.latencyMs95.toFixed(0)}ms</span></div>}
                          {serverHealth.db.render.diskUsedMb != null && <div>disk <span className="text-white">{formatBytes(serverHealth.db.render.diskUsedMb * 1024 * 1024)}</span></div>}
                          {serverHealth.db.render.diskCapacityMb != null && <div>capacity <span className="text-white">{formatBytes(serverHealth.db.render.diskCapacityMb * 1024 * 1024)}</span></div>}
                          {serverHealth.db.render.replicationLag != null && <div>repl <span className="text-white">{serverHealth.db.render.replicationLag}ms</span></div>}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 mt-2">Set RENDER_API_KEY + RENDER_DATABASE_ID</div>
                      )}
                    </div>

                    {/* ─── WEB SERVICE ─── */}
                    <div className="bg-slate-900/70 backdrop-blur rounded-2xl border border-slate-700/60 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-bold text-white tracking-tight">WEB SERVICE</span>
                        {serverHealth.service?.serviceName && <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]" title={serverHealth.service.serviceName}>{serverHealth.service.serviceName}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <BigCarGauge
                          title="CPU"
                          mainValue={serverHealth.service?.cpuPct ?? null}
                          mainLabel="Web CPU"
                          mainUnit="%"
                          icon={<Cpu className="w-4 h-4" />}
                          goodThreshold={50}
                          warnThreshold={80}
                        />
                        <BigCarGauge
                          title="RAM"
                          mainValue={serverHealth.service?.memoryPct ?? null}
                          mainLabel="Web RAM"
                          mainUnit="%"
                          secondaryValue={serverHealth.service?.memoryMb ?? null}
                          secondaryLabel="Used"
                          secondaryUnit=" MB"
                          icon={<MemoryStick className="w-4 h-4" />}
                          goodThreshold={50}
                          warnThreshold={80}
                        />
                      </div>
                      {serverHealth.service ? (
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 mt-3 pt-3 border-t border-slate-700/40">
                          {serverHealth.service.instanceCount != null && <div>instances <span className="text-white">{serverHealth.service.instanceCount}</span></div>}
                          {serverHealth.service.bandwidthBps != null && <div>bandwidth <span className="text-white">{formatBps(serverHealth.service.bandwidthBps)}</span></div>}
                          {serverHealth.service.latestDeployStatus && <div>deploy <span className={`${serverHealth.service.latestDeployStatus === 'live' ? 'text-emerald-400' : 'text-amber-400'}`}>{serverHealth.service.latestDeployStatus}</span></div>}
                          {serverHealth.service.latestDeployDuration != null && <div>duration <span className="text-white">{serverHealth.service.latestDeployDuration.toFixed(0)}s</span></div>}
                          {serverHealth.service.latestDeployAt && <div className="col-span-2">last deploy <span className="text-white">{new Date(serverHealth.service.latestDeployAt).toLocaleDateString()}</span></div>}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 mt-2">Set RENDER_API_KEY + RENDER_SERVICE_ID</div>
                      )}
                    </div>
                  </div>

                  {/* 8 Metric Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    <MetricCard label="CPU" value={cpuPct != null ? cpuPct.toFixed(1) : '-'} unit="%" pct={cpuPct} color={cpuPct != null && cpuPct > 80 ? '#ef4444' : cpuPct != null && cpuPct > 50 ? '#f59e0b' : '#22c55e'} sub={`${serverHealth.os.cpuModel?.split(' ')[0] ?? ''} ×${cpuCount ?? '?'} · load ${load1 != null ? load1.toFixed(2) : '-'}`} spark={makeSpark(trend?.map(s => s.load1PerCpu != null ? s.load1PerCpu! * 100 : null) as any, '#3b82f6')} />
                    <MetricCard label="MEMORY" value={rssPct != null ? rssPct.toFixed(1) : '-'} unit="%" pct={rssPct} color={rssPct != null && rssPct > 80 ? '#ef4444' : rssPct != null && rssPct > 50 ? '#f59e0b' : '#22c55e'} sub={`${formatBytes(serverHealth.process.memory.rss)} / ${formatBytes(serverHealth.derived?.memoryLimitBytes ?? serverHealth.os.totalmem)}`} spark={makeSpark(trend?.map(s => s.rssPct) as any, '#22c55e')} />
                    <MetricCard label="DATABASE" value={dbMs != null ? dbMs.toFixed(0) : '-'} unit="ms" pct={dbMs != null ? Math.min(100, (dbMs / 10)) : null} color={dbMs != null && dbMs > 500 ? '#ef4444' : dbMs != null && dbMs > 200 ? '#f59e0b' : '#a855f7'} sub={`pool ${serverHealth.db.pool?.totalCount ?? '-'} · wait ${serverHealth.db.pool?.waitingCount ?? '-'}`} spark={makeSpark(trend?.map(s => s.dbLatencyMs) as any, '#a855f7')} />
                    <MetricCard label="DISK" value={uploadsUsedPct != null ? uploadsUsedPct.toFixed(1) : '-'} unit="%" pct={uploadsUsedPct} color={uploadsUsedPct != null && uploadsUsedPct > 85 ? '#ef4444' : uploadsUsedPct != null && uploadsUsedPct > 70 ? '#f59e0b' : '#06b6d4'} sub={`${formatBytes(serverHealth.disk?.uploads?.available)} free`} />
                    <MetricCard label="EVENT LOOP" value={eluPct != null ? eluPct.toFixed(1) : '-'} unit="%" pct={eluPct} color={eluPct != null && eluPct > 80 ? '#ef4444' : eluPct != null && eluPct > 48 ? '#f59e0b' : '#22c55e'} sub={`active ${serverHealth.eventLoop?.active != null ? `${(serverHealth.eventLoop.active / 1000).toFixed(1)}s` : '-'}`} spark={makeSpark(trend?.map(s => s.elu != null ? s.elu * 100 : null) as any, '#22c55e')} />
                    <MetricCard label="HEAP" value={serverHealth.derived?.heapPctOfHeapTotal != null ? serverHealth.derived.heapPctOfHeapTotal.toFixed(1) : '-'} unit="%" pct={serverHealth.derived?.heapPctOfHeapTotal ?? null} color={serverHealth.derived?.heapPctOfHeapTotal != null && serverHealth.derived.heapPctOfHeapTotal > 90 ? '#ef4444' : serverHealth.derived?.heapPctOfHeapTotal != null && serverHealth.derived.heapPctOfHeapTotal > 70 ? '#f59e0b' : '#22c55e'} sub={`${formatBytes(serverHealth.process.memory.heapUsed)} / ${formatBytes(serverHealth.process.memory.heapTotal)}`} spark={makeSpark(trend?.map(s => s.heapPct) as any, '#f59e0b')} />
                    <MetricCard label="NETWORK" value={totalMbps != null ? totalMbps.toFixed(1) : '-'} unit="Mbps" pct={totalMbps != null ? Math.min(100, totalMbps / 2) : null} color="#6366f1" sub={`RX ${formatBps(rxBps)} / TX ${formatBps(txBps)}`} />
                    <MetricCard label="USERS" value={activeNow != null ? `${activeNow}` : '-'} unit="" pct={activeNow != null ? Math.min(100, activeNow * 5) : null} color="#ec4899" sub={`${serverHealth.users?.total ?? 0} registered · ${serverHealth.users?.recent15m ?? 0} active`} />
                  </div>

                  {/* Alerts + Trends row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {/* Alerts & Recommendations */}
                    <div className="bg-slate-900/70 backdrop-blur rounded-xl border border-slate-700/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">⚠️ ALERTS ({serverHealth.alerts?.length ?? 0})</div>
                      {Array.isArray(serverHealth.recommendations) && serverHealth.recommendations.length > 0 ? (
                        <div className="space-y-1">
                          {serverHealth.recommendations.slice(0, 4).map(r => (
                            <div key={r.code} className={`text-[10px] leading-tight ${r.severity === 'critical' ? 'text-red-400' : r.severity === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}>
                              <span className="text-slate-600">[{r.code}]</span> {r.message}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-slate-500 text-[10px]">No active alerts</div>}
                      {!serverHealth.ok && serverHealth.db.error && <div className="text-red-400 text-[10px] mt-1">DB: {serverHealth.db.error}</div>}
                    </div>

                    {/* Trend Sparklines */}
                    <div className="bg-slate-900/70 backdrop-blur rounded-xl border border-slate-700/60 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">📈 TRENDS ({serverHealth.trend?.points ?? 0} pts)</div>
                      {trend && trend.length > 1 ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          {[
                            { label: 'DB ms', data: trend.map(s => s.dbLatencyMs), color: '#a855f7' },
                            { label: 'RSS %', data: trend.map(s => s.rssPct), color: '#22c55e' },
                            { label: 'ELU %', data: trend.map(s => s.elu != null ? s.elu * 100 : null), color: '#f59e0b' },
                            { label: 'Load/CPU', data: trend.map(s => s.load1PerCpu), color: '#3b82f6' },
                          ].map(t => (
                            <div key={t.label}>
                              <div className="text-[9px] text-slate-600 font-mono">{t.label}</div>
                              <div className="h-7">{makeSpark(t.data as any, t.color)}</div>
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-slate-500 text-[10px]">Collecting data...</div>}
                    </div>
                  </div>

                  {/* System Info row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'NODE', value: `v${serverHealth.node.version}`, sub: `PID ${serverHealth.node.pid} · ${serverHealth.node.env ?? '-'}` },
                      { label: 'HOST', value: serverHealth.os.hostname?.split('-')[0] ?? '-', sub: `${serverHealth.os.platform} / ${serverHealth.os.arch}` },
                      { label: 'CPU', value: serverHealth.os.cpuModel?.split(' ').slice(0, 2).join(' ') ?? '-', sub: `${cpuCount ?? '?'} cores · ${serverHealth.cgroup?.cpu?.cpus?.toFixed(1) ?? '?'} limit` },
                      { label: 'UPTIME', value: formatDuration(serverHealth.uptimeSec), sub: `${serverHealth.os.loadavg.map(n => n.toFixed(2)).join(' / ')} load` },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-900/70 backdrop-blur rounded-xl border border-slate-700/60 p-3">
                        <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</div>
                        <div className="text-xs font-bold text-white font-mono mt-0.5">{item.value}</div>
                        <div className="text-[9px] text-slate-500 truncate">{item.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Active Users */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/60 p-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.06),transparent_60%)]" />
                    <div className="flex items-center justify-between relative mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-white">{t('platformAdmin.health.activeUsersTitle')}</span>
                        <BadgeDot color="#22c55e" />
                        <span className="text-[10px] text-emerald-400 font-mono">LIVE</span>
                      </div>
                      <button onClick={loadActiveUsers} disabled={activeUsersLoading} className="text-slate-500 hover:text-white transition-colors p-1">
                        <RefreshCw className={`w-3 h-3 ${activeUsersLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {activeUsers ? (
                      <div className="relative space-y-3">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center bg-slate-800/60 rounded-xl p-3 border border-emerald-500/20"><div className="text-xl font-bold text-emerald-400">{activeUsers.active?.total ?? 0}</div><div className="text-[9px] text-slate-500">ACTIVE</div></div>
                          <div className="text-center bg-slate-800/60 rounded-xl p-3 border border-blue-500/20"><div className="text-lg font-bold text-blue-400">{activeUsers.active?.authenticated ?? 0}</div><div className="text-[9px] text-slate-500">LOGGED IN</div></div>
                          <div className="text-center bg-slate-800/60 rounded-xl p-3 border border-slate-600/30"><div className="text-lg font-bold text-slate-300">{activeUsers.active?.anonymous ?? 0}</div><div className="text-[9px] text-slate-500">VISITORS</div></div>
                          <div className="text-center bg-slate-800/60 rounded-xl p-3 border border-amber-500/20"><div className="text-lg font-bold text-amber-400">{activeUsers.traffic?.requestsPerSecond ?? 0}</div><div className="text-[9px] text-slate-500">REQ/S</div></div>
                        </div>
                        {activeUsers.active?.breakdown && (
                          <div className="flex gap-4 text-[10px] font-mono text-slate-500">
                            <span>admins <span className="text-purple-400">{activeUsers.active.breakdown.admins ?? 0}</span></span>
                            <span>clients <span className="text-cyan-400">{activeUsers.active.breakdown.clients ?? 0}</span></span>
                            <span>other <span className="text-slate-400">{activeUsers.active.breakdown.visitors ?? 0}</span></span>
                          </div>
                        )}
                        {activeUsers.visitors && activeUsers.visitors.length > 0 && (
                          <div className="max-h-24 overflow-y-auto space-y-0.5">
                            {activeUsers.visitors.slice(0, 5).map((v: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-[9px] font-mono text-slate-500 bg-slate-800/30 rounded px-2 py-0.5">
                                <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${v.userId ? 'bg-emerald-500' : 'bg-slate-600'}`} />{v.fingerprint?.slice(0, 10)}…</span>
                                <span>{v.requestCount} req · {v.activeFor}s</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {systemCapacity && (
                          <div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-mono"><span>CAPACITY</span><span className="text-emerald-400">{(activeUsers.active?.total ?? 0)}</span><span className="text-slate-600">/ {systemCapacity.capacity?.estimated?.toLocaleString() ?? '?'}</span></div>
                            <div className="mt-0.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((activeUsers.active?.total ?? 0) / (systemCapacity.capacity?.estimated ?? 1)) * 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-[10px] text-center py-4">{t('platformAdmin.health.noActiveData')}</div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsTab
            platformSettings={platformSettings}
            stats={stats}
            settingsForm={settingsForm}
            setSettingsForm={setSettingsForm}
            onSaveLimits={async () => {
              setSavingLimits(true);
              try {
                await updatePlatformSettings({
                  max_users: settingsForm.max_users,
                  max_stores: settingsForm.max_stores,
                });
                loadPlatformSettings();
                alert(t('platformAdmin.alerts.platformLimitsUpdated'));
              } catch (e) { console.error(e); } finally { setSavingLimits(false); }
            }}
            onSaveSubscription={async () => {
              setSavingSubscription(true);
              try {
                await updatePlatformSettings({
                  subscription_price: settingsForm.subscription_price,
                  trial_days: settingsForm.trial_days,
                });
                loadPlatformSettings();
                alert(t('platformAdmin.alerts.subscriptionSettingsUpdated'));
              } catch (e) { console.error(e); } finally { setSavingSubscription(false); }
            }}
            savingLimits={savingLimits}
            savingSubscription={savingSubscription}
          />
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'billing' && (
          <SubscriptionsTab billingMetrics={billingMetrics} stats={stats} />
        )}

        {/* Platform Bills Tab */}
        {activeTab === 'bills' && (
          <BillsTab />
        )}

        {/* Flag Product Modal */}
        {showFlagModal && flaggedProductId && (
          <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-400" />
                {t('platformAdmin.flag.title')}
              </h3>
              <p className="text-gray-600 dark:text-slate-300 text-sm mb-4">
                {products.find(p => p.id === flaggedProductId)?.title}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">{t('platformAdmin.flag.reason')}</label>
                  <select 
                    value={flagReason} 
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                  >
                    <option value="">{t('platformAdmin.flag.selectReason')}</option>
                    <option value="inappropriate_content">{t('platformAdmin.flag.inappropriate')}</option>
                    <option value="illegal_item">{t('platformAdmin.flag.illegal')}</option>
                    <option value="counterfeit">{t('platformAdmin.flag.counterfeit')}</option>
                    <option value="stolen_goods">{t('platformAdmin.flag.stolen')}</option>
                    <option value="hate_speech">{t('platformAdmin.flag.hateSpeech')}</option>
                    <option value="scam">{t('platformAdmin.flag.scam')}</option>
                    <option value="sexual_content">{t('platformAdmin.flag.adult')}</option>
                    <option value="violence">{t('platformAdmin.flag.violence')}</option>
                    <option value="other">{t('platformAdmin.flag.other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-2">{t('platformAdmin.flag.additionalNotes')}</label>
                  <textarea 
                    value={flagNotes}
                    onChange={(e) => setFlagNotes(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-gray-300/60 dark:border-slate-600/50 text-gray-900 dark:text-white rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
                    rows={3}
                    placeholder={t('platformAdmin.flag.notesPlaceholder')}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowFlagModal(false);
                      setFlagReason('');
                      setFlagNotes('');
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white"
                    disabled={flagging}
                  >
                    {t('platformAdmin.flag.cancel')}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!flagReason) {
                        alert(t('platformAdmin.flag.selectReasonAlert'));
                        return;
                      }

                      setFlagging(true);
                      try {
                        const response = await fetch('/api/admin/flag-product', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          credentials: 'include',
                          body: JSON.stringify({
                            productId: flaggedProductId,
                            reason: flagReason,
                            description: flagNotes
                          })
                        });

                        if (response.ok) {
                          // Update product in state to show flagged
                          setProducts(products.map(p => 
                            p.id === flaggedProductId 
                              ? { ...p, flagged: true, flag_reason: flagReason }
                              : p
                          ));
                          setShowFlagModal(false);
                          setFlagReason('');
                          setFlagNotes('');
                          alert(t('platformAdmin.flag.success'));
                        } else {
                          const error = await response.json();
                          alert(error.error || t('platformAdmin.alerts.errorFlagging'));
                        }
                      } catch (err) {
                        console.error('Error flagging product:', err);
                        alert(t('platformAdmin.alerts.errorFlagging'));
                      } finally {
                        setFlagging(false);
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    disabled={flagging}
                  >
                    {flagging ? t('platformAdmin.flag.flagging') : t('platformAdmin.flag.flagProduct')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Codes Tab */}
        {activeTab === 'codes' && (
          <CodesTab
            stats={stats}
            generatedCodes={generatedCodes}
            codesLoading={codesLoading}
            issuingCode={issuingCode}
            lastGeneratedCode={lastGeneratedCode}
            onIssueCode={handleIssueCode}
            onDismissCode={() => setLastGeneratedCode(null)}
          />
        )}

        {/* Affiliates Tab */}
        {activeTab === 'affiliates' && (
          <div className="bg-gray-50/40 dark:bg-slate-900/40 border border-slate-700/60 rounded-xl p-4">
            <AdminAffiliatesPage />
          </div>
        )}

        {/* AI Intelligence Tab */}
        {activeTab === 'ai' && (
          <AITab />
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <ToolsTab LockedAccountsManager={LockedAccountsManager} />
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <NotesTab
            notes={adminNotes}
            loading={notesLoading}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            onTogglePin={handleTogglePin}
            saving={savingNote}
          />
        )}
      </div>
    </div>
    </>
  );
}

