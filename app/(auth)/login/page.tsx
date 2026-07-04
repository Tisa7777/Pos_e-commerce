import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getSafeRedirect(redirectTo?: string) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "";
  }

  return redirectTo;
}

function getLoginCopy(redirectTo: string) {
  if (redirectTo.startsWith("/pos")) {
    return {
      title: "Cashier sign in",
      description: "Use your cashier account to open the POS register.",
      submitLabel: "Sign in to POS",
    };
  }

  if (redirectTo.startsWith("/admin")) {
    return {
      title: "Owner sign in",
      description: "Use your staff account to manage the store.",
      submitLabel: "Sign in",
    };
  }

  return {
    title: "Log in",
    description: "Access your cafe account, order history, and rewards.",
    submitLabel: "Log in",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = getSafeRedirect(params.redirectTo);
  const copy = getLoginCopy(redirectTo);

  return (
    <Card className="overflow-hidden border-white/80 bg-white/95 shadow-[0_24px_80px_-48px_rgba(12,23,18,0.55)] hover:shadow-[0_24px_80px_-48px_rgba(12,23,18,0.55)]">
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(13,148,136,0.1),rgba(255,255,255,0.96)_48%,rgba(245,158,11,0.12))] p-7">
        <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-lg border border-primary/15 bg-white/70 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Secure access
        </div>
        <CardTitle className="font-serif text-3xl leading-tight text-slate-950">
          {copy.title}
        </CardTitle>
        <CardDescription className="text-[15px]">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-7">
        <LoginForm redirectTo={redirectTo} submitLabel={copy.submitLabel} />

        <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm ring-1 ring-amber-200/70">
                <UserPlus aria-hidden={true} className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">New customer?</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Create an account for faster checkout and rewards.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 bg-white">
              <Link href="/register">
                Create account
                <ArrowRight aria-hidden={true} className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
