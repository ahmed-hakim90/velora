"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type StorefrontWishlistValue = {
  ids: string[];
  hydrated: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
};

const StorefrontWishlistContext = createContext<StorefrontWishlistValue | null>(
  null,
);

export function StorefrontWishlistProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const storageKey = `velora:storefront:${storeSlug}:wishlist`;
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(stored)) {
        setIds(
          stored.filter((value): value is string => typeof value === "string"),
        );
      }
    } catch {
      localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  const toggle = useCallback(
    (productId: string) => {
      setIds((current) => {
        const next = current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [...current, productId];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({
      ids,
      hydrated,
      has: (productId: string) => ids.includes(productId),
      toggle,
    }),
    [hydrated, ids, toggle],
  );

  return (
    <StorefrontWishlistContext.Provider value={value}>
      {children}
    </StorefrontWishlistContext.Provider>
  );
}

export function useStorefrontWishlist() {
  const value = useContext(StorefrontWishlistContext);
  if (!value)
    throw new Error("useStorefrontWishlist must be used within its provider");
  return value;
}
