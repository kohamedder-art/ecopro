import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Lock, Loader, Ticket, Save, User, Key, Eye, EyeOff, Percent, ShieldCheck, BadgeCheck, Mail, Phone, Building2, MapPin, Globe, CheckCircle2, AlertCircle, Sparkles, Tag, Smartphone, Download } from 'lucide-react';

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
      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-9 bg-white dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all";

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);
  const [access, setAccess] = React.useState<{ status: string; hasAccess: boolean; daysLeft?: number } | null>(null);

  const [form, setForm] = React.useState({ name: '', email: '', phone: '', business_name: '', country: '', city: '', subdomain: '' });

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccess, setVoucherSuccess] = useState(false);

  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [affiliateInfo, setAffiliateInfo] = useState<{
    has_referral: boolean; affiliate_name?: string; voucher_code?: string;
    earn_per_referral?: number;
  } | null>(null);

  const [appDownload, setAppDownload] = useState<{ download_url: string | null; version?: string } | null>(null);
  const [appDownloadLoading, setAppDownloadLoading] = useState(true);

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
      toast({ title: t('common.success'), description: t('profile.affiliateSuccess') });
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
      const [pRes, aRes, ssRes, mRes] = await Promise.all([fetch('/api/users/me'), fetch('/api/billing/check-access'), fetch('/api/client/store/settings'), fetch('/api/mobile/download')]);
      if (mRes.ok) setAppDownload(await mRes.json());
      if (pRes.ok) {
        const p = (await pRes.json()) as ProfileResponse;
        let subdomain = '';
        if (ssRes.ok) {
          const ss = await ssRes.json();
          subdomain = ss.subdomain || '';
        }
        setProfile(p);
        setForm({ name: p.name || '', email: p.email || '', phone: p.phone || '', business_name: p.business_name || '', country: p.country || '', city: p.city || '', subdomain });
      }
      if (aRes.ok) setAccess(await aRes.json());
    } catch {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.profile.loadError') });
    } finally {
      setLoading(false);
      setAppDownloadLoading(false);
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const { subdomain, ...profileForm } = form;
      const [res] = await Promise.all([
        fetch('/api/users/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) }),
        fetch('/api/client/store/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subdomain }) }),
      ]);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to update profile');
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: t('common.saved'), description: t('admin.profile.updateSuccess') });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: t('common.error'), description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); loadAffiliateInfo(); }, []);  const subStatus = access?.status || profile?.subscription?.status || 'unknown';
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
    <div className="space-y-3 max-w-5xl mx-auto">

      {/* ── Hero card ── */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="bg-gradient-to-r from-blue-600 to-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg font-bold text-white">
              {loading ? <Loader className="w-5 h-5 animate-spin opacity-70" /> : initials}
            </div>
            <div>
              <h1 className="text-base font-black text-white">{loading ? '—' : (form.name || t('profile.yourAccount'))}</h1>
              <p className="text-xs font-bold text-white/80">{form.email}</p>
            </div>
          </div>
          <div className="text-end">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${statusColor}`}>
              {subStatus === 'active' && <BadgeCheck className="w-3 h-3" />}
              {subStatus.toUpperCase()}
            </span>
            {(trialEnds || periodEnds) && (
              <p className="text-[10px] text-white/50 mt-1">
                {subStatus === 'active' && periodEnds
                  ? `${t('profile.renews')} ${formatDate(periodEnds)}`
                  : trialEnds ? `${t('profile.trialEnds')} ${formatDate(trialEnds)}`
                  : `${t('profile.renews')} ${formatDate(periodEnds)}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-Column: Account + Security ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">

        {/* Account Info — wider */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 flex items-center gap-2">
            <User className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase tracking-widest">{t('profile.accountInfo')}</span>
          </div>
          <div className="bg-white dark:bg-[#111] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('profile.fullName')}>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.fullName')} />
              </Field>
              <Field label={t('profile.emailAddress')}>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.email')} />
              </Field>
              <Field label={t('profile.phoneNumber')}>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.phone')} />
              </Field>
              <Field label={t('profile.storeName')}>
                <input type="text" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.storeName')} />
              </Field>
            </div>
            <Field label={t('profile.subdomain')}>
              <div className="flex items-center">
                <div className="h-9 px-3 flex items-center bg-slate-100 dark:bg-slate-700/50 border-2 border-slate-200 dark:border-slate-700 rounded-s-lg rounded-e-none text-xs font-bold text-slate-500 shrink-0">
                  .sahla4eco.com
                </div>
                <input type="text" value={form.subdomain} onChange={e => setForm({ ...form, subdomain: e.target.value })}
                  className={`${inputCls} rounded-e-lg rounded-s-none border-s-0`} placeholder="fursa" dir="ltr" style={{ textAlign: 'left' }} />
              </div>
              <div className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40">
                <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{t('profile.subdomainDesc')}</p>
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('profile.cityWilaya')}>
                <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.city')} />
              </Field>
              <Field label={t('profile.country')}>
                <input type="text" value={form.country || ''} readOnly
                  className={`${inputCls} opacity-60 cursor-not-allowed`} placeholder={t('profile.placeholder.country')} />
              </Field>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={onSave} disabled={saving}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-all shadow-md">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('profile.saveChanges')}
              </button>
            </div>
          </div>
        </div>

        {/* Security — narrower */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2.5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase tracking-widest">{t('profile.security')}</span>
          </div>
          <form onSubmit={handleChangePassword} className="bg-white dark:bg-[#111] p-4 space-y-3">
            {weakPassword && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{t('profile.weakPasswordTitle')}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">{t('profile.weakPasswordDesc')}</p>
                </div>
              </div>
            )}
            <Field label={t('profile.currentPassword')}>
              <div className="relative">
                <input type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.currentPassword')} />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label={t('profile.newPassword')}>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.minChars')} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordForm.newPassword.length > 0 && (() => {
                const p = passwordForm.newPassword;
                const score = [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
                const labels = ['', t('profile.passwordStrength.weak'), t('profile.passwordStrength.fair'), t('profile.passwordStrength.good'), t('profile.passwordStrength.strong')];
                const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];
                const textColors = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500'];
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-slate-200 dark:bg-slate-700'}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] font-bold ${textColors[score]}`}>{labels[score]}</p>
                  </div>
                );
              })()}
            </Field>
            <Field label={t('profile.confirmNewPassword')}>
              <div className="relative">
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.repeatPassword')} />
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
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{t('profile.passwordUpdated')}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button type="submit"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="h-10 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-all shadow-md">
                {passwordLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {t('profile.updatePassword')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Voucher + Referral (compact row) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Voucher */}
        <div className="rounded-xl overflow-hidden shadow-sm border border-blue-200 dark:border-blue-900/40">
          <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase tracking-widest">{t('profile.redeemCode')}</span>
          </div>
          <div className="bg-white dark:bg-[#111] p-4 space-y-3">
            <input type="text" value={voucherCode}
              onChange={e => handleFormatVoucherCode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 text-center font-mono text-lg font-bold tracking-[0.2em] text-blue-700 dark:text-blue-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="XXXX-XXXX-XXXX-XXXX" />
            <button onClick={handleRedeemVoucher} disabled={voucherLoading || !voucherCode}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md">
              {voucherLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('profile.apply')}
            </button>
            {voucherError && <p className="text-[11px] text-red-500 font-semibold">{voucherError}</p>}
            {voucherSuccess && <p className="text-[11px] text-emerald-600 font-semibold">{t('profile.redeemed')}</p>}
          </div>
        </div>

        {/* Referral */}
        <div className="rounded-xl overflow-hidden shadow-sm border border-emerald-200 dark:border-emerald-900/40">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase tracking-widest">{t('profile.referral')}</span>
          </div>
          <div className="bg-white dark:bg-[#111] p-4 space-y-3">
            {affiliateInfo?.has_referral ? (
              <div className="text-center space-y-2">
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {affiliateInfo.earn_per_referral?.toFixed(0) || '0'} دج
                </p>
                <p className="text-[11px] text-slate-400">{t('profile.perReferral')}</p>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-1.5">{affiliateInfo.voucher_code}</p>
              </div>
            ) : (
              <form onSubmit={handleApplyAffiliateCode} className="space-y-2">
                <input type="text" value={affiliateCode} onChange={e => setAffiliateCode(e.target.value)}
                  className={`${inputCls} uppercase tracking-widest text-center font-mono`}
                  placeholder={t('profile.placeholder.partnerCode')} />
                <button type="submit" disabled={affiliateLoading || !affiliateCode}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md">
                  {affiliateLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  {t('profile.apply')}
                </button>
              </form>
            )}
            {affiliateError && <p className="text-[11px] text-red-500 font-semibold">{affiliateError}</p>}
          </div>
        </div>
      </div>

      {/* ── Mobile App ── */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-white" />
          <span className="text-xs font-black text-white uppercase tracking-widest">{t('admin.enhanced.ourApps')}</span>
        </div>
        <div className="bg-white dark:bg-[#111] px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 leading-relaxed">{t('profile.mobileDesc')}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {[t('profile.mobileFeature1'), t('profile.mobileFeature2'), t('profile.mobileFeature3'), t('profile.mobileFeature4')].map((f, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <div className="w-1 h-1 rounded-full bg-sky-500" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          {appDownloadLoading ? (
            <Loader className="w-4 h-4 animate-spin text-slate-400" />
          ) : appDownload?.download_url ? (
            <a href={appDownload.download_url} download
              className="shrink-0 flex items-center gap-1.5 h-8 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all">
              <Download className="w-3.5 h-3.5" />
              {t('admin.enhanced.downloadApp')}
            </a>
          ) : (
            <span className="shrink-0 text-[10px] text-slate-400 font-semibold">{t('profile.comingSoon')}</span>
          )}
        </div>
      </div>

    </div>
  );
}
