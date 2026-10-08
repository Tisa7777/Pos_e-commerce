import type { ProductCardData } from "@/types/domain";

/** Fields safe to expose to unauthenticated storefront clients. */
export function toPublicProduct(product: ProductCardData) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    barcode: product.barcode ?? null,
    description: product.description ?? null,
    price: product.price,
    stockQuantity: product.stockQuantity,
    category: product.category ?? null,
    imageUrl: product.imageUrl ?? null,
    imageAlt: product.imageAlt ?? product.name,
  };
}
