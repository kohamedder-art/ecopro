import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Gift, Clock, MessageCircle, CheckCircle, Copy, Sparkles } from 'lucide-react';

/**
 * Renew Subscription Page
 * Users with expired subscriptions are redirected here.
 * They can enter a voucher code to reactivate their account.
 */
export default function RenewSubscription() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Check subscription status on load
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const res = await fetch('/api/billing/check-access');

      if (res.status === 401 || res.status === 403) {
        navigate('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setSubscriptionInfo(data);
        
        // If subscription is active, redirect to dashboard
        if (data.hasAccess) {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a voucher code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setSubscriptionInfo(data.subscription);
        
        // Refresh user data in localStorage to clear any lock flags
        try {
          const meRes = await fetch('/api/auth/me');
          if (meRes.ok) {
            const userData = await meRes.json();
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (e) {
          console.error('Failed to refresh user data:', e);
        }
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard'; // Full reload to refresh all components
        }, 2000);
      } else {
        setError(data.error || 'Failed to redeem code. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    navigate('/chat');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  // Format code as user types (XXXX-XXXX-XXXX-XXXX)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Add dashes every 4 characters
    if (value.length > 4) {
      value = value.match(/.{1,4}/g)?.join('-') || value;
    }
    
    // Limit to 19 characters (16 + 3 dashes)
    if (value.length <= 19) {
      setCode(value);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur-md rounded-3xl border border-emerald-500/50 shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-emerald-300 mb-4">Subscription Activated! 🎉</h1>
          <p className="text-emerald-200 mb-6">
            Your account has been reactivated for 30 days. Redirecting to dashboard...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6 border-b border-amber-500/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-amber-300">Subscription Expired</h1>
                <p className="text-amber-200/80 text-sm">Your account access has been paused</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-slate-300">
              <p className="mb-4">
                Your subscription has expired. To continue using all features, please enter a voucher code below or contact support for assistance.
              </p>
              
              {subscriptionInfo && (
                <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Clock className="w-4 h-4" />
                    <span>Account Status</span>
                  </div>
                  <p className="text-amber-400 font-medium capitalize">{subscriptionInfo.status || 'Expired'}</p>
                </div>
              )}
            </div>

            {/* Code Input Form */}
            <form onSubmit={handleRedeemCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Gift className="w-4 h-4 inline mr-2" />
                  Enter Voucher Code
                </label>
                <Input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="bg-slate-900/50 border-slate-600 text-white text-center text-lg font-mono tracking-wider h-14"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Enter the 16-character code you received
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || code.length < 19}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white h-12 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Activate Subscription
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>

            {/* Support Button */}
            <Button
              onClick={handleContactSupport}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50 h-12"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contact Support for a Code
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-cyan-400" />
            How to get a voucher code
          </h3>
          <ul className="text-sm text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">1.</span>
              <span>Contact our support team via the chat button above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">2.</span>
              <span>Request a subscription renewal code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">3.</span>
              <span>Enter the code above to instantly reactivate your account</span>
            </li>
          </ul>
        </div>

        {/* Logout Link */}
        <div className="text-center">
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
