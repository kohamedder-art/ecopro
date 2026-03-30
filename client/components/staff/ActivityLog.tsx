import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Package, User, Settings, Trash2, FileText, Activity, ChevronDown } from 'lucide-react';

interface ActivityLogEntry {
  id: number;
  staff_id: number;
  action: string;
  resource_type?: string;
  resource_id?: number;
  resource_name?: string;
  before_value?: Record<string, any>;
  after_value?: Record<string, any>;
  timestamp: string;
}

interface ActivityLogProps {
  storeId: number;
  staffId?: number | null;
}

const ACTION_META: Record<string, { icon: React.ReactNode; gradient: string; shadow: string }> = {
  staff_invited:        { icon: <User className="h-3.5 w-3.5 text-white" />,     gradient: 'from-blue-500 to-indigo-600',   shadow: 'shadow-blue-500/30' },
  staff_removed:        { icon: <User className="h-3.5 w-3.5 text-white" />,     gradient: 'from-red-500 to-rose-600',      shadow: 'shadow-red-500/30' },
  permissions_updated:  { icon: <Settings className="h-3.5 w-3.5 text-white" />, gradient: 'from-amber-500 to-orange-600',  shadow: 'shadow-amber-500/30' },
  product_created:      { icon: <Package className="h-3.5 w-3.5 text-white" />,  gradient: 'from-emerald-500 to-teal-600',  shadow: 'shadow-emerald-500/30' },
  product_deleted:      { icon: <Trash2 className="h-3.5 w-3.5 text-white" />,   gradient: 'from-red-500 to-rose-600',      shadow: 'shadow-red-500/30' },
  product_updated:      { icon: <Package className="h-3.5 w-3.5 text-white" />,  gradient: 'from-sky-500 to-blue-600',      shadow: 'shadow-sky-500/30' },
  order_deleted:        { icon: <Trash2 className="h-3.5 w-3.5 text-white" />,   gradient: 'from-red-500 to-rose-600',      shadow: 'shadow-red-500/30' },
  order_status_updated: { icon: <FileText className="h-3.5 w-3.5 text-white" />, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30' },
};

const DEFAULT_META = { icon: <FileText className="h-3.5 w-3.5 text-white" />, gradient: 'from-slate-500 to-gray-600', shadow: 'shadow-slate-500/30' };

export function ActivityLog({ storeId, staffId }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadActivityLogs(); }, [staffId]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const url = staffId
        ? `/api/client/staff/${staffId}/activity?limit=100`
        : `/api/client/staff/0/activity?limit=100`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load activity logs');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string) =>
    action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3">
          <Activity className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-muted-foreground">No activity logs found</p>
        <p className="text-sm text-muted-foreground mt-1">Actions will appear here as staff perform tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/30">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-base font-extrabold">Activity Logs</p>
          <p className="text-sm text-muted-foreground">Track all staff actions</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute top-0 bottom-0 left-[18px] w-px bg-slate-200/80 dark:bg-slate-700/60" />

        <div className="space-y-2">
          {logs.map((log) => {
            const meta = ACTION_META[log.action] || DEFAULT_META;

            return (
              <div key={log.id} className="relative flex gap-3 pl-0">
                {/* Timeline dot */}
                <div className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} shadow-md ${meta.shadow} flex-shrink-0`}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 p-3 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-extrabold">{formatAction(log.action)}</span>
                        {log.resource_type && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-sm font-bold border bg-gradient-to-r from-slate-500/10 to-gray-500/10 border-slate-300/40 dark:border-slate-700/40 text-slate-600 dark:text-slate-400">
                            {log.resource_type}
                          </span>
                        )}
                      </div>
                      {log.resource_name && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{log.resource_name}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Changes diff */}
                  {log.before_value && log.after_value && (
                    <details className="mt-2 group">
                      <summary className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none list-none [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        View changes
                      </summary>
                      <div className="mt-1.5 text-xs space-y-0.5 bg-slate-50/80 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100/60 dark:border-slate-700/40">
                        {Object.keys(log.after_value).map((key) => (
                          <div key={key}>
                            <span className="font-bold text-muted-foreground">{key}:</span>{' '}
                            <span className="text-red-500 line-through">{String(log.before_value?.[key])}</span>
                            {' → '}
                            <span className="text-emerald-600 dark:text-emerald-400">{String(log.after_value![key])}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
