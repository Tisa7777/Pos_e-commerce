"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  updateEmployeeAction,
} from "@/app/actions/employees";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingToast } from "@/components/ui/floating-toast";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  EmployeePayType,
  EmployeeRole,
  EmployeeStatus,
  EmployeeSummary,
} from "@/types/domain";

interface EmployeesManagerProps {
  initialEmployees: EmployeeSummary[];
  setupMissing?: boolean;
}

interface EmployeeDraft {
  fullName: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  payType: EmployeePayType;
  salaryAmount: string;
  hourlyRate: string;
  workDays: string[];
  shiftStart: string;
  shiftEnd: string;
  startDate: string;
  emergencyContact: string;
  address: string;
  notes: string;
  password: string;
}

const ROLE_OPTIONS: Array<{ value: EmployeeRole; label: string }> = [
  { value: "admin", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "inventory", label: "Inventory Clerk" },
  { value: "cashier", label: "Cashier" },
];

const LOGIN_ROLES: EmployeeRole[] = ["admin", "manager", "inventory", "cashier"];

const STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "inactive", label: "Inactive" },
];

const PAY_TYPE_OPTIONS: Array<{ value: EmployeePayType; label: string }> = [
  { value: "salary", label: "Monthly salary" },
  { value: "hourly", label: "Hourly" },
  { value: "commission", label: "Commission" },
];

const WORK_DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const TOAST_DURATION_MS = 2600;
const CAMBODIA_PREFIX = "+855 ";
const EMPLOYEES_TABLE_SETUP_MESSAGE =
  "Employee management needs the public.employees table. Apply supabase/migrations/003_employees.sql in your Supabase SQL editor, then refresh this page.";

type EmployeeFilter = "all" | EmployeeStatus;
type PanelMode = "create" | "edit" | null;

export function EmployeesManager({
  initialEmployees,
  setupMissing = false,
}: EmployeesManagerProps) {
  const [employees, setEmployees] = useState(sortEmployees(initialEmployees));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeFilter>("all");
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft());
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return sortEmployees(
      employees.filter((employee) => {
        const matchesQuery =
          !keyword ||
          [
            employee.fullName,
            employee.email,
            employee.phone,
            roleLabel(employee.role),
            employee.notes,
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(keyword));

        const matchesStatus =
          statusFilter === "all" || employee.status === statusFilter;

        return matchesQuery && matchesStatus;
      }),
    );
  }, [employees, query, statusFilter]);

  const summary = useMemo(() => {
    const active = employees.filter((employee) => employee.status === "active").length;
    const cashiers = employees.filter((employee) => employee.role === "cashier").length;
    const posSales = employees.reduce((sum, employee) => sum + (employee.salesCount ?? 0), 0);
    const monthlyPayroll = employees.reduce((sum, employee) => {
      if (employee.status !== "active") return sum;
      if (employee.payType === "salary") return sum + employee.salaryAmount;
      return sum;
    }, 0);

    return {
      active,
      cashiers,
      posSales,
      monthlyPayroll,
    };
  }, [employees]);

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
    setEditingEmployeeId(null);
    setDraft(emptyDraft());
    setErrors({});
  }

  function openEditPanel(employee: EmployeeSummary) {
    setPanelMode("edit");
    setEditingEmployeeId(employee.id);
    setDraft({
      fullName: employee.fullName,
      email: employee.email ?? "",
      phone: employee.phone ?? CAMBODIA_PREFIX,
      role: employee.role,
      status: employee.status,
      payType: employee.payType,
      salaryAmount: String(employee.salaryAmount),
      hourlyRate: String(employee.hourlyRate),
      workDays: employee.workDays,
      shiftStart: employee.shiftStart ?? "",
      shiftEnd: employee.shiftEnd ?? "",
      startDate: employee.startDate?.slice(0, 10) ?? "",
      emergencyContact: employee.emergencyContact ?? "",
      address: employee.address ?? "",
      notes: employee.notes ?? "",
      password: "",
    });
    setErrors({});
  }

  function closePanel() {
    setPanelMode(null);
    setEditingEmployeeId(null);
    setDraft(emptyDraft());
    setErrors({});
  }

  function toggleWorkDay(day: string) {
    setDraft((current) => ({
      ...current,
      workDays: current.workDays.includes(day)
        ? current.workDays.filter((value) => value !== day)
        : [...current.workDays, day],
    }));
  }

  async function handleSaveEmployee() {
    setIsSaving(true);
    const payload = {
      ...draft,
      salaryAmount: Number(draft.salaryAmount) || 0,
      hourlyRate: Number(draft.hourlyRate) || 0,
      email: draft.email || undefined,
      phone: draft.phone || undefined,
      shiftStart: draft.shiftStart || undefined,
      shiftEnd: draft.shiftEnd || undefined,
      startDate: draft.startDate || undefined,
      emergencyContact: draft.emergencyContact || undefined,
      address: draft.address || undefined,
      notes: draft.notes || undefined,
      password: draft.password || undefined,
    };
    const result =
      panelMode === "edit" && editingEmployeeId
        ? await updateEmployeeAction({ id: editingEmployeeId, ...payload })
        : await createEmployeeAction(payload);
    setIsSaving(false);

    if (!result.ok || !result.data) {
      setErrors(result.fieldErrors ?? {});
      showToast(result.message, "error");
      return;
    }

    setEmployees((current) =>
      sortEmployees(
        panelMode === "edit"
          ? current.map((employee) =>
              employee.id === result.data!.id ? result.data! : employee,
            )
          : [...current, result.data!],
      ),
    );
    closePanel();
    showToast(panelMode === "edit" ? "Employee saved" : "Employee added");
  }

  async function handleDeleteEmployee(employee: EmployeeSummary) {
    const confirmed = window.confirm(`Remove ${employee.fullName} from employees?`);
    if (!confirmed) {
      return;
    }

    setBusyEmployeeId(employee.id);
    const result = await deleteEmployeeAction({ id: employee.id });
    setBusyEmployeeId(null);

    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }

    setEmployees((current) => current.filter((item) => item.id !== employee.id));
    showToast("Employee removed");
  }

  return (
    <div className="space-y-6">
      <FloatingToast message={toastMessage} tone={toastTone} />

      <PageHeader
        eyebrow="Sales team"
        title="Employees"
        description="Manage staff profiles, roles, payroll settings, schedules, and cashier sales activity."
        action={(
          <Button onClick={openCreatePanel} disabled={setupMissing}>
            <PremiumIcon name="plus" className="h-4 w-4" />
            New Employee
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Active staff" value={String(summary.active)} iconName="customers" />
        <SummaryCard label="Cashiers" value={String(summary.cashiers)} iconName="pos" />
        <SummaryCard label="POS sales" value={String(summary.posSales)} iconName="orders" />
        <SummaryCard
          label="Monthly payroll"
          value={formatCurrency(summary.monthlyPayroll)}
          iconName="revenue"
        />
      </div>

      {setupMissing ? <EmployeeSetupNotice /> : null}

      <Card className="border-white/60">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search employees, roles, phone..."
                className="h-11 rounded-2xl bg-white"
              />
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as EmployeeFilter)}
                className="sm:max-w-[180px]"
              >
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-sm text-slate-500">
              Showing {filteredEmployees.length} employees
            </p>
          </div>

          {filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-[1120px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Pay</th>
                    <th className="px-4 py-3 text-right">POS sales</th>
                    <th className="px-4 py-3">Work time</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                            {getInitials(employee.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950">{employee.fullName}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {employee.email ?? "No email"} • {employee.phone ?? "No phone"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={employee.role === "cashier" ? "primary" : "default"}>
                          {roleLabel(employee.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(employee.status)} dot>
                          {statusLabel(employee.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-mono font-semibold text-slate-950">
                          {formatPay(employee)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {payTypeLabel(employee.payType)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-mono font-semibold text-slate-950">
                          {formatSalesCount(employee.salesCount ?? 0)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatCurrency(employee.salesRevenue ?? 0)}
                          {employee.lastSaleAt ? ` • ${formatLastSale(employee.lastSaleAt)}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-700">
                          {formatShift(employee.shiftStart, employee.shiftEnd)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatWorkDays(employee.workDays)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditPanel(employee)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-primary/30 hover:text-primary"
                          >
                            <PremiumIcon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(employee)}
                            disabled={busyEmployeeId === employee.id}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <PremiumIcon name="delete" className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-slate-700">No employees found</p>
              <p className="mt-2 text-sm text-slate-400">
                Add staff records to manage roles, pay, and schedules.
              </p>
              <Button onClick={openCreatePanel} className="mt-5" disabled={setupMissing}>
                <PremiumIcon name="plus" className="h-4 w-4" />
                New Employee
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {panelMode ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[0_30px_90px_-32px_rgba(15,23,42,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                  {panelMode === "edit" ? "Edit employee" : "New employee"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {panelMode === "edit" ? "Update staff profile" : "Add staff member"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" error={errors.fullName}>
                  <Input
                    value={draft.fullName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, fullName: event.target.value }))
                    }
                    placeholder="Sok Dara"
                  />
                </Field>
                <Field label="Role" error={errors.role}>
                  <Select
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        role: event.target.value as EmployeeRole,
                      }))
                    }
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="cashier@coffee.example"
                    type="email"
                  />
                </Field>
                {isLoginRole(draft.role) ? (
                  <Field
                    label={panelMode === "edit" ? "Login password (reset)" : "Login password"}
                    error={errors.password}
                  >
                    <Input
                      value={draft.password}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder={
                        panelMode === "edit" ? "Leave blank to keep current" : "At least 8 characters"
                      }
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                ) : null}
                <Field label="Phone" error={errors.phone}>
                  <Input
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="+855 10 222 222"
                  />
                </Field>
                <Field label="Status" error={errors.status}>
                  <Select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        status: event.target.value as EmployeeStatus,
                      }))
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pay type" error={errors.payType}>
                  <Select
                    value={draft.payType}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        payType: event.target.value as EmployeePayType,
                      }))
                    }
                  >
                    {PAY_TYPE_OPTIONS.map((payType) => (
                      <option key={payType.value} value={payType.value}>
                        {payType.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Monthly salary" error={errors.salaryAmount}>
                  <Input
                    value={draft.salaryAmount}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, salaryAmount: event.target.value }))
                    }
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </Field>
                <Field label="Hourly rate" error={errors.hourlyRate}>
                  <Input
                    value={draft.hourlyRate}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, hourlyRate: event.target.value }))
                    }
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </Field>
                <Field label="Shift start" error={errors.shiftStart}>
                  <Input
                    value={draft.shiftStart}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, shiftStart: event.target.value }))
                    }
                    type="time"
                  />
                </Field>
                <Field label="Shift end" error={errors.shiftEnd}>
                  <Input
                    value={draft.shiftEnd}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, shiftEnd: event.target.value }))
                    }
                    type="time"
                  />
                </Field>
                <Field label="Start date" error={errors.startDate}>
                  <Input
                    value={draft.startDate}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, startDate: event.target.value }))
                    }
                    type="date"
                  />
                </Field>
                <Field label="Emergency contact" error={errors.emergencyContact}>
                  <Input
                    value={draft.emergencyContact}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        emergencyContact: event.target.value,
                      }))
                    }
                    placeholder="+855 12 345 678"
                  />
                </Field>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Work days</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WORK_DAYS.map((day) => {
                      const active = draft.workDays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWorkDay(day.value)}
                          className={cn(
                            "h-9 rounded-lg border px-3 text-sm font-semibold",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:border-primary/30 hover:text-primary",
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.workDays ? <ErrorText messages={errors.workDays} /> : null}
                </div>

                <Field label="Address" error={errors.address}>
                  <Input
                    value={draft.address}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, address: event.target.value }))
                    }
                    placeholder="Phnom Penh"
                  />
                </Field>
                <Field label="Notes" error={errors.notes}>
                  <Textarea
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Training notes, uniform size, contract details..."
                    rows={4}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button variant="ghost" onClick={closePanel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEmployee} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Employee"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmployeeSetupNotice() {
  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <CardContent className="space-y-4 p-5">
        <div className="flex gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <PremiumIcon name="alert" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-amber-950">
              Employee table is not installed yet
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              {EMPLOYEES_TABLE_SETUP_MESSAGE}
            </p>
            <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 px-4 py-3 font-mono text-xs text-amber-900">
              supabase/migrations/003_employees.sql
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  iconName,
}: {
  label: string;
  value: string;
  iconName: "customers" | "pos" | "revenue" | "orders";
}) {
  return (
    <div className="surface rounded-2xl border border-white/60 p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PremiumIcon name={iconName} className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? <ErrorText messages={error} /> : null}
    </label>
  );
}

function ErrorText({ messages }: { messages: string[] }) {
  return <p className="text-xs font-medium text-rose-600">{messages[0]}</p>;
}

function emptyDraft(): EmployeeDraft {
  return {
    fullName: "",
    email: "",
    phone: CAMBODIA_PREFIX,
    role: "cashier",
    status: "active",
    payType: "salary",
    salaryAmount: "0",
    hourlyRate: "0",
    workDays: ["mon", "tue", "wed", "thu", "fri"],
    shiftStart: "08:00",
    shiftEnd: "17:00",
    startDate: new Date().toISOString().slice(0, 10),
    emergencyContact: "",
    address: "",
    notes: "",
    password: "",
  };
}

function sortEmployees(employees: EmployeeSummary[]) {
  const statusRank: Record<EmployeeStatus, number> = {
    active: 1,
    on_leave: 2,
    inactive: 3,
  };

  return [...employees].sort(
    (left, right) =>
      statusRank[left.status] - statusRank[right.status] ||
      left.fullName.localeCompare(right.fullName),
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleLabel(role: EmployeeRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function isLoginRole(role: EmployeeRole) {
  return LOGIN_ROLES.includes(role);
}

function statusLabel(status: EmployeeStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function payTypeLabel(payType: EmployeePayType) {
  return PAY_TYPE_OPTIONS.find((option) => option.value === payType)?.label ?? payType;
}

function statusVariant(status: EmployeeStatus) {
  if (status === "active") return "success";
  if (status === "on_leave") return "warning";
  return "default";
}

function formatPay(employee: EmployeeSummary) {
  if (employee.payType === "hourly") {
    return `${formatCurrency(employee.hourlyRate)}/h`;
  }

  if (employee.payType === "commission") {
    return formatCurrency(employee.salaryAmount);
  }

  return `${formatCurrency(employee.salaryAmount)}/mo`;
}

function formatSalesCount(count: number) {
  return `${count} ${count === 1 ? "sale" : "sales"}`;
}

function formatLastSale(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Last sale";
  }
}

function formatShift(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "Not set";
  }

  return `${start ?? "--:--"} - ${end ?? "--:--"}`;
}

function formatWorkDays(days: string[]) {
  if (days.length === 0) {
    return "No days selected";
  }

  return WORK_DAYS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(", ");
}
