import { useState, useEffect } from 'react';

export interface ProductOffer {
  id: number;
  quantity: number;
  bundle_price: number;
  compare_price?: number | null;
  free_delivery: boolean;
  label?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

export interface SelectedOffer {
  offer_id: number;
  quantity: number;
  bundle_price: number;
  free_delivery: boolean;
}

/** Fetch active offers for a product from the public API */
export function useProductOffers(storeSlug: string, productId: number | string | undefined) {
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeSlug || !productId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/storefront/${encodeURIComponent(storeSlug)}/products/${productId}/offers`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.offers)) {
          setOffers(data.offers.map((o: any) => ({
            id: Number(o.id),
            quantity: Number(o.quantity),
            bundle_price: Number(o.bundle_price),
            compare_price: o.compare_price == null ? null : Number(o.compare_price),
            free_delivery: Boolean(o.free_delivery),
            label: o.label || null,
            image_url: o.image_url || null,
          })));
        }
      })
      .catch(() => { if (!cancelled) setOffers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeSlug, productId]);

  return { offers, loading };
}

interface OfferSelectorProps {
  offers: ProductOffer[];
  currency: string;
  /** Currently selected offer object or selected offer id. null = default (1 unit, no offer) */
  selectedOffer?: SelectedOffer | null;
  selectedOfferId?: number | null;
  loading?: boolean;
  /** Legacy prop — no longer used internally but kept for template compatibility */
  unitPrice?: number;
  /** Called when user selects an offer or the default option */
  onSelect: (offer: SelectedOffer | null) => void;
  /** Theme colors */
  accentColor?: string;
  textColor?: string;
  borderColor?: string;
  formatPrice?: (n: number) => string;
  className?: string;
  /** Hide the price display, show only the label (useful when merchants write custom prices in labels) */
  hidePrice?: boolean;
}

/**
 * Renders the offer radio-button selector shown on storefront templates.
 * Each offer shows: "X منتج + optional free delivery" with bundle price and optional compare/strikethrough.
 * If there are no offers, renders nothing.
 */
export default function OfferSelector({
  offers,
  currency,
  selectedOffer,
  selectedOfferId,
  loading = false,
  onSelect,
  accentColor = '#f97316',
  textColor = '#1f2937',
  borderColor = '#374151',
  formatPrice,
  className = '',
  hidePrice = false,
}: OfferSelectorProps) {
  if (!offers.length) return null;

  const activeOfferId = selectedOffer?.offer_id ?? selectedOfferId ?? null;
  const isSelected = (offer: ProductOffer) => activeOfferId === offer.id;

  return (
    <div className={`space-y-2 ${className}`}>
      {offers.map((offer) => {
        const active = isSelected(offer);
        const displayLabel = offer.label
          || `${offer.quantity} منتج 💚${offer.free_delivery ? ' + توصيل مجاني ✅' : ''}`;

        return (
          <label
            key={offer.id}
            className="flex items-center justify-between w-full p-3 rounded-lg cursor-pointer transition-all"
            style={{
              border: `2px solid ${active ? accentColor : borderColor}`,
              backgroundColor: active ? accentColor + '10' : '#fff',
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="product-offer"
                checked={active}
                onClick={() => active ? onSelect(null) : onSelect({
                  offer_id: offer.id,
                  quantity: offer.quantity,
                  bundle_price: offer.bundle_price,
                  free_delivery: offer.free_delivery,
                })}
                className="w-4 h-4 accent-orange-500 cursor-pointer"
              />
              {offer.image_url && (
                <img
                  src={offer.image_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <span className="font-bold text-sm" style={{ color: textColor }}>
                {displayLabel}
              </span>
            </div>
            <div className="text-left">
              {!hidePrice && (
                <>
                  {offer.compare_price != null && offer.compare_price > offer.bundle_price && (
                    <span className="line-through text-[10px] block" style={{ color: '#ef4444' }}>
                      {Math.round(offer.compare_price).toLocaleString()} {currency}
                    </span>
                  )}
                  <span className="font-bold text-sm" style={{ color: textColor }}>
                    {Math.round(offer.bundle_price).toLocaleString()} {currency}
                  </span>
                </>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
