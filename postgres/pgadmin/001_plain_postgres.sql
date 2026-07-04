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

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text,
  full_name text not null,
  phone text,
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.auth_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  success boolean not null default false,
  failure_reason text,
  attempted_at timestamptz not null default timezone('utc', now())
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, role)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email citext,
  phone text,
  role text not null default 'cashier'
    check (role in ('admin', 'manager', 'cashier', 'inventory', 'support')),
  status text not null default 'active'
    check (status in ('active', 'on_leave', 'inactive')),
  pay_type text not null default 'salary'
    check (pay_type in ('salary', 'hourly', 'commission')),
  salary_amount numeric(12, 2) not null default 0 check (salary_amount >= 0),
  hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  work_days text[] not null default '{}',
  shift_start time,
  shift_end time,
  start_date date,
  emergency_contact text,
  address text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  updated_at timestamptz not null default timezone('utc', now())
);

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
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_profile_id uuid references public.profiles (id) on delete set null,
  opened_by_profile_id uuid references public.profiles (id) on delete set null,
  closed_by_profile_id uuid references public.profiles (id) on delete set null,
  cashier_name text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cash numeric(12, 2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12, 2) check (closing_cash is null or closing_cash >= 0),
  expected_cash numeric(12, 2),
  cash_difference numeric(12, 2),
  cash_sales_amount numeric(12, 2) not null default 0,
  card_sales_amount numeric(12, 2) not null default 0,
  qr_sales_amount numeric(12, 2) not null default 0,
  total_sales_amount numeric(12, 2) not null default 0,
  order_count integer not null default 0,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  customer_id uuid references public.customers (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  cashier_profile_id uuid references public.profiles (id) on delete set null,
  pos_shift_id uuid references public.pos_shifts (id) on delete set null,
  channel public.sale_channel not null default 'pos',
  status public.order_status not null default 'completed',
  payment_status public.payment_status not null default 'paid',
  subtotal_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  shipping_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  quantity_delta integer not null,
  movement_type public.inventory_movement_type not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_movements_quantity_nonzero check (quantity_delta <> 0)
);

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

create index idx_auth_sessions_token_hash on public.auth_sessions (token_hash);
create index idx_auth_sessions_profile_id on public.auth_sessions (profile_id);
create index idx_auth_login_attempts_email_failed
  on public.auth_login_attempts (email_hash, attempted_at desc)
  where success = false;
create index idx_auth_login_attempts_ip_failed
  on public.auth_login_attempts (ip_hash, attempted_at desc)
  where success = false and ip_hash is not null;
create index idx_user_roles_profile_id on public.user_roles (profile_id);
create index idx_employees_profile_id on public.employees (profile_id);
create unique index idx_employees_profile_id_unique
  on public.employees (profile_id)
  where profile_id is not null;
create index idx_employees_role_status on public.employees (role, status);
create index idx_employees_email on public.employees (email);
create index idx_products_active_created_at on public.products (is_active, created_at desc) where deleted_at is null;
create index idx_products_low_stock on public.products (stock_quantity, low_stock_threshold) where deleted_at is null;
create index idx_pos_shifts_status_opened_at on public.pos_shifts (status, opened_at desc);
create index idx_pos_shifts_cashier_profile_status on public.pos_shifts (cashier_profile_id, status);
create index idx_orders_created_at on public.orders (created_at desc);
create index idx_orders_pos_shift_id on public.orders (pos_shift_id);
create index idx_payments_order_id on public.payments (order_id);
create index idx_payments_status_method on public.payments (status, method);
create index idx_loyalty_transactions_customer_created_at on public.loyalty_transactions (customer_id, created_at desc);
create index idx_loyalty_transactions_order_id on public.loyalty_transactions (order_id);
create unique index uniq_loyalty_earned_order
  on public.loyalty_transactions (order_id)
  where transaction_type = 'earned' and order_id is not null;
create index idx_inventory_movements_product_created_at on public.inventory_movements (product_id, created_at desc);

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger set_user_roles_updated_at before update on public.user_roles
for each row execute function public.set_updated_at();
create trigger set_employees_updated_at before update on public.employees
for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger set_suppliers_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger set_product_images_updated_at before update on public.product_images
for each row execute function public.set_updated_at();
create trigger set_customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger set_pos_shifts_updated_at before update on public.pos_shifts
for each row execute function public.set_updated_at();
create trigger set_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger set_order_items_updated_at before update on public.order_items
for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger set_loyalty_transactions_updated_at before update on public.loyalty_transactions
for each row execute function public.set_updated_at();
create trigger award_loyalty_points_on_paid_payment
after insert or update of status, order_id on public.payments
for each row execute function public.award_order_loyalty_points_from_payment();
create trigger award_loyalty_points_on_paid_order_update
after update of payment_status, status, customer_id, total_amount on public.orders
for each row execute function public.award_order_loyalty_points_from_order();
create trigger set_inventory_movements_updated_at before update on public.inventory_movements
for each row execute function public.set_updated_at();
create trigger set_audit_logs_updated_at before update on public.audit_logs
for each row execute function public.set_updated_at();
