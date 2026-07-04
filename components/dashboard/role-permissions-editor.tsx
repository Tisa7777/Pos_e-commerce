"use client";

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRoleAction,
  removeRoleAction,
  saveRolePermissionsAction,
} from "@/app/actions/access";
import type { RoleDefinition, UserRole } from "@/types/domain";

interface CatalogItem {
  key: string;
  label: string;
}

// Special permissions that are not freely editable in the matrix.
const SPECIAL_KEYS: Record<string, string> = {
  pos: "Cashier-only",
  roles: "Owner-exclusive",
};

const ROLE_ACCENTS: Record<string, string> = {
  admin: "text-emerald-600",
  manager: "text-violet-600",
  clerk: "text-sky-600",
  cashier: "text-amber-600",
  customer: "text-slate-500",
};

const CUSTOM_ACCENTS = [
  "text-cyan-700",
  "text-blue-700",
  "text-fuchsia-700",
  "text-rose-700",
  "text-lime-700",
];

const ROLE_ORDER = new Map<string, number>([
  ["admin", 0],
  ["manager", 10],
  ["clerk", 20],
  ["cashier", 30],
  ["customer", 1000],
]);

/**
 * A special key is locked (non-editable) for a configurable role when:
 * - `roles` is selected for any role (Owner-exclusive), or
 * - `pos` is selected for a non-cashier role (Cashier-only).
 */
function isSpecialLockedFor(role: string, key: string): boolean {
  if (key === "roles") return true;
  if (key === "pos" && role !== "cashier") return true;
  return false;
}

function sortRoleDefinitions(roles: RoleDefinition[]) {
  return [...roles].sort((a, b) => {
    const aOrder = ROLE_ORDER.get(a.role) ?? 100;
    const bOrder = ROLE_ORDER.get(b.role) ?? 100;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.label.localeCompare(b.label);
  });
}

function roleAccent(role: string) {
  if (ROLE_ACCENTS[role]) {
    return ROLE_ACCENTS[role];
  }
  const score = Array.from(role).reduce((total, char) => total + char.charCodeAt(0), 0);
  return CUSTOM_ACCENTS[score % CUSTOM_ACCENTS.length];
}

function buildMatrix(roleDefinitions: RoleDefinition[], initial: Record<string, string[]>) {
  const next: Record<string, Set<string>> = {};
  for (const role of roleDefinitions) {
    if (role.kind === "editable") {
      next[role.role] = new Set(initial[role.role] ?? []);
    }
  }
  return next;
}

export function RolePermissionsEditor({
  catalog,
  roleDefinitions,
  initial,
}: {
  catalog: CatalogItem[];
  roleDefinitions: RoleDefinition[];
  initial: Record<string, string[]>;
}) {
  const router = useRouter();
  const sortedInitialRoles = useMemo(
    () => sortRoleDefinitions(roleDefinitions),
    [roleDefinitions],
  );
  const firstEditableRole =
    sortedInitialRoles.find((role) => role.kind === "editable")?.role ??
    sortedInitialRoles[0]?.role ??
    "manager";

  const [roleDefs, setRoleDefs] = useState<RoleDefinition[]>(sortedInitialRoles);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>(() =>
    buildMatrix(sortedInitialRoles, initial),
  );
  const [selected, setSelected] = useState<string>(firstEditableRole);
  const [addingRole, setAddingRole] = useState(false);
  const [draftRole, setDraftRole] = useState({ label: "", description: "" });
  const [isSaving, startSaveTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const editableRoles = useMemo(
    () => new Set(roleDefs.filter((role) => role.kind === "editable").map((role) => role.role)),
    [roleDefs],
  );
  const selectedMeta = roleDefs.find((role) => role.role === selected);
  const isEditable = selectedMeta?.kind === "editable" && editableRoles.has(selected);
  const canRemoveSelected = Boolean(selectedMeta && !selectedMeta.isSystem);
  const isBusy = isSaving || isCreating || isRemoving;

  function grantedCount(role: string): number {
    const meta = roleDefs.find((entry) => entry.role === role);
    if (meta?.kind === "full") return catalog.filter((item) => item.key !== "pos").length;
    if (meta?.kind === "none") return 0;
    let count = 0;
    for (const key of matrix[role] ?? []) {
      if (isSpecialLockedFor(role, key)) continue;
      count += 1;
    }
    return count;
  }

  function isChecked(role: string, key: string): boolean {
    const meta = roleDefs.find((entry) => entry.role === role);
    if (meta?.kind === "full") {
      // Owner has everything except owner-excluded keys (POS).
      return key !== "pos";
    }
    if (meta?.kind === "none") return false;
    if (isSpecialLockedFor(role, key)) return false;
    return matrix[role]?.has(key) ?? false;
  }

  function toggle(key: string) {
    if (!isEditable || isSpecialLockedFor(selected, key)) return;
    setMessage(null);
    setMatrix((current) => {
      const nextSet = new Set(current[selected] ?? []);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      return { ...current, [selected]: nextSet };
    });
  }

  function handleSave() {
    setMessage(null);
    startSaveTransition(async () => {
      const result = await saveRolePermissionsAction({
        role: selected as UserRole,
        permissions: Array.from(matrix[selected] ?? []),
      });
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);
    setMessage(null);
    startCreateTransition(async () => {
      const result = await createRoleAction(draftRole);
      if (!result.ok || !result.data) {
        setCreateMessage({ ok: false, text: result.message });
        return;
      }

      const created = result.data;
      setRoleDefs((current) =>
        sortRoleDefinitions([
          ...current.filter((role) => role.role !== created.role),
          created,
        ]),
      );
      setMatrix((current) => ({ ...current, [created.role]: new Set() }));
      setSelected(created.role);
      setDraftRole({ label: "", description: "" });
      setAddingRole(false);
      setMessage({ ok: true, text: "Role created. Choose permissions, then save." });
      router.refresh();
    });
  }

  function handleRemoveRole(roleToRemove: RoleDefinition) {
    if (roleToRemove.isSystem) return;
    const confirmed = window.confirm(
      `Remove ${roleToRemove.label}? Staff assigned to this role will lose it.`,
    );
    if (!confirmed) {
      return;
    }

    const removingRole = roleToRemove.role;
    setMessage(null);
    startRemoveTransition(async () => {
      const result = await removeRoleAction({ role: removingRole });
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }

      const nextRoleDefs = roleDefs.filter((role) => role.role !== removingRole);
      const fallback =
        nextRoleDefs.find((role) => role.kind === "editable")?.role ??
        nextRoleDefs[0]?.role ??
        "manager";
      setRoleDefs(nextRoleDefs);
      setSelected(fallback);
      setMatrix((current) => {
        const next = { ...current };
        delete next[removingRole];
        return next;
      });
      setMessage({ ok: true, text: result.message });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-[260px_1fr]">
          <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Roles
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={addingRole ? "Close role form" : "Add role"}
                title={addingRole ? "Close role form" : "Add role"}
                onClick={() => {
                  setAddingRole((current) => !current);
                  setCreateMessage(null);
                }}
              >
                {addingRole ? <X size={15} /> : <Plus size={15} />}
              </Button>
            </div>

            {addingRole ? (
              <form
                onSubmit={handleCreateRole}
                className="mx-2 mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <Input
                  aria-label="Role name"
                  placeholder="Role name"
                  value={draftRole.label}
                  onChange={(event) =>
                    setDraftRole((current) => ({ ...current, label: event.target.value }))
                  }
                  disabled={isCreating}
                  className="h-10 rounded-lg"
                />
                <textarea
                  aria-label="Role description"
                  placeholder="Description"
                  value={draftRole.description}
                  onChange={(event) =>
                    setDraftRole((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  disabled={isCreating}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  size="sm"
                  fullWidth
                  disabled={isCreating || draftRole.label.trim().length < 2}
                >
                  <Plus size={14} />
                  {isCreating ? "Adding..." : "Add role"}
                </Button>
                {createMessage ? (
                  <p
                    className={`text-xs ${
                      createMessage.ok ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {createMessage.text}
                  </p>
                ) : null}
              </form>
            ) : null}

            <nav className="space-y-1 px-2 pb-4">
              {roleDefs.map((meta) => {
                const active = meta.role === selected;
                const removable = !meta.isSystem;
                return (
                  <div
                    key={meta.role}
                    className={`flex items-center gap-1 rounded-xl transition ${
                      active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(meta.role);
                        setMessage(null);
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${roleAccent(meta.role)}`}>
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {meta.description}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {meta.kind === "full"
                          ? "All"
                          : meta.kind === "none"
                            ? "-"
                            : `${grantedCount(meta.role)}/${catalog.length}`}
                      </span>
                    </button>
                    {removable ? (
                      <button
                        type="button"
                        aria-label={`Remove ${meta.label}`}
                        title={`Remove ${meta.label}`}
                        onClick={() => handleRemoveRole(meta)}
                        disabled={isBusy}
                        className="mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3
                  className={`text-lg font-semibold ${
                    selectedMeta ? roleAccent(selectedMeta.role) : "text-slate-900"
                  }`}
                >
                  {selectedMeta?.label ?? selected}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{selectedMeta?.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canRemoveSelected ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    aria-label={`Remove ${selectedMeta?.label ?? "role"}`}
                    title={`Remove ${selectedMeta?.label ?? "role"}`}
                    onClick={() => selectedMeta && handleRemoveRole(selectedMeta)}
                    disabled={isBusy}
                  >
                    <Trash2 size={15} />
                    Remove role
                  </Button>
                ) : null}
                {selectedMeta?.kind === "full" ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Full access (locked)
                  </span>
                ) : selectedMeta?.kind === "none" ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    Storefront only
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {catalog.map((item) => {
                const checked = isChecked(selected, item.key);
                const special = SPECIAL_KEYS[item.key];
                const lockedSpecial =
                  isEditable && special ? isSpecialLockedFor(selected, item.key) : false;
                const locked = !isEditable || lockedSpecial;
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      locked
                        ? "border-slate-100 bg-slate-50/60"
                        : "cursor-pointer border-slate-200 hover:border-primary/30 hover:bg-primary/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked || isBusy}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:opacity-60"
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={checked ? "font-medium text-slate-800" : "text-slate-600"}>
                        {item.label}
                      </span>
                      {special ? (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            lockedSpecial
                              ? "bg-slate-200 text-slate-500"
                              : "bg-amber-100 text-amber-700"
                          }`}
                          title={`${special} - special permission`}
                        >
                          {special}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            {isEditable ? (
              <p className="mt-3 text-xs text-slate-400">
                <span className="font-semibold text-slate-500">Special permissions:</span>{" "}
                POS Register &amp; sales is Cashier-only, and Roles &amp; Access is Owner-only -
                these cannot be granted here.
              </p>
            ) : null}

            {isEditable ? (
              <div className="mt-5 flex items-center gap-4">
                <Button type="button" onClick={handleSave} disabled={isBusy}>
                  {isSaving ? "Saving..." : `Save ${selectedMeta?.label} permissions`}
                </Button>
                {message ? (
                  <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>
                    {message.text}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-xs text-slate-400">
                {selectedMeta?.kind === "full"
                  ? "Owners always have every permission and cannot be edited."
                  : "Customers use the public storefront and have no back-office permissions."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
