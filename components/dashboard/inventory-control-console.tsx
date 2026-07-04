"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { adjustInventoryAction } from "@/app/actions/inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ADD_STOCK_REASON_OPTIONS,
  REMOVE_STOCK_REASON_OPTIONS,
  type InventoryAdjustmentMode,
} from "@/lib/inventory/options";
import { isStockTrackedProduct } from "@/lib/catalog/drink-sizes";
import { cn } from "@/lib/utils";
import type {
  ActionState,
  InventoryAdjustmentResult,
  InventoryMovementSummary,
  ProductCardData,
} from "@/types/domain";

interface InventoryControlConsoleProps {
  products: ProductCardData[];
  lowStockProducts: ProductCardData[];
  movements: InventoryMovementSummary[];
}

type MovementFilter = "all" | "sales" | "restocks" | "adjustments";
type IconProps = SVGProps<SVGSVGElement>;

const initialState: ActionState<InventoryAdjustmentResult> = {
  ok: false,
  message: "",
};

export function InventoryControlConsole({
  products,
  lowStockProducts,
  movements,
}: InventoryControlConsoleProps) {
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const appliedUpdateRef = useRef<string | null>(null);
  const [mode, setMode] = useState<InventoryAdjustmentMode>("add");
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [movementItems, setMovementItems] = useState(movements);
  const [selectedProductId, setSelectedProductId] = useState(
    lowStockProducts[0]?.id ?? products[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("1");
  const [addReason, setAddReason] = useState(ADD_STOCK_REASON_OPTIONS[0]?.value ?? "supplier_delivery");
  const [removeReason, setRemoveReason] = useState(REMOVE_STOCK_REASON_OPTIONS[0]?.value ?? "damaged");
  const [notes, setNotes] = useState("");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [state, formAction, isSubmitting] = useActionState(
    adjustInventoryAction,
    initialState,
  );

  useEffect(() => {
    setCatalogProducts(products);
  }, [products]);

  useEffect(() => {
    setMovementItems(movements);
  }, [movements]);

  const stockManagedProducts = catalogProducts.filter(isStockTrackedProduct);
  const lowStockItems = stockManagedProducts.filter(
    (product) => product.stockQuantity <= product.lowStockThreshold,
  );

  useEffect(() => {
    if (!state.ok || !state.data) {
      return;
    }

    const adjustment = state.data;

    const updateKey = `${adjustment.productId}:${adjustment.newStockQuantity}:${adjustment.quantityDelta}`;
    if (appliedUpdateRef.current === updateKey) {
      return;
    }

    appliedUpdateRef.current = updateKey;

    let updatedProductSku: string | null = null;
    setCatalogProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== adjustment.productId) {
          return product;
        }

        updatedProductSku = product.sku;
        return {
          ...product,
          stockQuantity: adjustment.newStockQuantity,
        };
      }),
    );

    setMovementItems((currentMovements) => [
      {
        id: `${updateKey}:${currentMovements.length}`,
        productId: adjustment.productId,
        productName: adjustment.productName,
        productSku: updatedProductSku,
        quantityDelta: adjustment.quantityDelta,
        movementType: adjustment.movementType,
        createdAt: new Date().toISOString(),
        reason: state.message,
        actorName: "Admin",
      },
      ...currentMovements,
    ]);
  }, [state]);

  const orderedProducts = [...stockManagedProducts].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const fallbackProductId = lowStockItems[0]?.id ?? orderedProducts[0]?.id ?? "";
  const effectiveSelectedProductId = orderedProducts.some(
    (product) => product.id === selectedProductId,
  )
    ? selectedProductId
    : fallbackProductId;
  const selectedProduct =
    orderedProducts.find((product) => product.id === effectiveSelectedProductId) ??
    orderedProducts[0] ??
    null;
  const activeReasonOptions =
    mode === "add" ? ADD_STOCK_REASON_OPTIONS : REMOVE_STOCK_REASON_OPTIONS;
  const activeReason = mode === "add" ? addReason : removeReason;
  const parsedQuantity = Math.max(Number(quantity) || 0, 1);
  const quantityDelta = mode === "add" ? parsedQuantity : -parsedQuantity;
  const previewStock = selectedProduct
    ? Math.max(selectedProduct.stockQuantity + quantityDelta, 0)
    : 0;

  const filteredMovements = movementItems.filter((movement) => {
    if (movementFilter === "sales") {
      return movement.movementType === "sale";
    }

    if (movementFilter === "restocks") {
      return movement.quantityDelta > 0;
    }

    if (movementFilter === "adjustments") {
      return movement.quantityDelta < 0 && movement.movementType !== "sale";
    }

    return true;
  });

  function updateQuantity(nextValue: string) {
    if (nextValue === "") {
      setQuantity("");
      return;
    }

    const sanitized = nextValue.replace(/[^\d]/g, "");
    setQuantity(sanitized === "" ? "1" : sanitized);
  }

  function stepQuantity(direction: "decrease" | "increase") {
    const nextQuantity =
      direction === "increase"
        ? parsedQuantity + 1
        : Math.max(parsedQuantity - 1, 1);
    setQuantity(String(nextQuantity));
  }

  function prefillRestock(product: ProductCardData) {
    setMode("add");
    setSelectedProductId(product.id);
    setAddReason("supplier_delivery");
    setNotes("");
    setQuantity(String(Math.max(product.lowStockThreshold - product.stockQuantity, 1)));

    window.requestAnimationFrame(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
              Stock actions
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Add stock or record removals safely
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Split workflows reduce mistakes during restocking, recounts, and shrinkage updates.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <ModeTab
                active={mode === "add"}
                description="Record incoming stock with a positive quantity."
                icon={<PlusIcon className="h-4 w-4" />}
                label="+ Add Stock"
                onClick={() => setMode("add")}
                tone="add"
              />
              <ModeTab
                active={mode === "remove"}
                description="Record damaged, expired, or manual stock reductions."
                icon={<MinusIcon className="h-4 w-4" />}
                label="- Remove / Adjust"
                onClick={() => setMode("remove")}
                tone="remove"
              />
            </div>

            <form action={formAction} className="space-y-5">
              <input type="hidden" name="mode" value={mode} />

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <FieldShell
                  label="Product"
                  error={state.fieldErrors?.productId?.[0]}
                >
                  <Select
                    id="productId"
                    name="productId"
                    value={effectiveSelectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className={fieldClassName(Boolean(state.fieldErrors?.productId?.[0]))}
                  >
                    {orderedProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.stockQuantity} in stock)
                      </option>
                    ))}
                  </Select>
                </FieldShell>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <StockMetricCard
                    label="Current stock"
                    tone={mode === "add" ? "add" : "remove"}
                    value={selectedProduct ? `${selectedProduct.stockQuantity}` : "--"}
                  />
                  <StockMetricCard
                    label="Low-stock threshold"
                    tone="neutral"
                    value={selectedProduct ? `${selectedProduct.lowStockThreshold}` : "--"}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <FieldShell
                  label={mode === "add" ? "Quantity to add" : "Quantity to remove"}
                  error={state.fieldErrors?.quantity?.[0]}
                >
                  <div className="flex items-center gap-3">
                    <StepperButton
                      label="Decrease quantity"
                      onClick={() => stepQuantity("decrease")}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </StepperButton>
                    <Input
                      ref={quantityInputRef}
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(event) => updateQuantity(event.target.value)}
                      className={cn(
                        "text-center font-mono text-lg font-semibold text-slate-950",
                        fieldClassName(Boolean(state.fieldErrors?.quantity?.[0])),
                      )}
                    />
                    <StepperButton
                      label="Increase quantity"
                      onClick={() => stepQuantity("increase")}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </StepperButton>
                  </div>
                </FieldShell>

                <FieldShell label="Reason" error={state.fieldErrors?.reason?.[0]}>
                  <Select
                    id="reason"
                    name="reason"
                    value={activeReason}
                    onChange={(event) => {
                      if (mode === "add") {
                        setAddReason(event.target.value as typeof addReason);
                      } else {
                        setRemoveReason(event.target.value as typeof removeReason);
                      }
                    }}
                    className={fieldClassName(Boolean(state.fieldErrors?.reason?.[0]))}
                  >
                    {activeReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FieldShell>
              </div>

              {activeReason === "other" ? (
                <FieldShell
                  label="Notes"
                  helper="Add the missing context so future stock reviews are easy to understand."
                  error={state.fieldErrors?.notes?.[0]}
                >
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder={
                      mode === "add"
                        ? "Example: emergency transfer from another branch."
                        : "Example: 2 units discarded after end-of-day inspection."
                    }
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={cn(
                      "min-h-24",
                      fieldClassName(Boolean(state.fieldErrors?.notes?.[0])),
                    )}
                  />
                </FieldShell>
              ) : null}

              {selectedProduct ? (
                <div
                  className={cn(
                    "rounded-[1.35rem] border px-4 py-4",
                    mode === "add"
                      ? "border-emerald-200 bg-emerald-50/80"
                      : "border-rose-200 bg-rose-50/80",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Preview
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {selectedProduct.name}: {selectedProduct.stockQuantity} {"->"} {previewStock}{" "}
                    <span
                      className={cn(
                        "font-mono",
                        quantityDelta > 0 ? "text-emerald-700" : "text-rose-700",
                      )}
                    >
                      ({quantityDelta > 0 ? `+${quantityDelta}` : quantityDelta})
                    </span>
                  </p>
                </div>
              ) : null}

              <ActionFeedback state={state} />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  {mode === "add"
                    ? "Add Stock only allows positive quantities."
                    : "Remove / Adjust always records a negative movement automatically."}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className={cn(
                    "min-w-[220px] rounded-2xl px-6",
                    mode === "add"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-rose-600 text-white hover:bg-rose-700",
                  )}
                  disabled={isSubmitting || !selectedProduct}
                >
                  {isSubmitting
                    ? mode === "add"
                      ? "Adding stock..."
                      : "Recording removal..."
                    : mode === "add"
                      ? "Add Stock"
                      : "Record Removal"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <aside className="rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-600">
              Low-stock watchlist
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Quick restock shortcuts
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tap a product to prefill the stock form and move straight into the add flow.
            </p>
          </div>

          <div className="space-y-4 p-6">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((product) => {
                const threshold = Math.max(product.lowStockThreshold, 1);
                const progress = Math.max(
                  8,
                  Math.min((product.stockQuantity / threshold) * 100, 100),
                );

                return (
                  <div
                    key={product.id}
                    className="rounded-[1.5rem] border border-amber-200 bg-amber-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{product.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="warning">{product.category?.name ?? "Uncategorized"}</Badge>
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            SKU {product.sku}
                          </span>
                        </div>
                      </div>
                      <Badge tone="danger">{product.stockQuantity} left</Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Current stock bar</span>
                        <span className="font-mono">
                          {product.stockQuantity}/{product.lowStockThreshold} threshold
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-rose-100">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-500">
                        Suggested add: {Math.max(product.lowStockThreshold - product.stockQuantity, 1)}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => prefillRestock(product)}
                      >
                        + Restock
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                <p className="text-lg font-semibold text-slate-950">
                  No low-stock items right now
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Inventory is above threshold across the catalog. You are all caught up.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-700">
              Recent movements
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Live stock movement log
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review sales, restocks, and manual adjustments without leaving the inventory page.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "all", label: "All" },
              { key: "sales", label: "Sales" },
              { key: "restocks", label: "Restocks" },
              { key: "adjustments", label: "Adjustments" },
            ] as const).map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setMovementFilter(filter.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  movementFilter === filter.key
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMovements.length > 0 ? (
          <div className="overflow-x-auto px-2 py-2">
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Product</TH>
                  <TH>Change</TH>
                  <TH>Reason</TH>
                  <TH>Admin</TH>
                </TR>
              </THead>
              <TBody>
                {filteredMovements.map((movement) => (
                  <TR key={movement.id} className="hover:bg-slate-50">
                    <TD>
                      <div>
                        <p className="font-medium text-slate-900">
                          {format(new Date(movement.createdAt), "h:mm a")}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {format(new Date(movement.createdAt), "MMM d")}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <div>
                        <p className="font-semibold text-slate-950">{movement.productName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {movement.productSku ? `SKU ${movement.productSku}` : "Inventory item"}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex min-w-[76px] items-center justify-center rounded-full px-3 py-1.5 font-mono text-sm font-semibold",
                          movement.quantityDelta > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700",
                        )}
                      >
                        {movement.quantityDelta > 0
                          ? `+${movement.quantityDelta}`
                          : movement.quantityDelta}
                      </span>
                    </TD>
                    <TD className="max-w-[320px] text-slate-600">
                      {movement.reason ?? "No reason provided"}
                    </TD>
                    <TD>{movement.actorName ?? "System"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <div className="px-6 py-12">
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-slate-950">
                No movements for this filter yet
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try another filter or record a stock update to populate the table.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ModeTab({
  active,
  description,
  icon,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  description: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "add" | "remove";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.4rem] border px-4 py-4 text-left transition",
        active
          ? tone === "add"
            ? "border-emerald-200 bg-emerald-50 shadow-[inset_4px_0_0_0_rgba(5,150,105,0.8)]"
            : "border-rose-200 bg-rose-50 shadow-[inset_4px_0_0_0_rgba(225,29,72,0.8)]"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full",
            tone === "add" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
    </button>
  );
}

function FieldShell({
  children,
  error,
  helper,
  label,
}: {
  children: ReactNode;
  error?: string;
  helper?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-rose-600">{error}</p>
      ) : helper ? (
        <p className="text-sm text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}

function ActionFeedback({
  state,
}: {
  state: ActionState<InventoryAdjustmentResult>;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[1.35rem] border px-4 py-4 text-sm",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
          state.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
        )}
      >
        {state.ok ? <CheckIcon className="h-3.5 w-3.5" /> : <AlertIcon className="h-3.5 w-3.5" />}
      </span>
      <div>
        <p className="font-semibold">
          {state.ok ? "Stock update saved" : "Unable to save stock update"}
        </p>
        <p className="mt-1">{state.message}</p>
        {!state.ok && state.fieldErrors ? (
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(state.fieldErrors).flatMap(([field, errors]) =>
              (errors ?? []).map((error) => (
                <li key={`${field}-${error}`} className="text-rose-700">
                  {error}
                </li>
              )),
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function StockMetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "add" | "remove" | "neutral";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border px-4 py-4",
        tone === "add"
          ? "border-emerald-200 bg-emerald-50/80"
          : tone === "remove"
            ? "border-rose-200 bg-rose-50/80"
            : "border-slate-200 bg-slate-50",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StepperButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
    >
      {children}
    </button>
  );
}

function fieldClassName(hasError: boolean) {
  return hasError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : "";
}

function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m5 12.5 4.5 4.5L19 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M12 8v5m0 3h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94A2 2 0 0 0 22.18 18l-8.47-14.14a2 2 0 0 0-3.42 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
