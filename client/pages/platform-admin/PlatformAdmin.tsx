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
import GlobalAnnouncementsManager from '@/components/platform-admin/GlobalAnnouncementsManager';
import AdminAffiliatesPage from '@/pages/platform-admin/AdminAffiliatesPage';
import Header from '@/components/layout/Header';
import OverviewTab from '@/components/platform-admin/tabs/OverviewTab';
import UsersTab from '@/components/platform-admin/tabs/UsersTab';
import StoresTab from '@/components/platform-admin/tabs/StoresTab';
import ProductsTab from '@/components/platform-admin/tabs/ProductsTab';
import HealthTab from '@/components/platform-admin/tabs/HealthTab';
import ErrorsTab from '@/components/platform-admin/tabs/ErrorsTab';
import SubscriptionsTab from '@/components/platform-admin/tabs/SubscriptionsTab';
import CodesTab from '@/components/platform-admin/tabs/CodesTab';
import AITab from '@/components/platform-admin/tabs/AITab';
import ToolsTab from '@/components/platform-admin/tabs/ToolsTab';
import SettingsTab from '@/components/platform-admin/tabs/SettingsTab';
import NotesTab from '@/components/platform-admin/tabs/NotesTab';
import BillsTab from '@/components/platform-admin/tabs/BillsTab';
import PixelsTab from '@/components/platform-admin/tabs/PixelsTab';
import LockedAccountsManager from '@/components/platform-admin/LockedAccountsManager';
import PlatformAdminSidebar from '@/components/platform-admin/PlatformAdminSidebar';

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
  live_views: number;
  is_live: boolean;
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
  const [productPage, setProductPage] = useState(1);
  const [productSort, setProductSort] = useState('newest');
  const [productTotal, setProductTotal] = useState(0);
  const [hideTestProducts, setHideTestProducts] = useState(true);
  const [liveFilter, setLiveFilter] = useState('');
  const [liveProductsCount, setLiveProductsCount] = useState(0);
  const [liveStoresCount, setLiveStoresCount] = useState(0);
  const [stores, setStores] = useState<Store[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [logMode, setLogMode] = useState<'staff' | 'admin'>('staff');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'stores' | 'products' | 'activity' | 'errors' | 'health' | 'settings' | 'billing' | 'payment-failures' | 'codes' | 'tools' | 'affiliates' | 'notes' | 'ai' | 'bills' | 'pixels'>('overview');

  const [platformErrorDays, setPlatformErrorDays] = useState(3);
  const [platformErrorSource, setPlatformErrorSource] = useState<'all' | 'client' | 'server'>('all');
  const [platformErrorsLoading, setPlatformErrorsLoading] = useState(false);
  const [platformErrorsError, setPlatformErrorsError] = useState<string | null>(null);
  const [platformErrors, setPlatformErrors] = useState<any[]>([]);
  const [platformErrorView, setPlatformErrorView] = useState<'active' | 'all'>('active');
  const [platformErrorActiveMinutes, setPlatformErrorActiveMinutes] = useState(60);
  const [platformErrorGroup, setPlatformErrorGroup] = useState(true);
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
        fetch(`/api/admin/products?page=${productPage}&limit=50&sort=${productSort}&hideTest=${hideTestProducts}&live=${liveFilter}`).catch(() => null),
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
        const data = await productsRes.json();
        const items = Array.isArray(data) ? data : (data.products || []);
        setProducts(items);
        setProductTotal(data.total ?? items.length);
        setLiveProductsCount(data.liveProducts ?? 0);
        setLiveStoresCount(data.liveStores ?? 0);

        const activeProducts = items.filter((p: Product) => p.status === 'active').length;

        setStats(prev => ({
          ...prev,
          totalProducts: data.total ?? items.length,
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

  // Separate product fetch for pagination/sort changes (avoids re-fetching everything)
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/products?page=${productPage}&limit=50&sort=${productSort}&hideTest=${hideTestProducts}&live=${liveFilter}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.products || []);
        setProducts(items);
        setProductTotal(data.total ?? items.length);
        setLiveProductsCount(data.liveProducts ?? 0);
        setLiveStoresCount(data.liveStores ?? 0);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, [productPage, productSort, hideTestProducts, liveFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

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
        <div className="flex gap-4" style={{ direction: 'rtl' }}>
          <PlatformAdminSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onBillingClick={() => { loadBillingMetrics(); loadPlatformSettings(); }}
            onCodesClick={loadCodes}
            onNotesClick={loadAdminNotes}
            onSettingsClick={loadPlatformSettings}
            onHealthClick={() => {}}
          />
          <div className="flex-1 min-w-0">

        {/* Mobile tab bar — horizontally scrollable row visible on small screens */}
        <div className="lg:hidden sticky top-0 z-10 mb-3 -mx-2 px-2 pt-2 pb-1 overflow-x-auto bg-gradient-to-b from-gray-50 via-gray-50 to-transparent dark:from-slate-900 dark:via-slate-900 dark:to-transparent">
          <div className="flex gap-1.5 min-w-max">
            {[
              { key: 'overview' as const, label: 'Overview' },
              { key: 'users' as const, label: 'Users' },
              { key: 'stores' as const, label: 'Stores' },
              { key: 'products' as const, label: 'Products' },
              { key: 'billing' as const, label: 'Subscriptions' },
              { key: 'codes' as const, label: 'Codes' },
              { key: 'bills' as const, label: 'Bills' },
              { key: 'health' as const, label: 'Health' },
              { key: 'errors' as const, label: 'Errors' },
              { key: 'activity' as const, label: 'Activity' },
              { key: 'ai' as const, label: 'AI' },
              { key: 'tools' as const, label: 'Tools' },
              { key: 'notes' as const, label: 'Notes' },
              { key: 'pixels' as const, label: 'Pixels' },
              { key: 'settings' as const, label: 'Settings' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
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
            total={productTotal}
            page={productPage}
            sort={productSort}
            hideTest={hideTestProducts}
            liveProducts={liveProductsCount}
            liveStores={liveStoresCount}
            onPageChange={setProductPage}
            onSortChange={(sort) => { setProductSort(sort); setProductPage(1); }}
            onHideTestChange={(v) => { setHideTestProducts(v); setProductPage(1); }}
            onLiveFilterChange={(f) => { setLiveFilter(f); setProductPage(1); }}
          />
        )}

        {/* Announcement Tab (formerly Activity) */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <GlobalAnnouncementsManager />
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && <HealthTab />}

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

        {/* Pixels Tab */}
        {activeTab === 'pixels' && <PixelsTab />}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

