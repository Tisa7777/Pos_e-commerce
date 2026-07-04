"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Award, Check, Clock, Ticket } from "lucide-react";
import { redeemLoyaltyCouponAction } from "@/app/actions/loyalty";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOYALTY_REWARD_TIERS } from "@/lib/loyalty/tiers";
import { formatDate } from "@/lib/utils";
import type { ActionState } from "@/types/domain";
import type { LoyaltyCoupon } from "@/lib/services/loyalty";

const initialState: ActionState = { ok: false, message: "" };

export function LoyaltyRewards({
  loyaltyPoints,
  coupons,
}: {
  loyaltyPoints: number;
  coupons: LoyaltyCoupon[];
}) {
  const [state, formAction] = useActionState(redeemLoyaltyCouponAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl text-slate-950">Loyalty rewards</CardTitle>
        <CardDescription>
          Convert your points into a discount coupon to use at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          <Award aria-hidden={true} className="h-4 w-4" />
          {loyaltyPoints} points available
        </div>

        <form action={formAction} className="grid gap-3 sm:grid-cols-2">
          {LOYALTY_REWARD_TIERS.map((tier) => {
            const canRedeem = loyaltyPoints >= tier.points;
            return (
              <div
                key={tier.points}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <Ticket aria-hidden={true} className="h-5 w-5 text-primary" />
                  <p className="text-lg font-semibold text-slate-950">
                    {tier.discountPercent}% off coupon
                  </p>
                </div>
                <p className="text-sm text-slate-500">Costs {tier.points} loyalty points</p>
                <RedeemButton points={tier.points} disabled={!canRedeem}>
                  {canRedeem
                    ? `Redeem ${tier.points} points`
                    : `Need ${tier.points - loyaltyPoints} more points`}
                </RedeemButton>
              </div>
            );
          })}
        </form>

        <FormFeedback state={state} />

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Your coupons</p>
          {coupons.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No coupons yet. Redeem your points above to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {coupons.map((coupon) => (
                <CouponRow key={coupon.id} coupon={coupon} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CouponRow({ coupon }: { coupon: LoyaltyCoupon }) {
  const toneByStatus: Record<LoyaltyCoupon["status"], string> = {
    active: "border-emerald-200 bg-emerald-50",
    redeemed: "border-slate-200 bg-slate-50",
    expired: "border-slate-200 bg-slate-50",
  };

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${toneByStatus[coupon.status]}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{coupon.discountPercent}% off coupon</p>
        <p className="text-xs text-slate-500">
          {coupon.status === "active" ? "Use it at checkout" : `${coupon.discountPercent}% off`}
          {coupon.expiresAt ? ` · expires ${formatDate(coupon.expiresAt)}` : ""}
        </p>
      </div>
      <StatusBadge status={coupon.status} />
    </div>
  );
}

function StatusBadge({ status }: { status: LoyaltyCoupon["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Check aria-hidden={true} className="h-3.5 w-3.5" />
        Ready to use
      </span>
    );
  }

  if (status === "redeemed") {
    return (
      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Used
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Clock aria-hidden={true} className="h-3.5 w-3.5" />
      Expired
    </span>
  );
}

function RedeemButton({
  points,
  disabled,
  children,
}: {
  points: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="points"
      value={points}
      disabled={disabled || pending}
      className="mt-auto inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
    >
      {pending ? "Redeeming..." : children}
    </button>
  );
}
