-- =========================================================
-- Coffee Shop POS Commerce seed data
-- =========================================================

-- ---------------------------------------------------------
-- Admin and cashier setup notes
-- ---------------------------------------------------------
-- 1. Create these users in Supabase Auth first:
--    - admin@example.com
--    - cashier@example.com
-- 2. This seed will attach app roles if those auth users exist.
-- 3. Passwords are managed in Supabase Auth, not in public SQL tables.

insert into public.profiles (id, email, full_name, phone)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', 'Admin User'),
  raw_user_meta_data ->> 'phone'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone;

insert into public.user_roles (profile_id, role)
select id, 'admin'::public.user_role
from auth.users
where email = 'admin@example.com'
on conflict (profile_id, role) do nothing;

delete from public.user_roles
where profile_id in (
  select id
  from auth.users
  where email = 'admin@example.com'
)
  and role <> 'admin';

insert into public.profiles (id, email, full_name, phone)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', 'Cashier User'),
  raw_user_meta_data ->> 'phone'
from auth.users
where email = 'cashier@example.com'
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone;

insert into public.user_roles (profile_id, role)
select id, 'cashier'::public.user_role
from auth.users
where email = 'cashier@example.com'
on conflict (profile_id, role) do nothing;

delete from public.user_roles
where profile_id in (
  select id
  from auth.users
  where email = 'cashier@example.com'
)
  and role <> 'cashier';

insert into public.employees (
  id,
  profile_id,
  full_name,
  email,
  phone,
  role,
  status,
  pay_type,
  salary_amount,
  hourly_rate,
  work_days,
  shift_start,
  shift_end,
  start_date,
  emergency_contact,
  address,
  notes
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  id,
  coalesce(raw_user_meta_data ->> 'full_name', 'Admin User'),
  email,
  raw_user_meta_data ->> 'phone',
  'admin',
  'active',
  'salary',
  850,
  0,
  array['mon', 'tue', 'wed', 'thu', 'fri'],
  '08:00',
  '17:00',
  current_date,
  '+855 10 111 000',
  'Phnom Penh',
  'Store administrator'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
set profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status,
    pay_type = excluded.pay_type,
    salary_amount = excluded.salary_amount,
    hourly_rate = excluded.hourly_rate,
    work_days = excluded.work_days,
    shift_start = excluded.shift_start,
    shift_end = excluded.shift_end,
    start_date = excluded.start_date,
    emergency_contact = excluded.emergency_contact,
    address = excluded.address,
    notes = excluded.notes;

insert into public.employees (
  id,
  profile_id,
  full_name,
  email,
  phone,
  role,
  status,
  pay_type,
  salary_amount,
  hourly_rate,
  work_days,
  shift_start,
  shift_end,
  start_date,
  emergency_contact,
  address,
  notes
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  id,
  coalesce(raw_user_meta_data ->> 'full_name', 'Cashier User'),
  email,
  raw_user_meta_data ->> 'phone',
  'cashier',
  'active',
  'salary',
  420,
  0,
  array['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  '07:00',
  '15:00',
  current_date,
  '+855 10 222 000',
  'Phnom Penh',
  'Main counter cashier'
from auth.users
where email = 'cashier@example.com'
on conflict (id) do update
set profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status,
    pay_type = excluded.pay_type,
    salary_amount = excluded.salary_amount,
    hourly_rate = excluded.hourly_rate,
    work_days = excluded.work_days,
    shift_start = excluded.shift_start,
    shift_end = excluded.shift_end,
    start_date = excluded.start_date,
    emergency_contact = excluded.emergency_contact,
    address = excluded.address,
    notes = excluded.notes;

-- ---------------------------------------------------------
-- Categories
-- ---------------------------------------------------------
insert into public.categories (id, name, slug, description)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Coffee & Tea',
    'coffee-tea',
    'Cafe drinks sold in-store and through the ecommerce storefront.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Bakery',
    'bakery',
    'Fresh baked items that pair well with drinks and fast POS tickets.'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Accessories',
    'accessories',
    'Retail merchandise and reusable cups.'
  )
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    description = excluded.description;

-- ---------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------
insert into public.suppliers (id, name, contact_name, email, phone, notes)
values
  (
    '44444444-4444-4444-4444-444444444444',
    'Mekong Beans Co.',
    'Sokha Chan',
    'beans@mekong.example',
    '+855 12 500 100',
    'Primary supplier for coffee beans and packaged tea.'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'City Bakery Hub',
    'Dara Lim',
    'orders@citybakery.example',
    '+855 77 220 100',
    'Delivers croissants and morning bakery items before opening shift.'
  )
on conflict (id) do update
set name = excluded.name,
    contact_name = excluded.contact_name,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes;

-- ---------------------------------------------------------
-- Customers
-- ---------------------------------------------------------
insert into public.customers (id, full_name, email, phone, notes, loyalty_points)
values
  (
    '77777777-7777-7777-7777-777777777771',
    'Walk-in Customer',
    null,
    null,
    'Generic POS customer record for quick sales without profile lookup.',
    0
  ),
  (
    '77777777-7777-7777-7777-777777777772',
    'Rina Sok',
    'rina@example.com',
    '+855 88 222 111',
    'Frequent ecommerce buyer who likes gift packaging.',
    36
  ),
  (
    '77777777-7777-7777-7777-777777777773',
    'Vannak Yim',
    'vannak@example.com',
    '+855 96 555 200',
    'Usually shops in-store during lunch rush.',
    12
  )
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes,
    loyalty_points = excluded.loyalty_points;

insert into public.addresses (
  id,
  customer_id,
  label,
  recipient_name,
  phone,
  line_1,
  line_2,
  city,
  state,
  postal_code,
  country,
  is_default_shipping
)
values
  (
    '88888888-8888-8888-8888-888888888881',
    '77777777-7777-7777-7777-777777777772',
    'Home',
    'Rina Sok',
    '+855 88 222 111',
    'No. 18, Street 240',
    'Boeng Keng Kang',
    'Phnom Penh',
    null,
    '120101',
    'Cambodia',
    true
  ),
  (
    '88888888-8888-8888-8888-888888888882',
    '77777777-7777-7777-7777-777777777773',
    'Office',
    'Vannak Yim',
    '+855 96 555 200',
    'Monivong Boulevard, Suite 5B',
    'Daun Penh',
    'Phnom Penh',
    null,
    '120211',
    'Cambodia',
    true
  )
on conflict (id) do update
set label = excluded.label,
    recipient_name = excluded.recipient_name,
    phone = excluded.phone,
    line_1 = excluded.line_1,
    line_2 = excluded.line_2,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    country = excluded.country,
    is_default_shipping = excluded.is_default_shipping;

-- ---------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------
insert into public.coupons (
  id,
  code,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  starts_at,
  ends_at,
  max_redemptions,
  is_active
)
values
  (
    '99999999-9999-9999-9999-999999999991',
    'WELCOME10',
    '10 percent off first ecommerce order',
    'percentage',
    10,
    10,
    timezone('utc', now()) - interval '30 days',
    timezone('utc', now()) + interval '365 days',
    1000,
    true
  ),
  (
    '99999999-9999-9999-9999-999999999992',
    'POS5',
    'Flat $5 off larger orders',
    'fixed_amount',
    5,
    25,
    timezone('utc', now()) - interval '7 days',
    timezone('utc', now()) + interval '120 days',
    500,
    true
  )
on conflict (id) do update
set code = excluded.code,
    description = excluded.description,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    min_order_amount = excluded.min_order_amount,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    max_redemptions = excluded.max_redemptions,
    is_active = excluded.is_active;

-- ---------------------------------------------------------
-- Products
-- ---------------------------------------------------------
insert into public.products (
  id,
  category_id,
  supplier_id,
  name,
  slug,
  description,
  sku,
  barcode,
  price,
  cost,
  stock_quantity,
  low_stock_threshold,
  is_active
)
values
  (
    '66666666-6666-6666-6666-666666666661',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    'Iced Latte',
    'iced-latte',
    'A chilled espresso and milk favorite for takeaway or delivery.',
    'CAF-ICL-001',
    '885100000001',
    4.50,
    1.60,
    48,
    12,
    true
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    'Signature Khmer Milk Tea',
    'signature-khmer-milk-tea',
    'Sweet milk tea with a local flavor profile and strong repeat sales.',
    'TEA-KMT-002',
    '885100000002',
    3.75,
    1.20,
    18,
    10,
    true
  ),
  (
    '66666666-6666-6666-6666-666666666663',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'Butter Croissant',
    'butter-croissant',
    'A fast-moving POS item that also works well as an add-on in ecommerce.',
    'BAK-CRS-003',
    '885100000003',
    2.25,
    0.85,
    9,
    10,
    true
  ),
  (
    '66666666-6666-6666-6666-666666666664',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    'Coffee Shop Travel Tumbler',
    'coffee-shop-travel-tumbler',
    'Merchandise item for upsells, bundles, and loyalty rewards.',
    'ACC-TMB-004',
    '885100000004',
    14.00,
    5.50,
    24,
    6,
    true
  )
on conflict (id) do update
set category_id = excluded.category_id,
    supplier_id = excluded.supplier_id,
    name = excluded.name,
    slug = excluded.slug,
    description = excluded.description,
    sku = excluded.sku,
    barcode = excluded.barcode,
    price = excluded.price,
    cost = excluded.cost,
    stock_quantity = excluded.stock_quantity,
    low_stock_threshold = excluded.low_stock_threshold,
    is_active = excluded.is_active;

insert into public.product_images (
  id,
  product_id,
  storage_path,
  public_url,
  alt_text,
  sort_order,
  is_primary
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '66666666-6666-6666-6666-666666666661',
    'seed/iced-latte.jpg',
    'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80',
    'Iced latte',
    0,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '66666666-6666-6666-6666-666666666662',
    'seed/khmer-milk-tea.jpg',
    'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=1200&q=80',
    'Khmer milk tea',
    0,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '66666666-6666-6666-6666-666666666663',
    'seed/croissant.jpg',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    'Butter croissant',
    0,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '66666666-6666-6666-6666-666666666664',
    'seed/tumbler.jpg',
    'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?auto=format&fit=crop&w=1200&q=80',
    'Travel tumbler',
    0,
    true
  )
on conflict (id) do update
set storage_path = excluded.storage_path,
    public_url = excluded.public_url,
    alt_text = excluded.alt_text,
    sort_order = excluded.sort_order,
    is_primary = excluded.is_primary;
