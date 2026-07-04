import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { RegisterForm } from "@/components/forms/register-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return (
    <Card className="overflow-hidden border-white/80 bg-white/95 shadow-[0_24px_80px_-48px_rgba(12,23,18,0.55)] hover:shadow-[0_24px_80px_-48px_rgba(12,23,18,0.55)]">
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(13,148,136,0.1),rgba(255,255,255,0.96)_48%,rgba(245,158,11,0.12))] p-7">
        <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-lg border border-primary/15 bg-white/70 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          <BadgeCheck aria-hidden={true} className="h-3.5 w-3.5" />
          Member setup
        </div>
        <CardTitle className="font-serif text-3xl leading-tight text-slate-950">
          Create account
        </CardTitle>
        <CardDescription className="text-[15px]">
          Save your details for faster orders, pickup tracking, and loyalty rewards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-7">
        <RegisterForm />
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Already have an account?</p>
          <Button asChild variant="ghost" className="bg-white">
            <Link href="/login">
              Sign in
              <ArrowRight aria-hidden={true} className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
