import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, User, ShoppingBag, Sparkles, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

interface StaffUser {
  id: number;
  email: string;
  role: 'manager' | 'staff';
  permissions: Record<string, boolean>;
  store_name?: string;
  storeName?: string;
  status: 'pending' | 'active' | 'inactive';
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const fetchBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch('/api/ai/staff/order-digest', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.digest || data.text || 'No briefing available.');
      } else {
        setBriefing('Could not load AI briefing.');
      }
    } catch {
      setBriefing('Could not reach AI service.');
    } finally {
      setBriefingLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/staff/me');
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data?.error || 'Failed to validate authentication';

          if (res.status === 403 && (data?.code === 'SUBSCRIPTION_EXPIRED' || data?.paymentRequired)) {
            navigate('/account-locked', { replace: true });
            return;
          }

          setError(msg);
          localStorage.removeItem('user');
          localStorage.removeItem('staffId');
          localStorage.removeItem('isStaff');
          navigate('/staff/login');
          return;
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('staffId', String(data.staffId));
        localStorage.setItem('isStaff', 'true');
        setUser(data.user);
      } catch (err) {
        console.error('[StaffDashboard] Validation error:', err);
        setError('Failed to validate authentication');
        localStorage.removeItem('user');
        localStorage.removeItem('staffId');
        localStorage.removeItem('isStaff');
        navigate('/staff/login');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [navigate]);

  const handleLogout = () => {
    void fetch('/api/staff/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('user');
    localStorage.removeItem('staffId');
    localStorage.removeItem('isStaff');
    navigate('/staff/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Card className="bg-slate-800 border-red-600 max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">{error}</p>
            <Button onClick={() => navigate('/staff/login')} className="w-full">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Count available permissions
  const availablePermissions = Object.values(user.permissions || {}).filter(Boolean).length;
  const canViewOrders = user.permissions?.view_orders === true;

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-slate-800 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">{user.storeName || user.store_name || 'Your Store'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/staff/orders')}
              disabled={!canViewOrders}
              className="gap-2 bg-slate-700 dark:bg-slate-800 border-slate-600 dark:border-slate-700 text-slate-200 hover:bg-slate-600 dark:hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              Orders
            </Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2 bg-slate-700 dark:bg-slate-800 border-slate-600 dark:border-slate-700 text-slate-200 hover:bg-slate-600 dark:hover:bg-slate-700 hover:text-white">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <Card className="mb-8 bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-900 dark:bg-blue-950 rounded-lg flex items-center justify-center border border-blue-700 dark:border-blue-800">
                  <User className="w-6 h-6 text-blue-400 dark:text-blue-300" />
                </div>
                <div>
                  <CardTitle className="text-white">Welcome, {user.email}</CardTitle>
                  <CardDescription className="text-slate-400">You are logged in as a {user.role}</CardDescription>
                </div>
              </div>
              <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className={user.status === 'active' ? 'bg-green-600 dark:bg-green-700' : 'bg-slate-600 dark:bg-slate-700'}>
                {user.status === 'active' ? 'Active' : 'Pending'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Permissions Overview */}
        <Card className="bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Your Permissions</CardTitle>
            <CardDescription className="text-slate-400">
              You have access to {availablePermissions} features in this store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(user.permissions || {}).map(([permission, hasAccess]) => (
                <div key={permission} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700 dark:bg-slate-800 border border-slate-600 dark:border-slate-700">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      hasAccess ? 'bg-green-500 dark:bg-green-400' : 'bg-slate-500 dark:bg-slate-600'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-300 capitalize">
                    {permission.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Briefing Card */}
        <Card className="mt-8 bg-slate-800 dark:bg-slate-900 border-purple-700/40 dark:border-purple-800/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-900/60 rounded-lg flex items-center justify-center border border-purple-700/50">
                  <BrainCircuit className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-white">AI Order Briefing</CardTitle>
                  <CardDescription className="text-slate-400">Let AI summarize today's order activity for you</CardDescription>
                </div>
              </div>
              <Button
                onClick={fetchBriefing}
                disabled={briefingLoading}
                size="sm"
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white border-0"
              >
                {briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {briefingLoading ? 'Loading...' : briefing ? 'Refresh' : 'Get Briefing'}
              </Button>
            </div>
          </CardHeader>
          {briefing && (
            <CardContent>
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/30 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {briefing}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Actions */}
        <Card className="mt-8 bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">What you can do</CardTitle>
            <CardDescription className="text-slate-400">
              Only actions you’re permitted to access are enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/staff/orders')}
                disabled={!canViewOrders}
                className="gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                Orders
              </Button>
              {!canViewOrders ? (
                <div className="text-sm text-slate-400 flex items-center">
                  You don’t have permission to view orders.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
