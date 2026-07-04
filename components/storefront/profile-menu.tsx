"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, LogOut, PackageCheck, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ProfileMenu({
  name,
  email,
  loyaltyPoints,
}: {
  name: string;
  email: string;
  loyaltyPoints: number | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(13,148,136,0.5)] transition-all hover:shadow-[0_8px_24px_-6px_rgba(13,148,136,0.6)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {getInitials(name)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_60px_-30px_rgba(12,23,18,0.5)] animate-in fade-in slide-in-from-top-2"
        >
          <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(13,148,136,0.08),rgba(255,255,255,0.96))] px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            {loyaltyPoints !== null ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Award aria-hidden={true} className="h-3.5 w-3.5" />
                {loyaltyPoints} loyalty points
              </p>
            ) : null}
          </div>

          <nav className="py-1.5 text-sm text-slate-700">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50 hover:text-primary"
            >
              <UserRound aria-hidden={true} className="h-4 w-4" />
              My profile
            </Link>
            <Link
              href="/orders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50 hover:text-primary"
            >
              <PackageCheck aria-hidden={true} className="h-4 w-4" />
              My orders
            </Link>
          </nav>

          <form action={logoutAction} className="border-t border-slate-100">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut aria-hidden={true} className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
