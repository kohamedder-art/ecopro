/**
 * useAI — lightweight React hook for calling AI endpoints.
 * Handles loading state, errors, and CSRF token injection automatically.
 */
import { useState, useCallback } from 'react';

interface UseAIOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useAI(endpoint: string, options: UseAIOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCsrfToken = (): string => {
    const match = document.cookie.match(/ecopro_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  const call = useCallback(
    async (body?: Record<string, any>): Promise<any> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: body !== undefined ? 'POST' : 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'AI request failed');
        options.onSuccess?.(data);
        return data;
      } catch (err: any) {
        const msg = err?.message || 'AI request failed';
        setError(msg);
        options.onError?.(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint]
  );

  return { call, loading, error };
}
