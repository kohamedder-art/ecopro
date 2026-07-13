/**
 * EcoPro Pixel Tracking Script
 * 
 * This script tracks pixel events for Facebook and TikTok pixels
 * and sends them to the platform API for aggregation and statistics.
 * 
 * Usage: Include this script in your storefront and call the tracking functions.
 */

(function() {
  'use strict';
  
  // Configuration
  const API_BASE = window.ECOPRO_API_URL || '/api';
  const STORE_SLUG = window.ECOPRO_STORE_SLUG || '';
  
  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }
  function safeSet(storage, key, value) {
    try { storage.setItem(key, value); } catch { /* storage blocked */ }
  }

  // Generate or retrieve visitor ID
  function getVisitorId() {
    let visitorId = safeGet(localStorage, 'ecopro_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      safeSet(localStorage, 'ecopro_visitor_id', visitorId);
    }
    return visitorId;
  }
  
  // Generate or retrieve session ID
  function getSessionId() {
    let sessionId = safeGet(sessionStorage, 'ecopro_session_id');
    if (!sessionId) {
      sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      safeSet(sessionStorage, 'ecopro_session_id', sessionId);
    }
    return sessionId;
  }
  
  // Track an event
  async function trackEvent(pixelType, eventName, eventData = {}) {
    if (!STORE_SLUG) {
      console.warn('[EcoPro Pixel] Store slug not configured');
      return;
    }
    
    const payload = {
      store_slug: STORE_SLUG,
      pixel_type: pixelType,
      event_name: eventName,
      event_data: eventData,
      page_url: window.location.href,
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      product_id: eventData.product_id || null,
      order_id: eventData.order_id || null,
      revenue: eventData.value || eventData.revenue || null,
      currency: eventData.currency || 'DZD'
    };
    
    try {
      const response = await fetch(`${API_BASE}/pixels/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.warn('[EcoPro Pixel] Failed to track event:', eventName);
      }
    } catch (error) {
      console.warn('[EcoPro Pixel] Error tracking event:', error);
    }
  }
  
  // Track for both Facebook and TikTok
  async function trackBoth(eventName, eventData = {}) {
    await Promise.all([
      trackEvent('facebook', eventName, eventData),
      trackEvent('tiktok', eventName, eventData)
    ]);
  }
  
  // Public API
  window.EcoProPixel = {
    // Initialize with store slug
    init: function(storeSlug, apiUrl) {
      window.ECOPRO_STORE_SLUG = storeSlug;
      if (apiUrl) {
        window.ECOPRO_API_URL = apiUrl;
      }
      // Auto-track PageView on init
      this.pageView();
    },
    
    // Track page view
    pageView: function() {
      trackBoth('PageView', {
        page_title: document.title,
        page_path: window.location.pathname
      });
    },
    
    // Track product view
    viewContent: function(productId, productName, price, category) {
      trackBoth('ViewContent', {
        product_id: productId,
        content_name: productName,
        value: price,
        content_category: category,
        content_type: 'product'
      });
    },
    
    // Track add to cart
    addToCart: function(productId, productName, price, quantity = 1) {
      trackBoth('AddToCart', {
        product_id: productId,
        content_name: productName,
        value: price * quantity,
        num_items: quantity,
        content_type: 'product'
      });
    },
    
    // Track checkout initiation
    initiateCheckout: function(cartTotal, numItems, productIds) {
      trackBoth('InitiateCheckout', {
        value: cartTotal,
        num_items: numItems,
        content_ids: productIds,
        currency: 'DZD'
      });
    },
    
    // Track purchase
    purchase: function(orderId, total, numItems, productIds) {
      trackBoth('Purchase', {
        order_id: orderId,
        value: total,
        revenue: total,
        num_items: numItems,
        content_ids: productIds,
        currency: 'DZD'
      });
    },
    
    // Track search
    search: function(searchQuery, resultCount) {
      trackBoth('Search', {
        search_string: searchQuery,
        content_category: 'search',
        num_results: resultCount
      });
    },
    
    // Track lead (e.g., newsletter signup)
    lead: function(leadType, leadData = {}) {
      trackBoth('Lead', {
        lead_type: leadType,
        ...leadData
      });
    },
    
    // Track add to wishlist
    addToWishlist: function(productId, productName, price) {
      trackBoth('AddToWishlist', {
        product_id: productId,
        content_name: productName,
        value: price,
        content_type: 'product'
      });
    },
    
    // Custom event
    custom: function(eventName, eventData = {}) {
      trackBoth(eventName, eventData);
    },
    
    // Track only Facebook
    facebook: {
      track: function(eventName, eventData = {}) {
        trackEvent('facebook', eventName, eventData);
      }
    },
    
    // Track only TikTok
    tiktok: {
      track: function(eventName, eventData = {}) {
        trackEvent('tiktok', eventName, eventData);
      }
    }
  };
  
  // Auto-initialize if store slug is already set
  if (STORE_SLUG) {
    window.EcoProPixel.pageView();
  }
  
})();
