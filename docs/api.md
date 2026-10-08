# API reference

An endpoint is a request method plus a URL that another program can call. This project exposes the HTTP endpoints below. Its other server operations are Next.js Server Actions used by this app's own pages and components. A Server Action can receive an HTTP request through Next.js, but its generated URL and request format are framework internals, not a supported API for another application.

## HTTP endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | None | Reports whether backend environment variables are configured. |
| `GET` | `/api/products` | None | Lists active products. Optional `search` and `category` query parameters. |
| `GET` | `/api/products/{slug}` | None | Returns one active product by slug. |
| `GET` | `/api/categories` | None | Lists active categories. |

### `GET /api/health`

The complete URL when running locally on the default port is:

```text
http://localhost:3000/api/health
```

On a deployed site, replace `http://localhost:3000` with that site's origin. For example, a deployment at `https://example.com` would use `https://example.com/api/health`.

```bash
curl --request GET \
  --url 'http://localhost:3000/api/health'
```

Example response:

```json
{
  "ok": true,
  "service": "coffee-shop-pos-commerce",
  "backendConfigured": true,
  "postgresConfigured": true,
  "supabaseConfigured": false,
  "timestamp": "2026-10-08T00:00:00.000Z"
}
```

The timestamp is generated when the request is handled. `ok: true` means the app answered the request. The configuration flags check environment variables only; they do **not** verify a database connection or the health of Supabase. The implementation is in [`app/api/health/route.ts`](../app/api/health/route.ts).

### Product and category endpoints

```bash
curl --request GET \
  --url 'http://localhost:3000/api/products?search=coffee&category=coffee-tea'

curl --request GET \
  --url 'http://localhost:3000/api/products/cappuccino'

curl --request GET \
  --url 'http://localhost:3000/api/categories'
```

Successful responses contain a `data` field. The products list returns an array; the product detail returns one object. Product fields include `id`, `name`, `slug`, `sku`, `barcode`, `description`, `price`, `stockQuantity`, `category`, `imageUrl`, and `imageAlt`. Internal cost and supplier fields are excluded. A missing product returns HTTP `404` with `{"error":"Product not found."}`. Search and category values over 100 characters return HTTP `400`.

There are no HTTP routes yet for suppliers, customers, employees, inventory, orders, payments, shifts, reports, loyalty, roles, or settings. Page routes such as `/shop`, `/admin/products`, and `/pos` return application UI, not JSON API responses.

## Internal Server Actions

The table below inventories the operations in [`app/actions/`](../app/actions/). These are **internal application calls**, not stable HTTP endpoints. The named permission is checked by the action before protected work; public or signed-in actions are marked separately.

| Area | Action module | Operations | Access |
| --- | --- | --- | --- |
| Authentication | [`auth.ts`](../app/actions/auth.ts), [`staff-auth.ts`](../app/actions/staff-auth.ts), [`session.ts`](../app/actions/session.ts) | Log in, register, log out, check sign-in status | Public or current session |
| Account | [`profile.ts`](../app/actions/profile.ts) | Update profile | Signed-in user |
| Storefront orders | [`guest-orders.ts`](../app/actions/guest-orders.ts), [`my-orders.ts`](../app/actions/my-orders.ts) | Place a guest order, retrieve or track a guest order, list the signed-in customer's orders | Public tracking/checkout or current customer |
| Loyalty | [`loyalty.ts`](../app/actions/loyalty.ts) | Redeem a loyalty coupon | Signed-in user |
| Catalog | [`catalog.ts`](../app/actions/catalog.ts) | Create, update, and delete categories and suppliers | `categories` or `suppliers` permission |
| Products | [`products.ts`](../app/actions/products.ts) | Create, update, activate/deactivate, and delete products | `products` permission |
| Customers | [`customers.ts`](../app/actions/customers.ts) | Create, update, discount, award points, and delete customers | `customers` permission; customer creation also allows `pos` |
| Employees | [`employees.ts`](../app/actions/employees.ts) | Create, update, and delete employees | `employees` permission |
| Inventory | [`inventory.ts`](../app/actions/inventory.ts) | Adjust stock | `inventory` permission |
| POS orders | [`orders.ts`](../app/actions/orders.ts) | Complete a POS sale and update an online order's status | `pos` permission |
| Online order notifications | [`online-orders.ts`](../app/actions/online-orders.ts) | Count pending online orders | `pos` permission |
| POS shifts | [`pos-shifts.ts`](../app/actions/pos-shifts.ts) | Open and close shifts | `pos` permission |
| Reports | [`reports.ts`](../app/actions/reports.ts) | Load sales analytics for a date preset | `reports` permission |
| Access management | [`access.ts`](../app/actions/access.ts) | Create/remove roles, set role permissions, assign user roles | `roles` permission |
| Store settings | [`currency-actions.ts`](../app/actions/currency-actions.ts) | Load and update currency settings | Update requires `settings` permission |

These actions call service functions in [`lib/services/`](../lib/services/) and use the app's session cookies. Their form fields, return values, and Next.js transport can change with the UI. Do not call generated Server Action URLs from a separate project.

## Connecting another project

To provide a supported external API, add explicit route handlers under `app/api/` for the operations the other project needs. Reuse the existing service and validation modules, and define an HTTP contract for each route: method, path, authentication, input, response, status codes, and authorization. Protected routes need an API-appropriate authentication mechanism and JSON `401`/`403` responses; the current page and Server Action guards redirect browsers. A browser client hosted on another origin also needs an explicit cross-origin policy.

A trusted server application can instead use a restricted PostgreSQL account against the same database. Keep database credentials and service-role keys on the server. The app can use either its plain PostgreSQL backend or Supabase; see the [README](../README.md) for setup.
