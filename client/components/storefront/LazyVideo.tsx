import React, { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  /** Delay before starting video load (ms). Lets thumbnails load first. */
  loadDelay?: number;
  /** Called when first video frame is ready (not full download). */
  onPosterReady?: () => void;
}

export default function LazyVideo({ src, poster, className, onMouseEnter, onMouseLeave, loadDelay = 0, onPosterReady }: LazyVideoProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: detect when visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Apply delay so thumbnails load first
          if (loadDelay > 0) {
            const timer = setTimeout(() => setShouldLoad(true), loadDelay);
            return () => clearTimeout(timer);
          }
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loadDelay]);

  // Load video metadata + first frame only (not full video)
  useEffect(() => {
    if (!shouldLoad || !src) return;

    const video = document.createElement('video');
    video.preload = 'auto'; // auto so browser fetches enough for first frame
    video.src = src;
    video.muted = true;

    const onReady = () => {
      setIsReady(true);
      onPosterReady?.();
    };

    // loadeddata fires when first frame is available — MUCH faster than canplaythrough
    video.addEventListener('loadeddata', onReady, { once: true });
    video.load();

    return () => {
      video.removeEventListener('loadeddata', onReady);
      video.src = '';
    };
  }, [shouldLoad, src]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {isReady ? (
        <video
          src={src}
          muted
          loop
          playsInline
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ) : (
        <img src={poster} alt="" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}
