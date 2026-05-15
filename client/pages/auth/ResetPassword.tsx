import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { FloatingShapes } from "@/components/ui/floating-shapes";
import { Lock, Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid reset link. Please request a new one.");
    }
  }, [token, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="relative container mx-auto py-8 sm:py-12 min-h-[70vh] flex items-center justify-center overflow-hidden">
        <FloatingShapes variant="section" colors="cool" />
        
        <div className="relative z-10 mx-auto max-w-sm sm:max-w-md w-full px-4">
          <div className="rounded-xl sm:rounded-2xl border-2 border-green-500/30 bg-gradient-to-br from-card via-card to-green-500/5 p-6 sm:p-8 shadow-2xl backdrop-blur-sm text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">
              {t("auth.passwordResetSuccess") || "Password Reset!"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("auth.redirectingToLogin") || "Your password has been reset. Redirecting to login..."}
            </p>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (!token || !email) {
    return (
      <section className="relative container mx-auto py-8 sm:py-12 min-h-[70vh] flex items-center justify-center overflow-hidden">
        <FloatingShapes variant="section" colors="cool" />
        
        <div className="relative z-10 mx-auto max-w-sm sm:max-w-md w-full px-4">
          <div className="rounded-xl sm:rounded-2xl border-2 border-red-500/30 bg-gradient-to-br from-card via-card to-red-500/5 p-6 sm:p-8 shadow-2xl backdrop-blur-sm text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 mb-4">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">
              {t("auth.invalidResetLink") || "Invalid Reset Link"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("auth.requestNewLink") || "This reset link is invalid or expired. Please request a new one."}
            </p>
            <Link to="/forgot-password">
              <Button className="w-full">
                {t("auth.requestNewResetLink") || "Request New Link"}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative container mx-auto py-8 sm:py-12 min-h-[70vh] flex items-center justify-center overflow-hidden">
      <FloatingShapes variant="section" colors="cool" />
      
      <div className="relative z-10 mx-auto max-w-sm sm:max-w-md w-full px-4">
        <div className="rounded-xl sm:rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-accent mb-3 shadow-lg">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t("auth.resetPassword") || "Reset Password"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t("auth.enterNewPassword") || "Enter your new password below"}
            </p>
          </div>
          
          {error && (
            <div className="p-3 rounded-xl text-sm bg-red-500/10 border-2 border-red-500/20 mb-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                {t("auth.newPassword") || "New Password"}
              </label>
              <input 
                type="password"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full rounded-lg border-2 border-primary/20 bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={8}
              />
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                {t("auth.confirmPassword") || "Confirm Password"}
              </label>
              <input 
                type="password"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="w-full rounded-lg border-2 border-primary/20 bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={8}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all py-5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("loading") || "Resetting..."}
                </>
              ) : (
                t("auth.resetPassword") || "Reset Password"
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline font-medium flex items-center justify-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("auth.backToLogin") || "Back to Login"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
