"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGuestCart } from "@/components/storefront/guest-cart-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { isDrinkProduct, isStockTrackedProduct } from "@/lib/catalog/drink-sizes";
import { getProductIconName } from "@/lib/premium-icons";
import { formatCurrency } from "@/lib/utils";
import type { ProductCardData } from "@/types/domain";

export function ProductCard({ product }: { product: ProductCardData }) {
  const isStockTracked = isStockTrackedProduct(product);
  const isOutOfStock = isStockTracked && product.stockQuantity <= 0;
  const description =
    product.description?.split(".").shift()?.trim() || "Freshly prepared for cafe moments.";
  const productIconName = getProductIconName(product.name, product.category?.name);
  // Drinks are customized (size / ice / sweetness) on their detail page.
  const isCustomizable = isDrinkProduct(product);
  const detailHref = `/shop/${product.slug}`;

  const { addItem } = useGuestCart();
  const [buttonLabel, setButtonLabel] = useState("Add to Cart");
  const [isPending, setIsPending] = useState(false);

  function handleQuickAdd() {
    setIsPending(true);
    setButtonLabel("Adding...");
    setTimeout(() => {
      addItem(product);
      setButtonLabel("In Cart ✓");
      setIsPending(false);
    }, 200);
  }

  useEffect(() => {
    if (buttonLabel.startsWith("In Cart")) {
      const timer = setTimeout(() => setButtonLabel("Add to Cart"), 1500);
      return () => clearTimeout(timer);
    }
  }, [buttonLabel]);

  return (
    <Card className="group overflow-hidden border border-black/[0.04] bg-white/95 shadow-[var(--shadow-card)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-[var(--shadow-elevated)] hover:border-primary/10">
      <Link href={detailHref} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#f0fdfa] via-[#e8e8ff] to-[#f0f0ff]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              width={640}
              height={480}
              className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.08]"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-primary/50">
              <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 p-8 transition-all duration-500 group-hover:scale-110 group-hover:from-primary/15 group-hover:to-primary/8">
                <PremiumIcon name={productIconName} className="h-12 w-12" />
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge variant="soft" size="sm" className="shadow-sm">
              {product.category?.name ?? "General"}
            </Badge>
            {isStockTracked && !isOutOfStock && product.stockQuantity < 10 && (
              <Badge variant="accent" size="sm" className="shadow-sm">
                Low stock
              </Badge>
            )}
          </div>

          {isOutOfStock ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0c1712]/60 backdrop-blur-[3px] transition-all duration-300">
              <span className="rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-foreground shadow-xl backdrop-blur-sm">
                Out of stock
              </span>
            </div>
          ) : null}
        </div>
      </Link>

      <CardContent className="space-y-4 pt-5">
        <Link href={detailHref} className="block space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold tracking-tight text-[#0c1712] line-clamp-1 group-hover:text-primary transition-colors duration-300">
              {product.name}
            </h3>
            <p className="font-mono text-xl font-semibold text-primary shrink-0">
              {formatCurrency(product.price)}
            </p>
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>
          {isCustomizable ? (
            <p className="text-xs font-medium text-muted/70">Choose size, ice &amp; sweetness</p>
          ) : null}
        </Link>

        <div className="flex gap-2 pt-1">
          {isOutOfStock ? (
            <div className="flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-muted">
              Out of stock
            </div>
          ) : isCustomizable ? (
            <Button asChild variant="primary" size="sm" className="flex-1">
              <Link href={detailHref}>
                <PremiumIcon name="coffee" className="h-4 w-4" />
                Select options
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant={buttonLabel.startsWith("In Cart") ? "success" : "primary"}
              size="sm"
              disabled={isPending}
              onClick={handleQuickAdd}
              className="flex-1"
            >
              <PremiumIcon
                name={buttonLabel.startsWith("In Cart") ? "check" : "cart"}
                className="h-4 w-4"
              />
              {buttonLabel}
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="px-3 border border-border/80 bg-white hover:border-primary/20 hover:text-primary"
          >
            <Link href={detailHref}>
              <PremiumIcon name="chevron-right" className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
