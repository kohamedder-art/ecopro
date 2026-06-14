import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  MoreVertical,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Pencil,
  Trash2,
  Eye,
  Copy,
  Check,
  CreditCard,
} from 'lucide-react';

interface Affiliate {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  voucher_code: string;
  payment_amount: string;
  earn_per_referral: string;
  commission_months: number;
  status: string;
  notes: string | null;
  total_referrals: number;
  total_paid_referrals: number;
  total_commission_earned: string;
  total_commission_paid: string;
  referral_count: number;
  pending_commissions: number;
  created_at: string;
  last_login_at: string | null;
}

interface AffiliateDetails {
  affiliate: Affiliate & {
    total_commission: string;
    paid_commission: string;
    pending_commission: string;
  };
  referrals: Array<{
    id: number;
    user_name: string;
    user_email: string;
    created_at: string;
    subscription_status: string | null;
  }>;
  pendingCommissions: Array<{
    id: number;
    user_name: string;
    user_email: string;
    commission_amount: string;
    payment_month: number;
    created_at: string;
  }>;
}

interface ProgramStats {
  total_affiliates: number;
  active_affiliates: number;
  total_referrals: number;
  paid_referrals: number;
  total_commission_earned: string;
  total_commission_paid: string;
  total_commission_pending: string;
  topByReferrals: Array<{ id: number; name: string; voucher_code: string; referral_count: number }>;
  topByEarnings: Array<{ id: number; name: string; voucher_code: string; total_earned: string }>;
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [programStats, setProgramStats] = useState<ProgramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [affiliateDetails, setAffiliateDetails] = useState<AffiliateDetails | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    voucher_code: '',
    payment_amount: '1500',
    earn_per_referral: '500',
    commission_months: '12',
    notes: '',
  });
  const [paymentData, setPaymentData] = useState({
    payment_method: '',
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [statusFilter, search]);

  async function fetchData() {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/affiliates/admin/list?${params}`, { credentials: 'include' }),
        fetch('/api/affiliates/admin/stats', { credentials: 'include' }),
      ]);

      if (!listRes.ok) throw new Error('Failed to fetch affiliates');

      const [listData, statsData] = await Promise.all([
        listRes.json(),
        statsRes.json(),
      ]);

      setAffiliates(listData.affiliates || []);
      setProgramStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load affiliate data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAffiliateDetails(id: number) {
    try {
      const res = await fetch(`/api/affiliates/admin/${id}/details`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch details');
      const data = await res.json();
      setAffiliateDetails(data);
      setShowDetailsDialog(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load affiliate details',
        variant: 'destructive',
      });
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch('/api/affiliates/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          payment_amount: parseFloat(formData.payment_amount) || 0,
          earn_per_referral: parseFloat(formData.earn_per_referral) || 0,
          commission_months: parseInt(formData.commission_months) || 12,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create affiliate');

      toast({
        title: 'Success',
        description: `Affiliate ${data.affiliate.name} created with code ${data.affiliate.voucher_code}`,
      });

      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create affiliate',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedAffiliate) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {};
      if (formData.name) updateData.name = formData.name;
      if (formData.email) updateData.email = formData.email;
      if (formData.password) updateData.password = formData.password;
      if (formData.phone !== undefined) updateData.phone = formData.phone;
      if (formData.voucher_code) updateData.voucher_code = formData.voucher_code;
      if (formData.payment_amount) updateData.payment_amount = parseFloat(formData.payment_amount);
      if (formData.earn_per_referral) updateData.earn_per_referral = parseFloat(formData.earn_per_referral);
      if (formData.commission_months) updateData.commission_months = parseInt(formData.commission_months);
      if (formData.notes !== undefined) updateData.notes = formData.notes;

      const res = await fetch(`/api/affiliates/admin/${selectedAffiliate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update affiliate');

      toast({ title: 'Success', description: 'Affiliate updated successfully' });
      setShowEditDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update affiliate',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this affiliate? This cannot be undone.')) return;
    
    try {
      const res = await fetch(`/api/affiliates/admin/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete affiliate');

      toast({ title: 'Success', description: 'Affiliate deleted successfully' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete affiliate',
        variant: 'destructive',
      });
    }
  }

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      const res = await fetch(`/api/affiliates/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast({ title: 'Success', description: `Affiliate status changed to ${newStatus}` });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  }

  async function handleBulkPay() {
    if (!selectedAffiliate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/affiliates/admin/commissions/bulk-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          affiliate_id: selectedAffiliate.id,
          ...paymentData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process payment');

      toast({
        title: 'Success',
        description: `Paid ${data.paidCount} commissions totaling ${data.totalAmount.toFixed(0)} دج`,
      });

      setShowPayDialog(false);
      setPaymentData({ payment_method: '', reference: '', notes: '' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function openEditDialog(affiliate: Affiliate) {
    setSelectedAffiliate(affiliate);
    setFormData({
      name: affiliate.name,
      email: affiliate.email,
      password: '',
      phone: affiliate.phone || '',
      voucher_code: affiliate.voucher_code,
      payment_amount: affiliate.payment_amount,
      earn_per_referral: affiliate.earn_per_referral,
      commission_months: String(affiliate.commission_months),
      notes: affiliate.notes || '',
    });
    setShowEditDialog(true);
  }

  function openPayDialog(affiliate: Affiliate) {
    setSelectedAffiliate(affiliate);
    setShowPayDialog(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      voucher_code: '',
      payment_amount: '1500',
      earn_per_referral: '500',
      commission_months: '12',
      notes: '',
    });
    setSelectedAffiliate(null);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied!', description: 'Voucher code copied to clipboard' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">برنامج التسويق بالعمولة</h1>
          <p className="text-gray-500">إدارة التجار وتتبع الأرباح</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة تاجر
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء تاجر جديد</DialogTitle>
              <DialogDescription>
                إضافة تاجر/مؤثر جديد إلى البرنامج
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="محمد"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="mohamed@email.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>كلمة المرور *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+213xxxxxxxxx"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>رمز الكوبون *</Label>
                <Input
                  value={formData.voucher_code}
                  onChange={(e) => setFormData({ ...formData, voucher_code: e.target.value.toUpperCase() })}
                  placeholder="JOHN20"
                />
                <p className="text-xs text-gray-500">الرمز الذي سيدخله العملاء عند التسجيل</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>مبلغ الدفع (دج)</Label>
                  <Input
                    type="number"
                    value={formData.payment_amount}
                    onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">المبلغ الذي يدفعه التاجر</p>
                </div>
                <div className="space-y-2">
                  <Label>أرباح التاجر لكل عميل (دج)</Label>
                  <Input
                    type="number"
                    value={formData.earn_per_referral}
                    onChange={(e) => setFormData({ ...formData, earn_per_referral: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">المبلغ الذي يكسبه التاجر لكل عميل شهرياً</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>عدد الأشهر</Label>
                <Input
                  type="number"
                  value={formData.commission_months}
                  onChange={(e) => setFormData({ ...formData, commission_months: e.target.value })}
                />
                <p className="text-xs text-gray-500">كم شهر يكسب التاجر أرباحاً لكل عميل</p>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات داخلية عن هذا التاجر"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>إلغاء</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                إنشاء تاجر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {programStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">إجمالي التجار</p>
                  <p className="text-2xl font-bold">{programStats.total_affiliates}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{programStats.active_affiliates} نشط</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">إجمالي الإحالات</p>
                  <p className="text-2xl font-bold">{programStats.total_referrals}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{programStats.paid_referrals} محولة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">إجمالي الأرباح</p>
                  <p className="text-2xl font-bold">{parseFloat(programStats.total_commission_earned || '0').toFixed(0)} دج</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
              <p className="text-xs text-gray-500 mt-1">الأرباح الكلية</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">المدفوعات المعلقة</p>
                  <p className="text-2xl font-bold text-orange-600">{parseFloat(programStats.total_commission_pending || '0').toFixed(0)} دج</p>
                </div>
                <CreditCard className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
              <p className="text-xs text-gray-500 mt-1">في انتظار الدفع</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="بحث بالاسم أو البريد أو الرمز..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="تصفية حسب الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="disabled">معطل</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Affiliates Table */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {affiliates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">لا يوجد تجار</div>
            ) : (
              affiliates.map((a) => (
                <div key={a.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{a.name}</p>
                      <p className="text-xs text-gray-500 truncate">{a.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={a.status === 'active' ? 'default' : a.status === 'disabled' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {a.status === 'active' ? 'نشط' : a.status === 'disabled' ? 'معطل' : 'موقوف'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => fetchAffiliateDetails(a.id)}>
                            <Eye className="h-4 w-4 ml-2" /> التفاصيل
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(a)}>
                            <Pencil className="h-4 w-4 ml-2" /> تعديل
                          </DropdownMenuItem>
                          {a.pending_commissions > 0 && (
                            <DropdownMenuItem onClick={() => openPayDialog(a)}>
                              <CreditCard className="h-4 w-4 ml-2" /> دفع الأرباح
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleStatusChange(a.id, a.status === 'active' ? 'disabled' : 'active')}>
                            {a.status === 'active' ? 'تعطيل' : 'تفعيل'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(a.id)}>
                            <Trash2 className="h-4 w-4 ml-2" /> حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">{a.voucher_code}</code>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyCode(a.voucher_code)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
                    <div>
                      <span className="text-gray-500">الدفع</span>
                      <p className="font-semibold text-blue-600">{parseFloat(a.payment_amount || '0').toFixed(0)} دج</p>
                    </div>
                    <div>
                      <span className="text-gray-500">الربح/عميل</span>
                      <p className="font-semibold text-emerald-600">{parseFloat(a.earn_per_referral || '0').toFixed(0)} دج ×{a.commission_months}ش</p>
                    </div>
                    <div>
                      <span className="text-gray-500">الإحالات</span>
                      <p className="font-semibold">{a.referral_count || a.total_referrals} <span className="text-gray-400">({a.total_paid_referrals} مدفوع)</span></p>
                    </div>
                    <div>
                      <span className="text-gray-500">الأرباح</span>
                      <p className="font-semibold">{parseFloat(a.total_commission_earned || '0').toFixed(0)} دج</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-right py-4 px-4">التاجر</th>
                  <th className="text-right py-4 px-4">رمز الكوبون</th>
                  <th className="text-center py-4 px-4">الدفع</th>
                  <th className="text-center py-4 px-4">الربح/عميل</th>
                  <th className="text-center py-4 px-4">الإحالات</th>
                  <th className="text-left py-4 px-4">الأرباح</th>
                  <th className="text-left py-4 px-4">المعلق</th>
                  <th className="text-center py-4 px-4">الحالة</th>
                  <th className="text-center py-4 px-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500">
                      لا يوجد تجار
                    </td>
                  </tr>
                ) : (
                  affiliates.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-gray-500">{a.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
                            {a.voucher_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(a.voucher_code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-blue-600 font-medium">{parseFloat(a.payment_amount || '0').toFixed(0)} دج</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-emerald-600 font-medium">{parseFloat(a.earn_per_referral || '0').toFixed(0)} دج</span>
                        <span className="text-gray-400 text-xs mr-1">× {a.commission_months}ش</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-medium">{a.referral_count || a.total_referrals}</span>
                        <span className="text-gray-400 text-xs mr-1">({a.total_paid_referrals} مدفوع)</span>
                      </td>
                      <td className="py-4 px-4 text-left font-medium">
                        {parseFloat(a.total_commission_earned || '0').toFixed(0)} دج
                      </td>
                      <td className="py-4 px-4 text-left">
                        {a.pending_commissions > 0 ? (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            {a.pending_commissions} معلق
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge variant={
                          a.status === 'active' ? 'default' :
                          a.status === 'disabled' ? 'secondary' : 'destructive'
                        }>
                          {a.status === 'active' ? 'نشط' : a.status === 'disabled' ? 'معطل' : 'موقوف'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => fetchAffiliateDetails(a.id)}>
                              <Eye className="h-4 w-4 ml-2" />
                              التفاصيل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(a)}>
                              <Pencil className="h-4 w-4 ml-2" />
                              تعديل
                            </DropdownMenuItem>
                            {a.pending_commissions > 0 && (
                              <DropdownMenuItem onClick={() => openPayDialog(a)}>
                                <CreditCard className="h-4 w-4 ml-2" />
                                دفع الأرباح
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(a.id, a.status === 'active' ? 'disabled' : 'active')}
                            >
                              {a.status === 'active' ? 'تعطيل' : 'تفعيل'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(a.id)}
                            >
                              <Trash2 className="h-4 w-4 ml-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل التاجر</DialogTitle>
            <DialogDescription>
              تحديث معلومات التاجر
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="اتركه فارغاً للاحتفاظ بالحالي"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>رمز الكوبون</Label>
              <Input
                value={formData.voucher_code}
                onChange={(e) => setFormData({ ...formData, voucher_code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>مبلغ الدفع (دج)</Label>
                <Input
                  type="number"
                  value={formData.payment_amount}
                  onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>أرباح التاجر لكل عميل (دج)</Label>
                <Input
                  type="number"
                  value={formData.earn_per_referral}
                  onChange={(e) => setFormData({ ...formData, earn_per_referral: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>عدد الأشهر</Label>
              <Input
                type="number"
                value={formData.commission_months}
                onChange={(e) => setFormData({ ...formData, commission_months: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>إلغاء</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل التاجر</DialogTitle>
            {affiliateDetails && (
              <DialogDescription>
                {affiliateDetails.affiliate.name} ({affiliateDetails.affiliate.voucher_code})
              </DialogDescription>
            )}
          </DialogHeader>
          {affiliateDetails && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">معلومات</TabsTrigger>
                <TabsTrigger value="referrals">الإحالات ({affiliateDetails.referrals.length})</TabsTrigger>
                <TabsTrigger value="pending">المعلقة ({affiliateDetails.pendingCommissions.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">البريد الإلكتروني</Label>
                    <p>{affiliateDetails.affiliate.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">رقم الهاتف</Label>
                    <p>{affiliateDetails.affiliate.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">إجمالي الأرباح</Label>
                    <p className="text-lg font-bold text-emerald-600">
                      {parseFloat(affiliateDetails.affiliate.total_commission || '0').toFixed(0)} دج
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">المعلق</Label>
                    <p className="text-lg font-bold text-orange-600">
                      {parseFloat(affiliateDetails.affiliate.pending_commission || '0').toFixed(0)} دج
                    </p>
                  </div>
                </div>
                {affiliateDetails.affiliate.notes && (
                  <div>
                    <Label className="text-gray-500">ملاحظات</Label>
                    <p className="text-sm">{affiliateDetails.affiliate.notes}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="referrals">
                <div className="max-h-[300px] overflow-y-auto">
                  {affiliateDetails.referrals.map((r) => (
                    <div key={r.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium">{r.user_name}</p>
                        <p className="text-xs text-gray-500">{r.user_email}</p>
                      </div>
                      <div className="text-right">
                        <Badge>{r.subscription_status || 'تجريبي'}</Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(r.created_at).toLocaleDateString('ar-DZ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="pending">
                <div className="max-h-[300px] overflow-y-auto">
                  {affiliateDetails.pendingCommissions.map((c) => (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium">{c.user_name}</p>
                        <p className="text-xs text-gray-500">الشهر {c.payment_month}</p>
                      </div>
                      <p className="font-bold text-emerald-600">
                        {parseFloat(c.commission_amount).toFixed(0)} دج
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دفع الأرباح المعلقة</DialogTitle>
            <DialogDescription>
              {selectedAffiliate && (
                <>
                  دفع جميع الأرباح المعلقة لـ {selectedAffiliate.name}
                  ({selectedAffiliate.pending_commissions} معلقة)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Input
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                placeholder="تحويل بنكي، CCP، نقداً، إلخ."
              />
            </div>
            <div className="space-y-2">
              <Label>رقم المرجع/الإيصال</Label>
              <Input
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                placeholder="رقم المعاملة"
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="ملاحظات إضافية"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>إلغاء</Button>
            <Button onClick={handleBulkPay} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              تم الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
