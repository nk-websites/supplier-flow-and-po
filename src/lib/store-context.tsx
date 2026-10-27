import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { Store } from "@/types";

interface StoreContextValue {
  stores: Store[];
  currentStore: Store | null;
  setCurrentStoreId: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue>({
  stores: [],
  currentStore: null,
  setCurrentStoreId: () => {},
});

const LS_KEY = "nk.currentStoreId";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { data: meta } = useAsync(() => api.meta(), []);
  const stores = meta?.stores ?? [];
  const [currentStoreId, setCurrentStoreId] = useState<string>(
    () => (typeof localStorage !== "undefined" && localStorage.getItem(LS_KEY)) || ""
  );

  const parent = stores.find((s) => !s.parent) ?? stores[0] ?? null;
  const currentStore = stores.find((s) => s.id === currentStoreId) ?? parent;

  useEffect(() => {
    if (currentStore && typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, currentStore.id);
    }
  }, [currentStore]);

  const value = useMemo(
    () => ({ stores, currentStore, setCurrentStoreId }),
    [stores, currentStore]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
