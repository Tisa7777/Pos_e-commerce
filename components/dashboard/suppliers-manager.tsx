"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingToast } from "@/components/ui/floating-toast";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProductCardData, SupplierSummary } from "@/types/domain";

interface SuppliersManagerProps {
  initialSuppliers: SupplierSummary[];
  products: ProductCardData[];
}

interface SupplierDraft {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  productIds: string[];
}

const TOAST_DURATION_MS = 2600;
const CAMBODIA_PREFIX = "+855 ";

export function SuppliersManager({
  initialSuppliers,
  products,
}: SuppliersManagerProps) {
  const [suppliers, setSuppliers] = useState(sortSuppliers(initialSuppliers));
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(emptySupplierDraft());
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [busySupplierId, setBusySupplierId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(""), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  function showToast(message: string, tone: "success" | "error" = "success") {
    setToastTone(tone);
    setToastMessage(message);
  }

  function openCreatePanel() {
    setPanelMode("create");
    setEditingSupplierId(null);
    setDraft(emptySupplierDraft());
    setErrors({});
  }

  function openEditPanel(supplier: SupplierSummary) {
    setPanelMode("edit");
    setEditingSupplierId(supplier.id);
    setDraft({
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? CAMBODIA_PREFIX,
      notes: supplier.notes ?? "",
      productIds: supplier.suppliedProducts?.map((product) => product.id) ?? [],
    });
    setErrors({});
  }

  function closePanel() {
    setPanelMode(null);
    setEditingSupplierId(null);
    setDraft(emptySupplierDraft());
    setErrors({});
  }

  function toggleProduct(productId: string) {
    setDraft((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  }

  async function handleSaveSupplier() {
    const successMessage = panelMode === "edit" ? "Supplier saved" : "Supplier added";
    setIsSaving(true);
    const result =
      panelMode === "edit" && editingSupplierId
        ? await updateSupplierAction({
            id: editingSupplierId,
            ...draft,
          })
        : await createSupplierAction(draft);
    setIsSaving(false);

    if (!result.ok || !result.data) {
      setErrors(result.fieldErrors ?? {});
      showToast(result.message, "error");
      return;
    }

    setSuppliers((current) =>
      reconcileSupplierAssignments(current, result.data!, draft.productIds),
    );
    closePanel();
    showToast(successMessage);
  }

  async function handleDeleteSupplier(supplier: SupplierSummary) {
    const productCount = supplier.productCount ?? 0;
    const confirmed = window.confirm(
      `This will unlink ${productCount} products. Are you sure?`,
    );

    if (!confirmed) {
      return;
    }

    setBusySupplierId(supplier.id);
    const result = await deleteSupplierAction({ id: supplier.id });
    setBusySupplierId(null);

    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }

    setSuppliers((current) =>
      current.filter((existingSupplier) => existingSupplier.id !== supplier.id),
    );
    if (editingSupplierId === supplier.id) {
      closePanel();
    }
    showToast("Supplier removed");
  }

  return (
    <div className="space-y-6">
      <FloatingToast message={toastMessage} tone={toastTone} />

      <PageHeader
        eyebrow="Supply chain"
        title="Suppliers"
        description="Track vendor contacts, supplied products, and quick outreach without leaving the admin console."
        action={(
          <Button onClick={openCreatePanel} className="bg-teal-600 text-white hover:bg-teal-700">
            <PremiumIcon name="plus" className="h-4 w-4" />
            New Supplier
          </Button>
        )}
      />

      {suppliers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="border-slate-200 bg-white">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      {supplier.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Contact: {supplier.contactName ?? "No primary contact"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ActionChip onClick={() => openEditPanel(supplier)}>
                      <PremiumIcon name="edit" className="h-3.5 w-3.5" />
                      Edit
                    </ActionChip>
                    {supplier.email ? (
                      <ActionChip asLink href={`mailto:${supplier.email}`}>
                        <PremiumIcon name="mail" className="h-3.5 w-3.5" />
                        Email
                      </ActionChip>
                    ) : null}
                    {supplier.phone ? (
                      <ActionChip asLink href={`tel:${supplier.phone.replace(/\s+/g, "")}`}>
                        <PremiumIcon name="phone" className="h-3.5 w-3.5" />
                        Call
                      </ActionChip>
                    ) : null}
                    <ActionChip
                      tone="danger"
                      onClick={() => handleDeleteSupplier(supplier)}
                      disabled={busySupplierId === supplier.id}
                    >
                      <PremiumIcon name="delete" className="h-3.5 w-3.5" />
                      Delete
                    </ActionChip>
                  </div>
                </div>

                <div className="space-y-2 rounded-[1.2rem] bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p>Email: {supplier.email ?? "Not provided"}</p>
                  <p>Phone: {supplier.phone ?? "Not provided"}</p>
                  <p className="inline-flex items-center gap-2">
                    <PremiumIcon name="supplies" className="h-4 w-4" />
                    Supplies: {formatSuppliedProducts(supplier)}
                  </p>
                  {supplier.notes ? <p>Notes: {supplier.notes}</p> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-slate-200 bg-slate-50">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="space-y-2">
              <p className="text-xl font-semibold text-slate-950">
                No suppliers yet — add your first one
              </p>
              <p className="max-w-lg text-sm leading-6 text-slate-500">
                Supplier records keep restocks, purchasing notes, and product sourcing visible for the admin team.
              </p>
            </div>
            <Button onClick={openCreatePanel} className="bg-teal-600 text-white hover:bg-teal-700">
              <PremiumIcon name="plus" className="h-4 w-4" />
              New Supplier
            </Button>
          </CardContent>
        </Card>
      )}

      {panelMode ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[0_30px_90px_-32px_rgba(15,23,42,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                  {panelMode === "edit" ? "Edit supplier" : "New supplier"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {panelMode === "edit" ? "Update supplier details" : "Register a new supplier"}
                </h2>
              </div>
              <Button variant="ghost" onClick={closePanel}>
                Cancel
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Supplier name" error={errors.name?.[0]} className="md:col-span-2">
                  <Input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="City Bakery Hub"
                    className={fieldClassName(Boolean(errors.name?.[0]))}
                  />
                </Field>

                <Field label="Contact person" error={errors.contactName?.[0]}>
                  <Input
                    value={draft.contactName}
                    onChange={(event) => setDraft({ ...draft, contactName: event.target.value })}
                    placeholder="Dara Lim"
                    className={fieldClassName(Boolean(errors.contactName?.[0]))}
                  />
                </Field>

                <Field label="Phone" error={errors.phone?.[0]}>
                  <Input
                    value={draft.phone}
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                    placeholder={CAMBODIA_PREFIX}
                    className={fieldClassName(Boolean(errors.phone?.[0]))}
                  />
                </Field>

                <Field label="Email" error={errors.email?.[0]}>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    placeholder="orders@citybakery.example"
                    className={fieldClassName(Boolean(errors.email?.[0]))}
                  />
                </Field>

                <Field label="Notes" error={errors.notes?.[0]} className="md:col-span-2">
                  <Textarea
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    placeholder="Delivery days, preferred reorder lead times, or account notes."
                    className={cn("min-h-28", fieldClassName(Boolean(errors.notes?.[0])))}
                  />
                </Field>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-700">Products supplied</h3>
                    <p className="text-sm text-slate-500">
                      Select one or more products to link to this supplier.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {draft.productIds.length} selected
                  </span>
                </div>

                {errors.productIds?.[0] ? (
                  <p className="text-sm text-rose-600">{errors.productIds[0]}</p>
                ) : null}

                <div className="grid max-h-[320px] gap-3 overflow-y-auto rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  {sortedProducts.map((product) => {
                    const checked = draft.productIds.includes(product.id);

                    return (
                      <label
                        key={product.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-[1.1rem] border px-4 py-3 transition",
                          checked
                            ? "border-teal-200 bg-white shadow-[inset_4px_0_0_0_rgba(13,148,136,0.75)]"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(product.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600"
                        />
                        <div>
                          <p className="font-medium text-slate-950">{product.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {product.sku}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <Button variant="ghost" onClick={closePanel}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveSupplier}
                disabled={isSaving}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSaving ? "Saving..." : "Save Supplier"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionChip({
  asLink = false,
  children,
  disabled,
  href,
  onClick,
  tone = "default",
}: {
  asLink?: boolean;
  children: ReactNode;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-slate-950",
    disabled && "pointer-events-none opacity-60",
  );

  if (asLink && href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

function Field({
  children,
  className,
  error,
  label,
}: {
  children: ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

function emptySupplierDraft(): SupplierDraft {
  return {
    name: "",
    contactName: "",
    email: "",
    phone: CAMBODIA_PREFIX,
    notes: "",
    productIds: [],
  };
}

function formatSuppliedProducts(supplier: SupplierSummary) {
  if (!supplier.suppliedProducts?.length) {
    return "No products linked yet";
  }

  return supplier.suppliedProducts.map((product) => product.name).join(", ");
}

function sortSuppliers(suppliers: SupplierSummary[]) {
  return [...suppliers].sort((left, right) => left.name.localeCompare(right.name));
}

function reconcileSupplierAssignments(
  currentSuppliers: SupplierSummary[],
  updatedSupplier: SupplierSummary,
  selectedProductIds: string[],
) {
  const updated = currentSuppliers
    .map((supplier) => {
      if (supplier.id === updatedSupplier.id) {
        return updatedSupplier;
      }

      const remainingProducts = (supplier.suppliedProducts ?? []).filter(
        (product) => !selectedProductIds.includes(product.id),
      );

      return {
        ...supplier,
        suppliedProducts: remainingProducts,
        productCount: remainingProducts.length,
      };
    })
    .filter(Boolean);

  if (!updated.some((supplier) => supplier.id === updatedSupplier.id)) {
    updated.push(updatedSupplier);
  }

  return sortSuppliers(updated);
}

function fieldClassName(hasError: boolean) {
  return hasError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : "";
}
