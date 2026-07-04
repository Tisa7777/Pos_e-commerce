"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToPosLink() {
  const pathname = usePathname();

  if (pathname === "/pos") {
    return null;
  }

  return (
    <Link
      href="/pos"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-teal-200/80 bg-white px-4 text-sm font-semibold text-teal-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 hover:shadow-[0_8px_24px_-12px_rgba(13,148,136,0.45)]"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="hidden sm:inline">Back to POS</span>
      <span className="sm:hidden">POS</span>
    </Link>
  );
}
