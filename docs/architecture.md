# Architecture Summary

Tisa POS Commerce is a single Next.js App Router codebase that serves three experiences:

- `storefront` routes for customers
- `admin` routes for inventory, catalog, reporting, and operations
- `pos` routes for cashier checkout

The app uses server-first data access through shared service modules in `lib/services`. Pages stay thin and mostly render data fetched on the server. Client components are only introduced where instant interaction matters, such as the POS cart workspace and auth/product forms using Server Actions.

Supabase provides Auth, Postgres, Storage, and RPC support. PostgreSQL holds the normalized business schema and exposes transaction-like RPC functions for order creation and stock adjustments. RLS policies then shape access for admin, cashier, and customer roles.

## Folder Structure

```text
.
├── app
│   ├── (auth)
│   ├── (dashboard)
│   │   ├── admin
│   │   └── pos
│   ├── (storefront)
│   ├── actions
│   └── api
├── components
│   ├── dashboard
│   ├── forms
│   ├── layouts
│   ├── pos
│   ├── storefront
│   └── ui
├── docs
├── hooks
├── lib
│   ├── auth
│   ├── services
│   ├── supabase
│   └── validations
├── supabase
│   ├── migrations
│   ├── policies
│   └── seeds
└── types
```

## Database ER Notes

- `profiles` mirrors `auth.users`, while `user_roles` stores one or more roles per account.
- `employees` stores staff HR details such as role, status, pay settings, work days, and shift times, optionally linking back to `profiles`.
- `customers` can optionally link to `profiles`, which supports both registered shoppers and walk-in POS customers.
- `products` belongs to optional `categories` and `suppliers`, and has many `product_images`.
- `carts` belongs to a customer `profile`; `cart_items` belongs to `carts` and references `products`.
- `orders` is the shared sales header table for both POS and ecommerce; it optionally links to `profiles`, `customers`, `cashier_profile_id`, `coupons`, and `addresses`.
- `order_items` snapshots product and pricing data at purchase time.
- `payments` belongs to `orders`.
- `inventory_movements` is the stock ledger tied to `products` and optionally to `orders` and `order_items`.
- `audit_logs` captures important actions across the system.
