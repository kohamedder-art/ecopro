import React, { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}

export default function LazyVideo({ src, poster, className, onMouseEnter, onMouseLeave }: LazyVideoProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || !src) return;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = src;
    video.muted = true;

    const onReady = () => {
      setIsReady(true);
      video.removeEventListener('canplaythrough', onReady);
    };

    video.addEventListener('canplaythrough', onReady, { once: true });
    video.load();

    return () => {
      video.removeEventListener('canplaythrough', onReady);
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
        <img src={poster} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}
