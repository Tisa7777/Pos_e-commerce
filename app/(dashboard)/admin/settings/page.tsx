import { PageHeader } from "@/components/ui/page-header";
import { CurrencySettingsCard } from "@/components/admin/currency-settings-card";
import { getCurrencySettings } from "@/lib/services/currency-settings";

export default async function SettingsPage() {
  const currency = await getCurrencySettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project settings"
        title="Settings"
        description="Configure currency, environment, and platform options."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CurrencySettingsCard
          initialRate={currency.khrRate}
          initialShowKhr={currency.showKhr}
          initialTaxPercent={currency.taxPercent}
        />
      </div>
    </div>
  );
}
