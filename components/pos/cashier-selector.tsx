"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PosCashierOption, PosShiftSummary } from "@/types/domain";

export const POS_CASHIER_STORAGE_KEY = "tisa-pos-selected-cashier-v1";
export const POS_CASHIER_CHANGE_EVENT = "tisa:pos-cashier-changed";

export interface StoredPosCashier {
  id: string;
  name: string;
  profileId?: string | null;
}

interface PosCashierContextValue {
  options: PosCashierOption[];
  defaultCashier: PosCashierOption;
  openShifts: PosShiftSummary[];
  upsertOpenShift: (shift: PosShiftSummary) => void;
  removeOpenShift: (shiftId: string) => void;
}

const PosCashierContext = createContext<PosCashierContextValue | null>(null);

export function PosCashierProvider({
  children,
  defaultCashier,
  initialOpenShifts = [],
  options,
}: {
  children: ReactNode;
  defaultCashier: PosCashierOption;
  initialOpenShifts?: PosShiftSummary[];
  options: PosCashierOption[];
}) {
  const [openShifts, setOpenShifts] = useState(initialOpenShifts);
  const upsertOpenShift = useCallback((shift: PosShiftSummary) => {
    setOpenShifts((current) => {
      const withoutShift = current.filter((item) => item.id !== shift.id);
      return shift.status === "open" ? [shift, ...withoutShift] : withoutShift;
    });
  }, []);
  const removeOpenShift = useCallback((shiftId: string) => {
    setOpenShifts((current) => current.filter((shift) => shift.id !== shiftId));
  }, []);
  const value = useMemo(
    () => ({
      options,
      defaultCashier,
      openShifts,
      upsertOpenShift,
      removeOpenShift,
    }),
    [defaultCashier, openShifts, options, removeOpenShift, upsertOpenShift],
  );

  return (
    <PosCashierContext.Provider value={value}>
      {children}
    </PosCashierContext.Provider>
  );
}

export function usePosCashierContext() {
  return useContext(PosCashierContext);
}

export function normalizePosCashierOptions(
  options: PosCashierOption[],
  defaultCashier: PosCashierOption,
) {
  const seen = new Set<string>();

  return [defaultCashier, ...options].filter((option) => {
    const key = option.profileId || option.id || option.name;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function CashierSelector({
  options,
  defaultCashier,
}: {
  options: PosCashierOption[];
  defaultCashier: PosCashierOption;
}) {
  const defaultStoredCashier = useMemo(
    () => toStoredCashier(defaultCashier),
    [defaultCashier],
  );
  const normalizedOptions = useMemo(
    () => normalizePosCashierOptions(options, defaultCashier),
    [defaultCashier, options],
  );
  const storedCashier = useStoredPosCashier(defaultStoredCashier);
  const selectedCashier =
    normalizedOptions.find((option) => option.id === storedCashier.id) ??
    defaultCashier;

  useEffect(() => {
    publishCashier(selectedCashier);
  }, [selectedCashier]);

  function handleChange(nextId: string) {
    const nextCashier =
      normalizedOptions.find((option) => option.id === nextId) ?? defaultCashier;
    publishCashier(nextCashier);
  }

  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
      <label
        htmlFor="posCashierId"
        className="block text-[11px] uppercase tracking-[0.22em] text-slate-500"
      >
        Cashier
      </label>
      <select
        id="posCashierId"
        value={selectedCashier.id}
        onChange={(event) => handleChange(event.target.value)}
        className="mt-1 max-w-[170px] appearance-none bg-transparent text-right text-sm font-semibold text-slate-950 outline-none hover:text-primary"
        title="Select cashier for this POS sale"
      >
        {normalizedOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function useStoredPosCashier(fallbackCashier: StoredPosCashier) {
  const rawSnapshot = useSyncExternalStore(
    subscribeCashierStore,
    getStoredCashierRawSnapshot,
    getServerCashierRawSnapshot,
  );

  return useMemo(
    () => parseStoredCashier(rawSnapshot) ?? fallbackCashier,
    [fallbackCashier, rawSnapshot],
  );
}

export function readStoredCashier(): StoredPosCashier | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(POS_CASHIER_STORAGE_KEY);
    return parseStoredCashier(rawValue);
  } catch {
    return null;
  }
}

function subscribeCashierStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener(POS_CASHIER_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(POS_CASHIER_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getStoredCashierRawSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(POS_CASHIER_STORAGE_KEY) ?? "";
}

function getServerCashierRawSnapshot() {
  return "";
}

function parseStoredCashier(rawValue: string | null): StoredPosCashier | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPosCashier>;
    if (!parsed.id || !parsed.name) {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      profileId: parsed.profileId ?? null,
    };
  } catch {
    return null;
  }
}

export function toStoredCashier(
  cashier: StoredPosCashier | PosCashierOption,
): StoredPosCashier {
  return {
    id: cashier.id,
    name: cashier.name,
    profileId: cashier.profileId ?? null,
  };
}

export function publishCashier(cashier: StoredPosCashier | PosCashierOption) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = toStoredCashier(cashier);

  window.localStorage.setItem(POS_CASHIER_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(
    new CustomEvent<StoredPosCashier>(POS_CASHIER_CHANGE_EVENT, {
      detail: payload,
    }),
  );
}
