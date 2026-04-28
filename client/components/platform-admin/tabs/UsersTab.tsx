import { useState, useMemo } from 'react';
import { Users, Search, Shield, Trash2, Lock, Unlock, UserCheck, Mail, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  user_type: string;
  created_at: string;
  is_super?: boolean;
}

interface Props {
  users: User[];
  onRefresh: () => void;
  loading: boolean;
}

export default function UsersTab({ users, onRefresh, loading }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'client'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => u.email.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter || u.user_type === roleFilter);
    }
    if (sortBy === 'newest') result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'oldest') result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return result;
  }, [users, search, roleFilter, sortBy]);

  const adminCount = users.filter(u => u.role === 'admin' || u.user_type === 'admin').length;
  const clientCount = users.filter(u => u.role === 'client' || u.user_type === 'client').length;

  async function deleteUser(userId: number, userType: string) {
    if (!confirm(t('platformAdmin.users.deleteConfirm'))) return;
    setProcessing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_type: userType }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete user');
      }
    } catch { alert('Error deleting user'); }
    setProcessing(null);
  }

  async function promoteUser(email: string) {
    if (!confirm(`${t('platformAdmin.users.promote')} ${email}?`)) return;
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (res.ok) onRefresh();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed');
      }
    } catch { alert('Error'); }
  }

  function getInitials(name: string, email: string) {
    if (name) return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return email.substring(0, 2).toUpperCase();
  }

  function getRoleBadge(user: User) {
    const role = user.role || user.user_type;
    if (role === 'admin') return <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">{t('platformAdmin.users.admin')}</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px]">{t('platformAdmin.users.client')}</Badge>;
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('platformAdmin.users.total')}</span>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{users.length}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('platformAdmin.users.admins')}</span>
          </div>
          <p className="text-2xl font-black text-purple-400 mt-1">{adminCount}</p>
        </div>
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 p-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('platformAdmin.users.clients')}</span>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1">{clientCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder={t('platformAdmin.users.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm pl-10 pr-4 py-2.5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'admin', 'client'] as const).map(f => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                roleFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? t('platformAdmin.users.all') : f === 'admin' ? t('platformAdmin.users.admins') : t('platformAdmin.users.clients')}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-lg text-xs text-gray-600 dark:text-slate-300 px-3 py-2 outline-none"
        >
          <option value="newest">{t('platformAdmin.users.newestFirst')}</option>
          <option value="oldest">{t('platformAdmin.users.oldestFirst')}</option>
          <option value="name">{t('platformAdmin.users.byName')}</option>
        </select>
      </div>

      {/* Users List */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('platformAdmin.users.noMatch')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700/30">
            {filtered.slice(0, 50).map(user => (
              <div key={user.id} className="group hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors">
                <div className="flex items-center gap-3 p-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    (user.role === 'admin' || user.user_type === 'admin')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-700/50 text-gray-600 dark:text-slate-300 border border-slate-600/30'
                  }`}>
                    {getInitials(user.name, user.email)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name || t('platformAdmin.users.noName')}</p>
                      {getRoleBadge(user)}
                      {user.is_super && <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">{t('platformAdmin.users.super')}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{user.email}</p>
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-gray-500 dark:text-slate-500 hidden md:block">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(user.role !== 'admin' && user.user_type !== 'admin') && (
                      <button
                        onClick={() => promoteUser(user.email)}
                        className="p-1.5 rounded-lg hover:bg-purple-500/20 text-gray-500 dark:text-slate-400 hover:text-purple-300 transition-colors"
                        title={t('platformAdmin.users.promote')}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteUser(user.id, user.user_type)}
                      disabled={processing === user.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 dark:text-slate-400 hover:text-red-300 transition-colors"
                      title={t('platformAdmin.users.deleteUser')}
                    >
                      {processing === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Expand */}
                  <button
                    onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                    className="p-1 text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white transition-colors"
                  >
                    {expandedUser === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedUser === user.id && (
                  <div className="px-3 pb-3 ml-12 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <Mail className="w-3 h-3" />
                      <span>{user.email}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-500">
                      {t('platformAdmin.users.id')}: {user.id} · {t('platformAdmin.users.role')}: {user.role || user.user_type} · {t('platformAdmin.users.joined')}: {new Date(user.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length > 50 && (
              <div className="py-3 text-center text-xs text-gray-500 dark:text-slate-500">
                {t('platformAdmin.users.showingOf', { count: String(filtered.length) })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
