import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, ShoppingBag } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type StaffUser = {
  id: number;
  email: string;
  role: 'manager' | 'staff';
  permissions: Record<string, boolean>;
  storeName?: string;
  store_name?: string;
  status: 'pending' | 'active' | 'inactive';
};

type StaffOrder = {
  id: number;
  product_id: number | null;
  status: string;
  total_price: number | string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  product_title: string | null;
  product_images: any;
};

type OrderStatus = {
  id: string | number;
  name: string;
  key: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_default?: boolean;
  is_system?: boolean;
};

export default function StaffOrders() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [me, setMe] = React.useState<StaffUser | null>(null);
  const [orders, setOrders] = React.useState<StaffOrder[]>([]);
  const [statusOptions, setStatusOptions] = React.useState<OrderStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingId, setUpdatingId] = React.useState<number | null>(null);

  const canView = me?.permissions?.view_orders === true;
  const canEdit = me?.permissions?.edit_orders === true;

  React.useEffect(() => {
    const run = async () => {
      try {
        const meRes = await fetch('/api/staff/me');
        const meData = await meRes.json().catch(() => null);

        if (!meRes.ok) {
          if (meRes.status === 403 && (meData?.code === 'SUBSCRIPTION_EXPIRED' || meData?.paymentRequired)) {
            navigate('/account-locked', { replace: true });
            return;
          }
          navigate('/staff/login', { replace: true });
          return;
        }

        localStorage.setItem('user', JSON.stringify(meData.user));
        localStorage.setItem('staffId', String(meData.staffId));
        localStorage.setItem('isStaff', 'true');

        const user: StaffUser = meData.user;
        setMe(user);

        if (user?.permissions?.view_orders !== true) {
          setOrders([]);
          setError('Permission denied: view_orders');
          setLoading(false);
          return;
        }

        const ordersRes = await fetch('/api/staff/orders');
        const ordersData = await ordersRes.json().catch(() => null);
        if (!ordersRes.ok) {
          setError(ordersData?.error || 'Failed to load orders');
          setOrders([]);
          setLoading(false);
          return;
        }

        // Load statuses for dropdown (includes system/bot statuses like didnt_pickup)
        try {
          const statusRes = await fetch('/api/staff/order-statuses');
          const statusData = await statusRes.json().catch(() => null);
          if (statusRes.ok && Array.isArray(statusData)) {
            setStatusOptions(statusData);
          }
        } catch {
          // ignore
        }

        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
        setLoading(false);
      }
    };

    void run();
  }, [navigate]);

  const getStatusLabel = (statusKey: string) => {
    const key = (statusKey || 'pending').toLowerCase();
    const translated = t(`orders.status.${key}`);
    if (translated && translated !== `orders.status.${key}`) return translated;
    const fromServer = statusOptions.find((s) => String(s.key).toLowerCase() === key)?.name;
    if (fromServer) return fromServer;
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/staff/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('user');
    localStorage.removeItem('staffId');
    localStorage.removeItem('isStaff');
    navigate('/staff/login', { replace: true });
  };

  const updateStatus = async (orderId: number, status: string) => {
    if (!canEdit) return;

    setUpdatingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Failed to update status');
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!me) return null;

  const storeName = me.storeName || me.store_name || 'Your Store';

  return (
    <div className="min-h-screen">
      <div className="border-b sticky top-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("staff.orders") || "Orders"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{storeName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/staff/dashboard')}>Dashboard</Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-destructive">{error}</CardTitle>
            </CardHeader>
          </Card>
        ) : null}

        {!canView ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("staff.permissionDenied") || "Access restricted"}</CardTitle>
            </CardHeader>
            <CardContent>
              {t("staff.noViewOrdersPermission") || "You don't have permission to view orders."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No orders</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  There are no orders for this store yet.
                </CardContent>
              </Card>
            ) : (
              orders.map((o) => {
                const status = (o.status || 'pending').toLowerCase();
                const updating = updatingId === o.id;

                const fallbackStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'failed', 'returned', 'didnt_pickup', 'delivery_failed'];
                const dropdownStatuses = statusOptions.length > 0
                  ? statusOptions.map((s) => String(s.key)).filter(Boolean)
                  : fallbackStatuses;

                return (
                  <Card key={o.id}>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md border flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold">Order #{o.id}</div>
                          <div className="text-sm text-muted-foreground">
                            {o.product_title || 'Product'} • {o.customer_name || 'Customer'}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {getStatusLabel(status)}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="text-sm text-muted-foreground">
                        <div>Phone: {o.customer_phone || '—'}</div>
                        <div>Address: {o.shipping_address || '—'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          Total: {o.total_price ?? '—'}
                        </div>
                        <Select
                          disabled={!canEdit || updating}
                          value={status}
                          onValueChange={(v) => updateStatus(o.id, v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('orders.changeStatus') || 'Change status'} />
                          </SelectTrigger>
                          <SelectContent>
                            {dropdownStatuses.map((s) => (
                              <SelectItem key={s} value={s}>
                                {getStatusLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
