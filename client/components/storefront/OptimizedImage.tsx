import React, { useState, useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (!src) return;
    setLoaded(false);
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
  }, [src]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={`transition-all duration-500 ${loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-60 blur-[10px] scale-105'} ${className}`}
      style={{ aspectRatio, objectFit: 'cover', ...style }}
      loading={props.loading || 'lazy'}
      decoding="async"
      {...props}
    />
  );
}
