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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeSlug) { setLoading(false); return; }
    fetch(`/api/storefront/${encodeURIComponent(storeSlug)}/delivery-prices`)
      .then(res => res.ok ? res.json() : { prices: [] })
      .then(data => setPrices(data.prices || []))
      .catch(() => setPrices([]))
      .finally(() => setLoading(false));
  }, [storeSlug]);

  const wilayas: WilayaOption[] = useMemo(() => {
    if (prices.length === 0) {
      // No delivery prices configured — show all wilayas with 0 fee
      return ALL_WILAYAS.map(w => ({
        id: w.code,
        labelAR: `${String(w.code).padStart(2, '0')} - ${w.arabic_name ?? w.name}`,
        labelFR: `${String(w.code).padStart(2, '0')} - ${w.name}`,
        homePrice: 0,
        deskPrice: null,
        days: 3,
      }));
    }
    const priceMap = new Map(prices.map(p => [p.wilaya_id, p]));
    return ALL_WILAYAS
      .filter(w => priceMap.get(w.code)?.is_active)
      .map(w => {
        const p = priceMap.get(w.code)!;
        return {
          id: w.code,
          labelAR: `${String(w.code).padStart(2, '0')} - ${w.arabic_name ?? w.name}`,
          labelFR: `${String(w.code).padStart(2, '0')} - ${w.name}`,
          homePrice: Number(p.home_delivery_price) || 0,
          deskPrice: p.desk_delivery_price != null ? Number(p.desk_delivery_price) : null,
          days: p.estimated_days,
        };
      });
  }, [prices]);

  return { wilayas, loading };
}
