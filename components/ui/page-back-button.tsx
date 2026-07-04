"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PageBackButton({
  className,
  fallbackHref,
  hideOnRoot = true,
  label = "Back",
  rootPath,
}: {
  className?: string;
  fallbackHref?: string;
  hideOnRoot?: boolean;
  label?: string;
  rootPath: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (hideOnRoot && pathname === rootPath) {
    return null;
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref ?? rootPath);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        "group inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 text-sm font-medium text-muted shadow-sm",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-x-0.5 hover:border-primary/20 hover:bg-white hover:text-primary hover:shadow-[0_4px_14px_-4px_rgba(13,148,136,0.2)]",
        className,
      )}
    >
      <svg
        className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
