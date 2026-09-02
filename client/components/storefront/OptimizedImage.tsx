import React, { useState, useRef, useEffect } from 'react';
import { optimizeCloudinaryUrl, getBlurPlaceholderUrl } from '@/lib/cloudinary';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  maxWidth?: number;
  blurPlaceholder?: boolean;
  aspectRatio?: string;
}

export default function OptimizedImage({
  src,
  alt,
  maxWidth,
  blurPlaceholder = true,
  aspectRatio,
  className = '',
  style = {},
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  const optimizedSrc = optimizeCloudinaryUrl(src, maxWidth);
  const blurSrc = blurPlaceholder ? getBlurPlaceholderUrl(src) : '';

  useEffect(() => {
    if (!src) return;
    setLoaded(false);
    if (blurSrc) {
      setCurrentSrc(blurSrc);
    }
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(optimizedSrc);
      setLoaded(true);
    };
    img.src = optimizedSrc;
  }, [src, optimizedSrc, blurSrc]);

  if (!src) return null;

  return (
    <img
      ref={imgRef}
      src={currentSrc || optimizedSrc}
      alt={alt}
      className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-60'} ${className}`}
      style={{
        aspectRatio,
        objectFit: 'cover',
        filter: loaded ? 'none' : 'blur(10px)',
        transform: loaded ? 'none' : 'scale(1.05)',
        ...style,
      }}
      loading={props.loading || 'lazy'}
      decoding="async"
      {...props}
    />
  );
}
