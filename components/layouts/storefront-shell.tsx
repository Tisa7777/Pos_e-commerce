import type { PropsWithChildren } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GuestCartProvider } from "@/components/storefront/guest-cart-provider";
import {
  StorefrontHeader,
  type StorefrontHeaderAccount,
} from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { getCurrentProfile } from "@/lib/auth/guards";
import { getPermissionsForRoles, resolveStaffHome } from "@/lib/auth/permissions";
import { getCustomerAccountForProfile } from "@/lib/services/customers";

// Pages staff are still allowed to reach on the storefront: the guest-capable
// purchase flow and the public receipt. This keeps the order -> receipt demo
// working even when the same browser is signed in as staff, while staff are
// still kept out of the marketing/account pages.
const STAFF_ALLOWED_STOREFRONT_PATHS = ["/cart", "/checkout", "/order-confirmation"];

export async function StorefrontShell({ children }: PropsWithChildren) {
  const profile = await getCurrentProfile();

  // Staff are confined to their own workspace. Redirect them to the page their
  // permissions allow. If they have no granted workspace (home resolves to the
  // storefront), let them stay here — this avoids any redirect loop.
  if (
    profile &&
    profile.roles.some((role) => role !== "customer")
  ) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const isAllowed = STAFF_ALLOWED_STOREFRONT_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (!isAllowed) {
      const permissions = await getPermissionsForRoles(profile.roles);
      const home = resolveStaffHome(permissions, profile.roles);
      if (home !== "/shop") {
        redirect(home);
      }
    }
  }

  let account: StorefrontHeaderAccount | null = null;
  if (profile) {
    const customerAccount = await getCustomerAccountForProfile(profile.id).catch(() => null);
    account = {
      name: customerAccount?.fullName ?? profile.fullName,
      email: customerAccount?.email || profile.email,
      loyaltyPoints: customerAccount ? customerAccount.loyaltyPoints : null,
    };
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800">
      <GuestCartProvider>
        <StorefrontHeader account={account} />
        <main>{children}</main>
      </GuestCartProvider>
      <StorefrontFooter />
    </div>
  );
}
