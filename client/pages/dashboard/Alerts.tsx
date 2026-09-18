import { useState, useEffect, useMemo } from "react";
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

type FilterKey = 'all' | 'unread' | 'urgent' | 'warning' | 'info';

const TYPE_META: Record<string, { icon: typeof Bell; gradient: string; shadow: string; bar: string }> = {
  urgent: { icon: AlertTriangle, gradient: 'from-red-500 to-red-600', shadow: 'shadow-red-500/20', bar: 'from-red-500 to-orange-500' },
  warning: { icon: AlertCircle, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20', bar: 'from-amber-500 to-yellow-500' },
  info: { icon: Info, gradient: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/20', bar: 'from-blue-500 to-cyan-500' },
};

export default function AlertsPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const isRTL = locale === 'ar';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

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

  const counts = useMemo(() => ({
    all: alerts.length,
    unread: alerts.filter(a => a.status === 'unread').length,
    urgent: alerts.filter(a => a.type === 'urgent').length,
    warning: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length,
    unreadUrgent: alerts.filter(a => a.type === 'urgent' && a.status === 'unread').length,
    unreadWarning: alerts.filter(a => a.type === 'warning' && a.status === 'unread').length,
    unreadInfo: alerts.filter(a => a.type === 'info' && a.status === 'unread').length,
  }), [alerts]);

  const visibleAlerts = useMemo(() => alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'unread') return a.status === 'unread';
    return a.type === filter;
  }), [alerts, filter]);

  // Organized: unread first, then already-seen — newest merchants read top-down.
  const grouped = useMemo(() => ({
    unread: visibleAlerts.filter(a => a.status === 'unread'),
    read: visibleAlerts.filter(a => a.status !== 'unread'),
  }), [visibleAlerts]);

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: isRTL ? 'الكل' : 'All', count: counts.all },
    { key: 'unread', label: isRTL ? 'غير المقروء' : 'Unread', count: counts.unread },
    { key: 'urgent', label: isRTL ? 'عاجل' : 'Urgent', count: counts.urgent },
    { key: 'warning', label: isRTL ? 'تنبيه' : 'Warnings', count: counts.warning },
    { key: 'info', label: isRTL ? 'معلومات' : 'Info', count: counts.info },
  ];

  const kpis = [
    {
      label: isRTL ? 'عاجل' : 'Urgent', value: counts.urgent,
      icon: AlertTriangle, gradient: 'from-red-500 to-red-600', shadow: 'shadow-red-500/20',
      valueColor: counts.urgent > 0 ? 'text-red-500 dark:text-red-400' : undefined,
      sub: counts.unreadUrgent > 0 ? `${counts.unreadUrgent} ${isRTL ? 'غير مقروء' : 'unread'}` : null,
      subColor: 'text-red-500 dark:text-red-400',
    },
    {
      label: isRTL ? 'تنبيه' : 'Warnings', value: counts.warning,
      icon: AlertCircle, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20',
      sub: counts.unreadWarning > 0 ? `${counts.unreadWarning} ${isRTL ? 'غير مقروء' : 'unread'}` : null,
      subColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: isRTL ? 'معلومات' : 'Info', value: counts.info,
      icon: Info, gradient: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/20',
      sub: counts.unreadInfo > 0 ? `${counts.unreadInfo} ${isRTL ? 'غير مقروء' : 'unread'}` : null,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">
            {isRTL ? 'جاري تحميل التنبيهات...' : 'Loading alerts...'}
          </span>
        </div>
      </div>
    );
  }

  const renderRow = (alert: Alert) => {
    const meta = TYPE_META[alert.type] || TYPE_META.info;
    const Icon = meta.icon;
    const unread = alert.status === 'unread';
    return (
      <div
        key={alert.id}
        className={`flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border transition-colors ${
          unread ? 'border-primary/30 bg-primary/[0.04]' : 'border-border/40'
        }`}
      >
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow ${meta.shadow} shrink-0`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-relaxed ${unread ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
            {alert.message}
          </p>
          {(alert.link || true) && (
            <div className="flex items-center gap-3 mt-1">
              {alert.link && (
                <button
                  onClick={() => navigate(alert.link!)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {isRTL ? 'عرض' : 'View'}
                </button>
              )}
              <button
                onClick={() => dismissOne(alert.id)}
                disabled={dismissing === alert.id}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {dismissing === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {isRTL ? 'تجاهل' : 'Dismiss'}
              </button>
            </div>
          )}
        </div>
        {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header (same as MarketingAnalytics) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {isRTL ? 'التنبيهات' : 'Alerts'}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              {counts.unread > 0
                ? isRTL ? `${counts.unread} تحتاج انتباهك` : `${counts.unread} need attention`
                : isRTL ? 'كل شي تمام — لا شيء يحتاجك' : 'All clear — nothing needs you'}
            </p>
          </div>
        </div>
        {alerts.length > 0 && (
          <Button variant="outline" size="sm" onClick={dismissAll} className="h-7 text-xs font-bold">
            <CheckCheck className="w-3.5 h-3.5 ml-1" />
            {isRTL ? 'تجاهل الكل' : 'Dismiss all'}
          </Button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-foreground mb-1">{isRTL ? 'كل شي تمام!' : 'All clear!'}</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isRTL ? 'لا توجد تنبيهات. سنخبرك فور حدوث أي شيء مهم في متجرك.' : "No alerts. We'll tell you the moment something needs attention."}
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards (same as MarketingAnalytics) ── */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="bg-card rounded-xl border border-border p-3 hover:border-primary/30 transition-all duration-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow ${k.shadow}`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{k.label}</span>
                  </div>
                  <p className={`text-lg font-black tabular-nums leading-none ${k.valueColor || 'text-foreground'}`}>{k.value}</p>
                  {k.sub && <p className={`text-[10px] mt-1 font-medium ${k.subColor || 'text-muted-foreground'}`}>{k.sub}</p>}
                </div>
              );
            })}
          </div>

          {/* ── Filter (same segmented style as Analytics days filter) ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="bg-muted/40 p-1 rounded-lg border border-border/40 flex gap-1 overflow-x-auto max-w-full">
              {tabs.map(tb => (
                <button key={tb.key} onClick={() => setFilter(tb.key)}
                  className={`px-3 h-7 rounded-md text-xs font-bold transition-all duration-200 whitespace-nowrap tabular-nums ${
                    filter === tb.key
                      ? 'bg-primary text-white shadow-sm shadow-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background'
                  }`}>
                  {tb.label} · {tb.count}
                </button>
              ))}
            </div>
          </div>

          {/* ── Organized list: unread first, then seen ── */}
          {visibleAlerts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              {isRTL ? 'لا شيء في هذا القسم' : 'Nothing in this section'}
            </p>
          ) : (
            <div className="space-y-3">
              {grouped.unread.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-red-500 to-orange-500" />
                    <span className="text-sm font-bold text-foreground">
                      {isRTL ? 'يحتاج انتباهك' : 'Needs attention'} · {grouped.unread.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.unread.map(renderRow)}
                  </div>
                </div>
              )}
              {grouped.read.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-slate-400 to-slate-500" />
                    <span className="text-sm font-bold text-foreground">
                      {isRTL ? 'تمت رؤيتها' : 'Seen'} · {grouped.read.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.read.map(renderRow)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
