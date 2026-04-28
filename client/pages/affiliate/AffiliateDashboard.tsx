import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Copy,
  LogOut,
  CheckCircle,
  User,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';

interface Affiliate {
  id: number;
  name: string;
  email: string;
  voucher_code: string;
  discount_percent: number;
  commission_percent: number;
  commission_months: number;
  total_referrals: number;
  total_paid_referrals: number;
  total_commission_earned: string;
  total_commission_paid: string;
}

interface Stats {
  referrals: { total: number; paid: number };
  commissions: { totalEarned: number; totalPaid: number; pending: number };
  recentReferrals: Array<{ date: string; count: number }>;
  monthlyEarnings: Array<{ month: string; amount: string }>;
}

interface Referral {
  id: number;
  referred_at: string;
  voucher_code_used: string;
  discount_applied: string;
  user_name: string;
  user_email: string;
  subscription_status: string | null;
  commission_count: string;
  total_commission: string;
}

interface Commission {
  id: number;
  payment_month: number;
  user_paid_amount: string;
  platform_revenue: string;
  commission_percent: string;
  commission_amount: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
}

export default function AffiliateDashboard() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [meRes, statsRes, referralsRes, commissionsRes] = await Promise.all([
        fetch('/api/affiliates/me', { credentials: 'include' }),
        fetch('/api/affiliates/stats', { credentials: 'include' }),
        fetch('/api/affiliates/referrals?limit=50', { credentials: 'include' }),
        fetch('/api/affiliates/commissions?limit=50', { credentials: 'include' }),
      ]);

      if (!meRes.ok) {
        navigate('/affiliate/login', { replace: true });
        return;
      }

      const [meData, statsData, referralsData, commissionsData] = await Promise.all([
        meRes.json(),
        statsRes.json(),
        referralsRes.json(),
        commissionsRes.json(),
      ]);

      setAffiliate(meData);
      setStats(statsData);
      setReferrals(referralsData.referrals || []);
      setCommissions(commissionsData.commissions || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/affiliates/logout', {
        method: 'POST',
        credentials: 'include',
      });
      navigate('/affiliate/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  function copyCode() {
    if (affiliate?.voucher_code) {
      navigator.clipboard.writeText(affiliate.voucher_code);
      toast({
        title: 'Copied!',
        description: 'Voucher code copied to clipboard',
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!affiliate) {
    return null;
  }

  const pendingAmount = stats?.commissions.pending || 0;
  const totalEarned = stats?.commissions.totalEarned || 0;
  const totalPaid = stats?.commissions.totalPaid || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  Affiliate Dashboard
                </h1>
                <p className="text-xs text-gray-500">Welcome back, {affiliate.name}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-3 w-3 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4">
        {/* Voucher Code Card */}
        <Card className="mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-emerald-100 text-xs mb-0.5">Your Voucher Code</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tracking-wider">
                    {affiliate.voucher_code}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyCode}
                    className="bg-white/20 hover:bg-white/30 text-white h-7"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-emerald-100 text-[10px]">Discount</p>
                  <p className="text-lg font-bold">{affiliate.discount_percent}%</p>
                </div>
                <div className="text-center">
                  <p className="text-emerald-100 text-[10px]">Commission</p>
                  <p className="text-lg font-bold">{affiliate.commission_percent}%</p>
                </div>
                <div className="text-center">
                  <p className="text-emerald-100 text-[10px]">Period</p>
                  <p className="text-lg font-bold">{affiliate.commission_months}mo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Card>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Referrals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.referrals.total || 0}
                  </p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {stats?.referrals.paid || 0} paid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Earned</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${totalEarned.toFixed(0)}
                  </p>
                </div>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Lifetime
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${pendingAmount.toFixed(0)}
                  </p>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Awaiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Paid</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalPaid.toFixed(0)}
                  </p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Received
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Referrals and Commissions */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="referrals" className="text-xs">Referrals ({referrals.length})</TabsTrigger>
            <TabsTrigger value="commissions" className="text-xs">Commissions ({commissions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Recent Referrals</CardTitle>
                  <CardDescription className="text-xs">Users who signed up with your code</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {referrals.length === 0 ? (
                    <p className="text-gray-500 text-center py-4 text-xs">No referrals yet</p>
                  ) : (
                    <div className="space-y-2">
                      {referrals.slice(0, 5).map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                              <User className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                            </div>
                            <div>
                              <p className="font-medium text-xs">{r.user_name || r.user_email}</p>
                              <p className="text-[10px] text-gray-500">
                                {new Date(r.referred_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={r.subscription_status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-5">
                            {r.subscription_status || 'trial'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Recent Commissions</CardTitle>
                  <CardDescription className="text-xs">Earnings from your referrals</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {commissions.length === 0 ? (
                    <p className="text-gray-500 text-center py-4 text-xs">No commissions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {commissions.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                              <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="font-medium text-xs">{parseFloat(c.commission_amount).toFixed(0)} دج</p>
                              <p className="text-[10px] text-gray-500">
                                Month {c.payment_month} • {c.user_name || c.user_email}
                              </p>
                            </div>
                          </div>
                          <Badge variant={c.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] h-5">
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">All Referrals</CardTitle>
                <CardDescription className="text-xs">
                  Users who signed up using your voucher code
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {referrals.length === 0 ? (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">No referrals yet</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Share your code <strong>{affiliate.voucher_code}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1">User</th>
                          <th className="text-left py-2 px-1">Date</th>
                          <th className="text-left py-2 px-1">Status</th>
                          <th className="text-right py-2 px-1">Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r) => (
                          <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="py-2 px-1">
                              <div>
                                <p className="font-medium">{r.user_name || 'Unknown'}</p>
                                <p className="text-[10px] text-gray-500">{r.user_email}</p>
                              </div>
                            </td>
                            <td className="py-2 px-1 text-gray-500">
                              {new Date(r.referred_at).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-1">
                              <Badge variant={r.subscription_status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                {r.subscription_status || 'trial'}
                              </Badge>
                            </td>
                            <td className="py-2 px-1 text-right">
                              <span className="font-medium">{parseFloat(r.total_commission || '0').toFixed(0)} دج</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Commission History</CardTitle>
                <CardDescription className="text-xs">
                  Detailed breakdown of your earnings
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {commissions.length === 0 ? (
                  <div className="text-center py-6">
                    <DollarSign className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">No commissions yet</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Earn when referrals make payments
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-1">User</th>
                          <th className="text-left py-2 px-1">Month</th>
                          <th className="text-right py-2 px-1">Commission</th>
                          <th className="text-center py-2 px-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c) => (
                          <tr key={c.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="py-2 px-1">
                              <div>
                                <p className="font-medium">{c.user_name || 'Unknown'}</p>
                                <p className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString()}</p>
                              </div>
                            </td>
                            <td className="py-2 px-1">
                              <Badge variant="outline" className="text-[10px] h-5">Mo {c.payment_month}</Badge>
                            </td>
                            <td className="py-2 px-1 text-right font-medium text-emerald-600">
                              ${parseFloat(c.commission_amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-1 text-center">
                              <Badge variant={
                                c.status === 'paid' ? 'default' :
                                c.status === 'pending' ? 'secondary' : 'destructive'
                              } className="text-[10px] h-5">
                                {c.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
