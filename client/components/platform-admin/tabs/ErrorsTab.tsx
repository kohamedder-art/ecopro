import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, RefreshCw, Search, Filter, Loader2, Bug, Server, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface Props {
  errors: any[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  days: number;
  setDays: (d: number) => void;
  source: 'all' | 'client' | 'server';
  setSource: (s: 'all' | 'client' | 'server') => void;
}

export default function ErrorsTab({ errors, loading, error: loadError, onReload, days, setDays, source, setSource }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeMinutes, setActiveMinutes] = useState(60);
  const [view, setView] = useState<'active' | 'all'>('active');
  const [grouped, setGrouped] = useState(true);

  const now = Date.now();
  const cutoff = now - activeMinutes * 60 * 1000;

  const toMs = (v: any): number => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };
  const toWhere = (ev: any): string => ev?.path ? `${ev?.method || ''} ${ev?.path}`.trim() : String(ev?.url || '');

  const displayErrors = useMemo(() => {
    let result = errors;
    if (view === 'active') {
      result = result.filter(ev => toMs(ev.timestamp || ev.created_at) >= cutoff);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(ev => {
        const msg = String(ev.message || ev.error || '').toLowerCase();
        const where = toWhere(ev).toLowerCase();
        return msg.includes(q) || where.includes(q);
      });
    }
    if (grouped) {
      const map = new Map<string, { ev: any; count: number; latest: number }>();
      for (const ev of result) {
        const key = `${String(ev.message || ev.error || '').slice(0, 80)}::${ev.status || ''}`;
        const ts = toMs(ev.timestamp || ev.created_at);
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          if (ts > existing.latest) { existing.latest = ts; existing.ev = ev; }
        } else {
          map.set(key, { ev, count: 1, latest: ts });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.latest - a.latest);
    }
    return result.map(ev => ({ ev, count: 1, latest: toMs(ev.timestamp || ev.created_at) })).sort((a, b) => b.latest - a.latest);
  }, [errors, view, search, grouped, cutoff]);

  const activeCount = errors.filter(ev => toMs(ev.timestamp || ev.created_at) >= cutoff).length;

  function getSeverityColor(ev: any) {
    const status = Number(ev.status || ev.statusCode || 0);
    if (status >= 500) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (status >= 400) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-gray-900 dark:text-white font-bold flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-400" />
            {t('platformAdmin.errors.title')}
          </h3>
          {activeCount > 0 && (
            <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
              {activeCount} {t('platformAdmin.errors.active')}
            </Badge>
          )}
        </div>
        <Button onClick={onReload} disabled={loading} className="bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white text-xs h-8">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          {t('platformAdmin.errors.refresh')}
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder={t('platformAdmin.errors.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm pl-10 pr-4 py-2 focus:border-red-500/50 outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('active')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === 'active' ? 'bg-red-600 text-white' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400'}`}>
            {t('platformAdmin.errors.active')} ({activeCount})
          </button>
          <button onClick={() => setView('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === 'all' ? 'bg-red-600 text-white' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400'}`}>
            {t('platformAdmin.errors.all')} ({errors.length})
          </button>
        </div>
        <div className="flex gap-1">
          {(['all', 'client', 'server'] as const).map(s => (
            <button key={s} onClick={() => setSource(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${source === s ? 'bg-slate-600 text-gray-900 dark:text-white' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400'}`}
            >
              {s === 'server' ? <Server className="w-3 h-3" /> : s === 'client' ? <Globe className="w-3 h-3" /> : <Filter className="w-3 h-3" />}
              {s === 'all' ? t('platformAdmin.errors.all') : s === 'client' ? t('platformAdmin.errors.client') : t('platformAdmin.errors.server')}
            </button>
          ))}
        </div>
        <button onClick={() => setGrouped(!grouped)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${grouped ? 'bg-purple-600 text-white' : 'bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400'}`}
        >
          {grouped ? t('platformAdmin.errors.grouped') : t('platformAdmin.errors.ungrouped')}
        </button>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-white/60 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-lg text-xs text-gray-600 dark:text-slate-300 px-2 py-1.5"
        >
          <option value={1}>{t('platformAdmin.errors.last24h')}</option>
          <option value={3}>{t('platformAdmin.errors.last3days')}</option>
          <option value={7}>{t('platformAdmin.errors.last7days')}</option>
        </select>
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-200 text-sm">{loadError}</div>
      )}

      {/* Error List */}
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/40 overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-400" /></div>
        ) : displayErrors.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
            <p className="text-emerald-300 text-sm font-medium">{t('platformAdmin.errors.noErrors')}</p>
            <p className="text-gray-500 dark:text-slate-500 text-xs mt-1">{t('platformAdmin.errors.platformClean')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700/30">
            {displayErrors.slice(0, 50).map(({ ev, count, latest }, i) => {
              const status = Number(ev.status || ev.statusCode || 0);
              const severity = getSeverityColor(ev);
              const msg = String(ev.message || ev.error || t('platformAdmin.errors.unknownError'));
              const where = toWhere(ev);
              return (
                <div key={i} className="p-3 hover:bg-gray-50/30 dark:bg-slate-900/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Severity Badge */}
                    <div className={`px-2 py-0.5 rounded-md border text-xs font-mono font-bold flex-shrink-0 ${severity}`}>
                      {status || '???'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{msg.slice(0, 120)}</p>
                      {where && <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5 font-mono truncate">{where}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-gray-500 dark:text-slate-500">
                          {new Date(latest).toLocaleString()}
                        </span>
                        {ev.source && (
                          <Badge className="bg-slate-700/50 text-gray-500 dark:text-slate-400 text-[10px]">{ev.source}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Count */}
                    {count > 1 && (
                      <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-mono">
                        x{count}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
