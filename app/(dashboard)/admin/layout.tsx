import type { PropsWithChildren } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DashboardShell,
  type AdminSearchItem,
} from "@/components/layouts/dashboard-shell";
import { requireUser } from "@/lib/auth/guards";
import {
  getPermissionsForRoles,
  permissionForPathname,
  resolveStaffHome,
  PERMISSION_CATALOG,
} from "@/lib/auth/permissions";
import { listLowStockProducts } from "@/lib/services/inventory";
import { listCustomers, listProducts } from "@/lib/services/products";
import { getRecentOrders } from "@/lib/services/reports";
import { formatDateTime } from "@/lib/utils";

export default async function AdminLayout({ children }: PropsWithChildren) {
  const profile = await requireUser("/admin");
  const permissions = await getPermissionsForRoles(profile.roles);
  const isAdmin = profile.roles.includes("admin");

  // Enforce configurable, per-role permissions. Admins always pass.
  if (!isAdmin) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const required = permissionForPathname(pathname);
    if (!required || !permissions.has(required)) {
      redirect(resolveStaffHome(permissions, profile.roles));
    }
  }

  // Only show nav items the user is allowed to open (derived from the resolved
  // permission set for everyone, so the Owner's hidden POS link and the
  // Owner-only Roles link both reflect the special-permission rules).
  const allowedNavHrefs = PERMISSION_CATALOG.filter((def) => permissions.has(def.key)).map(
    (def) => def.path,
  );

  const [recentOrders, products, customers, lowStockAlerts] = await Promise.all([
    getRecentOrders(18),
    listProducts({ includeInactive: true }),
    listCustomers(),
    listLowStockProducts(),
  ]);

  const searchItems: AdminSearchItem[] = [
    ...recentOrders.map((order) => ({
      id: order.id,
      type: "order" as const,
      title: order.orderNumber,
      subtitle: `${order.customerName ?? "Guest"} • ${formatDateTime(order.createdAt)}`,
      href: "/admin/orders",
      keywords: [
        order.orderNumber,
        order.customerName ?? "",
        order.status,
        order.channel,
      ],
    })),
    ...products.map((product) => ({
      id: product.id,
      type: "product" as const,
      title: product.name,
      subtitle: `${product.sku} • ${product.category?.name ?? "General"}`,
      href: "/admin/products",
      keywords: [
        product.sku,
        product.barcode ?? "",
        product.category?.name ?? "",
      ],
    })),
    ...customers.map((customer) => ({
      id: customer.id,
      type: "customer" as const,
      title: customer.fullName,
      subtitle: customer.email ?? customer.phone ?? "Customer record",
      href: "/admin/customers",
      keywords: [customer.email ?? "", customer.phone ?? ""],
    })),
  ];

  return (
    <DashboardShell
      profile={profile}
      searchItems={searchItems}
      allowedNavHrefs={allowedNavHrefs}
      lowStockAlerts={lowStockAlerts.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
      }))}
    >
      {children}
    </DashboardShell>
  );
}
