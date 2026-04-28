import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { safeJsonParse } from '@/utils/safeJson';
import { storeNameToSlug } from '@/utils/storeUrl';
import type { StoreSettingsLike } from '@/lib/storeSchema';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readStoredSettings(): StoreSettingsLike | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = safeJsonParse<StoreSettingsLike>(localStorage.getItem('storeSettings'), null as any);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchStoreSettings(): Promise<StoreSettingsLike> {
  const res = await fetch('/api/client/store/settings', { credentials: 'include' });

  if (res.status === 401 || res.status === 403) {
    throw new HttpError(res.status, 'Unauthorized');
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const msg = detail && (detail.error || detail.message) ? String(detail.error || detail.message) : `HTTP ${res.status}`;
    throw new HttpError(res.status, `Failed to load store settings (${msg})`);
  }

  const data = await res.json().catch(() => ({} as any));
  return (data && typeof data === 'object' ? data : {}) as StoreSettingsLike;
}

export function useStoreSettings(options?: { enabled?: boolean; onUnauthorized?: () => void }) {
  const query = useQuery({
    queryKey: ['storeSettings'],
    queryFn: fetchStoreSettings,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      const status = error instanceof HttpError ? error.status : null;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: () => readStoredSettings() ?? ({} as StoreSettingsLike),
  });

  const storeSlug = useMemo(() => {
    const settings = (query.data || {}) as StoreSettingsLike;
    // Prefer the authoritative store_slug from the DB; only fall back to
    // name-derived slug if store_slug is absent (legacy accounts without a slug).
    const dbSlug = settings?.store_slug ? String(settings.store_slug).trim() : null;
    if (dbSlug) return dbSlug;
    const nameDerived = settings?.store_name ? storeNameToSlug(String(settings.store_name)) : null;
    return nameDerived || null;
  }, [query.data]);

  useEffect(() => {
    if (query.error instanceof HttpError && (query.error.status === 401 || query.error.status === 403)) {
      options?.onUnauthorized?.();
    }
  }, [query.error, options]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!query.data) return;

    try {
      localStorage.setItem('storeSettings', JSON.stringify(query.data));
      if (storeSlug) localStorage.setItem('currentStoreSlug', storeSlug);
    } catch {
      // ignore
    }
  }, [query.data, storeSlug]);

  return {
    ...query,
    storeSettings: (query.data || {}) as StoreSettingsLike,
    storeSlug,
  };
}
