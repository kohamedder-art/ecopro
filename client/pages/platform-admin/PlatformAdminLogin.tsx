import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FloatingShapes } from "@/components/ui/floating-shapes";
import { Loader2, Lock, LogIn, Mail, ShieldAlert } from "lucide-react";
import { startAutoRefresh, syncAuthState } from "@/lib/auth";
import Header from "@/components/layout/Header";

type LoginOkResponse = {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    user_type?: string;
  };
};

type LoginErrorResponse = {
  error?: string;
  twoFactorRequired?: boolean;
};

async function logPlatformAdminEvent(event_type: string, metadata?: any) {
  try {
    await fetch("/api/intel/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, metadata }),
      credentials: "include",
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}

export default function PlatformAdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in as admin, go straight to admin.
    const existing = localStorage.getItem("user");
    if (existing) {
      try {
        const u = JSON.parse(existing);
        if (u?.role === "admin") {
          syncAuthState()
            .then((ok) => {
              if (ok) navigate("/platform-admin", { replace: true });
            })
            .catch(() => null);
        }
      } catch {
        // ignore
      }
    }

    void logPlatformAdminEvent("platform_admin_login_page_view", {
      page_path: "/platform-admin/login",
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          totp_code: totpCode || undefined,
          backup_code: backupCode || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginOkResponse & LoginErrorResponse;

      if (!res.ok) {
        if (data?.twoFactorRequired) {
          setNeeds2fa(true);
          setError("Two-factor authentication required");
          await logPlatformAdminEvent("platform_admin_login_2fa_required", {
            page_path: "/platform-admin/login",
          });
          return;
        }

        setError(data?.error || "Login failed");
        await logPlatformAdminEvent("platform_admin_login_failed", {
          page_path: "/platform-admin/login",
          status: res.status,
          message: data?.error || null,
        });
        return;
      }

      if (data?.user?.role !== "admin") {
        // Do not allow non-admin accounts to sign in via the admin page.
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
          // ignore
        }
        localStorage.removeItem("user");
        localStorage.removeItem("isAdmin");

        setError("This account is not an admin.");
        await logPlatformAdminEvent("platform_admin_login_non_admin", {
          page_path: "/platform-admin/login",
          status: 200,
        });
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("isAdmin", "true");
      startAutoRefresh();

      await logPlatformAdminEvent("platform_admin_login_success", {
        page_path: "/platform-admin/login",
      });

      navigate("/platform-admin", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      await logPlatformAdminEvent("platform_admin_login_error", {
        page_path: "/platform-admin/login",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <section className="relative container mx-auto py-6 sm:py-10 min-h-[70vh] flex items-center justify-center overflow-hidden">
      <FloatingShapes variant="section" colors="cool" />

      <div className="relative z-10 mx-auto max-w-sm w-full px-3">
        <div className="rounded-xl sm:rounded-2xl border-2 border-red-500/20 bg-gradient-to-br from-card via-card to-red-500/5 p-5 sm:p-7 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-3 sm:mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 mb-2 shadow-lg">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
              Platform Admin
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Restricted access</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm bg-red-500/10 border-2 border-red-500/20 text-red-600 dark:text-red-400 mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-red-500" />
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border-2 border-red-500/20 bg-background px-3 py-1.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="admin@..."
                type="email"
                required
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-red-500" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-red-500/20 bg-background px-3 py-1.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {needs2fa && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">TOTP Code</label>
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full rounded-lg border-2 border-red-500/20 bg-background px-3 py-1.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                    placeholder="123456"
                    disabled={loading}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">Backup Code (optional)</label>
                  <input
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    className="w-full rounded-lg border-2 border-red-500/20 bg-background px-3 py-1.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                    placeholder="backup-code"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-600/90 hover:to-orange-500/90 shadow-lg hover:shadow-xl transition-all py-3 sm:py-4 text-sm sm:text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 ml-2" />
                    Sign in
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
    </>
  );
}
