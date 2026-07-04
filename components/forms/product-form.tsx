"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDrinkSizePrice, isDrinkProduct } from "@/lib/catalog/drink-sizes";
import { formatCurrency } from "@/lib/utils";
import type {
  ActionState,
  CategorySummary,
  ProductCardData,
  SupplierSummary,
} from "@/types/domain";

const initialState: ActionState = {
  ok: false,
  message: "",
};
const MAX_PRODUCT_IMAGE_SIZE = 8 * 1024 * 1024;

export function ProductForm({
  categories,
  suppliers,
  product,
}: {
  categories: CategorySummary[];
  suppliers: SupplierSummary[];
  product?: ProductCardData;
}) {
  const isEditing = Boolean(product);
  const [state, formAction] = useActionState(
    isEditing ? updateProductAction : createProductAction,
    initialState,
  );
  const [imageError, setImageError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(product?.category?.id ?? "");
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const hasDrinkSizes = isDrinkProduct({ category: selectedCategory });

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setImageError("");
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      event.target.value = "";
      setImageError("Choose an image smaller than 8 MB.");
      return;
    }

    setImageError("");
  }

  return (
    <form action={formAction} className="space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit product" : "Create a new product"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="name">
              Product name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="Tisa Travel Tumbler"
              defaultValue={product?.name}
              required
            />
            <FieldError errors={state.fieldErrors?.name} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the product, usage, and merchandising note."
              defaultValue={product?.description ?? ""}
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>
          <Field
            label="SKU"
            name="sku"
            placeholder="ACC-TMB-004"
            defaultValue={product?.sku}
            errors={state.fieldErrors?.sku}
          />
          <Field
            label="Barcode"
            name="barcode"
            placeholder="885100000004"
            defaultValue={product?.barcode ?? ""}
            errors={state.fieldErrors?.barcode}
            required={false}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="categoryId">
              Category
            </label>
            <Select
              id="categoryId"
              name="categoryId"
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <FieldError errors={state.fieldErrors?.categoryId} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="supplierId">
              Supplier
            </label>
            <Select id="supplierId" name="supplierId" defaultValue={product?.supplierId ?? ""}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            <FieldError errors={state.fieldErrors?.supplierId} />
          </div>
          <Field
            label={hasDrinkSizes ? "Base price (M)" : "Price"}
            name="price"
            placeholder="14.00"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.price}
            errors={state.fieldErrors?.price}
          />
          {hasDrinkSizes ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-primary">Drink size pricing</p>
              <p className="mt-1">
                M uses the base price. L is charged at{" "}
                <span className="font-mono font-semibold text-slate-950">
                  {product
                    ? formatCurrency(getDrinkSizePrice(product.price, "L"))
                    : "base price + $1.00"}
                </span>
                .
              </p>
            </div>
          ) : null}
          <Field
            label="Cost"
            name="cost"
            placeholder="5.50"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.cost}
            errors={state.fieldErrors?.cost}
          />
          {hasDrinkSizes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <input type="hidden" name="stockQuantity" value="0" />
              <input type="hidden" name="lowStockThreshold" value="0" />
              <p className="font-semibold text-slate-950">Stock is not tracked for drinks</p>
              <p className="mt-1">
                Coffee and drink items are prepared on demand, so they will not appear in Add Stock
                or low-stock alerts.
              </p>
            </div>
          ) : (
            <>
              <Field
                label="Stock quantity"
                name="stockQuantity"
                placeholder="24"
                type="number"
                min="0"
                defaultValue={product?.stockQuantity}
                errors={state.fieldErrors?.stockQuantity}
              />
              <Field
                label="Low-stock threshold"
                name="lowStockThreshold"
                placeholder="6"
                type="number"
                min="0"
                defaultValue={product?.lowStockThreshold}
                errors={state.fieldErrors?.lowStockThreshold}
              />
            </>
          )}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="image">
              {isEditing ? "Replace product image" : "Product image"}
            </label>
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {imageError ? (
              <p className="text-xs font-medium text-rose-600">{imageError}</p>
            ) : (
              <p className="text-xs text-slate-500">
                JPG, PNG, or WebP up to 8 MB.
              </p>
            )}
            {product?.imageUrl ? (
              <p className="text-xs text-slate-500">
                Current image is saved. Upload a new file only when replacing it.
              </p>
            ) : null}
          </div>
          <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700 md:col-span-2">
            <input
              className="h-4 w-4 rounded border-slate-300"
              name="isActive"
              type="checkbox"
              defaultChecked={product?.isActive ?? true}
            />
            {isEditing ? "Product is active and sellable" : "Publish product immediately"}
          </label>
        </CardContent>
      </Card>
      <FormFeedback state={state} />
      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  min,
  step,
  defaultValue,
  errors,
  required = true,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  min?: string;
  step?: string;
  defaultValue?: string | number | null;
  errors?: string[];
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700" htmlFor={name}>
        {label}
      </label>
      <Input
        id={name}
        name={name}
        placeholder={placeholder}
        type={type}
        min={min}
        step={step}
        defaultValue={defaultValue ?? undefined}
        required={required}
      />
      <FieldError errors={errors} />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button type="submit">{pending ? "Saving product..." : "Save product"}</Button>;
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs font-medium text-rose-600">{errors[0]}</p>;
}
