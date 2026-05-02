import React from 'react';
import { X } from 'lucide-react';

interface PromotionalBannerProps {
  title?: string;
  subtitle?: string;
  accentColor?: string;
  isVisible?: boolean;
  onRemove?: () => void;
  canManage?: boolean;
  className?: string;
}

export default function PromotionalBanner({
  title = "🔥 عرض محدود",
  subtitle = "اطلب الآن واحصل على توصيل مجاني!",
  accentColor = "#F97316",
  isVisible = true,
  onRemove,
  canManage = false,
  className = ""
}: PromotionalBannerProps) {
  if (!isVisible) return null;

  return (
    <div 
      className={`relative border p-4 rounded-xl mb-6 ${className}`}
      style={{ 
        backgroundColor: accentColor + '10', 
        borderColor: accentColor + '30' 
      }}
    >
      {canManage && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
          style={{ color: accentColor }}
          title="إزالة اللافتة"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <p className="text-sm font-semibold" style={{ color: accentColor }}>
        {title}
      </p>
      <p className="text-sm mt-1" style={{ color: accentColor }}>
        {subtitle}
      </p>
    </div>
  );
}
