import type { PropsWithChildren } from "react";
import { StorefrontShell } from "@/components/layouts/storefront-shell";

export default function StorefrontLayout({ children }: PropsWithChildren) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
