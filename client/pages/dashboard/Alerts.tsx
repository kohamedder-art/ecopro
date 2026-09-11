import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useStore } from '@/contexts/StoreContext';

interface Alert {
  id: number;
  type: 'urgent' | 'warning' | 'info';
  message: string;
  link?: string;
  status: 'unread' | 'read' | 'dismissed';
}

export default function AlertsPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const isRTL = locale === 'ar';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'warning' | 'info'>('all');

  const fetchAlerts = () => {
    fetch('/api/ai/alerts', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, [activeStore?.id]);

  const dismissAll = async () => {
    await fetch('/api/ai/alerts/dismiss-all', { method: 'POST', credentials: 'include' });
    setAlerts([]);
  };

  const dismissOne = async (id: number) => {
    setDismissing(id);
    await fetch(`/api/ai/alerts/${id}/dismiss`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAlerts(prev => prev.filter(a => a.id !== id));
    setDismissing(null);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const typeBg = (type: string) => {
    switch (type) {
      case 'urgent': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50';
      case 'warning': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50';
      default: return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50';
    }
  };

  const unreadCount = alerts.filter(a => a.status === 'unread').length;
  const visibleAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'unread') return a.status === 'unread';
    return a.type === filter;
  });
  const tabs = [
    { key: 'all', label: isRTL ? 'الكل' : 'All', count: alerts.length },
    { key: 'unread', label: isRTL ? 'غير المقروء' : 'Unread', count: unreadCount },
    { key: 'urgent', label: isRTL ? 'عاجل' : 'Urgent', count: alerts.filter(a => a.type === 'urgent').length },
    { key: 'warning', label: isRTL ? 'تنبيه' : 'Warnings', count: alerts.filter(a => a.type === 'warning').length },
    { key: 'info', label: isRTL ? 'معلومات' : 'Info', count: alerts.filter(a => a.type === 'info').length },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" />
            {isRTL ? 'التنبيهات' : 'Alerts'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isRTL ? 'أحداث مهمة تحتاج انتباهك في متجرك' : 'Important events needing your attention'}
          </p>
        </div>
        {alerts.length > 0 && (
          <Button variant="outline" size="sm" onClick={dismissAll} className="text-xs">
            <CheckCheck className="w-3.5 h-3.5 ml-1.5" />
            {isRTL ? 'تجاهل الكل' : 'Dismiss All'}
          </Button>
        )}
      </div>

      {/* Summary card */}
      {!loading && alerts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-center">
            <p className="text-2xl font-black text-red-600">{alerts.filter(a => a.type === 'urgent').length}</p>
            <p className="text-xs text-red-500 mt-0.5">{isRTL ? 'عاجل' : 'Urgent'}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-center">
            <p className="text-2xl font-black text-amber-600">{alerts.filter(a => a.type === 'warning').length}</p>
            <p className="text-xs text-amber-500 mt-0.5">{isRTL ? 'تنبيه' : 'Warnings'}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 text-center">
            <p className="text-2xl font-black text-blue-600">{alerts.filter(a => a.type === 'info').length}</p>
            <p className="text-xs text-blue-500 mt-0.5">{isRTL ? 'معلومات' : 'Info'}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCheck className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
            {isRTL ? 'كل شي تمام!' : 'All clear!'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
            {isRTL ? 'لا توجد تنبيهات جديدة. سنخبرك عند وجود أي حدث مهم.' : 'No new alerts. We\'ll notify you when something needs attention.'}
          </p>
        </div>
      )}

      {/* Filter tabs */}
      {!loading && alerts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === tab.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
              <span className="mr-1.5 tabular-nums opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Alerts list */}
      {!loading && alerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">{isRTL ? 'لا شيء في هذا القسم' : 'Nothing here'}</p>
          ) : visibleAlerts.map((alert, i) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border ${typeBg(alert.type)} flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 ${alert.status === 'unread' ? 'shadow-sm' : 'opacity-90'}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="mt-0.5 flex-shrink-0 relative">
                {typeIcon(alert.type)}
                {alert.status === 'unread' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-current border-2 border-white dark:border-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${alert.status === 'unread' ? 'font-bold' : 'font-semibold'} text-slate-800 dark:text-slate-200`}>{alert.message}</p>
                <div className="flex items-center gap-3 mt-2">
                  {alert.link && (
                    <button
                      onClick={() => navigate(alert.link!)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {isRTL ? 'اذهب للصفحة' : 'Go to page'}
                    </button>
                  )}
                  <button
                    onClick={() => dismissOne(alert.id)}
                    disabled={dismissing === alert.id}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                  >
                    {dismissing === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    {isRTL ? 'تجاهل' : 'Dismiss'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
