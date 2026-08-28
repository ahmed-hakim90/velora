"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { StorefrontCartLine, StorefrontProduct, StorefrontVariant } from "../core/types";

type CartContextValue = {
  lines: StorefrontCartLine[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  add: (product: StorefrontProduct, variant?: StorefrontVariant | null) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function StorefrontCartProvider({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const storageKey = `velora-storefront-cart:${storeSlug}`;
  const [lines, setLines] = useState<StorefrontCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setLines(JSON.parse(saved) as StorefrontCartLine[]);
    } catch { /* Ignore corrupted browser storage. */ }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [hydrated, lines, storageKey]);

  const add = useCallback((product: StorefrontProduct, variant?: StorefrontVariant | null) => {
    const id = `${product.id}:${variant?.id ?? ""}`;
    setLines((current) => {
      const existing = current.find((line) => line.id === id);
      if (existing) return current.map((line) => line.id === id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line);
      return [...current, {
        id,
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        variantName: variant?.name ?? null,
        imageUrl: product.imageUrl,
        unitPrice: variant?.price ?? product.price,
        quantity: 1,
      }];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((current) => quantity <= 0
      ? current.filter((line) => line.id !== id)
      : current.map((line) => line.id === id ? { ...line, quantity: Math.min(99, quantity) } : line));
  }, []);
  const clear = useCallback(() => setLines([]), []);
  const value = useMemo(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    hydrated,
    add,
    setQuantity,
    clear,
  }), [add, clear, hydrated, lines, setQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStorefrontCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useStorefrontCart must be used inside StorefrontCartProvider");
  return value;
}
