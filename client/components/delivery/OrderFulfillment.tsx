// Order fulfillment component with delivery management
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, Printer, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { DeliveryCompanyLogo } from '@/components/delivery/DeliveryCompanyLogo';

interface DeliveryCompany {
  id: number;
  name: string;
  features: {
    supports_cod: boolean;
    supports_tracking: boolean;
    supports_labels: boolean;
  };
  is_configured?: boolean;
  has_api_key?: boolean;
}

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_price: number;
  delivery_company_id?: number;
  tracking_number?: string;
  delivery_status?: string;
  shipping_label_url?: string;
}

interface OrderFulfillmentProps {
  order: Order;
  onDeliveryAssigned?: () => void;
}

export function OrderFulfillment({ order, onDeliveryAssigned }: OrderFulfillmentProps) {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(order.delivery_company_id || null);
  const [codAmount, setCodAmount] = useState<number>(order.total_price);
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [labelGenerating, setLabelGenerating] = useState(false);

  // Fetch available delivery companies
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/delivery/companies');
      if (response.ok) {
        const data = await response.json();
        // Only show configured/connected companies
        setCompanies(data.filter((c: DeliveryCompany) => c.is_configured && c.has_api_key));
      }
    } catch (err) {
      console.error('فشل في جلب شركات التوصيل', err);
    }
  };

  const handleAssignDelivery = async () => {
    if (!selectedCompany) {
      setError('الرجاء اختيار شركة توصيل');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/delivery/orders/${order.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_company_id: selectedCompany,
          cod_amount: codAmount > 0 ? codAmount : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // If backend provides field errors with Arabic messages, use them
        if (data.courier_response && data.courier_response.fieldErrors) {
          const arabicDetails = data.courier_response.fieldErrors
            .map((e: any) => e.message_ar || `${e.field}: ${e.code}`)
            .join('، ');
          throw new Error(`${data.error || 'فشل في تعيين شركة التوصيل'} (معلومات ناقصة: ${arabicDetails})`);
        }
        throw new Error(data.error || 'فشل في تعيين شركة التوصيل');
      }

      setSuccess('Delivery company assigned successfully!');
      setShowDialog(false);
      onDeliveryAssigned?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLabel = async () => {
    if (!selectedCompany) {
      setError('No delivery company selected');
      return;
    }

    setLabelGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/delivery/orders/${order.id}/generate-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_company_id: selectedCompany,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.courier_response && data.courier_response.fieldErrors) {
          const arabicDetails = data.courier_response.fieldErrors
            .map((e: any) => e.message_ar || `${e.field}: ${e.code}`)
            .join('، ');
          throw new Error(`${data.error || 'فشل في إنشاء بطاقة الشحن'} (معلومات ناقصة: ${arabicDetails})`);
        }
        throw new Error(data.error || 'فشل في إنشاء بطاقة الشحن');
      }

      const data = await response.json();
      setSuccess(`تم إنشاء بطاقة الشحن! رقم التتبع: ${data.tracking_number}`);

      // Download label if available
      if (data.label_url) {
        window.open(data.label_url, '_blank');
      }

      onDeliveryAssigned?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLabelGenerating(false);
    }
  };

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);
  const assignedCompanyData = companies.find(c => c.id === order.delivery_company_id);
  const canGenerateLabel = !!selectedCompanyData?.features?.supports_labels;
  const isNoest = String(selectedCompanyData?.name || '').trim().toLowerCase() === 'noest';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            إدارة التوصيل
          </CardTitle>
          <CardDescription>
            عين شركة توصيل و أنشئ بطاقات الشحن
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Delivery Status */}
          {order.delivery_company_id && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="font-medium">تم تعيين شركة التوصيل</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">الشركة</p>
                  <div className="flex items-center gap-2">
                    <DeliveryCompanyLogo
                      name={assignedCompanyData?.name}
                      className="w-7 h-7 rounded bg-white object-contain p-1 border"
                    />
                    <p className="font-medium">{assignedCompanyData?.name}</p>
                  </div>
                </div>
                {order.tracking_number && (
                  <div>
                    <p className="text-muted-foreground">رقم التتبع</p>
                    <p className="font-medium">{order.tracking_number}</p>
                  </div>
                )}
                {order.delivery_status && (
                  <div>
                    <p className="text-muted-foreground">الحالة</p>
                    <p className="font-medium capitalize">{order.delivery_status}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowDialog(true)}
              variant="default"
              className="flex-1"
              disabled={isLoading}
            >
              {order.delivery_company_id ? 'تغيير التوصيل' : 'تعيين توصيل'}
            </Button>

            {order.delivery_company_id && (
              <Button
                onClick={handleGenerateLabel}
                variant="outline"
                disabled={labelGenerating || !selectedCompanyData || !canGenerateLabel}
                className="flex-1"
              >
                {labelGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    إنشاء البطاقة
                  </>
                )}
              </Button>
            )}
          </div>

          {order.delivery_company_id && selectedCompanyData && !canGenerateLabel && (
            <div className="text-xs text-muted-foreground">
              {isNoest
                ? 'بطاقات Noest متاحة داخل لوحة تحكم حساب Noest الخاص بك.'
                : 'هذه الشركة توفر البطاقات في لوحة التحكم الخاصة بها.'}
            </div>
          )}

          {order.shipping_label_url && (
            <Button
              onClick={() => window.open(order.shipping_label_url, '_blank')}
              variant="outline"
              className="w-full"
            >
              <Printer className="w-4 h-4 mr-2" />
              تحميل البطاقة
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delivery Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اختيار شركة التوصيل</DialogTitle>
            <DialogDescription>
              اختر شركة توصيل لمعالجة هذا الطلب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Company Selection Grid */}
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
              {companies.map(company => (
                <label
                  key={company.id}
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedCompany === company.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    value={company.id}
                    checked={selectedCompany === company.id}
                    onChange={(e) => setSelectedCompany(parseInt(e.target.value))}
                    className="w-4 h-4"
                  />
                  <DeliveryCompanyLogo
                    name={company.name}
                    className="w-9 h-9 rounded bg-white object-contain p-1 border"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{company.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                      {company.features.supports_cod && <span>✓ الدفع عند الاستلام</span>}
                      {company.features.supports_tracking && <span>✓ التتبع</span>}
                      {company.features.supports_labels && <span>✓ البطاقات</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* COD Amount Input */}
            {selectedCompanyData?.features.supports_cod && (
              <div className="space-y-2">
                <Label htmlFor="cod-amount">مبلغ الدفع عند الاستلام (دج)</Label>
                <Input
                  id="cod-amount"
                  type="number"
                  value={codAmount}
                  onChange={(e) => setCodAmount(parseFloat(e.target.value))}
                  placeholder="أدخل مبلغ الدفع عند الاستلام"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleAssignDelivery}
              disabled={!selectedCompany || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري التعيين...
                </>
              ) : (
                'تعيين التوصيل'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
