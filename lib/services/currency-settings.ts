import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export interface StoreSettings {
  /** Exchange rate: 1 USD = X KHR */
  khrRate: number;
  /** Whether to show KHR on POS receipts */
  showKhr: boolean;
  /** Tax rate as a percentage (e.g. 10 means 10%) */
  taxPercent: number;
}

const DEFAULT_SETTINGS: StoreSettings = {
  khrRate: 4100,
  showKhr: true,
  taxPercent: 10,
};

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "currency-settings.json");

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreSettings>;
    return {
      khrRate:
        typeof parsed.khrRate === "number" && parsed.khrRate > 0
          ? parsed.khrRate
          : DEFAULT_SETTINGS.khrRate,
      showKhr:
        typeof parsed.showKhr === "boolean"
          ? parsed.showKhr
          : DEFAULT_SETTINGS.showKhr,
      taxPercent:
        typeof parsed.taxPercent === "number" && parsed.taxPercent >= 0
          ? parsed.taxPercent
          : DEFAULT_SETTINGS.taxPercent,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveStoreSettings(
  settings: StoreSettings,
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: StoreSettings = {
    khrRate: Math.max(1, Math.round(settings.khrRate)),
    showKhr: Boolean(settings.showKhr),
    taxPercent: Math.max(0, Math.min(100, Number(settings.taxPercent.toFixed(2)))),
  };
  await writeFile(SETTINGS_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

/** Kept for backward compatibility */
export type CurrencySettings = StoreSettings;
export const getCurrencySettings = getStoreSettings;
export const saveCurrencySettings = saveStoreSettings;
