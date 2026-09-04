import React, { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
  /** Delay in ms before starting video load. Staggers loading across products. */
  loadDelay?: number;
}

export default function LazyVideo({ src, poster, className, loadDelay = 0 }: LazyVideoProps) {
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!containerRef.current || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          // Stagger: delay video load so thumbnails appear first, one-by-one
          loadTimerRef.current = setTimeout(() => {
            setIsReady(true);
          }, loadDelay);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [src, loadDelay]);

  // When video element mounts, load metadata + first frame
  useEffect(() => {
    if (!isReady || !videoRef.current) return;
    const video = videoRef.current;

    const onLoaded = () => {
      video.play().catch(() => {});
    };

    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.load();

    return () => {
      video.removeEventListener('loadeddata', onLoaded);
    };
  }, [isReady]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Video: layered behind poster, fades in when first frame ready */}
      {isReady && (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 2,
            opacity: isReady ? 1 : 0,
            transition: 'opacity 0.4s',
          }}
        />
      )}
      {/* Poster: ALWAYS visible underneath, never blank */}
      <img
        src={poster}
        alt=""
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'relative',
          zIndex: 1,
        }}
      />
    </div>
  );
}
