import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Loader, Save, Key, Eye, EyeOff, BadgeCheck, Globe, CheckCircle2, AlertCircle, Sparkles, Smartphone, Download } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';

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

const inputCls = "w-full h-10 bg-muted/40 border border-border/40 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all";

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeStore } = useStore();

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
      if (!res.ok) throw new Error(data?.error || t('profile.error.redeemFailed'));
      setVoucherSuccess(true);
      setVoucherCode('');
      toast({ title: t('common.success'), description: data?.message || t('profile.redeemed') });
    } catch (e) {
      setVoucherError((e as Error).message);
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleApplyAffiliateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAffiliateError(null);
    setAffiliateLoading(true);
    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: affiliateCode.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || t('profile.error.affiliateFailed'));
      toast({ title: t('common.success'), description: t('profile.affiliateApplied') });
      loadAffiliateInfo();
      setAffiliateCode('');
    } catch (e) {
      setAffiliateError((e as Error).message);
    } finally {
      setAffiliateLoading(false);
    }
  };

  const loadAffiliateInfo = async () => {
    try {
      const res = await fetch('/api/affiliate/info');
      if (res.ok) {
        const data = await res.json();
        setAffiliateInfo(data);
      }
    } catch {}
  };

  const loadAppDownload = async () => {
    try {
      const res = await fetch('/api/app-download');
      if (res.ok) {
        const data = await res.json();
        setAppDownload(data);
      }
    } catch {} finally {
      setAppDownloadLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [profileRes, accessRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/access/check'),
      ]);
      const profileData = await profileRes.json().catch(() => ({} as any));
      const accessData = await accessRes.json().catch(() => ({} as any));
      if (profileData?.user) {
        const u = profileData.user;
        setProfile(u);
        setForm({
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          business_name: u.business_name || '',
          country: u.country || '',
          city: u.city || '',
          subdomain: u.subdomain || '',
        });
      }
      setAccess(accessData);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordLoading(true);
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error(t('profile.error.passwordMismatch'));
      if (passwordForm.newPassword.length < 8) throw new Error(t('profile.error.passwordMinLength'));
      const res = await fetch('/api/users/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('profile.error.passwordFailed'));
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      localStorage.removeItem('password_needs_upgrade');
      setWeakPassword(false);
    } catch (e) {
      setPasswordError((e as Error).message);
    } finally {
      setPasswordLoading(false);
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

  useEffect(() => { load(); loadAffiliateInfo(); loadAppDownload(); }, [activeStore?.id]);
  const subStatus = access?.status || profile?.subscription?.status || 'unknown';

  const initials = form.name
    ? form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (form.email?.[0] || '?').toUpperCase();

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
            {loading ? <Loader className="w-4 h-4 animate-spin text-white" /> : <span className="text-white text-sm font-bold">{initials}</span>}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('profile.myProfile')}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">{form.email}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${subStatus === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : subStatus === 'trial' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-muted text-muted-foreground border border-border/40'}`}>
          {subStatus === 'active' && <BadgeCheck className="w-3 h-3" />}
          {subStatus.toUpperCase()}
        </span>
      </div>

      {/* ── Row 1: Account Info + Security ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Account Info */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
            <span className="text-sm font-bold text-foreground">{t('profile.accountInfo')}</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.fullName')}</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.fullName')} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.phoneNumber')}</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputCls} placeholder={t('profile.placeholder.phone')} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.emailAddress')}</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className={inputCls} placeholder={t('profile.placeholder.email')} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.storeName')}</label>
              <input type="text" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                className={inputCls} placeholder={t('profile.placeholder.storeName')} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.subdomain')}</label>
              <div className="flex items-center">
                <div className="h-10 px-3 flex items-center bg-muted/60 border border-border/40 border-r-0 rounded-r-lg text-xs text-muted-foreground shrink-0">
                  .sahla4eco.com
                </div>
                <input type="text" value={form.subdomain} onChange={e => setForm({ ...form, subdomain: e.target.value })}
                  className={`${inputCls} rounded-r-none border-r-0`} placeholder="fursa" dir="ltr" style={{ textAlign: 'left' }} />
              </div>
              <div className="flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/30">
                <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-[10px] text-muted-foreground">{t('profile.subdomainDesc')}</p>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={onSave} disabled={saving}
                className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm shadow-primary/20">
                {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {t('profile.saveChanges')}
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
            <span className="text-sm font-bold text-foreground">{t('profile.security')}</span>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            {weakPassword && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-600">{t('profile.weakPasswordTitle')}</p>
                  <p className="text-[10px] text-amber-500 mt-0.5">{t('profile.weakPasswordDesc')}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.currentPassword')}</label>
              <div className="relative">
                <input type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.currentPassword')} />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.newPassword')}</label>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.minChars')} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                    <div className="flex gap-0.5">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-border'}`} />
                      ))}
                    </div>
                    <p className={`text-[10px] font-bold ${textColors[score]}`}>{labels[score]}</p>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{t('profile.confirmNewPassword')}</label>
              <div className="relative">
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className={`${inputCls} pr-9`} placeholder={t('profile.placeholder.repeatPassword')} />
                {passwordForm.confirmPassword.length > 0 && (
                  <span className="absolute inset-y-0 right-2.5 flex items-center">
                    {passwordForm.confirmPassword === passwordForm.newPassword
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  </span>
                )}
              </div>
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{t('profile.passwordUpdated')}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button type="submit"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm shadow-primary/20">
                {passwordLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                {t('profile.updatePassword')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Row 2: Voucher + Referral ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Voucher */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
            <span className="text-sm font-bold text-foreground">{t('profile.redeemCode')}</span>
          </div>
          <div className="space-y-3">
            <input type="text" value={voucherCode}
              onChange={e => handleFormatVoucherCode(e.target.value)}
              className="w-full bg-muted/40 text-center font-mono text-sm font-bold tracking-[0.15em] text-foreground placeholder:text-muted-foreground/40 border border-border/40 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              placeholder="XXXX-XXXX-XXXX-XXXX" />
            <button onClick={handleRedeemVoucher} disabled={voucherLoading || !voucherCode}
              className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-sm shadow-primary/20">
              {voucherLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {t('profile.apply')}
            </button>
            {voucherError && <p className="text-[10px] text-red-500 font-bold">{voucherError}</p>}
            {voucherSuccess && <p className="text-[10px] text-emerald-600 font-bold">{t('profile.redeemed')}</p>}
          </div>
        </div>

        {/* Referral */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
            <span className="text-sm font-bold text-foreground">{t('profile.referral')}</span>
          </div>
          <div className="space-y-3">
            {affiliateInfo?.has_referral ? (
              <div className="text-center space-y-2 py-2">
                <p className="text-2xl font-black text-foreground">
                  {affiliateInfo.earn_per_referral?.toFixed(0) || '0'} دج
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">{t('profile.perReferral')}</p>
                <p className="text-xs font-mono text-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/40">{affiliateInfo.voucher_code}</p>
              </div>
            ) : (
              <form onSubmit={handleApplyAffiliateCode} className="space-y-3">
                <input type="text" value={affiliateCode} onChange={e => setAffiliateCode(e.target.value)}
                  className={`${inputCls} uppercase tracking-widest text-center font-mono`}
                  placeholder={t('profile.placeholder.partnerCode')} />
                <button type="submit" disabled={affiliateLoading || !affiliateCode}
                  className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shadow-sm shadow-primary/20">
                  {affiliateLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                  {t('profile.apply')}
                </button>
              </form>
            )}
            {affiliateError && <p className="text-[10px] text-red-500 font-bold">{affiliateError}</p>}
          </div>
        </div>
      </div>

      {/* ── Row 3: Mobile App (full width) ── */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
          <span className="text-sm font-bold text-foreground">{t('admin.enhanced.ourApps')}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground leading-relaxed">{t('profile.mobileDesc')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {[t('profile.mobileFeature1'), t('profile.mobileFeature2'), t('profile.mobileFeature3'), t('profile.mobileFeature4')].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                  <div className="w-1 h-1 rounded-full bg-foreground/30" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          {appDownloadLoading ? (
            <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : appDownload?.download_url ? (
            <a href={appDownload.download_url} download
              className="shrink-0 flex items-center gap-1.5 h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-sm shadow-primary/20">
              <Download className="w-3.5 h-3.5" />
              {t('admin.enhanced.downloadApp')}
            </a>
          ) : (
            <span className="shrink-0 text-[10px] text-muted-foreground font-bold">{t('profile.comingSoon')}</span>
          )}
        </div>
      </div>

    </div>
  );
}
