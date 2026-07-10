import React, { useMemo } from 'react';
import type { ProductVariant } from '@/pages/storefront/templates/types';

export interface SelectedVariant {
  id: number;
  color: string | null;
  size: string | null;
  size2: string | null;
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
  /** Show visual color thumbnails like Temu instead of color circles */
  visualMode?: boolean;
  /** Labels for size selectors */
  sizeLabel?: string;
  size2Label?: string;
}

/** Map common color names (Arabic + English + French) to hex  */
const COLOR_MAP: Record<string, string> = {
  // English
  red: '#EF4444', blue: '#3B82F6', green: '#22C55E', yellow: '#EAB308',
  orange: '#F97316', purple: '#A855F7', pink: '#EC4899', black: '#111827',
  white: '#F9FAFB', gray: '#6B7280', grey: '#6B7280', brown: '#92400E',
  beige: '#D4C5A9', navy: '#1E3A5F', gold: '#D4AF37', silver: '#C0C0C0',
  maroon: '#800000', olive: '#808000', teal: '#14B8A6', cyan: '#06B6D4',
  // Arabic (with hamza)
  'أحمر': '#EF4444', 'أزرق': '#3B82F6', 'أخضر': '#22C55E', 'أصفر': '#EAB308',
  'برتقالي': '#F97316', 'بنفسجي': '#A855F7', 'وردي': '#EC4899', 'أسود': '#111827',
  'أبيض': '#F9FAFB', 'رمادي': '#6B7280', 'بني': '#92400E', 'ذهبي': '#D4AF37',
  'فضي': '#C0C0C0', 'كحلي': '#1E3A5F', 'بيج': '#D4C5A9', 'زيتي': '#808000',
  // Arabic (without hamza — common informal spelling)
  'احمر': '#EF4444', 'ازرق': '#3B82F6', 'اخضر': '#22C55E', 'اصفر': '#EAB308',
  'اسود': '#111827', 'ابيض': '#F9FAFB',
  // French
  rouge: '#EF4444', bleu: '#3B82F6', vert: '#22C55E', jaune: '#EAB308',
  noir: '#111827', blanc: '#F9FAFB', gris: '#6B7280', rose: '#EC4899',
  violet: '#A855F7', marron: '#92400E', doré: '#D4AF37',
};

/** Normalize Arabic alef variants (أ إ آ ا → ا) for color matching */
function normalizeArabic(s: string): string {
  return s.replace(/[أإآٱ]/g, 'ا').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي');
}

function resolveColor(color: string | null): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  // Already a hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  // Check map (case-insensitive, then try normalized Arabic)
  const lower = trimmed.toLowerCase();
  return COLOR_MAP[lower] || COLOR_MAP[normalizeArabic(lower)] || null;
}

/** Split comma-separated multi-color string into individual color names */
function splitColorNames(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

/** Build a conic-gradient for multi-color swatches */
function multiColorGradient(colorName: string): string | undefined {
  const parts = splitColorNames(colorName);
  if (parts.length < 2) return undefined;
  const pct = 100 / parts.length;
  return `conic-gradient(${parts.map((n, i) => {
    const hex = resolveColor(n);
    return `${hex || '#ccc'} ${i * pct}% ${(i + 1) * pct}%`;
  }).join(', ')})`;
}

export default function VariantSelector({
  variants,
  selected,
  onSelect,
  accentColor = '#D4AF37',
  currency = 'د.ج',
  basePrice,
  dir = 'rtl',
  visualMode = true, // Default to Temu-style visual selector
}: VariantSelectorProps) {
  if (!variants || variants.length === 0) return null;

  // Determine available color, size and size2 groups
  const { colors, sizes, sizes2, hasColors, hasSizes, hasSizes2 } = useMemo(() => {
    const colorSet = new Map<string, { hex: string | null; name: string }>();
    const sizeSet = new Set<string>();
    const size2Set = new Set<string>();
    for (const v of variants) {
      if (v.color) {
        const hex = resolveColor(v.color);
        colorSet.set(v.color, { hex, name: v.color });
      }
      if (v.size) sizeSet.add(v.size);
      if (v.size2) size2Set.add(v.size2);
    }
    return {
      colors: Array.from(colorSet.values()),
      sizes: Array.from(sizeSet),
      sizes2: Array.from(size2Set),
      hasColors: colorSet.size > 0,
      hasSizes: sizeSet.size > 0,
      hasSizes2: size2Set.size > 0,
    };
  }, [variants]);

  // Current selections (trimmed for robust matching)
  const selectedColor = selected?.color?.trim() || null;
  const selectedSize = selected?.size?.trim() || null;
  const selectedSize2 = selected?.size2?.trim() || null;

  // Find matching variant for a color+size+size2 combo
  const findVariant = (color: string | null, size: string | null, size2: string | null): ProductVariant | undefined => {
    const exact = variants.find(v => {
      const colorMatch = !hasColors || v.color === color;
      const sizeMatch = !hasSizes || v.size === size;
      const size2Match = !hasSizes2 || v.size2 === size2;
      return colorMatch && sizeMatch && size2Match;
    });
    if (exact) return exact;
    // Fallbacks
    if (size && size2) return variants.find(v => v.size === size && v.size2 === size2);
    if (size) return variants.find(v => v.size === size);
    if (size2) return variants.find(v => v.size2 === size2);
    if (color) return variants.find(v => v.color === color);
    return undefined;
  };

  // Which sizes are still in stock for the selected color+size2?
  const availableSizes = useMemo(() => {
    const filtered = variants.filter(v => {
      if (hasColors && selectedColor && v.color !== selectedColor) return false;
      if (hasSizes2 && selectedSize2 && v.size2 !== selectedSize2) return false;
      return true;
    });
    return new Set(
      filtered.filter(v => v.stock_quantity == null || v.stock_quantity > 0).map(v => v.size).filter(Boolean) as string[]
    );
  }, [variants, selectedColor, selectedSize2, hasColors, hasSizes2]);

  // Which sizes2 are still in stock for the selected color+size?
  const availableSizes2 = useMemo(() => {
    const filtered = variants.filter(v => {
      if (hasColors && selectedColor && v.color !== selectedColor) return false;
      if (hasSizes && selectedSize && v.size !== selectedSize) return false;
      return true;
    });
    return new Set(
      filtered.filter(v => v.stock_quantity == null || v.stock_quantity > 0).map(v => v.size2).filter(Boolean) as string[]
    );
  }, [variants, selectedColor, selectedSize, hasColors, hasSizes]);

  // Check if a specific variant is out of stock
  const isVariantOutOfStock = (variant: ProductVariant | undefined): boolean => {
    return variant?.stock_quantity != null && variant.stock_quantity <= 0;
  };

  // Check if a color is completely out of stock
  const isColorOutOfStock = (colorName: string): boolean => {
    const colorVariants = variants.filter(v => v.color === colorName);
    if (colorVariants.length === 0) return false;
    return colorVariants.every(v => v.stock_quantity != null && v.stock_quantity <= 0);
  };

  const handleColorClick = (colorName: string) => {
    if (selectedColor === colorName) {
      onSelect(null);
      return;
    }
    // Auto-select: prefer variant with all dimensions
    const withAll = variants.find(v => v.color === colorName && v.size && v.size2);
    const withSize = variants.find(v => v.color === colorName && v.size);
    const withSize2 = variants.find(v => v.color === colorName && v.size2);
    const firstMatch = withAll || withSize || withSize2 || variants.find(v => v.color === colorName);
    if (firstMatch) {
      onSelect({
        id: firstMatch.id,
        color: firstMatch.color,
        size: firstMatch.size,
        size2: firstMatch.size2,
        variant_name: firstMatch.variant_name,
        price: firstMatch.price,
        images: firstMatch.images,
      });
    }
  };

  const handleSizeClick = (size: string) => {
    if (selectedSize === size && !hasColors && !hasSizes2) {
      onSelect(null);
      return;
    }
    const match = findVariant(selectedColor, size, selectedSize2);
    if (match && !isVariantOutOfStock(match)) {
      onSelect({
        id: match.id,
        color: match.color,
        size: match.size,
        size2: match.size2,
        variant_name: match.variant_name,
        price: match.price,
        images: match.images,
      });
    } else if ((hasColors || hasSizes2) && !selectedColor && !selectedSize2) {
      const fallback = variants.find(v => v.size === size && (v.stock_quantity == null || v.stock_quantity > 0));
      if (fallback) {
        onSelect({
          id: fallback.id,
          color: fallback.color,
          size: fallback.size,
          size2: fallback.size2,
          variant_name: fallback.variant_name,
          price: fallback.price,
          images: fallback.images,
        });
      }
    }
  };

  const handleSize2Click = (size2: string) => {
    if (selectedSize2 === size2 && !hasColors && !hasSizes) {
      onSelect(null);
      return;
    }
    const match = findVariant(selectedColor, selectedSize, size2);
    if (match && !isVariantOutOfStock(match)) {
      onSelect({
        id: match.id,
        color: match.color,
        size: match.size,
        size2: match.size2,
        variant_name: match.variant_name,
        price: match.price,
        images: match.images,
      });
    } else if ((hasColors || hasSizes) && !selectedColor && !selectedSize) {
      const fallback = variants.find(v => v.size2 === size2 && (v.stock_quantity == null || v.stock_quantity > 0));
      if (fallback) {
        onSelect({
          id: fallback.id,
          color: fallback.color,
          size: fallback.size,
          size2: fallback.size2,
          variant_name: fallback.variant_name,
          price: fallback.price,
          images: fallback.images,
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3" dir={dir}>
      {/* Color selector - Visual style like Temu (shows variant images) */}
      {hasColors && visualMode && (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold opacity-70">
            اللون{selectedColor ? `: ${selectedColor}` : ''}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {colors.map(c => {
              const isActive = !!(selectedColor && c.name && selectedColor.trim().toLowerCase() === c.name.trim().toLowerCase());
              const colorVariant = variants.find(v => v.color === c.name);
              const variantImage = colorVariant?.images?.[0];
              const outOfStock = isColorOutOfStock(c.name);
              
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick(c.name); }}
                  className="relative flex flex-col items-center gap-1.5 transition-all duration-200"
                >
                  <div 
                    className="relative w-16 h-20 rounded-xl overflow-hidden transition-all duration-200"
                    style={{
                      border: `2px solid ${isActive ? accentColor : '#f3f4f6'}`,
                      boxShadow: isActive ? `0 4px 12px ${accentColor}25` : '0 1px 3px rgba(0,0,0,0.08)',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {variantImage ? (
                      <img 
                        src={variantImage} 
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          background: c.name.includes(',') && !c.hex
                            ? multiColorGradient(c.name)
                            : undefined,
                          backgroundColor: c.name.includes(',') && !c.hex ? undefined : (c.hex || '#ccc'),
                        }}
                      >
                        {!c.name.includes(',') && (
                          <span className="text-[10px] font-bold text-white drop-shadow-sm">
                            {c.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {outOfStock && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <span className="text-[9px] font-black text-red-600 bg-white/80 px-1.5 py-0.5 rounded-full">نفد</span>
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                  
                  <span 
                    className="text-[11px] font-medium truncate max-w-[64px] text-center"
                    style={{ 
                      color: isActive ? accentColor : '#6b7280',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color selector - Classic color circles (fallback) */}
      {hasColors && !visualMode && (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold opacity-70">
            اللون{selectedColor ? `: ${selectedColor}` : ''}
          </span>
          <div className="flex flex-wrap gap-2.5 items-center">
            {colors.map(c => {
              const isActive = !!(selectedColor && c.name && selectedColor.trim().toLowerCase() === c.name.trim().toLowerCase());
              const hex = c.hex;
              const outOfStock = isColorOutOfStock(c.name);
              return (
                <div key={c.name} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    title={c.name}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick(c.name); }}
                    className="relative rounded-full transition-all duration-200"
                    style={{
                      width: isActive ? 36 : 30,
                      height: isActive ? 36 : 30,
                      backgroundColor: hex || (c.name.includes(',') ? undefined : '#ccc'),
                      backgroundImage: !hex
                        ? c.name.includes(',')
                          ? multiColorGradient(c.name)
                          : `linear-gradient(135deg, #f87171 25%, #facc15 25%, #facc15 50%, #34d399 50%, #34d399 75%, #60a5fa 75%)`
                        : undefined,
                      border: isActive ? `2.5px solid ${accentColor}` : '2px solid rgba(0,0,0,0.1)',
                      opacity: outOfStock ? 0.3 : (selectedColor && !isActive ? 0.4 : 1),
                      transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      cursor: outOfStock ? 'not-allowed' : 'pointer',
                      boxShadow: isActive ? `0 2px 8px ${accentColor}30` : '0 1px 2px rgba(0,0,0,0.08)',
                    }}
                  >
                    {!hex && !c.name.includes(',') && (
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white drop-shadow-sm">
                        {c.name.slice(0, 2)}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                  {outOfStock && <span className="text-[8px] text-red-500 font-bold">نفد</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {hasSizes && (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold opacity-70">
            المقاس{selectedSize ? `: ${selectedSize}` : ''}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {sizes.map(size => {
              const isAvailable = availableSizes.has(size);
              const isActive = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!isAvailable}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSizeClick(size); }}
                  className="min-w-[52px] h-12 px-5 rounded-2xl text-sm font-bold transition-all duration-200 border-2"
                  style={{
                    backgroundColor: isActive ? accentColor : '#fff',
                    borderColor: isActive ? accentColor : '#e5e7eb',
                    color: isActive ? '#fff' : '#374151',
                    opacity: isAvailable ? 1 : 0.35,
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    boxShadow: isActive ? `0 4px 14px ${accentColor}30` : '0 1px 3px rgba(0,0,0,0.06)',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size2 selector (number sizes like 39, 40, 41) */}
      {hasSizes2 && (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold opacity-70">
            {size2Label || 'المقاس الرقمي'}{selectedSize2 ? `: ${selectedSize2}` : ''}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {sizes2.map(size2 => {
              const isAvailable = availableSizes2.has(size2);
              const isActive = selectedSize2 === size2;
              return (
                <button
                  key={size2}
                  type="button"
                  disabled={!isAvailable}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSize2Click(size2); }}
                  className="min-w-[52px] h-12 px-5 rounded-2xl text-sm font-bold transition-all duration-200 border-2"
                  style={{
                    backgroundColor: isActive ? accentColor : '#fff',
                    borderColor: isActive ? accentColor : '#e5e7eb',
                    color: isActive ? '#fff' : '#374151',
                    opacity: isAvailable ? 1 : 0.35,
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    boxShadow: isActive ? `0 4px 14px ${accentColor}30` : '0 1px 3px rgba(0,0,0,0.06)',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {size2}
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
