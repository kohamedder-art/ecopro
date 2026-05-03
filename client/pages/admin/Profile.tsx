import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Lock, Loader, Ticket, Save, User, Key, Eye, EyeOff, Percent, ShieldCheck, BadgeCheck, Mail, Phone, Building2, MapPin, Globe, CheckCircle2, AlertCircle, Sparkles, Tag } from 'lucide-react';

type SubscriptionRow = {
  tier?: string | null;
  status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
} | null;

type ProfileResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
  user_type?: string | null;
  is_locked?: boolean;
  locked_reason?: string | null;
  lock_type?: string | null;
  phone?: string | null;
  business_name?: string | null;
  country?: string | null;
  city?: string | null;
  subscription?: SubscriptionRow;
};

function formatDate(input?: string | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);
  const [access, setAccess] = React.useState<{ status: string; hasAccess: boolean; daysLeft?: number } | null>(null);

  const [form, setForm] = React.useState({ name: '', email: '', phone: '', business_name: '', country: '', city: '' });

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccess, setVoucherSuccess] = useState(false);

  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [affiliateInfo, setAffiliateInfo] = useState<{
    has_referral: boolean; affiliate_name?: string; voucher_code?: string;
    discount_percent?: number; discount_applied?: boolean;
  } | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [weakPassword, setWeakPassword] = useState(() => localStorage.getItem('password_needs_upgrade') === '1');

  const handleFormatVoucherCode = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    setVoucherCode(cleaned.match(/.{1,4}/g)?.join('-') || cleaned);
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    setVoucherSuccess(false);
    setVoucherLoading(true);
    try {
      if (!voucherCode.trim()) throw new Error(t('profile.error.enterCode'));
      const res = await fetch('/api/codes/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.error) {
        setVoucherError(data?.error || data?.message || 'Failed to redeem code');
      } else {
        setVoucherSuccess(true);
        setVoucherCode('');
        toast({ title: t('common.success'), description: t('admin.profile.subscriptionActivated') });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err: any) {
      setVoucherError(err.message);
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) { setPasswordError(t('profile.error.allFieldsRequired')); return; }
    if (newPassword.length < 8) { setPasswordError(t('profile.error.passwordMinLength')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.error.passwordMismatch')); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to change password');
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      localStorage.removeItem('password_needs_upgrade');
      setWeakPassword(false);
      toast({ title: t('common.success'), description: t('profile.passwordUpdated') });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const loadAffiliateInfo = async () => {
    try {
      const res = await fetch('/api/affiliates/my-referral', { credentials: 'include' });
      if (res.ok) setAffiliateInfo(await res.json());
    } catch {}
  };

  const handleApplyAffiliateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAffiliateError(null);
    setAffiliateLoading(true);
    try {
      if (!affiliateCode.trim()) throw new Error(t('profile.error.enterVoucher'));
      const res = await fetch('/api/affiliates/apply-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ code: affiliateCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply code');
      toast({ title: 'Success!', description: `Code applied! You'll get ${data.affiliate.discount_percent}% off.` });
      setAffiliateCode('');
      await loadAffiliateInfo();
    } catch (err: any) {
      setAffiliateError(err.message);
    } finally {
      setAffiliateLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const [pRes, aRes] = await Promise.all([fetch('/api/users/me'), fetch('/api/billing/check-access')]);
      if (pRes.ok) {
        const p = (await pRes.json()) as ProfileResponse;
        setProfile(p);
        setForm({ name: p.name || '', email: p.email || '', phone: p.phone || '', business_name: p.business_name || '', country: p.country || '', city: p.city || '' });
      }
      if (aRes.ok) setAccess(await aRes.json());
    } catch {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.profile.loadError') });
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/users/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to update profile');
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: t('common.saved'), description: t('admin.profile.updateSuccess') });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); loadAffiliateInfo(); }, []);

  const subStatus = access?.status || profile?.subscription?.status || 'unknown';
  const trialEnds = profile?.subscription?.trial_ends_at || null;
  const periodEnds = profile?.subscription?.current_period_end || null;

  const initials = form.name
    ? form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (form.email?.[0] || '?').toUpperCase();

  const statusColor = subStatus === 'active'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
    : subStatus === 'trial'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-4 max-w-5xl mx-auto">

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-slate-900/45 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/70 ring-1 ring-black/5 dark:ring-white/10 shadow-lg shadow-slate-200/60 dark:shadow-black/40 p-4">
        <div className="relative flex items-center justify-between gap-4">
          {/* Left section - Avatar + Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-purple-500 to-violet-600 border border-white/50 dark:border-white/10 flex items-center justify-center shrink-0 text-lg font-bold text-white shadow-md">
              {loading ? <Loader className="w-5 h-5 animate-spin opacity-70" /> : initials}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{loading ? '—' : (form.name || t('profile.yourAccount'))}</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{form.email}</p>
            </div>
          </div>

          {/* Right section - Status badge */}
          <div className="shrink-0 text-end">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border backdrop-blur-sm ${statusColor}`}>
              {subStatus === 'active' && <BadgeCheck className="w-3 h-3" />}
              <span>{subStatus.toUpperCase()}</span>
            </span>
            {(trialEnds || periodEnds) && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {subStatus === 'active' && periodEnds
                  ? `${t('profile.renews')} ${formatDate(periodEnds)}`
                  : trialEnds ? `${t('profile.trialEnds')} ${formatDate(trialEnds)}`
                  : `${t('profile.renews')} ${formatDate(periodEnds)}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Three columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* COL 1 — Account info */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm font-bold">{t('profile.accountInfo')}</span>
          </div>

          <div className="p-5 space-y-3">
            {/* Name */}
            <Field label={t('profile.fullName')}>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.fullName')} />
              </div>
            </Field>

            {/* Email */}
            <Field label={t('profile.emailAddress')}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.email')} />
              </div>
            </Field>

            {/* Phone + Store side by side */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profile.phoneNumber')}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.phone')} />
                </div>
              </Field>
              <Field label={t('profile.storeName')}>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="text" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                    className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.storeName')} />
                </div>
              </Field>
            </div>

            {/* City + Country side by side */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profile.cityWilaya')}>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.city')} />
                </div>
              </Field>
              <Field label={t('profile.country')}>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  {form.country ? (
                    <div className={`${inputCls} pl-8 flex items-center opacity-60 cursor-not-allowed`}>
                      <span className="text-sm">{form.country}</span>
                    </div>
                  ) : (
                    <input type="text" value="" readOnly
                      className={`${inputCls} pl-8 opacity-50 cursor-not-allowed`} placeholder={t('profile.placeholder.country')} />
                  )}
                </div>
              </Field>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={onSave} disabled={saving}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm shadow-blue-600/20">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('profile.saveChanges')}
              </button>
            </div>
          </div>
        </div>

        {/* COL 2 — Security */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60 bg-orange-50/50 dark:bg-orange-950/20">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm font-bold">{t('profile.security')}</span>
          </div>

          <form onSubmit={handleChangePassword} className="p-5 space-y-3">
            {weakPassword && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-3">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">كلمة المرور الحالية ضعيفة</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">يُنصح بتحديثها لحماية حسابك — استخدم حروفاً كبيرة وصغيرة وأرقاماً ورموزاً.</p>
                </div>
              </div>
            )}
            <Field label={t('profile.currentPassword')}>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className={`${inputCls} pl-8 pr-9`} placeholder={t('profile.placeholder.currentPassword')} />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label={t('profile.newPassword')}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className={`${inputCls} pl-8 pr-9`} placeholder={t('profile.placeholder.minChars')} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength bar */}
              {passwordForm.newPassword.length > 0 && (() => {
                const p = passwordForm.newPassword;
                const score = [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
                const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
                const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];
                const textColors = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500'];
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] font-semibold ${textColors[score]}`}>{labels[score]}</p>
                  </div>
                );
              })()}
            </Field>

            <Field label={t('profile.confirmNewPassword')}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className={`${inputCls} pl-8`} placeholder={t('profile.placeholder.repeatPassword')} />
                {passwordForm.confirmPassword.length > 0 && (
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    {passwordForm.confirmPassword === passwordForm.newPassword
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <AlertCircle className="w-4 h-4 text-red-400" />}
                  </span>
                )}
              </div>
            </Field>

            {passwordError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{t('profile.passwordUpdated')}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button type="submit"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="h-9 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm shadow-orange-600/20">
                {passwordLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {t('profile.updatePassword')}
              </button>
            </div>
          </form>
        </div>

        {/* COL 3 — Voucher + Referral */}
        <div className="space-y-4">

          {/* Redeem voucher — ticket style */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-indigo-200/60 dark:border-indigo-800/40">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-sm font-bold">{t('profile.redeemCode')}</span>
            </div>

            <div className="p-5 space-y-3">
              {/* Dashed ticket input area */}
              <div className="rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 bg-white/60 dark:bg-black/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500 mb-2 text-center">
                  {t('profile.redeemCode')}
                </p>
                <input
                  type="text" value={voucherCode}
                  onChange={e => handleFormatVoucherCode(e.target.value)}
                  className="w-full bg-transparent text-center font-mono text-lg font-bold tracking-[0.25em] text-indigo-700 dark:text-indigo-300 placeholder:text-indigo-300 dark:placeholder:text-indigo-700 border-none outline-none"
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>

              <form onSubmit={handleRedeemVoucher}>
                <button type="submit" disabled={voucherLoading || !voucherCode}
                  className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20">
                  {voucherLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {t('profile.apply')}
                </button>
              </form>

              {voucherError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{voucherError}
                </div>
              )}
              {voucherSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{t('profile.redeemed')}
                </div>
              )}
            </div>
          </div>

          {/* Referral */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Gift className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-sm font-bold">{t('profile.referral')}</span>
            </div>

            <div className="p-5 space-y-3">
              {affiliateInfo?.discount_applied ? (
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                    <Percent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {affiliateInfo.discount_percent}% <span className="text-sm font-semibold">{t('profile.percentOff')}</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{affiliateInfo.voucher_code}</p>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <BadgeCheck className="w-3.5 h-3.5" /> Discount active on your account
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplyAffiliateCode} className="space-y-2">
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                    <input type="text" value={affiliateCode} onChange={e => setAffiliateCode(e.target.value)}
                      className={`${inputCls} pl-8 uppercase tracking-widest text-center font-mono`}
                      placeholder="PARTNER-CODE" />
                  </div>
                  <button type="submit" disabled={affiliateLoading || !affiliateCode}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm shadow-emerald-600/20">
                    {affiliateLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    {t('profile.apply')}
                  </button>
                </form>
              )}
              {affiliateError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{affiliateError}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
