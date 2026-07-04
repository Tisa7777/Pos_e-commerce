import { notFound } from "next/navigation";
import { ReceiptCard } from "@/components/pos/receipt-card";
import { PrintReceiptButton } from "@/components/pos/print-receipt-button";
import { getReceipt } from "@/lib/services/orders";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getReceipt(id);

  if (!receipt) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
            Receipt
          </p>
          <h1 className="mt-2 font-mono text-lg font-semibold text-white">
            {receipt.order.orderNumber}
          </h1>
        </div>
        <PrintReceiptButton />
      </div>
      <ReceiptCard receipt={receipt} />
    </div>
  );
}
