"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  addCustomerPointsAction,
  createCustomerAction,
  deleteCustomerAction,
  saveCustomerDiscountAction,
  updateCustomerAction,
} from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingToast } from "@/components/ui/floating-toast";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getCustomerSegment,
  isCustomerDiscountActive,
} from "@/lib/crm/customer-metadata";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type {
  CustomerOrderHistoryEntry,
  CustomerSummary,
} from "@/types/domain";

interface CustomersCrmProps {
  initialCustomers: CustomerSummary[];
  initialOrderHistory: Record<string, CustomerOrderHistoryEntry[]>;
}

type CustomerFilter = "all" | "account" | "guest" | "vip" | "regular" | "walk-in";
type SortKey = "name" | "visits" | "spent" | "points";
type PanelMode = "create" | "edit" | "detail" | null;

interface CustomerDraft {
  fullName: string;
  email: string;
  phone: string;
  loyaltyPoints: string;
  notes: string;
  discountPercent: string;
  discountExpiresAt: string;
}

const TOAST_DURATION_MS = 2600;
const CAMBODIA_PREFIX = "+855 ";
const DISCOUNT_PRESETS = [0, 5, 10, 15, 20];

export function CustomersCrm({
  initialCustomers,
  initialOrderHistory,
}: CustomersCrmProps) {
  const [customers, setCustomers] = useState(sortCustomers(initialCustomers, "name", "asc"));
  const [orderHistory, setOrderHistory] = useState(initialOrderHistory);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerDraft>(emptyCustomerDraft());
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState("5");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountExpiryInput, setDiscountExpiryInput] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const filteredCustomers = sortCustomers(
    customers.filter((customer) => {
      const keyword = query.trim().toLowerCase();
      const matchesQuery =
        !keyword ||
        [customer.fullName, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(keyword));

      if (!matchesQuery) {
        return false;
      }

      if (filter === "account") {
        return customer.hasAccount === true;
      }

      if (filter === "guest") {
        return customer.hasAccount === false;
      }

      if (filter === "vip") {
        return customer.segment === "vip";
      }

      if (filter === "walk-in") {
        return customer.segment === "walk-in";
      }

      if (filter === "regular") {
        return customer.segment === "regular" || customer.segment === "new";
      }

      return true;
    }),
    sortKey,
    sortDirection,
  );

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const selectedHistory = selectedCustomerId ? orderHistory[selectedCustomerId] ?? [] : [];

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
    setSelectedCustomerId(null);
    setDraft(emptyCustomerDraft());
    setErrors({});
  }

  function openEditPanel(customer: CustomerSummary) {
    setPanelMode("edit");
    setSelectedCustomerId(customer.id);
    setDraft({
      fullName: customer.fullName,
      email: customer.email ?? "",
      phone: customer.phone ?? CAMBODIA_PREFIX,
      loyaltyPoints: String(customer.loyaltyPoints ?? 0),
      notes: customer.notes ?? "",
      discountPercent: String(customer.discountPercent ?? 0),
      discountExpiresAt: customer.discountExpiresAt?.slice(0, 10) ?? "",
    });
    setErrors({});
  }

  function openDetailPanel(customer: CustomerSummary) {
    setPanelMode("detail");
    setSelectedCustomerId(customer.id);
    setPointsInput("5");
    setDiscountInput(String(customer.discountPercent ?? 0));
    setDiscountExpiryInput(customer.discountExpiresAt?.slice(0, 10) ?? "");
    setErrors({});
  }

  function closePanel() {
    setPanelMode(null);
    setSelectedCustomerId(null);
    setConfirmingDeleteId(null);
    setErrors({});
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "name" ? "asc" : "desc");
  }

  function downloadCsv() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Visits",
      "Total Spent",
      "Loyalty Points",
      "Discount Percent",
      "Last Seen",
    ];
    const rows = filteredCustomers.map((customer) => [
      customer.fullName,
      customer.email ?? "",
      customer.phone ?? "",
      String(customer.visitCount ?? 0),
      String(customer.totalSpent ?? 0),
      String(customer.loyaltyPoints ?? 0),
      String(customer.discountPercent ?? 0),
      customer.lastSeenAt ? formatDate(customer.lastSeenAt) : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveCustomer() {
    setIsSaving(true);
    const payload = {
      ...draft,
      loyaltyPoints: Number(draft.loyaltyPoints) || 0,
      discountPercent: Number(draft.discountPercent) || 0,
      discountExpiresAt: draft.discountExpiresAt || null,
    };
    const result =
      panelMode === "edit" && selectedCustomerId
        ? await updateCustomerAction({ id: selectedCustomerId, ...payload })
        : await createCustomerAction(payload);
    setIsSaving(false);

    if (!result.ok || !result.data) {
      setErrors(result.fieldErrors ?? {});
      showToast(result.message, "error");
      return;
    }

    const savedCustomer = withDerivedCustomerFields(result.data);
    setCustomers((current) =>
      sortCustomers(
        panelMode === "edit"
          ? current.map((customer) =>
              customer.id === savedCustomer.id ? savedCustomer : customer,
            )
          : [...current, savedCustomer],
        sortKey,
        sortDirection,
      ),
    );
    setOrderHistory((current) => ({
      ...current,
      [savedCustomer.id]: current[savedCustomer.id] ?? [],
    }));
    closePanel();
    showToast("Customer saved");
  }

  async function handleAddPoints() {
    if (!selectedCustomer) {
      return;
    }

    const pointsToAdd = Number(pointsInput) || 0;
    if (pointsToAdd <= 0) {
      showToast("Enter a points amount greater than zero.", "error");
      return;
    }

    setBusyCustomerId(selectedCustomer.id);
    const result = await addCustomerPointsAction({
      id: selectedCustomer.id,
      pointsToAdd,
    });
    setBusyCustomerId(null);

    if (!result.ok || !result.data) {
      showToast(result.message, "error");
      return;
    }

    const updatedCustomer = withDerivedCustomerFields(result.data);
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === updatedCustomer.id ? updatedCustomer : customer,
      ),
    );
    setPointsInput("5");
    showToast(`${updatedCustomer.fullName}: loyalty points updated`);
  }

  async function handleSaveDiscount(percentOverride?: number) {
    if (!selectedCustomer) {
      return;
    }

    const discountPercent = percentOverride ?? (Number(discountInput) || 0);
    setBusyCustomerId(selectedCustomer.id);
    const result = await saveCustomerDiscountAction({
      id: selectedCustomer.id,
      notes: selectedCustomer.notes ?? undefined,
      discountPercent,
      discountExpiresAt: discountExpiryInput || null,
    });
    setBusyCustomerId(null);

    if (!result.ok || !result.data) {
      showToast(result.message, "error");
      return;
    }

    const updatedCustomer = withDerivedCustomerFields(result.data);
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === updatedCustomer.id ? updatedCustomer : customer,
      ),
    );
    setDiscountInput(String(discountPercent));
    showToast(`${updatedCustomer.fullName}: ${discountPercent}% discount saved`);
  }

  function requestDeleteCustomer() {
    if (!selectedCustomer) {
      return;
    }
    setConfirmingDeleteId(selectedCustomer.id);
  }

  function cancelDeleteCustomer() {
    setConfirmingDeleteId(null);
  }

  async function confirmDeleteCustomer() {
    if (!selectedCustomer) {
      return;
    }

    setBusyCustomerId(selectedCustomer.id);
    const result = await deleteCustomerAction({ id: selectedCustomer.id });
    setBusyCustomerId(null);

    if (!result.ok) {
      setConfirmingDeleteId(null);
      showToast(result.message, "error");
      return;
    }

    setCustomers((current) =>
      current.filter((customer) => customer.id !== selectedCustomer.id),
    );
    setOrderHistory((current) => {
      const next = { ...current };
      delete next[selectedCustomer.id];
      return next;
    });
    setConfirmingDeleteId(null);
    closePanel();
    showToast("Customer removed");
  }

  return (
    <div className="space-y-6">
      <FloatingToast message={toastMessage} tone={toastTone} />

      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Track visit frequency, loyalty, discount status, and order history from one customer operations view."
        action={(
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={downloadCsv}
            >
              Export CSV
            </Button>
            <Button
              onClick={openCreatePanel}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              <PremiumIcon name="plus" className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.16)]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers by name, email, or phone"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: "all", label: "All" },
            { key: "account", label: "Account" },
            { key: "guest", label: "Guest" },
            { key: "vip", label: "VIP" },
            { key: "regular", label: "Regular" },
            { key: "walk-in", label: "Walk-in" },
          ] as const).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                filter === option.key
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredCustomers.length > 0 ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)]">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>
                    <SortButton
                      active={sortKey === "name"}
                      direction={sortDirection}
                      onClick={() => toggleSort("name")}
                    >
                      Avatar / Name
                    </SortButton>
                  </TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH>
                    <SortButton
                      active={sortKey === "visits"}
                      direction={sortDirection}
                      onClick={() => toggleSort("visits")}
                    >
                      Visits
                    </SortButton>
                  </TH>
                  <TH>
                    <SortButton
                      active={sortKey === "spent"}
                      direction={sortDirection}
                      onClick={() => toggleSort("spent")}
                    >
                      Total Spent
                    </SortButton>
                  </TH>
                  <TH>
                    <SortButton
                      active={sortKey === "points"}
                      direction={sortDirection}
                      onClick={() => toggleSort("points")}
                    >
                      Loyalty Pts
                    </SortButton>
                  </TH>
                  <TH>Discount</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredCustomers.map((customer) => (
                  <TR
                    key={customer.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetailPanel(customer)}
                  >
                    <TD>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                            getAvatarTone(customer.segment),
                          )}
                        >
                          {getInitials(customer.fullName)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full ring-2 ring-white",
                                getSegmentDotClass(customer.segment),
                              )}
                            />
                            <p className="font-semibold text-slate-950">{customer.fullName}</p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                customer.hasAccount === false
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-teal-50 text-teal-700",
                              )}
                            >
                              {customer.hasAccount === false ? "Guest" : "Account"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {formatSegmentLabel(customer.segment)}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>{customer.email ?? "—"}</TD>
                    <TD>
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-teal-700 hover:text-teal-800"
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetailPanel(customer);
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
                      >
                        {customer.visitCount ?? 0} visits
                      </button>
                    </TD>
                    <TD className="font-mono">{formatCurrency(customer.totalSpent ?? 0)}</TD>
                    <TD className="font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        <PremiumIcon name="rated" className="h-3.5 w-3.5 text-amber-500" />
                        {customer.loyaltyPoints ?? 0} pts
                      </span>
                    </TD>
                    <TD>
                      {isCustomerDiscountActive(customer) ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {customer.discountPercent}% VIP
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {customer.hasAccount === false ? null : (
                          <button
                            type="button"
                            onClick={() => openEditPanel(customer)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            aria-label={`Edit ${customer.fullName}`}
                          >
                            <PremiumIcon name="edit" className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetailPanel(customer)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          aria-label={`View ${customer.fullName}`}
                        >
                          <PremiumIcon name="view" className="h-4 w-4" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-slate-200 bg-slate-50">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="space-y-2">
              <p className="text-xl font-semibold text-slate-950">
                No customers yet — add your first one or they&apos;ll appear after their first purchase
              </p>
              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Customer records unlock loyalty tracking, repeat order visibility, and automatic discounts at POS checkout.
              </p>
            </div>
            <Button onClick={openCreatePanel} className="bg-teal-600 text-white hover:bg-teal-700">
              <PremiumIcon name="plus" className="h-4 w-4" />
              Add Customer
            </Button>
          </CardContent>
        </Card>
      )}

      {panelMode === "create" || panelMode === "edit" ? (
        <CustomerEditPanel
          draft={draft}
          errors={errors}
          isSaving={isSaving}
          mode={panelMode}
          onCancel={closePanel}
          onChange={setDraft}
          onSave={handleSaveCustomer}
        />
      ) : null}

      {panelMode === "detail" && selectedCustomer ? (
        <CustomerDetailPanel
          customer={selectedCustomer}
          isGuest={selectedCustomer.hasAccount === false}
          discountExpiryInput={discountExpiryInput}
          confirmingDelete={confirmingDeleteId === selectedCustomer.id}
          discountInput={discountInput}
          isBusy={busyCustomerId === selectedCustomer.id}
          orderHistory={selectedHistory}
          pointsInput={pointsInput}
          onClose={closePanel}
          onRequestDelete={requestDeleteCustomer}
          onConfirmDelete={confirmDeleteCustomer}
          onCancelDelete={cancelDeleteCustomer}
          onDiscountExpiryChange={setDiscountExpiryInput}
          onDiscountInputChange={setDiscountInput}
          onEdit={() => openEditPanel(selectedCustomer)}
          onPointsChange={setPointsInput}
          onPresetDiscount={handleSaveDiscount}
          onSaveDiscount={() => handleSaveDiscount()}
          onSavePoints={handleAddPoints}
        />
      ) : null}
    </div>
  );
}

function CustomerEditPanel({
  draft,
  errors,
  isSaving,
  mode,
  onCancel,
  onChange,
  onSave,
}: {
  draft: CustomerDraft;
  errors: Record<string, string[] | undefined>;
  isSaving: boolean;
  mode: "create" | "edit";
  onCancel: () => void;
  onChange: (draft: CustomerDraft) => void;
  onSave: () => void;
}) {
  return (
    <SlideOver
      title={mode === "create" ? "Add customer" : "Edit customer"}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isSaving ? "Saving..." : "Save Customer"}
          </Button>
        </>
      )}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Full name" error={errors.fullName?.[0]} className="md:col-span-2">
          <Input
            value={draft.fullName}
            onChange={(event) => onChange({ ...draft, fullName: event.target.value })}
            placeholder="Rina Sok"
            className={fieldClassName(Boolean(errors.fullName?.[0]))}
          />
        </Field>
        <Field label="Email" error={errors.email?.[0]}>
          <Input
            type="email"
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder="rina@example.com"
            className={fieldClassName(Boolean(errors.email?.[0]))}
          />
        </Field>
        <Field label="Phone" error={errors.phone?.[0]}>
          <Input
            value={draft.phone}
            onChange={(event) => onChange({ ...draft, phone: event.target.value })}
            placeholder={CAMBODIA_PREFIX}
            className={fieldClassName(Boolean(errors.phone?.[0]))}
          />
        </Field>
        <Field label="Loyalty points" error={errors.loyaltyPoints?.[0]}>
          <Input
            type="number"
            min="0"
            value={draft.loyaltyPoints}
            onChange={(event) => onChange({ ...draft, loyaltyPoints: event.target.value })}
            className={fieldClassName(Boolean(errors.loyaltyPoints?.[0]))}
          />
        </Field>
        <Field label="Assign discount" error={errors.discountPercent?.[0]}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DISCOUNT_PRESETS.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => onChange({ ...draft, discountPercent: String(percent) })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium",
                    Number(draft.discountPercent) === percent
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {percent}%
                </button>
              ))}
            </div>
            <Input
              type="number"
              min="0"
              max="100"
              value={draft.discountPercent}
              onChange={(event) => onChange({ ...draft, discountPercent: event.target.value })}
              placeholder="Custom %"
              className={fieldClassName(Boolean(errors.discountPercent?.[0]))}
            />
          </div>
        </Field>
        <Field label="Discount expiry" error={errors.discountExpiresAt?.[0]}>
          <Input
            type="date"
            value={draft.discountExpiresAt}
            onChange={(event) => onChange({ ...draft, discountExpiresAt: event.target.value })}
            className={fieldClassName(Boolean(errors.discountExpiresAt?.[0]))}
          />
        </Field>
        <Field label="Notes" error={errors.notes?.[0]} className="md:col-span-2">
          <Textarea
            value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            placeholder="VIP, allergies, pickup habits, or service notes."
            className={cn("min-h-28", fieldClassName(Boolean(errors.notes?.[0])))}
          />
        </Field>
      </div>
    </SlideOver>
  );
}

function CustomerDetailPanel({
  confirmingDelete,
  customer,
  isGuest,
  discountExpiryInput,
  discountInput,
  isBusy,
  orderHistory,
  pointsInput,
  onClose,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onDiscountExpiryChange,
  onDiscountInputChange,
  onEdit,
  onPointsChange,
  onPresetDiscount,
  onSaveDiscount,
  onSavePoints,
}: {
  confirmingDelete: boolean;
  customer: CustomerSummary;
  isGuest: boolean;
  discountExpiryInput: string;
  discountInput: string;
  isBusy: boolean;
  orderHistory: CustomerOrderHistoryEntry[];
  pointsInput: string;
  onClose: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDiscountExpiryChange: (value: string) => void;
  onDiscountInputChange: (value: string) => void;
  onEdit: () => void;
  onPointsChange: (value: string) => void;
  onPresetDiscount: (percent: number) => void;
  onSaveDiscount: () => void;
  onSavePoints: () => void;
}) {
  return (
    <SlideOver
      title={customer.fullName}
      onClose={onClose}
      footer={
        isGuest ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : (
        <>
          {confirmingDelete ? (
            <>
              <p className="mr-auto text-sm font-medium text-rose-600">
                Remove {customer.fullName}? Order history will be preserved.
              </p>
              <Button variant="ghost" onClick={onCancelDelete} disabled={isBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={onConfirmDelete} disabled={isBusy}>
                {isBusy ? "Removing..." : "Yes, Remove"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onEdit}>
                Edit customer
              </Button>
              <Button variant="danger" onClick={onRequestDelete} disabled={isBusy}>
                Remove customer
              </Button>
            </>
          )}
        </>
        )
      }
    >
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{customer.email ?? "No email on file"}</p>
          <p className="text-sm text-slate-600">{customer.phone ?? "No phone on file"}</p>
          {isGuest ? (
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Guest customer — no account yet
            </p>
          ) : null}
        </div>

        <DetailSection label="Stats">
          <p className="text-lg font-semibold text-slate-950">
            {customer.visitCount ?? 0} visits • {formatCurrency(customer.totalSpent ?? 0)} spent
          </p>
          <p className="text-sm text-slate-500">
            Last visit: {customer.lastSeenAt ? formatDate(customer.lastSeenAt) : "No purchases yet"}
          </p>
        </DetailSection>

        {!isGuest ? (
          <>
          <DetailSection label="Loyalty">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
              <PremiumIcon name="rated" className="h-5 w-5 text-amber-500" />
              {customer.loyaltyPoints ?? 0} points
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={pointsInput}
                onChange={(event) => onPointsChange(event.target.value)}
                className="w-24"
              />
              <Button
                size="sm"
                onClick={onSavePoints}
                disabled={isBusy}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                + Add Points Manually
              </Button>
            </div>
          </div>
        </DetailSection>

        <DetailSection label="Discount">
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_PRESETS.map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => onPresetDiscount(percent)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  Number(discountInput) === percent
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {percent}%
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              type="number"
              min="0"
              max="100"
              value={discountInput}
              onChange={(event) => onDiscountInputChange(event.target.value)}
              placeholder="Custom %"
            />
            <Input
              type="date"
              value={discountExpiryInput}
              onChange={(event) => onDiscountExpiryChange(event.target.value)}
            />
            <Button
              onClick={onSaveDiscount}
              disabled={isBusy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Save
            </Button>
          </div>
        </DetailSection>
          </>
        ) : null}

        <DetailSection label="Order history">
          <div className="space-y-3">
            {orderHistory.length > 0 ? (
              orderHistory.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-[1.15rem] bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <p className="font-mono font-semibold text-slate-950">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.15rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No orders recorded for this customer yet.
              </p>
            )}
            <Link
              href="/admin/orders"
              className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              View all orders
            </Link>
          </div>
        </DetailSection>
      </div>
    </SlideOver>
  );
}

function SlideOver({
  children,
  footer,
  onClose,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[0_30px_90px_-32px_rgba(15,23,42,0.3)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Customer details
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <PremiumIcon name="close" className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
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

function SortButton({
  active,
  children,
  direction,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2">
      {children}
      {active ? (direction === "asc" ? "↑" : "↓") : null}
    </button>
  );
}

function emptyCustomerDraft(): CustomerDraft {
  return {
    fullName: "",
    email: "",
    phone: CAMBODIA_PREFIX,
    loyaltyPoints: "0",
    notes: "",
    discountPercent: "0",
    discountExpiresAt: "",
  };
}

function withDerivedCustomerFields(customer: CustomerSummary) {
  const visitCount = customer.visitCount ?? 0;
  return {
    ...customer,
    segment: getCustomerSegment({
      fullName: customer.fullName,
      visitCount,
    }),
  } satisfies CustomerSummary;
}

function sortCustomers(
  customers: CustomerSummary[],
  sortKey: SortKey,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...customers].sort((left, right) => {
    if (sortKey === "name") {
      return left.fullName.localeCompare(right.fullName) * multiplier;
    }

    if (sortKey === "visits") {
      return ((left.visitCount ?? 0) - (right.visitCount ?? 0)) * multiplier;
    }

    if (sortKey === "spent") {
      return ((left.totalSpent ?? 0) - (right.totalSpent ?? 0)) * multiplier;
    }

    return ((left.loyaltyPoints ?? 0) - (right.loyaltyPoints ?? 0)) * multiplier;
  });
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatSegmentLabel(segment?: CustomerSummary["segment"]) {
  if (segment === "vip") {
    return "VIP";
  }

  if (segment === "regular") {
    return "Regular";
  }

  if (segment === "walk-in") {
    return "Walk-in";
  }

  return "New Customer";
}

function getAvatarTone(segment?: CustomerSummary["segment"]) {
  if (segment === "vip") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (segment === "regular") {
    return "bg-sky-100 text-sky-700";
  }

  if (segment === "walk-in") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getSegmentDotClass(segment?: CustomerSummary["segment"]) {
  if (segment === "vip") {
    return "bg-emerald-500";
  }

  if (segment === "regular") {
    return "bg-sky-500";
  }

  if (segment === "walk-in") {
    return "bg-slate-300";
  }

  return "bg-amber-400";
}

function fieldClassName(hasError: boolean) {
  return hasError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : "";
}
