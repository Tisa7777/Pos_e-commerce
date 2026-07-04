"use client";

import { Button } from "@/components/ui/button";
import { printReceiptElement } from "@/lib/print-receipt";

export function PrintReceiptButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => printReceiptElement()}
      className="border border-slate-200 bg-white text-slate-950 hover:bg-slate-50 print:hidden"
    >
      Print receipt
    </Button>
  );
}
