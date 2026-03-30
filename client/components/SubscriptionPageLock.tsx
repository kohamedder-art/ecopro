import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Gift, Lock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionPageLockProps {
  children: ReactNode;
}

/**
 * Page-level subscription/payment lock.
 *
 * Requirement:
 * - After subscription ends (or payment lock), user can still use dashboard,
 *   but Orders and Bot pages must be blurred + blocked.
 * - User can still go to Codes and Chat to request/unlock.
 */
export default function SubscriptionPageLock({ children }: SubscriptionPageLockProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [locked, setLocked] = useState<{ locked: boolean; loading: boolean }>({
    locked: false,
    loading: true,
  });

  useEffect(() => {
    void checkLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const checkLock = async () => {
    try {
      // First, fetch fresh user data from the server to check is_locked status
      const meRes = await fetch('/api/auth/me');

      if (meRes.status === 401 || meRes.status === 403) {
        setLocked({ locked: false, loading: false });
        return;
      }

      if (meRes.ok) {
        const userData = await meRes.json();
        // Update localStorage with fresh user data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          const updatedUser = { ...parsedUser, is_locked: userData.is_locked, locked_reason: userData.locked_reason };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        // If user is locked (subscription issue), show the lock
        if (userData.is_locked) {
          setLocked({ locked: true, loading: false });
          return;
        }
      }

      // Subscription ended
      const res = await fetch('/api/billing/check-access');

      if (!res.ok) {
        setLocked({ locked: false, loading: false });
        return;
      }

      const data = await res.json();
      setLocked({ locked: !data.hasAccess, loading: false });
    } catch {
      setLocked({ locked: false, loading: false });
    }
  };

  if (locked.loading || !locked.locked) {
    return <>{children}</>;
  }

  // Check if on bot/wasselni page to show bot-specific message
  const isBotPage = location.pathname.includes('bot-settings') || location.pathname.includes('customer-bot') || location.pathname.includes('bot');

  return (
    <div className="relative">
      <div className="filter blur-sm brightness-75 pointer-events-none select-none">{children}</div>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-[2px]" style={{ top: '64px' }}>
        <div className="max-w-md w-full mx-4">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/30 to-orange-500/30 p-8 text-center border-b border-amber-500/30">
              <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-500/50">
                <Lock className="w-12 h-12 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-amber-300">Subscription Ended</h2>
              <p className="text-amber-200/80 mt-2">
                {isBotPage ? 'All bots are disabled' : 'This page requires an active subscription'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-center">
                {isBotPage 
                  ? 'Your bots will not work until you renew your subscription. Enter a voucher code or contact support to restore your service.'
                  : 'Your month ended. To unlock Orders and Bot, enter a voucher code or contact support.'
                }
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/pricing')}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white h-12 text-lg font-semibold"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  Get Subscription Code
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <Button
                  onClick={() => navigate('/chat')}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 h-11"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contact Support
                </Button>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-400 text-center">
                  {isBotPage 
                    ? 'All bot messages and order confirmations are paused until your subscription is renewed.'
                    : 'Support can issue a code or unlock your account after renewal.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
