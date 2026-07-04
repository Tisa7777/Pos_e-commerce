import Link from "next/link";
import { Award, PackageCheck, Wallet } from "lucide-react";
import { ProfileForm } from "@/components/forms/profile-form";
import { LoyaltyRewards } from "@/components/storefront/loyalty-rewards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getCustomerAccountForProfile } from "@/lib/services/customers";
import { listCustomerCoupons } from "@/lib/services/loyalty";
import { formatCurrency } from "@/lib/utils";

export default async function AccountPage() {
  const profile = await requireUser("/account");
  const account = await getCustomerAccountForProfile(profile.id);
  const coupons = account?.customerId ? await listCustomerCoupons(account.customerId) : [];

  const fullName = account?.fullName ?? profile.fullName;
  const email = account?.email || profile.email;
  const phone = account?.phone ?? profile.phone ?? "";
  const loyaltyPoints = account?.loyaltyPoints ?? 0;
  const visitCount = account?.visitCount ?? 0;
  const totalSpent = account?.totalSpent ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="My account"
        title={`Hi, ${fullName.split(" ")[0] || "there"}`}
        description="Manage your profile and track your loyalty rewards."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Award className="h-5 w-5 text-amber-500" />}
          label="Loyalty points"
          value={`${loyaltyPoints} pts`}
        />
        <StatCard
          icon={<PackageCheck className="h-5 w-5 text-[#0f766e]" />}
          label="Orders"
          value={String(visitCount)}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-[#0f766e]" />}
          label="Total spent"
          value={formatCurrency(totalSpent)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl text-slate-950">Profile details</CardTitle>
          <CardDescription>Update your name and contact number.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={fullName} email={email} phone={phone} />
        </CardContent>
      </Card>

      <LoyaltyRewards loyaltyPoints={loyaltyPoints} coupons={coupons} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Want to see your orders?</p>
          <p className="text-sm text-slate-500">Track your recent purchases and their status.</p>
        </div>
        <Button asChild variant="ghost" className="bg-white">
          <Link href="/orders">View orders</Link>
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
