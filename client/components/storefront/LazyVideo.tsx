import React, { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent<HTMLVideoElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}

export default function LazyVideo({ src, poster, className, onMouseEnter, onMouseLeave }: LazyVideoProps) {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;

    function startLoad() {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;

      video.addEventListener('canplaythrough', () => {
        if (!cancelled) setShowVideo(true);
      }, { once: true });

      video.load();
    }

    if (document.readyState === 'complete') {
      startLoad();
    } else {
      window.addEventListener('load', startLoad, { once: true });
      return () => { cancelled = true; window.removeEventListener('load', startLoad); };
    }
  }, [src]);

  if (showVideo) {
    return (
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        className={className}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return <img src={poster} alt="" loading="lazy" className={className} />;
}
