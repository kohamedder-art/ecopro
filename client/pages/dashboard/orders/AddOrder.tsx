import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Package, User, Phone, MapPin } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function AddOrder() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {t('admin.orders.addOrder.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('admin.orders.addOrder.subtitle')}</p>
      </div>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {t('admin.orders.addOrder.customerInfo')}
          </CardTitle>
          <CardDescription>{t('admin.orders.addOrder.requiredData')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('admin.orders.addOrder.fullName')}</label>
              <Input placeholder="Enter customer name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {t('admin.orders.addOrder.phone')}
              </label>
              <Input placeholder="+213 555 123 456" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('admin.orders.addOrder.province')}</label>
              <select className="w-full px-3 py-2 border rounded-lg">
                <option>{t('admin.orders.addOrder.enterProvince')}</option>
                <option>Algiers</option>
                <option>Oran</option>
                <option>Constantine</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('admin.orders.addOrder.municipality')}</label>
              <Input placeholder={t('admin.orders.addOrder.enterMunicipality')} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {t('admin.orders.addOrder.fullAddress')}
            </label>
            <Input placeholder="Street, neighborhood, landmarks..." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-accent" />
              {t('admin.orders.addOrder.products')}
            </div>
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent">
              <Plus className="w-4 h-4 ml-2" />
              {t('admin.orders.addOrder.addProduct')}
            </Button>
          </CardTitle>
          <CardDescription>{t('admin.orders.addOrder.requiredData')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <select className="flex-1 px-3 py-2 border rounded-lg">
                <option>Select product</option>
                <option>Product 1</option>
                <option>Product 2</option>
              </select>
              <Input type="number" placeholder="Quantity" className="w-24" defaultValue="1" />
              <Input type="number" placeholder="Price" className="w-32" />
              <Button variant="ghost" size="sm" className="text-red-500">Delete</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-purple-500/20">
        <CardHeader>
          <CardTitle>{t('admin.orders.addOrder.orderSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">{t('admin.orders.addOrder.subtotal')}</span>
            <span className="font-medium">0 DZD</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">{t('admin.orders.addOrder.deliveryFee')}</span>
            <span className="font-medium">0 DZD</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between py-2">
            <span className="font-bold text-lg">{t('admin.orders.addOrder.grandTotal')}</span>
            <span className="font-bold text-lg text-primary">0 DZD</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button className="flex-1 bg-gradient-to-r from-primary to-accent">
          {t('admin.orders.addOrder.create')}
        </Button>
        <Button variant="outline" className="flex-1">
          {t('platformAdmin.cancel')}
        </Button>
      </div>
    </div>
  );
}
