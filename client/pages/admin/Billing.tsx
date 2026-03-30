import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@/lib/i18n';
import {
  CreditCard,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Zap,
  MessageCircle,
  Crown,
  Shield,
  Package,
  BarChart3,
  Users,
  Bot,
  Palette,
  Headphones,
  Layers,
  Truck,
  Sparkles,
  Loader2,
  Receipt,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

// ─── Design Tokens ──────────────────────────────────────────────
const surfaceCard =
  'rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40 transition-shadow hover:shadow-xl';
const surfaceMuted =
  'rounded-2xl bg-white/75 dark:bg-slate-900/35 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-md';

// ─── Types ──────────────────────────────────────────────────────

interface Subscription {
  id: number;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  tier: string;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
}

interface Payment {
  id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_id: string;
  payment_method: string;
  paid_at: string;
  created_at: string;
  error_message?: string;
  subscription_status: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function StatusPill({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    trial:     { bg: 'from-sky-500/15 to-blue-500/15 border-sky-300/40 dark:border-sky-700/40', text: 'text-sky-700 dark:text-sky-300',       icon: <Clock className="h-3.5 w-3.5" /> },
    active:    { bg: 'from-emerald-500/15 to-green-500/15 border-emerald-300/40 dark:border-emerald-700/40', text: 'text-emerald-700 dark:text-emerald-300', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    expired:   { bg: 'from-red-500/15 to-rose-500/15 border-red-300/40 dark:border-red-700/40', text: 'text-red-700 dark:text-red-300',       icon: <AlertCircle className="h-3.5 w-3.5" /> },
    cancelled: { bg: 'from-slate-500/15 to-gray-500/15 border-slate-300/40 dark:border-slate-700/40', text: 'text-slate-700 dark:text-slate-300', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  };
  const c = map[status] || map.trial;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-bold bg-gradient-to-r ${c.bg} border ${c.text}`}>
      {c.icon} {t(`admin.billing.status.${status}`)}
    </span>
  );
}

function PaymentStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { completed: 'bg-emerald-500', pending: 'bg-amber-500', failed: 'bg-red-500' };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-slate-400'}`} />;
}

// ─── Feature list ───────────────────────────────────────────────
const FEATURES: { icon: React.ReactNode; label: string }[] = [
  { icon: <Package className="h-3.5 w-3.5" />,    label: 'admin.billing.unlimitedProducts' },
  { icon: <Layers className="h-3.5 w-3.5" />,     label: 'admin.billing.unlimitedOrders' },
  { icon: <CreditCard className="h-3.5 w-3.5" />, label: 'admin.billing.orderManagement' },
  { icon: <Bot className="h-3.5 w-3.5" />,        label: 'admin.billing.whatsappSmsBot' },
  { icon: <Zap className="h-3.5 w-3.5" />,        label: 'admin.billing.automatedNotifications' },
  { icon: <BarChart3 className="h-3.5 w-3.5" />,  label: 'admin.billing.advancedAnalytics' },
  { icon: <Layers className="h-3.5 w-3.5" />,     label: 'admin.billing.productVariants' },
  { icon: <Package className="h-3.5 w-3.5" />,    label: 'admin.billing.stockManagement' },
  { icon: <Truck className="h-3.5 w-3.5" />,      label: 'admin.billing.deliveryZoneSetup' },
  { icon: <Users className="h-3.5 w-3.5" />,      label: 'admin.billing.staffManagement' },
  { icon: <Palette className="h-3.5 w-3.5" />,    label: 'admin.billing.storeCustomization' },
  { icon: <Headphones className="h-3.5 w-3.5" />, label: 'admin.billing.prioritySupport' },
];

// ─── Main Component ─────────────────────────────────────────────

const AdminBilling = () => {
  const { t, locale } = useTranslation();
  const isRTL = locale === 'ar';
  const { toast } = useToast();

  const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json() as Promise<Subscription>;
    },
  });

  const { data: paymentData, isLoading: payLoading } = useQuery({
    queryKey: ['billing-payments'],
    queryFn: async () => {
      const res = await fetch('/api/billing/payments');
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    },
  });

  const payments: Payment[] = paymentData?.payments || [];
  const isExpired = subscription?.status === 'expired';
  const isTrial = subscription?.status === 'trial' && new Date(subscription.trial_ends_at) > new Date();

  const daysLeft = subscription
    ? Math.max(0, Math.ceil(
        (new Date(subscription.status === 'trial' ? subscription.trial_ends_at : subscription.current_period_end).getTime() -
          Date.now()) / 86400000
      ))
    : 0;

  const periodEnd = subscription
    ? new Date(subscription.status === 'trial' ? subscription.trial_ends_at : subscription.current_period_end)
        .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/30">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{t('admin.billing.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('admin.billing.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-10 rounded-xl gap-1.5" onClick={() => refetchSub()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* ─── Expired alert ────────────────────────────────── */}
      {isExpired && (
        <div className={`${surfaceMuted} p-3 flex items-center gap-3 border-red-300/50 dark:border-red-700/50`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-white" />
          </div>
          <p className="flex-1 text-sm font-bold text-red-700 dark:text-red-300">{t('admin.billing.expiredAlert')}</p>
          <Link to="/dashboard/chat">
            <Button size="sm" className="h-8 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> {t('admin.billing.contactSupport')}
            </Button>
          </Link>
        </div>
      )}

      {/* ─── Bento Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Subscription Card (spans 2) ────────────────── */}
        <div className={`${surfaceCard} lg:col-span-2 overflow-hidden`}>
          {subLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : subscription ? (
            <>
              {/* Top bar */}
              <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-md shadow-amber-400/30">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-extrabold">{t('admin.billing.currentSubscription')}</p>
                    <p className="text-sm text-muted-foreground">{t('admin.billing.subscriptionDesc')}</p>
                  </div>
                </div>
                <StatusPill status={subscription.status} t={t} />
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200/60 dark:bg-slate-700/40">
                {[
                  { label: t('admin.billing.tier'), value: t('admin.billing.tierPro'), icon: <Shield className="h-3.5 w-3.5" />, color: 'text-violet-600 dark:text-violet-400' },
                  { label: isTrial ? t('admin.billing.trialEnds') : t('admin.billing.periodEnds'), value: periodEnd, icon: <Calendar className="h-3.5 w-3.5" />, color: 'text-sky-600 dark:text-sky-400' },
                  { label: t('admin.billing.daysRemaining', { n: daysLeft }), value: String(daysLeft), icon: <Clock className="h-3.5 w-3.5" />, color: daysLeft <= 7 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                  { label: t('admin.billing.autoRenew'), value: subscription.auto_renew ? t('admin.billing.enabled') : t('admin.billing.disabled'), icon: <RefreshCw className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400' },
                ].map((m, i) => (
                  <div key={i} className="bg-white/80 dark:bg-slate-900/40 p-3">
                    <div className={`flex items-center gap-1.5 mb-1 ${m.color}`}>
                      {m.icon}
                      <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{m.label}</span>
                    </div>
                    <p className="text-base font-extrabold truncate">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* CTA bottom */}
              <div className="p-3 flex items-center gap-3">
                {isTrial && (
                  <>
                    <div className="flex-1 flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300 bg-sky-500/10 rounded-xl px-3 py-2 border border-sky-300/30 dark:border-sky-700/30">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      {t('admin.billing.trialDaysLeft', { n: daysLeft })}
                    </div>
                    <Link to="/dashboard/chat">
                      <Button size="sm" className="h-9 rounded-xl text-xs bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white gap-1.5 shadow-md">
                        <MessageCircle className="h-3.5 w-3.5" /> {t('admin.billing.contactSupportToPay')}
                      </Button>
                    </Link>
                  </>
                )}
                {subscription.status === 'active' && (
                  <div className="flex-1 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2 border border-emerald-300/30 dark:border-emerald-700/30">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {t('admin.billing.activeExpires', { date: periodEnd })}
                  </div>
                )}
                {isExpired && (
                  <Link to="/dashboard/chat" className="flex-1">
                    <Button className="w-full h-9 rounded-xl text-xs bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white gap-1.5 shadow-md">
                      <MessageCircle className="h-3.5 w-3.5" /> {t('admin.billing.contactSupport')}
                    </Button>
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('admin.billing.noSubscription')}</div>
          )}
        </div>

        {/* ── Pricing Pillar ─────────────────────────────── */}
        <div className={`${surfaceCard} overflow-hidden flex flex-col`}>
          <div className="p-4 text-center border-b border-slate-200/70 dark:border-slate-700/60">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30 mx-auto mb-2">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">{t('admin.billing.monthlyPrice')}</p>
            <p className="text-4xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">$8</p>
            <p className="text-sm text-muted-foreground mt-0.5">{t('admin.billing.billedMonthly')}</p>
          </div>
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">{t('admin.billing.included')}</p>
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 px-1">
                <span className="text-emerald-500">{f.icon}</span>
                <span className="text-slate-700 dark:text-slate-300">{t(f.label)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Payment History ──────────────────────────────── */}
      <div className={surfaceCard}>
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/30">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-base font-extrabold">{t('admin.billing.paymentHistory')}</p>
            <p className="text-sm text-muted-foreground">{t('admin.billing.subtitle')}</p>
          </div>
        </div>
        <div className="p-3">
          {payLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            </div>
          ) : payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-slate-700/60">
                    {[t('admin.billing.date'), t('admin.billing.amount'), t('admin.billing.status'), t('admin.billing.method'), t('admin.billing.transactionId'), ''].map((h, i) => (
                      <th key={i} className={`${isRTL ? 'text-right' : 'text-left'} py-2.5 px-2 text-sm font-bold uppercase tracking-wider text-muted-foreground`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100/80 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-2 font-medium">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-2 font-extrabold">{Math.round(p.amount)} {p.currency}</td>
                      <td className="py-2.5 px-2">
                        <span className="inline-flex items-center gap-1.5">
                          <PaymentStatusDot status={p.status} />
                          <span className="capitalize">{t(`admin.billing.paymentStatus.${p.status}`)}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{p.payment_method === 'redotpay' ? 'RedotPay' : p.payment_method}</td>
                      <td className="py-2.5 px-2 text-muted-foreground font-mono text-xs">{p.transaction_id?.slice(0, 14)}…</td>
                      <td className="py-2.5 px-2 text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs gap-1">
                              <Download className="h-3 w-3" /> {t('admin.billing.details')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-sm">{t('admin.billing.paymentDetails')}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className={`${surfaceMuted} p-3`}>
                                <p className="text-sm text-muted-foreground mb-1">{t('admin.billing.transactionId')}</p>
                                <p className="font-mono text-xs break-all">{p.transaction_id}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { l: t('admin.billing.amount'), v: `${p.amount} ${p.currency}` },
                                  { l: t('admin.billing.status'), v: t(`admin.billing.paymentStatus.${p.status}`) },
                                  { l: t('admin.billing.date'), v: new Date(p.created_at).toLocaleDateString() },
                                  { l: t('admin.billing.method'), v: p.payment_method },
                                ].map((d, i) => (
                                  <div key={i} className={`${surfaceMuted} p-2.5`}>
                                    <p className="text-sm text-muted-foreground">{d.l}</p>
                                    <p className="text-sm font-bold capitalize">{d.v}</p>
                                  </div>
                                ))}
                              </div>
                              {p.error_message && (
                                <Alert variant="destructive" className="rounded-xl">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <AlertDescription className="text-xs">{p.error_message}</AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto mb-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">{t('admin.billing.noPayments')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('admin.billing.paymentHistoryHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <div className={surfaceCard}>
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/30">
            <HelpCircle className="h-4 w-4 text-white" />
          </div>
          <p className="text-base font-extrabold">{t('admin.billing.faqTitle')}</p>
        </div>
        <div className="p-3 space-y-2">
          {(['faq1', 'faq2', 'faq3', 'faq4'] as const).map((fk) => (
            <details key={fk} className={`${surfaceMuted} group cursor-pointer`}>
              <summary className="flex items-center justify-between p-3 text-sm font-bold select-none list-none [&::-webkit-details-marker]:hidden">
                <span>{t(`admin.billing.${fk}.q`)}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed">
                {t(`admin.billing.${fk}.a`)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminBilling;
