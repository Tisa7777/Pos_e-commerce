"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ComponentType,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type SVGProps,
} from "react";
import { staffLogoutAction } from "@/app/actions/staff-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageBackButton } from "@/components/ui/page-back-button";
import { cn } from "@/lib/utils";
import type { AppProfile, UserRole } from "@/types/domain";

export interface AdminSearchItem {
  id: string;
  type: "order" | "product" | "customer";
  title: string;
  subtitle: string;
  href: string;
  keywords?: string[];
}

interface LowStockAlert {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

interface DashboardShellProps extends PropsWithChildren {
  profile: AppProfile;
  searchItems: AdminSearchItem[];
  lowStockAlerts: LowStockAlert[];
  hideTopLogout?: boolean;
  /** When provided, only nav items whose href is listed are shown. */
  allowedNavHrefs?: string[];
}

type IconProps = SVGProps<SVGSVGElement>;

const NAV_SECTIONS: Array<{
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: ComponentType<IconProps>;
    roles: UserRole[];
  }>;
}> = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutGridIcon,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "POS",
    items: [
      {
        href: "/pos",
        label: "POS Register",
        icon: RegisterIcon,
        roles: ["cashier"],
      },
      {
        href: "/pos/online-orders",
        label: "Online Orders",
        icon: OnlineOrdersIcon,
        roles: ["cashier"],
      },
      {
        href: "/pos/history",
        label: "POS History",
        icon: HistoryIcon,
        roles: ["cashier"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        icon: ReceiptIcon,
        roles: ["admin", "manager"],
      },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: UsersIcon,
        roles: ["admin"],
      },
      {
        href: "/admin/employees",
        label: "Employees",
        icon: BadgeIcon,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        icon: PackageIcon,
        roles: ["admin", "clerk"],
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: LayersIcon,
        roles: ["admin", "clerk"],
      },
      {
        href: "/admin/suppliers",
        label: "Suppliers",
        icon: TruckIcon,
        roles: ["admin"],
      },
      {
        href: "/admin/inventory",
        label: "Inventory",
        icon: BoxesIcon,
        roles: ["admin", "clerk"],
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        href: "/admin/reports",
        label: "Reports",
        icon: BarChartIcon,
        roles: ["admin", "manager"],
      },
      {
        href: "/admin/comparison",
        label: "Comparison",
        icon: TrendingUpIcon,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/admin/roles",
        label: "Roles & Access",
        icon: ShieldIcon,
        roles: ["admin"],
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: SettingsIcon,
        roles: ["admin"],
      },
    ],
  },
];

export function DashboardShell({
  children,
  hideTopLogout = false,
  profile,
  searchItems,
  lowStockAlerts,
  allowedNavHrefs,
}: DashboardShellProps) {
  const pathname = usePathname();
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const adminInitials = profile.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const isPosWorkspace = pathname.startsWith("/pos");
  const workspaceRoot = isPosWorkspace ? "/pos" : "/admin";
  // Role-aware labels so clerk/manager don't show as "Admin".
  const roleDisplay = profile.roles.includes("admin")
    ? { label: "Owner", console: "Owner Console" }
    : profile.roles.includes("manager")
      ? { label: "Manager", console: "Manager Console" }
      : profile.roles.includes("clerk")
        ? { label: "Inventory Clerk", console: "Inventory Console" }
        : profile.roles.includes("cashier")
          ? { label: "Cashier", console: "Cashier Console" }
          : { label: "Staff", console: "Console" };
  const workspaceTitle = roleDisplay.console;
  const workspaceRoleLabel = roleDisplay.label;
  const workspaceSidebarEyebrow = isPosWorkspace ? "Register" : "Operations";
  const workspaceSidebarTitle = isPosWorkspace ? "Cashier workspace" : "Owner workspace";
  const workspaceSidebarDescription = isPosWorkspace
    ? "Register, online orders, and receipts."
    : "Sales, stock, and analytics in one view.";

  const filteredSearchItems = searchItems.filter((item) => {
    if (!deferredQuery) {
      return true;
    }

    const keyword = deferredQuery.toLowerCase();
    const haystack = [item.title, item.subtitle, ...(item.keywords ?? [])]
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });

  const groupedSearchItems = [
    {
      label: "Orders",
      type: "order" as const,
    },
    {
      label: "Products",
      type: "product" as const,
    },
    {
      label: "Customers",
      type: "customer" as const,
    },
  ].map((group) => ({
    ...group,
    items: filteredSearchItems.filter((item) => item.type === group.type).slice(0, 5),
  }));
  const allowedHrefSet = allowedNavHrefs ? new Set(allowedNavHrefs) : null;
  const visibleNavSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.href.startsWith(workspaceRoot)) {
        return false;
      }
      if (allowedHrefSet) {
        return allowedHrefSet.has(item.href);
      }
      return item.roles.some((role) => profile.roles.includes(role));
    }),
  })).filter((section) => section.items.length > 0);
  const visibleNavItems = visibleNavSections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionLabel: section.label,
    })),
  );
  const showLogoutButton = !hideTopLogout || isPosWorkspace;

  function openCommandPalette() {
    setCommandOpen(true);
    setAlertsOpen(false);
    setMobileSidebarOpen(false);
  }

  function closeCommandPalette() {
    setCommandOpen(false);
    setQuery("");
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const syncCollapsedState = () => {
      setSidebarCollapsed(mediaQuery.matches);
    };

    syncCollapsedState();
    mediaQuery.addEventListener("change", syncCollapsedState);

    return () => {
      mediaQuery.removeEventListener("change", syncCollapsedState);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }

      if (event.key === "Escape") {
        closeCommandPalette();
        setAlertsOpen(false);
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) {
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(handle);
  }, [commandOpen]);

  const sidebarWidthClass = sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[228px]";
  const contentPaddingClass = sidebarCollapsed ? "lg:pl-[112px]" : "lg:pl-[252px]";

  return (
    <div className="min-h-screen bg-[#f5f8f6] text-[#0c1712]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_10%_-10%,rgba(13,148,136,0.08),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(14,165,233,0.05),transparent),linear-gradient(to_bottom,#f8faf9,#f0f4f2)]" />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-[78px] max-w-[1720px] items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {!isPosWorkspace ? (
              <>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen((current) => !current)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
                  aria-label="Toggle sidebar"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:inline-flex"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftIcon className="h-5 w-5" />
                </button>
              </>
            ) : null}

            <PageBackButton
              rootPath={workspaceRoot}
              fallbackHref={workspaceRoot}
            />

            <Link href={workspaceRoot} className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
                Coffee Shop POS
              </p>
              <p className="truncate text-sm font-semibold text-[#0c1712] sm:text-base">
                {workspaceTitle}
              </p>
            </Link>
          </div>

          {!isPosWorkspace ? (
            <div className="hidden flex-1 justify-center md:flex">
              <button
                type="button"
                onClick={openCommandPalette}
                className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#f5f8f6] px-4 py-3 text-left text-sm text-muted shadow-sm transition-all hover:border-primary/20 hover:bg-white hover:shadow-[0_4px_12px_-4px_rgba(13,148,136,0.1)]"
              >
                <SearchIcon className="h-4 w-4 text-slate-400" />
                <span className="flex-1">Search orders, products, customers by name or ID</span>
                <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Cmd K
                </span>
              </button>
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen((current) => !current);
                  closeCommandPalette();
                }}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label="View low-stock alerts"
              >
                <BellIcon className="h-5 w-5" />
                {lowStockAlerts.length > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {lowStockAlerts.length}
                  </span>
                ) : null}
              </button>

              {alertsOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[340px] rounded-[1.5rem] border border-black/[0.06] bg-white p-4 shadow-[var(--shadow-elevated)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Low-stock alerts</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Items that need attention soon.
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      {lowStockAlerts.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {lowStockAlerts.length > 0 ? (
                      lowStockAlerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{alert.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {alert.sku} • {alert.stockQuantity} left / threshold {alert.lowStockThreshold}
                              </p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Low
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        No low-stock alerts right now.
                      </div>
                    )}
                  </div>

                  {!isPosWorkspace ? (
                    <Link
                      href="/admin/inventory"
                      onClick={() => setAlertsOpen(false)}
                      className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      View all inventory {"->"}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="hidden items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 shadow-sm sm:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary">
                {adminInitials}
              </div>
              <div className="text-left">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary ring-1 ring-primary/20">
                  {workspaceRoleLabel}
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-950">{profile.fullName}</p>
              </div>
            </div>

            {showLogoutButton ? (
              <form action={staffLogoutAction}>
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950"
                >
                  Log out
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {isPosWorkspace ? (
          <div className="border-t border-slate-200/70 bg-white/70">
            <nav className="mx-auto flex max-w-[1720px] items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6">
              {visibleNavItems.map((item) => {
                const exactMatchOnly = item.href === "/admin" || item.href === "/pos";
                const active = exactMatchOnly
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition",
                      active
                        ? "border-[#0c1712] bg-[#0c1712] text-white shadow-[0_10px_24px_-18px_rgba(12,23,18,0.8)]"
                        : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-primary/25 hover:bg-primary/5 hover:text-primary",
                    )}
                    title={item.sectionLabel}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>

      {!isPosWorkspace && mobileSidebarOpen ? (
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden"
          aria-label="Close sidebar"
        />
      ) : null}

      {!isPosWorkspace ? (
        <aside
          className={cn(
            "fixed bottom-0 left-0 top-[78px] z-30 flex w-[248px] flex-col border-r border-white/[0.06] bg-gradient-to-b from-[#0c1712] to-[#0a1f1a] px-4 py-5 text-slate-200 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.15)] transition-transform duration-200 lg:translate-x-0",
            sidebarWidthClass,
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-6">
            <div
              className={cn(
                "rounded-[1.35rem] border border-white/8 bg-white/[0.05] px-4 py-4",
                sidebarCollapsed && "flex items-center justify-center px-0",
              )}
            >
              {sidebarCollapsed ? (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 font-mono text-sm font-semibold text-white">
                  TP
                </div>
              ) : (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-300">
                    {workspaceSidebarEyebrow}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{workspaceSidebarTitle}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {workspaceSidebarDescription}
                  </p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
            {visibleNavSections.map((section) => (
              <div key={section.label}>
                <p
                  className={cn(
                    "px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500",
                    sidebarCollapsed && "sr-only",
                  )}
                >
                  {section.label}
                </p>

                <div className="mt-2 space-y-1.5">
                  {section.items.map((item) => {
                    const exactMatchOnly = item.href === "/admin" || item.href === "/pos";
                    const active = exactMatchOnly
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-2xl border-l-4 px-3 py-3 text-sm font-medium transition",
                          active
                            ? "border-l-primary bg-primary/10 text-white shadow-[inset_0_0_0_1px_rgba(13,148,136,0.12)]"
                            : "border-l-transparent text-white/55 hover:bg-white/[0.05] hover:text-white",
                          sidebarCollapsed && "justify-center px-0",
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className={cn(sidebarCollapsed && "hidden")}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-6 space-y-3 border-t border-white/8 pt-4">
            <div className={cn("rounded-2xl bg-white/[0.05] px-4 py-3", sidebarCollapsed && "px-2")}>
              {sidebarCollapsed ? (
                <div className="flex justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-xs font-semibold text-white">
                    {adminInitials}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Signed in</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{profile.email}</p>
                </>
              )}
            </div>

            <form action={staffLogoutAction}>
              <Button
                variant="ghost"
                fullWidth
                type="submit"
                className={cn(
                  "h-11 rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.1] hover:text-white",
                  sidebarCollapsed && "px-0",
                )}
              >
                {sidebarCollapsed ? <LogoutIcon className="h-5 w-5" /> : "Log out"}
              </Button>
            </form>
          </div>
        </aside>
      ) : null}

      <div
        className={cn(
          isPosWorkspace ? "pt-[146px]" : "pt-[96px] transition-[padding] duration-200",
          !isPosWorkspace && contentPaddingClass,
        )}
      >
        <main className="relative mx-auto max-w-[1720px] px-4 pb-8 sm:px-6">{children}</main>
      </div>

      {commandOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30 px-4 py-24 backdrop-blur-[2px]">
          <div className="mx-auto max-w-3xl rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_40px_100px_-40px_rgba(15,23,42,0.3)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <SearchIcon className="h-5 w-5 text-slate-400" />
                <Input
                  ref={commandInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search orders, products, customers by name or ID"
                  className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={closeCommandPalette}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                >
                  Esc
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-6">
                {groupedSearchItems.some((group) => group.items.length > 0) ? (
                  groupedSearchItems.map((group) =>
                    group.items.length > 0 ? (
                      <div key={group.type}>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {group.label}
                        </p>
                        <div className="mt-3 space-y-2">
                          {group.items.map((item) => (
                            <Link
                              key={`${item.type}-${item.id}`}
                              href={item.href}
                              onClick={closeCommandPalette}
                              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <TypePill type={item.type} />
                                  <p className="truncate font-semibold text-slate-950">{item.title}</p>
                                </div>
                                <p className="mt-1 truncate text-sm text-slate-500">{item.subtitle}</p>
                              </div>
                              <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                    <p className="text-lg font-semibold text-slate-950">No matches found</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Try another order number, customer name, or product SKU.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TypePill({ type }: { type: AdminSearchItem["type"] }) {
  const label = type === "order" ? "Order" : type === "product" ? "Product" : "Customer";
  const className =
    type === "order"
      ? "bg-blue-50 text-blue-700"
      : type === "product"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-violet-50 text-violet-700";

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", className)}>
      {label}
    </span>
  );
}

function LayoutGridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function ReceiptIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 3h10v18l-2-1.5L12 21l-3-1.5L7 21V3Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function RegisterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 4h14v8H5z" />
      <path d="M7 16h10" />
      <path d="M8 20h8" />
      <path d="M9 8h6" />
      <path d="M4 20h16" />
      <path d="M7 12v4M17 12v4" />
    </svg>
  );
}

function OnlineOrdersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7h16" />
      <path d="M7 7V5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2" />
      <path d="M6 7v12a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function HistoryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PackageIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
    </svg>
  );
}

function LayersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

function TruckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M10 17H5a2 2 0 0 1-2-2V7h10v10Z" />
      <path d="M13 10h4l4 4v3h-2" />
      <path d="M10 17h4" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
    </svg>
  );
}

function BoxesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5Z" />
      <path d="M3 15.5 12 11l9 4.5-9 4.5-9-4.5Z" />
      <path d="M12 4v7M12 13v7" />
    </svg>
  );
}

function BarChartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-4" />
    </svg>
  );
}

function TrendingUpIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function BadgeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      <circle cx="12" cy="13" r="2" />
      <path d="M15 17a3 3 0 0 0-6 0" />
    </svg>
  );
}

function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1.18-1.66 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .36-1.98A1.8 1.8 0 0 0 3 13.9H2.9a2 2 0 1 1 0-4H3a1.8 1.8 0 0 0 1.66-1.18 1.8 1.8 0 0 0-.36-1.98l-.06-.06A2 2 0 0 1 7.07 3.8l.06.06a1.8 1.8 0 0 0 1.98.36H9.2A1.8 1.8 0 0 0 10.9 3H11a2 2 0 1 1 4 0h.09a1.8 1.8 0 0 0 1.66 1.18 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98V8.8A1.8 1.8 0 0 0 21 10.5h.1a2 2 0 1 1 0 4H21a1.8 1.8 0 0 0-1.6.5Z" />
    </svg>
  );
}

function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BellIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 17H5a2 2 0 0 1-1.8-2.9A8 8 0 0 0 4 10a8 8 0 1 1 16 0 8 8 0 0 0 .8 4.1A2 2 0 0 1 19 17h-4" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function ChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function PanelLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m14 10-2 2 2 2" />
    </svg>
  );
}

function LogoutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
