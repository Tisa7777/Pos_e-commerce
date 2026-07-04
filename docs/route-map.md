# Route Map

## Public Storefront

- `/`
  Purpose: Landing page that introduces the project and highlights featured products.
  Main UI sections: Hero, architecture highlights, category summary, featured products.
  Data needed: Categories, featured products.
  Access role: Public.

- `/shop`
  Purpose: Product listing for customers.
  Main UI sections: Page header, product grid, add-to-cart actions.
  Data needed: Active products with categories and primary images.
  Access role: Public.

- `/shop/[slug]`
  Purpose: Product detail page.
  Main UI sections: Product image, description, inventory facts, add-to-cart action.
  Data needed: Product by slug, image, category, stock summary.
  Access role: Public.

- `/cart`
  Purpose: Review and manage ecommerce cart.
  Main UI sections: Cart line items, quantity update forms, summary card.
  Data needed: Current profile cart and cart items.
  Access role: Customer.

- `/checkout`
  Purpose: Place an ecommerce order.
  Main UI sections: Shipping address picker, payment method, notes, summary.
  Data needed: Current cart, saved addresses.
  Access role: Customer.

- `/orders`
  Purpose: Customer order history.
  Main UI sections: Order list, status badges, totals.
  Data needed: Orders owned by the signed-in customer.
  Access role: Customer.

- `/orders/[id]`
  Purpose: Customer order detail.
  Main UI sections: Line items, totals, notes, status.
  Data needed: Single owned order with items.
  Access role: Customer.

- `/login`
  Purpose: Email/password sign-in.
  Main UI sections: Login form, redirect-aware hidden field, helper links.
  Data needed: None beyond auth.
  Access role: Public.

- `/register`
  Purpose: Customer registration.
  Main UI sections: Registration form, helper copy.
  Data needed: None beyond auth.
  Access role: Public.

## Admin Dashboard

- `/admin`
  Purpose: Operations overview.
  Main UI sections: KPI cards, recent orders, low-stock list.
  Data needed: Dashboard metrics, recent orders, low-stock products.
  Access role: Admin.

- `/admin/products`
  Purpose: Product management index.
  Main UI sections: Product table, quick view links, create CTA.
  Data needed: Full product catalog.
  Access role: Admin.

- `/admin/products/new`
  Purpose: Create a product.
  Main UI sections: Product form, category/supplier selects, image upload.
  Data needed: Categories, suppliers.
  Access role: Admin.

- `/admin/categories`
  Purpose: Category overview.
  Main UI sections: Category cards.
  Data needed: Categories.
  Access role: Admin.

- `/admin/orders`
  Purpose: Admin view across all order channels.
  Main UI sections: Shared recent orders list.
  Data needed: All orders.
  Access role: Admin.

- `/admin/customers`
  Purpose: Customer directory.
  Main UI sections: Customer cards with contact info and loyalty points.
  Data needed: Customers.
  Access role: Admin.

- `/admin/employees`
  Purpose: Employee and staff management.
  Main UI sections: Employee table, role/status filters, payroll summary, employee editor.
  Data needed: Employee records, linked staff profiles when available.
  Access role: Admin.

- `/admin/suppliers`
  Purpose: Supplier management overview.
  Main UI sections: Supplier cards with contact information.
  Data needed: Suppliers.
  Access role: Admin.

- `/admin/inventory`
  Purpose: Stock monitoring and manual adjustments.
  Main UI sections: Adjustment form, low-stock list, recent movement feed.
  Data needed: Products, low-stock products, movement history.
  Access role: Admin.

- `/admin/reports`
  Purpose: Sales reporting.
  Main UI sections: KPI cards, daily sales totals, top-selling products, recent orders.
  Data needed: Dashboard metrics, payment summaries, top sellers, recent orders.
  Access role: Admin.

- `/admin/settings`
  Purpose: Environment and platform notes.
  Main UI sections: Env checklist, storage guidance.
  Data needed: Supabase configuration status.
  Access role: Admin.

## POS

- `/pos`
  Purpose: Main cashier register.
  Main UI sections: Product search, quick-add grid, live cart, checkout panel.
  Data needed: Products, customers.
  Access role: Cashier.

- `/pos/cart`
  Purpose: POS cart-focused view.
  Main UI sections: Same POS workspace with emphasis on cart management.
  Data needed: Products, customers.
  Access role: Cashier.

- `/pos/checkout`
  Purpose: POS checkout-focused view.
  Main UI sections: Same POS workspace with emphasis on payment and completion.
  Data needed: Products, customers.
  Access role: Cashier.

- `/pos/online-orders`
  Purpose: Cashier queue for ecommerce orders that need POS-side processing.
  Main UI sections: Online order list, status controls, fulfillment details.
  Data needed: Ecommerce orders.
  Access role: Cashier.

- `/pos/history`
  Purpose: POS sale history.
  Main UI sections: Sale list with receipt links.
  Data needed: POS orders only.
  Access role: Cashier.

- `/pos/history/[id]`
  Purpose: Receipt view and print page.
  Main UI sections: Receipt header, item list, totals, print action.
  Data needed: POS order detail and latest payment method.
  Access role: Cashier.
