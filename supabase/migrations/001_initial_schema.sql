-- =========================================================
-- Tisa POS Commerce
-- Initial schema for a combined POS and ecommerce system.
-- =========================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum ('admin', 'cashier', 'customer', 'clerk', 'manager');
create type public.order_status as enum (
  'draft',
  'pending',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
  'refunded'
);
create type public.payment_status as enum (
  'unpaid',
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);
create type public.payment_method as enum (
  'cash',
  'card',
  'qr',
  'bank_transfer',
  'cash_on_delivery'
);
create type public.inventory_movement_type as enum (
  'sale',
  'restock',
  'adjustment',
  'return',
  'initial_stock'
);
create type public.discount_type as enum ('percentage', 'fixed_amount');
create type public.sale_channel as enum ('pos', 'ecommerce');

create sequence if not exists public.order_number_seq start 10001;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'ORD-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' ||
         lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

-- profiles is the app-side identity mirror for auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.profiles is
  'One-to-one app profile for auth.users. Related rows in user_roles, customers, carts, orders, and audit_logs connect back to profiles.';

-- user_roles supports role-based access for admin, cashier, and customer accounts.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, role)
);
comment on table public.user_roles is
  'Role assignments for each profile. Policies and server logic use this table to distinguish admin, cashier, and customer permissions.';

-- categories organize products for both the storefront and admin catalog.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_length check (char_length(name) >= 2)
);
comment on table public.categories is
  'Product grouping table. products.category_id points here so both ecommerce browsing and POS search share the same taxonomy.';

-- suppliers store purchasing-side contact details for stocked products.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email citext,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.suppliers is
  'Supplier master data. products.supplier_id links a sellable item back to the vendor used for purchasing and restocking.';

-- customers can exist with or without auth-backed profiles for walk-in or registered buyers.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  email citext,
  phone text,
  notes text,
  loyalty_points integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customers_loyalty_points_nonnegative check (loyalty_points >= 0)
);
comment on table public.customers is
  'Customer directory used by storefront users and POS staff. orders.customer_id can point here for either registered or walk-in customers.';

-- addresses store reusable shipping or billing addresses for profiles or customer records.
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  line_1 text not null,
  line_2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'Cambodia',
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint addresses_owner_check check (profile_id is not null or customer_id is not null)
);
comment on table public.addresses is
  'Reusable addresses owned by a profile or customer. orders.address_id points here while shipping fields on orders snapshot the address at purchase time.';

-- coupons are applied at checkout and referenced by orders and carts.
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric(12, 2) not null,
  min_order_amount numeric(12, 2),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  times_redeemed integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coupons_discount_value_nonnegative check (discount_value >= 0),
  constraint coupons_redemption_counts_nonnegative check (
    coalesce(max_redemptions, 0) >= 0 and times_redeemed >= 0
  )
);
comment on table public.coupons is
  'Promotional discounts available to ecommerce checkout and future POS campaigns. orders.coupon_id and carts.coupon_id reference this table.';

-- products are shared inventory items used by both storefront and POS.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  sku text not null unique,
  barcode text unique,
  price numeric(12, 2) not null,
  cost numeric(12, 2) not null,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_name_length check (char_length(name) >= 2),
  constraint products_price_nonnegative check (price >= 0),
  constraint products_cost_nonnegative check (cost >= 0),
  constraint products_stock_nonnegative check (stock_quantity >= 0),
  constraint products_low_stock_threshold_nonnegative check (low_stock_threshold >= 0)
);
comment on table public.products is
  'Core sellable item table. Linked to categories, suppliers, product_images, cart_items, order_items, and inventory_movements.';

-- product_images stores one-to-many media entries for storefront product presentation.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  public_url text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.product_images is
  'Image metadata for products. A product can have many images; the storefront usually prefers the primary image first.';

-- carts track active ecommerce baskets for authenticated customer profiles.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel public.sale_channel not null default 'ecommerce',
  status text not null default 'active',
  coupon_id uuid references public.coupons (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint carts_status_check check (status in ('active', 'checked_out', 'abandoned'))
);
comment on table public.carts is
  'Active ecommerce carts for logged-in customers. cart_items belongs to carts, and checkout converts cart contents into orders.';

-- cart_items capture the products and prices currently staged in a cart.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cart_items_quantity_positive check (quantity > 0),
  constraint cart_items_unit_price_nonnegative check (unit_price >= 0),
  unique (cart_id, product_id)
);
comment on table public.cart_items is
  'Line items inside a cart. Each row points to one cart and one product and captures a unit_price snapshot for the current basket.';

-- orders are the shared sales header for both POS and ecommerce transactions.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  channel public.sale_channel not null,
  profile_id uuid references public.profiles (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  cashier_profile_id uuid references public.profiles (id) on delete set null,
  coupon_id uuid references public.coupons (id) on delete set null,
  address_id uuid references public.addresses (id) on delete set null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  subtotal_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  shipping_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  shipping_name text,
  shipping_phone text,
  shipping_line_1 text,
  shipping_line_2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint orders_subtotal_nonnegative check (subtotal_amount >= 0),
  constraint orders_discount_nonnegative check (discount_amount >= 0),
  constraint orders_tax_nonnegative check (tax_amount >= 0),
  constraint orders_shipping_nonnegative check (shipping_amount >= 0),
  constraint orders_total_nonnegative check (total_amount >= 0)
);
comment on table public.orders is
  'Shared order header for POS and ecommerce. order_items, payments, and inventory_movements roll up under an order.';

-- order_items snapshot product details at the time of sale.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonnegative check (unit_price >= 0),
  constraint order_items_unit_cost_nonnegative check (unit_cost >= 0),
  constraint order_items_discount_nonnegative check (discount_amount >= 0),
  constraint order_items_line_total_nonnegative check (line_total >= 0)
);
comment on table public.order_items is
  'Order lines for a sale. Each row belongs to one order and one product, preserving item-level pricing even if the product changes later.';

-- payments record settlement attempts or completed payments against orders.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12, 2) not null,
  reference_number text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_amount_nonnegative check (amount >= 0)
);
comment on table public.payments is
  'Payment records for orders. Multiple payments could exist later, but the MVP stores one primary payment entry per order.';

-- loyalty_transactions records every customer point movement.
create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  transaction_type text not null,
  points_delta integer not null,
  balance_after integer,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint loyalty_transactions_type_check check (
    transaction_type in ('earned', 'redeemed', 'adjusted', 'reversed')
  ),
  constraint loyalty_transactions_points_nonzero check (points_delta <> 0)
);
comment on table public.loyalty_transactions is
  'Immutable-ish ledger for customer loyalty point changes. Earned rows are created automatically from paid orders.';

create or replace function public.award_order_loyalty_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_points integer;
  v_transaction_id uuid;
  v_balance_after integer;
begin
  select
    o.id,
    o.customer_id,
    o.profile_id,
    o.cashier_profile_id,
    o.order_number,
    o.status,
    o.payment_status,
    o.total_amount,
    exists (
      select 1
      from public.payments p
      where p.order_id = o.id
        and p.status = 'paid'
    ) as has_paid_payment
  into v_order
  from public.orders o
  where o.id = p_order_id
  limit 1;

  if not found then
    return;
  end if;

  if v_order.customer_id is null then
    return;
  end if;

  if v_order.status in ('cancelled', 'refunded') then
    return;
  end if;

  if v_order.payment_status <> 'paid' and not v_order.has_paid_payment then
    return;
  end if;

  v_points := floor(greatest(coalesce(v_order.total_amount, 0), 0))::integer;

  if v_points <= 0 then
    return;
  end if;

  insert into public.loyalty_transactions (
    customer_id,
    order_id,
    created_by_profile_id,
    transaction_type,
    points_delta,
    description
  )
  values (
    v_order.customer_id,
    v_order.id,
    coalesce(v_order.cashier_profile_id, v_order.profile_id),
    'earned',
    v_points,
    'Earned from order ' || coalesce(v_order.order_number, v_order.id::text)
  )
  on conflict do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    return;
  end if;

  update public.customers
  set loyalty_points = loyalty_points + v_points
  where id = v_order.customer_id
  returning loyalty_points into v_balance_after;

  update public.loyalty_transactions
  set balance_after = v_balance_after
  where id = v_transaction_id;
end;
$$;

create or replace function public.award_order_loyalty_points_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'paid' then
    perform public.award_order_loyalty_points(new.order_id);
  elsif tg_op = 'UPDATE'
    and new.status = 'paid'
    and (
      old.status is distinct from new.status
      or old.order_id is distinct from new.order_id
    )
  then
    perform public.award_order_loyalty_points(new.order_id);
  end if;

  return new;
end;
$$;

create or replace function public.award_order_loyalty_points_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
    and new.status not in ('cancelled', 'refunded')
    and (
      old.payment_status is distinct from new.payment_status
      or old.status is distinct from new.status
      or old.customer_id is distinct from new.customer_id
      or old.total_amount is distinct from new.total_amount
    )
  then
    perform public.award_order_loyalty_points(new.id);
  end if;

  return new;
end;
$$;

-- inventory_movements is the immutable stock ledger for sales, restocks, returns, and manual adjustments.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_movements_quantity_nonzero check (quantity_delta <> 0)
);
comment on table public.inventory_movements is
  'Stock ledger table. Sales create negative movements, restocks create positive movements, and every row links back to a product and optional order context.';

-- audit_logs captures important business actions for admin visibility and debugging.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.audit_logs is
  'Audit trail for high-value actions such as creating orders, adjusting stock, or changing core catalog data.';

create index idx_user_roles_profile_id on public.user_roles (profile_id);
create index idx_user_roles_role on public.user_roles (role);

create index idx_categories_parent_id on public.categories (parent_id);

create index idx_suppliers_active_name on public.suppliers (is_active, name);

create index idx_customers_profile_id on public.customers (profile_id);
create index idx_customers_email on public.customers (email);
create index idx_customers_phone on public.customers (phone);

create index idx_addresses_profile_id on public.addresses (profile_id);
create index idx_addresses_customer_id on public.addresses (customer_id);

create index idx_coupons_active_window on public.coupons (is_active, starts_at, ends_at);

create index idx_products_category_id on public.products (category_id);
create index idx_products_supplier_id on public.products (supplier_id);
create index idx_products_active_created_at on public.products (is_active, created_at desc)
  where deleted_at is null;
create index idx_products_low_stock on public.products (stock_quantity, low_stock_threshold)
  where deleted_at is null and is_active = true;

create index idx_product_images_product_id on public.product_images (product_id);
create index idx_product_images_primary on public.product_images (product_id, is_primary desc, sort_order asc);

create unique index uniq_active_ecommerce_cart_per_profile
  on public.carts (profile_id)
  where channel = 'ecommerce' and status = 'active';
create index idx_carts_profile_status on public.carts (profile_id, status);

create index idx_cart_items_cart_id on public.cart_items (cart_id);
create index idx_cart_items_product_id on public.cart_items (product_id);

create index idx_orders_profile_id_created_at on public.orders (profile_id, created_at desc);
create index idx_orders_customer_id_created_at on public.orders (customer_id, created_at desc);
create index idx_orders_cashier_profile_id_created_at on public.orders (cashier_profile_id, created_at desc);
create index idx_orders_channel_status_created_at on public.orders (channel, status, created_at desc);

create index idx_order_items_order_id on public.order_items (order_id);
create index idx_order_items_product_id on public.order_items (product_id);

create index idx_payments_order_id on public.payments (order_id);
create index idx_payments_status_method on public.payments (status, method);
create index idx_payments_paid_at on public.payments (paid_at desc);

create index idx_loyalty_transactions_customer_created_at
  on public.loyalty_transactions (customer_id, created_at desc);
create index idx_loyalty_transactions_order_id on public.loyalty_transactions (order_id);
create unique index uniq_loyalty_earned_order
  on public.loyalty_transactions (order_id)
  where transaction_type = 'earned' and order_id is not null;

create index idx_inventory_movements_product_created_at
  on public.inventory_movements (product_id, created_at desc);
create index idx_inventory_movements_order_id on public.inventory_movements (order_id);
create index idx_inventory_movements_actor_profile_id on public.inventory_movements (actor_profile_id);

create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor_created_at on public.audit_logs (actor_profile_id, created_at desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute procedure public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row execute procedure public.set_updated_at();

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

create trigger set_addresses_updated_at
before update on public.addresses
for each row execute procedure public.set_updated_at();

create trigger set_coupons_updated_at
before update on public.coupons
for each row execute procedure public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create trigger set_product_images_updated_at
before update on public.product_images
for each row execute procedure public.set_updated_at();

create trigger set_carts_updated_at
before update on public.carts
for each row execute procedure public.set_updated_at();

create trigger set_cart_items_updated_at
before update on public.cart_items
for each row execute procedure public.set_updated_at();

create trigger set_orders_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

create trigger set_order_items_updated_at
before update on public.order_items
for each row execute procedure public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute procedure public.set_updated_at();

create trigger set_loyalty_transactions_updated_at
before update on public.loyalty_transactions
for each row execute procedure public.set_updated_at();

create trigger award_loyalty_points_on_paid_payment
after insert or update of status, order_id on public.payments
for each row execute procedure public.award_order_loyalty_points_from_payment();

create trigger award_loyalty_points_on_paid_order_update
after update of payment_status, status, customer_id, total_amount on public.orders
for each row execute procedure public.award_order_loyalty_points_from_order();

create trigger set_inventory_movements_updated_at
before update on public.inventory_movements
for each row execute procedure public.set_updated_at();

create trigger set_audit_logs_updated_at
before update on public.audit_logs
for each row execute procedure public.set_updated_at();

create or replace function public.has_role(check_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where profile_id = auth.uid()
      and role = check_role
  );
$$;

create or replace function public.record_audit_log(
  p_actor_profile_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  )
  values (
    p_actor_profile_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_before_data,
    p_after_data
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role public.user_role;
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone;

  if new.raw_user_meta_data ? 'role' then
    begin
      v_requested_role := lower(new.raw_user_meta_data ->> 'role')::public.user_role;
    exception when invalid_text_representation then
      v_requested_role := null;
    end;
  end if;

  if v_requested_role in ('admin', 'cashier') then
    insert into public.user_roles (profile_id, role)
    values (new.id, v_requested_role)
    on conflict (profile_id, role) do nothing;
  else
    insert into public.user_roles (profile_id, role)
    values (new.id, 'customer')
    on conflict (profile_id, role) do nothing;
  end if;

  if coalesce(v_requested_role, 'customer'::public.user_role) = 'customer' then
    insert into public.customers (profile_id, full_name, email, phone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
      new.email,
      new.raw_user_meta_data ->> 'phone'
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.adjust_inventory_stock(
  p_actor_profile_id uuid,
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stock integer;
  v_new_stock integer;
  v_is_admin boolean := public.has_role('admin');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_admin then
    raise exception 'Only admins can perform direct stock adjustments';
  end if;

  if p_quantity_delta = 0 then
    raise exception 'Quantity delta cannot be zero';
  end if;

  select stock_quantity
  into v_current_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  v_new_stock := v_current_stock + p_quantity_delta;

  if v_new_stock < 0 then
    raise exception 'Inventory adjustment would make stock negative';
  end if;

  update public.products
  set stock_quantity = v_new_stock
  where id = p_product_id;

  insert into public.inventory_movements (
    product_id,
    actor_profile_id,
    movement_type,
    quantity_delta,
    reason
  )
  values (
    p_product_id,
    p_actor_profile_id,
    (
      case
      when p_quantity_delta > 0 then 'restock'
      else 'adjustment'
      end
    )::public.inventory_movement_type,
    p_quantity_delta,
    p_reason
  );

  perform public.record_audit_log(
    p_actor_profile_id,
    'products',
    p_product_id,
    'inventory_adjusted',
    jsonb_build_object('stock_quantity', v_current_stock),
    jsonb_build_object('stock_quantity', v_new_stock, 'reason', p_reason)
  );
end;
$$;

create or replace function public.create_order_with_items(
  p_sale_channel public.sale_channel,
  p_profile_id uuid default null,
  p_customer_id uuid default null,
  p_cashier_profile_id uuid default null,
  p_address_id uuid default null,
  p_payment_method public.payment_method default 'cash',
  p_coupon_code text default null,
  p_discount_amount numeric default 0,
  p_notes text default null,
  p_cart_id uuid default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_is_cashier boolean := public.has_role('cashier');
  v_profile_id uuid := p_profile_id;
  v_customer_id uuid := p_customer_id;
  v_cashier_profile_id uuid := p_cashier_profile_id;
  v_coupon public.coupons%rowtype;
  v_address public.addresses%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := greatest(coalesce(p_discount_amount, 0), 0);
  v_tax numeric(12, 2) := 0;
  v_shipping numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_status public.order_status;
  v_payment_status public.payment_status;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_order_item_id uuid;
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;

  if p_sale_channel = 'ecommerce' then
    v_profile_id := coalesce(p_profile_id, v_requester);

    if v_profile_id <> v_requester and not public.has_role('admin') then
      raise exception 'Customers can only create ecommerce orders for themselves';
    end if;
  end if;

  if p_sale_channel = 'pos' then
    if not v_is_cashier then
      raise exception 'Only cashier users can create POS orders';
    end if;

    v_cashier_profile_id := coalesce(p_cashier_profile_id, v_requester);
  end if;

  if v_customer_id is null and v_profile_id is not null then
    select id
    into v_customer_id
    from public.customers
    where profile_id = v_profile_id
    limit 1;
  end if;

  if p_address_id is not null then
    select *
    into v_address
    from public.addresses
    where id = p_address_id
      and (
        public.has_role('admin')
        or profile_id = v_profile_id
        or customer_id = v_customer_id
      )
    limit 1;

    if not found then
      raise exception 'Address not found or not accessible';
    end if;
  end if;

  if p_cart_id is not null and jsonb_array_length(v_items) = 0 then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'quantity', quantity
        )
      ),
      '[]'::jsonb
    )
    into v_items
    from public.cart_items
    where cart_id = p_cart_id;
  end if;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'At least one order item is required';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_quantity <= 0 then
      raise exception 'Order item quantity must be greater than zero';
    end if;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and is_active = true
      and deleted_at is null
    for update;

    if not found then
      raise exception 'Product % was not found or is inactive', v_item ->> 'product_id';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Insufficient stock for product %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select *
    into v_coupon
    from public.coupons
    where code = p_coupon_code
      and is_active = true
      and (starts_at is null or starts_at <= timezone('utc', now()))
      and (ends_at is null or ends_at >= timezone('utc', now()))
    limit 1;

    if not found then
      raise exception 'Coupon not found or inactive';
    end if;

    if v_coupon.min_order_amount is not null and v_subtotal < v_coupon.min_order_amount then
      raise exception 'Order total does not meet the coupon minimum';
    end if;

    if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
      raise exception 'Coupon redemption limit reached';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := v_discount + round(v_subtotal * (v_coupon.discount_value / 100), 2);
    else
      v_discount := v_discount + v_coupon.discount_value;
    end if;
  end if;

  v_discount := least(v_discount, v_subtotal);
  v_total := greatest(v_subtotal - v_discount + v_tax + v_shipping, 0);
  v_status := case
    when p_sale_channel = 'pos' then 'completed'
    when p_payment_method = 'cash_on_delivery' then 'pending'
    else 'paid'
  end;
  v_payment_status := case
    when p_payment_method = 'cash_on_delivery' then 'pending'
    else 'paid'
  end;

  insert into public.orders (
    id,
    order_number,
    channel,
    profile_id,
    customer_id,
    cashier_profile_id,
    coupon_id,
    address_id,
    status,
    payment_status,
    subtotal_amount,
    discount_amount,
    tax_amount,
    shipping_amount,
    total_amount,
    notes,
    shipping_name,
    shipping_phone,
    shipping_line_1,
    shipping_line_2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country
  )
  values (
    v_order_id,
    public.generate_order_number(),
    p_sale_channel,
    v_profile_id,
    v_customer_id,
    v_cashier_profile_id,
    v_coupon.id,
    v_address.id,
    v_status,
    v_payment_status,
    v_subtotal,
    v_discount,
    v_tax,
    v_shipping,
    v_total,
    p_notes,
    v_address.recipient_name,
    v_address.phone,
    v_address.line_1,
    v_address.line_2,
    v_address.city,
    v_address.state,
    v_address.postal_code,
    v_address.country
  );

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
    for update;

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;

    v_order_item_id := gen_random_uuid();

    insert into public.order_items (
      id,
      order_id,
      product_id,
      product_name,
      sku,
      quantity,
      unit_price,
      unit_cost,
      discount_amount,
      line_total
    )
    values (
      v_order_item_id,
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.sku,
      v_quantity,
      v_product.price,
      v_product.cost,
      0,
      v_product.price * v_quantity
    );

    insert into public.inventory_movements (
      product_id,
      order_id,
      order_item_id,
      actor_profile_id,
      movement_type,
      quantity_delta,
      reason
    )
    values (
      v_product.id,
      v_order_id,
      v_order_item_id,
      coalesce(v_cashier_profile_id, v_profile_id, v_requester),
      'sale',
      -v_quantity,
      case
        when p_sale_channel = 'pos' then 'POS sale completed'
        else 'Ecommerce order placed'
      end
    );
  end loop;

  insert into public.payments (
    order_id,
    method,
    status,
    amount,
    paid_at,
    metadata
  )
  values (
    v_order_id,
    p_payment_method,
    v_payment_status,
    v_total,
    case when v_payment_status = 'paid' then timezone('utc', now()) else null end,
    jsonb_build_object(
      'channel', p_sale_channel,
      'cart_id', p_cart_id
    )
  );

  if v_coupon.id is not null then
    update public.coupons
    set times_redeemed = times_redeemed + 1
    where id = v_coupon.id;
  end if;

  if p_cart_id is not null then
    update public.carts
    set status = 'checked_out',
        coupon_id = coalesce(v_coupon.id, coupon_id)
    where id = p_cart_id;
  end if;

  perform public.record_audit_log(
    coalesce(v_cashier_profile_id, v_profile_id, v_requester),
    'orders',
    v_order_id,
    'created',
    null,
    jsonb_build_object(
      'channel', p_sale_channel,
      'total_amount', v_total,
      'payment_method', p_payment_method
    )
  );

  return v_order_id;
end;
$$;

grant execute on function public.has_role(public.user_role) to authenticated, anon;
grant execute on function public.adjust_inventory_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.create_order_with_items(
  public.sale_channel,
  uuid,
  uuid,
  uuid,
  uuid,
  public.payment_method,
  text,
  numeric,
  text,
  uuid,
  jsonb
) to authenticated;
