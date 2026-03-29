import { useState, FormEvent, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock, AlertCircle, Zap, ArrowRight, Loader2 } from "lucide-react";
import { authApi } from "@/lib/auth";
import { safeJsonParse } from "@/utils/safeJson";
import { useTranslation } from "@/lib/i18n";

export default function Login() {
  const { t, locale } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

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
      localStorage.setItem("user", JSON.stringify(user));
      
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
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 pr-10 py-2.5 text-base rounded-xl font-medium transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
                    placeholder="••••••••"
                    dir="ltr"
                  />
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

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold">{t('login.notMerchant')}</span>
                </div>
              </div>
              <div className="text-center -mt-1">
                <Link to="/platform-admin/login" className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {t('login.adminLogin')}
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
