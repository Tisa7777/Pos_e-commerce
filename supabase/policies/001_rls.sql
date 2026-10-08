-- =========================================================
-- Coffee Shop POS Commerce RLS policies
-- =========================================================
-- Auth/profile sync guidance:
-- - public.handle_new_user() in the migration mirrors auth.users into public.profiles.
-- - New signups get a default customer role automatically.
-- - Staff roles should be assigned manually by an admin after the auth user exists.
--
-- Storage guidance:
-- - product-images: public read, admin write/update/delete.
-- - receipt-assets: private bucket for staff-managed receipt snapshots or PDFs.

create or replace function public.owns_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = p_customer_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.owns_cart(p_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.carts
    where id = p_cart_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    left join public.customers c on c.id = o.customer_id
    where o.id = p_order_id
      and (
        o.profile_id = auth.uid()
        or c.profile_id = auth.uid()
      )
  );
$$;

create or replace function public.owns_address(p_address_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.addresses a
    left join public.customers c on c.id = a.customer_id
    where a.id = p_address_id
      and (
        a.profile_id = auth.uid()
        or c.profile_id = auth.uid()
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.coupons enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.employees enable row level security;

create policy "Admins manage profiles"
on public.profiles
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Admins manage user roles"
on public.user_roles
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Users read own roles"
on public.user_roles
for select
to authenticated
using (profile_id = auth.uid());

create policy "Public read active categories"
on public.categories
for select
to anon, authenticated
using (is_active = true);

create policy "Admins manage categories"
on public.categories
for all
to authenticated
using (public.has_role('admin') or public.has_role('clerk'))
with check (public.has_role('admin') or public.has_role('clerk'));

create policy "Public read active products"
on public.products
for select
to anon, authenticated
using (is_active = true and deleted_at is null);

create policy "Staff read all products"
on public.products
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier') or public.has_role('clerk') or public.has_role('manager'));

create policy "Admins manage products"
on public.products
for all
to authenticated
using (public.has_role('admin') or public.has_role('clerk'))
with check (public.has_role('admin') or public.has_role('clerk'));

create policy "Public read active product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.is_active = true
      and p.deleted_at is null
  )
);

create policy "Staff read all product images"
on public.product_images
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier') or public.has_role('clerk') or public.has_role('manager'));

create policy "Admins manage product images"
on public.product_images
for all
to authenticated
using (public.has_role('admin') or public.has_role('clerk'))
with check (public.has_role('admin') or public.has_role('clerk'));

create policy "Staff read suppliers"
on public.suppliers
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier') or public.has_role('clerk') or public.has_role('manager'));

create policy "Admins manage suppliers"
on public.suppliers
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers read own customer record"
on public.customers
for select
to authenticated
using (profile_id = auth.uid());

create policy "Customers update own customer record"
on public.customers
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Staff read customers"
on public.customers
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage customers"
on public.customers
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers read own loyalty transactions"
on public.loyalty_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = loyalty_transactions.customer_id
      and c.profile_id = auth.uid()
  )
);

create policy "Staff read loyalty transactions"
on public.loyalty_transactions
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage loyalty transactions"
on public.loyalty_transactions
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Staff read employees"
on public.employees
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage employees"
on public.employees
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers manage own addresses"
on public.addresses
for all
to authenticated
using (public.owns_address(id))
with check (
  profile_id = auth.uid()
  or public.owns_customer(customer_id)
);

create policy "Staff read addresses"
on public.addresses
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage addresses"
on public.addresses
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Public read active coupons"
on public.coupons
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= timezone('utc', now()))
  and (ends_at is null or ends_at >= timezone('utc', now()))
);

create policy "Admins manage coupons"
on public.coupons
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers manage own carts"
on public.carts
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Admins manage carts"
on public.carts
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers manage own cart items"
on public.cart_items
for all
to authenticated
using (public.owns_cart(cart_id))
with check (public.owns_cart(cart_id));

create policy "Admins manage cart items"
on public.cart_items
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers read own orders"
on public.orders
for select
to authenticated
using (public.owns_order(id));

create policy "Staff read orders"
on public.orders
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage orders"
on public.orders
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers read own order items"
on public.order_items
for select
to authenticated
using (public.owns_order(order_id));

create policy "Staff read order items"
on public.order_items
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage order items"
on public.order_items
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Customers read own payments"
on public.payments
for select
to authenticated
using (public.owns_order(order_id));

create policy "Staff read payments"
on public.payments
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier'));

create policy "Admins manage payments"
on public.payments
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "Staff read inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.has_role('admin') or public.has_role('cashier') or public.has_role('clerk') or public.has_role('manager'));

create policy "Admins manage inventory movements"
on public.inventory_movements
for all
to authenticated
using (public.has_role('admin') or public.has_role('clerk'))
with check (public.has_role('admin') or public.has_role('clerk'));

create policy "Admins read audit logs"
on public.audit_logs
for select
to authenticated
using (public.has_role('admin'));

create policy "Admins manage audit logs"
on public.audit_logs
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('receipt-assets', 'receipt-assets', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

create policy "Public read product image objects"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

create policy "Admins manage product image objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'product-images'
  and (public.has_role('admin') or public.has_role('clerk'))
)
with check (
  bucket_id = 'product-images'
  and (public.has_role('admin') or public.has_role('clerk'))
);

create policy "Staff manage receipt assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'receipt-assets'
  and (public.has_role('admin') or public.has_role('cashier'))
)
with check (
  bucket_id = 'receipt-assets'
  and (public.has_role('admin') or public.has_role('cashier'))
);
