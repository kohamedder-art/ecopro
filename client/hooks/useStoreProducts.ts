import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/contexts/StoreContext';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchStoreProducts(): Promise<any[]> {
  const res = await fetch('/api/client/store/products', { credentials: 'include' });

  if (res.status === 401 || res.status === 403) {
    throw new HttpError(res.status, 'Unauthorized');
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const msg = detail && (detail.error || detail.message) ? String(detail.error || detail.message) : `HTTP ${res.status}`;
    throw new HttpError(res.status, `Failed to load store products (${msg})`);
  }

  const data = await res.json().catch(() => [] as any);
  return Array.isArray(data) ? data : [];
}

export function useStoreProducts(options?: { enabled?: boolean; onUnauthorized?: () => void }) {
  const { activeStore, storeVersion } = useStore();
  const activeStoreId = activeStore?.id ?? null;
  const query = useQuery({
    queryKey: ['storeProducts', activeStoreId, storeVersion],
    queryFn: fetchStoreProducts,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      const status = error instanceof HttpError ? error.status : null;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mirror useStoreSettings behavior for auth failures.
  useEffect(() => {
    if (query.error instanceof HttpError && (query.error.status === 401 || query.error.status === 403)) {
      options?.onUnauthorized?.();
    }
  }, [query.error, options]);

  return {
    ...query,
    products: (query.data || []) as any[],
  };
}
