import { PosHistoryConsole } from "@/components/pos/pos-history-console";
import { listPosHistoryReceipts } from "@/lib/services/orders";
import { getCurrencySettings } from "@/lib/services/currency-settings";

export default async function PosHistoryPage() {
  const [receipts, currencySettings] = await Promise.all([
    listPosHistoryReceipts(),
    getCurrencySettings(),
  ]);

  return (
    <PosHistoryConsole
      receipts={receipts}
      khrRate={currencySettings.showKhr ? currencySettings.khrRate : 0}
    />
  );
}
