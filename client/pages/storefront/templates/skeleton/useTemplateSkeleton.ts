import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStoreDeliveryPrices, resolveDeliveryFee } from '@/hooks/useStoreDeliveryPrices';
import { useOrderFields } from '@/hooks/useOrderFields';
import { useProductOffers } from '@/components/storefront/OfferSelector';
import { getAlgeriaCommunesByWilayaId, communeDisplayName } from '@/lib/algeriaGeo';
import { isValidAlgerianPhone } from '@/lib/utils';
import { getFraudData } from '@/lib/fingerprint';
import { trackAllPixels, PixelEvents } from '@/components/storefront/PixelScripts';
import { buildStoreUrl } from '@/lib/resolvedStore';
import type { TemplateProps, StoreProduct } from '@/pages/storefront/templates/types';

export type SelectedVariant = {
  id: number;
  color: string | null;
  size: string | null;
  size2: string | null;
  variant_name: string | null;
  price: number | null;
  stock_quantity: number;
  images: string[] | null;
};

export type SelectedOffer = {
  id: number;
  name: string;
  bundle_price: number;
  original_price: number;
  items: Array<{ product_id: number; title: string; quantity: number }>;
};

export function useTemplateSkeleton(props: TemplateProps) {
  const { storeSlug, products, settings, initialProductSlug, onProductView, navigate } = props;
  const currency = (settings as any)?.currency_code || 'د.ج';

  // ── Product Resolution ──
  const mainProduct = useMemo<StoreProduct | null>(() => {
    if (initialProductSlug) {
      const found = products.find(p => p.slug === initialProductSlug || String(p.id) === initialProductSlug);
      if (found) return found;
    }
    if ((settings as any)?.dzp_main_product_id) {
      const found = products.find(p => String(p.id) === String((settings as any).dzp_main_product_id));
      if (found) return found;
    }
    return products[0] || null;
  }, [products, initialProductSlug, settings]);

  // ── Delivery ──
  const { wilayas, loading: deliveryLoading } = useStoreDeliveryPrices(storeSlug);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'home' | 'desk'>('home');
  const { showAddress, showCommune, showNotes, showHomeDelivery, showDeskDelivery } = useOrderFields(settings, selectedDeliveryType);

  const selectedWilaya = useMemo(() => wilayas.find(w => w.id === selectedWilayaId), [wilayas, selectedWilayaId]);
  const communes = useMemo(() => getAlgeriaCommunesByWilayaId(selectedWilayaId), [selectedWilayaId]);
  const baseDeliveryFee = selectedWilaya
    ? (selectedDeliveryType === 'home' ? selectedWilaya.homePrice : (selectedWilaya.deskPrice ?? selectedWilaya.homePrice))
    : 0;

  // ── Offers ──
  const { offers, loading: offersLoading } = useProductOffers(storeSlug, mainProduct?.id);

  // ── Selection State ──
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const [quantity, setQuantity] = useState(1);

  // ── Order Form ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // ── Order Lifecycle ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | string | null>(null);
  const [lastTelegramUrl, setLastTelegramUrl] = useState<string | null>(null);

  const formFillStart = useRef(Date.now());

  // ── Derived Pricing ──
  const deliveryFee = resolveDeliveryFee(mainProduct, selectedOffer, baseDeliveryFee);
  const variantPrice = selectedVariant?.price && selectedVariant.price > 0 ? selectedVariant.price : null;
  const productPrice = variantPrice ?? (mainProduct?.price ?? 0);
  const productTotal = selectedOffer ? selectedOffer.bundle_price * quantity : productPrice * quantity;
  const totalCost = productTotal + deliveryFee;
  const displayPrice = (n: number) => Math.round(n);

  // ── Reset commune on wilaya change ──
  useEffect(() => { setCommuneId(''); }, [selectedWilayaId]);

  // ── Track product view ──
  useEffect(() => {
    if (mainProduct && onProductView) onProductView(mainProduct);
  }, [mainProduct?.id]);

  // ── Navigation ──
  const goToProduct = useCallback((product: StoreProduct) => {
    navigate?.(buildStoreUrl(storeSlug, product.slug || String(product.id)));
  }, [navigate, storeSlug]);

  const goToStore = useCallback(() => {
    navigate?.(buildStoreUrl(storeSlug));
  }, [navigate, storeSlug]);

  const scrollToForm = useCallback(() => {
    document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Order Submission ──
  const handleOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainProduct || isSubmitting) return;

    if (!customerName.trim()) { setOrderError('الاسم مطلوب'); return; }
    if (!isValidAlgerianPhone(customerPhone)) { setOrderError('رقم الهاتف غير صحيح'); return; }
    if (!selectedWilayaId) { setOrderError('اختر الولاية'); return; }
    if (showCommune && !communeId) { setOrderError('اختر البلدية'); return; }
    if (showAddress && !customerAddress.trim()) { setOrderError('العنوان مطلوب'); return; }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const wilaya = wilayas.find(w => w.id === selectedWilayaId);
      const commune = communes.find(c => String(c.id) === communeId);
      const fullAddress = [
        wilaya?.labelAR || '',
        commune ? communeDisplayName(commune) : '',
        customerAddress.trim(),
      ].filter(Boolean).join(' - ');

      const fraudData = getFraudData();
      const payload: Record<string, any> = {
        store_slug: storeSlug,
        product_id: mainProduct.id,
        quantity,
        total_price: productTotal,
        delivery_fee: deliveryFee,
        delivery_type: selectedDeliveryType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: fullAddress,
        customer_notes: customerNotes.trim(),
        shipping_wilaya_id: selectedWilayaId,
        product_name: mainProduct.title,
        ...fraudData,
      };
      if (communeId) payload.shipping_commune_id = Number(communeId);
      if (selectedVariant) payload.variant_id = selectedVariant.id;
      if (selectedOffer) payload.offer_id = selectedOffer.id;

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.fields ? Object.values(data.fields).join(' • ') : (data.error || 'حدث خطأ');
        setOrderError(String(msg));
        return;
      }

      setOrderSuccess(true);
      setLastOrderId(data.orderId || data.id);
      setLastTelegramUrl(data.telegramStartUrl || null);

      try {
        trackAllPixels(PixelEvents.PURCHASE, {
          value: productTotal,
          currency,
          content_ids: [String(mainProduct.id)],
          content_type: 'product',
          num_items: quantity,
        });
      } catch { /* pixel tracking non-critical */ }
    } catch (err: any) {
      setOrderError(err?.message || 'حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mainProduct, isSubmitting, customerName, customerPhone, selectedWilayaId,
    showCommune, communeId, showAddress, customerAddress, wilayas, communes,
    storeSlug, quantity, productTotal, deliveryFee, selectedDeliveryType,
    customerNotes, selectedVariant, selectedOffer, currency,
  ]);

  const handleOfferSelect = useCallback((offer: SelectedOffer | null) => {
    setSelectedOffer(offer);
    if (offer) setSelectedVariant(null);
  }, []);

  return {
    // Product
    mainProduct,
    goToProduct,
    goToStore,

    // Delivery
    wilayas,
    selectedWilayaId,
    setSelectedWilayaId,
    selectedWilaya,
    communes,
    selectedDeliveryType,
    setSelectedDeliveryType,
    showAddress,
    showCommune,
    showNotes,
    showHomeDelivery,
    showDeskDelivery,

    // Pricing
    deliveryFee,
    variantPrice,
    productPrice,
    productTotal,
    totalCost,
    currency,
    displayPrice,

    // Product selection
    selectedVariant,
    setSelectedVariant,
    selectedOffer,
    offers,
    offersLoading,
    handleOfferSelect,

    // Order form
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerAddress,
    setCustomerAddress,
    communeId,
    setCommuneId,
    customerNotes,
    setCustomerNotes,
    quantity,
    setQuantity,

    // Order lifecycle
    isSubmitting,
    orderError,
    setOrderError,
    orderSuccess,
    setOrderSuccess,
    lastOrderId,
    lastTelegramUrl,
    handleOrder,
    scrollToForm,
  };
}
