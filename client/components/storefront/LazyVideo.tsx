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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video ONLY on hover — one at a time, no bandwidth competition
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldLoad && src) {
      setShouldLoad(true);
    }
    // Forward event to video if it exists
    if (videoRef.current && onMouseEnter) {
      onMouseEnter(e as any);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && onMouseLeave) {
      onMouseLeave(e as any);
    }
  };

  // Once shouldLoad is true, detect when first frame is ready
  useEffect(() => {
    if (!shouldLoad || !src || !videoRef.current) return;

    const video = videoRef.current;
    const onReady = () => {
      setIsReady(true);
    };

    video.addEventListener('loadeddata', onReady, { once: true });
    video.load();

    return () => {
      video.removeEventListener('loadeddata', onReady);
    };
  }, [shouldLoad, src]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video: always in DOM once shouldLoad, but hidden until ready */}
      {shouldLoad && (
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
            position: isReady ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            opacity: isReady ? 1 : 0,
            zIndex: isReady ? 1 : -1,
            transition: 'opacity 0.3s',
          }}
        />
      )}
      {/* Poster: always visible until video first frame is ready */}
      {!isReady && (
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
      )}
    </div>
  );
}
