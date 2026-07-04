"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setUserRolesAction } from "@/app/actions/access";
import type { UserRole } from "@/types/domain";

interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  roles: UserRole[];
}

interface RoleOption {
  role: UserRole;
  label: string;
}

export function UserRolesEditor({
  accounts,
  roleOptions,
}: {
  accounts: StaffAccount[];
  roleOptions: RoleOption[];
}) {
  const [state, setState] = useState<Record<string, Set<UserRole>>>(() => {
    const next: Record<string, Set<UserRole>> = {};
    for (const account of accounts) {
      next[account.id] = new Set(account.roles);
    }
    return next;
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Record<string, { ok: boolean; text: string } | undefined>>(
    {},
  );

  function toggle(id: string, role: UserRole) {
    setState((current) => {
      const nextSet = new Set(current[id]);
      if (nextSet.has(role)) {
        nextSet.delete(role);
      } else {
        nextSet.add(role);
      }
      return { ...current, [id]: nextSet };
    });
  }

  function handleSave(id: string) {
    setPendingId(id);
    setMessage((m) => ({ ...m, [id]: undefined }));
    startTransition(async () => {
      const result = await setUserRolesAction({
        profileId: id,
        roles: Array.from(state[id] ?? []),
      });
      setMessage((m) => ({ ...m, [id]: { ok: result.ok, text: result.message } }));
      setPendingId(null);
    });
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assign roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            No staff accounts yet. Create staff on the Employees page (Owner, Cashier, Inventory,
            or Manager positions get a login).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign roles to staff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          Toggle the roles each staff member holds, then save that row.
        </p>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{account.fullName}</p>
                <p className="truncate text-xs text-slate-500">{account.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {roleOptions.map(({ role, label }) => (
                  <label
                    key={role}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={state[account.id]?.has(role) ?? false}
                      onChange={() => toggle(account.id, role)}
                      disabled={isPending}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    {label}
                  </label>
                ))}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSave(account.id)}
                  disabled={isPending && pendingId === account.id}
                >
                  {isPending && pendingId === account.id ? "Saving..." : "Save"}
                </Button>
                {message[account.id] ? (
                  <span
                    className={`text-xs ${
                      message[account.id]!.ok ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {message[account.id]!.text}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
