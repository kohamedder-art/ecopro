import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Search, Lock, Unlock, CheckCircle, X, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

export default function LockedAccountsManager() {
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

  const getDaysLeft = (account: LockedAccount) => {
    const endDate = account.subscription_extended_until || account.subscription_ends_at;
    if (!endDate) return null;
    const endMs = new Date(endDate).getTime();
    if (!Number.isFinite(endMs)) return null;
    return Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
  };

  const filteredAccounts = allAccounts.filter(acc => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!acc.email.toLowerCase().includes(query) && !acc.name?.toLowerCase().includes(query)) {
        return false;
      }
    }
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

  async function quickUnlock(accountId: number) {
    setQuickProcessing(accountId);
    try {
      const response = await fetch('/api/admin/unlock-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
      alert(t('platformAdmin.alerts.errorUnlocking'));
    } finally {
      setQuickProcessing(null);
    }
  }

  async function quickLock(accountId: number) {
    const lockReason = prompt(t('platformAdmin.alerts.enterLockReason'));
    if (!lockReason) return;

    setQuickProcessing(accountId);
    try {
      const response = await fetch('/api/admin/lock-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: accountId, reason: lockReason })
      });
      if (response.ok) {
        await fetchAllAccounts();
      } else {
        const error = await response.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch {
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
          ? { client_id: clientId, unlock_reason: reason, action, days: action === 'extend' ? extendDays : undefined }
          : { client_id: clientId, reason };
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    } catch {
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
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin"><Zap className="w-10 h-10 text-amber-400" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-xl border border-amber-500/20 p-4">
        <h2 className="font-bold text-amber-300 flex items-center gap-2 text-xl mb-1">
          <Lock className="w-5 h-5" />
          {t('platformAdmin.subscription.title')}
        </h2>
        <p className="text-amber-200/80 text-sm">{t('platformAdmin.subscription.desc')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white/40 dark:bg-slate-800/40 rounded-lg border border-gray-200/50 dark:border-slate-700/50 p-3">
          <div className="text-xs text-gray-500 dark:text-slate-400">{t('platformAdmin.subscription.total')}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{allAccounts.length}</div>
        </div>
        <div className="bg-red-500/5 rounded-lg border border-red-500/20 p-3">
          <div className="text-xs text-red-300">🔒 {t('platformAdmin.subscription.locked')}</div>
          <div className="text-2xl font-bold text-red-400">{lockedCount}</div>
        </div>
        <div className="bg-green-500/5 rounded-lg border border-green-500/20 p-3">
          <div className="text-xs text-green-300">✅ {t('platformAdmin.subscription.active')}</div>
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
        </div>
        <div className={`rounded-lg border p-3 ${expiringCount > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/40 dark:bg-slate-800/40 border-gray-200/50 dark:border-slate-700/50'}`}>
          <div className="text-xs text-yellow-300">⚠️ {t('platformAdmin.subscription.expiring')}</div>
          <div className={`text-2xl font-bold ${expiringCount > 0 ? 'text-yellow-400' : 'text-gray-500 dark:text-slate-500'}`}>{expiringCount}</div>
        </div>
        <div className={`rounded-lg border p-3 ${hackerCount > 0 ? 'bg-orange-500/10 border-orange-500/30 animate-pulse' : 'bg-white/40 dark:bg-slate-800/40 border-gray-200/50 dark:border-slate-700/50'}`}>
          <div className="text-xs text-orange-300">🚨 {t('platformAdmin.subscription.hackers')}</div>
          <div className={`text-2xl font-bold ${hackerCount > 0 ? 'text-orange-400' : 'text-gray-500 dark:text-slate-500'}`}>{hackerCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder={t('platformAdmin.subscription.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/40 dark:bg-slate-800/40 border border-gray-200/50 dark:border-slate-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm py-2.5 pl-10 pr-4"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: t('platformAdmin.subscription.all'), count: allAccounts.length },
            { key: 'locked', label: t('platformAdmin.subscription.locked'), count: lockedCount },
            { key: 'active', label: t('platformAdmin.subscription.active'), count: activeCount },
            { key: 'expiring', label: t('platformAdmin.subscription.expiring'), count: expiringCount },
            { key: 'hackers', label: '🚨', count: hackerCount },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/30 text-gray-600 dark:text-slate-300 hover:bg-slate-600/30'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {selectedAccounts.length > 0 && (
        <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg border border-cyan-500/20 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-cyan-300 font-medium">{t('platformAdmin.subscription.selected', { count: selectedAccounts.length })}</span>
            <div className="flex gap-2">
              <Button onClick={() => { setModalMode('unlock'); setShowModal(true); }} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                <Unlock className="w-4 h-4 mr-1.5" /> {t('platformAdmin.subscription.unlock')}
              </Button>
              <Button onClick={() => { setModalMode('lock'); setShowModal(true); }} className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white">
                <Lock className="w-4 h-4 mr-1.5" /> {t('platformAdmin.subscription.lock')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700/50 bg-gray-100/50 dark:bg-slate-900/50">
                <th className="p-3 w-[50px]">
                  <input type="checkbox" checked={selectedAccounts.length === filteredAccounts.length && filteredAccounts.length > 0} onChange={toggleSelectAll} className="rounded border-slate-500/50 w-4 h-4" />
                </th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold p-3 text-sm">{t('platformAdmin.table.status')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold p-3 text-sm">{t('platformAdmin.table.account')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold p-3 text-sm hidden md:table-cell">{t('platformAdmin.table.subscription')}</th>
                <th className="text-left text-gray-600 dark:text-slate-300 font-semibold p-3 text-sm hidden lg:table-cell">{t('platformAdmin.table.reason')}</th>
                <th className="text-right text-gray-600 dark:text-slate-300 font-semibold p-3 text-sm">{t('platformAdmin.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 dark:text-slate-400 py-12">
                    <CheckCircle className="mx-auto opacity-50 w-10 h-10 mb-2" />
                    <p>{searchQuery ? t('platformAdmin.subscription.noMatchingAccounts') : filterStatus === 'locked' ? t('platformAdmin.subscription.noLockedAccounts') : filterStatus === 'hackers' ? t('platformAdmin.subscription.noHackers') : t('platformAdmin.subscription.noAccountsFound')}</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(account => {
                  const isHoneypot = account.locked_reason?.includes('HONEYPOT');
                  const daysLeft = getDaysLeft(account);
                  const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
                  const isExpired = daysLeft !== null && daysLeft <= 0;
                  return (
                    <tr key={account.id} className={`border-b border-gray-200/20 dark:border-slate-700/20 hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors ${isHoneypot ? 'bg-orange-500/10' : account.is_locked ? 'bg-red-500/5' : isExpiring ? 'bg-yellow-500/5' : ''}`}>
                      <td className="p-3">
                        <input type="checkbox" checked={selectedAccounts.includes(account.id)} onChange={() => toggleSelect(account.id)} className="rounded border-slate-500/50 w-4 h-4" />
                      </td>
                      <td className="p-3">
                        {isHoneypot ? (
                          <Badge className="bg-orange-600 animate-pulse">{t('platformAdmin.subscription.hacker')}</Badge>
                        ) : account.is_locked ? (
                          <Badge className="bg-red-600">{t('platformAdmin.subscription.lockedBadge')}</Badge>
                        ) : isExpiring ? (
                          <Badge className="bg-yellow-600">{t('platformAdmin.subscription.expiringBadge')}</Badge>
                        ) : (
                          <Badge className="bg-green-600">{t('platformAdmin.subscription.activeBadge')}</Badge>
                        )}
                        {account.is_paid_temporarily && <Badge className="bg-blue-600 ml-1 text-[10px]">{t('platformAdmin.subscription.temp')}</Badge>}
                      </td>
                      <td className="p-3">
                        <div className="text-gray-900 dark:text-white font-medium text-sm">{account.name || t('platformAdmin.subscription.noName')}</div>
                        <div className="text-gray-500 dark:text-slate-400 font-mono text-xs">{account.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {daysLeft !== null ? (
                          <div>
                            <div className={`font-medium ${isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-green-400'} text-sm`}>
                              {isExpired ? t('platformAdmin.subscription.expiredDaysAgo', { days: Math.abs(daysLeft) }) : t('platformAdmin.subscription.daysLeftLabel', { days: daysLeft })}
                            </div>
                            <div className="text-gray-500 dark:text-slate-500 text-xs">{new Date(account.subscription_extended_until || account.subscription_ends_at || '').toLocaleDateString()}</div>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-slate-500 text-sm">{t('platformAdmin.subscription.noData')}</span>
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell max-w-[180px]">
                        <div className="text-gray-500 dark:text-slate-400 truncate text-sm">
                          {account.is_locked ? account.locked_reason || t('platformAdmin.subscription.subExpired') : account.unlock_reason || '—'}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {quickProcessing === account.id ? (
                          <div className="animate-spin inline-block"><Zap className="w-5 h-5 text-amber-400" /></div>
                        ) : account.is_locked ? (
                          <Button onClick={() => quickUnlock(account.id)} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                            <Unlock className="w-3.5 h-3.5 mr-1" /> {t('platformAdmin.subscription.unlock')}
                          </Button>
                        ) : (
                          <Button onClick={() => quickLock(account.id)} size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/20">
                            <Lock className="w-3.5 h-3.5 mr-1" /> {t('platformAdmin.subscription.lock')}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/50 dark:border-slate-700/50 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                {modalMode === 'unlock' ? t('platformAdmin.modal.unlockAndExtend') : t('platformAdmin.modal.lockAccount')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {modalMode === 'unlock' && (
                <>
                  <div>
                    <label className="block font-medium text-gray-600 dark:text-slate-300 text-sm mb-2">{t('platformAdmin.modal.action')}</label>
                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-3 rounded-lg border border-gray-300/50 dark:border-slate-600/50 cursor-pointer hover:bg-gray-200/30 dark:hover:bg-slate-700/30 p-3 ${action === 'extend' ? 'bg-blue-500/10 border-blue-500/30' : ''}`}>
                        <input type="radio" checked={action === 'extend'} onChange={() => setAction('extend')} name="action" className="w-4 h-4" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{t('platformAdmin.modal.extendSubscription')}</div>
                          <div className="text-gray-500 dark:text-slate-400 text-xs">{t('platformAdmin.modal.addDays')}</div>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 rounded-lg border border-gray-300/50 dark:border-slate-600/50 cursor-pointer hover:bg-gray-200/30 dark:hover:bg-slate-700/30 p-3 ${action === 'mark_paid' ? 'bg-green-500/10 border-green-500/30' : ''}`}>
                        <input type="radio" checked={action === 'mark_paid'} onChange={() => setAction('mark_paid')} name="action" className="w-4 h-4" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{t('platformAdmin.modal.markAsPaid')}</div>
                          <div className="text-gray-500 dark:text-slate-400 text-xs">{t('platformAdmin.modal.grant30days')}</div>
                        </div>
                      </label>
                    </div>
                  </div>
                  {action === 'extend' && (
                    <div>
                      <label className="block font-medium text-gray-600 dark:text-slate-300 text-sm mb-1.5">{t('platformAdmin.modal.daysToExtend')}</label>
                      <input type="number" value={extendDays} onChange={(e) => setExtendDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))} min="1" max="365" className="w-full bg-gray-100/30 dark:bg-slate-900/30 border border-gray-300/50 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-white text-sm p-2.5" />
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block font-medium text-gray-600 dark:text-slate-300 text-sm mb-1.5">
                  {modalMode === 'unlock' ? t('platformAdmin.modal.unlockReason') : t('platformAdmin.modal.lockReason')}
                </label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={modalMode === 'unlock' ? t('platformAdmin.modal.unlockPlaceholder') : t('platformAdmin.modal.lockPlaceholder')} className="w-full bg-gray-100/30 dark:bg-slate-900/30 border border-gray-300/50 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm p-2.5" rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowModal(false)} variant="ghost" className="flex-1" disabled={processing}>{t('platformAdmin.modal.cancel')}</Button>
                <Button onClick={handleProcess} className={`flex-1 ${modalMode === 'unlock' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-orange-600'}`} disabled={processing || !reason.trim()}>
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