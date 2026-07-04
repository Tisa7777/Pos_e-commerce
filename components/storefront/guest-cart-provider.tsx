"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  addToGuestCart,
  clearGuestCart,
  getGuestCart,
  removeFromGuestCart,
  updateGuestCartQty,
  type GuestCartItem,
} from "@/lib/guest-cart";
import type { DrinkIce, DrinkSize, DrinkSweet } from "@/lib/catalog/drink-sizes";

interface GuestCartContextValue {
  items: GuestCartItem[];
  isHydrated: boolean;
  cartCount: number;
  subtotal: number;
  tax: number;
  total: number;
  addItem: (product: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string | null;
    category?: { name?: string } | null;
  }, options?: {
    size?: DrinkSize | null;
    ice?: DrinkIce | null;
    sweet?: DrinkSweet | null;
    quantity?: number;
  }) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
}

const TAX_RATE = 0.1;

const GuestCartContext = createContext<GuestCartContextValue | null>(null);

export function GuestCartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<GuestCartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setItems(getGuestCart());
        setIsHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = useCallback<GuestCartContextValue["addItem"]>((product, options) => {
    setItems(addToGuestCart(product, options));
  }, []);

  const updateQty = useCallback((lineId: string, qty: number) => {
    setItems(updateGuestCartQty(lineId, qty));
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems(removeFromGuestCart(lineId));
  }, []);

  const clear = useCallback(() => {
    clearGuestCart();
    setItems([]);
  }, []);

  const derived = useMemo(() => {
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    return { cartCount, subtotal, tax, total };
  }, [items]);

  const value = useMemo<GuestCartContextValue>(
    () => ({
      items,
      isHydrated,
      ...derived,
      addItem,
      updateQty,
      removeItem,
      clear,
    }),
    [items, isHydrated, derived, addItem, updateQty, removeItem, clear],
  );

  return (
    <GuestCartContext.Provider value={value}>
      {children}
    </GuestCartContext.Provider>
  );
}

export function useGuestCart() {
  const ctx = useContext(GuestCartContext);
  if (!ctx) {
    throw new Error("useGuestCart must be used within <GuestCartProvider>");
  }
  return ctx;
}
