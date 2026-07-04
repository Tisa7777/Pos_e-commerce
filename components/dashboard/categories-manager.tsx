"use client";

import { useEffect, useState } from "react";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingToast } from "@/components/ui/floating-toast";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_ICON_OPTIONS, getCategoryIconName } from "@/lib/premium-icons";
import { cn } from "@/lib/utils";
import type { CategorySummary } from "@/types/domain";

interface CategoriesManagerProps {
  initialCategories: CategorySummary[];
}

interface CategoryDraft {
  name: string;
  description: string;
  visualIcon: string;
  accentColor: string;
}

const TOAST_DURATION_MS = 2600;
const DEFAULT_CATEGORY_COLOR = "#0f766e";

export function CategoriesManager({
  initialCategories,
}: CategoriesManagerProps) {
  const [categories, setCategories] = useState(sortCategories(initialCategories));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCategoryDraft());
  const [createErrors, setCreateErrors] = useState<Record<string, string[] | undefined>>({});
  const [createPending, setCreatePending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>(emptyCategoryDraft());
  const [editErrors, setEditErrors] = useState<Record<string, string[] | undefined>>({});
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage("");
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  function showToast(message: string, tone: "success" | "error" = "success") {
    setToastTone(tone);
    setToastMessage(message);
  }

  function openCreateForm() {
    setIsCreateOpen(true);
    setCreateErrors({});
  }

  function closeCreateForm() {
    setIsCreateOpen(false);
    setCreateDraft(emptyCategoryDraft());
    setCreateErrors({});
  }

  function openEditForm(category: CategorySummary) {
    setEditingId(category.id);
    setEditErrors({});
    setEditDraft({
      name: category.name,
      description: category.description ?? "",
      visualIcon: getCategoryIconName(category.name, category.visualIcon),
      accentColor: category.accentColor ?? DEFAULT_CATEGORY_COLOR,
    });
  }

  function closeEditForm() {
    setEditingId(null);
    setEditDraft(emptyCategoryDraft());
    setEditErrors({});
  }

  async function handleCreateCategory() {
    setCreatePending(true);
    const result = await createCategoryAction(createDraft);
    setCreatePending(false);

    if (!result.ok || !result.data) {
      setCreateErrors(result.fieldErrors ?? {});
      showToast(result.message, "error");
      return;
    }

    const createdCategory = result.data;
    setCategories((current) => sortCategories([...current, createdCategory]));
    closeCreateForm();
    showToast("Category saved");
  }

  async function handleUpdateCategory(categoryId: string) {
    setBusyCategoryId(categoryId);
    const result = await updateCategoryAction({
      id: categoryId,
      ...editDraft,
    });
    setBusyCategoryId(null);

    if (!result.ok || !result.data) {
      setEditErrors(result.fieldErrors ?? {});
      showToast(result.message, "error");
      return;
    }

    const updatedCategory = result.data;
    setCategories((current) =>
      sortCategories(
        current.map((category) =>
          category.id === categoryId ? updatedCategory : category,
        ),
      ),
    );
    closeEditForm();
    showToast("Category saved");
  }

  async function handleDeleteCategory(category: CategorySummary) {
    const productCount = category.productCount ?? 0;
    const confirmed = window.confirm(
      `This will unlink ${productCount} products. Are you sure?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyCategoryId(category.id);
    const result = await deleteCategoryAction({ id: category.id });
    setBusyCategoryId(null);

    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }

    setCategories((current) =>
      current.filter((existingCategory) => existingCategory.id !== category.id),
    );
    if (editingId === category.id) {
      closeEditForm();
    }
    showToast("Category removed");
  }

  return (
    <div className="space-y-6">
      <FloatingToast message={toastMessage} tone={toastTone} />

      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Add and manage product categories directly from the admin UI so POS and storefront taxonomy stay in sync."
        action={(
          <Button onClick={openCreateForm} className="bg-teal-600 text-white hover:bg-teal-700">
            <PremiumIcon name="plus" className="h-4 w-4" />
            New Category
          </Button>
        )}
      />

      {isCreateOpen ? (
        <Card className="border-teal-100 bg-white">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                  New category
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Create a new catalog grouping
                </h2>
              </div>
              <Button variant="ghost" onClick={closeCreateForm}>
                Cancel
              </Button>
            </div>

            <CategoryFormFields
              draft={createDraft}
              errors={createErrors}
              onChange={setCreateDraft}
            />

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="ghost" onClick={closeCreateForm}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={createPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {createPending ? "Saving..." : "Save Category"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {categories.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const isEditing = editingId === category.id;
            const accentColor = category.accentColor || DEFAULT_CATEGORY_COLOR;
            const iconName = getCategoryIconName(category.name, category.visualIcon);

            return (
              <Card
                key={category.id}
                className="overflow-hidden border-slate-200 bg-white"
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: accentColor }}
                />
                <CardContent className="space-y-4 p-6">
                  {isEditing ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Edit category
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-950">
                            {category.name}
                          </h3>
                        </div>
                        <Button variant="ghost" size="sm" onClick={closeEditForm}>
                          Cancel
                        </Button>
                      </div>

                      <CategoryFormFields
                        draft={editDraft}
                        errors={editErrors}
                        onChange={setEditDraft}
                      />

                      <div className="flex items-center justify-end gap-3">
                        <Button variant="ghost" size="sm" onClick={closeEditForm}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateCategory(category.id)}
                          disabled={busyCategoryId === category.id}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {busyCategoryId === category.id ? "Saving..." : "Save Category"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
                              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                            >
                              <PremiumIcon name={iconName} className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 className="text-lg font-semibold text-slate-950">
                                {category.name}
                              </h3>
                              <p className="text-sm text-slate-500">
                                {category.description || "No category description yet."}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <ActionIconButton onClick={() => openEditForm(category)}>
                            <PremiumIcon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </ActionIconButton>
                          <ActionIconButton
                            tone="danger"
                            onClick={() => handleDeleteCategory(category)}
                            disabled={busyCategoryId === category.id}
                          >
                            <PremiumIcon name="delete" className="h-3.5 w-3.5" />
                            Delete
                          </ActionIconButton>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50 px-4 py-3 text-sm">
                        <span className="inline-flex items-center gap-2 text-slate-500">
                          <PremiumIcon name="product-links" className="h-4 w-4" />
                          Product links
                        </span>
                        <span className="font-semibold text-slate-950">
                          {category.productCount ?? 0} products linked
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          actionLabel="New Category"
          onAction={openCreateForm}
          title="No categories yet — add your first one"
        />
      )}
    </div>
  );
}

function CategoryFormFields({
  draft,
  errors,
  onChange,
}: {
  draft: CategoryDraft;
  errors: Record<string, string[] | undefined>;
  onChange: (value: CategoryDraft) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field
        label="Name"
        error={errors.name?.[0]}
        className="md:col-span-2"
      >
        <Input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Accessories"
          className={fieldClassName(Boolean(errors.name?.[0]))}
        />
      </Field>

      <Field
        label="Description"
        error={errors.description?.[0]}
        className="md:col-span-2"
      >
        <Textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Retail merchandise, bundles, and non-consumable add-ons."
          className={cn("min-h-28", fieldClassName(Boolean(errors.description?.[0])))}
        />
      </Field>

      <Field label="Icon" error={errors.visualIcon?.[0]}>
        <Select
          value={draft.visualIcon}
          onChange={(event) => onChange({ ...draft, visualIcon: event.target.value })}
          className={fieldClassName(Boolean(errors.visualIcon?.[0]))}
        >
          {CATEGORY_ICON_OPTIONS.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Accent color" error={errors.accentColor?.[0]}>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={draft.accentColor || DEFAULT_CATEGORY_COLOR}
            onChange={(event) => onChange({ ...draft, accentColor: event.target.value })}
            className="h-11 w-16 rounded-2xl border border-slate-200 bg-white p-1"
          />
          <Input
            value={draft.accentColor}
            onChange={(event) => onChange({ ...draft, accentColor: event.target.value })}
            placeholder="#0f766e"
            className={fieldClassName(Boolean(errors.accentColor?.[0]))}
          />
        </div>
      </Field>
    </div>
  );
}

function Field({
  children,
  className,
  error,
  label,
}: {
  children: React.ReactNode;
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

function ActionIconButton({
  children,
  disabled,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-slate-950",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <Card className="border-dashed border-slate-200 bg-slate-50">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="space-y-2">
          <p className="text-xl font-semibold text-slate-950">{title}</p>
          <p className="max-w-lg text-sm leading-6 text-slate-500">
            Categories help keep storefront browsing and the POS catalog clear for staff and customers.
          </p>
        </div>
        <Button onClick={onAction} className="bg-teal-600 text-white hover:bg-teal-700">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function emptyCategoryDraft(): CategoryDraft {
  return {
    name: "",
    description: "",
    visualIcon: "package",
    accentColor: DEFAULT_CATEGORY_COLOR,
  };
}

function sortCategories(categories: CategorySummary[]) {
  return [...categories].sort((left, right) => left.name.localeCompare(right.name));
}

function fieldClassName(hasError: boolean) {
  return hasError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : "";
}
