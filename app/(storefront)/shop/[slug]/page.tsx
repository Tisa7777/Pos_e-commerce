import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductDetailPurchase } from "@/components/storefront/product-detail-purchase";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { getProductIconName } from "@/lib/premium-icons";
import { getProductBySlug, listProducts } from "@/lib/services/products";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const iconName = getProductIconName(product.name, product.category?.name);

  // Fetch all products to display related ones
  const allProducts = await listProducts();

  // Related products from the same category first, excluding the current product
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && p.category?.id === product.category?.id)
    .slice(0, 4);

  // If there are fewer than 4 related products, backfill with products from other categories
  if (relatedProducts.length < 4) {
    const otherProducts = allProducts
      .filter((p) => p.id !== product.id && p.category?.id !== product.category?.id)
      .slice(0, 4 - relatedProducts.length);
    relatedProducts.push(...otherProducts);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Back to Shop Link */}
      <div className="mb-6">
        <Link
          href="/shop"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-300 hover:border-primary/20 hover:bg-slate-50 hover:text-primary"
        >
          <PremiumIcon
            name="arrow-right"
            className="h-3.5 w-3.5 rotate-180 transition-transform duration-300 group-hover:-translate-x-1"
          />
          Back to Shop
        </Link>
      </div>

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/shop" className="hover:text-primary">
          Shop
        </Link>
        <span>/</span>
        <Link
          href={`/shop?category=${product.category?.slug ?? ""}`}
          className="hover:text-primary"
        >
          {product.category?.name ?? "General"}
        </Link>
        <span>/</span>
        <span className="truncate text-slate-800">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ── Left: image gallery ── */}
        <div className="flex gap-4">
          <div className="hidden w-20 shrink-0 flex-col gap-3 sm:flex">
            <div className="aspect-square overflow-hidden rounded-xl border-2 border-slate-900 bg-slate-50">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.imageAlt ?? product.name}
                  width={160}
                  height={160}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-primary/40">
                  <PremiumIcon name={iconName} className="h-6 w-6" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-2xl bg-slate-50">
            <div className="relative aspect-square w-full">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.imageAlt ?? product.name}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-contain"
                  unoptimized
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-[2rem] bg-gradient-to-br from-primary/10 to-primary/5 p-16 text-primary/40">
                    <PremiumIcon name={iconName} className="h-24 w-24" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: purchase panel ── */}
        <div>
          <ProductDetailPurchase product={product} />
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 border-t border-slate-100 pt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#0c1712] text-balance">
                You may also like
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Explore more fresh picks from our collection.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline transition-all duration-300"
            >
              View all products
              <PremiumIcon name="chevron-right" className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
