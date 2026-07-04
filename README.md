# Tisa POS Commerce

A production-style student portfolio project that combines:

- a POS web app for cashier/admin workflows
- an ecommerce storefront for customers
- a shared Postgres data model for products, inventory, carts, orders, and payments

The project uses Next.js App Router, TypeScript, Tailwind CSS, Supabase, and PostgreSQL. The code is intentionally readable and scaffold-friendly so a student can keep growing it after the portfolio milestone.

## Project Overview

This codebase serves three roles:

- customers browse products, use a cart, and place ecommerce orders
- cashiers use a fast POS register to search products and complete sales
- admins manage products, inventory, suppliers, customers, and reports

Server-first patterns are used where they make the most sense:

- pages fetch data on the server through shared services
- Server Actions handle auth, product creation, cart updates, checkout, and POS sales
- PostgreSQL RPC functions support transaction-like order creation and stock adjustments

The app requires a real backend. Configure either the included plain PostgreSQL setup or Supabase before using auth, reports, POS, inventory, or checkout.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, and RPC
- PostgreSQL
- Zod
- Shadcn-style reusable UI primitives in `components/ui`

## Project Structure

See [architecture.md](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/docs/architecture.md) for the high-level architecture and folder tree.

See [route-map.md](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/docs/route-map.md) for the route plan with page purpose, UI sections, data needs, and access roles.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

Replace the placeholder values in `.env.local` before using the app. Without a configured backend, protected workflows show a setup error instead of fake data.

3. Start the development server:

```bash
npm run dev
```

4. Optional verification:

```bash
npm run lint
npm run typecheck
```

## Connect Plain PostgreSQL in pgAdmin

1. Create a PostgreSQL database, for example `tisa_pos`.
2. Put your connection string and session secret into `.env.local`:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/tisa_pos
SESSION_SECRET=replace-with-a-long-random-secret
```

3. In pgAdmin Query Tool, run these files in order:
   - [001_plain_postgres.sql](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/postgres/pgadmin/001_plain_postgres.sql)
   - [002_seed.sql](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/postgres/pgadmin/002_seed.sql)

4. Start the app:

```bash
npm run dev
```

Seeded PostgreSQL accounts:

- `admin@example.com` / `Admin12345!!`
- `cashier@example.com` / `Cashier12345!`
- `rina@example.com` / `Rina12345!!!`

## Connect Supabase

1. Create a new Supabase project.
2. Copy your project URL and anon key into `.env.local`.
3. Add the service role key for admin-side tasks and future server-only tooling.
4. In Supabase SQL Editor, run the SQL files in this order:
   - [001_initial_schema.sql](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/supabase/migrations/001_initial_schema.sql)
   - [001_seed.sql](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/supabase/seeds/001_seed.sql)
   - [001_rls.sql](/Users/user/Documents/Tisa_Study/E-comerce_pos_system_codex/supabase/policies/001_rls.sql)
5. Create Auth users for `admin@example.com` and `cashier@example.com` if you want the seed role-attachment statements to populate staff roles automatically.

## Run Migrations

If you are using the Supabase CLI, you can organize the SQL this way:

```bash
supabase db reset
```

Or apply the files manually in the Supabase dashboard SQL editor in the order listed above.

## Seeded Accounts

Suggested seeded accounts:

- `admin@example.com`
  Use this for full admin access after you run the PostgreSQL seed or create the matching Supabase Auth user.
- `cashier@example.com`
  Use this for POS workflows after you run the PostgreSQL seed or create the matching Supabase Auth user.
- `rina@example.com`
  Seeded as a customer record in the CRM tables. If you want a login for this customer in Supabase, create the Auth user separately and link it through the normal signup flow or an admin script.

## Learning Notes

- `lib/services` holds the reusable business logic used by multiple routes.
- `lib/validations` keeps Zod schemas near the domain logic.
- `app/actions` shows how Server Actions can stay small when they delegate real work to services.
- `supabase/migrations` and `supabase/policies` are part of the portfolio story, not just backend setup. They show that the app was designed around data ownership and access rules.

## Phase 1 MVP Checklist

- [x] Public storefront with product list and product detail pages
- [x] Email/password auth scaffolding with role-aware redirects
- [x] Admin dashboard with product creation, reporting, customers, suppliers, and inventory views
- [x] POS workspace with search, cart editing, payment selection, and receipt page
- [x] Shared Postgres schema for products, carts, orders, payments, inventory, and audit logs
- [x] Seed data and RLS policy SQL
- [x] Edit/deactivate product actions
- [ ] Full customer address creation UI
- [ ] Production-ready file upload polish and image management UX

## Phase 2 Improvements

- Add product restore flows and richer image management
- Add full coupon management screens and validation feedback
- Add pagination, filters, and search params for admin tables
- Add signed receipt downloads and PDF generation using Edge Functions
- Add order fulfillment states, shipment tracking, and email notifications
- Add low-stock notification jobs and supplier purchase order workflow
- Add test coverage with Playwright and Vitest
- Add stronger analytics with time-series charts and period comparisons

## Common Mistakes To Avoid

- Mixing business logic directly into page files instead of reusing service modules
- Forgetting that Supabase RLS applies to all client queries, including Server Actions running as the signed-in user
- Treating `profiles` and `customers` as the same thing when they solve different problems
- Storing only current product values and forgetting to snapshot order item pricing
- Deleting products hard and breaking old order references instead of using soft-delete or inactive flags
- Skipping inventory movement history and trying to infer stock changes only from the current quantity
- Building the POS cart entirely on the server when a small client component gives a much better cashier experience

## Future Improvements

- Add integration tests against a local Supabase or PostgreSQL stack
- Add background jobs for receipts, order confirmations, and low-stock alerts
- Introduce stronger audit tooling and admin activity feeds
- Expand settings into real tenant-style configuration if the project grows into a SaaS
