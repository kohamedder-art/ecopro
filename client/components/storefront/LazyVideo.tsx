import React, { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
}

export default function LazyVideo({ src, poster, className }: LazyVideoProps) {
  const [inView, setInView] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Detect when visible — then start loading
  useEffect(() => {
    if (!containerRef.current || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setInView(true);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [src]);

  // When video element mounts, detect first frame
  useEffect(() => {
    if (!inView || !videoRef.current) return;
    const video = videoRef.current;

    const onData = () => setFirstFrameReady(true);
    video.addEventListener('loadeddata', onData, { once: true });

    return () => video.removeEventListener('loadeddata', onData);
  }, [inView]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {inView && (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 2,
            opacity: firstFrameReady ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
      )}
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
