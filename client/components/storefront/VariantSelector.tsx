import React, { useMemo } from 'react';
import type { ProductVariant } from '@/pages/storefront/templates/types';

export interface SelectedVariant {
  id: number;
  color: string | null;
  size: string | null;
  variant_name: string | null;
  price: number | null;
  images: string[] | null;
}

interface VariantSelectorProps {
  variants: ProductVariant[];
  selected: SelectedVariant | null;
  onSelect: (v: SelectedVariant | null) => void;
  accentColor?: string;
  currency?: string;
  basePrice?: number;
  /** Direction — RTL by default for Arabic storefronts */
  dir?: 'rtl' | 'ltr';
}

/** Map common color names (Arabic + English + French) to hex  */
const COLOR_MAP: Record<string, string> = {
  // English
  red: '#EF4444', blue: '#3B82F6', green: '#22C55E', yellow: '#EAB308',
  orange: '#F97316', purple: '#A855F7', pink: '#EC4899', black: '#111827',
  white: '#F9FAFB', gray: '#6B7280', grey: '#6B7280', brown: '#92400E',
  beige: '#D4C5A9', navy: '#1E3A5F', gold: '#D4AF37', silver: '#C0C0C0',
  maroon: '#800000', olive: '#808000', teal: '#14B8A6', cyan: '#06B6D4',
  // Arabic
  'أحمر': '#EF4444', 'أزرق': '#3B82F6', 'أخضر': '#22C55E', 'أصفر': '#EAB308',
  'برتقالي': '#F97316', 'بنفسجي': '#A855F7', 'وردي': '#EC4899', 'أسود': '#111827',
  'أبيض': '#F9FAFB', 'رمادي': '#6B7280', 'بني': '#92400E', 'ذهبي': '#D4AF37',
  'فضي': '#C0C0C0', 'كحلي': '#1E3A5F', 'بيج': '#D4C5A9', 'زيتي': '#808000',
  // French
  rouge: '#EF4444', bleu: '#3B82F6', vert: '#22C55E', jaune: '#EAB308',
  noir: '#111827', blanc: '#F9FAFB', gris: '#6B7280', rose: '#EC4899',
  violet: '#A855F7', marron: '#92400E', doré: '#D4AF37',
};

function resolveColor(color: string | null): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  // Already a hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  // Check map (case-insensitive)
  return COLOR_MAP[trimmed.toLowerCase()] || null;
}

export default function VariantSelector({
  variants,
  selected,
  onSelect,
  accentColor = '#D4AF37',
  currency = 'د.ج',
  basePrice,
  dir = 'rtl',
}: VariantSelectorProps) {
  if (!variants || variants.length === 0) return null;

  // Determine available color and size groups
  const { colors, sizes, hasColors, hasSizes } = useMemo(() => {
    const colorSet = new Map<string, { hex: string | null; name: string }>();
    const sizeSet = new Set<string>();
    for (const v of variants) {
      if (v.color) {
        const hex = resolveColor(v.color);
        colorSet.set(v.color, { hex, name: v.color });
      }
      if (v.size) sizeSet.add(v.size);
    }
    return {
      colors: Array.from(colorSet.values()),
      sizes: Array.from(sizeSet),
      hasColors: colorSet.size > 0,
      hasSizes: sizeSet.size > 0,
    };
  }, [variants]);

  // Current selections
  const selectedColor = selected?.color || null;
  const selectedSize = selected?.size || null;

  // Find matching variant for a color+size combo
  const findVariant = (color: string | null, size: string | null): ProductVariant | undefined => {
    return variants.find(v => {
      const colorMatch = !hasColors || v.color === color;
      const sizeMatch = !hasSizes || v.size === size;
      return colorMatch && sizeMatch;
    });
  };

  // Which sizes are available for the selected color?
  const availableSizes = useMemo(() => {
    if (!hasColors || !selectedColor) return new Set(sizes);
    return new Set(
      variants.filter(v => v.color === selectedColor).map(v => v.size).filter(Boolean) as string[]
    );
  }, [variants, selectedColor, hasColors, sizes]);

  const handleColorClick = (colorName: string) => {
    if (selectedColor === colorName) {
      onSelect(null);
      return;
    }
    // Auto-select first available size for this color
    const firstMatch = hasSizes
      ? variants.find(v => v.color === colorName && v.size)
      : variants.find(v => v.color === colorName);
    if (firstMatch) {
      onSelect({
        id: firstMatch.id,
        color: firstMatch.color,
        size: firstMatch.size,
        variant_name: firstMatch.variant_name,
        price: firstMatch.price,
        images: firstMatch.images,
      });
    }
  };

  const handleSizeClick = (size: string) => {
    if (selectedSize === size && !hasColors) {
      onSelect(null);
      return;
    }
    const match = findVariant(selectedColor, size);
    if (match) {
      onSelect({
        id: match.id,
        color: match.color,
        size: match.size,
        variant_name: match.variant_name,
        price: match.price,
        images: match.images,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3" dir={dir}>
      {/* Color selector */}
      {hasColors && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold opacity-70">
            اللون{selectedColor ? `: ${selectedColor}` : ''}
          </span>
          <div className="flex flex-wrap gap-2">
            {colors.map(c => {
              const isActive = selectedColor === c.name;
              const hex = c.hex;
              return (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onClick={() => handleColorClick(c.name)}
                  className="relative rounded-full transition-all duration-150"
                  style={{
                    width: 32,
                    height: 32,
                    border: isActive ? `2.5px solid ${accentColor}` : '2px solid rgba(128,128,128,0.3)',
                    boxShadow: isActive ? `0 0 0 2px ${accentColor}40` : 'none',
                    padding: 2,
                  }}
                >
                  <span
                    className="block w-full h-full rounded-full"
                    style={{
                      backgroundColor: hex || '#ccc',
                      backgroundImage: !hex
                        ? `linear-gradient(135deg, #f87171 25%, #facc15 25%, #facc15 50%, #34d399 50%, #34d399 75%, #60a5fa 75%)`
                        : undefined,
                    }}
                  />
                  {!hex && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white drop-shadow-sm">
                      {c.name.slice(0, 2)}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hex && hex.toLowerCase() === '#f9fafb' ? '#111827' : '#ffffff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {hasSizes && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold opacity-70">
            المقاس{selectedSize ? `: ${selectedSize}` : ''}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map(size => {
              const isAvailable = availableSizes.has(size);
              const isActive = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => handleSizeClick(size)}
                  className="min-w-[36px] h-9 px-2.5 rounded-lg text-xs font-bold transition-all border"
                  style={{
                    backgroundColor: isActive ? accentColor : 'transparent',
                    borderColor: isActive ? accentColor : 'rgba(128,128,128,0.3)',
                    color: isActive ? '#fff' : undefined,
                    opacity: isAvailable ? 1 : 0.3,
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price override indicator */}
      {selected?.price != null && basePrice != null && selected.price !== basePrice && (
        <div className="text-xs font-semibold" style={{ color: accentColor }}>
          {Math.round(selected.price).toLocaleString()} {currency}
        </div>
      )}
    </div>
  );
}
