import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { 
  User, 
  Mail, 
  Lock, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Tag, 
  AlertCircle,
  Zap,
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Signup() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherValid, setVoucherValid] = useState<boolean | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Check for OAuth errors
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [searchParams]);

  // Check if Google OAuth is enabled
  useEffect(() => {
    fetch('/api/oauth/config')
      .then(res => res.json())
      .then(data => setGoogleEnabled(data.google?.enabled || false))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // Validate voucher code when it changes
  useEffect(() => {
    if (!voucherCode.trim()) {
      setVoucherValid(null);
      setVoucherDiscount(0);
      return;
    }

    const timer = setTimeout(async () => {
      setVoucherLoading(true);
      try {
        const res = await fetch(`/api/affiliates/validate/${encodeURIComponent(voucherCode.trim())}`);
        if (!res.ok) throw new Error('Invalid');
        const data = await res.json();
        setVoucherValid(data.valid);
        setVoucherDiscount(data.valid ? data.discount_percent : 0);
      } catch {
        setVoucherValid(false);
        setVoucherDiscount(0);
      } finally {
        setVoucherLoading(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [voucherCode]);

  function isGmailSignup(value: string) {
    return value.trim().toLowerCase().endsWith('@gmail.com');
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/oauth/google/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('تعذر الاتصال بخدمة جوجل حالياً');
        setGoogleLoading(false);
      }
    } catch {
      setError('فشل الاتصال بخدمة جوجل');
      setGoogleLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!isGmailSignup(email)) {
        throw new Error(t('signup.gmailOnlyError'));
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email, 
          password, 
          name, 
          role: 'client',
          voucher_code: voucherCode.trim() || undefined 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء الحساب. تأكد من صحة البيانات.');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.role === 'admin' || data.user.user_type === 'admin') {
          localStorage.setItem('isAdmin', 'true');
        }
      }
      
      setSuccess(t('signup.success'));
      setTimeout(() => navigate('/dashboard'), 1500);

    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden overflow-y-auto relative font-['Noto_Sans_Arabic'] flex flex-col">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full z-0 bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.08)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.05)_0%,transparent_35%)] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.15)_0%,transparent_35%),radial-gradient(circle_at_90%_90%,rgba(168,85,247,0.12)_0%,transparent_35%)]"></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[50vw] h-[40vh] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_60%)] blur-[80px] z-0 opacity-80 pointer-events-none"></div>

      <div className="my-auto w-full px-4 sm:px-6 py-6 flex flex-col items-center">
        <div className="relative z-10 w-full sm:max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2 mb-3 group cursor-pointer">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)] group-hover:scale-105 transition-transform duration-300">
              <Zap className="text-white w-4 h-4" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">Sahla<span className="text-indigo-500">4</span>Eco</span>
          </Link>
          <h2 className="text-center text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('signup.title')}
          </h2>
          <p className="mt-1 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
            {t('signup.hasAccount')}{' '}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
              {t('signup.loginLink')}
            </Link>
          </p>
        </div>

        <div className="mt-4 w-full sm:max-w-[480px] relative z-10">
          <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md py-5 px-5 sm:px-8 shadow-[0_8px_30px_-12px_rgba(99,102,241,0.2)] dark:shadow-[0_8px_30px_-12px_rgba(99,102,241,0.4)] border border-indigo-100 dark:border-white/5 rounded-3xl">
          
          {error && (
            <div className="mb-3 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-2.5 rounded-xl flex items-start gap-3 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-3 bg-green-50/80 backdrop-blur-sm border border-green-200 text-green-700 px-4 py-2.5 rounded-xl flex items-start gap-3 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSignup}>
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('signup.nameLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 pr-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
                  placeholder={t('signup.namePlaceholder')}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('signup.emailLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 pr-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50 ${
                    email && !isGmailSignup(email) ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  placeholder="name@gmail.com"
                  dir="ltr"
                />
                {email && !isGmailSignup(email) && (
                  <p className="text-xs text-red-500 font-semibold mt-1">{t('signup.emailError')}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('signup.passwordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 px-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50 text-left ${
                    password && password.length < 12 ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {password && password.length < 12 && (
                <p className="text-xs text-red-500 font-semibold mt-1">{t('signup.passwordError')}</p>
              )}
            </div>

            {/* Voucher Code */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('signup.voucherLabel')} <span className="text-slate-400 dark:text-slate-500 font-medium">{t('signup.voucherOptional')}</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Tag className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className={`block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 pr-10 py-2.5 text-base rounded-xl font-bold tracking-wider transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50 ${
                    voucherValid === true ? 'border-green-400 !bg-green-50 focus:border-green-500 focus:ring-green-500' : 
                    voucherValid === false ? 'border-red-400 !bg-red-50 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder={t('signup.voucherPlaceholder')}
                  dir="ltr"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {voucherLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : voucherValid === true ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : voucherValid === false ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : null}
                </div>
              </div>
              {voucherValid === true && voucherDiscount > 0 && (
                <p className="mt-2 text-sm text-green-600 font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  {t('signup.voucherValid', { n: voucherDiscount })}
                </p>
              )}
              {voucherValid === false && (
                <p className="mt-2 text-sm text-red-500 font-semibold">{t('signup.voucherInvalid')}</p>
              )}
            </div>

            <div>
              <Button
                type="submit"
                disabled={loading || (email.length > 0 && !isGmailSignup(email)) || (password.length > 0 && password.length < 12)}
                className="w-full flex justify-center h-12 px-4 border border-transparent rounded-xl shadow-lg text-base font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:-translate-y-0.5 group disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>                    
                    {t('signup.submit')}
                    <ArrowRight className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
            
          </form>

          {/* Social Signups */}
          {googleEnabled && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
               <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-sm mb-4">
                    <span className="px-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold">{t('signup.orWith')}</span>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading}
                  className="w-full h-12 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 flex items-center justify-center gap-3 font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all shadow-sm"
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon className="w-5 h-5" />
                      {t('signup.googleBtn')}
                    </>
                  )}
                </Button>
            </div>
          )}

          <div className="mt-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('signup.terms')}{' '}<Link to="#" className="text-indigo-600 hover:underline">{t('signup.termsLink')}</Link>{' '}{t('signup.and')}{' '}<Link to="#" className="text-indigo-600 hover:underline">{t('signup.privacyLink')}</Link> {locale === 'ar' ? 'الخاصة بنا.' : '.'}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
