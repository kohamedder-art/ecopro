import { useState, useEffect, useCallback, useRef } from 'react';

interface ABVariant {
  id: number;
  image_url: string;
  label: string;
  product_id: number | null;
  headline: string | null;
  cta_text: string | null;
}

interface ABTestResult {
  variant: ABVariant | null;
  imageUrl: string | null;
  loading: boolean;
  trackClick: () => void;
}

function getVisitorId(): string {
  const match = document.cookie.match(/eco_ab_v=(\d+)/);
  return match ? match[1] : 'anonymous';
}

export function useABTestVariant(testId: string | null): ABTestResult {
  const [variant, setVariant] = useState<ABVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    fetch(`/api/ab/assign/${testId}`)
      .then(r => r.json())
      .then(data => {
        if (data.variant) {
          setVariant(data.variant);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [testId]);

  // Fire impression once variant is assigned
  useEffect(() => {
    if (!variant || impressionFired.current) return;
    impressionFired.current = true;
    fetch('/api/ab/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId: variant.id,
        eventType: 'impression',
      }),
    }).catch(() => {});
  }, [variant]);

  const trackClick = useCallback(() => {
    if (!variant) return;
    fetch('/api/ab/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId: variant.id,
        eventType: 'click',
      }),
    }).catch(() => {});
  }, [variant]);

  return {
    variant,
    imageUrl: variant?.image_url || null,
    loading,
    trackClick,
  };
}

export function useABTestIdFromUrl(): string | null {
  const [testId, setTestId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ab = params.get('ab');
    if (ab) setTestId(ab);
  }, []);
  return testId;
}
