import type { PropsWithChildren } from "react";
import {
  DashboardShell,
  type AdminSearchItem,
} from "@/components/layouts/dashboard-shell";
import { PosCashierProvider } from "@/components/pos/cashier-selector";
import { OnlineOrderNotifications } from "@/components/pos/online-order-notifications";
import { requirePermission } from "@/lib/auth/guards";
import { getPermissionsForRoles } from "@/lib/auth/permissions";
import { listLowStockProducts } from "@/lib/services/inventory";
import { listPosCashierOptions } from "@/lib/services/employees";
import { listOrders } from "@/lib/services/orders";
import { listCustomers, listProducts } from "@/lib/services/products";
import { getRecentOrders } from "@/lib/services/reports";
import { formatDateTime } from "@/lib/utils";
import type { PosCashierOption } from "@/types/domain";

export default async function PosLayout({ children }: PropsWithChildren) {
  const profile = await requirePermission("pos", "/pos");
  const permissions = await getPermissionsForRoles(profile.roles);
  const allowedNavHrefs = permissions.has("pos")
    ? ["/pos", "/pos/online-orders", "/pos/history"]
    : [];
  const [
    onlineOrders,
    cashierOptions,
    recentOrders,
    products,
    customers,
    lowStockAlerts,
  ] = await Promise.all([
    listOrders({
      roles: ["cashier"],
      channel: "ecommerce",
      limit: 50,
    }),
    listPosCashierOptions(),
    getRecentOrders(18),
    listProducts({ includeInactive: true }),
    listCustomers(),
    listLowStockProducts(),
  ]);
  const onlineOrderCount = onlineOrders.filter((order) =>
    ["pending", "paid", "processing"].includes(order.status),
  ).length;
  const defaultCashier: PosCashierOption = {
    id: profile.id,
    name: profile.fullName,
    profileId: profile.id,
    role: "cashier",
  };
  const searchItems: AdminSearchItem[] = [
    ...recentOrders.map((order) => ({
      id: order.id,
      type: "order" as const,
      title: order.orderNumber,
      subtitle: `${order.customerName ?? "Guest"} - ${formatDateTime(order.createdAt)}`,
      href: "/pos/history",
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
      subtitle: `${product.sku} - ${product.category?.name ?? "General"}`,
      href: "/pos",
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
      href: "/pos",
      keywords: [customer.email ?? "", customer.phone ?? ""],
    })),
  ];

  return (
    <DashboardShell
      profile={profile}
      searchItems={searchItems}
      hideTopLogout
      allowedNavHrefs={allowedNavHrefs}
      lowStockAlerts={lowStockAlerts.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
      }))}
    >
      <PosCashierProvider
        options={cashierOptions}
        defaultCashier={defaultCashier}
        initialOpenShifts={[]}
      >
        {children}
        <OnlineOrderNotifications initialCount={onlineOrderCount} />
      </PosCashierProvider>
    </DashboardShell>
  );
}
