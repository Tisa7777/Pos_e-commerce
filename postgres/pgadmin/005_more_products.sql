-- Extra catalog so the storefront and POS have a fuller menu.
-- Safe to re-run: conflicts on product/image ids are handled.

insert into public.products (
  id, category_id, supplier_id, name, slug, description, sku, barcode,
  price, cost, stock_quantity, low_stock_threshold, is_active
)
values
  -- Coffee & Tea
  ('66666666-6666-6666-6666-666666666665', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Hot Americano', 'hot-americano', 'Rich espresso topped with hot water for a clean, bold cup.', 'CAF-AME-005', '885100000005', 3.25, 1.10, 60, 12, true),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Cappuccino', 'cappuccino', 'Espresso with steamed milk and a thick layer of foam.', 'CAF-CAP-006', '885100000006', 4.25, 1.50, 50, 12, true),
  ('66666666-6666-6666-6666-666666666667', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Caramel Macchiato', 'caramel-macchiato', 'Vanilla, steamed milk, espresso, and a caramel drizzle.', 'CAF-CMA-007', '885100000007', 4.75, 1.80, 40, 10, true),
  ('66666666-6666-6666-6666-666666666668', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Espresso', 'espresso', 'A concentrated single shot for a quick lift.', 'CAF-ESP-008', '885100000008', 2.75, 0.90, 80, 15, true),
  ('66666666-6666-6666-6666-666666666669', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Matcha Latte', 'matcha-latte', 'Stone-ground matcha whisked with creamy milk.', 'TEA-MAT-009', '885100000009', 4.95, 1.90, 35, 10, true),
  ('66666666-6666-6666-6666-66666666666a', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Thai Iced Tea', 'thai-iced-tea', 'Bold spiced tea with sweet milk over ice.', 'TEA-THA-010', '885100000010', 3.95, 1.30, 45, 10, true),
  ('66666666-6666-6666-6666-66666666666b', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
   'Iced Lemon Tea', 'iced-lemon-tea', 'Refreshing black tea with fresh lemon.', 'TEA-LEM-011', '885100000011', 3.25, 1.00, 50, 10, true),

  -- Bakery
  ('66666666-6666-6666-6666-66666666666c', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
   'Pain au Chocolat', 'pain-au-chocolat', 'Buttery laminated pastry wrapped around dark chocolate.', 'BAK-PAC-012', '885100000012', 2.75, 1.00, 30, 10, true),
  ('66666666-6666-6666-6666-66666666666d', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
   'Blueberry Muffin', 'blueberry-muffin', 'Moist muffin loaded with real blueberries.', 'BAK-MUF-013', '885100000013', 2.95, 1.05, 28, 10, true),
  ('66666666-6666-6666-6666-66666666666e', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
   'Cheese Danish', 'cheese-danish', 'Flaky pastry with a sweet cream cheese center.', 'BAK-DAN-014', '885100000014', 3.25, 1.20, 24, 8, true),
  ('66666666-6666-6666-6666-66666666666f', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
   'Chocolate Chip Cookie', 'chocolate-chip-cookie', 'Chewy cookie packed with chocolate chips.', 'BAK-CCC-015', '885100000015', 1.75, 0.55, 60, 15, true),
  ('66666666-6666-6666-6666-666666666670', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555',
   'Cinnamon Roll', 'cinnamon-roll', 'Soft swirl roll with cinnamon and glaze.', 'BAK-CIN-016', '885100000016', 3.50, 1.25, 22, 8, true),

  -- Accessories
  ('66666666-6666-6666-6666-666666666671', '33333333-3333-3333-3333-333333333333', null,
   'Coffee Shop Ceramic Mug', 'coffee-shop-ceramic-mug', 'Branded ceramic mug for at-home brews.', 'ACC-MUG-017', '885100000017', 9.50, 3.50, 40, 8, true),
  ('66666666-6666-6666-6666-666666666672', '33333333-3333-3333-3333-333333333333', null,
   'Coffee Shop Tote Bag', 'coffee-shop-tote-bag', 'Sturdy canvas tote for everyday carry.', 'ACC-TOT-018', '885100000018', 12.00, 4.50, 35, 6, true),
  ('66666666-6666-6666-6666-666666666673', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
   'Drip Coffee Pack 250g', 'drip-coffee-pack-250g', 'House blend roasted beans, ground for drip.', 'ACC-DRP-019', '885100000019', 11.50, 4.00, 50, 10, true)
on conflict (id) do nothing;

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
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666665', '66666666-6666-6666-6666-666666666665', 'public/products/hot-americano.png', '/products/hot-americano.png', 'Hot Americano', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666666', '66666666-6666-6666-6666-666666666666', 'public/products/cappuccino.png', '/products/cappuccino.png', 'Cappuccino', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666667', '66666666-6666-6666-6666-666666666667', 'public/products/caramel-macchiato.png', '/products/caramel-macchiato.png', 'Caramel Macchiato', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666668', '66666666-6666-6666-6666-666666666668', 'public/products/espresso.png', '/products/espresso.png', 'Espresso', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666669', '66666666-6666-6666-6666-666666666669', 'public/products/matcha-latte.png', '/products/matcha-latte.png', 'Matcha Latte', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666a', '66666666-6666-6666-6666-66666666666a', 'public/products/thai-iced-tea.png', '/products/thai-iced-tea.png', 'Thai Iced Tea', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666b', '66666666-6666-6666-6666-66666666666b', 'public/products/iced-lemon-tea.png', '/products/iced-lemon-tea.png', 'Iced Lemon Tea', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666c', '66666666-6666-6666-6666-66666666666c', 'public/products/pain-au-chocolat.png', '/products/pain-au-chocolat.png', 'Pain au Chocolat', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666d', '66666666-6666-6666-6666-66666666666d', 'public/products/blueberry-muffin.png', '/products/blueberry-muffin.png', 'Blueberry Muffin', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666e', '66666666-6666-6666-6666-66666666666e', 'public/products/cheese-danish.png', '/products/cheese-danish.png', 'Cheese Danish', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-66666666666f', '66666666-6666-6666-6666-66666666666f', 'public/products/chocolate-chip-cookie.png', '/products/chocolate-chip-cookie.png', 'Chocolate Chip Cookie', 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-666666666670', '66666666-6666-6666-6666-666666666670', 'public/products/cinnamon-roll.png', '/products/cinnamon-roll.png', 'Cinnamon Roll', 0, true)
on conflict (id) do update
set storage_path = excluded.storage_path,
    public_url = excluded.public_url,
    alt_text = excluded.alt_text,
    sort_order = excluded.sort_order,
    is_primary = excluded.is_primary;
