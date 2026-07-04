import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ProductCard } from "@/components/storefront/product-card";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Badge } from "@/components/ui/badge";
import { getCategoryIconName, type PremiumIconName } from "@/lib/premium-icons";
import { listCategories, listProducts } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_VISUALS: Record<
  string,
  {
    iconName: PremiumIconName;
    accent: string;
    gradient: string;
    fallbackLabel: string;
  }
> = {
  "coffee-tea": {
    iconName: "coffee",
    accent: "border-teal-200/60 bg-gradient-to-br from-teal-50/90 to-emerald-50/60",
    gradient: "from-teal-500 to-emerald-600",
    fallbackLabel: "drinks",
  },
  bakery: {
    iconName: "bakery",
    accent: "border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-orange-50/60",
    gradient: "from-amber-500 to-orange-500",
    fallbackLabel: "fresh items",
  },
  accessories: {
    iconName: "accessories",
    accent: "border-sky-200/60 bg-gradient-to-br from-sky-50/90 to-blue-50/60",
    gradient: "from-sky-500 to-blue-600",
    fallbackLabel: "products",
  },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categorySlug } = await searchParams;
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const activeCategory = categories.find((category) => category.slug === categorySlug) ?? null;
  
  const visibleProducts = activeCategory
    ? products.filter((product) => product.category?.id === activeCategory.id)
    : products;

  // Build category cards with product counts
  const categoryCards = categories.map((category) => {
    const matchingProducts = products.filter((product) => product.category?.id === category.id);
    const lowestPrice = matchingProducts.reduce(
      (minimum, product) => Math.min(minimum, product.price),
      Number.POSITIVE_INFINITY,
    );
    const visual = CATEGORY_VISUALS[category.slug] ?? {
      iconName: getCategoryIconName(category.name, category.visualIcon),
      accent: "border-slate-200 bg-slate-50",
      gradient: "from-slate-500 to-slate-600",
      fallbackLabel: "items",
    };

    return {
      ...category,
      iconName: visual.iconName,
      accent: visual.accent,
      gradient: visual.gradient,
      count: matchingProducts.length,
      countLabel: `${matchingProducts.length} ${visual.fallbackLabel}`,
      priceLabel:
        Number.isFinite(lowestPrice) && matchingProducts.length > 0
          ? `From ${formatCurrency(lowestPrice)}`
          : "Fresh picks daily",
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 py-12">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0c1712] to-[#0a1f1a] px-8 py-14 shadow-[var(--shadow-elevated)] sm:px-12 sm:py-20">
        {/* Ambient glow */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-amber-400/15 blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noise\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noise)\"/%3E%3C/svg%3E')" }} />
        
        <div className="relative text-white">
          <div className="[&_.text-primary]:text-white/90 [&_.bg-primary\/40]:bg-white/40">
            <PageHeader
              eyebrow={activeCategory ? activeCategory.name : "Browse Categories"}
              title={activeCategory ? `${activeCategory.name} favorites` : "What are you craving today?"}
              description={
                activeCategory
                  ? `Browse ${activeCategory.name.toLowerCase()} picks prepared for quick pickup or an easy break in the cafe.`
                  : "Select a category to explore our menu of specialty drinks, fresh bakes, and cafe extras."
              }
            />
          </div>
        </div>
      </div>

      {/* Category Navigation - shown when no category selected */}
      {!activeCategory && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categoryCards.map((category, i) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className={`animate-in delay-${i + 1} group relative overflow-hidden rounded-[2rem] ${category.accent} border p-8 shadow-[var(--shadow-card)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-[var(--shadow-elevated)] hover:border-primary/20`}
            >
              {/* Gradient orb behind icon */}
              <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${category.gradient} opacity-[0.08] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.15]`} />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-black/[0.04] transition-transform duration-500 group-hover:scale-110">
                    <PremiumIcon name={category.iconName} className="h-7 w-7" />
                  </div>
                  <Badge variant="soft" size="sm">{category.count} items</Badge>
                </div>
                <h3 className="mt-6 font-serif text-2xl font-semibold tracking-tight text-[#0c1712]">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm text-muted">{category.countLabel}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-primary">
                  {category.priceLabel}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-transform duration-300 group-hover:translate-x-1">
                  Browse {category.name}
                  <PremiumIcon name="chevron-right" className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          {activeCategory ? (
            <Link 
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition-colors"
            >
              <PremiumIcon name="arrow-right" className="h-4 w-4 rotate-180" />
              Back to categories
            </Link>
          ) : (
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#0c1712]">
              All products
            </h2>
          )}
          <Badge variant="primary" size="md">{visibleProducts.length} items</Badge>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product, i) => (
            <div key={product.id} className={`animate-in delay-${(i % 4) + 1}`}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
