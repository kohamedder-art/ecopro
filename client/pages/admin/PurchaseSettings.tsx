import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, 
  User, 
  Phone, 
  MapPin, 
  Home, 
  Building2, 
  FileText,
  CreditCard,
  Wallet,
  Banknote,
  Save,
  Eye,
  Palette,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderFieldSettings {
  showProductTitle: boolean;
  showFullName: boolean;
  showPhone: boolean;
  showWilaya: boolean;
  showAddress: boolean;
  showCommune: boolean;
  showNotes: boolean;
  showQuantity: boolean;
}

interface PaymentMethodSettings {
  cashOnDelivery: boolean;
  creditCard: boolean;
  paypal: boolean;
}

interface DesignSettings {
  formBgColor: string;
  formTextColor: string;
  buttonColor: string;
  buttonText: string;
  accentColor: string;
}

export default function PurchaseSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { storeSettings, isLoading } = useStoreSettings();

  // Mutation for updating settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
    },
  });

  const [fields, setFields] = useState<OrderFieldSettings>({
    showProductTitle: true,
    showFullName: true,
    showPhone: true,
    showWilaya: true,
    showAddress: false,
    showCommune: false,
    showNotes: false,
    showQuantity: true,
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSettings>({
    cashOnDelivery: true,
    creditCard: false,
    paypal: false,
  });

  const [design, setDesign] = useState<DesignSettings>({
    formBgColor: "#ffffff",
    formTextColor: "#1e293b",
    buttonColor: "#3b82f6",
    buttonText: "إتمام الشراء",
    accentColor: "#3b82f6",
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load settings from store settings on mount
  useEffect(() => {
    if (storeSettings) {
      setFields({
        showProductTitle: storeSettings.show_product_title !== false,
        showFullName: storeSettings.show_full_name !== false,
        showPhone: storeSettings.show_phone !== false,
        showWilaya: storeSettings.show_wilaya !== false,
        showAddress: storeSettings.show_address === true,
        showCommune: storeSettings.show_commune === true,
        showNotes: storeSettings.show_notes === true,
        showQuantity: storeSettings.show_quantity !== false,
      });

      setPaymentMethods({
        cashOnDelivery: storeSettings.payment_cash_on_delivery !== false,
        creditCard: storeSettings.payment_credit_card === true,
        paypal: storeSettings.payment_paypal === true,
      });

      setDesign({
        formBgColor: storeSettings.checkout_form_bg_color || "#ffffff",
        formTextColor: storeSettings.checkout_form_text_color || "#1e293b",
        buttonColor: storeSettings.checkout_button_color || "#3b82f6",
        buttonText: storeSettings.checkout_button_text || "إتمام الشراء",
        accentColor: storeSettings.checkout_accent_color || "#3b82f6",
      });
    }
  }, [storeSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettingsMutation.mutateAsync({
        show_product_title: fields.showProductTitle,
        show_full_name: fields.showFullName,
        show_phone: fields.showPhone,
        show_wilaya: fields.showWilaya,
        show_address: fields.showAddress,
        show_commune: fields.showCommune,
        show_notes: fields.showNotes,
        show_quantity: fields.showQuantity,
        payment_cash_on_delivery: paymentMethods.cashOnDelivery,
        payment_credit_card: paymentMethods.creditCard,
        payment_paypal: paymentMethods.paypal,
        checkout_form_bg_color: design.formBgColor,
        checkout_form_text_color: design.formTextColor,
        checkout_button_color: design.buttonColor,
        checkout_button_text: design.buttonText,
        checkout_accent_color: design.accentColor,
      });

      toast({
        title: t("store.toast.savedTitle"),
        description: t("purchaseSettings.saveSuccess"),
      });
    } catch (error) {
      toast({
        title: t("store.toast.saveFailedTitle"),
        description: t("purchaseSettings.saveError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Preview product data
  const previewProduct = {
    title: "ساعة ذكية ألترا",
    price: 130,
    originalPrice: 199,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
    rating: 4.8,
    reviews: 124,
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t("purchaseSettings.title")}</h1>
          <p className="text-gray-500 mt-1">{t("purchaseSettings.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Settings */}
          <div className="space-y-6">
            {/* Field Customization */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  {t("purchaseSettings.fieldCustomization")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldToggle
                    icon={<ShoppingCart className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.productTitle")}
                    checked={fields.showProductTitle}
                    onChange={(v) => setFields({ ...fields, showProductTitle: v })}
                  />
                  <FieldToggle
                    icon={<User className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.fullName")}
                    checked={fields.showFullName}
                    onChange={(v) => setFields({ ...fields, showFullName: v })}
                  />
                  <FieldToggle
                    icon={<Phone className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.phone")}
                    checked={fields.showPhone}
                    onChange={(v) => setFields({ ...fields, showPhone: v })}
                  />
                  <FieldToggle
                    icon={<MapPin className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.wilaya")}
                    checked={fields.showWilaya}
                    onChange={(v) => setFields({ ...fields, showWilaya: v })}
                  />
                  <FieldToggle
                    icon={<Home className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.address")}
                    checked={fields.showAddress}
                    onChange={(v) => setFields({ ...fields, showAddress: v })}
                  />
                  <FieldToggle
                    icon={<Building2 className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.commune")}
                    checked={fields.showCommune}
                    onChange={(v) => setFields({ ...fields, showCommune: v })}
                  />
                  <FieldToggle
                    icon={<FileText className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.notes")}
                    checked={fields.showNotes}
                    onChange={(v) => setFields({ ...fields, showNotes: v })}
                  />
                  <FieldToggle
                    icon={<ShoppingCart className="w-4 h-4" />}
                    label={t("purchaseSettings.fields.quantity")}
                    checked={fields.showQuantity}
                    onChange={(v) => setFields({ ...fields, showQuantity: v })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Design Customization */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-500" />
                  {t("purchaseSettings.designCustomization")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ColorInput
                    label={t("purchaseSettings.colors.formBg")}
                    value={design.formBgColor}
                    onChange={(v) => setDesign({ ...design, formBgColor: v })}
                  />
                  <ColorInput
                    label={t("purchaseSettings.colors.formText")}
                    value={design.formTextColor}
                    onChange={(v) => setDesign({ ...design, formTextColor: v })}
                  />
                  <ColorInput
                    label={t("purchaseSettings.colors.button")}
                    value={design.buttonColor}
                    onChange={(v) => setDesign({ ...design, buttonColor: v })}
                  />
                  <ColorInput
                    label={t("purchaseSettings.colors.accent")}
                    value={design.accentColor}
                    onChange={(v) => setDesign({ ...design, accentColor: v })}
                  />
                </div>
                <div className="pt-2">
                  <Label>{t("purchaseSettings.buttonText")}</Label>
                  <Input
                    value={design.buttonText}
                    onChange={(e) => setDesign({ ...design, buttonText: e.target.value })}
                    className="mt-1"
                    placeholder="إتمام الشراء"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  {t("purchaseSettings.paymentMethods")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PaymentMethodToggle
                  icon={<Banknote className="w-5 h-5 text-green-600" />}
                  label={t("purchaseSettings.payment.cashOnDelivery")}
                  description={t("purchaseSettings.payment.cashOnDeliveryDesc")}
                  checked={paymentMethods.cashOnDelivery}
                  onChange={(v) => setPaymentMethods({ ...paymentMethods, cashOnDelivery: v })}
                />
                <Separator />
                <PaymentMethodToggle
                  icon={<CreditCard className="w-5 h-5 text-blue-600" />}
                  label={t("purchaseSettings.payment.creditCard")}
                  description={t("purchaseSettings.payment.creditCardDesc")}
                  checked={paymentMethods.creditCard}
                  onChange={(v) => setPaymentMethods({ ...paymentMethods, creditCard: v })}
                />
                <Separator />
                <PaymentMethodToggle
                  icon={<Wallet className="w-5 h-5 text-indigo-600" />}
                  label={t("purchaseSettings.payment.paypal")}
                  description={t("purchaseSettings.payment.paypalDesc")}
                  checked={paymentMethods.paypal}
                  onChange={(v) => setPaymentMethods({ ...paymentMethods, paypal: v })}
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: design.buttonColor }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  {t("common.saving")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  {t("editor.save")}
                </span>
              )}
            </Button>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:sticky lg:top-6 h-fit">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gray-100 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-gray-500" />
                  {t("purchaseSettings.preview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div 
                  className="p-6 space-y-4"
                  style={{ 
                    backgroundColor: design.formBgColor,
                    color: design.formTextColor 
                  }}
                >
                  {/* Product Info */}
                  {fields.showProductTitle && (
                    <div className="flex gap-4 pb-4 border-b border-gray-200">
                      <img 
                        src={previewProduct.image} 
                        alt={previewProduct.title}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{previewProduct.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm">{previewProduct.rating}</span>
                          <span className="text-sm opacity-60">({previewProduct.reviews} تقييم)</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold" style={{ color: design.accentColor }}>
                            {previewProduct.price} د.ج
                          </span>
                          <span className="text-sm line-through opacity-50">
                            {previewProduct.originalPrice} د.ج
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Form Title */}
                  <h4 className="font-bold text-center pb-2 border-b border-gray-200">
                    إستمارة الطلب
                  </h4>

                  {/* Form Fields */}
                  <div className="space-y-3">
                    {fields.showFullName && (
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                          type="text"
                          placeholder="الاسم الكامل"
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          readOnly
                        />
                      </div>
                    )}

                    {fields.showPhone && (
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                          type="tel"
                          placeholder="رقم الهاتف"
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          readOnly
                        />
                      </div>
                    )}

                    {fields.showWilaya && (
                      <div className="relative">
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <select
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none appearance-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          disabled
                        >
                          <option>اختر الولاية</option>
                        </select>
                      </div>
                    )}

                    {fields.showAddress && (
                      <div className="relative">
                        <Home className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                          type="text"
                          placeholder="العنوان"
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          readOnly
                        />
                      </div>
                    )}

                    {fields.showCommune && (
                      <div className="relative">
                        <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                          type="text"
                          placeholder="البلدية"
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          readOnly
                        />
                      </div>
                    )}

                    {fields.showNotes && (
                      <div className="relative">
                        <FileText className="absolute right-3 top-3 w-4 h-4 opacity-50" />
                        <textarea
                          placeholder="ملاحظات"
                          rows={2}
                          className="w-full pr-10 pl-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
                          style={{ 
                            borderColor: design.accentColor + "30",
                            backgroundColor: design.formBgColor,
                            color: design.formTextColor
                          }}
                          readOnly
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Methods Preview */}
                  {(paymentMethods.cashOnDelivery || paymentMethods.creditCard || paymentMethods.paypal) && (
                    <div className="pt-2 space-y-2">
                      <Label className="text-sm font-medium">طريقة الدفع</Label>
                      <div className="space-y-2">
                        {paymentMethods.cashOnDelivery && (
                          <div 
                            className="flex items-center gap-3 p-3 rounded-lg border-2"
                            style={{ borderColor: design.accentColor }}
                          >
                            <Banknote className="w-5 h-5" style={{ color: design.accentColor }} />
                            <span className="text-sm font-medium">الدفع عند الاستلام</span>
                            <Check className="w-4 h-4 mr-auto" style={{ color: design.accentColor }} />
                          </div>
                        )}
                        {paymentMethods.creditCard && (
                          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium">بطاقة ائتمان</span>
                          </div>
                        )}
                        {paymentMethods.paypal && (
                          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                            <Wallet className="w-5 h-5 text-indigo-600" />
                            <span className="text-sm font-medium">PayPal</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div 
                    className="rounded-lg p-3 space-y-2 text-sm"
                    style={{ backgroundColor: design.accentColor + "10" }}
                  >
                    <div className="flex justify-between">
                      <span className="opacity-70">سعر المنتج</span>
                      <span>{previewProduct.price} د.ج</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">التوصيل</span>
                      <span>--</span>
                    </div>
                    <div 
                      className="flex justify-between font-bold pt-2 border-t"
                      style={{ borderColor: design.accentColor + "30", color: design.accentColor }}
                    >
                      <span>المجموع</span>
                      <span>{previewProduct.price} د.ج</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    className="w-full py-3 rounded-xl font-bold text-white shadow-lg"
                    style={{ backgroundColor: design.buttonColor }}
                    disabled
                  >
                    {design.buttonText}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function FieldToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{icon}</span>
        <Label className="text-sm font-medium cursor-pointer">{label}</Label>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border-0 p-0 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function PaymentMethodToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-lg bg-gray-50">{icon}</span>
        <div>
          <Label className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
