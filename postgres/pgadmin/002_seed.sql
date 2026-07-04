insert into public.profiles (id, email, password_hash, full_name, phone)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    '$2b$10$mMznLBFYz2MS7hV/ja3KO.CO.uxsSZrZazKtvofuzn.Qrh2fIljEW',
    'Admin User',
    '+855 10 111 111'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'cashier@example.com',
    '$2b$10$5HtDuhpjHAuYOVFG1edeyOmC0JrCuKeb61fLMK3D2qDq2kjFa9zfK',
    'Cashier User',
    '+855 10 222 222'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'rina@example.com',
    '$2b$10$E0BePnlkM8AyQ.NVgn0RsO2EqWfvgX8lr6a61FkiU6OArHsHIwGEy',
    'Rina Sok',
    '+855 88 222 111'
  )
on conflict (id) do update
set email = excluded.email,
    password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    phone = excluded.phone;

insert into public.user_roles (profile_id, role)
values
  ('00000000-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'cashier'),
  ('00000000-0000-0000-0000-000000000003', 'customer')
on conflict (profile_id, role) do nothing;

delete from public.user_roles
where profile_id = '00000000-0000-0000-0000-000000000001'
  and role <> 'admin';

delete from public.user_roles
where profile_id = '00000000-0000-0000-0000-000000000002'
  and role <> 'cashier';

delete from public.user_roles
where profile_id = '00000000-0000-0000-0000-000000000003'
  and role <> 'customer';

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
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000001',
    'Admin User',
    'admin@example.com',
    '+855 10 111 111',
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
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '00000000-0000-0000-0000-000000000002',
    'Cashier User',
    'cashier@example.com',
    '+855 10 222 222',
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
  )
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

insert into public.categories (id, name, slug, description)
values
  ('11111111-1111-1111-1111-111111111111', 'Coffee & Tea', 'coffee-tea', 'Cafe staples for both the storefront and the POS counter.'),
  ('22222222-2222-2222-2222-222222222222', 'Bakery', 'bakery', 'Fresh baked items that move quickly in person and online.'),
  ('33333333-3333-3333-3333-333333333333', 'Accessories', 'accessories', 'Retail goods like tumblers and gift bundles.')
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    description = excluded.description;

insert into public.suppliers (id, name, contact_name, email, phone, notes)
values
  ('44444444-4444-4444-4444-444444444444', 'Mekong Beans Co.', 'Sokha Chan', 'beans@mekong.example', '+855 12 500 100', 'Beverage and cafe ingredient supplier.'),
  ('55555555-5555-5555-5555-555555555555', 'City Bakery Hub', 'Dara Lim', 'orders@citybakery.example', '+855 77 220 100', 'Primary bakery partner for fresh pastry drops.')
on conflict (id) do update
set name = excluded.name,
    contact_name = excluded.contact_name,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes;

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
    null,
    'Tisa Travel Tumbler',
    'tisa-travel-tumbler',
    'Merchandise item for upsells and gift bundles.',
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

insert into public.product_images (product_id, storage_path, public_url, alt_text, is_primary)
values
  (
    '66666666-6666-6666-6666-666666666661',
    'seed/iced-latte.jpg',
    'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80',
    'Iced latte',
    true
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    'seed/khmer-milk-tea.jpg',
    'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=1200&q=80',
    'Milk tea',
    true
  ),
  (
    '66666666-6666-6666-6666-666666666663',
    'seed/butter-croissant.jpg',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    'Croissant',
    true
  )
on conflict do nothing;

insert into public.customers (id, profile_id, full_name, email, phone, notes, loyalty_points)
values
  ('77777777-7777-7777-7777-777777777771', null, 'Walk-in Customer', null, null, 'Generic POS customer record for quick sales without profile lookup.', 0),
  ('77777777-7777-7777-7777-777777777772', '00000000-0000-0000-0000-000000000003', 'Rina Sok', 'rina@example.com', '+855 88 222 111', 'Frequent ecommerce buyer who likes gift packaging.', 36),
  ('77777777-7777-7777-7777-777777777773', null, 'Vannak Yim', 'vannak@example.com', '+855 96 555 200', 'Usually shops in-store during lunch rush.', 12)
on conflict (id) do update
set profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    notes = excluded.notes,
    loyalty_points = excluded.loyalty_points;

-- Sales tables intentionally start empty. Orders, order items, and inventory
-- movement history are created only by real POS or ecommerce activity.
