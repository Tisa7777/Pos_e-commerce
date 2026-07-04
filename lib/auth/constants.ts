import type { NavItem, UserRole } from "@/types/domain";

export const STOREFRONT_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/#about", label: "About" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", roles: ["admin"] },
  { href: "/admin/products", label: "Products", roles: ["admin"] },
  { href: "/admin/categories", label: "Categories", roles: ["admin"] },
  { href: "/admin/orders", label: "Orders", roles: ["admin"] },
  { href: "/admin/customers", label: "Customers", roles: ["admin"] },
  { href: "/admin/employees", label: "Employees", roles: ["admin"] },
  { href: "/admin/suppliers", label: "Suppliers", roles: ["admin"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["admin"] },
  { href: "/admin/reports", label: "Reports", roles: ["admin"] },
  { href: "/admin/comparison", label: "Comparison", roles: ["admin"] },
  { href: "/admin/settings", label: "Settings", roles: ["admin"] },
];

export const POS_NAV: NavItem[] = [
  { href: "/pos", label: "Register", roles: ["cashier"] },
  { href: "/pos/cart", label: "Cart", roles: ["cashier"] },
  { href: "/pos/checkout", label: "Checkout", roles: ["cashier"] },
  { href: "/pos/online-orders", label: "Online Orders", roles: ["cashier"] },
  { href: "/pos/history", label: "History", roles: ["cashier"] },
];

export function getRoleHome(roles: UserRole[]) {
  if (roles.includes("admin")) {
    return "/admin";
  }

  if (roles.includes("clerk")) {
    return "/admin/products";
  }

  if (roles.includes("manager")) {
    return "/admin/reports";
  }

  if (roles.includes("cashier")) {
    return "/pos";
  }

  if (roles.some((role) => role !== "customer")) {
    return "/admin";
  }

  return "/shop";
}

export function getAuthorizedRedirectForRoles(roles: UserRole[], requestedPath?: string) {
  const fallback = getRoleHome(roles);

  if (!requestedPath || requestedPath === "/login" || requestedPath.startsWith("/login?")) {
    return fallback;
  }

  if (requestedPath === "/register" || requestedPath.startsWith("/register?")) {
    return fallback;
  }

  if (requestedPath.startsWith("/admin")) {
    if (roles.some((role) => role !== "customer")) {
      return requestedPath;
    }

    return fallback;
  }

  if (requestedPath.startsWith("/pos")) {
    return roles.includes("cashier") ? requestedPath : fallback;
  }

  if (
    ["/cart", "/checkout", "/orders"].some(
      (prefix) => requestedPath === prefix || requestedPath.startsWith(`${prefix}/`),
    )
  ) {
    return roles.includes("customer") ? requestedPath : fallback;
  }

  return requestedPath;
}
