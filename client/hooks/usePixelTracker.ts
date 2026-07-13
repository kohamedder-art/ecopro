import { useCallback, useEffect, useRef } from 'react';

const CANONICAL_VISITOR_KEY = 'ecopro_visitor_id';
const CANONICAL_SESSION_KEY = 'ecopro_session_id';
const LEGACY_VISITOR_KEYS = [CANONICAL_VISITOR_KEY, 'pixel_visitor_id'];
const LEGACY_SESSION_KEYS = [CANONICAL_SESSION_KEY, 'pixel_session_id'];

/**
 * Hook for tracking pixel events in React components
 */
export function usePixelTracker(storeSlug: string) {
  const initialized = useRef(false);
  const visitorId = useRef<string>('');
  const sessionId = useRef<string>('');
  
  // Initialize visitor and session IDs
  useEffect(() => {
    // Get or create visitor ID (persistent)
    let vid = '';
    for (const key of LEGACY_VISITOR_KEYS) {
      try {
        const existing = localStorage.getItem(key);
        if (existing) {
          vid = existing;
          break;
        }
      } catch { /* storage blocked */ }
    }
    if (!vid) {
      vid = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    for (const key of LEGACY_VISITOR_KEYS) {
      try { localStorage.setItem(key, vid); } catch { /* storage blocked */ }
    }
    visitorId.current = vid;
    
    // Get or create session ID (per session)
    let sid = '';
    for (const key of LEGACY_SESSION_KEYS) {
      try {
        const existing = sessionStorage.getItem(key);
        if (existing) {
          sid = existing;
          break;
        }
      } catch { /* storage blocked */ }
    }
    if (!sid) {
      sid = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    for (const key of LEGACY_SESSION_KEYS) {
      try { sessionStorage.setItem(key, sid); } catch { /* storage blocked */ }
    }
    sessionId.current = sid;
    
    initialized.current = true;
  }, []);
  
  // Base tracking function
  const trackEvent = useCallback(async (
    pixelType: 'facebook' | 'tiktok',
    eventName: string,
    eventData: Record<string, any> = {}
  ) => {
    if (!storeSlug) return;
    
    try {
      await fetch('/api/pixels/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          pixel_type: pixelType,
          event_name: eventName,
          event_data: eventData,
          page_url: window.location.href,
          session_id: sessionId.current,
          visitor_id: visitorId.current,
          product_id: eventData.product_id || null,
          order_id: eventData.order_id || null,
          revenue: eventData.value || eventData.revenue || null,
          currency: eventData.currency || 'DZD'
        })
      });
    } catch (error) {
      console.warn('[Pixel] Failed to track event:', error);
    }
  }, [storeSlug]);
  
  // Track on both platforms
  const trackBoth = useCallback(async (eventName: string, eventData: Record<string, any> = {}) => {
    await Promise.all([
      trackEvent('facebook', eventName, eventData),
      trackEvent('tiktok', eventName, eventData)
    ]);
  }, [trackEvent]);
  
  // Tracking methods
  const pageView = useCallback(() => {
    trackBoth('PageView', {
      page_title: document.title,
      page_path: window.location.pathname
    });
  }, [trackBoth]);
  
  const viewContent = useCallback((productId: number, productName: string, price: number, category?: string) => {
    trackBoth('ViewContent', {
      product_id: productId,
      content_name: productName,
      value: price,
      content_category: category,
      content_type: 'product'
    });
  }, [trackBoth]);
  
  const addToCart = useCallback((productId: number, productName: string, price: number, quantity = 1) => {
    trackBoth('AddToCart', {
      product_id: productId,
      content_name: productName,
      value: price * quantity,
      num_items: quantity,
      content_type: 'product'
    });
  }, [trackBoth]);
  
  const initiateCheckout = useCallback((cartTotal: number, numItems: number, productIds: number[]) => {
    trackBoth('InitiateCheckout', {
      value: cartTotal,
      num_items: numItems,
      content_ids: productIds,
      currency: 'DZD'
    });
  }, [trackBoth]);
  
  const purchase = useCallback((orderId: number, total: number, numItems: number, productIds: number[]) => {
    trackBoth('Purchase', {
      order_id: orderId,
      value: total,
      revenue: total,
      num_items: numItems,
      content_ids: productIds,
      currency: 'DZD'
    });
  }, [trackBoth]);
  
  const search = useCallback((searchQuery: string, resultCount?: number) => {
    trackBoth('Search', {
      search_string: searchQuery,
      content_category: 'search',
      num_results: resultCount
    });
  }, [trackBoth]);
  
  const addToWishlist = useCallback((productId: number, productName: string, price: number) => {
    trackBoth('AddToWishlist', {
      product_id: productId,
      content_name: productName,
      value: price,
      content_type: 'product'
    });
  }, [trackBoth]);
  
  return {
    pageView,
    viewContent,
    addToCart,
    initiateCheckout,
    purchase,
    search,
    addToWishlist,
    trackEvent,
    trackBoth
  };
}

export default usePixelTracker;
