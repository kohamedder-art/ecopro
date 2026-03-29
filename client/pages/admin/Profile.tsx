import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Gift, Lock, Loader, Ticket, Save, User, Key, Eye, EyeOff, Percent, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);
  const [access, setAccess] = React.useState<{
    status: string;
    hasAccess: boolean;
    daysLeft?: number;
    message?: string;
  } | null>(null);

  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    business_name: '',
    country: '',
    city: '',
  });

  // Voucher code redemption state
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSuccess, setVoucherSuccess] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);

  // Affiliate voucher code state
  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [affiliateInfo, setAffiliateInfo] = useState<{
    has_referral: boolean;
    affiliate_name?: string;
    voucher_code?: string;
    discount_percent?: number;
    discount_applied?: boolean;
  } | null>(null);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleFormatVoucherCode = (value: string) => {
    // Normalize input (supports pasting with spaces/dashes) into XXXX-XXXX-XXXX-XXXX.
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    const formatted = cleaned.match(/.{1,4}/g)?.join('-') || cleaned;
    setVoucherCode(formatted);
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    setVoucherSuccess(false);
    setVoucherLoading(true);

    try {
      if (!voucherCode.trim()) {
        throw new Error(t('profile.error.enterCode'));
      }
      const res = await fetch('/api/codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase() }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data?.error) {
        const msg = data?.error || data?.message || 'Failed to redeem code';
        setVoucherError(msg);
        setAttemptsRemaining(typeof data?.attemptsRemaining === 'number' ? data.attemptsRemaining : 3);
      } else {
        setVoucherSuccess(true);
        setVoucherCode('');
        setAttemptsRemaining(3);
        
        toast({ title: t('common.success'), description: t('admin.profile.subscriptionActivated') });
        
        // Refresh user data
        try {
          const meRes = await fetch('/api/auth/me');
          if (meRes.ok) {
            const userData = await meRes.json();
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (e) {
          console.error('Failed to refresh user data:', e);
        }

        // Reload data and page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setVoucherError(err.message || 'Failed to redeem code');
    } finally {
      setVoucherLoading(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('profile.error.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('profile.error.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.error.passwordMismatch'));
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to change password');
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: t('common.success'), description: t('auth.passwordChanged') || 'Password changed successfully!' });

      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Load affiliate referral info
  const loadAffiliateInfo = async () => {
    try {
      const res = await fetch('/api/affiliates/my-referral', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAffiliateInfo(data);
      }
    } catch (err) {
      console.error('Failed to load affiliate info:', err);
    }
  };

  // Apply affiliate code
  const handleApplyAffiliateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAffiliateError(null);
    setAffiliateLoading(true);

    try {
      if (!affiliateCode.trim()) {
        throw new Error(t('profile.error.enterVoucher'));
      }

      const res = await fetch('/api/affiliates/apply-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: affiliateCode.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply code');
      }

      toast({ 
        title: 'Success!', 
        description: `Code applied! You'll get ${data.affiliate.discount_percent}% off your first payment.` 
      });
      
      setAffiliateCode('');
      await loadAffiliateInfo();
    } catch (err: any) {
      setAffiliateError(err.message || 'Failed to apply code');
    } finally {
      setAffiliateLoading(false);
    }
  };

  // Make main content area and sidebar transparent so wallpaper shows through
  useEffect(() => {
    // Load affiliate info on mount
    loadAffiliateInfo();
    
    // Add data attribute to body for CSS targeting
    document.body.setAttribute('data-profile-wallpaper', 'true');
    
    // Make main content transparent
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.style.background = 'transparent';
    }

    return () => {
      document.body.removeAttribute('data-profile-wallpaper');
      if (mainEl) {
        mainEl.style.background = '';
      }
    };
  }, []);

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [pRes, aRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/billing/check-access'),
      ]);

      if (pRes.ok) {
        const p = (await pRes.json()) as ProfileResponse;
        setProfile(p);
        setForm({
          name: p.name || '',
          email: p.email || '',
          phone: p.phone || '',
          business_name: p.business_name || '',
          country: p.country || '',
          city: p.city || '',
        });
      }

      if (aRes.ok) {
        const a = await aRes.json();
        setAccess(a);
      }
    } catch (e) {
      console.error('Profile load error:', e);
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.profile.loadError') });
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to update profile');
      }

      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      toast({ title: t('common.saved'), description: t('admin.profile.updateSuccess') });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const subStatus = access?.status || profile?.subscription?.status || 'unknown';
  const hasAccess = access?.hasAccess ?? true;

  const trialEnds = profile?.subscription?.trial_ends_at || null;
  const periodEnds = profile?.subscription?.current_period_end || null;

  const isLight = theme !== 'dark';

  // Theming variables mapping based on context
  const bgDeep = isLight ? 'bg-slate-100' : 'bg-[#03060b]';
  const textMain = isLight ? 'text-gray-800' : 'text-[#e2e8f0]';
  const cardBg = isLight ? 'bg-white' : 'bg-[#0b111a]';
  const borderColor = isLight ? 'border-gray-200' : 'border-[#1e293b]';
  const textMuted = isLight ? 'text-gray-500' : 'text-gray-400';
  const inputBg = isLight ? 'bg-white' : 'bg-[#050a11]';
  const inputBorder = isLight ? 'border-gray-300' : borderColor;
  const gradientCard = isLight ? 'bg-white' : 'bg-gradient-to-br from-[#0b111a] to-[#111827]';
  const cardShadow = isLight ? 'shadow-[0_2px_12px_rgba(0,0,0,0.08)]' : '';
  const inputShadow = isLight ? 'shadow-sm' : '';

  return (
    <div className={`min-h-screen ${bgDeep} ${textMain} p-3 sm:p-4 font-[Inter] transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto flex flex-col gap-3">

        {/* ── Page Header ── */}
        <div className={`${isLight ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-white/5'} rounded-[20px] p-3.5 flex items-center gap-3 shadow-lg shadow-blue-500/20`}>
          <div className="w-10 h-10 rounded-[14px] bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate">
              {loading ? '—' : (form.name || t('profile.yourAccount'))}
            </h1>
            <p className="text-xs text-blue-100/70 truncate">{form.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-xl font-bold border uppercase ${
              subStatus === 'active' ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-200'
              : subStatus === 'trial' ? 'bg-blue-300/20 border-blue-200/40 text-blue-100'
              : 'bg-white/10 border-white/20 text-white/60'
            }`}>{subStatus}</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-xl font-bold border uppercase ${
              hasAccess ? 'bg-yellow-400/20 border-yellow-300/40 text-yellow-200' : 'bg-white/10 border-white/20 text-white/60'
            }`}>
              {hasAccess ? t('profile.goldTier') : t('profile.freePlan')}
            </span>
          </div>
        </div>

        {/* ── Main Grid: 3 columns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

          {/* Col 1 — Account Info */}
          <div className={`lg:col-span-5 ${gradientCard} border ${isLight ? 'border-blue-100' : 'border-blue-900/40'} rounded-[20px] p-4 flex flex-col gap-3 ${cardShadow}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">{t('profile.accountInfo')}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.fullName')}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.fullName')} />
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.emailAddress')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.email')} />
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.phoneNumber')}</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.phone')} />
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.storeName')}</label>
                <input type="text" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.storeName')} />
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.cityWilaya')}</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.city')} />
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.country')}</label>
                <input type="text" value={form.country} readOnly
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMuted} ${inputShadow} cursor-not-allowed opacity-60`}
                  placeholder={t('profile.placeholder.country')} />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={onSave} disabled={saving}
                className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('profile.saveChanges')}
              </button>
            </div>
          </div>

          {/* Col 2 — Security */}
          <div className={`lg:col-span-4 ${gradientCard} border ${isLight ? 'border-orange-100' : 'border-orange-900/30'} rounded-[20px] p-4 flex flex-col gap-2.5 ${cardShadow}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500">{t('profile.security')}</span>
            </div>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-2.5">
              <div className="relative">
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.currentPassword')}</label>
                <input type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 pr-10 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all`}
                  placeholder={t('profile.placeholder.currentPassword')} />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className={`absolute right-3 bottom-2 ${textMuted} hover:text-orange-400 transition-colors`}>
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.newPassword')}</label>
                <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 pr-10 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all`}
                  placeholder={t('profile.placeholder.minChars')} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`absolute right-3 bottom-2 ${textMuted} hover:text-orange-400 transition-colors`}>
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div>
                <label className={`block text-[10px] uppercase tracking-wider ${textMuted} mb-1 font-bold`}>{t('profile.confirmNewPassword')}</label>
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className={`w-full h-9 ${inputBg} border ${inputBorder} rounded-xl px-3 text-sm ${textMain} ${inputShadow} focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all`}
                  placeholder={t('profile.placeholder.repeatPassword')} />
              </div>
              {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
              {passwordSuccess && <p className="text-emerald-400 text-xs">{t('profile.passwordUpdated')}</p>}
              <button type="submit"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="h-9 w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                {passwordLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {t('profile.updatePassword')}
              </button>
            </form>
          </div>

          {/* Col 3 — Plan, Codes */}
          <div className="lg:col-span-3 flex flex-col gap-3">

            {/* Active Plan */}
            <div className={`${isLight ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' : 'bg-gradient-to-br from-yellow-900/20 to-amber-900/10 border-yellow-700/20'} border rounded-[20px] p-3.5 ${cardShadow}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                  </div>
                  <span className={`text-sm font-bold ${isLight ? 'text-yellow-700' : 'text-yellow-300'}`}>
                    {profile?.subscription?.tier || 'Free Plan'}
                  </span>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold border uppercase ${
                  subStatus === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                }`}>{subStatus}</span>
              </div>
              {(trialEnds || periodEnds) && (
                <p className={`text-xs ${textMuted} mt-1.5`}>
                  {trialEnds ? `${t('profile.trialEnds')} ${formatDate(trialEnds)}` : `${t('profile.renews')} ${formatDate(periodEnds)}`}
                </p>
              )}
            </div>

            {/* Redeem Voucher */}
            <div className={`${isLight ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-br from-blue-900/20 to-indigo-900/10 border-blue-700/20'} border-l-2 border-l-blue-500 border rounded-[20px] p-3.5 ${cardShadow}`}>
              <div className="flex items-center gap-2 mb-2">
                <Ticket className="w-4 h-4 text-blue-400" />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>{t('profile.redeemCode')}</span>
              </div>
              <form onSubmit={handleRedeemVoucher} className="flex gap-2">
                <input type="text" value={voucherCode} onChange={(e) => handleFormatVoucherCode(e.target.value)}
                  className={`flex-1 h-9 ${inputBg} border ${inputBorder} rounded-xl px-2 font-mono text-xs text-center ${textMain} ${inputShadow} focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all`}
                  placeholder={t('profile.placeholder.voucherCode')} />
                <button type="submit" disabled={voucherLoading || !voucherCode}
                  className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all whitespace-nowrap">
                  {voucherLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : t('profile.apply')}
                </button>
              </form>
              {voucherError && <p className="text-red-400 text-xs mt-1.5">{voucherError}</p>}
              {voucherSuccess && <p className="text-emerald-400 text-xs mt-1.5">{t('profile.redeemed')}</p>}
            </div>

            {/* Referral Program */}
            <div className={`${isLight ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-gradient-to-br from-emerald-900/20 to-teal-900/10 border-emerald-700/20'} border-l-2 border-l-emerald-500 border rounded-[20px] p-3.5 ${cardShadow}`}>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-emerald-400" />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>{t('profile.referral')}</span>
              </div>
              {affiliateInfo?.discount_applied ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>{affiliateInfo.discount_percent}{t('profile.percentOff')}</p>
                    <p className={`text-xs ${textMuted}`}>{affiliateInfo.voucher_code}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplyAffiliateCode} className="flex gap-2">
                  <input type="text" value={affiliateCode} onChange={(e) => setAffiliateCode(e.target.value)}
                    className={`flex-1 h-9 ${inputBg} border ${inputBorder} rounded-xl px-2 text-xs uppercase text-center ${textMain} ${inputShadow} focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all`}
                    placeholder={t('profile.placeholder.partnerCode')} />
                  <button type="submit" disabled={affiliateLoading || !affiliateCode}
                    className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
                    {affiliateLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : t('profile.apply')}
                  </button>
                </form>
              )}
              {affiliateError && <p className="text-red-400 text-xs mt-1.5">{affiliateError}</p>}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
