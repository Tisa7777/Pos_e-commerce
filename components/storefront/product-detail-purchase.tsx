"use client";

import { useState } from "react";
import { useGuestCart } from "@/components/storefront/guest-cart-provider";
import { PremiumIcon } from "@/components/ui/premium-icon";
import {
  DEFAULT_DRINK_SIZE,
  DEFAULT_ICE,
  DEFAULT_SWEET,
  DRINK_SIZES,
  ICE_LEVELS,
  SWEET_LEVELS,
  getDrinkSizePrice,
  isDrinkProduct,
  isStockTrackedProduct,
  type DrinkIce,
  type DrinkSize,
  type DrinkSweet,
} from "@/lib/catalog/drink-sizes";
import { formatCurrency } from "@/lib/utils";
import type { ProductCardData } from "@/types/domain";

export function ProductDetailPurchase({ product }: { product: ProductCardData }) {
  const { addItem } = useGuestCart();
  const hasDrinkSizes = isDrinkProduct(product);
  const isOutOfStock = isStockTrackedProduct(product) && product.stockQuantity <= 0;

  const [size, setSize] = useState<DrinkSize>(DEFAULT_DRINK_SIZE);
  const [ice, setIce] = useState<DrinkIce>(DEFAULT_ICE);
  const [sweet, setSweet] = useState<DrinkSweet>(DEFAULT_SWEET);
  const [quantity, setQuantity] = useState(1);
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);

  const activeSize = hasDrinkSizes ? size : null;
  const unitPrice = getDrinkSizePrice(product.price, activeSize);
  const total = unitPrice * quantity;

  function handleAdd() {
    addItem(product, {
      size: activeSize,
      ice: hasDrinkSizes ? ice : null,
      sweet: hasDrinkSizes ? sweet : null,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="space-y-6">
      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-rose-600">{formatCurrency(unitPrice)}</span>
        {hasDrinkSizes && size === "L" ? (
          <span className="text-sm text-slate-400 line-through">
            {formatCurrency(product.price)}
          </span>
        ) : null}
      </div>

      {/* Title + category */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {product.category?.name ?? "General"}
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">{product.name}</h1>
        {product.description ? (
          <p className="pt-1 text-sm leading-6 text-slate-500">{product.description}</p>
        ) : null}
      </div>

      {hasDrinkSizes ? (
        <div className="space-y-5">
          <OptionRow label="Size">
            {DRINK_SIZES.map((option) => (
              <Box key={option} active={size === option} onClick={() => setSize(option)}>
                {option}
              </Box>
            ))}
          </OptionRow>
          <OptionRow label="Ice level">
            {ICE_LEVELS.map((option) => (
              <Box key={option} active={ice === option} onClick={() => setIce(option)}>
                {option}
              </Box>
            ))}
          </OptionRow>
          <OptionRow label="Sweetness">
            {SWEET_LEVELS.map((option) => (
              <Box key={option} active={sweet === option} onClick={() => setSweet(option)}>
                {option}
              </Box>
            ))}
          </OptionRow>
        </div>
      ) : null}

      {/* Quantity */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">Quantity</p>
        <div className="inline-flex items-center rounded-lg border border-slate-300">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-11 w-11 items-center justify-center text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Decrease quantity"
            disabled={isOutOfStock}
          >
            −
          </button>
          <span className="w-12 text-center font-mono text-base font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="flex h-11 w-11 items-center justify-center text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Increase quantity"
            disabled={isOutOfStock}
          >
            +
          </button>
        </div>
      </div>

      {/* Add to cart + wishlist */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {added ? (
            <>
              <PremiumIcon name="check" className="h-5 w-5" />
              Added to cart
            </>
          ) : isOutOfStock ? (
            "Out of stock"
          ) : (
            <>
              <PremiumIcon name="cart" className="h-5 w-5" />
              Add to cart — {formatCurrency(total)}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setWished((w) => !w)}
          aria-label="Save to wishlist"
          aria-pressed={wished}
          className={`flex h-14 w-14 items-center justify-center rounded-lg border transition ${
            wished
              ? "border-rose-200 bg-rose-50 text-rose-500"
              : "border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill={wished ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>

      {/* Info row */}
      <div className="grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
        <InfoItem icon="delivery" title="Fast pickup" subtitle="Ready in 15–20 min" />
        <InfoItem icon="bell" title="Support hotline" subtitle="+855 85 330 330" />
        <InfoItem icon="cash" title="Easy payment" subtitle="Cash or QR" />
        <InfoItem icon="store" title="In-store & online" subtitle="Order your way" />
      </div>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Box({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-12 rounded-md border px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function InfoItem({
  icon,
  title,
  subtitle,
}: {
  icon: "delivery" | "bell" | "cash" | "store";
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-black/[0.04]">
        <PremiumIcon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
