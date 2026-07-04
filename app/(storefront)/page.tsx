import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { Button } from "@/components/ui/button";
import { PremiumIcon } from "@/components/ui/premium-icon";
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

const TESTIMONIALS = [
  {
    quote: "The Khmer Milk Tea is the best in Phnom Penh!",
    author: "Rina Sok",
    role: "Regular Customer",
    avatar: "RS",
  },
  {
    quote: "Fast pickup, friendly staff, and the croissants are always worth the stop.",
    author: "Vannak Yim",
    role: "Morning Commuter",
    avatar: "VY",
  },
  {
    quote: "Tisa is my go-to spot when I need coffee and a gift in one stop.",
    author: "Sophea Lin",
    role: "Weekend Guest",
    avatar: "SL",
  },
];

export default async function HomePage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const featuredProducts = products.slice(0, 8);
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
      countLabel: `${matchingProducts.length} ${visual.fallbackLabel}`,
      priceLabel:
        Number.isFinite(lowestPrice) && matchingProducts.length > 0
          ? `From ${formatCurrency(lowestPrice)}`
          : "Fresh picks daily",
    };
  });

  return (
    <div className="bg-[#fafaf9] [--store-accent:theme(colors.teal.600)] [--store-accent-light:theme(colors.teal.50)]">
      {/* ─── Hero ─────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(5,32,28,0.94), rgba(13,148,136,0.72), rgba(10,60,52,0.88)), url('https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        {/* Ambient glow orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-400/20 blur-[100px]" />
          <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-amber-400/15 blur-[80px]" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/12 blur-[90px]" />
        </div>
        {/* Subtle grain overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noise\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noise)\"/%3E%3C/svg%3E')" }} />

        <div className="relative mx-auto flex min-h-[calc(100vh-88px)] max-w-7xl items-center px-6 py-20">
          <div className="max-w-3xl text-white">
            <div className="animate-in inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-md">
              <PremiumIcon name="coffee" className="h-4 w-4" />
              <span>Fresh daily · Phnom Penh</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-[pulse-soft_2s_ease-in-out_infinite]" />
            </div>

            <h1 className="animate-in delay-1 mt-8 max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl xl:text-[4.5rem]">
              Good coffee.
              <br />
              Good food.
              <br />
              <span className="bg-gradient-to-r from-white via-teal-100 to-amber-100 bg-clip-text text-transparent">
                Made for you.
              </span>
            </h1>

            <p className="animate-in delay-2 mt-7 max-w-2xl text-lg leading-8 text-white/75 md:text-xl">
              Order online or visit us in store. Fresh bakes and specialty drinks crafted every morning.
            </p>

            <div className="animate-in delay-3 mt-10 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-[3.25rem] rounded-full bg-white px-7 text-[#0c1712] shadow-[0_4px_24px_-8px_rgba(255,255,255,0.3)] hover:bg-white/90 hover:shadow-[0_8px_32px_-8px_rgba(255,255,255,0.4)]"
              >
                <Link href="/shop" className="inline-flex items-center gap-2.5">
                  <PremiumIcon name="cart" className="h-5 w-5" />
                  Order Now
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-[3.25rem] rounded-full border border-white/20 bg-white/[0.06] px-7 text-white backdrop-blur-sm hover:bg-white/[0.12] hover:text-white hover:border-white/30"
              >
                <Link href="/shop">View Menu</Link>
              </Button>
            </div>

            <div className="animate-in delay-4 mt-14 grid gap-3 text-sm text-white/85 sm:grid-cols-3">
              <TrustBadge iconName="fast" label="Fast service" />
              <TrustBadge iconName="fresh" label="Fresh daily" />
              <TrustBadge iconName="rated" label="4.9 rated" />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#fafaf9] to-transparent" />
      </section>

      {/* ─── Social-proof stats ────────────── */}
      <section className="relative -mt-12 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="relative grid gap-4 rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <StatBlock value="4.9/5" label="Customer rating" iconName="rated" />
            <StatBlock value="8k+" label="Cups brewed weekly" iconName="coffee" />
            <StatBlock value="3 min" label="Avg pickup time" iconName="fast" />
            <StatBlock value="Daily" label="Fresh bakes in store" iconName="bakery" />
          </div>
        </div>
      </section>

      {/* ─── Categories ───────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
              <span className="inline-block h-px w-8 bg-teal-500/40" />
              Browse by Category
            </p>
            <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0c1712]">
              Pick your favorite corner of the menu
            </h2>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {categoryCards.map((category, i) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className={`animate-in delay-${i + 1} group relative overflow-hidden rounded-[2rem] ${category.accent} border p-8 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-elevated)]`}
            >
              {/* Gradient orb behind icon */}
              <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${category.gradient} opacity-[0.08] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.15]`} />

              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm ring-1 ring-black/[0.04]">
                  <PremiumIcon name={category.iconName} className="h-7 w-7" />
                </div>
                <h3 className="mt-8 font-serif text-3xl font-semibold tracking-tight text-[#0c1712]">
                  {category.name}
                </h3>
                <p className="mt-3 text-sm text-muted">{category.countLabel}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-teal-600">
                  {category.priceLabel}
                </p>
                <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 transition-transform duration-300 group-hover:translate-x-1">
                  Shop Now
                  <PremiumIcon name="chevron-right" className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Featured Products ────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
              <span className="inline-block h-px w-8 bg-teal-500/40" />
              Featured Items
            </p>
            <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0c1712]">
              Our regulars keep coming back for these
            </h2>
          </div>
          <Link href="/shop" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            View all
            <PremiumIcon name="chevron-right" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ─── Why Choose Us ────────────────────── */}
      <section id="about" className="mt-20 relative overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#f0fdf4] via-[#f2faf6] to-[#fef9ef]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noise\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noise)\"/%3E%3C/svg%3E')" }} />

        <div className="relative mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
              <span className="inline-block h-px w-8 bg-teal-500/40" />
              Why choose us
              <span className="inline-block h-px w-8 bg-teal-500/40" />
            </p>
            <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0c1712]">
              Made for daily rituals and quick pick-ups
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <WhyCard
              iconName="coffee"
              title="Specialty Coffee"
              description="Sourced from Mekong Beans Co. for a smooth, rich cup every day."
              index={0}
            />
            <WhyCard
              iconName="bakery"
              title="Fresh Baked Daily"
              description="Made every morning by City Bakery Hub while the ovens are still warm."
              index={1}
            />
            <WhyCard
              iconName="rocket"
              title="Fast Pickup"
              description="Ready in minutes at the counter when your schedule needs something easy."
              index={2}
            />
            <WhyCard
              iconName="heart"
              title="Loyalty Rewards"
              description="Earn points on every purchase and turn regular visits into better perks."
              index={3}
            />
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-600">
            <span className="inline-block h-px w-8 bg-teal-500/40" />
            What our customers say
            <span className="inline-block h-px w-8 bg-teal-500/40" />
          </p>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0c1712]">
            Warm words from familiar faces
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.author}
              className="group rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex gap-1.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <PremiumIcon key={index} name="rated" className="h-4 w-4" />
                ))}
              </div>
              <p className="mt-5 font-serif text-[1.35rem] leading-9 text-[#0c1712]">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/20 to-teal-500/5 text-sm font-semibold text-teal-700">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0c1712]">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-muted">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustBadge({ iconName, label }: { iconName: PremiumIconName; label: string }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] px-5 py-3 backdrop-blur-md">
      <PremiumIcon name={iconName} className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function WhyCard({
  description,
  iconName,
  title,
  index,
}: {
  description: string;
  iconName: PremiumIconName;
  title: string;
  index: number;
}) {
  return (
    <div className={`animate-in delay-${index + 1} group rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:border-teal-200/40 hover:shadow-[var(--shadow-elevated)]`}>
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/5 text-teal-600 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[-4deg]">
        <PremiumIcon name={iconName} className="h-6 w-6" />
      </div>
      <h3 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-[#0c1712]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
    </div>
  );
}

function StatBlock({
  value,
  label,
  iconName,
}: {
  value: string;
  label: string;
  iconName: PremiumIconName;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors duration-300 hover:bg-primary/[0.04]">
      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/15 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/10 transition-transform duration-300 group-hover:scale-105">
        <PremiumIcon name={iconName} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-serif text-2xl font-semibold tracking-tight text-[#0c1712]">
          {value}
        </p>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}
