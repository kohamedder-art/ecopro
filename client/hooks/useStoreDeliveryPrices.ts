import { useState, useEffect, useMemo } from 'react';
import { getAlgeriaWilayas } from '@/lib/algeriaGeo';

interface DeliveryPriceEntry {
  wilaya_id: number;
  home_delivery_price: number;
  desk_delivery_price: number | null;
  estimated_days: number;
  is_active: boolean;
}

export interface WilayaOption {
  id: number;
  labelAR: string;
  labelFR: string;
  homePrice: number;
  deskPrice: number | null;
  days: number;
}

const ALL_WILAYAS = getAlgeriaWilayas();

export function useStoreDeliveryPrices(storeSlug: string) {
  const [prices, setPrices] = useState<DeliveryPriceEntry[]>([]);
  const [defaultPrice, setDefaultPrice] = useState<number>(500);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeSlug) { setLoading(false); setLoaded(true); return; }
    setLoading(true);
    setLoaded(false);
    fetch(`/api/storefront/${encodeURIComponent(storeSlug)}/delivery-prices`)
      .then(res => res.ok ? res.json() : { prices: [] })
      .then(data => {
        console.log('[DeliveryPrices] API response:', data);
        setPrices(data.prices || []);
        if (data.default_price != null) setDefaultPrice(Number(data.default_price) || 500);
        setLoaded(true);
      })
      .catch((err) => { console.error('[DeliveryPrices] Fetch error:', err); setPrices([]); setLoaded(true); })
      .finally(() => setLoading(false));
  }, [storeSlug]);

  const wilayas: WilayaOption[] = useMemo(() => {
    if (!loaded) {
      return [];
    }
    if (prices.length === 0) {
      // No delivery prices configured — show all wilayas with the default fallback price
      return ALL_WILAYAS.map(w => ({
        id: w.code,
        labelAR: `${String(w.code).padStart(2, '0')} - ${w.arabic_name ?? w.name}`,
        labelFR: `${String(w.code).padStart(2, '0')} - ${w.name}`,
        homePrice: defaultPrice,
        deskPrice: null,
        days: 3,
      }));
    }
    const priceMap = new Map(prices.map(p => [Number(p.wilaya_id), p]));
    const mapped = ALL_WILAYAS
      .filter(w => {
        const p = priceMap.get(w.code) ?? priceMap.get(w.id);
        return p?.is_active;
      })
      .map(w => {
        const p = (priceMap.get(w.code) ?? priceMap.get(w.id))!;
        // Properly parse prices - handle both string and number types from API
        const homePrice = typeof p.home_delivery_price === 'string' ? parseFloat(p.home_delivery_price) : Number(p.home_delivery_price);
        const deskPriceRaw = p.desk_delivery_price;
        const deskPrice = deskPriceRaw != null 
          ? (typeof deskPriceRaw === 'string' ? parseFloat(deskPriceRaw) : Number(deskPriceRaw))
          : null;
        return {
          id: w.code,
          labelAR: `${String(w.code).padStart(2, '0')} - ${w.arabic_name ?? w.name}`,
          labelFR: `${String(w.code).padStart(2, '0')} - ${w.name}`,
          homePrice: isNaN(homePrice) ? 0 : homePrice,
          deskPrice: deskPrice != null && !isNaN(deskPrice) && deskPrice > 0 ? deskPrice : null,
          days: p.estimated_days,
        };
      });
    console.log('[DeliveryPrices] Mapped wilayas:', mapped.slice(0, 3));
    return mapped;
  }, [prices, loaded, defaultPrice]);

  return { wilayas, loading, defaultPrice };
}

/**
 * Resolves the final delivery fee shown to the customer, respecting:
 * 1. Product-level shipping mode (free / flat / delivery_pricing)
 * 2. Offer-level free_delivery override (only when mode = delivery_pricing)
 * 3. The wilaya-based base fee
 */
export function resolveDeliveryFee(
  product: any,
  selectedOffer: { free_delivery?: boolean } | null | undefined,
  baseDeliveryFee: number
): number {
  const shippingMeta = product?.metadata?.shipping;
  const mode: string = shippingMeta?.mode || 'delivery_pricing';
  if (mode === 'free') return 0;
  if (mode === 'flat') return Number(shippingMeta?.flat_fee) || 0;
  // delivery_pricing mode: offer free_delivery overrides wilaya price
  return selectedOffer?.free_delivery ? 0 : baseDeliveryFee;
}
