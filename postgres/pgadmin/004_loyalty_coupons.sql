-- Loyalty coupons: customers convert loyalty points into a discount coupon.
-- 50 points -> 10% off, 100 points -> 30% off (see lib/services/loyalty.ts).

create table if not exists public.loyalty_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  discount_percent integer not null check (discount_percent between 1 and 100),
  points_spent integer not null default 0,
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired')),
  expires_at timestamptz,
  redeemed_order_id uuid references public.orders (id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_loyalty_coupons_customer
  on public.loyalty_coupons (customer_id, status);

create index if not exists idx_loyalty_coupons_code
  on public.loyalty_coupons (code);

drop trigger if exists set_loyalty_coupons_updated_at on public.loyalty_coupons;
create trigger set_loyalty_coupons_updated_at
before update on public.loyalty_coupons
for each row execute procedure public.set_updated_at();
