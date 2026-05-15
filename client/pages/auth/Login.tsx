import { useState, FormEvent, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, AlertCircle, Zap, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/auth";
import { safeJsonParse } from "@/utils/safeJson";
import { useTranslation } from "@/lib/i18n";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const { t, locale } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/oauth/config')
      .then(r => r.json())
      .then(data => { if (data.google?.enabled) setGoogleEnabled(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Check for OAuth errors
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    const oauthErrorType = params.get('error');
    
    if (oauthError) {
      setError(oauthError);
      console.error('[Login] OAuth error from URL:', oauthError);
    } else if (oauthErrorType) {
      const errorMsg = oauthErrorType === 'no_code' ? 'No authorization code received' :
                      oauthErrorType === 'no_email' ? 'Email not found in Google account' :
                      oauthErrorType === 'account_locked' ? 'Account is locked' :
                      oauthErrorType === 'oauth_failed' ? 'OAuth authentication failed' :
                      'Authentication error: ' + oauthErrorType;
      setError(errorMsg);
      console.error('[Login] OAuth error:', oauthErrorType);
    }
    
    // Check for localStorage error
    const storedError = localStorage.getItem('oauth_error');
    if (storedError && !oauthError && !oauthErrorType) {
      setError(storedError);
      localStorage.removeItem('oauth_error');
    }
  }, [location.search]);

  useEffect(() => {
    // Basic redirect if already logged in
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = safeJsonParse(userStr, null);
      if (user && user.role === "admin") {
         navigate('/platform-admin');
      } else {
         navigate('/dashboard');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const targetPath = location.state?.from?.pathname;
      const res = await authApi.login({ email, password });
      
      const { user } = res;
      // Clear stale auth state before setting new session
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('isStaff');
      localStorage.removeItem('staffId');
      localStorage.setItem("user", JSON.stringify(user));
      if (user.role === 'admin' || user.user_type === 'admin') {
        localStorage.setItem('isAdmin', 'true');
      }
      toast.success(t('login.success'));

      if (targetPath) {
        navigate(targetPath);
      } else {
        if (user.role === 'admin') {
          navigate("/platform-admin");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || "فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/oauth/google/url');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error('Failed to start Google login');
    } finally {
      setGoogleLoading(false);
    }
  };

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
            {t('login.title')}
          </h2>
          <p className="mt-1 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
            {t('login.noAccount')}{' '}
            <Link to="/signup" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
              {t('login.signupLink')}
            </Link>
          </p>
        </div>

        <div className="mt-4 w-full sm:max-w-[440px] relative z-10">
          <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md py-6 px-5 sm:px-8 shadow-[0_8px_30px_-12px_rgba(99,102,241,0.2)] dark:shadow-[0_8px_30px_-12px_rgba(99,102,241,0.4)] border border-indigo-100 dark:border-white/5 rounded-3xl">

            {error && (
              <div className="mb-4 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 px-4 py-2.5 rounded-xl flex items-start gap-3 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('login.emailLabel')}
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
                    className="block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 pr-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
                    placeholder="name@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('login.passwordLabel')}
                  </label>
                  <Link to="/forgot-password" className="text-sm font-bold text-indigo-600 hover:text-indigo-500">
                    {t('login.forgotPassword')}
                  </Link>
                </div>
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
                    className="block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 px-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center h-12 px-4 border border-transparent rounded-xl shadow-lg text-base font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:-translate-y-0.5 group disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {t('login.submit')}
                      <ArrowRight className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>

            </form>

            {googleEnabled && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="relative flex justify-center text-sm mb-4">
                  <span className="px-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold">{t('signup.orWith') || 'أو'}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full h-12 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 flex items-center justify-center gap-3 font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all shadow-sm"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><GoogleIcon className="w-5 h-5" />{t('login.googleBtn') || 'تسجيل الدخول بـ Google'}</>}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
