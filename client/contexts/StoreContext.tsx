import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface Store {
  id: number;
  store_name: string;
  store_slug: string;
  template: string;
  primary_color: string;
  is_public: boolean;
  created_at: string;
}

interface StoreContextType {
  stores: Store[];
  activeStore: Store | null;
  loading: boolean;
  setActiveStore: (store: Store) => void;
  refreshStores: () => Promise<void>;
  createStore: (name: string, sourceStoreId?: number) => Promise<Store | null>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? JSON.parse(userStr) : null;
  const isClient = user?.user_type === 'client' || user?.role === 'admin';

  const fetchStores = useCallback(async () => {
    if (!isClient) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/client/stores', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (e) {
      console.error('[StoreContext] Failed to fetch stores:', e);
    } finally {
      setLoading(false);
    }
  }, [isClient]);

  const setActiveStore = useCallback((store: Store) => {
    setActiveStoreState(store);
    localStorage.setItem('activeStoreId', String(store.id));
    localStorage.setItem('activeStoreSlug', store.store_slug);
  }, []);

  const createStore = useCallback(async (name: string, sourceStoreId?: number): Promise<Store | null> => {
    try {
      const res = await fetch('/api/client/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, sourceStoreId }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchStores();
        return data.store;
      }
    } catch (e) {
      console.error('[StoreContext] Failed to create store:', e);
    }
    return null;
  }, [fetchStores]);

  // Load stores and restore active store on mount
  useEffect(() => {
    fetchStores().then(() => {
      const savedId = localStorage.getItem('activeStoreId');
      if (savedId) {
        // Will be matched after stores load
      }
    });
  }, [fetchStores]);

  // Match saved active store after stores load
  useEffect(() => {
    if (stores.length === 0 || activeStore) return;
    const savedId = localStorage.getItem('activeStoreId');
    if (savedId) {
      const found = stores.find(s => s.id === Number(savedId));
      if (found) {
        setActiveStoreState(found);
        return;
      }
    }
    // Default to first store
    if (stores.length > 0) {
      setActiveStoreState(stores[0]);
      localStorage.setItem('activeStoreId', String(stores[0].id));
      localStorage.setItem('activeStoreSlug', stores[0].store_slug);
    }
  }, [stores, activeStore]);

  return (
    <StoreContext.Provider value={{ stores, activeStore, loading, setActiveStore, refreshStores: fetchStores, createStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
