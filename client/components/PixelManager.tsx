import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { init, loadPlatform, loadStore, trackPageView } from "../lib/pixel";
import { getResolvedStoreSlug } from "../lib/resolvedStore";

export default function PixelManager() {
  const loc = useLocation();
  const isFirst = (globalThis as any).__PIXEL_FIRST__ ?? true;
  (globalThis as any).__PIXEL_FIRST__ = false;
  useEffect(() => {
    let dead = false;
    (async () => {
      const sub = getResolvedStoreSlug();
      const path = loc.pathname.match(/^\/store\/([^/]+)/)?.[1];
      const isPlatform = !sub && !path;
      const cfg = sub ? await loadStore(sub) : path ? await loadStore(path) : await loadPlatform();
      if (dead) return;
      await init(cfg);
      if (dead) return;
      if (isPlatform && isFirst && (window as any).__PIXEL_INJECTED__?.length) return;
      trackPageView(loc.pathname + loc.search);
    })();
    return () => { dead = true; };
  }, [loc.pathname, loc.search]);
  return null;
}
