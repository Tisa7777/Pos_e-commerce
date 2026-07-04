import {
  CheckoutClient,
  type CheckoutAccount,
  type CheckoutCoupon,
} from "@/components/storefront/checkout-client";
import { getCurrentProfile } from "@/lib/auth/guards";
import { getCustomerAccountForProfile } from "@/lib/services/customers";
import { listCustomerCoupons } from "@/lib/services/loyalty";

export default async function CheckoutPage() {
  const profile = await getCurrentProfile();

  let account: CheckoutAccount | null = null;
  let coupons: CheckoutCoupon[] = [];

  if (profile) {
    const customerAccount = await getCustomerAccountForProfile(profile.id).catch(() => null);
    account = {
      name: customerAccount?.fullName ?? profile.fullName,
      email: customerAccount?.email || profile.email,
      phone: customerAccount?.phone ?? profile.phone ?? "",
    };

    if (customerAccount?.customerId) {
      const all = await listCustomerCoupons(customerAccount.customerId).catch(() => []);
      coupons = all
        .filter((coupon) => coupon.status === "active")
        .map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          discountPercent: coupon.discountPercent,
          expiresAt: coupon.expiresAt,
        }));
    }
  }

  return <CheckoutClient account={account} coupons={coupons} />;
}
